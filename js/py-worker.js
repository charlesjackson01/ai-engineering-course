// Runs Python (Pyodide) off the main thread so Stop and timeouts always work.
import { loadPyodide } from "../vendor/pyodide/pyodide.mjs";

let py = null, runner = null;
let ctrl = null, data = null;           // SharedArrayBuffer stdin channel (interactive mode)
let mode = "interactive", queue = [], prompts = [], inputCount = 0, testOut = "", progOut = "";
let outBuf = "", lastPost = 0, sentChars = 0;
const OUT_CAP = 200000;
const dec = new TextDecoder();

function post(m) { self.postMessage(m); }
function flushOut() { if (outBuf) { post({ type: "out", text: outBuf }); outBuf = ""; lastPost = Date.now(); } }
function writeOut(text) {
  if (mode === "test") { if (testOut.length < OUT_CAP) { testOut += text; progOut += text; } return; }
  if (sentChars > OUT_CAP) return;
  sentChars += text.length; outBuf += text;
  if (sentChars > OUT_CAP) outBuf += "\n… (output cut off: too much printing)\n";
  if (Date.now() - lastPost > 40 || outBuf.length > 4000) flushOut();
}

// Returns a string, or a negative code: -1 need input (replay mode), -2 out of test inputs, -3 stop requested.
function readLine(prompt) {
  inputCount++;
  if (mode === "test") {
    prompts.push(prompt);
    if (!queue.length) return -2;
    const a = String(queue.shift()); testOut += a + "\n"; progOut += "\n"; return a;
  }
  if (mode === "replay") { flushOut(); return queue.length ? String(queue.shift()) : -1; }
  flushOut();
  Atomics.store(ctrl, 0, 0);
  post({ type: "input-request", prompt });
  Atomics.wait(ctrl, 0, 0);
  const flag = Atomics.load(ctrl, 0);
  if (flag === 2) return -3;
  const len = Atomics.load(ctrl, 1);
  return dec.decode(data.slice(0, len));
}

const PY = String.raw`
import sys, builtins, traceback, linecache, json
import coursebridge
class _NeedInput(BaseException): pass
class _OutOfInputs(BaseException): pass
def _input(prompt=""):
    p = str(prompt)
    sys.stdout.write(p); sys.stdout.flush()
    r = coursebridge.read_line(p)
    if r == -1: raise _NeedInput()
    if r == -2: raise _OutOfInputs()
    if r == -3: raise KeyboardInterrupt()
    return r
def _run(code):
    builtins.input = _input
    linecache.cache["main.py"] = (len(code), None, code.splitlines(True), "main.py")
    res = {"status": "ok"}
    try:
        compiled = compile(code, "main.py", "exec")
    except SyntaxError as e:
        return json.dumps({"status": "error", "etype": type(e).__name__, "msg": str(e.msg), "line": e.lineno,
                           "tb": "".join(traceback.format_exception_only(type(e), e))})
    ns = {"__name__": "__main__", "__builtins__": builtins}
    try:
        exec(compiled, ns)
    except _NeedInput: res = {"status": "need-input"}
    except _OutOfInputs: res = {"status": "out-of-inputs"}
    except KeyboardInterrupt: res = {"status": "interrupted"}
    except SystemExit: pass
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "main.py"]
        tb = "Traceback (most recent call last):\n" + "".join(traceback.format_list(frames)) + "".join(traceback.format_exception_only(type(e), e))
        res = {"status": "error", "etype": type(e).__name__, "msg": str(e), "line": frames[-1].lineno if frames else None, "tb": tb}
    finally:
        try:
            sys.stdout.flush(); sys.stderr.flush()
        except BaseException: pass
    return json.dumps(res)
`;

async function init(msg) {
  if (msg.sab) { ctrl = new Int32Array(msg.sab.ctrl); data = new Uint8Array(msg.sab.data); }
  py = await loadPyodide({ indexURL: new URL("../vendor/pyodide/", import.meta.url).href, stdout: undefined });
  const sink = { write: (buf) => { writeOut(dec.decode(buf)); return buf.length; } };
  py.setStdout(sink); py.setStderr(sink);
  if (msg.sab && msg.sab.interrupt) py.setInterruptBuffer(new Uint8Array(msg.sab.interrupt));
  py.registerJsModule("coursebridge", { read_line: readLine });
  py.runPython(PY);
  runner = py.globals.get("_run");
  post({ type: "ready", version: py.version });
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "init") return await init(msg);
    if (msg.type === "run") {
      mode = msg.mode; queue = (msg.inputs || []).slice(); prompts = []; inputCount = 0; testOut = ""; progOut = "";
      outBuf = ""; sentChars = 0; lastPost = Date.now();
      const res = JSON.parse(runner(msg.code));
      flushOut();
      Object.assign(res, { inputCount, prompts, transcript: testOut });
      if (mode === "test") res.out = progOut;
      post({ type: "done", id: msg.id, result: res });
    }
  } catch (err) {
    flushOut();
    if (/KeyboardInterrupt/.test(String(err))) return post({ type: "done", id: msg.id, result: { status: "interrupted" } });
    post({ type: msg.type === "init" ? "init-error" : "done", id: msg.id, result: { status: "error", etype: "InternalError", msg: String(err && err.message || err), tb: String(err) } });
  }
};
