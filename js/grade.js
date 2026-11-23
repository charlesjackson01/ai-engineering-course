// Rule checks and scripted-run checks for the workbook.
// Patterns run on comment-stripped code. expected_stdout is NOT a student constraint.

const PROMPT_TRAILING_SPACE = /input\s*\(\s*(["'])(?:\\.|[^\\\n])*? \1/;

export function stripComments(raw) {
  return String(raw ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n");
}

function flagsOf(rule) {
  return String(rule.flags || "").replace(/[^ims]/g, "");
}

function compile(pattern, flags, extra = "") {
  const f = (flags || "") + extra;
  const uniq = [...new Set(f.split(""))].join("");
  return new RegExp(pattern, uniq);
}

function countMatches(code, pattern, flags) {
  const re = compile(pattern, flags, "g");
  return [...code.matchAll(re)].length;
}

function ruleMatches(rule, code) {
  const type = rule.type;
  if (type === "regex") {
    const n = countMatches(code, rule.pattern, flagsOf(rule));
    return n >= (rule.min_matches || 1);
  }
  if (type === "not_regex") {
    // skip_if_no_match_of is a literal substring. Absent means there is nothing to police.
    if (rule.skip_if_no_match_of && !code.includes(rule.skip_if_no_match_of)) return "skip";
    return countMatches(code, rule.pattern, flagsOf(rule)) === 0;
  }
  if (type === "all_of") {
    for (const sub of rule.all_of || []) {
      const m = ruleMatches(sub, code);
      if (m === "skip") continue;
      if (!m) return false;
    }
    return true;
  }
  if (type === "prompt_has_trailing_space") return PROMPT_TRAILING_SPACE.test(code);
  if (type === "while_setup") return hasWhile(code) && hasAssignment(beforeWhile(code));
  if (type === "while_body_has") return hasWhile(code) && countMatches(whileBody(code), rule.pattern, flagsOf(rule)) >= (rule.min_matches || 1);
  if (type === "first_threshold_is_highest") return firstThreshold(code, rule);
  return false;
}

function hasWhile(code) { return /\bwhile\b/.test(code); }
function beforeWhile(code) { const at = code.search(/\bwhile\b/); return at >= 0 ? code.slice(0, at) : ""; }
function hasAssignment(chunk) { return /[A-Za-z_]\w*\s*=[^=]/.test(chunk); }
function whileBody(code) {
  const at = code.search(/\bwhile\b/);
  if (at < 0) return "";
  const from = code.slice(at);
  const colon = from.indexOf(":");
  if (colon < 0) return "";
  const lines = from.slice(colon + 1).split("\n");
  const out = [lines[0]];
  for (const l of lines.slice(1)) {
    if (l.trim() === "" || /^\s+/.test(l)) out.push(l);
    else break;
  }
  return out.join("\n");
}
function firstThreshold(code, rule) {
  const re = compile(rule.pattern || ">=?\\s*(\\d+)", "g");
  const vals = [...code.matchAll(re)].map((m) => Number(m[1])).filter((n) => !Number.isNaN(n));
  const min = rule.min_thresholds ?? 2;
  if (vals.length < min) return rule.skip_if_too_few ? "skip" : false;
  return vals[0] === Math.max(...vals);
}

function face(rule, ok) {
  return {
    ok,
    matched: ok,
    skipped: false,
    optional: !!rule.optional,
    text: ok ? rule.pass_text : rule.fail_text,
    correction: rule.correction || "",
    hint: rule.hint || "",
  };
}

export function evalRule(rule, code) {
  const m = ruleMatches(rule, code);
  if (m === "skip") return { ok: true, matched: true, skipped: true, optional: !!rule.optional, text: rule.pass_text, correction: rule.correction || "", hint: rule.hint || "" };
  if (m) return face(rule, true);
  if (rule.optional) {
    return { ok: true, matched: false, skipped: false, optional: true, text: rule.fail_text, correction: rule.correction || "", hint: rule.hint || "" };
  }
  return face(rule, false);
}

export function gradeRules(rules, raw) {
  const code = stripComments(raw);
  if (!code.trim()) {
    return [{
      ok: false, matched: false, skipped: false, optional: false,
      text: "The editor is empty",
      correction: "Write your code in the editor first, then hit Check again.",
      hint: "Start under the comment that's already in the editor.",
    }];
  }
  const items = [];
  for (const rule of rules || []) {
    const r = evalRule(rule, code);
    if (!r.skipped) items.push(r);
  }
  return items;
}

export function nonemptyLines(out) {
  return String(out ?? "").split("\n").map((l) => l.trim()).filter((l) => l !== "");
}

function fold(s, ci) { return ci ? String(s).toLowerCase() : String(s); }
function asList(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

function countSub(hay, needle, ci) {
  const h = fold(hay, ci);
  const n = fold(needle, ci);
  if (!n) return 0;
  let c = 0, i = 0;
  while (true) {
    const j = h.indexOf(n, i);
    if (j < 0) break;
    c += 1;
    i = j + n.length;
  }
  return c;
}

// Python inline flags, e.g. (?m), are not valid in JS RegExp.
function compileUserRegex(pattern) {
  let flags = "";
  const source = String(pattern).replace(/\(\?([ims]+)\)/g, (_, f) => { flags += f; return ""; });
  return compile(source, flags);
}

export function constraintFailures(test, result) {
  const out = String(result.out ?? "");
  const ci = !!test.case_insensitive;
  const lines = nonemptyLines(out);
  const bad = [];
  if (test.status && result.status !== test.status) bad.push(`status:${result.status}`);
  for (const s of asList(test.includes)) {
    if (!fold(out, ci).includes(fold(s, ci))) bad.push(`includes:${s}`);
  }
  for (const s of asList(test.excludes)) {
    if (fold(out, ci).includes(fold(s, ci))) bad.push(`excludes:${s}`);
  }
  if (test.regex) {
    let re;
    try { re = compileUserRegex(test.regex); } catch { bad.push("regex:invalid"); re = null; }
    if (re && !re.test(out)) bad.push(`regex:${test.regex}`);
  }
  for (const s of asList(test.nonempty_lines)) {
    if (!lines.includes(s)) bad.push(`nonempty_lines:${s}`);
  }
  for (const s of asList(test.nonempty_lines_include)) {
    if (!lines.includes(s)) bad.push(`nonempty_lines_include:${s}`);
  }
  if (test.last_line_norm != null) {
    const last = (lines.at(-1) || "").toLowerCase().replace(/\s+/g, " ");
    if (last !== test.last_line_norm) bad.push(`last_line_norm:${last}`);
  }
  if (test.includes_count) {
    for (const [needle, n] of Object.entries(test.includes_count)) {
      const got = countSub(out, needle, ci);
      if (got !== n) bad.push(`includes_count:${needle}:${got}`);
    }
  }
  if (test.min_nonempty_lines != null && lines.length < test.min_nonempty_lines) bad.push(`min_nonempty_lines:${lines.length}`);
  if (test.input_count != null && result.inputCount !== test.input_count) bad.push(`input_count:${result.inputCount}`);
  if (test.min_input_count != null && (result.inputCount || 0) < test.min_input_count) bad.push(`min_input_count:${result.inputCount}`);
  if (test.has_line_other_than != null && !lines.some((l) => l !== test.has_line_other_than)) bad.push("has_line_other_than");
  return bad;
}

export function judgeRun(test, result) {
  const fail = (over) => ({
    ok: false,
    matched: false,
    text: (over && over.fail_text) || test.fail_text,
    correction: (over && over.correction) || test.correction || "",
    hint: (over && over.hint) || test.hint || "",
  });
  if (result.status === "out-of-inputs" && test.out_of_inputs_is_fail) return fail(test.fail_if_out_of_inputs);
  const bad = constraintFailures(test, result);
  if (bad.length) return fail();
  return { ok: true, matched: true, text: test.pass_text, correction: test.correction || "", hint: test.hint || "" };
}

export function shortPassLabel(text) {
  const raw = String(text || "");
  if (/made a list|list in square/i.test(raw)) return "list";
  if (/len\(\)/i.test(raw) && /count|length|used/i.test(raw)) return "len()";
  if (/chicken/i.test(raw) && /print/i.test(raw)) return "printed chicken";
  if (/\b5\b/.test(raw) && /length|len/i.test(raw)) return "5";
  const codes = [...raw.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  if (codes.length === 1) return codes[0];
  return raw.replace(/^You /, "").replace(/\.$/, "");
}

export function alsoPassedSentence(labels) {
  const items = labels.filter(Boolean);
  if (!items.length) return "";
  if (items.length === 1) return `Also passed: ${items[0]}.`;
  return `Also passed: ${items.slice(0, -1).join(", ")}, and ${items.at(-1)}.`;
}
