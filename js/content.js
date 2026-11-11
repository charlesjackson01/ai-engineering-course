// Course content. Lesson text, rule checks, and quiz are taken from Cole's course Page.

export const LESSON_ORDER = ["l1","l2","l3","l4","l5","l6","l7","l8","warmup","l9","l10","l11","l12"];

const WHILE_EXAMPLE = 'password = ""\nwhile password != "python":\n    password = input("What\'s the password? ")\nprint("Access granted")';

export const LESSONS = {
  l1: {
    tag: "L1", title: "Print and Hello",
    concept: "`print` is how you put words on the screen. That's the whole lesson.",
    example: 'print("Hello")',
    diagram: { type: "chain", nodes: [
      { label: "You type", detail: 'print("Hello")' },
      { label: "Python runs it" },
      { label: "The screen shows", detail: "Hello", kind: "terminal" }] },
    task: "In the editor below, write that one line and run it. You should see Hello.",
    mistakes: "An early version of Lesson 1 jumped to a chart. One line is enough.",
    starter: "# Lesson 1: print Hello\n",
  },
  l2: {
    tag: "L2", title: "Strings vs variables",
    concept: "Quotes make a string: Python prints exactly what's inside. A name without quotes is a variable: Python looks up what you stored there.",
    example: 'name = "Cole Jackson"\nprint(name)\nprint("name")',
    diagram: { type: "pairs", pairs: [
      [{ label: 'print("name")', detail: "quotes around the word" }, { label: "shows the word", detail: "name", kind: "terminal" }],
      [{ label: "print(name)", detail: "no quotes, a variable" }, { label: "shows the value", detail: "Cole Jackson", kind: "terminal" }]] },
    task: 'Store your name in a variable, then print the variable and print `"name"`. Notice the difference.',
    mistakes: 'Extra quotes around a variable name, like `print("name")`, print the word name, not the value. You already spotted this.',
    starter: "# Lesson 2: store your name, then print it two ways\n",
  },
  l3: {
    tag: "L3", title: "Numbers and math",
    concept: "Numbers do math. Strings join. Same `+` sign, two different jobs. Other math operators: `-` subtract, `*` multiply, `/` divide.",
    example: 'print(5 + 3)\nprint("5" + "3")',
    diagram: { type: "pairs", pairs: [
      [{ label: "5 + 3", detail: "two numbers" }, { label: "8", detail: "math", kind: "terminal" }, "adds"],
      [{ label: '"5" + "3"', detail: "two strings" }, { label: "53", detail: "concatenation", kind: "terminal" }, "joins"]] },
    task: "Try both lines. Predict the results before you run them.",
    mistakes: 'Expecting `"5" + "3"` to be 8. You already explained it: two strings combining, that\'s concatenation.',
    starter: "# Lesson 3: numbers vs strings\n",
  },
  l4: {
    tag: "L4", title: "input() and joining",
    concept: "`input()` asks a question and waits. The answer is a string. You can join strings with `+`.",
    example: 'food = input("What\'s your favorite food? ")\nprint("You like " + food)',
    diagram: { type: "pairs", pairs: [
      [{ label: 'input("food")', detail: "no space at the end" }, { label: "foodChicken", detail: "the answer sticks", kind: "terminal" }],
      [{ label: 'input("food ")', detail: "space inside the quotes" }, { label: "food Chicken", detail: "a readable line", kind: "terminal" }]] },
    task: "Write a short program that asks for a food and prints a sentence with the answer. Check that the sentence looks right.",
    mistakes: "If the prompt is missing a space at the end, you get foodChicken. The space has to live inside the quotes.",
    starter: "# Lesson 4: ask for a food, then print a sentence\n",
  },
  l5: {
    tag: "L5", title: "int() and str()",
    concept: "`input()` always gives you text. `int()` turns text into a number so you can do math. `str()` turns a number into text so you can join it into a sentence.",
    example: 'age = int(input("How old are you? "))\nprint("Next year you\'ll be " + str(age + 1))',
    diagram: { type: "chain", nodes: [
      { label: '"15"', detail: "text from input()" },
      { label: "15", detail: "after int()" },
      { label: "16", detail: "after adding 1" },
      { label: '"16"', detail: "after str()", kind: "terminal" }], edgeLabels: ["int()", "+ 1", "str()"] },
    task: "Ask for a number, add one, and print a sentence that includes the new number.",
    mistakes: '`"Total: " + 15` causes a TypeError. Read the error from the bottom: the last line names the problem. Then wrap the number in `str()`.',
    starter: "# Lesson 5: ask for a number, add one, print a sentence\n",
  },
  l6: {
    tag: "L6", title: "if/else and ==",
    concept: "`if` and `else` let the program choose a path. `==` means is exactly this.",
    example: 'password = input("What\'s the password? ")\nif password == "python":\n    print("Access granted")\nelse:\n    print("Access denied")',
    diagram: { type: "branch", ask: "Ask for the password", check: 'password == "python"?', yes: "Access granted", no: "Access denied" },
    task: "Try the right password and a wrong one, and see both paths.",
    mistakes: "`>=` is not a match check. With `>=`, zebra got through because zebra comes after python in the alphabet. Use `==`.",
    starter: "# Lesson 6: check the password with if/else\n",
  },
  l7: {
    tag: "L7", title: "elif and order",
    concept: "`elif` adds more paths. Python checks from the top and stops at the first true condition. Order matters.",
    example: 'score = 95\nif score >= 90:\n    print("A")\nelif score >= 80:\n    print("B")\nelif score >= 70:\n    print("C")\nelse:\n    print("F")',
    diagram: { type: "ladder", steps: [[">= 90?", "A"], [">= 80?", "B"], [">= 70?", "C"]], last: "F" },
    task: "Run it with 95. Then swap the 90 and 70 checks and run it again. Predict first. Leave the right order in the editor when you hit Check.",
    mistakes: "If you check `>= 70` first, 95 gets a C, because 95 is also >= 70 and Python never reaches the A check. You caught this after testing.",
    starter: "# Lesson 7: grades with if / elif / else\n",
  },
  l8: {
    tag: "L8", title: "while loops",
    concept: "A while loop repeats as long as a check is true. It needs three parts: SETUP, CHECK, and CHANGE.",
    example: WHILE_EXAMPLE,
    diagram: { type: "loop", setup: 'password = ""', check: 'password != "python"?', change: "ask again with input()", done: "Access granted", yes: "yes, still wrong", no: "no, it matches", back: "check again" },
    task: "You already built this and did three debugging drills. The warm-up is a fresh run of the same idea.",
    mistakes: 'If CHANGE is missing, the CHECK never updates and the loop never ends. Hit Stop, then put `input()` inside the loop. A print after the loop is optional, unless the task asks for one. Spaces inside `" Access granted "` will show up in the output.',
    starter: "# Lesson 8: SETUP, CHECK, CHANGE\n",
  },
  warmup: {
    tag: "Warm-up", title: "Password loop",
    concept: "This is a short refresher after the break, not a new idea. Same three-part while loop you already know.",
    example: WHILE_EXAMPLE,
    diagram: { type: "loop", setup: 'password = ""', check: "until the answer is python", change: 'input("What\'s the password? ")', done: "Access granted", yes: "keep asking", no: "got it", back: "" },
    task: 'Write a program that asks `"What\'s the password? "`, keeps asking until the answer is `python`, then prints `Access granted`. Run it, then hit Check.',
    mistakes: "SETUP before the loop, CHECK at the top, CHANGE inside. That's the pattern that keeps you out of an infinite loop.",
    starter: "# Warm-up: keep asking for the password until it's python\n",
  },
  l9: {
    tag: "L9", title: "Lists and for loops",
    concept: "A list is a row of items in brackets. The first item is index 0, not 1. `len()` counts the items. A for loop walks through each item, one at a time.",
    example: 'foods = ["chicken", "tacos", "pizza"]\nprint(foods[0])\nprint(len(foods))\nfor food in foods:\n    print("I like " + food)\n\nnumbers = [3, 5, 7]\ntotal = 0\nfor number in numbers:\n    total = total + number\nprint(total)',
    diagram: { type: "list", items: ["chicken", "tacos", "pizza"] },
    task: "Add two foods to the list. Predict, then print `foods[0]` and `len(foods)`. After that, make a list of three numbers, start with `total = 0`, and use a for loop with `total = total + number`. Print the total.",
    mistakes: "`foods[1]` is the second item, not the first. Counting starts at 0.",
    starter: '# Lesson 9: lists and for loops\nfoods = ["chicken", "tacos", "pizza"]\n',
  },
  l10: {
    tag: "L10", title: "Functions", preview: true,
    concept: "Preview: functions let you pack a few lines into a named recipe, like `def greet(name):`, and reuse it. You'll get this as a full lesson after lists.",
    example: 'def greet(name):\n    print("Hello, " + name)\n\ngreet("Cole")',
  },
  l11: {
    tag: "L11", title: "Dictionaries", preview: true,
    concept: "Preview: a dictionary is a labeled box, not a numbered row. You look things up by the label, not by a position number.",
    example: 'person = {"name": "Cole", "city": "Austin"}\nprint(person["city"])',
  },
  l12: {
    tag: "L12", title: "Mini chat", preview: true,
    concept: "Preview: this is the Phase 0 finish line, a tiny chat program. You'll put `input()`, `if` / `elif`, and a `while` loop together so the program keeps talking until you say bye.",
    example: null,
  },
};

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

