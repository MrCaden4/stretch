# Stretch

A phone-first, offline-capable timer for a specific flexibility program: Session A (squat, ankle, turnout), Session B (splits, turnout), a bad-day Minimum, an optional off-day squat hang, desk micro-doses at a standing desk, every-other-Monday measurements, and the program notes as a Guide.

Live: https://mrcaden4.github.io/stretch/

Vanilla HTML, CSS and JavaScript (ES modules). No frameworks, no build step, no runtime dependencies, no backend, no accounts, no analytics. All state lives in `localStorage` under the key `stretch.v1`.

## What it does

- **Guided sessions** with big timers, spoken cues (Web Speech), beeps (Web Audio) and vibration. Timing is by wall clock, so a locked phone or a backgrounded tab never drifts the session. Screen Wake Lock keeps the display on.
- **Phase types:** holds with a contract-relax cue timeline, accumulate (squat hangs, with chunk tracking), reps (90/90 lift-offs), transitions (side switch, next exercise with setup text and notch).
- **Notches** (the depth setting per exercise) show on every transition screen with + and - buttons, so the progression rule is applied by hand in a tap.
- **Home** shows today's session by weekday, a Pick a session tile to start A, B, Minimum or the squat hang on any day, the week tracker (4 dots), test-day banner, desk phase, schedule, rules and expectations.
- **Desk** logs slant-board minutes, squat hangs and the hamstring hold, with bout timers.
- **Tests** runs the guided every-other-Monday measurements and keeps history with sparklines.
- **Guide** holds the program notes, pulled from `docs/program.md`.
- **Settings:** kettlebell kg, cue toggles, theme, transition seconds, dates, notches, export/import/reset.

## Run locally

Any static server works. From the repo root:

```sh
python3 -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000/ (hash routes: `#/`, `#/a`, `#/b`, `#/min`, `#/off`, `#/desk`, `#/tests`, `#/guide`, `#/settings`).

Opening `index.html` directly from disk does not work because ES modules and the service worker need http(s).

## Tests

```sh
node tests/run.js
```

Runs under plain Node (22+). It expands every routine, asserts the planned totals (Session A 23:20, Session B 25:40, Minimum 10:45), simulates every routine against a fake clock so that every cue fires exactly once and in order, and checks pause, catch-up after a hidden tab, accumulate chunks, exercise completion accounting, skip/back/+15 s, and the state helpers (week tracker, test days, desk, import/export).

Optional browser smoke test (needs Playwright with Chromium, global or via `npx`, plus a local server):

```sh
python3 -m http.server 8000 &
PW_PATH=$(npm root -g)/playwright node tests/smoke.cjs
```

It drives every route, a full Session A on a fake clock, the desk timers, the test flow and settings, and fails on any console error.

Syntax check everything:

```sh
for f in app.js timer.js state.js sw.js data/*.js tests/*.js tools/*.js; do node --check "$f"; done
```

## Deploy

GitHub Pages serves the `main` branch root. `.nojekyll` makes Pages serve every file as-is. Merge to `main` and Pages redeploys.

**Before every deploy, bump `CACHE_VERSION` in `sw.js`** (for example `v1` to `v2`). The service worker names its cache after it, drops older caches on activate, and clients pick up the new files on their next load (a toast offers a reload). If you forget, phones keep the old assets until the browser decides to refetch the worker.

Optionally bump `APP_VERSION` in `app.js` too; both show on the Settings page.

## Add it to a phone

Chrome or Brave on Android: open the live URL, tap the three-dot menu, then "Add to Home screen" (or "Install app"). It opens full screen, works offline after the first load, and the timers keep the screen awake.

## Edit a routine

Everything a routine says or does lives in `data/routines.js`. An exercise looks like:

```js
{
  id: 'A4',
  name: 'Adductor Rockback',
  short: 'Rockback',
  notch: 'rockback',                 // key into NOTCHES (shared across sessions)
  setup: 'Hands and knees, ...',     // {kb} is replaced by the kettlebell kg setting
  intensity: 'Settle at 6-7.',
  dose: '90 s per side, L then R',   // display only
  notchNote: '...',
  sides: ['L', 'R'],                 // or null for unsided
  rounds: 1,                         // how many times the side list repeats
  unit: [                            // blocks done per side per round
    { type: 'hold', seconds: 90, cues: [
      { at: 0,  say: 'Settle at 6 to 7.', label: 'Settle', segment: 'settle' },
      { at: 60, say: 'Contract: ...', label: 'Contract', segment: 'contract' },
      { at: 70, say: 'Relax and sink', label: 'Sink', segment: 'sink' },
    ] },
  ],
}
```

Block types: `hold` (cue timeline), `reps` (`reps`, `secondsPerRep`), `accumulate` (`seconds` target, `reminderEvery`, `reminder`). Add `rest: { seconds, say }` for a pause between unsided rounds. Side switches, exercise transitions and the setup transition are generated by `expandRoutine()` in `timer.js`.

After editing, run `node tests/run.js`. If you changed a routine's total time on purpose, update `EXPECTED_SECONDS` in `tests/run.js`.

## Icons

`node tools/make-icons.js` regenerates `icons/*.png` with plain Node (no packages).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Shell, theme bootstrap, loads `app.js` |
| `styles.css` | All styles, dark default, `[data-theme="light"]` overrides |
| `app.js` | Hash router, views, audio/speech/vibration, wake lock, service worker registration |
| `timer.js` | Pure engine: `expandRoutine`, `SessionEngine` |
| `state.js` | Pure state helpers: storage, dates, schedule, week tracker, notches, desk, tests |
| `data/routines.js` | Rules, notches, routines, desk phases, tests |
| `data/guide.js` | Guide text |
| `sw.js` | Service worker (`CACHE_VERSION`) |
| `manifest.webmanifest`, `icons/` | PWA install |
| `tests/run.js` | Node test runner |
| `tests/smoke.cjs` | Optional Playwright browser smoke test |
| `tools/make-icons.js` | Icon generator |
| `docs/program.md` | Canonical long-form program notes |
