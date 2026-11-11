# Cole's AI Engineering Course

A static, no-backend course site: lessons (warm-up + L1–L9, previews of L10–12), an in-browser Python editor
(Pyodide in a Web Worker + CodeMirror 6), Check with real test runs, a practice quiz, and a while-loop cheat sheet.
Progress is saved in the browser (localStorage) with export/import.

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
