import { EditorView, EditorState, basicSetup, python, keymap, indentWithTab, indentUnit } from "../vendor/cm.js";
import { LESSONS, LESSON_ORDER, QUIZ, ruleChecks, RUN_TESTS, PREVIEW_IDS } from "./content.js";
import { renderDiagram } from "./diagrams.js";
import { PythonRunner, friendlyError, HAS_SAB } from "./python.js";
import * as store from "./store.js";

let state = store.load();
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
const persist = () => store.save(state);
const ACTIVE = LESSON_ORDER.filter((id) => !PREVIEW_IDS.includes(id));

// ---------- Python ----------
const statusListeners = new Set();
let pyStatus = "loading", pyStatusMsg = "";
const runner = new PythonRunner({ onStatus: (s, msg) => { pyStatus = s; pyStatusMsg = msg || ""; statusListeners.forEach((f) => f()); } });

// ---------- Router ----------
const main = $("#main");
let cleanup = null;
function route() {
  const h = location.hash.replace(/^#\/?/, "") || "home";
  const [page, arg] = h.split("/");
  if (cleanup) { cleanup(); cleanup = null; }
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === page));
  main.innerHTML = "";
  if (page === "lesson" && LESSONS[arg]) renderLesson(arg);
  else if (page === "lessons") renderLesson(state.current || "warmup");
  else if (page === "play") renderPlay();
  else if (page === "cheat") renderCheat();
  else if (page === "quiz") renderQuiz();
  else renderHome();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// ---------- Helpers ----------
function doneCount() { return ACTIVE.filter((id) => state.done[id]).length; }
function lessonStatus(id) {
  if (PREVIEW_IDS.includes(id)) return ["Preview", "lock"];
  if (state.done[id]) return ["Done", "done"];
  if (id === state.current) return ["Current", "current"];
  const next = ACTIVE.find((x) => !state.done[x] && x !== state.current);
  return id === next ? ["Up next", "next"] : ["To do", "todo"];
}
function lessonLabel(id) { const L = LESSONS[id]; return `${L.tag} · ${L.title}`; }
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function toast(msg) { const t = el(`<div class="toast" role="status">${md(msg)}</div>`); document.body.appendChild(t); setTimeout(() => t.classList.add("show"), 10); setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600); }

// ---------- Home ----------
function renderHome() {
  const total = ACTIVE.length, done = doneCount(), pct = Math.round((done / total) * 100);
  const cur = state.current && LESSONS[state.current] ? state.current : "warmup";
  const p = state.practice;
  const rows = LESSON_ORDER.map((id) => { const [label, cls] = lessonStatus(id); return `<a class="row" href="#/lesson/${id}"><span class="dot ${cls}"></span><span class="row-title">${esc(lessonLabel(id))}</span><span class="pill ${cls}">${label}</span></a>`; });
  rows.splice(5, 0, `<div class="row"><span class="dot done"></span><span class="row-title">Quiz 1</span><span class="pill done">${state.quiz1.score}/${state.quiz1.total}</span></div>`);
  main.innerHTML = `
  <section class="hero card">
    <p class="eyebrow">Phase 0 · First steps</p>
    <h1>Welcome back, Cole.</h1>
    <p class="lead">One concept, one picture, one small task. Write and run Python right here, no Colab tab needed.</p>
    <div class="progress" aria-label="Progress"><div class="bar" style="width:${pct}%"></div></div>
    <p class="muted small">${done} of ${total} lessons done · Quiz 1: ${state.quiz1.score}/${state.quiz1.total}${p.best != null ? ` · Practice quiz best: ${p.best}/8` : ""}</p>
    <div class="callout"><strong>Up next:</strong> ${esc(lessonLabel(cur))}${cur === "warmup" ? ", then Lesson 9: lists and for loops." : "."}
      <div class="btns"><a class="btn primary" href="#/lesson/${cur}">Continue ${esc(LESSONS[cur].tag)} →</a><a class="btn" href="#/cheat">While-loop cheat sheet</a></div></div>
  </section>
  <section class="card"><h2>Your progress</h2><div class="rows">${rows.join("")}</div></section>
  <section class="card"><h2>The roadmap</h2><p class="muted">About 18 to 24 months, one concept at a time. Math shows up only when the code needs it, and always with a picture.</p>
    ${renderDiagram({ type: "chain", nodes: [
      { label: "Phase 0 · First steps", detail: "~4 weeks · you are here", kind: "decision" },
      { label: "Python foundations", detail: "~8 weeks · a small game" },
      { label: "Seeing data", detail: "~6 weeks" },
      { label: "Math through pictures", detail: "~8 weeks" },
      { label: "Classical ML", detail: "~10 weeks" },
      { label: "Neural networks, then LLMs", detail: "~16 weeks" },
      { label: "Building AI apps", detail: "~16 weeks · RAG, agents, capstone", kind: "terminal" }] }, "Course roadmap")}
  </section>
  <section class="card"><h2>Your saved work</h2>
    <p class="muted small">Progress, code, and quiz scores are saved in this browser. Your phone and laptop each keep their own copy, so use Export and Import to move it between them.</p>
    <div class="btns"><button class="btn" id="exp">Export progress</button><label class="btn" for="imp">Import progress</label><input type="file" id="imp" accept="application/json,.json" hidden><button class="btn ghost" id="rst">Reset</button></div>
  </section>`;
  $("#exp").onclick = () => store.exportJSON(state);
  $("#imp").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { state = store.importJSON(await f.text()); toast("Progress imported."); route(); } catch (err) { toast(err.message); } };
  $("#rst").onclick = () => { if (confirm("Reset all progress back to the starting point (Lessons 1–8 done)? Your saved code will be cleared.")) { state = store.reset(); route(); } };
}

