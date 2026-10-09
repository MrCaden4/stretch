// timer.js
// Pure session engine. No DOM, no timers of its own. app.js calls tick() on a
// 200 ms interval; tests call tick() with a fake clock. All timing is by wall
// clock: a phase records when it started and remaining time is recomputed on
// every tick, so a locked phone or a throttled tab never drifts the session.

export const DEFAULTS = {
  sideSwitchSeconds: 10,
  exerciseTransitionSeconds: 20,
  staleCueSeconds: 5,
  kettlebellKg: 16,
};

const SIDE_NAME = { L: 'Left', R: 'Right' };

export function sideName(side) {
  return side ? SIDE_NAME[side] || side : '';
}

// ---------------------------------------------------------------------------
// Expansion: routine -> ordered list of phases
// ---------------------------------------------------------------------------

export function expandRoutine(routine, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const sideSec = routine.transitions && routine.transitions.side != null ? routine.transitions.side : o.sideSwitchSeconds;
  const exSec = routine.transitions && routine.transitions.exercise != null ? routine.transitions.exercise : o.exerciseTransitionSeconds;
  const fill = (s) => (s ? String(s).replace(/\{kb\}/g, String(o.kettlebellKg)) : s);
  const phases = [];
  const exCount = routine.exercises.length;

  const exInfo = (ex, ei) => ({
    exerciseIndex: ei,
    exerciseCount: exCount,
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseShort: ex.short || ex.name,
    notch: ex.notch || null,
  });

  const nextInfo = (ex, ei) => ({
    exerciseIndex: ei,
    id: ex.id,
    name: ex.name,
    short: ex.short || ex.name,
    setup: fill(ex.setup),
    intensity: ex.intensity || '',
    dose: ex.dose || '',
    notch: ex.notch || null,
    notchNote: ex.notchNote || '',
  });

  if (routine.setup && routine.setup.seconds > 0) {
    const first = routine.exercises[0];
    phases.push({
      type: 'transition',
      kind: 'setup',
      seconds: routine.setup.seconds,
      label: 'Setup',
      instruction: fill(routine.setup.say),
      cues: [{ at: 0, say: fill(routine.setup.say), label: 'Setup', segment: 'transition', sound: 'single' }],
      next: first ? nextInfo(first, 0) : null,
      meta: { ...(first ? exInfo(first, 0) : { exerciseIndex: -1, exerciseCount: exCount }), set: 0, sets: 0, side: null },
    });
  }

  routine.exercises.forEach((ex, ei) => {
    const sides = ex.sides && ex.sides.length ? ex.sides : [null];
    const rounds = ex.rounds || 1;
    const sets = rounds;
    const info = exInfo(ex, ei);

    if (ei > 0) {
      const say = exSec >= 15 ? `Next: ${ex.name}. ${fill(ex.setup)}` : `Next: ${ex.name}`;
      phases.push({
        type: 'transition',
        kind: 'exercise',
        seconds: exSec,
        label: 'Next up',
        instruction: fill(ex.setup),
        cues: [{ at: 0, say, label: 'Next up', segment: 'transition', sound: 'long', vibrate: 'long' }],
        next: nextInfo(ex, ei),
        meta: { ...info, set: 1, sets, side: sides[0] },
      });
    }

    let unitNo = 0;
    for (let r = 0; r < rounds; r++) {
      for (let si = 0; si < sides.length; si++) {
        const side = sides[si];
        const meta = { ...info, set: r + 1, sets, side, unitIndex: unitNo, unitCount: rounds * sides.length };
        if (unitNo > 0) {
          if (side !== null) {
            phases.push({
              type: 'transition',
              kind: 'side',
              seconds: sideSec,
              label: 'Switch sides',
              instruction: `Switch to the ${sideName(side).toLowerCase()} side.`,
              cues: [{ at: 0, say: 'Switch sides', label: 'Switch sides', segment: 'transition', sound: 'double', vibrate: 'double' }],
              meta,
            });
          } else if (ex.rest && ex.rest.seconds > 0) {
            phases.push({
              type: 'transition',
              kind: 'rest',
              seconds: ex.rest.seconds,
              label: 'Rest',
              instruction: ex.rest.say || 'Rest',
              cues: [{ at: 0, say: ex.rest.say || 'Rest', label: 'Rest', segment: 'transition', sound: 'single' }],
              meta,
            });
          }
        }
        for (const block of ex.unit) {
          phases.push(blockToPhase(block, ex, meta, fill));
        }
        unitNo++;
      }
    }
  });

  // Normalise: cues sorted by time, default sounds.
  for (const p of phases) {
    p.cues = (p.cues || []).slice().sort((a, b) => a.at - b.at);
    for (const c of p.cues) {
      if (c.sound === undefined) c.sound = 'single';
      if (c.vibrate === undefined) c.vibrate = c.sound;
    }
  }
  return phases;
}

