import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import workbook from "../data/workbook.json" with { type: "json" };
import { LESSONS, LESSON_ORDER, PREVIEW_IDS, REVIEWS, SKILLS, MILESTONES } from "../js/content.js";
import { renderDiagram } from "../js/diagrams.js";
import { alsoPassedSentence, constraintFailures, gradeRules, judgeRun, shortPassLabel } from "../js/grade.js";
import { renderMermaid } from "../js/mermaid-lite.js";
import { freshReviews, isProgress, migrateState } from "../js/store.js";

function runPython(code, inputs) {
  const py = `
import json, sys, io, builtins, contextlib
req = json.loads(sys.stdin.read())
buf = io.StringIO()
inputs = list(req["inputs"])
count = {"n": 0}
class OutOfInputs(BaseException):
    pass
def _input(prompt=""):
    count["n"] += 1
    if not inputs:
        raise OutOfInputs()
    return inputs.pop(0)
builtins.input = _input
status, err = "ok", None
try:
    with contextlib.redirect_stdout(buf):
        try:
            ns = {"__name__": "__main__", "__builtins__": builtins}
            exec(compile(req["code"], "main.py", "exec"), ns)
        except SystemExit:
            pass
except OutOfInputs:
    status = "out-of-inputs"
except Exception as e:
    status = "error"
    err = type(e).__name__ + ": " + str(e)
json.dump({"status": status, "out": buf.getvalue(), "inputCount": count["n"], "error": err}, sys.stdout)
`;
  const r = spawnSync("python3", ["-c", py], {
    input: JSON.stringify({ code, inputs }),
    encoding: "utf8",
    timeout: 5000,
  });
  if (r.error && r.error.code === "ETIMEDOUT") return { status: "timeout", out: "", inputCount: 0, error: "timeout" };
  if (r.status !== 0) {
    return { status: "error", out: r.stdout || "", inputCount: 0, error: r.stderr || "python failed" };
  }
  return JSON.parse(r.stdout);
}

test("workbook shape matches the course", () => {
  assert.deepEqual(workbook.lesson_order, ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "warmup", "l9", "l10", "l11", "l12"]);
  assert.deepEqual(workbook.loop, ["see", "predict", "tweak", "fix", "build"]);
  assert.equal(PREVIEW_IDS.length, 0);
  assert.equal(SKILLS.length, 10);
  assert.equal(MILESTONES.length, 7);
  assert.deepEqual(REVIEWS.map((r) => r.after), ["l4", "l8", "l12"]);
  for (const id of LESSON_ORDER) {
    const L = workbook.lessons[id];
    assert.equal(L.id, id);
    assert.equal(L.predict.length >= 1, true);
    assert.equal(L.fix.length >= 1, true);
    assert.ok(L.build.reference && L.build.reference.trim(), id + " reference");
    assert.ok(L.see.mermaid.includes("flowchart"), id + " mermaid");
    assert.ok(L.see.diagram && L.see.diagram.type, id + " diagram");
    assert.equal("reference" in LESSONS[id].build, false, id + " reference leaked to the UI lesson");
    const svg = renderDiagram(L.see.diagram, L.title);
    assert.match(svg, /<svg/, id + " diagram svg");
    const flow = renderMermaid(L.see.mermaid, L.title);
    assert.match(flow, /<svg/, id + " mermaid svg");
    assert.match(flow, />[^<]+</, id + " mermaid has a label");
  }
  for (const review of REVIEWS) assert.equal(review.questions.length, 6);
});

test("every reference solution passes its rules, constraints, and stdout snapshot", () => {
  for (const id of workbook.lesson_order) {
    const build = workbook.lessons[id].build;
    const rules = gradeRules(build.rules, build.reference);
    for (const rule of rules) {
      assert.equal(rule.matched, true, `${id} rule ${rule.text}`);
      assert.equal(rule.ok, true, `${id} rule ok`);
    }
    const seen = new Set();
    for (const t of build.tests) {
      const key = JSON.stringify(t.inputs);
      if (!seen.has(key)) seen.add(key);
      const result = runPython(build.reference, t.inputs);
      assert.equal(result.out, t.expected_stdout, `${id} ${t.id} stdout\n${JSON.stringify(result)}`);
      const bad = constraintFailures(t, result);
      assert.deepEqual(bad, [], `${id} ${t.id} constraints ${bad.join(", ")} out=${JSON.stringify(result.out)}`);
      const judged = judgeRun(t, result);
      assert.equal(judged.ok, true, `${id} ${t.id} ${judged.text}`);
    }
  }
});

