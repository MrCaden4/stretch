// state.js
// localStorage state ("stretch.v1"), dates, schedule, week tracker, desk
// phases, suggestions, tests history. Pure functions: no DOM. app.js passes
// `today` in; tests pass fixed dates and a fake storage object.

import { NOTCHES, ROUTINES, DESK_PHASES, TESTS, FEEL_OPTIONS } from './data/routines.js';

export const STORAGE_KEY = 'stretch.v1';
export const STATE_VERSION = 1;

export const DEFAULT_SETTINGS = {
  kettlebellKg: 16,
  voice: true,
  beeps: true,
  vibration: true,
  theme: 'system', // system | dark | light
  sideSwitchSeconds: 10,
  exerciseTransitionSeconds: 20,
  programStart: null, // 'YYYY-MM-DD' or null = first completed session
  testStart: null, // 'YYYY-MM-DD' or null = first saved test
};

export function defaultNotches() {
  const out = {};
  for (const [k, def] of Object.entries(NOTCHES)) out[k] = def.default;
  return out;
}

export function defaultState() {
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    notches: defaultNotches(),
    sessions: [],
    desk: {},
    tests: [],
  };
}

function isObj(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

// Merge a parsed object onto defaults, dropping anything malformed.
export function normalizeState(raw) {
  const base = defaultState();
  if (!isObj(raw)) return base;
  if (isObj(raw.settings)) {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (raw.settings[k] !== undefined) base.settings[k] = raw.settings[k];
    }
  }
  if (isObj(raw.notches)) {
    for (const k of Object.keys(NOTCHES)) {
      const v = Number(raw.notches[k]);
      if (Number.isFinite(v)) base.notches[k] = v;
    }
  }
  if (Array.isArray(raw.sessions)) base.sessions = raw.sessions.filter((s) => isObj(s) && typeof s.date === 'string');
  if (isObj(raw.desk)) base.desk = raw.desk;
  if (Array.isArray(raw.tests)) base.tests = raw.tests.filter((t) => isObj(t) && typeof t.date === 'string');
  return base;
}

