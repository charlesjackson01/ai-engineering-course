// Saved progress in localStorage, with export/import.
const KEY = "coleCourse.v1";
const SEED_DONE = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"];

export function defaults() {
  const done = {}; SEED_DONE.forEach((id) => (done[id] = "2026-11-10"));
  return {
    version: 1, done, current: "warmup",
    quiz1: { done: true, score: 5, total: 5 },
    practice: { picks: Array(8).fill(null), best: null, history: [] },
    drafts: {}, submissions: {},
  };
}
function valid(s) { return s && typeof s === "object" && s.version === 1 && s.done && s.practice && s.drafts && s.submissions; }

export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (valid(s)) return Object.assign(defaults(), s); } catch {}
  const s = defaults(); save(s); return s;
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function reset() { const s = defaults(); save(s); return s; }
export function exportJSON(s) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `cole-course-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function importJSON(text) {
  const s = JSON.parse(text);
  if (!valid(s)) throw new Error("That file doesn't look like course progress.");
  const merged = Object.assign(defaults(), s); save(merged); return merged;
}