function blockToPhase(block, ex, meta, fill) {
  const side = meta.side;
  const prefix = side ? `${sideName(side)}. ` : '';
  if (block.type === 'hold') {
    const cues = (block.cues || []).map((c, i) => ({
      ...c,
      say: i === 0 && c.at === 0 ? prefix + c.say : c.say,
    }));
    if (!cues.length || cues[0].at !== 0) {
      cues.unshift({ at: 0, say: `${prefix}Settle.`, label: 'Settle', segment: 'settle' });
    }
    return {
      type: 'hold',
      seconds: block.seconds,
      label: ex.short || ex.name,
      instruction: fill(ex.setup),
      cues,
      meta,
    };
  }
  if (block.type === 'reps') {
    const spr = block.secondsPerRep || 3;
    const cues = [];
    for (let k = 0; k < block.reps; k++) {
      const base = k * spr;
      cues.push({ at: base, say: k === 0 ? `${prefix}Lift` : 'Lift', label: 'Lift', segment: 'lift', rep: k + 1, sound: k === 0 ? 'single' : null });
      cues.push({ at: base + 1, say: 'Hold', label: 'Hold', segment: 'hold', rep: k + 1, sound: null });
      cues.push({ at: base + 2, say: 'Down', label: 'Down', segment: 'down', rep: k + 1, sound: null });
    }
    return {
      type: 'reps',
      seconds: block.reps * spr,
      reps: block.reps,
      secondsPerRep: spr,
      label: block.label || 'Reps',
      instruction: block.instruction || '',
      cues,
      meta,
    };
  }
  if (block.type === 'accumulate') {
    const cues = [
      { at: 0, say: block.startSay || `${ex.name}. Accumulate.`, label: 'Accumulate', segment: 'accumulate', sound: 'single' },
    ];
    const every = block.reminderEvery || 0;
    if (every > 0 && block.reminder) {
      for (let t = every; t < block.seconds; t += every) {
        cues.push({ at: t, say: block.reminder, label: 'Accumulate', segment: 'accumulate', sound: 'single' });
      }
    }
    return {
      type: 'accumulate',
      seconds: block.seconds,
      label: ex.short || ex.name,
      instruction: fill(ex.setup),
      cues,
      meta,
    };
  }
  throw new Error(`Unknown block type: ${block.type}`);
}

// Planned time = holds + reps + accumulate targets + transitions.
export function plannedSeconds(phases) {
  return phases.reduce((sum, p) => sum + p.seconds, 0);
}