function getStorage(storage) {
  if (storage) return storage;
  try {
    return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export function loadState(storage) {
  const st = getStorage(storage);
  if (!st) return defaultState();
  try {
    const raw = st.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state, storage) {
  const st = getStorage(storage);
  if (!st) return false;
  try {
    st.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportJSON(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

// Throws on garbage; returns a normalized state.
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!isObj(parsed)) throw new Error('Not a stretch export');
  if (!isObj(parsed.settings) && !Array.isArray(parsed.sessions)) throw new Error('Not a stretch export');
  return normalizeState(parsed);
}

// ---------------------------------------------------------------------------
// Dates (local time). Keys are 'YYYY-MM-DD'.
// ---------------------------------------------------------------------------

export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key) {
  if (!key || typeof key !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

// Monday of the week containing d.
export function mondayOf(d) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon = 0
  return addDays(x, -dow);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayName(d, short = false) {
  return (short ? WEEKDAYS_SHORT : WEEKDAYS)[d.getDay()];
}

export function formatDate(d, withWeekday = true) {
  const s = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return withWeekday ? `${WEEKDAYS[d.getDay()]}, ${s}` : s;
}

export function formatShortDate(d) {
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

// Mon/Wed -> A, Tue/Thu -> B, Fri-Sun -> off.
export function planForDay(d) {
  const dow = d.getDay();
  if (dow === 1 || dow === 3) return 'A';
  if (dow === 2 || dow === 4) return 'B';
  return 'off';
}

// Next day after `today` with a scheduled A or B session.
export function nextScheduled(today) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    const plan = planForDay(d);
    if (plan === 'A' || plan === 'B') return { date: d, routine: plan, daysAway: i };
  }
  return null;
}

export function nextSessionLine(today) {
  const n = nextScheduled(today);
  if (!n) return '';
  const when = n.daysAway === 1 ? `tomorrow (${weekdayName(n.date)})` : weekdayName(n.date);
  let line = `Next: ${ROUTINES[n.routine].name}, ${when}.`;
  if (n.daysAway > 1) line += ' Off days: optional 3-min squat hang.';
  return line;
}

// ---------------------------------------------------------------------------
// Program week, test days
// ---------------------------------------------------------------------------

export function isCountedSession(s) {
  return s && s.completed && s.routine !== 'off';
}

export function programStartKey(state) {
  if (state.settings.programStart) return state.settings.programStart;
  const dates = state.sessions.filter(isCountedSession).map((s) => s.date).sort();
  return dates[0] || null;
}

// 1-based week number, weeks aligned to Monday. null before the first session.
export function programWeek(state, today) {
  const key = programStartKey(state);
  const start = parseDateKey(key);
  if (!start) return null;
  const diff = daysBetween(mondayOf(start), mondayOf(today));
  return Math.max(1, Math.floor(diff / 7) + 1);
}

export function testStartKey(state) {
  if (state.settings.testStart) return state.settings.testStart;
  const dates = state.tests.map((t) => t.date).sort();
  return dates[0] || null;
}

// Every other Monday from the Monday of the test-start week.
export function isTestDay(state, today) {
  const start = parseDateKey(testStartKey(state));
  if (!start) return false;
  if (today.getDay() !== 1) return false;
  const weeks = Math.floor(daysBetween(mondayOf(start), mondayOf(today)) / 7);
  return weeks >= 0 && weeks % 2 === 0;
}

export function hasTestOn(state, dateKey) {
  return state.tests.some((t) => t.date === dateKey);
}

// Next test Monday on or after today (today itself if it is a test day and
// no test has been saved yet). null without a start date.
export function nextTestDate(state, today) {
  const start = parseDateKey(testStartKey(state));
  if (!start) return null;
  const startMonday = mondayOf(start);
  for (let i = 0; i <= 21; i++) {
    const d = addDays(today, i);
    if (d.getDay() !== 1) continue;
    const weeks = Math.floor(daysBetween(startMonday, d) / 7);
    if (weeks < 0 || weeks % 2 !== 0) continue;
    if (i === 0 && hasTestOn(state, toDateKey(d))) continue;
    return d;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Week tracker
// ---------------------------------------------------------------------------

export function sessionsOn(state, dateKey) {
  return state.sessions.filter((s) => s.date === dateKey);
}

// Mon-Thu dots plus counts for the week containing `today`.
export function weekSummary(state, today) {
  const monday = mondayOf(today);
  const todayKey = toDateKey(today);
  const days = [];
  for (let i = 0; i < 4; i++) {
    const d = addDays(monday, i);
    const key = toDateKey(d);
    const done = sessionsOn(state, key).filter(isCountedSession);
    let status;
    if (done.some((s) => s.routine === 'A' || s.routine === 'B')) status = 'done';
    else if (done.some((s) => s.routine === 'min')) status = 'minimum';
    else if (key < todayKey) status = 'missed';
    else status = 'upcoming';
    days.push({ date: d, key, weekday: WEEKDAYS_SHORT[d.getDay()], plan: planForDay(d), status, isToday: key === todayKey });
  }
  const completedDays = new Set();
  for (let i = 0; i < 7; i++) {
    const key = toDateKey(addDays(monday, i));
    if (sessionsOn(state, key).some(isCountedSession)) completedDays.add(key);
  }
  const desk = deskWeekTotals(state, today);
  return {
    days,
    completed: completedDays.size,
    target: 4,
    deskCalfMinutes: desk.slantMinutes,
    deskSquatHangs: desk.squatHangs,
    nextTest: nextTestDate(state, today),
  };
}

// ---------------------------------------------------------------------------
// Sessions and suggestions
// ---------------------------------------------------------------------------

let idCounter = 0;
export function makeId() {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Build a session record from an engine summary and store it.
export function recordSession(state, routineId, summary, startedAtMs) {
  const start = new Date(startedAtMs);
  const rec = {
    id: makeId(),
    date: toDateKey(start),
    startedAt: start.toISOString(),
    routine: routineId,
    completed: !!summary.completed,
    durationSeconds: summary.durationSeconds,
    exercisesCompleted: summary.exercisesCompleted,
    exercisesTotal: summary.exercisesTotal,
    feels: summary.ratings.map((r) => ({ exerciseId: r.exerciseId, notch: r.notch, rating: r.rating, auto: r.auto })),
    longestSquatChunk: Math.round(summary.longestSquatChunk),
    notches: { ...state.notches },
  };
  state.sessions.push(rec);
  return rec;
}

// Latest rating per notch key, scanning sessions newest first.
export function lastRatings(state) {
  const out = {};
  const sessions = state.sessions.slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  for (const s of sessions) {
    for (const f of s.feels || []) {
      if (f.notch && !(f.notch in out)) out[f.notch] = { rating: f.rating, date: s.date, exerciseId: f.exerciseId };
    }
  }
  return out;
}

export function suggestionFor(state, notchKey) {
  if (!notchKey) return null;
  const last = lastRatings(state)[notchKey];
  if (!last) return null;
  const opt = FEEL_OPTIONS.find((o) => o.id === last.rating);
  if (!opt) return null;
  return { rating: last.rating, ratingLabel: opt.label, text: opt.suggestion, action: opt.action, date: last.date };
}

export function clampNotch(key, value) {
  const def = NOTCHES[key];
  if (!def) return value;
  let v = Number(value);
  if (!Number.isFinite(v)) v = def.default;
  if (def.min != null) v = Math.max(def.min, v);
  if (def.max != null) v = Math.min(def.max, v);
  return v;
}

// direction: 'deeper' | 'easier' | number (raw delta)
export function adjustNotch(state, key, direction) {
  const def = NOTCHES[key];
  if (!def) return state.notches[key];
  let delta;
  if (direction === 'deeper') delta = def.deeper;
  else if (direction === 'easier') delta = -def.deeper;
  else delta = Number(direction) || 0;
  const cur = state.notches[key] != null ? state.notches[key] : def.default;
  state.notches[key] = clampNotch(key, cur + delta);
  return state.notches[key];
}

export function formatNotch(key, value) {
  const def = NOTCHES[key];
  if (!def) return String(value);
  const v = value != null ? value : def.default;
  if (def.levels && def.levels[v]) return `${def.label} ${v}: ${def.levels[v]}`;
  if (def.levels) return `${def.label} ${v}: ${def.hint || ''}`.trim();
  return `${def.label} ${v}${def.unit ? ' ' + def.unit : ''}`;
}

export function formatNotchValue(key, value) {
  const def = NOTCHES[key];
  if (!def) return String(value);
  const v = value != null ? value : def.default;
  return `${v}${def.unit ? ' ' + def.unit : ''}`;
}

// ---------------------------------------------------------------------------
// Desk
// ---------------------------------------------------------------------------

export function deskPhaseForWeek(week) {
  const w = week || 1;
  return DESK_PHASES.find((p) => w >= p.fromWeek && w <= p.toWeek) || DESK_PHASES[DESK_PHASES.length - 1];
}

export function deskDay(state, dateKey) {
  const d = state.desk[dateKey] || {};
  return {
    slantMinutes: Number(d.slantMinutes) || 0,
    squatHangs: Number(d.squatHangs) || 0,
    hamstringDone: !!d.hamstringDone,
  };
}

export function updateDeskDay(state, dateKey, patch) {
  const cur = deskDay(state, dateKey);
  const next = { ...cur, ...patch };
  next.slantMinutes = Math.max(0, Math.round(next.slantMinutes));
  next.squatHangs = Math.max(0, Math.round(next.squatHangs));
  state.desk[dateKey] = next;
  return next;
}

export function deskWeekTotals(state, today) {
  const monday = mondayOf(today);
  let slantMinutes = 0;
  let squatHangs = 0;
  let hamstringDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = deskDay(state, toDateKey(addDays(monday, i)));
    slantMinutes += d.slantMinutes;
    squatHangs += d.squatHangs;
    if (d.hamstringDone) hamstringDays++;
  }
  return { slantMinutes, squatHangs, hamstringDays };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function testMetrics() {
  const rows = [];
  for (const t of TESTS) {
    for (const f of t.fields) rows.push({ testId: t.id, testName: t.name, key: f.key, label: f.label, unit: f.unit, noise: t.noise || 0 });
  }
  return rows;
}

// Values for one metric, oldest first, skipping blanks.
export function metricHistory(state, key) {
  return state.tests
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .filter((t) => t[key] != null && t[key] !== '' && Number.isFinite(Number(t[key])))
    .map((t) => ({ date: t.date, value: Number(t[key]) }));
}

export function metricSummary(state, metric) {
  const hist = metricHistory(state, metric.key);
  const latest = hist.length ? hist[hist.length - 1] : null;
  const previous = hist.length > 1 ? hist[hist.length - 2] : null;
  const delta = latest && previous ? latest.value - previous.value : null;
  const insideNoise = delta != null && metric.noise > 0 && Math.abs(delta) < metric.noise;
  return { history: hist, latest, previous, delta, insideNoise };
}

export function recordTest(state, dateKey, values) {
  const rec = { id: makeId(), date: dateKey };
  for (const m of testMetrics()) {
    const v = values[m.key];
    if (v != null && v !== '' && Number.isFinite(Number(v))) rec[m.key] = Number(v);
  }
  state.tests.push(rec);
  return rec;
}