// ---------- Lesson ----------
function renderLesson(id) {
  const L = LESSONS[id];
  if (!L.preview) { state.current = state.done[id] ? state.current : id; persist(); }
  const idx = LESSON_ORDER.indexOf(id), prev = LESSON_ORDER[idx - 1], next = LESSON_ORDER[idx + 1];
  const chips = LESSON_ORDER.map((x) => { const [, cls] = lessonStatus(x); return `<a href="#/lesson/${x}" class="chip ${cls} ${x === id ? "sel" : ""}">${esc(LESSONS[x].tag)}${cls === "done" ? " ✓" : cls === "lock" ? " 🔒" : ""}</a>`; }).join("");
  const [stLabel, stCls] = lessonStatus(id);
  const header = `<nav class="chips" aria-label="Lessons">${chips}</nav>
    <header class="lesson-head"><p class="eyebrow">${esc(L.tag)}</p><h1>${esc(L.title)}</h1><span class="pill ${stCls}">${stLabel}</span></header>`;
  const pager = `<div class="pager">${prev ? `<a class="btn" href="#/lesson/${prev}">← ${esc(LESSONS[prev].tag)}</a>` : "<span></span>"}${next ? `<a class="btn" href="#/lesson/${next}">${esc(LESSONS[next].tag)} →</a>` : ""}</div>`;
  if (L.preview) {
    main.innerHTML = `${header}<section class="card locked"><h2>🔒 Coming soon</h2><p>${md(L.concept)}</p>${L.example ? `<pre class="code">${esc(L.example)}</pre>` : ""}<p class="muted small">This unlocks after Lesson 9. No need to study it yet.</p></section>${pager}`;
    return;
  }
  main.innerHTML = `${header}
  <div class="lesson-grid">
    <div class="lesson-text">
      <section class="card"><h2>The idea</h2><p>${md(L.concept)}</p></section>
      <section class="card"><h2>Example</h2><pre class="code">${esc(L.example)}</pre><div class="btns"><button class="btn" id="tryit">Try it in the editor ↓</button></div></section>
      <section class="card"><h2>Picture it</h2>${renderDiagram(L.diagram, L.title)}</section>
      <section class="card task"><h2>Your task <span class="muted small">(under 20 min)</span></h2><p>${md(L.task)}</p></section>
      <section class="card warn"><h2>Watch for this</h2><p>${md(L.mistakes)}</p></section>
    </div>
    <div class="lesson-work" id="work"></div>
  </div>
  <div class="done-row"><label class="check"><input type="checkbox" id="markdone" ${state.done[id] ? "checked" : ""}> Mark this lesson done</label></div>
  ${pager}`;
  const ws = mountWorkspace($("#work"), {
    lessonId: id, code: state.drafts[id] ?? L.starter,
    onChange: (c) => { state.drafts[id] = c; persist(); },
    onReset: () => L.starter,
  });
  $("#tryit").onclick = () => { ws.setCode(L.example); ws.focusEditor(); $("#work").scrollIntoView({ behavior: "smooth", block: "start" }); toast("Example loaded. Hit **Run**."); };
  $("#markdone").onchange = (e) => { if (e.target.checked) state.done[id] = new Date().toISOString(); else delete state.done[id]; persist(); };
  cleanup = ws.destroy;
}