export function totalSeconds(phases) {
  return phases.reduce((sum, p) => sum + p.seconds, 0);
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function formatMinutes(seconds) {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const WORK_TYPES = new Set(['hold', 'accumulate', 'reps']);

export class SessionEngine {
  constructor(phases, opts = {}) {
    if (!Array.isArray(phases) || phases.length === 0) throw new Error('SessionEngine needs at least one phase');
    this.phases = phases;
    this.now = opts.now || (() => Date.now());
    this.staleMs = (opts.staleCueSeconds != null ? opts.staleCueSeconds : DEFAULTS.staleCueSeconds) * 1000;
    this.status = 'idle'; // idle | running | paused | finished
    this.index = -1;
    this.cur = null;
    this.listeners = new Set();
    this.startedAt = null;
    this.finishedAt = null;
    this.endedEarly = false;
    this.accumulateResults = []; // { index, exerciseId, notch, accumulated, longestChunk, chunks }
    this.completedIndexes = new Set(); // phases finished by running out or by skip
    this.maxIndexReached = -1;
    this.extra = new Map(); // phase index -> extra seconds added with +15
  }

  // ---- events -------------------------------------------------------------

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(type, data) {
    for (const fn of Array.from(this.listeners)) fn(type, data || {});
  }

  // ---- time helpers ----------------------------------------------------------

  durationMs(i) {
    return (this.phases[i].seconds + (this.extra.get(i) || 0)) * 1000;
  }

  _elapsedMs(now) {
    const c = this.cur;
    if (!c) return 0;
    return c.elapsedBefore + (c.runningSince != null ? now - c.runningSince : 0);
  }

  // ---- lifecycle -------------------------------------------------------------

  start() {
    if (this.status !== 'idle') return;
    const now = this.now();
    this.startedAt = now;
    this.status = 'running';
    this._emit('start', { at: now });
    this._enter(0, now);
    this.tick(now);
  }

  _enter(i, atWall) {
    if (i >= this.phases.length) {
      this._finish(atWall, false);
      return;
    }
    this.index = i;
    if (i > this.maxIndexReached) this.maxIndexReached = i;
    const paused = this.status === 'paused';
    this.cur = {
      startWall: atWall,
      elapsedBefore: 0,
      runningSince: paused ? null : atWall,
      fired: new Set(),
      chunkStart: 0,
      longest: 0,
      chunks: [],
    };
    this._emit('phase', { index: i, phase: this.phases[i], at: atWall });
  }

  tick(now = this.now()) {
    if (this.status !== 'running') return this.snapshot(now);
    let guard = 0;
    while (this.status === 'running' && guard++ < 100000) {
      const i = this.index;
      const phase = this.phases[i];
      const dur = this.durationMs(i);
      const el = this._elapsedMs(now);
      this._processCues(phase, el);
      if (el >= dur) {
        // Phase completed at an exact wall time; the next one starts there.
        const endWall = this.cur.runningSince + (dur - this.cur.elapsedBefore);
        this._complete(i, 'complete', endWall);
        if (this.status !== 'running') break;
        this._enter(i + 1, endWall);
        continue;
      }
      break;
    }
    return this.snapshot(now);
  }

  _processCues(phase, elapsedMs) {
    const cues = phase.cues || [];
    for (let c = 0; c < cues.length; c++) {
      if (this.cur.fired.has(c)) continue;
      const cue = cues[c];
      const atMs = cue.at * 1000;
      if (elapsedMs < atMs) break; // cues are sorted by time
      this.cur.fired.add(c);
      const lag = elapsedMs - atMs;
      if (lag > this.staleMs) {
        this._emit('cueDropped', { cue, index: this.index, phase, lag });
      } else {
        this._emit('cue', { cue, index: this.index, phase, lag });
      }
    }
  }

  _recordAccumulate(i, elapsedMs) {
    const phase = this.phases[i];
    if (phase.type !== 'accumulate') return;
    const c = this.cur;
    const chunk = c.runningSince != null || c.elapsedBefore > c.chunkStart ? elapsedMs - c.chunkStart : 0;
    const chunks = c.chunks.slice();
    if (chunk > 0 && c.runningSince != null) chunks.push(chunk);
    const longest = Math.max(c.longest, chunk, 0);
    this.accumulateResults.push({
      index: i,
      exerciseId: phase.meta.exerciseId,
      notch: phase.meta.notch,
      accumulated: elapsedMs / 1000,
      longestChunk: longest / 1000,
      chunks: chunks.map((x) => x / 1000),
    });
  }

  _complete(i, reason, atWall) {
    const phase = this.phases[i];
    const el = Math.min(this._elapsedMs(atWall), this.durationMs(i));
    if (phase.type === 'accumulate') this._recordAccumulate(i, el);
    if (reason === 'complete' || reason === 'skip') this.completedIndexes.add(i);
    this._emit('phaseEnd', { index: i, phase, reason, at: atWall });
  }

  _finish(atWall, endedEarly) {
    if (this.status === 'finished') return;
    if (endedEarly && this.cur && this.index >= 0) {
      const el = Math.min(this._elapsedMs(atWall), this.durationMs(this.index));
      if (this.phases[this.index].type === 'accumulate') this._recordAccumulate(this.index, el);
    }
    this.status = 'finished';
    this.finishedAt = atWall;
    this.endedEarly = endedEarly;
    if (this.cur) this.cur.runningSince = null;
    this._emit('finish', this.summary());
  }

  // ---- controls -------------------------------------------------------------

  pause() {
    if (this.status !== 'running') return;
    const now = this.now();
    this.tick(now);
    if (this.status !== 'running') return;
    const c = this.cur;
    c.elapsedBefore += now - c.runningSince;
    c.runningSince = null;
    if (this.phases[this.index].type === 'accumulate') {
      const chunk = c.elapsedBefore - c.chunkStart;
      if (chunk > 0) c.chunks.push(chunk);
      c.longest = Math.max(c.longest, chunk);
      c.chunkStart = c.elapsedBefore;
    }
    this.status = 'paused';
    this._emit('pause', { at: now });
  }

  resume() {
    if (this.status !== 'paused') return;
    const now = this.now();
    const c = this.cur;
    c.runningSince = now;
    c.chunkStart = c.elapsedBefore;
    this.status = 'running';
    this._emit('resume', { at: now });
    this.tick(now);
  }

  toggle() {
    if (this.status === 'idle') this.start();
    else if (this.status === 'running') this.pause();
    else if (this.status === 'paused') this.resume();
  }

  addSeconds(n) {
    if (this.status === 'idle' || this.status === 'finished') return;
    const i = this.index;
    this.extra.set(i, (this.extra.get(i) || 0) + n);
    this._emit('extend', { index: i, seconds: n });
  }

  skip() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    const now = this.now();
    if (this.status === 'running') this.tick(now);
    if (this.status !== 'running' && this.status !== 'paused') return;
    const i = this.index;
    this._complete(i, 'skip', now);
    this._enter(i + 1, now);
    if (this.status === 'running') this.tick(now);
  }

  back() {
    if (this.status !== 'running' && this.status !== 'paused') return;
    const now = this.now();
    if (this.status === 'running') this.tick(now);
    if (this.status !== 'running' && this.status !== 'paused') return;
    const i = this.index;
    this._emit('phaseEnd', { index: i, phase: this.phases[i], reason: 'back', at: now });
    this._enter(Math.max(0, i - 1), now);
    if (this.status === 'running') this.tick(now);
  }

  end() {
    if (this.status === 'idle' || this.status === 'finished') return;
    const now = this.now();
    if (this.status === 'running') this.tick(now);
    if (this.status === 'finished') return;
    this._finish(now, true);
  }

  // ---- read model -----------------------------------------------------------

  // Index of the last work phase (hold, reps, accumulate) of each exercise.
  _lastWorkIndexByExercise() {
    const map = new Map();
    this.phases.forEach((p, i) => {
      if (WORK_TYPES.has(p.type) && p.meta && p.meta.exerciseIndex >= 0) map.set(p.meta.exerciseIndex, i);
    });
    return map;
  }

  exercisesTotal() {
    return this._lastWorkIndexByExercise().size;
  }

  // An exercise counts once its last work phase ran out or was skipped.
  exercisesCompleted() {
    let n = 0;
    for (const [, lastIndex] of this._lastWorkIndexByExercise()) {
      if (this.completedIndexes.has(lastIndex)) n++;
    }
    return n;
  }

  longestSquatChunk() {
    let best = 0;
    for (const r of this.accumulateResults) {
      if (r.notch === 'squatHang' && r.longestChunk > best) best = r.longestChunk;
    }
    return best;
  }

  summary() {
    const total = this.exercisesTotal();
    const done = this.exercisesCompleted();
    const finishedAt = this.finishedAt != null ? this.finishedAt : this.now();
    return {
      startedAt: this.startedAt,
      finishedAt,
      durationSeconds: this.startedAt != null ? Math.max(0, Math.round((finishedAt - this.startedAt) / 1000)) : 0,
      completed: total > 0 && done === total,
      endedEarly: this.endedEarly,
      exercisesCompleted: done,
      exercisesTotal: total,
      accumulate: this.accumulateResults.slice(),
      longestSquatChunk: this.longestSquatChunk(),
    };
  }

  snapshot(now = this.now()) {
    const i = this.index;
    const phase = i >= 0 ? this.phases[i] : null;
    const snap = {
      status: this.status,
      index: i,
      count: this.phases.length,
      phase,
      nextPhase: i + 1 < this.phases.length ? this.phases[i + 1] : null,
      elapsed: 0,
      remaining: 0,
      duration: 0,
      segment: null,
      accumulate: null,
      rep: null,
      progress: 0,
      remainingTotal: totalSeconds(this.phases),
      exercisesCompleted: this.exercisesCompleted(),
      exercisesTotal: this.exercisesTotal(),
    };
    if (!phase) return snap;

    const durMs = this.durationMs(i);
    const rawEl = this.status === 'finished' ? durMs : this._elapsedMs(now);
    const elMs = Math.min(Math.max(0, rawEl), durMs);
    snap.duration = durMs / 1000;
    snap.elapsed = elMs / 1000;
    snap.remaining = Math.max(0, durMs - elMs) / 1000;
    snap.segment = currentSegment(phase, elMs / 1000);

    if (phase.type === 'accumulate') {
      const c = this.cur;
      const running = c.runningSince != null && this.status === 'running';
      const chunkMs = running ? Math.max(0, elMs - c.chunkStart) : 0;
      snap.accumulate = {
        accumulated: elMs / 1000,
        target: durMs / 1000,
        currentChunk: chunkMs / 1000,
        longestChunk: Math.max(c.longest, chunkMs) / 1000,
        chunks: c.chunks.map((x) => x / 1000),
      };
    }
    if (phase.type === 'reps') {
      const spr = phase.secondsPerRep || 3;
      snap.rep = { current: Math.min(phase.reps, Math.floor(elMs / 1000 / spr) + 1), total: phase.reps };
    }

    let total = 0;
    let done = 0;
    for (let k = 0; k < this.phases.length; k++) {
      const d = this.durationMs(k);
      total += d;
      if (k < i) done += d;
      else if (k === i) done += elMs;
    }
    snap.progress = total > 0 ? done / total : 0;
    snap.remainingTotal = Math.max(0, total - done) / 1000;
    return snap;
  }
}

const DEFAULT_SEGMENT = {
  hold: { segment: 'settle', label: 'Settle' },
  accumulate: { segment: 'accumulate', label: 'Accumulate' },
  reps: { segment: 'lift', label: 'Lift' },
  transition: { segment: 'transition', label: 'Transition' },
};

// The segment (name, colour, instruction) currently in force inside a phase:
// the latest cue whose time has passed.
export function currentSegment(phase, elapsedSeconds) {
  const base = DEFAULT_SEGMENT[phase.type] || { segment: 'settle', label: phase.label };
  let seg = { segment: base.segment, label: phase.type === 'hold' ? base.label : phase.label || base.label, say: '', rep: null };
  if (phase.type === 'transition') seg.label = phase.label;
  for (const c of phase.cues || []) {
    if (c.at <= elapsedSeconds) {
      seg = {
        segment: c.segment || seg.segment,
        label: c.label || seg.label,
        say: c.say || seg.say,
        rep: c.rep != null ? c.rep : seg.rep,
      };
    } else break;
  }
  return seg;
}

export { WORK_TYPES };
