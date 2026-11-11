// Main-thread side of the Python runner: spawns the worker, handles input(), Stop, and timeouts.
const enc = new TextEncoder();
const params = new URLSearchParams(location.search);
export const HAS_SAB = typeof SharedArrayBuffer !== "undefined" && self.crossOriginIsolated === true && !params.has("nosab");

export class PythonRunner {
  constructor({ onStatus } = {}) {
    this.onStatus = onStatus || (() => {});
    this.seq = 0; this.spawn();
  }
  spawn() {
    this.ready = false;
    this.onStatus("loading");
    this.worker = new Worker(new URL("./py-worker.js", import.meta.url), { type: "module" });
    let sab = null;
    if (HAS_SAB) {
      this.ctrlBuf = new SharedArrayBuffer(8); this.dataBuf = new SharedArrayBuffer(65536); this.intBuf = new SharedArrayBuffer(1);
      this.ctrl = new Int32Array(this.ctrlBuf); this.data = new Uint8Array(this.dataBuf); this.interrupt = new Uint8Array(this.intBuf);
      sab = { ctrl: this.ctrlBuf, data: this.dataBuf, interrupt: this.intBuf };
    }
    this.readyPromise = new Promise((resolve, reject) => { this._readyResolve = resolve; this._readyReject = reject; });
    this.worker.onmessage = (e) => this._onMessage(e.data);
    this.readyPromise.catch(() => {});
    const fail = (msg) => { if (this.ready) return; clearTimeout(this._watchdog); this.loadError = msg; this.onStatus("error", msg); this._readyReject(new Error(msg)); };
    this._fail = fail;
    this.worker.onerror = (e) => fail(e.message || "The Python worker failed to start.");
    clearTimeout(this._watchdog);
    this._watchdog = setTimeout(() => fail("Python took more than 90 seconds to start."), 90000);
    this.worker.postMessage({ type: "init", sab });
  }
  respawn() { try { this.worker.terminate(); } catch {} this.spawn(); }
  _onMessage(m) {
    if (m.type === "ready") { clearTimeout(this._watchdog); this.ready = true; this.version = m.version; this.onStatus("ready"); this._readyResolve(); return; }
    if (m.type === "init-error") { this._fail(m.result.msg || "Python failed to load."); return; }
    const job = this.job; if (!job) return;
    if (m.type === "out") job.onOut && job.onOut(m.text);
    else if (m.type === "input-request") { job.waiting = true; job.pauseTimer(); job.onInput && job.onInput(m.prompt); }
    else if (m.type === "done" && m.id === job.id) job.finish(m.result);
  }

  // Interactive run. handlers: onOut(text), onInput(prompt) -> UI later calls answer(text), onDone(result)
  async run(code, h, { timeoutMs = 15000 } = {}) {
    if (HAS_SAB) return this._run(code, "interactive", [], h, timeoutMs);
    // Fallback without SharedArrayBuffer: replay the program with the answers collected so far.
    const answers = []; let shown = 0;
    for (;;) {
      let seen = 0;
      const res = await this._run(code, "replay", answers, {
        onOut: (t) => { const start = Math.max(0, shown - seen); seen += t.length; if (start < t.length) { h.onOut(t.slice(start)); shown = seen; } },
      }, timeoutMs);
      if (res.status !== "need-input") return res;
      const ans = await new Promise((resolve) => { this._replayAnswer = resolve; h.onInput(""); });
      if (ans === null) return { status: "stopped" };
      answers.push(ans);
    }
  }
  answer(text) {
    if (!HAS_SAB) { const r = this._replayAnswer; this._replayAnswer = null; r && r(text); return; }
    const bytes = enc.encode(text).slice(0, 65536);
    this.data.set(bytes); Atomics.store(this.ctrl, 1, bytes.length);
    Atomics.store(this.ctrl, 0, 1); Atomics.notify(this.ctrl, 0);
    if (this.job) { this.job.waiting = false; this.job.resumeTimer(); }
  }
  // Scripted run for Check.
  test(code, inputs, timeoutMs = 5000) { return this._run(code, "test", inputs, {}, timeoutMs); }