test("student checks stay looser than the snapshot, and L9's partial solution matches the design", () => {
  const differentName = 'name = "Sam"\nprint(name)\n';
  const l2 = workbook.lessons.l2.build.tests[0];
  const ran = runPython(differentName, []);
  assert.notEqual(ran.out, l2.expected_stdout);
  assert.equal(judgeRun(l2, ran).ok, true);

  const partial = '# Lesson 9\nfoods = ["chicken", "tacos", "pizza", "burgers", "sushi"]\nprint(foods[0])\nprint(len(foods))\n';
  const rules = gradeRules(workbook.lessons.l9.build.rules, partial);
  const runs = new Map();
  const items = rules.slice();
  for (const t of workbook.lessons.l9.build.tests) {
    const key = JSON.stringify(t.inputs);
    if (!runs.has(key)) runs.set(key, runPython(partial, t.inputs));
    items.push(judgeRun(t, runs.get(key)));
  }
  const failed = items.filter((x) => !x.ok);
  const passed = items.filter((x) => x.ok && x.matched !== false);
  assert.equal(items.length, 8);
  assert.equal(failed.length, 4);
  assert.deepEqual(failed.map((x) => x.text), [
    "Add a `for` loop that walks through a list",
    "Start the sum with `total = 0`",
    "Add each number with `total = total + number`",
    "The loop or the total is missing",
  ]);
  assert.equal(alsoPassedSentence(passed.map((x) => shortPassLabel(x.text))), "Also passed: list, len(), printed chicken, and 5.");
});

test("skipped rules do not fail, and a backwards grade ladder does", () => {
  const stray = workbook.lessons.l8.build.rules.find((r) => r.id === "no_stray_spaces");
  const skipped = gradeRules([stray], 'password = ""\nwhile password != "python":\n    password = input("What\'s the password? ")\n');
  assert.equal(skipped.length, 0);

  const order = workbook.lessons.l7.build.rules.find((r) => r.id === "highest_first");
  const tooFew = gradeRules([order], "if score >= 90:\n    print('A')\n");
  assert.equal(tooFew.length, 0);
  const backwards = gradeRules([order], "if score >= 70:\n    print('C')\nelif score >= 90:\n    print('A')\n");
  assert.equal(backwards[0].ok, false);

  const optional = workbook.lessons.l2.build.rules.find((r) => r.optional);
  const missed = gradeRules([optional], 'name = "Sam"\nprint(name)\n');
  assert.equal(missed[0].ok, true);
  assert.equal(missed[0].matched, false);
});

test("version 1 progress migrates forward without touching Quiz 1 or inventing Review 2", () => {
  const v1 = {
    version: 1,
    done: { l1: "2026-11-10", l2: "2026-11-10", l3: "2026-11-10", l4: "2026-11-10", l5: "2026-11-10", l6: "2026-11-10", l7: "2026-11-10", l8: "2026-11-10" },
    current: "warmup",
    quiz1: { done: true, score: 5, total: 5 },
    practice: { picks: [0, 1, null, null, null, null, null, 2], best: 6, history: [{ at: "2026-11-01", score: 6 }] },
    drafts: { l9: "print(1)\n", play: "# scratch\n" },
    submissions: { l8: [{ at: "2026-11-02", passed: 3, total: 4, code: "x = 1\n" }] },
  };
  const m = migrateState(v1);
  assert.equal(m.version, 2);
  assert.deepEqual(m.quiz1, { done: true, score: 5, total: 5 });
  assert.deepEqual(m.done, v1.done);
  assert.equal(m.current, "warmup");
  assert.equal(m.drafts.l9, "print(1)\n");
  assert.equal(m.drafts.play, "# scratch\n");
  assert.equal(m.submissions.l8[0].passed, 3);
  assert.equal(m.practice.best, 6);
  assert.equal(m.practice.picks[1], 1);
  assert.equal(m.practice.picks[2], null);
  assert.equal(m.practice.history.length, 1);
  assert.deepEqual(m.reviews["review-l8"], freshReviews()["review-l8"]);
  assert.deepEqual(m.reviews["review-l4"].picks, Array(6).fill(null));
  assert.equal(m.reviews["review-l12"].best, null);
  assert.equal(isProgress(v1), true);

  const freshScore = migrateState({ ...v1, quiz1: { done: false, score: 0, total: 5 } });
  assert.deepEqual(freshScore.quiz1, { done: false, score: 0, total: 5 });

  const kept = migrateState({ ...m, reviews: { ...m.reviews, "review-l8": { picks: [1, 0, 2, 1, 0, 1], best: 4, history: [] } } });
  assert.equal(kept.reviews["review-l8"].best, 4);
  assert.equal(kept.reviews["review-l8"].picks[0], 1);
  assert.deepEqual(kept.quiz1, { done: true, score: 5, total: 5 });
});

test("a bad save does not count as progress", () => {
  assert.equal(isProgress(null), false);
  assert.equal(isProgress({ version: 1 }), false);
  assert.equal(isProgress({ version: 3, done: {}, practice: {}, drafts: {} }), false);
  const seeded = migrateState({ nope: true });
  assert.equal(seeded.version, 2);
  assert.equal(seeded.quiz1.score, 5);
  assert.equal(seeded.quiz1.total, 5);
  assert.ok(seeded.done.l8);
  assert.equal(seeded.done.l9, undefined);
});