// ---------- Playground ----------
function renderPlay() {
  main.innerHTML = `<header class="lesson-head"><p class="eyebrow">Scratchpad</p><h1>Playground</h1></header>
    <p class="muted">Try anything here. It's saved automatically, just like a Colab cell.</p><div id="work"></div>`;
  const ws = mountWorkspace($("#work"), { code: state.drafts.play ?? '# Your scratchpad\nname = input("What\'s your name? ")\nprint("Hi " + name + "!")\n', onChange: (c) => { state.drafts.play = c; persist(); } });
  cleanup = ws.destroy;
}

// ---------- Cheat sheet ----------
function renderCheat() {
  const broken = 'password = ""\nwhile password != "python":\n    print("Wrong, try again")\n# CHANGE is missing! password never changes.';
  main.innerHTML = `<header class="lesson-head"><p class="eyebrow">Cheat sheet</p><h1>While loops</h1></header>
  <p class="lead">Every while loop is the same three-part pattern. If you get stuck, find which part is missing.</p>
  <div class="steps">
    <section class="card step s1"><span class="badge">1</span><h2>SETUP</h2><p>Before the loop, give the variable a starting value, like <code>password = ""</code>.</p></section>
    <section class="card step s2"><span class="badge">2</span><h2>CHECK</h2><p>The <code>while</code> line asks a yes/no question, like <code>while password != "python":</code>. If it's true, the loop body runs.</p></section>
    <section class="card step s3"><span class="badge">3</span><h2>CHANGE</h2><p>Inside the loop, update the variable, like <code>password = input("What's the password? ")</code>. Without this, the CHECK never changes and the loop never ends.</p></section>
    <section class="card step s4"><span class="badge">+</span><h2>After the loop (optional)</h2><p>When the CHECK is false, Python leaves the loop. A print here is only if you want to say something, like <code>print("Access granted")</code>.</p></section>
  </div>
  <section class="card"><h2>The password example</h2>
    <pre class="code annotated"><span class="ln s1">password = ""</span><span class="tag s1">SETUP</span>
<span class="ln s2">while password != "python":</span><span class="tag s2">CHECK</span>
<span class="ln s3">    password = input("What's the password? ")</span><span class="tag s3">CHANGE</span>
<span class="ln s4">print("Access granted")</span><span class="tag s4">after</span></pre>
    <div class="btns"><a class="btn primary" href="#/lesson/warmup">Do the warm-up →</a></div></section>
  <section class="card warn"><h2>Pitfall: the infinite loop</h2>
    <p>If CHANGE is missing, the CHECK is asked the same question forever. Here <code>password</code> never changes, so the loop never ends:</p>
    <pre class="code">${esc(broken)}</pre>
    <p><strong>The fix:</strong> put <code>input()</code> inside the loop, indented under <code>while</code>. If it ever happens, hit <strong>Stop</strong>. The editor also stops any program on its own after 15 seconds.</p>
    <div class="btns"><button class="btn" id="trybroken">Try the broken one in the Playground</button></div></section>
  ${renderDiagram(LESSONS.l8.diagram, "while loop")}`;
  $("#trybroken").onclick = () => { state.drafts.play = broken + "\n"; persist(); location.hash = "#/play"; setTimeout(() => toast("Hit **Run**, then **Stop**."), 300); };
}