// ---------- Rule checks (ported from the Page) ----------
const hasPrint = (c) => /\bprint\s*\(/.test(c);
const hasInput = (c) => /\binput\s*\(/.test(c);
const promptHasTrailingSpace = (c) => /input\s*\(\s*(["'])(?:\\.|[^\\\n])*? \1/.test(c);
const hasIntCall = (c) => /\bint\s*\(/.test(c);
const hasStrCall = (c) => /\bstr\s*\(/.test(c);
const hasWhile = (c) => /\bwhile\b/.test(c);
function beforeWhile(c) { const at = c.search(/\bwhile\b/); return at >= 0 ? c.slice(0, at) : ""; }
function whileBody(c) {
  const at = c.search(/\bwhile\b/); if (at < 0) return "";
  const from = c.slice(at); const colon = from.indexOf(":");
  if (colon < 0) return "";
  // only the indented lines that follow the while line
  const lines = from.slice(colon + 1).split("\n");
  const out = [lines[0]];
  for (const l of lines.slice(1)) { if (l.trim() === "" || /^\s+/.test(l)) out.push(l); else break; }
  return out.join("\n");
}
const hasAssignment = (chunk) => /[A-Za-z_]\w*\s*=[^=]/.test(chunk);
const usesGteOnString = (c) => />=\s*["']/.test(c) || /["'][^"']*["']\s*>=/.test(c) || /password\s*>=/i.test(c);
const usesExactMatch = (c) => /==\s*["']/.test(c) || /["'][^"']*["']\s*==/.test(c);
function firstThresholdIsHighest(c) {
  const m = [...c.matchAll(/>=?\s*(\d+)/g)]; if (m.length < 2) return "skip";
  const v = m.map((x) => Number(x[1])); return v[0] === Math.max(...v);
}
const grantHasStraySpace = (c) => /print\s*\(\s*["']\s+Access granted|Access granted\s+["']/.test(c);
const stripComments = (c) => c.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n");

const item = (ok, yes, no, corrYes, corrNo, hint) => ({ ok, text: ok ? yes : no, correction: ok ? corrYes : corrNo, hint });

export function ruleChecks(lesson, raw) {
  const code = stripComments(raw.replace(/\r\n/g, "\n"));
  if (code.trim() === "") return [{ ok: false, text: "The editor is empty", correction: "Write your code in the editor first, then hit Check again.", hint: "Tap “Try it” to load the example if you want a starting point." }];
  switch (lesson) {
    case "l1": {
      const hello = /["']Hello["']|["']hello["']/.test(code);
      return [
        item(hasPrint(code), "You used `print()`", "This needs a `print()` line", "That's the tool that puts text on the screen.", "Add a line that starts with `print(`.", 'The whole lesson is one line: `print("Hello")`.'),
        item(hello, "You're printing Hello", "The lesson asks you to print Hello", "Nice and small. That's the right size for Lesson 1.", "Put Hello inside the quotes.", "Whatever is inside the quotes is what appears on the screen."),
      ];
    }
    case "l2": {
      const assigned = /[A-Za-z_]\w*\s*=\s*["']/.test(code);
      const printedVar = /\bprint\s*\(\s*[A-Za-z_]\w*\s*\)/.test(code);
      const quotedName = /\bprint\s*\(\s*["']name["']\s*\)/.test(code);
      return [
        item(assigned, "You stored text in a variable", "Store your name in a variable first", "A variable holds a value so you can use it later.", 'Write something like `name = "Cole Jackson"`.', "The quotes go around the text you store, not around the variable's name."),
        item(printedVar, "You printed the variable, not the word", "Print the variable without quotes around its name", "`print(name)` looks up what you stored.", 'Use `print(name)`, not `print("name")`, to see the stored value.', "Quotes tell Python to print the exact text inside them."),
        { ok: quotedName || printedVar, text: quotedName ? "You also printed the word name, for comparison" : 'Optional: also print `"name"` to compare',
          correction: quotedName ? "Side by side, the two prints make the idea click." : 'This one is extra. `print("name")` shows the word name.', hint: "One has quotes, one doesn't. That's the whole point of this lesson." },
      ];
    }
    case "l3": {
      const numberAdd = /(?<!["'\w])\d+\s*\+\s*\d+/.test(code);
      const stringAdd = /["']\d+["']\s*\+\s*["']\d+["']/.test(code);
      return [
        item(numberAdd, "You added two numbers", "Add two numbers with no quotes", "Without quotes, `+` does math, so `5 + 3` is 8.", "Try `print(5 + 3)` and you should see 8.", "Numbers have no quotes around them."),
        item(stringAdd, "You joined two strings", "Join two quoted pieces of text with `+`", 'With quotes, `+` concatenates, so `"5" + "3"` is 53.', 'Try `print("5" + "3")` and you should see 53.', "Same `+` sign, different job, because the types are different."),
      ];
    }
    case "l4": return [
      item(hasInput(code), "You used `input()` to ask a question", "This needs an `input()` line", "`input()` prints a prompt and waits for an answer.", 'Ask the question with `input("What\'s your favorite food? ")`.', "The answer comes back as a string, ready to join into a sentence."),
      item(promptHasTrailingSpace(code), "The prompt has a space at the end", "The prompt is missing a space at the end", "That space keeps the answer from sticking to the question.", 'Put a space before the closing quote, like `input("What\'s your favorite food? ")`.', "Without that space, you get something like foodChicken."),
      item(/\+/.test(code) && hasPrint(code), "You joined the answer into a sentence", "Join the answer onto some text with `+`", "`+` glues two strings together.", 'Try `print("You like " + food)`.', "Leave a space inside the quoted text so the sentence reads naturally."),
    ];
    case "l5": return [
      item(hasIntCall(code), "You used `int()` to make a number", "This needs `int()` to turn text into a number", "`input()` always gives you text. `int()` makes it a number you can do math with.", 'Wrap the answer, like `age = int(input("How old are you? "))`.', "If you add text to a number, Python shows a TypeError. Read that error from the bottom."),
      item(hasStrCall(code), "You used `str()` when joining a number into a sentence", "Use `str()` when you join a number onto text", "`str()` turns the number back into text so `+` can join it.", 'Write something like `print("Next year you\'ll be " + str(age + 1))`.', '`"Total: " + 15` fails. `"Total: " + str(15)` works.'),
    ];
    case "l6": {
      const gte = usesGteOnString(code), exact = usesExactMatch(code);
      return [
        item(/\bif\b/.test(code), "You used `if` to make a choice", "This needs an `if` line", "The program now has more than one path.", 'Start with `if password == "python":`.', "The line after `if` has to be indented."),
        { ok: exact && !gte, text: gte ? "`>=` is being used on a password or a string" : exact ? "You're checking with `==`" : "Use `==` for an exact match",
          correction: gte ? "Swap `>=` for `==`. `>=` let zebra through because zebra comes after python in the alphabet." : exact ? "`==` means is this exactly that." : 'Write `if password == "python":`.',
          hint: "`>=` is for greater-or-equal, not for matching a password." },
        item(/\belse\s*:/.test(code), "You have an `else` path too", "Add an `else` for the wrong password", "That's the path for every answer that isn't a match.", "After the `if` block, add `else:` and print Access denied.", "`else` runs only when the `if` check is false."),
      ];
    }
    case "l7": {
      const order = firstThresholdIsHighest(code);
      const items = [item(/\belif\b/.test(code), "You used `elif` for more than two paths", "This needs at least one `elif`", "`elif` adds another check, after `if` and before `else`.", "After your `if`, add `elif score >= 80:` and so on.", "Python checks from the top and stops at the first true condition.")];
      if (order !== "skip") items.push(item(order, "The highest score check comes first", "The conditions are in the wrong order", "Checking `>= 90` before `>= 70` means 95 gets an A.", "Put the highest threshold first, like `>= 90`, then `>= 80`, then `>= 70`.", "If `>= 70` comes first, 95 is true right away and gets a C."));
      return items;
    }
    case "l8": case "warmup": {
      const loopOk = hasWhile(code);
      const setupOk = loopOk && hasAssignment(beforeWhile(code));
      const changeOk = loopOk && hasInput(whileBody(code));
      const granted = /Access granted/i.test(code), stray = grantHasStraySpace(code), pythonWord = /["']python["']/.test(code);
      const items = [
        item(setupOk, "SETUP: the variable has a value before the loop", "SETUP is missing: give the variable a starting value", 'A starting value like `password = ""` lets the CHECK run the first time.', 'Before `while`, write `password = ""` (or ask once, then loop).', "If the variable doesn't exist yet, the CHECK has nothing to look at."),
        item(loopOk, "CHECK: you have a `while` line", "CHECK is missing: this needs a `while` loop", "The `while` line is the yes/no question that keeps the loop going.", 'Write `while password != "python":` and indent the next line.', "The loop body keeps running as long as that check is true."),
        item(changeOk, "CHANGE: `input()` is inside the loop", "CHANGE is missing: `input()` is not inside the loop", "Each pass can get a new answer, so the CHECK can eventually become false.", 'Put `password = input("What\'s the password? ")` inside the loop, indented under `while`.', "If the password never changes inside the loop, you get an infinite loop. Hit the Stop button if that happens."),
      ];
      if (lesson === "warmup") {
        items.push(item(pythonWord, "The loop waits for the password `python`", "The warm-up password should be `python`", "That matches the warm-up task.", "Keep asking until the answer is exactly `python`.", "`==` and `!=` care about exact spelling and spaces."));
        items.push({ ok: granted && !stray, text: stray ? "`Access granted` has extra spaces inside the quotes" : granted ? "You print Access granted when the loop is done" : "After the loop, print Access granted",
          correction: stray ? "Remove the stray spaces so it prints `Access granted`, not ` Access granted `." : granted ? "A print after the loop is optional in general, but this task asks for it." : 'When the CHECK is false, Python leaves the loop. That\'s the place for `print("Access granted")`.',
          hint: "Spaces inside quotes show up in the output." });
      } else if (stray) {
        items.push({ ok: false, text: "`Access granted` has extra spaces inside the quotes", correction: "Remove the stray spaces so it prints exactly `Access granted`.", hint: "A print after the loop is optional, but if you add one, the text inside the quotes is shown as written." });
      }
      return items;
    }
    case "l9": return [
      item(/\[[^\]]*\]/.test(code), "You made a list in square brackets", "Make a list in square brackets `[]`", "A list is a row of items, separated by commas.", 'Start with `foods = ["chicken", "tacos", "pizza"]`, then add two more foods.', "The first item is `foods[0]`, not `foods[1]`. Counting starts at 0."),
      item(/\bfor\s+[A-Za-z_]\w*\s+in\s+/.test(code), "You used a `for` loop to walk through a list", "Add a `for` loop that walks through a list", "Each pass of the loop gives you the next item.", 'Write `for food in foods:` and then `print("I like " + food)`.', "`for food in foods` means: take each item, call it food, and run the indented lines."),
      item(/\blen\s*\(/.test(code), "You used `len()` to count the items", "Use `len(foods)` to count the items", "`len()` tells you how many items are in the list.", "Add `print(len(foods))`.", "With 5 foods, len(foods) is 5, but the last index is 4."),
      item(/total\s*=\s*0/.test(code), "The sum starts at `total = 0`", "Start the sum with `total = 0`", "Zero is a clean starting point before you add anything.", "Before the loop, write `total = 0`.", "This is SETUP for a running total, the same idea you used with while loops."),
      item(/total\s*=\s*total\s*\+|total\s*\+=/.test(code), "You add each number with `total = total +`", "Add each number with `total = total + number`", "Each pass updates the running total.", "Inside the loop, write `total = total + number`, then print `total` when you're done.", "Make a list of three numbers and let the loop do the adding."),
    ];
  }
  return [];
}

// ---------- Run tests: real runs with scripted input ----------
// Each test: { inputs, judge(result) -> check item }.  result = { status, out, prompts, inputCount, error }
const lines = (s) => s.split("\n").map((l) => l.trim()).filter((l) => l !== "");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const RUN_TESTS = {
  l1: [{ inputs: [], judge: (r) => item(/hello/i.test(r.out), "Running it prints Hello", "Running it doesn't print Hello yet", "The output matches the task.", 'Your output was: ' + show(r.out), "Check the spelling inside the quotes.") }],
  l2: [{ inputs: [], judge: (r) => item(lines(r.out).some((l) => l !== "name"), "Running it shows the value you stored", "Running it doesn't show your stored value", "Your variable's value appeared on screen.", "Only the word name (or nothing) showed up. Print the variable itself.", "`print(name)` with no quotes.") }],
  l3: [{ inputs: [], judge: (r) => item(lines(r.out).includes("8"), "Running it shows 8 (math)", "Running it doesn't show 8", "Two numbers added up.", "Add a line like `print(5 + 3)`.", "No quotes around numbers you want to add.") },
       { inputs: [], judge: (r) => item(lines(r.out).includes("53"), "Running it shows 53 (joined strings)", "Running it doesn't show 53", "Two strings joined together.", 'Add a line like `print("5" + "3")`.', "Quotes turn numbers into text.") }],
  l4: [{ inputs: ["Chicken"], judge: (r) => item(r.inputCount >= 1 && /chicken/i.test(r.out), "Answering Chicken prints a sentence with Chicken", "Answering Chicken didn't print it back", "The answer made it into your sentence.", "We typed Chicken, but it never appeared in the output. Print the variable you stored the answer in.", 'Like `print("You like " + food)`.') }],
  l5: [{ inputs: ["15"], judge: (r) => item(/\b16\b/.test(r.out), "Answering 15 prints a sentence with 16", "Answering 15 didn't show 16", "int() and str() did their jobs.", "We typed 15 and expected to see 16 in the output.", "int() the answer, add 1, then str() it to join.") }],
  l6: [{ inputs: ["python"], judge: (r) => item(/access granted/i.test(r.out), "The password python gets in", "The password python didn't get in", "The right password takes the if path.", 'We typed python but didn\'t see Access granted. Your output: ' + show(r.out), 'Use `if password == "python":`.') },
       { inputs: ["zebra"], judge: (r) => item(!/access granted/i.test(r.out) && r.inputCount >= 1, "The password zebra is blocked", "The password zebra got in", "Wrong answers go to the else path.", "We typed zebra and saw Access granted. That's the `>=` bug: zebra comes after python in the alphabet.", "Use `==` for an exact match.") }],
  l7: [{ inputs: ["95"], judge: (r) => item(lines(r.out).some((l) => l === "A"), "A score of 95 gets an A", "A score of 95 doesn't get an A", "Highest check first. Nice.", "Your output was: " + show(r.out) + ". Put `>= 90` first.", "Python stops at the first true condition.") }],
  l8: [loopTest(false)],
  warmup: [loopTest(true), { inputs: ["hello", "zebra", "python"], judge: (r) => {
      const ok = r.status === "ok" && lines(r.out).length > 0 && norm(lines(r.out).at(-1)) === "access granted" && (r.out.match(/access granted/gi) || []).length === 1;
      return item(ok, "It prints Access granted once, at the end", "Access granted isn't printed once at the end", "The output matches the task.", "We expected the last line to be Access granted, and only after python. Your output: " + show(r.out), "Put the print after the loop, not indented inside it.");
    } }],
  l9: [{ inputs: [], judge: (r) => item(r.status === "ok" && lines(r.out).length >= 3, "It runs and prints your list work", "It needs to print a few lines", "No errors, and the loop printed its lines.", "Print each food with a for loop, then print the total.", "A for loop prints once per item.") }],
};
function show(out) { const t = out.trim(); return t ? "“" + (t.length > 120 ? t.slice(0, 120) + "…" : t).replace(/\n/g, " ⏎ ") + "”" : "(nothing)"; }
function loopTest(strictPrint) {
  return { inputs: ["hello", "zebra", "python"], judge: (r) => {
    if (r.status === "out-of-inputs") return { ok: false, text: "The loop kept asking after we typed python", correction: "We answered hello, zebra, then python, but it asked again. The CHECK never became false.", hint: "Make sure the CHECK compares the same variable that input() updates, like `while password != \"python\":`." };
    const ok = r.status === "ok" && r.inputCount === 3;
    return item(ok, "The loop stops right after python", "The loop didn't stop at the right time", "We typed hello, zebra, python. It asked 3 times and stopped. That's SETUP, CHECK, CHANGE working.",
      r.status === "ok" ? `It asked ${r.inputCount} time(s) instead of 3. It should keep asking until the answer is python.` : "It didn't finish cleanly. See the details below.",
      "input() goes inside the loop, and the CHECK compares to \"python\".");
  } };
}

export const PREVIEW_IDS = ["l10", "l11", "l12"];
