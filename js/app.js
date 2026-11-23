import { EditorView, EditorState, basicSetup, python, keymap, indentWithTab, indentUnit } from "../vendor/cm.js";
import { LESSONS, LESSON_ORDER, LOOP, QUIZ, SKILLS, MILESTONES, REVIEWS, PHASE_LABEL, PREVIEW_IDS } from "./content.js";
import { renderDiagram } from "./diagrams.js";
import { alsoPassedSentence, gradeRules, judgeRun, shortPassLabel } from "./grade.js";
import { renderMermaid } from "./mermaid-lite.js";
import { PythonRunner, friendlyError, HAS_SAB } from "./python.js";
import * as store from "./store.js";

let state = store.load();
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const CODEISH = /`([^`]+)`|\b[A-Za-z_]\w*\s*=\s*\[[^\]]+\]|\b[A-Za-z_]\w*\s*=\s*[A-Za-z_]\w*\s*\+\s*[A-Za-z_]\w*|\b[A-Za-z_]\w*\s*=\s*\d+|\b[A-Za-z_]\w*\[[^\]]+\]|\b(?:len|print|input|int|str|greet)\s*\([^)\n]*\)/g;
function md(s) {
  const src = String(s ?? "");
  const re = new RegExp(CODEISH.source, "g");
  let out = "", last = 0, m;
  const bold = (t) => t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  while ((m = re.exec(src))) {
    out += bold(esc(src.slice(last, m.index)));
    out += `<code>${esc(m[1] != null ? m[1] : m[0])}</code>`;
    last = m.index + m[0].length;
  }
  return out + bold(esc(src.slice(last)));
}
const persist = () => store.save(state);
const ACTIVE = LESSON_ORDER.filter((id) => !PREVIEW_IDS.includes(id));
const STEP_NAME = { see: "See", predict: "Predict", tweak: "Tweak", fix: "Fix", build: "Build" };
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n) => WORDS[n] ?? String(n);
const PHASE0_ORDER = ["python-fundamentals", "data-handling", "prompt-engineering", "evaluation", "safety", "agents-tool-use"];
const LATER_ORDER = ["ml-basics", "llm-apis", "rag", "deployment-mlops"];

const statusListeners = new Set();
let pyStatus = "loading", pyStatusMsg = "";
const runner = new PythonRunner({ onStatus: (s, msg) => { pyStatus = s; pyStatusMsg = msg || ""; statusListeners.forEach((f) => f()); } });

const main = $("#main");
let cleanup = null;
function route() {
  const parts = (location.hash.replace(/^#\/?/, "") || "home").split("/").filter(Boolean);
  const page = parts[0] || "home";
  if (cleanup) { cleanup(); cleanup = null; }
  const nav = page === "skills" || page === "projects" || page === "home" ? "home" : (page === "lesson" || page === "lessons") ? "lesson" : page;
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
  main.innerHTML = "";
  if (page === "lesson" && LESSONS[parts[1]]) renderLesson(parts[1], parts[2]);
  else if (page === "lessons") renderLesson(state.current && LESSONS[state.current] ? state.current : "warmup");
  else if (page === "play") renderPlay();
  else if (page === "cheat") renderCheat();
  else if (page === "quiz") renderQuiz(parts[1]);
  else if (page === "skills") renderSkills();
  else if (page === "projects") renderProjects(parts[1]);
  else renderHome();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

function doneCount() { return ACTIVE.filter((id) => state.done[id]).length; }
function lessonStatus(id) {
  if (state.done[id]) return ["Done", "done"];
  if (id === state.current) return ["Up next", "next"];
  const next = ACTIVE.find((x) => !state.done[x] && x !== state.current);
  return id === next ? ["Up next", "next"] : ["To do", "todo"];
}
function lessonLabel(id) { const L = LESSONS[id]; return `${L.tag} · ${L.title}`; }
function lessonNice(id) { const t = LESSONS[id].tag; return /^L\d+$/.test(t) ? `Lesson ${t.slice(1)}` : t; }
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function toast(msg) {
  const t = el(`<div class="toast" role="status">${md(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}
function skillStat(skill) {
  const ids = skill.now || [];
  const done = ids.filter((id) => state.done[id]).length;
  return { done, total: ids.length, complete: ids.length > 0 && done === ids.length, later: ids.length === 0, ids };
}
function coveredCount() { return SKILLS.filter((s) => skillStat(s).complete).length; }
function orderSkills(ids) {
  return ids.map((id) => SKILLS.find((s) => s.id === id)).filter(Boolean);
}
function coveredPhrase(ids) {
  const ordered = [...ids].sort((a, b) => LESSON_ORDER.indexOf(a) - LESSON_ORDER.indexOf(b));
  const tags = ordered.map((id) => LESSONS[id] ? LESSONS[id].tag : id);
  if (tags.length <= 1) return `Done in ${tags[0] || "this phase"}`;
  const idxs = ordered.map((id) => LESSON_ORDER.indexOf(id));
  const contiguous = idxs.every((n, i) => i === 0 || n === idxs[i - 1] + 1);
  return contiguous ? `Done in ${tags[0]}–${tags.at(-1)}` : `Done in ${tags.join(", ")}`;
}
function reviewById(id) { return REVIEWS.find((r) => r.id === id); }
function reviewMeta(review, n) {
  const rec = state.reviews[review.id] || { picks: [] };
  const answered = review.questions.every((_, i) => rec.picks[i] != null);
  const legacy = review.after === "l4" && !!(state.quiz1 && state.quiz1.done);
  const unlocked = !!state.done[review.after];
  return { n, answered, legacy, unlocked, done: answered || legacy, locked: !unlocked };
}
function pathRows() {
  const items = [];
  for (const id of LESSON_ORDER) {
    items.push({ kind: "lesson", id });
    const rev = REVIEWS.find((r) => r.after === id);
    if (rev) items.push({ kind: "review", review: rev, n: REVIEWS.indexOf(rev) + 1 });
  }
  const rows = [];
  let row = [];
  for (const item of items) {
    row.push(item);
    if (item.kind === "review") { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  return rows;
}
function seg(on) {
  return `<div class="seg" role="tablist">${[["skills", "Skills", "#/skills"], ["projects", "Projects", "#/projects"]].map(([id, label, href]) => `<a role="tab" href="${href}" class="${on === id ? "on" : ""}">${label}</a>`).join("")}</div>`;
}

function renderHome() {
  const total = ACTIVE.length, done = doneCount();
  const pct = total ? Math.round((done / total) * 100) : 0;
  const cur = state.current && LESSONS[state.current] ? state.current : "warmup";
  const q = state.quiz1 || { score: 0, total: 5 };
  let up = lessonLabel(cur);
  if (cur === "warmup") up += ", then Lesson 9: lists and for loops.";
  else up += ".";
  const covered = coveredCount();
  const rows = pathRows().map((row) => `<div class="path-row">${row.map(pathChip).join("")}</div>`).join("");
  main.innerHTML = `
  <section class="hero card">
    <p class="eyebrow">${esc(PHASE_LABEL)}</p>
    <h1>Welcome back, Cole.</h1>
    <p class="lead">One picture, one short task, then you write the code.</p>
    <div class="progress" aria-label="Progress"><div class="bar" style="width:${pct}%"></div></div>
    <p class="muted small">${done} of ${total} lessons done · Quiz 1: ${esc(q.score)}/${esc(q.total)}</p>
    <div class="callout"><strong>Up next:</strong> ${esc(up)}
      <div class="btns"><a class="btn primary" href="#/lesson/${cur}">Continue ${esc(LESSONS[cur].tag)} →</a></div>
    </div>
  </section>
  <section class="card">
    <h2>How each lesson works</h2>
    <p>See, Predict, Tweak, Fix, Build. Answers stay hidden until you try.</p>
    <div class="stepper static" aria-hidden="true">${LOOP.map((s) => `<span>${STEP_NAME[s]}</span>`).join("")}</div>
  </section>
  <section class="card">
    <h2>Your path</h2>
    ${rows}
    <p class="path-links"><a href="#/skills">Skills map</a> · ${word(covered)} of ${word(SKILLS.length)} covered · <a href="#/projects">Projects</a></p>
  </section>
  <section class="card">
    <h2>The roadmap</h2>
    <p class="muted">About 18 to 24 months, one concept at a time. Math shows up only when the code needs it, and always with a picture.</p>
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
  $("#rst").onclick = () => { if (confirm("Reset all progress back to the starting point (Lessons 1–8 done, Quiz 1 at 5/5)? Your saved code will be cleared.")) { state = store.reset(); route(); } };
}
function pathChip(item) {
  if (item.kind === "lesson") {
    const id = item.id;
    const done = !!state.done[id];
    const current = !done && id === state.current;
    const cls = done ? "done" : current ? "current" : "";
    return `<a class="path-chip ${cls}" href="#/lesson/${id}">${esc(LESSONS[id].tag)}${done ? " ✓" : ""}</a>`;
  }
  const meta = reviewMeta(item.review, item.n);
  const cls = meta.locked ? "locked" : meta.done ? "done" : "";
  const mark = meta.locked ? " 🔒" : meta.done ? " ✓" : "";
  return `<a class="path-chip ${cls}" href="#/quiz/${item.review.id}">Review ${item.n}${mark}</a>`;
}

function renderLesson(id, requested) {
  const L = LESSONS[id];
  const step = LOOP.includes(requested) ? requested : ((state.steps[id] && state.steps[id].at) || "see");
  const rec = state.steps[id] && Array.isArray(state.steps[id].seen) ? state.steps[id] : { at: "see", seen: [] };
  for (const name of LOOP.slice(0, LOOP.indexOf(step) + 1)) {
    if (!rec.seen.includes(name)) rec.seen.push(name);
  }
  rec.at = step;
  state.steps[id] = rec;
  if (!state.done[id]) state.current = id;
  persist();
  const [stLabel, stCls] = lessonStatus(id);
  const pills = LOOP.map((name) => {
    const cls = name === step ? "on" : rec.seen.includes(name) ? "done" : "";
    return `<button type="button" class="${cls}" data-step="${name}" aria-current="${name === step ? "step" : "false"}">${STEP_NAME[name]}</button>`;
  }).join("");
  main.innerHTML = `<article class="lesson-page">
    <header class="lesson-head"><p class="kicker">${esc(L.tag)}</p><div class="title-row"><h1>${esc(L.title)}</h1><span class="pill ${stCls}">${stLabel}</span></div></header>
    <div class="stepper" role="tablist">${pills}</div>
    <div id="step"></div>
  </article>`;
  main.querySelectorAll("[data-step]").forEach((b) => { b.onclick = () => go(`#/lesson/${id}/${b.dataset.step}`); });
  const slot = $("#step");
  if (step === "see") slot.innerHTML = seeHTML(id);
  else if (step === "predict") paintPredict(id, slot);
  else if (step === "tweak") paintTweak(id, slot);
  else if (step === "fix") paintFix(id, slot);
  else paintBuild(id, slot);
}
function seeHTML(id) {
  const L = LESSONS[id];
  const see = L.see || {};
  const diagram = see.diagram && see.diagram.type ? renderDiagram(see.diagram, L.title) : "";
  const flow = see.mermaid ? renderMermaid(see.mermaid, L.title) : "";
  return `<section class="card see-card">${diagram ? `<div class="figure">${diagram}</div>` : ""}<p class="explain">${md(see.explain || L.concept || "")}</p></section>
    <a class="btn primary step-next" href="#/lesson/${id}/predict">Continue to Predict →</a>
    ${flow ? `<section class="card flowchart"><p class="kicker">Flowchart</p>${flow}</section>` : ""}`;
}
function paintPredict(id, slot) {
  const qs = LESSONS[id].predict;
  let index = state.predictCursor && state.predictCursor[id];
  if (index == null || index < 0 || index >= qs.length) {
    const open = qs.findIndex((q) => state.predictPicks[q.id] == null);
    index = open < 0 ? qs.length - 1 : open;
  }
  const q = qs[index];
  const pick = state.predictPicks[q.id];
  const revealed = pick != null;
  const card = el(`<section class="card"><p class="kicker">Predict ${index + 1} of ${qs.length}</p><h2>What does this print?</h2><pre class="code">${esc(q.code)}</pre><div class="opts"></div>${revealed ? "" : `<p class="muted small">Pick an answer to see why. The right one stays hidden until you do.</p>`}<div class="why" ${revealed ? "" : "hidden"}></div></section>`);
  q.options.forEach((o, j) => {
    const b = el(`<button type="button" class="opt">${md(o)}</button>`);
    if (revealed) {
      b.disabled = true;
      b.classList.toggle("right", j === q.correct);
      b.classList.toggle("wrong", pick === j && j !== q.correct);
    } else b.onclick = () => {
      state.predictPicks[q.id] = j;
      state.predictCursor = state.predictCursor || {};
      state.predictCursor[id] = index;
      persist();
      route();
    };
    $(".opts", card).appendChild(b);
  });
  if (revealed) {
    const why = $(".why", card);
    why.hidden = false;
    why.className = "why " + (pick === q.correct ? "ok" : "bad");
    why.innerHTML = `<strong>${pick === q.correct ? "Correct." : "Not quite."}</strong> ${md(q.why)}`;
  }
  slot.appendChild(card);
  const next = qs[index + 1];
  if (next && !revealed) {
    const bits = printBits(next.code);
    slot.appendChild(el(`<p class="next-tease">Next: Predict ${index + 2} of ${qs.length}${bits ? ` — ${bits}` : ""}.</p>`));
  }
  if (revealed) {
    const label = index + 1 < qs.length ? `Continue to Predict ${index + 2} →` : "Continue to Tweak →";
    const btn = el(`<button type="button" class="btn primary step-next">${label}</button>`);
    btn.onclick = () => {
      if (index + 1 < qs.length) {
        state.predictCursor = state.predictCursor || {};
        state.predictCursor[id] = index + 1;
        persist();
        route();
      } else go(`#/lesson/${id}/tweak`);
    };
    slot.appendChild(btn);
  }
}
function printBits(code) {
  const prints = [...String(code).matchAll(/^print\s*\((.*)\)\s*$/gm)].map((m) => m[1].trim());
  if (!prints.length) return "";
  return prints.map((p) => `<code>${esc(p)}</code>`).join(" and ");
}
function paintTweak(id, slot) {
  const tw = LESSONS[id].tweak;
  const tried = !!state.tweakTried[id];
  const items = tw.prompts.map((p, i) => `<li><p>${md(p.change)}</p><p class="expect" data-expect ${tried ? "" : "hidden"}>${md(p.expect)}</p><p class="muted small" data-until-run ${tried ? "hidden" : ""}>Run it, then this tells you what should happen.</p></li>`).join("");
  slot.innerHTML = `<section class="card"><p class="kicker">Tweak</p><h2>Change two things.</h2><ol class="tweak-list">${items}</ol></section><div id="work"></div><a class="btn primary step-next" href="#/lesson/${id}/fix">Continue to Fix →</a>`;
  const key = `${id}#tweak`;
  const ws = mountWorkspace($("#work", slot), {
    title: "Your code",
    code: state.drafts[key] ?? tw.starter,
    onChange: (c) => { state.drafts[key] = c; persist(); },
    onReset: () => tw.starter,
    onRan: () => {
      state.tweakTried[id] = true;
      persist();
      slot.querySelectorAll("[data-expect]").forEach((n) => { n.hidden = false; });
      slot.querySelectorAll("[data-until-run]").forEach((n) => { n.hidden = true; });
    },
  });
  cleanup = ws.destroy;
}
function paintFix(id, slot) {
  const fixes = LESSONS[id].fix;
  let index = state.fixCursor && state.fixCursor[id];
  if (index == null || index < 0 || index >= fixes.length) index = 0;
  const fix = fixes[index];
  const tried = !!state.fixTries[fix.id];
  slot.innerHTML = `<section class="card"><p class="kicker">Fix ${index + 1} of ${fixes.length}</p><h2>This one is broken.</h2><pre class="code">${esc(fix.broken)}</pre><p class="hint">Hint: ${md(fix.hint || "")}</p><div data-solution>${tried ? solutionHTML(fix) : `<p class="muted small">Run a fix in the editor. One solution stays hidden until you do.</p>`}</div></section><div id="work"></div>`;
  const label = index + 1 < fixes.length ? `Continue to Fix ${index + 2} →` : "Continue to Build →";
  const btn = el(`<button type="button" class="btn primary step-next">${label}</button>`);
  btn.onclick = () => {
    if (index + 1 < fixes.length) {
      state.fixCursor = state.fixCursor || {};
      state.fixCursor[id] = index + 1;
      persist();
      route();
    } else go(`#/lesson/${id}/build`);
  };
  slot.appendChild(btn);
  const key = `${id}#fix#${fix.id}`;
  const ws = mountWorkspace($("#work", slot), {
    title: "Your code",
    code: state.drafts[key] ?? fix.broken,
    onChange: (c) => { state.drafts[key] = c; persist(); },
    onReset: () => fix.broken,
    onRan: () => {
      state.fixTries[fix.id] = true;
      persist();
      const box = slot.querySelector("[data-solution]");
      if (box) box.innerHTML = solutionHTML(fix);
    },
  });
  cleanup = ws.destroy;
}
function solutionHTML(fix) {
  return `<div class="why ok"><strong>What was wrong.</strong> ${md(fix.bug || "")}<pre class="code">${esc(fix.fixed || "")}</pre></div>`;
}
function paintBuild(id, slot) {
  const L = LESSONS[id];
  slot.innerHTML = `<section class="card task"><h2>Your task <span class="muted small">(under 20 min)</span></h2><p>${md(L.build.task)}</p></section><div id="work"></div><div class="done-row"><label class="check"><input type="checkbox" id="markdone" ${state.done[id] ? "checked" : ""}> Mark this lesson done</label></div>`;
  const ws = mountWorkspace($("#work", slot), {
    lessonId: id,
    title: "Your code",
    code: state.drafts[id] ?? L.build.starter,
    onChange: (c) => { state.drafts[id] = c; persist(); },
    onReset: () => L.build.starter,
  });
  $("#markdone", slot).onchange = (e) => {
    if (e.target.checked) state.done[id] = state.done[id] || new Date().toISOString();
    else delete state.done[id];
    const nxt = ACTIVE.find((x) => !state.done[x]);
    if (nxt) state.current = nxt;
    persist();
    const pill = $(".lesson-head .pill");
    if (pill) {
      const [label, cls] = lessonStatus(id);
      pill.className = "pill " + cls;
      pill.textContent = label;
    }
  };
  cleanup = ws.destroy;
}

function renderPlay() {
  main.innerHTML = `<header class="lesson-head"><p class="kicker">Scratchpad</p><h1>Playground</h1></header>
    <p class="muted">Try anything here. It's saved automatically, just like a Colab cell.</p><div id="work"></div>`;
  const ws = mountWorkspace($("#work"), { title: "Editor", code: state.drafts.play ?? '# Your scratchpad\nname = input("What\'s your name? ")\nprint("Hi " + name + "!")\n', onChange: (c) => { state.drafts.play = c; persist(); } });
  cleanup = ws.destroy;
}

function renderCheat() {
  const broken = 'password = ""\nwhile password != "python":\n    print("Wrong, try again")\n# CHANGE is missing! password never changes.';
  main.innerHTML = `<header class="lesson-head"><p class="kicker">Cheat sheet</p><h1>While loops</h1></header>
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

function renderQuiz(which) {
  const review = reviewById(which);
  if (review) { renderReview(review); return; }
  const q = state.quiz1 || { score: 0, total: 5 };
  const cards = REVIEWS.map((r, i) => {
    const meta = reviewMeta(r, i + 1);
    const pill = meta.locked ? `<span class="pill">Locked</span>` : meta.answered ? `<span class="pill done">${state.reviews[r.id].best}/${r.questions.length}</span>` : meta.legacy ? `<span class="pill done">Quiz 1: ${esc(q.score)}/${esc(q.total)}</span>` : `<span class="pill next">New</span>`;
    if (meta.locked) return `<div class="row"><span class="row-title"><strong>Review ${i + 1}</strong> · after ${esc(lessonNice(r.after))}</span>${pill}</div>`;
    return `<a class="row" href="#/quiz/${r.id}"><span class="row-title"><strong>Review ${i + 1}</strong> · after ${esc(lessonNice(r.after))}</span>${pill}</a>`;
  }).join("");
  main.innerHTML = `<header class="lesson-head"><p class="kicker">${esc(PHASE_LABEL)}</p><h1>Quiz</h1></header>
    <p class="muted">Quiz 1 stays at ${esc(q.score)}/${esc(q.total)}. The review after Lesson 8 is a new quiz.</p>
    <section class="card"><h2>Mixed reviews</h2><div class="rows">${cards}</div></section>
    <div id="practice"></div>`;
  renderPractice($("#practice"));
}
function renderReview(review) {
  const n = REVIEWS.indexOf(review) + 1;
  const meta = reviewMeta(review, n);
  if (meta.locked) {
    main.innerHTML = `<header class="lesson-head"><p class="kicker">Review ${n}</p><h1>${esc(review.title)}</h1></header>
      <section class="card locked"><h2>Locked</h2><p>This review unlocks after you finish ${esc(lessonNice(review.after))}.</p></section>
      <a class="btn" href="#/quiz">All reviews</a>`;
    return;
  }
  const rec = state.reviews[review.id];
  const score = () => rec.picks.reduce((s, x, i) => s + (x === review.questions[i].correct ? 1 : 0), 0);
  const answered = () => rec.picks.filter((x) => x != null).length;
  const legacy = review.after === "l4" && state.quiz1 && state.quiz1.done
    ? `<p class="callout"><strong>Quiz 1: ${esc(state.quiz1.score)}/${esc(state.quiz1.total)}</strong> is already saved. This review does not change that score.</p>` : "";
  main.innerHTML = `<header class="lesson-head"><p class="kicker">Review ${n}</p><h1>${esc(review.title)}</h1></header>
    <p class="muted">${md(review.intro || "")}</p>${legacy}
    <div class="card scorebar" id="scorebar"></div><div id="qs"></div>
    <div class="btns"><a class="btn" href="#/quiz">All reviews</a><button class="btn ghost" id="qreset">Reset this review</button></div>`;
  const drawScore = () => { $("#scorebar").innerHTML = `<strong>Score: ${score()} / ${review.questions.length}</strong><span class="muted">Answered ${answered()} of ${review.questions.length}${rec.best != null ? ` · Best ${rec.best}/${review.questions.length}` : ""}</span>`; };
  const qs = $("#qs");
  review.questions.forEach((q, i) => {
    const card = el(`<section class="card q"><p class="qnum">Question ${i + 1}</p><p class="qprompt">${md(q.prompt)}</p><div class="opts"></div><div class="why" hidden></div></section>`);
    q.options.forEach((o, j) => {
      const b = el(`<button type="button" class="opt">${md(o)}</button>`);
      b.onclick = () => pick(i, j);
      $(".opts", card).appendChild(b);
    });
    qs.appendChild(card);
  });
  function paint(i) {
    const card = qs.children[i], v = rec.picks[i], q = review.questions[i];
    [...card.querySelectorAll(".opt")].forEach((b, j) => {
      const on = v != null;
      b.disabled = on;
      b.classList.toggle("right", on && j === q.correct);
      b.classList.toggle("wrong", on && v === j && j !== q.correct);
    });
    const why = $(".why", card);
    if (v != null) { why.hidden = false; why.className = "why " + (v === q.correct ? "ok" : "bad"); why.innerHTML = `<strong>${v === q.correct ? "Correct." : "Not quite."}</strong> ${md(q.why)}`; }
    else why.hidden = true;
  }
  function pick(i, j) {
    if (rec.picks[i] != null) return;
    rec.picks[i] = j;
    if (answered() === review.questions.length) {
      const s = score();
      rec.history.push({ at: new Date().toISOString(), score: s });
      rec.best = Math.max(rec.best ?? 0, s);
      toast(`Review done: **${s}/${review.questions.length}**`);
    }
    persist(); paint(i); drawScore();
  }
  review.questions.forEach((_, i) => paint(i));
  drawScore();
  $("#qreset").onclick = () => { state.reviews[review.id] = { picks: Array(review.questions.length).fill(null), best: null, history: [] }; persist(); renderReview(review); };
}
function renderPractice(host) {
  const p = state.practice;
  const score = () => p.picks.reduce((s, x, i) => s + (x === QUIZ[i].correct ? 1 : 0), 0);
  const answered = () => p.picks.filter((x) => x != null).length;
  host.innerHTML = `<header class="lesson-head"><p class="kicker">Practice quiz</p><h1>Lessons 1–8</h1></header>
    <p class="muted">Eight questions. Tap an answer to see why. Your answers and best score are saved.</p>
    <div class="card scorebar" id="pscore"></div><div id="pqs"></div>
    <div class="btns"><button class="btn" id="preset">Reset practice quiz</button></div>`;
  const drawScore = () => { $("#pscore", host).innerHTML = `<strong>Score: ${score()} / 8</strong><span class="muted">Answered ${answered()} of 8${p.best != null ? ` · Best ${p.best}/8` : ""}</span>`; };
  const qs = $("#pqs", host);
  QUIZ.forEach((q, i) => {
    const card = el(`<section class="card q"><p class="qnum">Question ${i + 1}</p><p class="qprompt">${md(q.prompt)}</p><div class="opts"></div><div class="why" hidden></div></section>`);
    q.options.forEach((o, j) => { const b = el(`<button type="button" class="opt">${md(o)}</button>`); b.onclick = () => pick(i, j); $(".opts", card).appendChild(b); });
    qs.appendChild(card);
  });
  function paint(i) {
    const card = qs.children[i], v = p.picks[i], q = QUIZ[i];
    [...card.querySelectorAll(".opt")].forEach((b, j) => { const on = v != null; b.disabled = on; b.classList.toggle("right", on && j === q.correct); b.classList.toggle("wrong", on && v === j && j !== q.correct); });
    const why = $(".why", card);
    if (v != null) { why.hidden = false; why.className = "why " + (v === q.correct ? "ok" : "bad"); why.innerHTML = `<strong>${v === q.correct ? "Correct." : "Not quite."}</strong> ${md(q.why)}`; }
    else why.hidden = true;
  }
  function pick(i, j) {
    if (p.picks[i] != null) return;
    p.picks[i] = j;
    if (answered() === 8) { const s = score(); p.history.push({ at: new Date().toISOString(), score: s }); p.best = Math.max(p.best ?? 0, s); toast(`Quiz done: **${s}/8**`); }
    persist(); paint(i); drawScore();
  }
  QUIZ.forEach((_, i) => paint(i));
  drawScore();
  $("#preset", host).onclick = () => { p.picks = Array(8).fill(null); persist(); renderPractice(host); };
}

function renderSkills() {
  const phase = orderSkills(PHASE0_ORDER);
  const later = orderSkills(LATER_ORDER);
  const extra = SKILLS.filter((s) => !PHASE0_ORDER.includes(s.id) && !LATER_ORDER.includes(s.id));
  extra.forEach((s) => (s.now && s.now.length ? phase : later).push(s));
  const block = (skill) => {
    const st = skillStat(skill);
    if (st.later) return `<div class="skill"><div class="skill-top"><span>${esc(skill.name)}</span><span class="count later">Later</span></div><div class="progress thin"><div class="bar later"></div></div></div>`;
    const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
    const label = st.complete ? coveredPhrase(st.ids) : `${st.done} of ${st.total}`;
    const tone = st.complete ? "done" : st.done ? "partial" : "zero";
    return `<div class="skill"><div class="skill-top"><span>${esc(skill.name)}</span><span class="count ${tone}">${esc(label)}</span></div><div class="progress thin"><div class="bar ${st.complete ? "done" : ""}" style="width:${pct}%"></div></div></div>`;
  };
  main.innerHTML = `<header class="lesson-head"><p class="eyebrow">${esc(PHASE_LABEL)}</p><h1>Skills</h1>
    <p class="muted">Coverage from lessons you have already marked done.</p></header>
    ${seg("skills")}
    <section class="card skills-card"><p class="eyebrow">In phase 0</p>${phase.map(block).join("")}<p class="eyebrow later-label">Later phases</p>${later.map(block).join("")}</section>`;
}
function renderProjects(which) {
  const index = Math.max(0, MILESTONES.findIndex((m) => m.id === which));
  const m = MILESTONES[index] || MILESTONES[0];
  const locked = !(m.unlocks_after && state.done[m.unlocks_after]);
  const checks = Array.isArray(state.milestones[m.id]) ? state.milestones[m.id].slice() : [];
  const names = (m.skills_shown || []).map((id) => SKILLS.find((s) => s.id === id)).filter(Boolean);
  const dashes = MILESTONES.map((item, i) => `<a href="#/projects/${item.id}" class="${i === index ? "on" : ""}" aria-label="${esc(item.title)}"></a>`).join("");
  const unlock = m.unlocks_after && LESSONS[m.unlocks_after] ? `Unlocks after ${LESSONS[m.unlocks_after].tag}` : "Later phase";
  const note = !m.unlocks_after
    ? "This project comes in a later phase. You can still read the checklist."
    : locked
      ? `The checklist unlocks when you finish ${lessonNice(m.unlocks_after)}. You can still read the bar now.`
      : "Checked items are saved in this browser.";
  const items = m.checklist.map((line, i) => `<li><label><input type="checkbox" data-i="${i}" ${checks[i] ? "checked" : ""} ${locked ? "disabled" : ""}> <span>${md(line)}</span></label></li>`).join("");
  const next = MILESTONES[index + 1];
  const nextLine = next
    ? `Next: <a href="#/projects/${next.id}"><strong>${esc(next.title)}</strong></a> · ${esc(next.phase)}. ${cap(word(MILESTONES.length))} portfolio projects, one per phase.`
    : `${cap(word(MILESTONES.length))} portfolio projects, one per phase.`;
  main.innerHTML = `<header class="lesson-head"><p class="eyebrow">${esc(m.phase)}</p><div class="title-row"><h1>${esc(m.title)}</h1>${locked ? `<span class="pill">${esc(unlock)}</span>` : ""}</div></header>
    ${seg("projects")}
    <div class="dashes">${dashes}</div>
    <section class="card project-card"><h2>Portfolio project</h2><p>${md(m.description)}</p>
      <div class="tagpills">${names.map((s) => `<span>${esc(s.name)}</span>`).join("")}</div>
      <p class="muted">${esc(note)}</p>
      <ul class="checklist">${items}</ul>
    </section>
    <p class="next-tease">${nextLine}</p>`;
  main.querySelectorAll(".checklist input").forEach((box) => {
    box.onchange = () => {
      const arr = Array.from({ length: m.checklist.length }, (_, i) => !!(state.milestones[m.id] && state.milestones[m.id][i]));
      arr[Number(box.dataset.i)] = box.checked;
      state.milestones[m.id] = arr;
      persist();
    };
  });
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function mountWorkspace(host, { lessonId, code, onChange, onReset, onRan, title }) {
  host.innerHTML = `<section class="card ws">
    <div class="ws-top"><h2>${esc(title || (lessonId ? "Your code" : "Editor"))}</h2><span class="py-status" aria-live="polite"></span></div>
    <div class="editor"></div>
    <div class="keys" aria-label="Extra keys">${["Tab", "⇤", ":", '"', "(", ")", "=", "[", "]", "+", "#"].map((k) => `<button type="button" class="key" data-k="${esc(k)}" tabindex="-1">${esc(k)}</button>`).join("")}</div>
    <div class="ws-actions">
      <button type="button" class="btn primary run">▶ Run</button><button type="button" class="btn stop" disabled>■ Stop</button>
      ${lessonId ? `<button type="button" class="btn check">✓ Check</button>` : ""}
    </div>
    <div class="console-wrap" hidden><div class="console-head"><span>Output</span><button type="button" class="link clear">Clear</button></div><pre class="console" tabindex="0"></pre></div>
    <div class="results" hidden></div>
    ${onReset ? `<button type="button" class="textbtn resetcode">Start over</button>` : ""}
  </section>`;
  const statusEl = $(".py-status", host), runBtn = $(".run", host), stopBtn = $(".stop", host), checkBtn = $(".check", host), con = $(".console", host), results = $(".results", host), consoleWrap = $(".console-wrap", host);
  let busy = false, saveT = null, inputEl = null;

  const view = new EditorView({
    parent: $(".editor", host),
    state: EditorState.create({
      doc: code ?? "",
      extensions: [
        basicSetup, python(), indentUnit.of("    "), EditorView.lineWrapping,
        keymap.of([indentWithTab, { key: "Mod-Enter", run: () => { doRun(); return true; } }]),
        EditorView.updateListener.of((u) => { if (u.docChanged) { clearTimeout(saveT); saveT = setTimeout(() => onChange && onChange(view.state.doc.toString()), 300); } }),
        EditorView.contentAttributes.of({ autocapitalize: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Python code editor" }),
      ],
    }),
  });
  const getCode = () => view.state.doc.toString();
  const setCode = (c) => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: c } }); if (onChange) onChange(c); };

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
    const [t, c] = map[pyStatus] || ["", ""];
    statusEl.textContent = t; statusEl.className = "py-status " + c;
    if (pyStatus === "error") statusEl.title = pyStatusMsg;
  };
  statusListeners.add(paintStatus); paintStatus();

  const write = (text, cls) => { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; con.appendChild(s); while (con.childNodes.length > 3000) con.removeChild(con.firstChild); con.scrollTop = con.scrollHeight; };
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
    con.appendChild(el(`<div class="errbox"><div class="err-title">⚠ ${esc(f.title)}</div>${f.msg ? `<div class="err-msg">${esc(f.msg)}</div>` : ""}<div class="err-tip">💡 ${esc(f.tip)}</div>${f.tb ? `<details><summary>Full error (read from the bottom)</summary><pre>${esc(f.tb)}</pre></details>` : ""}</div>`));
    con.scrollTop = con.scrollHeight;
  }
  const setBusy = (b) => { busy = b; runBtn.disabled = false; stopBtn.disabled = !b; if (checkBtn) checkBtn.disabled = b; paintStatus(); };

  async function doRun() {
    if (busy) runner.stop();
    consoleWrap.hidden = false;
    clearCon(); results.hidden = true; setBusy(true);
    if (!runner.ready) {
      if (runner.loadError) runner.respawn();
      write("Starting Python… (the first load takes a moment)\n", "muted");
      try { await runner.readyPromise; clearCon(); }
      catch (err) {
        write("\n■ Python couldn't start: " + err.message + "\n", "sys bad");
        setBusy(false); return;
      }
    }
    const r = await runner.run(getCode(), { onOut: (t) => write(t), onInput: askInput });
    removeInput(); setBusy(false);
    if (r.status === "ok") write("\n✓ Finished\n", "sys ok");
    else if (r.status === "error") errorBlock(r);
    else if (r.status === "timeout") write("\n■ Stopped: your program ran for 15 seconds without finishing. That's usually an infinite loop.\n", "sys bad");
    else if (r.status === "stopped") write("\n■ Stopped.\n", "sys");
    if (onRan) onRan(r);
  }
  runBtn.onclick = doRun;
  stopBtn.onclick = () => runner.stop("stopped");
  $(".clear", host).onclick = clearCon;
  if (onReset) $(".resetcode", host).onclick = () => { if (confirm("Replace your code with the starter? (Ctrl+Z undoes it.)")) setCode(onReset()); };

  if (checkBtn) checkBtn.onclick = async () => {
    const c = getCode();
    const L = LESSONS[lessonId];
    setBusy(true); results.hidden = false; results.innerHTML = `<p class="muted">Checking… running your code with test answers.</p>`;
    try {
    let items = gradeRules(L.build.rules, c);
    const blank = items.length === 1 && items[0].text === "The editor is empty";
    if (!blank) {
      const cache = new Map();
      for (const t of L.build.tests || []) {
        const key = JSON.stringify(t.inputs || []);
        if (!cache.has(key)) cache.set(key, await runner.test(c, t.inputs || [], 5000));
        const r = cache.get(key);
        if (r.status === "error") {
          const f = friendlyError(r);
          if (!items.some((x) => x.err)) items.unshift({ ok: false, err: true, text: `Running it hit an error: ${f.title}`, correction: f.msg || "", hint: f.tip || "" });
          continue;
        }
        if (r.status === "timeout") {
          if (!items.some((x) => x.to)) items.unshift({ ok: false, to: true, text: "It didn't finish within 5 seconds", correction: t.inputs && t.inputs.length ? `We typed ${t.inputs.join(", ")} and the program was still running.` : "The program was still running after 5 seconds.", hint: "That's usually an infinite loop. Check SETUP, CHECK, CHANGE." });
          continue;
        }
        items.push(judgeRun(t, r));
      }
    }
    setBusy(false);
    const failed = items.filter((x) => !x.ok);
    const passed = items.filter((x) => x.ok && x.matched !== false);
    const optionalMiss = items.filter((x) => x.optional && x.matched === false);
    const okN = items.filter((x) => x.ok).length;
    const all = failed.length === 0 && items.length > 0;
    const li = (x) => `<li class="fail"><span class="mark">✗</span><div><div class="it">${md(x.text)}</div>${x.correction || x.hint ? `<details class="why-more"><summary>Why</summary>${x.correction ? `<div class="corr">${md(x.correction)}</div>` : ""}${x.hint ? `<div class="hint">${md(x.hint)}</div>` : ""}</details>` : ""}</div></li>`;
    const also = alsoPassedSentence(passed.map((x) => shortPassLabel(x.text)));
    const opt = optionalMiss.length ? `<p class="muted small">Optional: ${optionalMiss.map((x) => md(x.text)).join(" ")}</p>` : "";
    results.innerHTML = `<div class="sum ${all ? "ok" : ""}">${all ? "All checks passed" : `${okN} of ${items.length} checks passed`}</div><ul class="checks">${failed.map(li).join("")}</ul>${also ? `<p class="also">${md(also)}</p>` : ""}${opt}${all ? nextLink(lessonId) : `<p class="muted small">Fix one thing at a time, then hit Check again.</p>`}`;
    (state.submissions[lessonId] ||= []).push({ at: new Date().toISOString(), passed: okN, total: items.length, code: c });
    if (state.submissions[lessonId].length > 20) state.submissions[lessonId].shift();
    if (all && !state.done[lessonId]) {
      state.done[lessonId] = new Date().toISOString();
      const nx = ACTIVE.find((x) => !state.done[x]);
      if (nx) state.current = nx;
      const box = $("#markdone");
      if (box) box.checked = true;
      const pill = $(".lesson-head .pill");
      if (pill) { const [label, cls] = lessonStatus(lessonId); pill.className = "pill " + cls; pill.textContent = label; }
    }
    persist();
    results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      setBusy(false);
      results.hidden = false;
      results.innerHTML = `<div class="sum">Python didn't start</div><p class="muted">${esc(err && err.message || err)}</p>`;
    }
  };

  return { setCode, focusEditor: () => view.focus(), destroy: () => { statusListeners.delete(paintStatus); if (busy) runner.stop(); clearTimeout(saveT); if (onChange) onChange(getCode()); view.destroy(); } };
}
function nextLink(id) {
  const nx = LESSON_ORDER[LESSON_ORDER.indexOf(id) + 1];
  if (nx) return `<div class="btns"><a class="btn primary" href="#/lesson/${nx}">Next: ${esc(lessonLabel(nx))} →</a></div>`;
  const rev = REVIEWS.find((r) => r.after === id);
  return rev ? `<div class="btns"><a class="btn primary" href="#/quiz/${rev.id}">Next: mixed review →</a></div>` : "";
}

if (!HAS_SAB) console.info("Cross-origin isolation is off; using replay mode for input().");
route();
