# Cole's AI Engineering Course

A static, no-backend course site: 13 lessons (L1–L8, warm-up, L9–L12), each with a See → Predict → Tweak → Fix → Build loop, an in-browser Python editor
(Pyodide in a Web Worker + CodeMirror 6), Check with rule checks and scripted runs, mixed reviews, a skills map, phase projects, and a while-loop cheat sheet.
Lesson content lives in `data/workbook.json`. `build.reference` is for tests only and is not shown in the UI.
Progress is saved in the browser (localStorage key `coleCourse.v1`) with export/import. A version 1 save migrates forward: lesson progress, drafts, and Quiz 1's score stay. The review after Lesson 8 starts as a new quiz.

## How it works
- Python runs in `js/py-worker.js` (Pyodide, vendored in `vendor/pyodide`, no CDN needed).
- `input()` uses a SharedArrayBuffer + Atomics channel. That needs cross-origin isolation:
  - Hosts that can set headers use `_headers` (Netlify / Cloudflare Pages).
  - GitHub Pages can't set headers, so `coi-serviceworker.js` adds them (the page reloads once on first visit).
  - If isolation is unavailable, the app falls back to a replay mode (re-runs the program with the answers so far).
- Stop / 15 s auto-timeout interrupt Python (KeyboardInterrupt); if it doesn't respond, the worker is killed and respawned.

## Deploy to GitHub Pages
1. Create a public repo (e.g. `ai-engineering-course`) and push these files to `main`.
2. Repo Settings → Pages → Source: "Deploy from a branch", Branch: `main` / root.
3. Open `https://<user>.github.io/ai-engineering-course/`.

## Local preview
Any static server works, e.g. `python3 -m http.server 8000`, then open http://localhost:8000.

## Tests
`npm test` runs every lesson's reference solution against its rules and scripted tests (Python 3, prompts kept off stdout) and checks that a version 1 progress file migrates without changing Quiz 1.