// ---------- Quiz ----------
function renderQuiz() {
  const p = state.practice;
  const score = () => p.picks.reduce((s, x, i) => s + (x === QUIZ[i].correct ? 1 : 0), 0);
  const answered = () => p.picks.filter((x) => x !== null).length;
  main.innerHTML = `<header class="lesson-head"><p class="eyebrow">Practice quiz</p><h1>Lessons 1–8</h1></header>
    <p class="muted">Eight questions. Tap an answer to see why. Your answers and best score are saved.</p>
    <div class="card scorebar" id="scorebar"></div><div id="qs"></div>
    <div class="btns"><button class="btn" id="qreset">Reset quiz</button></div>`;
  const drawScore = () => { $("#scorebar").innerHTML = `<strong>Score: ${score()} / 8</strong><span class="muted">Answered ${answered()} of 8${p.best != null ? ` · Best ${p.best}/8` : ""}</span>`; };
  const qs = $("#qs");
  QUIZ.forEach((q, i) => {
    const card = el(`<section class="card q" data-q="${i}"><p class="qnum">Question ${i + 1}</p><p class="qprompt">${md(q.prompt)}</p><div class="opts"></div><div class="why" hidden></div></section>`);
    q.options.forEach((o, j) => { const b = el(`<button class="opt">${md(o)}</button>`); b.onclick = () => pick(i, j); $(".opts", card).appendChild(b); });
    qs.appendChild(card);
  });
  function paint(i) {
    const card = qs.children[i], v = p.picks[i], q = QUIZ[i];
    [...card.querySelectorAll(".opt")].forEach((b, j) => { b.disabled = v !== null; b.classList.toggle("right", v !== null && j === q.correct); b.classList.toggle("wrong", v === j && j !== q.correct); });
    const why = $(".why", card);
    if (v !== null) { why.hidden = false; why.className = "why " + (v === q.correct ? "ok" : "bad"); why.innerHTML = `<strong>${v === q.correct ? "Correct." : "Not quite."}</strong> ${md(q.why)}`; } else why.hidden = true;
  }
  function pick(i, j) {
    if (p.picks[i] !== null) return;
    p.picks[i] = j;
    if (answered() === 8) { const s = score(); p.history.push({ at: new Date().toISOString(), score: s }); p.best = Math.max(p.best ?? 0, s); toast(`Quiz done: **${s}/8**${s === 8 ? ". Perfect!" : ". Read the explanations on the misses."}`); }
    persist(); paint(i); drawScore();
  }
  QUIZ.forEach((_, i) => paint(i)); drawScore();
  $("#qreset").onclick = () => { p.picks = Array(8).fill(null); persist(); renderQuiz(); };
}

