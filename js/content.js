// Course content. Lesson text comes from data/workbook.json.
// The practice quiz below is the original Lessons 1–8 quiz and stays separate
// from the workbook's mixed reviews. build.reference is never copied onto LESSONS.

import workbook from "../data/workbook.json" with { type: "json" };

export const LESSON_ORDER = workbook.lesson_order.slice();
export const LOOP = workbook.loop.slice();
export const SKILLS = workbook.skills_map;
export const MILESTONES = workbook.milestones;
export const REVIEWS = workbook.mixed_review;
export const PHASE_LABEL = "Phase 0 · First steps";
export const PREVIEW_IDS = [];

function publicLesson(L) {
  const build = { ...L.build };
  delete build.reference;
  return {
    id: L.id,
    tag: L.tag,
    title: L.title,
    concept: L.concept,
    skills: L.skills || [],
    see: L.see,
    predict: L.predict,
    tweak: L.tweak,
    fix: L.fix,
    build,
    diagram: L.see && L.see.diagram,
    starter: L.build.starter,
    task: L.build.task,
  };
}

export const LESSONS = Object.fromEntries(LESSON_ORDER.map((id) => [id, publicLesson(workbook.lessons[id])]));

export const QUIZ = [
  { prompt: 'What does `print("name")` show on the screen?', options: ["the word name", "the value stored in name", "an error"], correct: 0,
    why: "Quotes make a string, so Python prints exactly what's inside." },
  { prompt: 'What is `"5" + "3"`?', options: ["8", "53", "15"], correct: 1,
    why: "Both are strings, so they join. That's concatenation, not math." },
  { prompt: '`input("food")` plus the answer Chicken printed `foodChicken`. What was wrong?', options: ["The prompt was missing a space", "Chicken should have been a number", "print was the wrong tool"], correct: 0,
    why: "input() prints the prompt exactly as written. Put a space inside the quotes, before the closing quote." },
  { prompt: "A TypeError appears. Where should you start reading?", options: ["From the bottom, at the last line", "From the very first line only", "Ignore it and run it again"], correct: 0,
    why: "The last line names the error. That's the first place to look." },
  { prompt: '`if password >= "python"` let zebra in. What should the check be?', options: ['password == "python"', 'password > "python"', 'password != "python"'], correct: 0,
    why: ">= compares strings alphabetically, so zebra counted as true. == checks for an exact match." },
  { prompt: "The grade checks started with `>= 70`, then `>= 90`. What grade did 95 get?", options: ["A", "C", "F"], correct: 1,
    why: "Python stops at the first true condition. 95 is also >= 70, so it never reached the A check." },
  { prompt: "A while loop asked for the password forever. What was missing?", options: ["CHANGE: input() was not inside the loop", "SETUP: the variable was never created", "A print after the loop, which is required"], correct: 0,
    why: "The CHECK uses the password variable. If you never update it inside the loop, the CHECK stays the same forever." },
  { prompt: "After a while loop ends, do you have to print something?", options: ["No. A final print is optional", "Yes. Every loop must end with a print", "Yes, or Python will show an error"], correct: 0,
    why: "The loop is done when the CHECK is false. A print after the loop is only needed if you want to say something then." },
];
