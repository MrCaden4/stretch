# CLAUDE.md

Guidance for working on this repo.

## What this is

A static, phone-first PWA: a guided stretch-routine timer for one specific flexibility program, deployed to GitHub Pages at `https://mrcaden4.github.io/stretch/` from the `main` branch root. Vanilla HTML/CSS/JS (ES modules). No build step, no bundler, no runtime npm dependencies, no backend, no analytics. State lives in `localStorage` under `stretch.v1`.

## File map

- `index.html`: shell. Inline theme bootstrap (reads `stretch.v1` before first paint), `<main id="app">`, `<nav id="tabbar">`, `<div id="toast">`, loads `app.js` as a module.
- `styles.css`: all styles. Dark is the default; `:root[data-theme="light"]` overrides. One accent per phase segment (`--seg-settle`, `--seg-contract`, `--seg-sink`, `--seg-transition`, `--seg-accumulate`, `--seg-feel`, `--seg-lift/hold/down`). Tap targets are at least 56 px.
- `app.js`: the only file that touches the DOM or browser APIs. Hash router (`#/`, `#/a`, `#/b`, `#/min`, `#/off`, `#/desk`, `#/tests`, `#/guide`, `#/settings`), all views, audio (Web Audio beeps), speech (speechSynthesis), vibration, Screen Wake Lock, service worker registration, toasts.
- `timer.js`: pure engine, DOM-free. `expandRoutine(routine, opts)` turns a routine into ordered phases; `SessionEngine` runs them by wall clock.
- `state.js`: pure helpers, DOM-free. Load/save/normalize state, date helpers, weekday plan, program week, test days, week tracker, session records, suggestions, notches, desk logs, test history, export/import.
- `data/routines.js`: all program content (rules, notches, routines, schedule text, expectations, desk phases, tests).
- `data/guide.js`: Guide text as blocks. `docs/program.md` is the canonical long-form source; keep them consistent.
- `sw.js`: service worker. `CACHE_VERSION` constant, precache list, network-first navigations, cache-first assets.
- `manifest.webmanifest`, `icons/`: PWA install. `tools/make-icons.js` regenerates the icons.
- `tests/run.js`: node test runner. `node tests/run.js`.
- `tests/smoke.cjs`: optional Playwright browser smoke test (needs a local server and Playwright; see README). Screenshots land in `tests/shots/` (gitignored).
- `.nojekyll`: makes Pages serve every file as-is.

## How routines are defined

`ROUTINES` in `data/routines.js` is keyed `A`, `B`, `min`, `off`. Each routine has `setup` (the opening transition), optional `transitions: { side, exercise }` overrides (Minimum uses 5/10; A and B take the user's settings), and `exercises`.

Each exercise: `id`, `name`, `short`, `notch` (key into `NOTCHES`, shared across sessions), `setup` (with `{kb}` placeholder for kettlebell kg), `intensity`, `dose`, `notchNote`, `sides` (`['L','R']` or `null`), `rounds`, `unit` (blocks per side per round), optional `rest` for unsided rounds.

Blocks: `hold` (`seconds`, `cues: [{ at, say, label, segment }]`), `reps` (`reps`, `secondsPerRep`), `accumulate` (`seconds` target, `reminderEvery`, `reminder`, `startSay`).

`expandRoutine()` inserts: the setup transition, exercise transitions (with `next` info for the screen), side switches (double beep, "Switch sides"), rests, and a 10 s `feel` phase after every exercise. Each phase has `type`, `seconds`, `label`, `instruction`, `cues` (sorted by `at`, each with `sound` and `vibrate`), `meta` (`exerciseIndex`, `exerciseCount`, `exerciseId`, `exerciseName`, `notch`, `set`, `sets`, `side`).

Planned time (`plannedSeconds`) excludes feel screens. Expected: A 1400 s, B 1540 s, Minimum 645 s, off 190 s. The tests assert these; update `EXPECTED_SECONDS` in `tests/run.js` if a routine changes on purpose.

## Engine rules

- Never count ticks. Every phase records its start wall time; `tick(now)` recomputes elapsed and fires cues whose time has passed. Cues more than 5 s late (`staleCueSeconds`) are emitted as `cueDropped`, not `cue`.
- When a phase overruns (tab hidden), the next phase starts at the previous phase's exact end time, so the session stays on wall-clock time. Skip, back and rate start the next phase at `now`.
- Pause is per phase: `elapsedBefore` + `runningSince`. In accumulate phases a pause ends the current chunk.
- Events: `start`, `phase`, `cue`, `cueDropped`, `phaseEnd`, `pause`, `resume`, `extend`, `rating`, `finish`. Listeners receive `(type, data)`.
- `snapshot()` is the read model for rendering. `summary()` feeds `state.recordSession`.

## Conventions

- No em dashes anywhere in UI text or data. No pants notes. Neck training and the adductor machine are not routines.
- Escape everything that goes into `innerHTML` (`esc()` in `app.js`); Guide text allows only `**bold**` through `inline()`.
- `app.js` re-renders whole views with `render()`. The session screen is built once per phase (`buildSessionScreen`) and updated on ticks (`updateSessionScreen`) so buttons are not replaced mid-tap.
- Mobile APIs (wake lock, speech, vibration, AudioContext) must feature-detect and fail silently.
- Keep `timer.js` and `state.js` importable under plain node (no `window`/`document` at module scope).
- Run `node --check` on every JS file and `node tests/run.js` before committing.
- Relative paths only (the site lives at a subpath).

## Bumping the cache version

Before each deploy, change `CACHE_VERSION` in `sw.js` (for example `'v1'` to `'v2'`). The cache name is `stretch-${CACHE_VERSION}`; old caches are deleted on activate; the app shows a reload toast on `controllerchange`. Optionally bump `APP_VERSION` in `app.js`. Both values show on the Settings page.
