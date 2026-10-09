// app.js
// Hash router + all views + all DOM/browser code (audio, speech, wake lock,
// service worker registration). The engine (timer.js) and the state helpers
// (state.js) stay DOM-free so tests/run.js can run them under plain node.

import {
  ROUTINES,
  RULES,
  NOTCHES,
  SCHEDULE,
  SCHEDULE_NOTE,
  EXPECTATIONS,
  DESK_PHASES,
  DESK_NOTE,
  DESK_SQUAT,
  DESK_HAMSTRING,
  TESTS,
  TEST_SCHEDULE_TEXT,
} from './data/routines.js';
import { GUIDE, guideSection } from './data/guide.js';
import { expandRoutine, SessionEngine, plannedSeconds, formatClock, sideName } from './timer.js';
import * as S from './state.js';

export const APP_VERSION = '1.1.0';
const REPO_URL = 'https://github.com/MrCaden4/stretch';
const ROUTE_FOR_ROUTINE = { A: 'a', B: 'b', min: 'min', off: 'off' };

const $app = document.getElementById('app');
const $tabbar = document.getElementById('tabbar');
const $toast = document.getElementById('toast');

let state = S.loadState();
let activeSession = null; // { routineId, routine, phases, engine, interval, dom, builtIndex, confirmEnd }
let lastSummary = null; // { routineId, summary, record }
let miniTimer = null; // { id, label, engine, interval, onDone }
let testFlow = null; // { step, values, date, stopwatch }
let autoStartTests = false;
let swCacheVersion = null;
let toastTimer = null;
let lastRoute = null;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function inline(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function save() {
  S.saveState(state);
}

function now() {
  return new Date();
}

function todayKey() {
  return S.toDateKey(now());
}

function clockUp(seconds) {
  return formatClock(Math.floor(seconds));
}

function minutesLeft(seconds) {
  if (seconds < 60) return 'Under a minute left';
  return `About ${Math.ceil(seconds / 60)} min left`;
}

function settingsOpts() {
  const s = state.settings;
  return {
    sideSwitchSeconds: Number(s.sideSwitchSeconds) > 0 ? Number(s.sideSwitchSeconds) : 10,
    exerciseTransitionSeconds: Number(s.exerciseTransitionSeconds) > 0 ? Number(s.exerciseTransitionSeconds) : 20,
    kettlebellKg: Number.isFinite(Number(s.kettlebellKg)) ? Number(s.kettlebellKg) : 16,
  };
}

function routineMinutes(id) {
  return Math.round(plannedSeconds(expandRoutine(ROUTINES[id], settingsOpts())) / 60);
}

function notchDisplay(key, value) {
  const def = NOTCHES[key];
  if (!def) return String(value);
  const v = value != null ? value : def.default;
  if (def.levels) return def.levels[v] ? `${v}: ${def.levels[v]}` : `${v}`;
  return `${v}${def.unit ? ' ' + def.unit : ''}`;
}

function bind(root, selector, event, handler) {
  root.querySelectorAll(selector).forEach((n) => n.addEventListener(event, handler));
}

function toast(message, opts = {}) {
  if (!$toast) return;
  $toast.innerHTML = `<span>${esc(message)}</span>${opts.actionLabel ? `<button class="btn btn-small btn-primary">${esc(opts.actionLabel)}</button>` : ''}`;
  $toast.hidden = false;
  const btn = $toast.querySelector('button');
  if (btn) {
    btn.addEventListener('click', () => {
      hideToast();
      if (opts.onAction) opts.onAction();
    });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, opts.ms || 4000);
}

function hideToast() {
  if ($toast) $toast.hidden = true;
}

// ---------------------------------------------------------------------------
// Audio, speech, vibration, wake lock. Everything feature-detects and fails
// silently; the phone is where these get tested.
// ---------------------------------------------------------------------------

const audio = {
  ctx: null,
  unlock() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !this.ctx) this.ctx = new AC();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) {
      this.ctx = null;
    }
    try {
      if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      /* no speech */
    }
  },
  beep(kind) {
    if (!state.settings.beeps || !this.ctx) return;
    try {
      const ctx = this.ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const patterns = { single: [[880, 0.12]], double: [[880, 0.1], [880, 0.1]], long: [[660, 0.6]] };
      const pattern = patterns[kind] || patterns.single;
      let t = ctx.currentTime + 0.01;
      for (const [freq, dur] of pattern) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
        gain.gain.setValueAtTime(0.5, Math.max(t + 0.011, t + dur - 0.03));
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur + 0.12;
      }
    } catch (e) {
      /* no audio */
    }
  },
  speak(text) {
    if (!state.settings.voice || !text) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      u.lang = 'en-US';
      setTimeout(() => {
        try {
          synth.speak(u);
        } catch (e) {
          /* ignore */
        }
      }, 30);
    } catch (e) {
      /* no speech */
    }
  },
  vibrate(kind) {
    if (!state.settings.vibration || typeof navigator.vibrate !== 'function') return;
    const patterns = { single: [120], double: [90, 80, 90], long: [400] };
    try {
      navigator.vibrate(patterns[kind] || patterns.single);
    } catch (e) {
      /* ignore */
    }
  },
  cue(cue) {
    if (!cue) return;
    if (cue.sound) this.beep(cue.sound);
    if (cue.vibrate) this.vibrate(cue.vibrate);
    if (cue.say) this.speak(cue.say);
  },
};

const wake = {
  sentinel: null,
  async request() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      if (this.sentinel && !this.sentinel.released) return;
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch (e) {
      this.sentinel = null;
    }
  },
  async release() {
    const s = this.sentinel;
    this.sentinel = null;
    if (!s) return;
    try {
      await s.release();
    } catch (e) {
      /* ignore */
    }
  },
};

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const lightQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

function applyTheme() {
  let theme = state.settings.theme || 'system';
  if (theme === 'system') theme = lightQuery && lightQuery.matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f7f9' : '#0f1115');
}