  stop(reason = "stopped") {
    const job = this.job;
    if (this._replayAnswer) { const r = this._replayAnswer; this._replayAnswer = null; r(null); }
    if (!job) return;
    job.stopReason = reason;
    if (HAS_SAB) {
      // Ask Python nicely first (KeyboardInterrupt), and wake it if it is waiting for input.
      if (job.waiting) { Atomics.store(this.ctrl, 0, 2); Atomics.notify(this.ctrl, 0); } else this.interrupt[0] = 2;
      job.killTimer = setTimeout(() => { this.respawn(); job.finish({ status: reason }); }, 1500);
    } else { this.respawn(); job.finish({ status: reason }); }
  }

  async _run(code, mode, inputs, h, timeoutMs) {
    await this.readyPromise;
    if (this.job) this.stop();
    const id = ++this.seq;
    return new Promise((resolve) => {
      const job = this.job = { id, onOut: h.onOut, onInput: h.onInput, remaining: timeoutMs, startedAt: Date.now(), timer: null };
      job.pauseTimer = () => { clearTimeout(job.timer); job.timer = null; job.remaining -= Date.now() - job.startedAt; };
      job.resumeTimer = () => { job.startedAt = Date.now(); job.timer = setTimeout(() => this.stop("timeout"), Math.max(job.remaining, 0)); };
      job.finish = (result) => {
        if (job.done) return; job.done = true;
        clearTimeout(job.timer); clearTimeout(job.killTimer);
        if (this.job === job) this.job = null;
        if (HAS_SAB) this.interrupt[0] = 0;
        if (result.status === "interrupted" && job.stopReason) result.status = job.stopReason;
        resolve(result);
      };
      job.resumeTimer();
      if (HAS_SAB) { this.interrupt[0] = 0; Atomics.store(this.ctrl, 0, 0); }
      this.worker.postMessage({ type: "run", id, code, mode, inputs });
    });
  }
}

// Friendly explanations for common errors.
export function friendlyError(r) {
  const at = r.line ? ` on line ${r.line}` : "";
  const t = r.etype, m = r.msg || "";
  let tip = "Read the last line of the error first. It names the problem.";
  if (t === "SyntaxError") tip = /never closed|unterminated|EOL|EOF/.test(m) ? "Something was opened but never closed: a quote, ( or [. Check the line it points to and the one above." : /expected ':'/.test(m) ? "Lines that start with if, elif, else, while, and for need a colon : at the end." : /invalid syntax.*=|Maybe you meant '=='/.test(m) ? "In a check, use == (two equals). One = stores a value." : "Python couldn't read this line. Look for a missing colon, quote, or bracket.";
  else if (t === "IndentationError") tip = "Indentation means the spaces at the start of a line. Lines inside if, while, or for need 4 spaces. Lines after the block go back to the left edge.";
  else if (t === "NameError") { const n = (m.match(/name '(\w+)'/) || [])[1]; tip = n ? `Python doesn't know “${n}” yet. Check the spelling, give it a value before you use it, or add quotes if you meant the word ${n}.` : "A name was used before it was given a value."; }
  else if (t === "TypeError" && /concatenate|can only concatenate|unsupported operand/.test(m)) tip = "You're mixing text and a number. Wrap the number in str() to join it, or the text in int() to do math.";
  else if (t === "TypeError") tip = "A value is the wrong type for what you're doing. Check whether it's text or a number.";
  else if (t === "ValueError" && /int\(\)/.test(m)) tip = "int() only works on text that looks like a whole number, like \"15\". It can't turn words into numbers.";
  else if (t === "IndexError") tip = "That position isn't in the list. Counting starts at 0, so a list of 3 items ends at index 2.";
  else if (t === "ZeroDivisionError") tip = "You divided by zero. Python can't do that.";
  else if (t === "KeyError") tip = "That label isn't in the dictionary. Check the spelling and quotes.";
  else if (t === "InternalError") tip = "Something went wrong inside the editor, not your code. Try Run again, or reload the page.";
  return { title: `${t}${at}`, msg: m, tip, tb: r.tb || "" };
}
