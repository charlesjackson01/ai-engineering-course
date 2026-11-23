// Saved progress in localStorage, with export/import.
// Version 2 adds workbook steps, mixed reviews, and milestone checks.
// A version 1 save (Cole's current progress) is migrated in place:
// lesson done-map, drafts, submissions, the practice quiz, and Quiz 1's score stay.
// The mixed review after Lesson 8 is a new quiz and starts unanswered.
const KEY = "coleCourse.v1";
const SEED_DONE = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"];
const REVIEW_IDS = ["review-l4", "review-l8", "review-l12"];
const REVIEW_LEN = 6;

function blankReview() {
  return { picks: Array(REVIEW_LEN).fill(null), best: null, history: [] };
}

export function freshReviews() {
  const reviews = {};
  REVIEW_IDS.forEach((id) => { reviews[id] = blankReview(); });
  return reviews;
}

function normalizeReviews(raw) {
  const out = {};
  for (const id of REVIEW_IDS) {
    const r = raw && raw[id];
    const picks = r && Array.isArray(r.picks) ? r.picks : [];
    out[id] = {
      picks: Array.from({ length: REVIEW_LEN }, (_, i) => (i < picks.length && picks[i] != null ? picks[i] : null)),
      best: r && typeof r.best === "number" ? r.best : null,
      history: r && Array.isArray(r.history) ? r.history : [],
    };
  }
  return out;
}

export function defaults() {
  const done = {};
  SEED_DONE.forEach((id) => { done[id] = "2026-11-10"; });
  return {
    version: 2,
    done,
    current: "warmup",
    quiz1: { done: true, score: 5, total: 5 },
    practice: { picks: Array(8).fill(null), best: null, history: [] },
    drafts: {},
    submissions: {},
    steps: {},
    predictPicks: {},
    fixTries: {},
    tweakTried: {},
    reviews: freshReviews(),
    milestones: {},
  };
}

function bucket() {
  if (typeof globalThis.localStorage !== "undefined") return globalThis.localStorage;
  return null;
}

export function isProgress(s) {
  return !!(s && typeof s === "object" && (s.version === 1 || s.version === 2) && s.done && typeof s.done === "object" && s.practice && s.drafts);
}

// Pure migration. Does not touch localStorage. Quiz 1 is copied as stored.
// review-l8 is not filled from quiz1 or from the practice quiz.
export function migrateState(saved) {
  if (!isProgress(saved)) return defaults();
  const merged = Object.assign(defaults(), saved);
  merged.version = 2;
  merged.done = { ...saved.done };
  merged.quiz1 = saved.quiz1 && typeof saved.quiz1 === "object"
    ? { done: !!saved.quiz1.done, score: saved.quiz1.score, total: saved.quiz1.total }
    : defaults().quiz1;
  const picks = Array.isArray(saved.practice.picks) ? saved.practice.picks : [];
  merged.practice = {
    picks: Array.from({ length: 8 }, (_, i) => (i < picks.length ? picks[i] : null)),
    best: saved.practice.best ?? null,
    history: Array.isArray(saved.practice.history) ? saved.practice.history : [],
  };
  merged.drafts = saved.drafts && typeof saved.drafts === "object" ? saved.drafts : {};
  merged.submissions = saved.submissions && typeof saved.submissions === "object" ? saved.submissions : {};
  merged.current = typeof saved.current === "string" ? saved.current : "warmup";
  merged.steps = saved.steps && typeof saved.steps === "object" ? saved.steps : {};
  merged.predictPicks = saved.predictPicks && typeof saved.predictPicks === "object" ? saved.predictPicks : {};
  merged.fixTries = saved.fixTries && typeof saved.fixTries === "object" ? saved.fixTries : {};
  merged.tweakTried = saved.tweakTried && typeof saved.tweakTried === "object" ? saved.tweakTried : {};
  merged.milestones = saved.milestones && typeof saved.milestones === "object" ? saved.milestones : {};
  merged.reviews = normalizeReviews(saved.reviews);
  return merged;
}

export function load() {
  const ls = bucket();
  try {
    const raw = ls && ls.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (isProgress(s)) {
        const m = migrateState(s);
        save(m);
        return m;
      }
    }
  } catch { /* fall through to the seeded start */ }
  const s = defaults();
  save(s);
  return s;
}

export function save(s) {
  const ls = bucket();
  try { if (ls) ls.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function reset() {
  const s = defaults();
  save(s);
  return s;
}

export function exportJSON(s) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cole-course-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function importJSON(text) {
  const s = JSON.parse(text);
  if (!isProgress(s)) throw new Error("That file doesn't look like course progress.");
  const merged = migrateState(s);
  save(merged);
  return merged;
}