// ---------- Workspace: editor + console + check ----------
function mountWorkspace(host, { lessonId, code, onChange, onReset }) {
  host.innerHTML = `<section class="card ws">
    <div class="ws-top"><h2>${lessonId ? "Your code" : "Editor"}</h2><span class="py-status" aria-live="polite"></span></div>
    <div class="editor"></div>
    <div class="keys" aria-label="Extra keys">${["Tab", "⇤", ":", '"', "(", ")", "=", "[", "]", "+", "#"].map((k) => `<button class="key" data-k="${esc(k)}" tabindex="-1">${esc(k)}</button>`).join("")}</div>
    <div class="ws-actions">
      <button class="btn primary run">▶ Run</button><button class="btn stop" disabled>■ Stop</button>
      ${lessonId ? `<button class="btn check">✓ Check</button>` : ""}
      ${onReset ? `<button class="btn ghost resetcode" title="Start over">↺ Start over</button>` : ""}
    </div>
    <div class="console-wrap"><div class="console-head"><span>Output</span><button class="link clear">Clear</button></div><pre class="console" tabindex="0"><span class="muted">Press Run to see your program's output here.</span></pre></div>
    <div class="results" hidden></div>
  </section>`;
  const statusEl = $(".py-status", host), runBtn = $(".run", host), stopBtn = $(".stop", host), checkBtn = $(".check", host), con = $(".console", host), results = $(".results", host);
  let busy = false, saveT = null, inputEl = null;

  const view = new EditorView({
    parent: $(".editor", host),
    state: EditorState.create({ doc: code, extensions: [
      basicSetup, python(), indentUnit.of("    "), EditorView.lineWrapping,
      keymap.of([indentWithTab, { key: "Mod-Enter", run: () => { doRun(); return true; } }]),
      EditorView.updateListener.of((u) => { if (u.docChanged) { clearTimeout(saveT); saveT = setTimeout(() => onChange(view.state.doc.toString()), 300); } }),
      EditorView.contentAttributes.of({ autocapitalize: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Python code editor" }),
    ] }),
  });
  $(".editor", host)._cm = view; // handy for automated tests
  const getCode = () => view.state.doc.toString();
  const setCode = (c) => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: c } }); onChange(c); };

  host.querySelectorAll(".key").forEach((b) => {
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.onclick = () => {
      const k = b.dataset.k, sel = view.state.selection.main;
      if (k === "Tab") view.dispatch(view.state.replaceSelection("    "));
      else if (k === "⇤") { const line = view.state.doc.lineAt(sel.head); const m = line.text.match(/^ {1,4}/); if (m) view.dispatch({ changes: { from: line.from, to: line.from + m[0].length } }); }
      else view.dispatch(view.state.replaceSelection(k));
      view.focus();
    };
  });

  const paintStatus = () => {
    const map = { loading: ["Starting Python…", "load"], ready: [busy ? "Running…" : "Python ready", busy ? "run" : "ok"], error: ["Python failed to load", "bad"] };
    const [t, c] = map[pyStatus] || ["", ""]; statusEl.textContent = t; statusEl.className = "py-status " + c; if (pyStatus === "error") statusEl.title = pyStatusMsg;
  };
  statusListeners.add(paintStatus); paintStatus();

  const write = (text, cls) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; con.appendChild(s); trim(); con.scrollTop = con.scrollHeight; };
  const trim = () => { while (con.childNodes.length > 3000) con.removeChild(con.firstChild); };
  const clearCon = () => { con.innerHTML = ""; };
  const removeInput = () => { if (inputEl) { inputEl.remove(); inputEl = null; } };
  function askInput() {
    removeInput();
    inputEl = el(`<form class="inbox"><input type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Type your answer"><button class="btn primary small">Enter ↵</button></form>`);
    con.appendChild(inputEl); con.scrollTop = con.scrollHeight;
    const inp = $("input", inputEl); setTimeout(() => inp.focus({ preventScroll: false }), 0);
    statusEl.textContent = "Waiting for your answer…"; statusEl.className = "py-status wait";
    inputEl.onsubmit = (e) => { e.preventDefault(); const v = inp.value; removeInput(); write(v + "\n", "echo"); paintStatus(); runner.answer(v); };
  }
  function errorBlock(r) {
    const f = friendlyError(r);
    const box = el(`<div class="errbox"><div class="err-title">⚠ ${esc(f.title)}</div>${f.msg ? `<div class="err-msg">${esc(f.msg)}</div>` : ""}<div class="err-tip">💡 ${esc(f.tip)}</div>${f.tb ? `<details><summary>Full error (read from the bottom)</summary><pre>${esc(f.tb)}</pre></details>` : ""}</div>`);
    con.appendChild(box); con.scrollTop = con.scrollHeight;
  }
  const setBusy = (b) => { busy = b; runBtn.disabled = false; stopBtn.disabled = !b; if (checkBtn) checkBtn.disabled = b; paintStatus(); };

  async function doRun() {
    if (busy) runner.stop();
    clearCon(); results.hidden = true; setBusy(true);
    if (!runner.ready) { write("Starting Python… (the first load takes a few seconds)\n", "muted"); await runner.readyPromise; clearCon(); }
    const r = await runner.run(getCode(), { onOut: (t) => write(t), onInput: askInput });
    removeInput(); setBusy(false);
    if (r.status === "ok") write("\n✓ Finished\n", "sys ok");
    else if (r.status === "error") errorBlock(r);
    else if (r.status === "timeout") write("\n■ Stopped: your program ran for 15 seconds without finishing. That's usually an infinite loop. Check that something inside the loop CHANGEs the variable the CHECK looks at.\n", "sys bad");
    else if (r.status === "stopped") write("\n■ Stopped.\n", "sys");
  }
  runBtn.onclick = doRun;
  stopBtn.onclick = () => runner.stop("stopped");
  $(".clear", host).onclick = clearCon;
  if (onReset) $(".resetcode", host).onclick = () => { if (confirm("Replace your code with the starting comment? (Ctrl+Z undoes it.)")) setCode(onReset()); };

  if (checkBtn) checkBtn.onclick = async () => {
    const c = getCode();
    setBusy(true); results.hidden = false; results.innerHTML = `<p class="muted">Checking… running your code with test answers.</p>`;
    const items = ruleChecks(lessonId, c).map((x) => ({ ...x, kind: "rule" }));
    const cache = new Map(); let firstRun = null;
    if (c.trim()) {
      for (const t of RUN_TESTS[lessonId] || []) {
        const key = JSON.stringify(t.inputs);
        if (!cache.has(key)) cache.set(key, await runner.test(c, t.inputs, 5000));
        const r = cache.get(key); firstRun = firstRun || { r, inputs: t.inputs };
        if (r.status === "error") { const f = friendlyError(r); if (!items.some((x) => x.err)) items.unshift({ ok: false, err: true, kind: "run", text: `Running it hit an error: ${f.title}`, correction: f.msg, hint: f.tip }); continue; }
        if (r.status === "timeout") { if (!items.some((x) => x.to)) items.unshift({ ok: false, to: true, kind: "run", text: "It didn't finish within 5 seconds", correction: t.inputs.length ? `We typed ${t.inputs.join(", ")} and the program was still running.` : "The program was still running after 5 seconds.", hint: "That's usually an infinite loop. Check SETUP, CHECK, CHANGE." }); continue; }
        items.push({ ...t.judge(r), kind: "run" });
      }
    }
    setBusy(false);
    const passed = items.filter((x) => x.ok), failed = items.filter((x) => !x.ok), all = failed.length === 0 && items.length > 0;
    const li = (x) => `<li class="${x.ok ? "pass" : "fail"}"><span class="mark">${x.ok ? "✓" : "✗"}</span><div><div class="it">${md(x.text)} <span class="kind">${x.kind === "run" ? "ran it" : "read it"}</span></div><div class="corr">${md(x.correction)}</div><div class="hint">Hint: ${md(x.hint)}</div></div></li>`;
    const transcript = firstRun && firstRun.r.transcript ? `<details><summary>What the checker ran${firstRun.inputs.length ? ` (typing: ${esc(firstRun.inputs.join(", "))})` : ""}</summary><pre class="console small">${esc(firstRun.r.transcript)}</pre></details>` : "";
    results.innerHTML = `<div class="sum ${all ? "ok" : ""}">${all ? "🎉 All checks passed!" : `${passed.length} of ${items.length} checks passed`}</div><ul class="checks">${failed.map(li).join("")}${passed.map(li).join("")}</ul>${transcript}
      ${all ? nextLink(lessonId) : `<p class="muted small">Fix one thing at a time, then hit Check again.</p>`}`;
    (state.submissions[lessonId] ||= []).push({ at: new Date().toISOString(), passed: passed.length, total: items.length, code: c });
    if (state.submissions[lessonId].length > 20) state.submissions[lessonId].shift();
    if (all && !state.done[lessonId]) { state.done[lessonId] = new Date().toISOString(); const nx = ACTIVE.find((x) => !state.done[x]); state.current = nx || state.current; const md2 = $("#markdone"); if (md2) md2.checked = true; }
    persist();
    results.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return {
    setCode, focusEditor: () => view.focus(),
    destroy: () => { statusListeners.delete(paintStatus); if (busy) runner.stop(); clearTimeout(saveT); onChange(getCode()); view.destroy(); },
  };
}
function nextLink(id) {
  const nx = LESSON_ORDER[LESSON_ORDER.indexOf(id) + 1];
  return nx ? `<div class="btns"><a class="btn primary" href="#/lesson/${nx}">Next: ${esc(lessonLabel(nx))} →</a></div>` : "";
}

if (!HAS_SAB) console.info("Cross-origin isolation is off; using replay mode for input().");
route();