if (lightQuery && typeof lightQuery.addEventListener === 'function') {
  lightQuery.addEventListener('change', () => {
    if ((state.settings.theme || 'system') === 'system') applyTheme();
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const ROUTES = {
  '': viewHome,
  a: () => viewRoutine('A'),
  b: () => viewRoutine('B'),
  min: () => viewRoutine('min'),
  off: () => viewRoutine('off'),
  desk: viewDesk,
  tests: viewTests,
  guide: viewGuide,
  settings: viewSettings,
};

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  return raw.split('?')[0].replace(/\/+$/, '').toLowerCase();
}

function sessionViewVisible() {
  return !!activeSession && ROUTE_FOR_ROUTINE[activeSession.routineId] === currentRoute();
}

function render() {
  const route = currentRoute();
  const view = ROUTES[route] || viewNotFound;
  $app.innerHTML = '';
  view(route);
  renderTabbar(route);
  document.body.classList.toggle('in-session', sessionViewVisible());
  if (route !== lastRoute) window.scrollTo(0, 0);
  lastRoute = route;
}

const TABS = [
  ['', 'Home'],
  ['desk', 'Desk'],
  ['tests', 'Tests'],
  ['guide', 'Guide'],
  ['settings', 'Settings'],
];

function renderTabbar(route) {
  const homeish = route === '' || route in ROUTE_FOR_ROUTINE_ROUTES;
  $tabbar.innerHTML = TABS.map(([r, label]) => {
    const active = r === '' ? homeish : r === route;
    return `<a class="tab${active ? ' active' : ''}" href="#/${r}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
  }).join('');
}
const ROUTE_FOR_ROUTINE_ROUTES = { a: 1, b: 1, min: 1, off: 1 };

function activeBannerHtml() {
  if (!activeSession) return '';
  const snap = activeSession.engine.snapshot();
  return `<div class="banner banner-active"><div><strong>${esc(activeSession.routine.name)} in progress</strong><div class="muted small">${esc(minutesLeft(snap.remainingTotal))}${snap.status === 'paused' ? ' (paused)' : ''}</div></div><a class="btn btn-primary" href="#/${ROUTE_FOR_ROUTINE[activeSession.routineId]}">Return</a></div>`;
}

function viewNotFound() {
  $app.innerHTML = `<header class="page-header"><h1>Not found</h1></header><section class="card"><p>That page does not exist.</p><a class="btn btn-primary" href="#/">Home</a></section>`;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function dotsHtml(days) {
  return `<div class="dots" role="list">${days
    .map(
      (d) =>
        `<div class="dot dot-${d.status}${d.isToday ? ' today' : ''}" role="listitem" aria-label="${esc(d.weekday)}: ${esc(d.status)}"><span class="dot-mark"></span><span class="dot-label">${esc(d.weekday)}</span></div>`
    )
    .join('')}</div>
  <div class="legend"><span class="l-done">done</span><span class="l-minimum">minimum</span><span class="l-missed">missed</span><span class="l-upcoming">upcoming</span></div>`;
}

function viewHome() {
  const d = now();
  const key = todayKey();
  const plan = S.planForDay(d);
  const week = S.programWeek(state, d);
  const ws = S.weekSummary(state, d);
  const doneToday = S.sessionsOn(state, key).filter(S.isCountedSession);
  const hasBaseline = !!S.testStartKey(state);
  const testDay = S.isTestDay(state, d);
  const testedToday = S.hasTestOn(state, key);
  const deskPhase = S.deskPhaseForWeek(week);
  const desk = S.deskDay(state, key);

  let todayCard;
  const minDone = doneToday.find((s) => s.routine === 'min');
  const minLine = minDone ? `<p><strong>Minimum done today</strong> (${formatClock(minDone.durationSeconds)}). Counts as a completed day.</p>` : '';
  if (plan === 'off') {
    const off = S.sessionsOn(state, key).find((s) => s.routine === 'off' && s.completed);
    const extra = doneToday.filter((s) => s.routine === 'A' || s.routine === 'B');
    const extraLine = extra.length ? `<p><strong>Done today:</strong> ${extra.map((s) => `${esc(ROUTINES[s.routine].name)} (${formatClock(s.durationSeconds)})`).join(', ')}.</p>` : '';
    todayCard = `<section class="card"><h2>Today: Off day</h2><p>Off day: surf, skate, or a 3-minute squat hang.</p>${extraLine}${minLine}${
      off ? `<p><strong>Squat hang done today.</strong> Longest chunk ${formatClock(off.longestSquatChunk || 0)}.</p>` : ''
    }<a class="btn ${off ? '' : 'btn-primary btn-big'} btn-block" href="#/off">3-min squat hang</a><a class="btn btn-block" href="#/min" style="margin-top:10px">Bad day? Minimum, 10 min</a></section>`;
  } else {
    const r = ROUTINES[plan];
    const done = doneToday.find((s) => s.routine === plan);
    const doneLine = done
      ? `<p><strong>Done today:</strong> ${formatClock(done.durationSeconds)}${done.longestSquatChunk ? `, longest squat chunk ${formatClock(done.longestSquatChunk)}` : ''}.</p>`
      : '';
    todayCard = `<section class="card"><h2>Today: ${esc(r.name)}</h2><p class="muted">${esc(r.focus)}</p>${doneLine}${minLine}${
      done
        ? `<a class="btn btn-block" href="#/${ROUTE_FOR_ROUTINE[plan]}">Start ${esc(r.name)} again</a>`
        : `<a class="btn btn-primary btn-big btn-block" href="#/${ROUTE_FOR_ROUTINE[plan]}">Start ${esc(r.name)} (about ${routineMinutes(plan)} min)</a>`
    }<a class="btn btn-block" href="#/min" style="margin-top:10px">Bad day? Minimum, 10 min</a></section>`;
  }

  let testBanner = '';
  if (!hasBaseline) {
    testBanner = `<div class="banner banner-test"><div><strong>No baseline yet: run the first tests</strong><div class="muted small">5 min of measurements, then the session.</div></div><button class="btn btn-primary" id="go-tests">Run tests</button></div>`;
  } else if (testDay && !testedToday) {
    testBanner = `<div class="banner banner-test"><div><strong>Test day: 5 min of measurements before Session A</strong></div><button class="btn btn-primary" id="go-tests">Start tests</button></div>`;
  }

  const recent = state.sessions
    .slice()
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 10);

  $app.innerHTML = `
    <header class="page-header">
      <div><h1>Stretch</h1><div class="sub">${week ? `Week ${week}` : 'Week 1 starts with your first session'}</div></div>
      <div class="sub">${esc(S.formatDate(d))}</div>
    </header>
    ${activeBannerHtml()}
    ${testBanner}
    ${todayCard}
    <section class="card">
      <h2>This week</h2>
      ${dotsHtml(ws.days)}
      <dl class="stats" style="margin-top:12px">
        <dt>Sessions completed</dt><dd>${ws.completed}/${ws.target}</dd>
        <dt>Desk calf minutes</dt><dd>${ws.deskCalfMinutes}</dd>
        <dt>Next test</dt><dd>${ws.nextTest ? esc(S.formatShortDate(ws.nextTest)) : 'after the first tests'}</dd>
      </dl>
    </section>
    <section class="card">
      <h2>Schedule</h2>
      <ul>${SCHEDULE.map((s) => `<li><strong>${esc(s.day)}:</strong> ${esc(s.text)}</li>`).join('')}</ul>
      <p class="muted small">${esc(SCHEDULE_NOTE)}</p>
    </section>
    <section class="card">
      <h2>Rules</h2>
      <ul>${RULES.map((r) => `<li><strong>${esc(r.title)}:</strong> ${esc(r.text)}</li>`).join('')}</ul>
    </section>
    <section class="card">
      <div class="card-title-row"><h2>Desk</h2><a href="#/desk">Open Desk</a></div>
      <p><strong>${esc(deskPhase.weeks)}${week ? ` (week ${week})` : ''}:</strong> ${esc(deskPhase.text)}</p>
      <p>Slant board today: <strong>${desk.slantMinutes} of ${deskPhase.dailyTargetMinutes} min</strong>. Squat hangs today: <strong>${desk.squatHangs}</strong>.</p>
    </section>
    <section class="card">
      <h2>Expectations</h2>
      ${EXPECTATIONS.map((t) => `<p>${esc(t)}</p>`).join('')}
    </section>
    <div class="grid-3" style="margin-bottom:12px">
      <a class="btn" href="#/guide">Guide</a><a class="btn" href="#/tests">Tests</a><a class="btn" href="#/settings">Settings</a>
    </div>
    <details class="section"><summary>Log (${state.sessions.length})</summary><div class="section-body">
      ${recent.length ? `<ul class="log-list">${recent.map(logLine).join('')}</ul>` : '<p class="muted">No sessions yet.</p>'}
    </div></details>`;

  const goTests = $app.querySelector('#go-tests');
  if (goTests) {
    goTests.addEventListener('click', () => {
      autoStartTests = true;
      location.hash = '#/tests';
    });
  }
}

function logLine(s) {
  const r = ROUTINES[s.routine];
  const name = r ? r.name : s.routine;
  const flag = s.routine === 'off' ? 'off day' : s.completed ? (s.routine === 'min' ? 'minimum' : 'done') : `partial ${s.exercisesCompleted}/${s.exercisesTotal}`;
  const chunk = s.longestSquatChunk ? ` · hang ${formatClock(s.longestSquatChunk)}` : '';
  return `<li><span>${esc(s.date)} · ${esc(name)}</span><span class="muted">${formatClock(s.durationSeconds || 0)} · ${esc(flag)}${chunk}</span></li>`;
}

// ---------------------------------------------------------------------------
// Routine pages: overview -> session screen -> end screen
// ---------------------------------------------------------------------------

function viewRoutine(id) {
  const r = ROUTINES[id];
  if (!r) return viewNotFound();
  if (activeSession && activeSession.routineId === id) return buildSessionScreen();
  if (lastSummary && lastSummary.routineId === id) return renderEndScreen(id);
  return renderRoutineOverview(id);
}

function renderRoutineOverview(id) {
  const r = ROUTINES[id];
  const phases = expandRoutine(r, settingsOpts());
  const planned = plannedSeconds(phases);
  const busy = !!activeSession;
  const exercises = r.exercises
    .map(
      (ex) => `<li>
        <div class="ex-name">${esc(ex.id)} · ${esc(ex.name)}</div>
        <div class="ex-dose">${esc(ex.dose)}. ${esc(ex.intensity)}</div>
        <div class="muted small">${esc(NOTCHES[ex.notch].label)}: ${esc(notchDisplay(ex.notch, state.notches[ex.notch]))}</div>
      </li>`
    )
    .join('');
  const note =
    id === 'min'
      ? '<p class="muted">Counts as a completed day in the week tracker, marked minimum. 5 s side switches, 10 s transitions.</p>'
      : id === 'off'
        ? '<p class="muted">Shows in the log but does not count toward the 4 per week.</p>'
        : `<p class="muted">Scheduled ${esc(r.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(' and '))}.</p>`;

  $app.innerHTML = `
    <header class="page-header"><div><h1>${esc(r.name)}</h1><div class="sub">${esc(r.focus)} · about ${Math.round(planned / 60)} min (${formatClock(planned)} planned)</div></div><a class="btn btn-small" href="#/">Home</a></header>
    ${busy ? activeBannerHtml() : `<button class="btn btn-primary btn-huge btn-block" id="start-session">Start ${esc(r.name)}</button>`}
    <section class="card" style="margin-top:12px">
      ${note}
      <ol class="ex-list">${exercises}</ol>
    </section>
    <details class="section"><summary>Rules</summary><div class="section-body"><ul>${RULES.map((x) => `<li><strong>${esc(x.title)}:</strong> ${esc(x.text)}</li>`).join('')}</ul></div></details>
    <p class="muted small">Space: start/pause. Arrow right: skip phase. Arrow left: back one phase. Arrow up: +15 s.</p>`;
  const start = $app.querySelector('#start-session');
  if (start) start.addEventListener('click', () => startSession(id));
}

function startSession(routineId) {
  if (activeSession) return;
  audio.unlock();
  const routine = ROUTINES[routineId];
  const phases = expandRoutine(routine, settingsOpts());
  const engine = new SessionEngine(phases);
  const s = { routineId, routine, phases, engine, interval: null, dom: null, builtIndex: -1, confirmEnd: false };
  activeSession = s;
  lastSummary = null;
  engine.on((type, data) => {
    if (activeSession !== s) return;
    if (type === 'cue') audio.cue(data.cue);
    else if (type === 'phase') {
      if (sessionViewVisible()) buildSessionScreen();
    } else if (type === 'finish') finishSession(data);
  });
  engine.start();
  s.interval = setInterval(() => {
    if (activeSession !== s) return;
    engine.tick();
    if (activeSession === s) updateSessionScreen();
  }, 200);
  wake.request();
  render();
}

function finishSession(summary) {
  const s = activeSession;
  if (!s) return;
  clearInterval(s.interval);
  wake.release();
  let record = null;
  if (summary.exercisesCompleted > 0) {
    record = S.recordSession(state, s.routineId, summary, s.engine.startedAt);
    save();
  }
  if (summary.completed) {
    audio.beep('long');
    audio.vibrate('long');
    audio.speak('Session complete.');
  }
  lastSummary = { routineId: s.routineId, summary, record };
  activeSession = null;
  render();
}

function metaLine(phase) {
  const m = phase.meta || {};
  if (phase.kind === 'setup') return 'Setup';
  const parts = [];
  if (m.exerciseCount) {
    parts.push(`${phase.kind === 'exercise' ? 'Next: exercise' : 'Exercise'} ${m.exerciseIndex + 1} of ${m.exerciseCount}`);
  }
  if (m.sets > 1) parts.push(`Set ${m.set} of ${m.sets}`);
  if (m.side) parts.push(sideName(m.side));
  return parts.join(' · ');
}

function buildSessionScreen() {
  const s = activeSession;
  if (!s) return;
  const snap = s.engine.snapshot();
  const phase = snap.phase;
  if (!phase) return;
  const root = el(`<section class="session" data-type="${esc(phase.type)}" data-kind="${esc(phase.kind || '')}" data-segment="${esc(snap.segment ? snap.segment.segment : '')}"></section>`);
  root.appendChild(
    el(`<header class="session-header">
      <div class="session-meta">${esc(metaLine(phase))}</div>
      <div class="progress session-progress" aria-hidden="true"><span></span></div>
      <div class="session-eta"><span class="eta"></span><span class="routine-name">${esc(s.routine.name)}</span></div>
    </header>`)
  );
  const body = el('<div class="session-body"></div>');
  if (phase.type === 'transition') buildTransitionBody(body, phase);
  else buildWorkBody(body, phase);
  root.appendChild(body);
  root.appendChild(buildControls(phase));
  $app.innerHTML = '';
  $app.appendChild(root);
  document.body.classList.add('in-session');
  s.dom = {
    root,
    progress: root.querySelector('.session-progress > span'),
    eta: root.querySelector('.eta'),
    digits: root.querySelector('.timer-digits'),
    phaseName: root.querySelector('.phase-name'),
    instruction: root.querySelector('.instruction'),
    sub: root.querySelector('.timer-sub'),
    phaseProgress: root.querySelector('.phase-progress > span'),
    toggle: root.querySelector('.ctl-toggle'),
  };
  s.builtIndex = snap.index;
  s.confirmEnd = false;
  updateSessionScreen(snap);
}

function buildWorkBody(body, phase) {
  const m = phase.meta || {};
  body.innerHTML = `
    <div class="exercise-name">${esc(m.exerciseName || '')}${m.side ? ` · ${esc(sideName(m.side))}` : ''}</div>
    <div class="phase-name"></div>
    <div class="timer-digits" role="timer" aria-live="off"></div>
    <div class="timer-sub"></div>
    <div class="phase-progress" aria-hidden="true"><span></span></div>
    <p class="instruction"></p>`;
}

function buildTransitionBody(body, phase) {
  const next = phase.next;
  const m = phase.meta || {};
  let nextHtml = '';
  if (next) {
    nextHtml = `<h2 class="next-name">${esc(next.name)}</h2>
      <p class="instruction">${esc(next.setup)}</p>
      <p class="muted">${esc(next.dose)}${next.intensity ? ` · ${esc(next.intensity)}` : ''}</p>
      ${next.notch ? notchControlHtml(next.notch) : ''}`;
  } else {
    nextHtml = `<h2 class="next-name">${esc(m.exerciseName || '')}${m.side ? ` · ${esc(sideName(m.side))}` : ''}</h2>
      <p class="instruction">${esc(phase.instruction)}</p>`;
  }
  body.innerHTML = `
    <div class="phase-name">${esc(phase.label)}</div>
    <div class="timer-digits" role="timer" aria-live="off"></div>
    <div class="phase-progress" aria-hidden="true"><span></span></div>
    ${nextHtml}`;
  if (next && next.notch) wireNotchControl(body, next.notch);
}

function notchControlHtml(key) {
  const def = NOTCHES[key];
  const value = state.notches[key] != null ? state.notches[key] : def.default;
  const hint = def.levels ? Object.entries(def.levels).map(([k, v]) => `${k} = ${v}`).join(', ') + (def.hint ? `. ${def.hint}` : '') : def.hint || '';
  return `<div class="notch-control" data-notch="${esc(key)}">
    <div class="notch-label">${esc(def.name)} notch: ${esc(def.label)}</div>
    <div class="notch-row">
      <button class="btn notch-minus" aria-label="Decrease ${esc(def.label)}">&minus;</button>
      <div class="notch-value">${esc(notchDisplay(key, value))}</div>
      <button class="btn notch-plus" aria-label="Increase ${esc(def.label)}">+</button>
    </div>
    <div class="muted small notch-hint">${esc(hint)}</div>
  </div>`;
}

function wireNotchControl(root, key) {
  const box = root.querySelector(`.notch-control[data-notch="${key}"]`);
  if (!box) return;
  const refresh = () => {
    const fresh = el(notchControlHtml(key));
    box.replaceWith(fresh);
    wireNotchControl(root, key);
  };
  box.querySelector('.notch-minus').addEventListener('click', () => {
    S.adjustNotch(state, key, -1);
    save();
    refresh();
  });
  box.querySelector('.notch-plus').addEventListener('click', () => {
    S.adjustNotch(state, key, 1);
    save();
    refresh();
  });
}

function buildControls(phase) {
  const wrap = el('<div class="controls-wrap"></div>');
  if (phase.type === 'transition') {
    wrap.innerHTML = `<div class="controls"><button class="btn btn-primary btn-huge ctl-skip">Start now</button></div>
      <div class="controls-secondary">
      <button class="btn ctl-back" aria-label="Back one phase">Back</button>
      <button class="btn ctl-toggle">Pause</button>
      <button class="btn ctl-add">+15 s</button>
      <button class="btn ctl-end">End</button></div>`;
  } else {
    const skipLabel = phase.type === 'accumulate' ? 'Finish hang' : 'Skip';
    wrap.innerHTML = `<div class="controls">
      <button class="btn ctl-back" aria-label="Back one phase">Back</button>
      <button class="btn btn-primary btn-huge ctl-toggle">Pause</button>
      <button class="btn ctl-skip" aria-label="Skip phase">${skipLabel}</button></div>
      <div class="controls-secondary">
      <button class="btn ctl-add">+15 s</button>
      <button class="btn ctl-end">End session</button></div>`;
  }
  const act = (fn) => (e) => {
    const s = activeSession;
    if (!s) return;
    fn(s.engine, e.currentTarget);
    if (activeSession === s) updateSessionScreen();
  };
  bind(wrap, '.ctl-back', 'click', act((eng) => eng.back()));
  bind(wrap, '.ctl-skip', 'click', act((eng) => eng.skip()));
  bind(wrap, '.ctl-toggle', 'click', act((eng) => eng.toggle()));
  bind(wrap, '.ctl-add', 'click', act((eng) => eng.addSeconds(15)));
  bind(wrap, '.ctl-end', 'click', (e) => confirmEnd(e.currentTarget));
  return wrap;
}

function confirmEnd(btn) {
  const s = activeSession;
  if (!s) return;
  if (s.confirmEnd) {
    s.confirmEnd = false;
    s.engine.end();
    return;
  }
  s.confirmEnd = true;
  btn.textContent = 'Tap again to end';
  btn.classList.add('confirm');
  setTimeout(() => {
    if (activeSession === s && s.confirmEnd) {
      s.confirmEnd = false;
      if (btn.isConnected) {
        btn.textContent = 'End session';
        btn.classList.remove('confirm');
      }
    }
  }, 3000);
}

function updateSessionScreen(snap) {
  const s = activeSession;
  if (!s || !s.dom || !s.dom.root.isConnected || !sessionViewVisible()) return;
  snap = snap || s.engine.snapshot();
  if (snap.index !== s.builtIndex) return buildSessionScreen();
  const d = s.dom;
  const phase = snap.phase;
  const paused = snap.status === 'paused';
  d.root.classList.toggle('paused', paused);
  if (snap.segment) d.root.dataset.segment = snap.segment.segment;
  d.progress.style.width = `${Math.min(100, snap.progress * 100).toFixed(1)}%`;
  d.eta.textContent = minutesLeft(snap.remainingTotal);
  if (d.phaseProgress) {
    const frac = phase.type === 'accumulate' ? snap.accumulate.accumulated / snap.accumulate.target : snap.duration ? snap.elapsed / snap.duration : 0;
    d.phaseProgress.style.width = `${Math.min(100, frac * 100).toFixed(1)}%`;
  }
  if (d.toggle) d.toggle.textContent = paused ? 'Resume' : 'Pause';

  if (phase.type === 'transition') {
    d.digits.textContent = formatClock(snap.remaining);
    if (d.phaseName) d.phaseName.textContent = paused ? 'Paused' : phase.label;
    return;
  }
  if (phase.type === 'accumulate') {
    const a = snap.accumulate;
    d.digits.textContent = clockUp(a.accumulated);
    d.phaseName.textContent = paused ? 'Paused' : 'Squat hang';
    d.sub.textContent = `of ${formatClock(a.target)} · chunk ${clockUp(a.currentChunk)} · longest ${clockUp(a.longestChunk)}`;
    d.instruction.textContent = paused ? 'Chunk reset. Resume when you are back in the squat.' : snap.segment.say || phase.instruction;
    return;
  }
  if (phase.type === 'reps') {
    d.digits.textContent = `${snap.rep.current}/${snap.rep.total}`;
    d.phaseName.textContent = paused ? 'Paused' : snap.segment.label;
    d.sub.textContent = `Rep ${snap.rep.current} of ${snap.rep.total} · ${formatClock(snap.remaining)} left`;
    d.instruction.textContent = phase.instruction;
    return;
  }
  // hold
  d.digits.textContent = formatClock(snap.remaining);
  d.phaseName.textContent = paused ? 'Paused' : snap.segment.label;
  d.sub.textContent = `${formatClock(snap.duration)} hold`;
  d.instruction.textContent = snap.segment.say || phase.instruction;
}

function renderEndScreen(id) {
  const { summary, record } = lastSummary;
  const r = ROUTINES[id];
  const d = now();
  const ws = S.weekSummary(state, d);
  const title = summary.completed ? `${r.name} complete` : `${r.name} ended early`;
  let note = '';
  if (id === 'min' && summary.completed) note = '<p>Counted as a completed day (minimum).</p>';
  if (id === 'off') note = '<p class="muted">Logged. Off-day hangs do not count toward the 4 per week.</p>';
  if (!record) note += '<p class="muted">Nothing was logged: no exercise was completed.</p>';
  $app.innerHTML = `
    <section class="card end-screen">
      <h1>${esc(title)}</h1>
      <dl class="stats">
        <dt>Total time</dt><dd>${formatClock(summary.durationSeconds)}</dd>
        <dt>Exercises completed</dt><dd>${summary.exercisesCompleted} of ${summary.exercisesTotal}</dd>
        ${summary.longestSquatChunk ? `<dt>Longest squat chunk</dt><dd>${formatClock(summary.longestSquatChunk)}</dd>` : ''}
        <dt>Week progress</dt><dd>${ws.completed} of ${ws.target}</dd>
      </dl>
      ${dotsHtml(ws.days)}
      ${note}
      <p style="margin-top:12px"><strong>${esc(S.nextSessionLine(d))}</strong></p>
      <div class="stack" style="margin-top:12px">
        <a class="btn btn-primary btn-big btn-block" href="#/" id="end-home">Home</a>
        <button class="btn btn-block" id="end-again">Start ${esc(r.name)} again</button>
      </div>
    </section>`;
  $app.querySelector('#end-home').addEventListener('click', () => {
    lastSummary = null;
  });
  $app.querySelector('#end-again').addEventListener('click', () => {
    lastSummary = null;
    render();
  });
}

// ---------------------------------------------------------------------------
// Mini timers (desk bouts, squat hang, hamstring, test walk)
// ---------------------------------------------------------------------------

function miniHold(seconds, label, say, side) {
  return {
    type: 'hold',
    seconds,
    label,
    instruction: '',
    cues: [{ at: 0, say, label, segment: 'accumulate', sound: 'single', vibrate: 'single' }],
    meta: { exerciseIndex: 0, exerciseCount: 1, exerciseId: 'mini', exerciseName: label, notch: null, side: side || null, set: 1, sets: 1 },
  };
}

function miniSwitch(seconds) {
  return {
    type: 'transition',
    kind: 'side',
    seconds,
    label: 'Switch sides',
    instruction: 'Switch sides',
    cues: [{ at: 0, say: 'Switch sides', label: 'Switch sides', segment: 'transition', sound: 'double', vibrate: 'double' }],
    meta: { exerciseIndex: 0, exerciseCount: 1, exerciseId: 'mini', exerciseName: 'Switch sides', notch: null, side: null, set: 1, sets: 1 },
  };
}

function startMiniTimer({ id, label, phases, doneSay, onDone }) {
  stopMiniTimer();
  audio.unlock();
  const engine = new SessionEngine(phases);
  const mt = { id, label, engine, interval: null };
  miniTimer = mt;
  engine.on((type, data) => {
    if (type === 'cue') audio.cue(data.cue);
    else if (type === 'finish') {
      clearInterval(mt.interval);
      if (miniTimer === mt) miniTimer = null;
      wake.release();
      if (!data.endedEarly) {
        audio.beep('long');
        audio.vibrate('long');
        if (doneSay) audio.speak(doneSay);
        if (onDone) onDone();
      }
      render();
    }
  });
  engine.start();
  mt.interval = setInterval(() => {
    engine.tick();
    if (miniTimer === mt) renderMiniTimer();
  }, 200);
  wake.request();
  render();
}

function stopMiniTimer() {
  if (!miniTimer) return;
  const mt = miniTimer;
  miniTimer = null;
  clearInterval(mt.interval);
  mt.engine.end();
  wake.release();
}

function renderMiniTimer() {
  const box = document.getElementById('mini-timer');
  if (!box) return;
  if (!miniTimer) {
    box.innerHTML = '';
    return;
  }
  const snap = miniTimer.engine.snapshot();
  if (!snap.phase) return;
  let widget = box.querySelector('.mini-timer');
  if (!widget || widget.dataset.id !== miniTimer.id) {
    box.innerHTML = `<div class="mini-timer" data-id="${esc(miniTimer.id)}">
      <div class="label">${esc(miniTimer.label)}</div>
      <div class="phase"></div>
      <div class="digits" role="timer"></div>
      <div class="grid-2"><button class="btn mini-toggle">Pause</button><button class="btn btn-danger mini-stop">Stop</button></div>
    </div>`;
    widget = box.querySelector('.mini-timer');
    widget.querySelector('.mini-toggle').addEventListener('click', () => {
      if (!miniTimer) return;
      miniTimer.engine.toggle();
      renderMiniTimer();
    });
    widget.querySelector('.mini-stop').addEventListener('click', () => {
      stopMiniTimer();
      render();
    });
  }
  widget.querySelector('.digits').textContent = formatClock(snap.remaining);
  widget.querySelector('.phase').textContent = snap.status === 'paused' ? 'Paused' : snap.phase.label;
  widget.querySelector('.mini-toggle').textContent = snap.status === 'paused' ? 'Resume' : 'Pause';
}

// ---------------------------------------------------------------------------
// Desk
// ---------------------------------------------------------------------------

function viewDesk() {
  const d = now();
  const key = todayKey();
  const week = S.programWeek(state, d);
  const phase = S.deskPhaseForWeek(week);
  const day = S.deskDay(state, key);
  const totals = S.deskWeekTotals(state, d);
  const pct = Math.min(100, Math.round((day.slantMinutes / phase.dailyTargetMinutes) * 100));

  $app.innerHTML = `
    <header class="page-header"><h1>Desk</h1><span class="sub">${esc(S.formatShortDate(d))}${week ? ` · week ${week}` : ''}</span></header>
    ${activeBannerHtml()}
    <div id="mini-timer"></div>
    <section class="card">
      <h2>Desk phase: ${esc(phase.weeks)}</h2>
      <p>${esc(phase.text)}</p>
      <details class="section" style="margin:8px 0 0"><summary>All phases</summary><div class="section-body"><ul>${DESK_PHASES.map(
        (p) => `<li><strong>${esc(p.weeks)}:</strong> ${esc(p.text)}</li>`
      ).join('')}</ul></div></details>
    </section>
    <section class="card">
      <h2>Slant board</h2>
      <div class="big-number">${day.slantMinutes} <small>min today of ${phase.dailyTargetMinutes} (${esc(phase.targetLabel)})</small></div>
      <div class="progress" style="margin:10px 0"><span style="width:${pct}%"></span></div>
      <div class="grid-3">${[2, 3, 5].map((n) => `<button class="btn btn-big btn-num" data-slant="${n}" aria-label="Add ${n} minutes">+${n}</button>`).join('')}</div>
      <div class="row between" style="margin-top:10px"><span class="muted small">This week: ${totals.slantMinutes} min</span><button class="btn btn-small btn-ghost" data-slant="-1">&minus;1 min</button></div>
      <h3 style="margin-top:14px">Bout timer</h3>
      <div class="grid-2"><button class="btn" data-bout="3">3 min bout</button><button class="btn" data-bout="5">5 min bout</button></div>
      <p class="muted small" style="margin-top:6px">Beeps at the end and logs the minutes.</p>
    </section>
    <section class="card">
      <h2>Squat hang</h2>
      <div class="big-number">${day.squatHangs} <small>today · target ${esc(DESK_SQUAT.target)}</small></div>
      <div class="grid-2" style="margin-top:10px"><button class="btn btn-big btn-num" id="hang-plus" aria-label="Add one squat hang">+1</button><button class="btn btn-big" id="hang-timer">90 s timer</button></div>
      <div class="row between" style="margin-top:10px"><span class="muted small">${esc(DESK_SQUAT.note)} This week: ${totals.squatHangs}.</span><button class="btn btn-small btn-ghost" id="hang-minus">&minus;1</button></div>
    </section>
    <section class="card">
      <h2>Hamstring desk hold</h2>
      <p>${esc(DESK_HAMSTRING.note)}</p>
      <div class="grid-2">
        <button class="btn btn-big" id="ham-timer">1 min per side</button>
        <label class="switch" style="border:none"><span>Done today</span><input type="checkbox" id="ham-done" ${day.hamstringDone ? 'checked' : ''}></label>
      </div>
    </section>
    <section class="card"><p class="muted">${esc(DESK_NOTE)}</p></section>`;

  bind($app, '[data-slant]', 'click', (e) => {
    const n = Number(e.currentTarget.dataset.slant);
    const cur = S.deskDay(state, key);
    S.updateDeskDay(state, key, { slantMinutes: cur.slantMinutes + n });
    save();
    render();
  });
  bind($app, '[data-bout]', 'click', (e) => {
    const mins = Number(e.currentTarget.dataset.bout);
    startMiniTimer({
      id: `bout-${mins}`,
      label: `Slant board bout, ${mins} min`,
      phases: [miniHold(mins * 60, `Slant board ${mins} min`, `Slant board bout, ${mins} minutes. Intensity 4 to 6.`)],
      doneSay: 'Bout done.',
      onDone: () => {
        const k = todayKey();
        const cur = S.deskDay(state, k);
        S.updateDeskDay(state, k, { slantMinutes: cur.slantMinutes + mins });
        save();
        toast(`Logged ${mins} min on the slant board.`);
      },
    });
  });
  $app.querySelector('#hang-plus').addEventListener('click', () => {
    const cur = S.deskDay(state, key);
    S.updateDeskDay(state, key, { squatHangs: cur.squatHangs + 1 });
    save();
    render();
  });
  $app.querySelector('#hang-minus').addEventListener('click', () => {
    const cur = S.deskDay(state, key);
    S.updateDeskDay(state, key, { squatHangs: cur.squatHangs - 1 });
    save();
    render();
  });
  $app.querySelector('#hang-timer').addEventListener('click', () => {
    startMiniTimer({
      id: 'hang-90',
      label: 'Squat hang, 90 s',
      phases: [miniHold(DESK_SQUAT.timerSeconds, 'Squat hang', 'Squat hang, 90 seconds. Shift side to side, pry the knees out.')],
      doneSay: 'Hang done.',
      onDone: () => {
        const k = todayKey();
        const cur = S.deskDay(state, k);
        S.updateDeskDay(state, k, { squatHangs: cur.squatHangs + 1 });
        save();
        toast('Squat hang logged.');
      },
    });
  });
  $app.querySelector('#ham-timer').addEventListener('click', () => {
    const sec = DESK_HAMSTRING.secondsPerSide;
    startMiniTimer({
      id: 'ham',
      label: 'Hamstring hold, 1 min per side',
      phases: [
        miniHold(sec, 'Left hamstring', 'Left. Hamstring hold, 1 minute. Flat back, hips square.', 'L'),
        miniSwitch(5),
        miniHold(sec, 'Right hamstring', 'Right. Hamstring hold, 1 minute.', 'R'),
      ],
      doneSay: 'Hamstring done.',
      onDone: () => {
        S.updateDeskDay(state, todayKey(), { hamstringDone: true });
        save();
        toast('Hamstring hold logged.');
      },
    });
  });
  $app.querySelector('#ham-done').addEventListener('change', (e) => {
    S.updateDeskDay(state, key, { hamstringDone: e.currentTarget.checked });
    save();
  });
  renderMiniTimer();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function sparkline(values) {
  if (values.length < 2) return '<span class="muted small">n/a</span>';
  const w = 90;
  const h = 28;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const last = pts[pts.length - 1];
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><polyline points="${pts.map((p) => p.join(',')).join(' ')}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5"/></svg>`;
}

function fmtNum(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function testHistoryHtml(t, metrics) {
  const rows = t.fields
    .map((f) => {
      const m = metrics.find((x) => x.key === f.key);
      const sum = S.metricSummary(state, m);
      const unit = f.unit === '°' ? '°' : ` ${f.unit}`;
      const latest = sum.latest ? `${fmtNum(sum.latest.value)}${unit}` : 'n/a';
      const prev = sum.previous ? `${fmtNum(sum.previous.value)}${unit}` : 'n/a';
      let delta = 'n/a';
      if (sum.delta != null) {
        const cls = sum.delta > 0 ? 'delta-up' : sum.delta < 0 ? 'delta-down' : '';
        delta = `<span class="${cls}">${sum.delta > 0 ? '+' : ''}${fmtNum(sum.delta)}${unit}</span>${
          sum.insideNoise ? `<div class="noise">inside noise (under ${m.noise} cm)</div>` : ''
        }`;
      }
      return `<tr><td>${esc(f.label)}</td><td class="num">${latest}</td><td class="num">${prev}</td><td class="num">${delta}</td><td>${sparkline(sum.history.map((h) => h.value))}</td></tr>`;
    })
    .join('');
  return `<section class="card">
    <div class="card-title-row"><h2>${esc(t.name)}</h2><span class="muted small">Target: ${esc(t.target)}</span></div>
    <p class="muted small">${esc(t.howTo)}</p>
    <div class="table-wrap"><table><thead><tr><th></th><th class="num">Latest</th><th class="num">Previous</th><th class="num">Delta</th><th>Trend</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function guideDetailsHtml(id, open) {
  const sec = guideSection(id);
  if (!sec) return '';
  return `<details class="section"${open ? ' open' : ''}><summary>${esc(sec.title)}</summary><div class="section-body">${renderBlocks(sec.blocks)}</div></details>`;
}

function viewTests() {
  if (autoStartTests) {
    autoStartTests = false;
    if (!testFlow) startTestFlow();
  }
  const d = now();
  const head = `<header class="page-header"><h1>Tests</h1><span class="sub">${esc(S.formatShortDate(d))}</span></header>${activeBannerHtml()}`;
  if (testFlow) {
    $app.innerHTML = head;
    renderTestFlowStep();
    return;
  }
  const next = S.nextTestDate(state, d);
  const hasBaseline = !!S.testStartKey(state);
  const metrics = S.testMetrics();
  const saved = state.tests.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  $app.innerHTML = `${head}
    <section class="card">
      <p>${esc(TEST_SCHEDULE_TEXT)}</p>
      <p class="muted">${hasBaseline ? `Next test: <strong>${esc(next ? S.formatShortDate(next) : 'today')}</strong>.` : 'No baseline yet. Run the first tests on any day; test days then fall every other Monday from that week.'}</p>
      <button class="btn btn-primary btn-big btn-block" id="start-tests">${hasBaseline ? 'Start guided tests' : 'Run the first tests'}</button>
    </section>
    ${TESTS.map((t) => testHistoryHtml(t, metrics)).join('')}
    ${guideDetailsHtml('bone-vs-muscle')}
    ${guideDetailsHtml('right-hip-check')}
    <details class="section"><summary>Saved tests (${saved.length})</summary><div class="section-body">
      ${
        saved.length
          ? `<ul class="log-list">${saved
              .map(
                (t) =>
                  `<li><span>${esc(t.date)}</span><span>${esc(
                    metrics.filter((m) => t[m.key] != null).length
                  )} values <button class="btn btn-small btn-danger" data-del-test="${esc(t.id || t.date)}">Delete</button></span></li>`
              )
              .join('')}</ul>`
          : '<p class="muted">Nothing saved yet.</p>'
      }
    </div></details>`;
  $app.querySelector('#start-tests').addEventListener('click', () => {
    startTestFlow();
    render();
  });
  bind($app, '[data-del-test]', 'click', (e) => {
    const id = e.currentTarget.dataset.delTest;
    if (!window.confirm('Delete this test entry?')) return;
    state.tests = state.tests.filter((t) => (t.id || t.date) !== id);
    save();
    render();
  });
}

function startTestFlow() {
  testFlow = { step: 0, values: {}, date: todayKey(), stopwatch: { running: false, startedAt: 0, seconds: 0, interval: null } };
}

function cancelTestFlow() {
  if (testFlow && testFlow.stopwatch.interval) clearInterval(testFlow.stopwatch.interval);
  if (miniTimer && miniTimer.id === 'walk') stopMiniTimer();
  testFlow = null;
}

function renderTestFlowStep() {
  const f = testFlow;
  const total = TESTS.length + 1;
  const box = el('<div></div>');
  if (f.step === 0) {
    box.innerHTML = `<section class="card">
      <div class="muted">Step 1 of ${total}</div>
      <h2>Walk 2 minutes</h2>
      <p>Optional warm-up before measuring. Same time, shoes off.</p>
      <div id="mini-timer"></div>
      <div class="grid-2"><button class="btn btn-primary btn-big" id="walk-start">Start 2:00 walk</button><button class="btn btn-big" id="walk-skip">Skip walk</button></div>
      <button class="btn btn-ghost btn-small" id="flow-cancel" style="margin-top:10px">Cancel</button>
    </section>`;
    box.querySelector('#walk-start').addEventListener('click', () => {
      startMiniTimer({
        id: 'walk',
        label: 'Warm-up walk',
        phases: [miniHold(120, 'Walk', 'Walk for 2 minutes.')],
        doneSay: 'Walk done. Start the tests.',
        onDone: () => {
          if (testFlow && testFlow.step === 0) testFlow.step = 1;
        },
      });
    });
    box.querySelector('#walk-skip').addEventListener('click', () => {
      if (miniTimer && miniTimer.id === 'walk') stopMiniTimer();
      f.step = 1;
      render();
    });
  } else {
    const t = TESTS[f.step - 1];
    const last = f.step === TESTS.length;
    const metrics = S.testMetrics();
    const fields = t.fields
      .map((fl) => {
        const m = metrics.find((x) => x.key === fl.key);
        const sum = S.metricSummary(state, m);
        const prev = sum.latest ? `Last: ${fmtNum(sum.latest.value)}${fl.unit === '°' ? '°' : ' ' + fl.unit} (${sum.latest.date})` : 'No previous value';
        const v = f.values[fl.key];
        return `<label class="field"><span>${esc(fl.label)} (${esc(fl.unit)})</span><input type="number" inputmode="decimal" step="${esc(fl.step)}" data-key="${esc(fl.key)}" value="${v != null ? esc(v) : ''}"><span class="hint">${esc(prev)}</span></label>`;
      })
      .join('');
    const sw = t.stopwatch
      ? `<div class="stopwatch card" style="margin-bottom:12px"><div class="digits" id="sw-digits">${formatClock(f.stopwatch.seconds)}</div><button class="btn" id="sw-toggle">${f.stopwatch.running ? 'Stop' : 'Start'}</button><button class="btn btn-ghost" id="sw-reset">Reset</button><span class="muted small">Stop fills the hold field.</span></div>`
      : '';
    box.innerHTML = `<section class="card">
      <div class="muted">Step ${f.step + 1} of ${total}</div>
      <h2>${esc(t.name)}</h2>
      <p>${esc(t.howTo)}</p>
      <p><strong>Target:</strong> ${esc(t.target)}</p>
      ${sw}
      ${fields}
      <div class="grid-2" style="margin-top:8px"><button class="btn" id="flow-back">Back</button><button class="btn btn-primary btn-big" id="flow-next">${last ? 'Save tests' : 'Next'}</button></div>
      <button class="btn btn-ghost btn-small" id="flow-cancel" style="margin-top:10px">Cancel</button>
    </section>`;
    bind(box, 'input[data-key]', 'input', (e) => {
      f.values[e.currentTarget.dataset.key] = e.currentTarget.value;
    });
    box.querySelector('#flow-back').addEventListener('click', () => {
      f.step -= 1;
      render();
    });
    box.querySelector('#flow-next').addEventListener('click', () => {
      if (last) saveTestFlow();
      else {
        f.step += 1;
        render();
      }
    });
    if (t.stopwatch) wireStopwatch(box, t.stopwatch);
  }
  box.querySelector('#flow-cancel').addEventListener('click', () => {
    cancelTestFlow();
    render();
  });
  $app.appendChild(box);
  renderMiniTimer();
}

function wireStopwatch(root, key) {
  const f = testFlow;
  const sw = f.stopwatch;
  const digits = root.querySelector('#sw-digits');
  const toggle = root.querySelector('#sw-toggle');
  const paint = () => {
    const secs = sw.running ? sw.seconds + (Date.now() - sw.startedAt) / 1000 : sw.seconds;
    if (digits.isConnected) digits.textContent = clockUp(secs);
  };
  if (sw.running && !sw.interval) sw.interval = setInterval(paint, 200);
  toggle.addEventListener('click', () => {
    if (sw.running) {
      sw.seconds += (Date.now() - sw.startedAt) / 1000;
      sw.running = false;
      clearInterval(sw.interval);
      sw.interval = null;
      const val = Math.round(sw.seconds);
      f.values[key] = String(val);
      const input = root.querySelector(`input[data-key="${key}"]`);
      if (input) input.value = String(val);
      toggle.textContent = 'Start';
    } else {
      audio.unlock();
      sw.startedAt = Date.now();
      sw.running = true;
      sw.interval = setInterval(paint, 200);
      toggle.textContent = 'Stop';
    }
    paint();
  });
  root.querySelector('#sw-reset').addEventListener('click', () => {
    sw.running = false;
    sw.seconds = 0;
    clearInterval(sw.interval);
    sw.interval = null;
    toggle.textContent = 'Start';
    paint();
  });
}

function saveTestFlow() {
  const f = testFlow;
  const hasValue = Object.values(f.values).some((v) => v !== '' && v != null && Number.isFinite(Number(v)));
  if (!hasValue) {
    toast('Enter at least one measurement before saving.');
    return;
  }
  S.recordTest(state, f.date, f.values);
  save();
  cancelTestFlow();
  toast('Tests saved.');
  render();
}

// ---------------------------------------------------------------------------
// Guide
// ---------------------------------------------------------------------------

function renderBlocks(blocks) {
  return blocks
    .map((b) => {
      if (b.t === 'p') return `<p>${inline(b.text)}</p>`;
      if (b.t === 'h') return `<h3>${inline(b.text)}</h3>`;
      if (b.t === 'ul' || b.t === 'ol') return `<${b.t}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${b.t}>`;
      if (b.t === 'table') {
        return `<div class="table-wrap"><table><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`;
      }
      return '';
    })
    .join('');
}

function glanceHtml() {
  const sessions = ['A', 'B', 'min'].map((id) => {
    const r = ROUTINES[id];
    const planned = plannedSeconds(expandRoutine(r, settingsOpts()));
    const days = id === 'min' ? 'Any day, when the full session will not happen' : r.days.map((d) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(' and ');
    return `<h3>${esc(r.name)}: ${esc(r.focus)}</h3><p class="muted small">${esc(days)}. About ${Math.round(planned / 60)} min with transitions.</p><ol>${r.exercises
      .map((ex) => `<li><strong>${esc(ex.name)}.</strong> ${esc(ex.dose)}. ${esc(ex.intensity)} Notch: ${esc(ex.notchNote)}</li>`)
      .join('')}</ol>`;
  });
  return `${sessions.join('')}
    <h3>Off days (Friday to Sunday)</h3><p>Optional 3:00 squat hang. Logged, but it does not count toward the 4 sessions per week.</p>
    <h3>Tests</h3><p>${esc(TEST_SCHEDULE_TEXT)} Six tests, about 5 minutes. See the Tests page.</p>
    <h3>Cue timelines</h3><ul>
      <li>Every session opens with a 30 s setup (mat out, kettlebell ready, shoes off), skippable.</li>
      <li>Side switches are 10 s ("Switch sides", double beep); exercise transitions 20 s, open with a long beep for the finished exercise, and read the next setup aloud. Minimum uses 5 s and 10 s.</li>
      <li>Contract-relax cues arrive at the listed times; the on-screen phase name changes between Settle, Contract and Sink.</li>
      <li>Apply the progression rule yourself: adjust the notch with the + and - buttons on each transition screen.</li>
    </ul>`;
}

function viewGuide() {
  $app.innerHTML = `
    <header class="page-header"><h1>Guide</h1><div class="row"><button class="btn btn-small" id="expand-all">Expand all</button><button class="btn btn-small" id="collapse-all">Collapse all</button></div></header>
    ${activeBannerHtml()}
    <section class="card"><h2>Rules</h2><ul>${RULES.map((r) => `<li><strong>${esc(r.title)}:</strong> ${esc(r.text)}</li>`).join('')}</ul></section>
    <details class="section"><summary>Program at a glance</summary><div class="section-body">${glanceHtml()}</div></details>
    ${GUIDE.map((sec) => `<details class="section" id="guide-${esc(sec.id)}"><summary>${esc(sec.title)}</summary><div class="section-body">${renderBlocks(sec.blocks)}</div></details>`).join('')}
    <p class="muted small">Source: docs/program.md in the repository.</p>`;
  $app.querySelector('#expand-all').addEventListener('click', () => $app.querySelectorAll('details').forEach((d) => (d.open = true)));
  $app.querySelector('#collapse-all').addEventListener('click', () => $app.querySelectorAll('details').forEach((d) => (d.open = false)));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function viewSettings() {
  const s = state.settings;
  const derivedStart = S.programStartKey(state);
  const derivedTest = S.testStartKey(state);
  $app.innerHTML = `
    <header class="page-header"><h1>Settings</h1></header>
    ${activeBannerHtml()}
    <section class="card">
      <h2>Session</h2>
      <label class="field"><span>Kettlebell (kg)</span><input type="number" id="set-kb" inputmode="decimal" min="0" step="1" value="${esc(s.kettlebellKg)}"><span class="hint">Shown in the soleus and squat-hang setup text.</span></label>
      <label class="field"><span>Side-switch seconds</span><input type="number" id="set-side" inputmode="numeric" min="3" max="120" value="${esc(s.sideSwitchSeconds)}"><span class="hint">Default 10. Minimum always uses 5.</span></label>
      <label class="field"><span>Exercise-transition seconds</span><input type="number" id="set-ex" inputmode="numeric" min="3" max="180" value="${esc(s.exerciseTransitionSeconds)}"><span class="hint">Default 20. Minimum always uses 10.</span></label>
    </section>
    <section class="card">
      <h2>Cues</h2>
      <label class="switch"><span>Voice</span><input type="checkbox" id="set-voice" ${s.voice ? 'checked' : ''}></label>
      <label class="switch"><span>Beeps</span><input type="checkbox" id="set-beeps" ${s.beeps ? 'checked' : ''}></label>
      <label class="switch"><span>Vibration</span><input type="checkbox" id="set-vib" ${s.vibration ? 'checked' : ''}></label>
      <button class="btn" id="test-cues" style="margin-top:10px">Test beep, voice and vibration</button>
    </section>
    <section class="card">
      <h2>Appearance</h2>
      <label class="field"><span>Theme</span><select id="set-theme">
        <option value="system"${s.theme === 'system' ? ' selected' : ''}>System</option>
        <option value="dark"${s.theme === 'dark' ? ' selected' : ''}>Dark</option>
        <option value="light"${s.theme === 'light' ? ' selected' : ''}>Light</option>
      </select></label>
    </section>
    <section class="card">
      <h2>Dates</h2>
      <label class="field"><span>Program start date</span><input type="date" id="set-pstart" value="${esc(s.programStart || '')}"><span class="hint">Blank = first completed session${derivedStart && !s.programStart ? ` (${esc(derivedStart)})` : ''}. Drives the week number and the desk phase.</span></label>
      <label class="field"><span>Test start date</span><input type="date" id="set-tstart" value="${esc(s.testStart || '')}"><span class="hint">Blank = first saved test${derivedTest && !s.testStart ? ` (${esc(derivedTest)})` : ''}. Test days fall every other Monday from that week.</span></label>
    </section>
    <section class="card">
      <h2>Notches</h2>
      <p class="muted small">Current values, also editable on each transition screen.</p>
      ${Object.keys(NOTCHES).map((k) => notchControlHtml(k)).join('')}
    </section>
    <section class="card">
      <h2>Data</h2>
      <div class="grid-2"><button class="btn" id="export">Export JSON</button><button class="btn" id="import">Import JSON</button></div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <button class="btn btn-danger btn-block" id="reset" style="margin-top:10px">Reset all data</button>
      <p class="muted small" style="margin-top:8px">Everything lives in this browser's localStorage under "stretch.v1". No backend, no accounts.</p>
    </section>
    <section class="card">
      <h2>About</h2>
      <dl class="stats"><dt>App version</dt><dd>${esc(APP_VERSION)}</dd><dt>Cache version</dt><dd id="cache-version">${esc(swCacheVersion || 'not registered')}</dd><dt>Source</dt><dd><a href="${REPO_URL}">GitHub</a></dd></dl>
    </section>`;

  const num = (id, key, min, max) => {
    $app.querySelector(id).addEventListener('change', (e) => {
      let v = Number(e.currentTarget.value);
      if (!Number.isFinite(v)) v = S.DEFAULT_SETTINGS[key];
      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);
      state.settings[key] = v;
      e.currentTarget.value = String(v);
      save();
    });
  };
  num('#set-kb', 'kettlebellKg', 0, 200);
  num('#set-side', 'sideSwitchSeconds', 3, 120);
  num('#set-ex', 'exerciseTransitionSeconds', 3, 180);
  const flag = (id, key) => {
    $app.querySelector(id).addEventListener('change', (e) => {
      state.settings[key] = e.currentTarget.checked;
      save();
    });
  };
  flag('#set-voice', 'voice');
  flag('#set-beeps', 'beeps');
  flag('#set-vib', 'vibration');
  $app.querySelector('#test-cues').addEventListener('click', () => {
    audio.unlock();
    setTimeout(() => audio.cue({ sound: 'double', vibrate: 'double', say: 'Voice check. Switch sides.' }), 50);
  });
  $app.querySelector('#set-theme').addEventListener('change', (e) => {
    state.settings.theme = e.currentTarget.value;
    save();
    applyTheme();
  });
  const dateField = (id, key) => {
    $app.querySelector(id).addEventListener('change', (e) => {
      const v = e.currentTarget.value;
      state.settings[key] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
      save();
      render();
    });
  };
  dateField('#set-pstart', 'programStart');
  dateField('#set-tstart', 'testStart');
  Object.keys(NOTCHES).forEach((k) => wireNotchControl($app, k));
  $app.querySelector('#export').addEventListener('click', exportData);
  const fileInput = $app.querySelector('#import-file');
  $app.querySelector('#import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = S.importJSON(String(reader.result));
        if (!window.confirm(`Replace all current data with this file (${imported.sessions.length} sessions, ${imported.tests.length} tests)?`)) return;
        state = imported;
        save();
        applyTheme();
        toast('Import complete.');
        render();
      } catch (e) {
        toast('That file is not a Stretch export.');
      }
    };
    reader.readAsText(file);
  });
  $app.querySelector('#reset').addEventListener('click', () => {
    if (!window.confirm('Delete all sessions, tests, desk logs, notches and settings on this device? This cannot be undone.')) return;
    try {
      localStorage.removeItem(S.STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    state = S.defaultState();
    save();
    applyTheme();
    toast('All data reset.');
    render();
  });
  queryCacheVersion();
}

function exportData() {
  try {
    const blob = new Blob([S.exportJSON(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stretch-export-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  } catch (e) {
    toast('Export failed in this browser.');
  }
}

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

function queryCacheVersion() {
  if (!('serviceWorker' in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;
  try {
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => {
      if (e.data && e.data.cacheVersion) {
        swCacheVersion = e.data.cacheVersion;
        const node = document.getElementById('cache-version');
        if (node) node.textContent = swCacheVersion;
      }
    };
    controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  } catch (e) {
    /* ignore */
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const go = () => {
    navigator.serviceWorker
      .register('sw.js')
      .then(() => queryCacheVersion())
      .catch(() => {});
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) {
        toast('App updated. Reload to use the new version.', { actionLabel: 'Reload', onAction: () => location.reload(), ms: 15000 });
      }
      hadController = true;
      queryCacheVersion();
    });
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
}

// ---------------------------------------------------------------------------
// Global events
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (!activeSession || !sessionViewVisible()) return;
  const tag = e.target && e.target.tagName ? e.target.tagName : '';
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tag) && (e.code === 'Space' || e.key === ' ')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  const eng = activeSession.engine;
  if (e.code === 'Space' || e.key === ' ') eng.toggle();
  else if (e.key === 'ArrowRight') eng.skip();
  else if (e.key === 'ArrowLeft') eng.back();
  else if (e.key === 'ArrowUp') eng.addSeconds(15);
  else return;
  e.preventDefault();
  updateSessionScreen();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (activeSession) {
    activeSession.engine.tick();
    if (activeSession && activeSession.engine.status === 'running') wake.request();
    updateSessionScreen();
  }
  if (miniTimer) {
    miniTimer.engine.tick();
    if (miniTimer && miniTimer.engine.status === 'running') wake.request();
    renderMiniTimer();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (activeSession && activeSession.engine.status !== 'finished') {
    e.preventDefault();
    e.returnValue = '';
  }
});

window.addEventListener('hashchange', render);

applyTheme();
render();
registerServiceWorker();
