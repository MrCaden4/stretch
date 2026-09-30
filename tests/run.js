// tests/run.js
// Plain-node checks for the routine data, the engine and the state helpers.
// Run: node tests/run.js
import assert from 'node:assert/strict';
import { ROUTINES, NOTCHES } from '../data/routines.js';
import { expandRoutine, SessionEngine, plannedSeconds, totalSeconds, formatClock, currentSegment } from '../timer.js';
import * as S from '../state.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e && e.message ? e.message.split('\n')[0] : e}`);
    if (process.env.VERBOSE) console.log(e.stack);
  }
}

function fakeClock(start = 1_700_000_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; }, get: () => t };
}

// Advance a fake clock in 200 ms ticks for `seconds`, ticking the engine.
function run(engine, clock, seconds, stepMs = 200) {
  const steps = Math.round((seconds * 1000) / stepMs);
  for (let i = 0; i < steps; i++) {
    clock.advance(stepMs);
    engine.tick();
  }
}

function runToEnd(engine, clock, stepMs = 200) {
  let guard = 0;
  while (engine.status !== 'finished' && guard++ < 500000) {
    clock.advance(stepMs);
    engine.tick();
  }
  assert.equal(engine.status, 'finished', 'engine should finish');
}

function recorder(engine, clock) {
  const log = { cues: [], dropped: [], phases: [], ends: [], finish: null, ratings: [] };
  engine.on((type, d) => {
    if (type === 'cue') log.cues.push({ index: d.index, at: d.cue.at, say: d.cue.say, wall: clock.now(), lag: d.lag });
    if (type === 'cueDropped') log.dropped.push({ index: d.index, at: d.cue.at, lag: d.lag });
    if (type === 'phase') log.phases.push({ index: d.index, at: d.at });
    if (type === 'phaseEnd') log.ends.push({ index: d.index, reason: d.reason });
    if (type === 'finish') log.finish = d;
    if (type === 'rating') log.ratings.push(d);
  });
  return log;
}

function miniRoutine(exercises, extra = {}) {
  return { id: 't', name: 'Test', exercises, ...extra };
}

const HOLD_CUES = [
  { at: 0, say: 'go', label: 'Settle', segment: 'settle' },
  { at: 60, say: 'contract', label: 'Contract', segment: 'contract' },
  { at: 70, say: 'sink', label: 'Sink', segment: 'sink' },
];

// ---------------------------------------------------------------------------
console.log('\nPlanned time per routine (holds + reps + accumulate targets + transitions):');
const EXPECTED_SECONDS = { A: 1400, B: 1540, min: 645, off: 190 };
const EXPECTED_RANGE_MIN = { A: [23, 24], B: [25, 26], min: [10, 11] };
for (const id of Object.keys(ROUTINES)) {
  const ph = expandRoutine(ROUTINES[id]);
  const sec = plannedSeconds(ph);
  console.log(
    `  ${ROUTINES[id].name.padEnd(20)} ${formatClock(sec)}  (${(sec / 60).toFixed(2)} min, ${ph.length} phases, ${formatClock(totalSeconds(ph))} with feel screens)`
  );
}
console.log('');

console.log('Routine data');
test('planned totals match section 4', () => {
  for (const [id, expected] of Object.entries(EXPECTED_SECONDS)) {
    const sec = plannedSeconds(expandRoutine(ROUTINES[id]));
    assert.equal(sec, expected, `${id}: ${sec} s, expected ${expected} s`);
  }
});

test('planned totals fall in the expected minute ranges', () => {
  for (const [id, [lo, hi]] of Object.entries(EXPECTED_RANGE_MIN)) {
    const min = plannedSeconds(expandRoutine(ROUTINES[id])) / 60;
    assert.ok(min >= lo && min <= hi, `${id}: ${min.toFixed(2)} min not in ${lo}-${hi}`);
  }
});

test('every session starts with the 30 s setup transition', () => {
  for (const id of ['A', 'B', 'min']) {
    const p = expandRoutine(ROUTINES[id])[0];
    assert.equal(p.type, 'transition');
    assert.equal(p.kind, 'setup');
    assert.equal(p.seconds, 30);
    assert.match(p.cues[0].say, /Mat out, kettlebell ready, shoes off/);
  }
});

test('A1 is 4 x 90 s alternating L, R, L, R with 10 s side switches', () => {
  const ph = expandRoutine(ROUTINES.A).filter((p) => p.meta.exerciseId === 'A1' && p.type !== 'feel');
  const holds = ph.filter((p) => p.type === 'hold');
  const switches = ph.filter((p) => p.kind === 'side');
  assert.equal(holds.length, 4);
  assert.deepEqual(holds.map((h) => h.meta.side), ['L', 'R', 'L', 'R']);
  assert.deepEqual(holds.map((h) => h.meta.set), [1, 1, 2, 2]);
  assert.ok(holds.every((h) => h.seconds === 90));
  assert.equal(switches.length, 3);
  assert.ok(switches.every((s) => s.seconds === 10 && s.cues[0].say === 'Switch sides' && s.cues[0].sound === 'double'));
  assert.deepEqual(holds[0].cues.map((c) => c.at), [0, 60, 70]);
  assert.match(holds[0].cues[0].say, /^Left\. Settle at 7/);
  assert.match(holds[1].cues[0].say, /^Right\./);
  assert.match(holds[0].cues[1].say, /Contract: press the ball of the foot down, 10 seconds/);
  assert.match(holds[0].cues[2].say, /Relax, exhale, sink/);
});

test('A has 4 exercise transitions of 20 s and one feel screen per exercise', () => {
  const ph = expandRoutine(ROUTINES.A);
  const ex = ph.filter((p) => p.kind === 'exercise');
  assert.equal(ex.length, 4);
  assert.ok(ex.every((p) => p.seconds === 20 && p.next && p.next.setup));
  const feels = ph.filter((p) => p.type === 'feel');
  assert.equal(feels.length, 5);
  assert.deepEqual(feels.map((f) => f.meta.exerciseId), ['A1', 'A2', 'A3', 'A4', 'A5']);
  // Feel screen immediately follows the exercise's last work phase.
  feels.forEach((f) => {
    const i = ph.indexOf(f);
    assert.notEqual(ph[i - 1].type, 'transition');
    assert.equal(ph[i - 1].meta.exerciseId, f.meta.exerciseId);
  });
});

test('A2 squat hang accumulates 4:00 with a reminder every 60 s', () => {
  const p = expandRoutine(ROUTINES.A).find((x) => x.type === 'accumulate');
  assert.equal(p.seconds, 240);
  assert.deepEqual(p.cues.map((c) => c.at), [0, 60, 120, 180]);
  assert.ok(p.cues.slice(1).every((c) => /Shift side to side, pry the knees out/.test(c.say)));
});

test('A3 is 90 s hold then 5 lift-offs at 3 s per side', () => {
  const ph = expandRoutine(ROUTINES.A).filter((p) => p.meta.exerciseId === 'A3' && p.type !== 'feel' && p.kind !== 'exercise');
  assert.deepEqual(ph.map((p) => p.type), ['hold', 'reps', 'transition', 'hold', 'reps']);
  const reps = ph[1];
  assert.equal(reps.seconds, 15);
  assert.equal(reps.cues.length, 15);
  assert.deepEqual(reps.cues.slice(0, 3).map((c) => c.label), ['Lift', 'Hold', 'Down']);
  assert.deepEqual(reps.cues.slice(0, 3).map((c) => c.at), [0, 1, 2]);
  assert.equal(reps.cues[14].rep, 5);
});

test('A5 couch stretch timeline: press at 60, squeeze at 70, sink at 80, done at 120', () => {
  const h = expandRoutine(ROUTINES.A).find((p) => p.meta.exerciseId === 'A5' && p.type === 'hold');
  assert.equal(h.seconds, 120);
  assert.deepEqual(h.cues.map((c) => c.at), [0, 60, 70, 80]);
  assert.deepEqual(h.cues.map((c) => c.segment), ['settle', 'contract', 'contract', 'sink']);
});

test('B1 couch CR timeline is 50/60/70 over 90 s, 4 holds', () => {
  const holds = expandRoutine(ROUTINES.B).filter((p) => p.meta.exerciseId === 'B1' && p.type === 'hold');
  assert.equal(holds.length, 4);
  assert.deepEqual(holds[0].cues.map((c) => c.at), [0, 50, 60, 70]);
  assert.ok(holds.every((h) => h.seconds === 90));
});

test('B3 has two unsided 90 s holds with a 20 s rest and cues at 30 and 60', () => {
  const ph = expandRoutine(ROUTINES.B).filter((p) => p.meta.exerciseId === 'B3' && p.type !== 'feel' && p.kind !== 'exercise');
  assert.deepEqual(ph.map((p) => p.type), ['hold', 'transition', 'hold']);
  assert.equal(ph[1].kind, 'rest');
  assert.equal(ph[1].seconds, 20);
  assert.equal(ph[1].cues[0].say, 'Stand up, shake out');
  assert.ok(ph[0].meta.side === null);
  const spoken = ph[0].cues.filter((c) => /Squeeze the feet toward each other/.test(c.say)).map((c) => c.at);
  assert.deepEqual(spoken, [30, 60]);
});

test('B4 butterfly is one 120 s hold with lifts at 30, 60, 90', () => {
  const ph = expandRoutine(ROUTINES.B).filter((p) => p.meta.exerciseId === 'B4' && p.type !== 'feel' && p.kind !== 'exercise');
  assert.equal(ph.length, 1);
  assert.equal(ph[0].seconds, 120);
  const lifts = ph[0].cues.filter((c) => /Lift the knees into the forearms/.test(c.say)).map((c) => c.at);
  assert.deepEqual(lifts, [30, 60, 90]);
});

test('B6 squat hang is 2:00', () => {
  const p = expandRoutine(ROUTINES.B).filter((x) => x.type === 'accumulate');
  assert.equal(p.length, 1);
  assert.equal(p[0].seconds, 120);
  assert.deepEqual(p[0].cues.map((c) => c.at), [0, 60]);
});

test('Minimum uses 5 s side switches and 10 s exercise transitions', () => {
  const ph = expandRoutine(ROUTINES.min);
  const sides = ph.filter((p) => p.kind === 'side');
  const ex = ph.filter((p) => p.kind === 'exercise');
  assert.equal(sides.length, 3);
  assert.ok(sides.every((p) => p.seconds === 5));
  assert.equal(ex.length, 3);
  assert.ok(ex.every((p) => p.seconds === 10));
  const acc = ph.find((p) => p.type === 'accumulate');
  assert.equal(acc.seconds, 180);
  const couch = ph.filter((p) => p.meta.exerciseId === 'M3' && p.type === 'hold');
  assert.deepEqual(couch[0].cues.map((c) => c.at), [0, 30, 40, 50]);
  assert.equal(couch[0].seconds, 60);
  const nn = ph.filter((p) => p.meta.exerciseId === 'M4' && p.type === 'hold');
  assert.ok(nn.every((h) => h.seconds === 45));
  // Settings overrides do not apply to Minimum.
  const ph2 = expandRoutine(ROUTINES.min, { sideSwitchSeconds: 30, exerciseTransitionSeconds: 60 });
  assert.equal(plannedSeconds(ph2), plannedSeconds(ph));
});

test('settings override side switch and exercise transition seconds for A and B', () => {
  const ph = expandRoutine(ROUTINES.A, { sideSwitchSeconds: 7, exerciseTransitionSeconds: 12 });
  assert.ok(ph.filter((p) => p.kind === 'side').every((p) => p.seconds === 7));
  assert.ok(ph.filter((p) => p.kind === 'exercise').every((p) => p.seconds === 12));
  assert.equal(ph[0].seconds, 30, 'setup stays 30 s');
  // Short transitions speak only the name; long ones read the setup too.
  const t = ph.find((p) => p.kind === 'exercise');
  assert.equal(t.cues[0].say, `Next: ${t.next.name}`);
  const tl = expandRoutine(ROUTINES.A).find((p) => p.kind === 'exercise');
  assert.match(tl.cues[0].say, /^Next: Squat Hang\. Feet shoulder-width/);
});

test('kettlebell kg is interpolated into setup text', () => {
  const a = expandRoutine(ROUTINES.A).find((p) => p.meta.exerciseId === 'A1' && p.type === 'hold');
  assert.match(a.instruction, /\(16 kg\)/);
  const b = expandRoutine(ROUTINES.A, { kettlebellKg: 20 }).find((p) => p.meta.exerciseId === 'A1' && p.type === 'hold');
  assert.match(b.instruction, /\(20 kg\)/);
  assert.ok(!/\{kb\}/.test(JSON.stringify(expandRoutine(ROUTINES.B, { kettlebellKg: 12 }))));
});

test('cues are sorted, unique in time, inside the phase, and every phase starts with a cue at 0', () => {
  for (const id of Object.keys(ROUTINES)) {
    for (const p of expandRoutine(ROUTINES[id])) {
      assert.ok(p.cues.length > 0, `${id} ${p.type} has cues`);
      assert.equal(p.cues[0].at, 0);
      for (let i = 1; i < p.cues.length; i++) assert.ok(p.cues[i].at > p.cues[i - 1].at, `${id} ${p.label} cue order`);
      assert.ok(p.cues[p.cues.length - 1].at < p.seconds, `${id} ${p.label} last cue before end`);
      assert.ok(['hold', 'accumulate', 'reps', 'transition', 'feel'].includes(p.type));
      assert.ok(p.meta && typeof p.meta.exerciseCount === 'number');
    }
  }
});

test('every exercise notch key exists in NOTCHES and shared keys are shared', () => {
  const byNotch = {};
  for (const r of Object.values(ROUTINES)) {
    for (const ex of r.exercises) {
      assert.ok(NOTCHES[ex.notch], `${ex.id} notch ${ex.notch}`);
      (byNotch[ex.notch] = byNotch[ex.notch] || []).push(ex.id);
    }
  }
  assert.deepEqual(byNotch.couch.sort(), ['A5', 'B1', 'M3']);
  assert.deepEqual(byNotch.ninetyNinety.sort(), ['A3', 'B5', 'M4']);
  assert.deepEqual(byNotch.squatHang.sort(), ['A2', 'B6', 'M1', 'O1']);
  assert.deepEqual(byNotch.soleus.sort(), ['A1', 'M2']);
});

test('no em dashes in routine content', () => {
  assert.ok(!/\u2014/.test(JSON.stringify(ROUTINES)), 'routines contain an em dash');
  assert.ok(!/\u2014/.test(JSON.stringify(NOTCHES)), 'notches contain an em dash');
});

// ---------------------------------------------------------------------------
console.log('\nFull-session simulation (fake clock, 200 ms ticks)');
for (const id of Object.keys(ROUTINES)) {
  test(`${ROUTINES[id].name}: every cue fires exactly once, in order, at the right wall time`, () => {
    const phases = expandRoutine(ROUTINES[id]);
    const clock = fakeClock();
    const engine = new SessionEngine(phases, { now: clock.now });
    const log = recorder(engine, clock);
    const t0 = clock.now();
    engine.start();
    runToEnd(engine, clock);

    const expected = [];
    phases.forEach((p, i) => p.cues.forEach((c) => expected.push({ index: i, at: c.at, say: c.say })));
    assert.deepEqual(log.cues.map(({ index, at, say }) => ({ index, at, say })), expected);
    assert.equal(log.dropped.length, 0, 'no cue dropped as stale');

    // Phase boundaries land on exact wall times.
    let acc = t0;
    assert.equal(log.phases.length, phases.length);
    phases.forEach((p, i) => {
      assert.equal(log.phases[i].index, i);
      assert.equal(log.phases[i].at, acc, `phase ${i} starts at ${acc}`);
      acc += p.seconds * 1000;
    });
    for (const c of log.cues) {
      const start = log.phases[c.index].at;
      const lag = c.wall - (start + c.at * 1000);
      assert.ok(lag >= 0 && lag <= 200, `cue lag ${lag} ms`);
    }

    const s = engine.summary();
    assert.ok(log.finish, 'finish event emitted');
    assert.equal(s.completed, true);
    assert.equal(s.endedEarly, false);
    assert.equal(s.exercisesTotal, ROUTINES[id].exercises.length);
    assert.equal(s.exercisesCompleted, s.exercisesTotal);
    assert.equal(s.durationSeconds, totalSeconds(phases));
    assert.equal(s.ratings.length, s.exercisesTotal);
    assert.ok(s.ratings.every((r) => r.rating === 'held' && r.auto === true));
    const squat = phases.filter((p) => p.type === 'accumulate' && p.meta.notch === 'squatHang');
    const expectLongest = squat.length ? Math.max(...squat.map((p) => p.seconds)) : 0;
    assert.equal(s.longestSquatChunk, expectLongest);
    assert.equal(log.ends.filter((e) => e.reason === 'complete').length, phases.length);
  });
}

// ---------------------------------------------------------------------------
console.log('\nEngine behaviour');

test('pause stops the clock and shifts later cues and the phase end', () => {
  const routine = miniRoutine([{ id: 'T1', name: 'Hold', notch: 'soleus', setup: 'x', sides: ['L'], rounds: 1, unit: [{ type: 'hold', seconds: 90, cues: HOLD_CUES }] }]);
  const phases = expandRoutine(routine);
  assert.deepEqual(phases.map((p) => p.type), ['hold', 'feel']);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  const log = recorder(engine, clock);
  const t0 = clock.now();
  engine.start();
  run(engine, clock, 30);
  engine.pause();
  assert.equal(engine.status, 'paused');
  run(engine, clock, 20);
  let snap = engine.snapshot();
  assert.equal(snap.status, 'paused');
  assert.equal(snap.elapsed, 30);
  assert.equal(snap.remaining, 60);
  engine.resume();
  run(engine, clock, 29.8);
  assert.equal(log.cues.length, 1, 'contract cue not yet fired');
  run(engine, clock, 0.4);
  assert.equal(log.cues.length, 2);
  assert.equal(log.cues[1].say, 'contract');
  assert.ok(Math.abs(log.cues[1].wall - (t0 + 80000)) <= 200, 'contract at 80 s wall time');
  run(engine, clock, 40);
  assert.equal(engine.index, 1);
  assert.equal(log.phases[1].at, t0 + 110000, 'phase end shifted by the 20 s pause');
});

test('catch-up after the tab was hidden: phases advance, stale cues (> 5 s) are dropped', () => {
  const phases = expandRoutine(ROUTINES.A);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  const log = recorder(engine, clock);
  engine.start();
  run(engine, clock, 10);
  const firedBefore = log.cues.length;
  clock.advance(200000); // 200 s with no ticks
  engine.tick();
  // 210 s in: setup 30, hold 90, switch 10, then 80 s into hold 2 (index 3).
  assert.equal(engine.index, 3);
  const snap = engine.snapshot();
  assert.ok(Math.abs(snap.elapsed - 80) < 0.001, `elapsed ${snap.elapsed}`);
  assert.equal(log.cues.length, firedBefore, 'nothing stale spoken');
  assert.equal(log.dropped.length, 7, 'all seven passed cues dropped');
  const seen = new Set([...log.cues, ...log.dropped].map((c) => `${c.index}:${c.at}`));
  for (let i = 0; i <= 3; i++) for (const c of phases[i].cues) if (i < 3 || c.at <= 80) assert.ok(seen.has(`${i}:${c.at}`), `cue ${i}:${c.at} accounted for`);
  assert.equal(seen.size, log.cues.length + log.dropped.length, 'no duplicates');
  // Life goes on: the next side switch fires normally at 220 s.
  run(engine, clock, 10.2);
  assert.equal(engine.index, 4);
  assert.equal(log.cues[log.cues.length - 1].say, 'Switch sides');
});

test('a short gap (under 5 s) still speaks the cue', () => {
  const phases = expandRoutine(ROUTINES.A);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  const log = recorder(engine, clock);
  engine.start();
  run(engine, clock, 10);
  clock.advance(24000);
  engine.tick();
  assert.equal(engine.index, 1);
  const last = log.cues[log.cues.length - 1];
  assert.equal(last.index, 1);
  assert.equal(last.lag, 4000);
  assert.equal(log.dropped.length, 0);
});

test('accumulate: chunk resets on pause, longest chunk is tracked, completes at the target', () => {
  const routine = miniRoutine([{ id: 'S', name: 'Squat Hang', notch: 'squatHang', setup: 'x', sides: null, rounds: 1, unit: [{ type: 'accumulate', seconds: 240, reminderEvery: 60, reminder: 'shift', startSay: 'go' }] }]);
  const phases = expandRoutine(routine);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  const log = recorder(engine, clock);
  engine.start();
  run(engine, clock, 50);
  let a = engine.snapshot().accumulate;
  assert.equal(a.accumulated, 50);
  assert.equal(a.currentChunk, 50);
  assert.equal(a.longestChunk, 50);
  engine.pause();
  a = engine.snapshot().accumulate;
  assert.equal(a.currentChunk, 0);
  assert.equal(a.longestChunk, 50);
  assert.deepEqual(a.chunks, [50]);
  run(engine, clock, 30);
  assert.equal(engine.snapshot().accumulate.accumulated, 50, 'paused time does not accumulate');
  engine.resume();
  run(engine, clock, 70);
  a = engine.snapshot().accumulate;
  assert.equal(a.accumulated, 120);
  assert.equal(a.currentChunk, 70);
  assert.equal(a.longestChunk, 70);
  engine.pause();
  assert.deepEqual(engine.snapshot().accumulate.chunks, [50, 70]);
  engine.resume();
  run(engine, clock, 120);
  assert.equal(engine.index, 1, 'moved to the feel screen when the target was reached');
  const r = engine.accumulateResults[0];
  assert.equal(r.accumulated, 240);
  assert.equal(r.longestChunk, 120);
  assert.deepEqual(r.chunks, [50, 70, 120]);
  assert.deepEqual(log.cues.filter((c) => c.index === 0).map((c) => c.at), [0, 60, 120, 180]);
  runToEnd(engine, clock);
  assert.equal(engine.summary().longestSquatChunk, 120);
});

test('ending early records the partial squat hang and marks the session incomplete', () => {
  const phases = expandRoutine(ROUTINES.A);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  const log = recorder(engine, clock);
  engine.start();
  engine.skip(); // setup
  const first = engine.index;
  assert.equal(phases[first].type, 'hold');
  // Skip through A1 to the squat hang.
  while (engine.phases[engine.index].type !== 'accumulate') engine.skip();
  run(engine, clock, 100);
  engine.end();
  assert.equal(engine.status, 'finished');
  const s = engine.summary();
  assert.equal(s.endedEarly, true);
  assert.equal(s.completed, false);
  assert.equal(s.exercisesCompleted, 1, 'A1 was passed (its feel screen was reached)');
  assert.equal(s.longestSquatChunk, 100);
  assert.ok(log.finish);
  // Controls are inert after finishing.
  engine.skip();
  engine.addSeconds(15);
  engine.resume();
  assert.equal(engine.status, 'finished');
});

test('feel screen auto-selects "held" after 10 s; a tap records the rating and moves on', () => {
  const routine = miniRoutine([
    { id: 'T1', name: 'One', notch: 'soleus', setup: 'x', sides: null, rounds: 1, unit: [{ type: 'hold', seconds: 5, cues: [{ at: 0, say: 'go', segment: 'settle', label: 'Settle' }] }] },
    { id: 'T2', name: 'Two', notch: 'couch', setup: 'y', sides: null, rounds: 1, unit: [{ type: 'hold', seconds: 5, cues: [{ at: 0, say: 'go', segment: 'settle', label: 'Settle' }] }] },
  ], { transitions: { exercise: 10 } });
  const phases = expandRoutine(routine);
  assert.deepEqual(phases.map((p) => p.type), ['hold', 'feel', 'transition', 'hold', 'feel']);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  const log = recorder(engine, clock);
  engine.start();
  assert.equal(engine.rate('faded'), false, 'rate() ignored outside a feel screen');
  run(engine, clock, 5);
  assert.equal(engine.index, 1);
  assert.equal(phases[1].seconds, 10);
  run(engine, clock, 10);
  assert.equal(engine.index, 2, 'auto-advanced after 10 s');
  assert.deepEqual(engine.ratings, [{ exerciseId: 'T1', notch: 'soleus', rating: 'held', auto: true }]);
  run(engine, clock, 10 + 5);
  assert.equal(engine.index, 4);
  run(engine, clock, 3);
  assert.equal(engine.rate('faded'), true);
  assert.equal(engine.status, 'finished');
  assert.deepEqual(engine.ratings[1], { exerciseId: 'T2', notch: 'couch', rating: 'faded', auto: false });
  assert.equal(log.ratings.length, 2);
  assert.equal(engine.summary().completed, true);
});

test('skip, back and +15 s move through phases and extend the current one', () => {
  const phases = expandRoutine(ROUTINES.A);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  const log = recorder(engine, clock);
  const t0 = clock.now();
  engine.start();
  engine.skip();
  assert.equal(engine.index, 1);
  assert.equal(log.phases[1].at, t0, 'skipped phase starts now, not at the scheduled time');
  run(engine, clock, 5);
  engine.back();
  assert.equal(engine.index, 0);
  assert.equal(engine.snapshot().elapsed, 0, 'back restarts the previous phase');
  assert.equal(log.ends[log.ends.length - 1].reason, 'back');
  engine.back();
  assert.equal(engine.index, 0, 'back on the first phase restarts it');
  engine.skip();
  assert.equal(engine.index, 1);
  engine.addSeconds(15);
  assert.equal(engine.snapshot().duration, 105);
  run(engine, clock, 104);
  assert.equal(engine.index, 1);
  run(engine, clock, 1.2);
  assert.equal(engine.index, 2);
  assert.equal(phases[2].kind, 'side');
  // Skip while paused keeps the engine paused with a fresh phase.
  engine.pause();
  engine.skip();
  assert.equal(engine.status, 'paused');
  assert.equal(engine.index, 3);
  assert.equal(engine.snapshot().elapsed, 0);
  run(engine, clock, 5);
  assert.equal(engine.snapshot().elapsed, 0);
  engine.resume();
  run(engine, clock, 5);
  assert.ok(Math.abs(engine.snapshot().elapsed - 5) < 0.001);
  const snap = engine.snapshot();
  assert.ok(snap.progress > 0 && snap.progress < 1);
  assert.ok(snap.remainingTotal < totalSeconds(phases));
  assert.equal(snap.remainingTotal + 30 + 105 + 10 + 5, totalSeconds(phases) + 15);
});

test('snapshot exposes header info, segment and rep counter', () => {
  const phases = expandRoutine(ROUTINES.A);
  const clock = fakeClock();
  const engine = new SessionEngine(phases, { now: clock.now });
  engine.start();
  engine.skip();
  let snap = engine.snapshot();
  assert.equal(snap.phase.meta.exerciseIndex, 0);
  assert.equal(snap.phase.meta.exerciseCount, 5);
  assert.equal(snap.phase.meta.set, 1);
  assert.equal(snap.phase.meta.sets, 2);
  assert.equal(snap.phase.meta.side, 'L');
  assert.equal(snap.segment.segment, 'settle');
  run(engine, clock, 65);
  assert.equal(engine.snapshot().segment.segment, 'contract');
  run(engine, clock, 10);
  assert.equal(engine.snapshot().segment.segment, 'sink');
  while (engine.phases[engine.index].type !== 'reps') engine.skip();
  run(engine, clock, 7);
  snap = engine.snapshot();
  assert.deepEqual(snap.rep, { current: 3, total: 5 });
  assert.equal(snap.segment.label, 'Hold');
  assert.equal(snap.segment.rep, 3);
});

test('currentSegment picks the latest passed cue', () => {
  const h = expandRoutine(ROUTINES.A).find((p) => p.meta.exerciseId === 'A1' && p.type === 'hold');
  assert.equal(currentSegment(h, 0).segment, 'settle');
  assert.equal(currentSegment(h, 59.9).segment, 'settle');
  assert.equal(currentSegment(h, 60).segment, 'contract');
  assert.equal(currentSegment(h, 89).segment, 'sink');
  const t = expandRoutine(ROUTINES.A)[0];
  assert.equal(currentSegment(t, 3).label, 'Setup');
});

test('formatClock', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(89.2), '1:30');
  assert.equal(formatClock(90), '1:30');
  assert.equal(formatClock(1400), '23:20');
});

// ---------------------------------------------------------------------------
console.log('\nState, schedule, week tracker');

function memStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}
const D = (s) => S.parseDateKey(s);

test('load defaults, save and reload, survive corrupt JSON', () => {
  const st = memStorage();
  const state = S.loadState(st);
  assert.equal(state.version, 1);
  assert.deepEqual(state.notches, S.defaultNotches());
  assert.equal(state.notches.soleus, NOTCHES.soleus.default);
  state.settings.kettlebellKg = 20;
  state.notches.couch = 12;
  assert.equal(S.saveState(state, st), true);
  const again = S.loadState(st);
  assert.equal(again.settings.kettlebellKg, 20);
  assert.equal(again.notches.couch, 12);
  st.setItem(S.STORAGE_KEY, '{not json');
  assert.deepEqual(S.loadState(st).settings, S.DEFAULT_SETTINGS);
  st.setItem(S.STORAGE_KEY, JSON.stringify({ notches: { soleus: 'abc', couch: '9' }, sessions: [1, 2, { date: '2026-09-28' }] }));
  const n = S.loadState(st);
  assert.equal(n.notches.soleus, NOTCHES.soleus.default);
  assert.equal(n.notches.couch, 9);
  assert.equal(n.sessions.length, 1);
});

test('weekday plan: Mon/Wed A, Tue/Thu B, Fri-Sun off', () => {
  assert.equal(S.planForDay(D('2026-09-28')), 'A');
  assert.equal(S.planForDay(D('2026-09-29')), 'B');
  assert.equal(S.planForDay(D('2026-09-30')), 'A');
  assert.equal(S.planForDay(D('2026-10-01')), 'B');
  assert.equal(S.planForDay(D('2026-10-02')), 'off');
  assert.equal(S.planForDay(D('2026-10-03')), 'off');
  assert.equal(S.planForDay(D('2026-10-04')), 'off');
  assert.equal(S.mondayOf(D('2026-10-04')).getDate(), 28);
  assert.equal(S.mondayOf(D('2026-09-28')).getDate(), 28);
  assert.equal(S.toDateKey(D('2026-09-30')), '2026-09-30');
});

test('next session line', () => {
  assert.equal(S.nextSessionLine(D('2026-09-28')), 'Next: Session B, tomorrow (Tuesday).');
  assert.equal(S.nextSessionLine(D('2026-10-01')), 'Next: Session A, Monday. Off days: optional 3-min squat hang.');
});

function sessionRec(date, routine, completed = true, feels = []) {
  return { id: date + routine, date, startedAt: `${date}T19:30:00.000Z`, routine, completed, durationSeconds: 1400, exercisesCompleted: 5, exercisesTotal: 5, feels, longestSquatChunk: 0, notches: {} };
}

test('week tracker: done / minimum / missed / upcoming, n of 4, off days do not count', () => {
  const state = S.defaultState();
  state.sessions.push(sessionRec('2026-09-28', 'A'));
  state.sessions.push(sessionRec('2026-09-29', 'min'));
  state.sessions.push(sessionRec('2026-09-30', 'A', false));
  state.sessions.push(sessionRec('2026-10-03', 'off'));
  let w = S.weekSummary(state, D('2026-09-30'));
  assert.deepEqual(w.days.map((d) => d.status), ['done', 'minimum', 'upcoming', 'upcoming']);
  assert.deepEqual(w.days.map((d) => d.weekday), ['Mon', 'Tue', 'Wed', 'Thu']);
  assert.equal(w.days[2].isToday, true);
  assert.equal(w.completed, 2);
  assert.equal(w.target, 4);
  w = S.weekSummary(state, D('2026-10-01'));
  assert.deepEqual(w.days.map((d) => d.status), ['done', 'minimum', 'missed', 'upcoming']);
  state.sessions.push(sessionRec('2026-10-01', 'B'));
  state.sessions.push(sessionRec('2026-10-01', 'A'));
  w = S.weekSummary(state, D('2026-10-04'));
  assert.equal(w.completed, 3, 'two sessions on one day count once');
  w = S.weekSummary(state, D('2026-10-05'));
  assert.deepEqual(w.days.map((d) => d.status), ['upcoming', 'upcoming', 'upcoming', 'upcoming']);
  assert.equal(w.completed, 0);
});

test('program week from the first completed session or the setting', () => {
  const state = S.defaultState();
  assert.equal(S.programWeek(state, D('2026-09-30')), null);
  state.sessions.push(sessionRec('2026-09-30', 'off'));
  assert.equal(S.programWeek(state, D('2026-09-30')), null, 'off-day hangs do not start the program');
  state.sessions.push(sessionRec('2026-09-30', 'min', false));
  assert.equal(S.programWeek(state, D('2026-09-30')), null, 'incomplete sessions do not start the program');
  state.sessions.push(sessionRec('2026-09-30', 'A'));
  assert.equal(S.programStartKey(state), '2026-09-30');
  assert.equal(S.programWeek(state, D('2026-09-30')), 1);
  assert.equal(S.programWeek(state, D('2026-10-04')), 1);
  assert.equal(S.programWeek(state, D('2026-10-05')), 2);
  assert.equal(S.programWeek(state, D('2026-11-11')), 7);
  state.settings.programStart = '2026-09-01';
  assert.equal(S.programWeek(state, D('2026-09-30')), 5);
});

test('test days: every other Monday from the test start; baseline missing -> no test day', () => {
  const state = S.defaultState();
  assert.equal(S.isTestDay(state, D('2026-09-28')), false);
  assert.equal(S.nextTestDate(state, D('2026-09-28')), null);
  state.settings.testStart = '2026-09-28';
  assert.equal(S.isTestDay(state, D('2026-09-28')), true);
  assert.equal(S.isTestDay(state, D('2026-09-29')), false);
  assert.equal(S.isTestDay(state, D('2026-10-05')), false);
  assert.equal(S.isTestDay(state, D('2026-10-12')), true);
  assert.equal(S.toDateKey(S.nextTestDate(state, D('2026-09-30'))), '2026-10-12');
  assert.equal(S.toDateKey(S.nextTestDate(state, D('2026-09-28'))), '2026-09-28');
  S.recordTest(state, '2026-09-28', { kneeToWallL: 8 });
  assert.equal(S.toDateKey(S.nextTestDate(state, D('2026-09-28'))), '2026-10-12', 'test already saved today');
  // Derived start from the first saved test, aligned to its Monday.
  const s2 = S.defaultState();
  S.recordTest(s2, '2026-09-30', { kneeToWallL: 8 });
  assert.equal(S.testStartKey(s2), '2026-09-30');
  assert.equal(S.isTestDay(s2, D('2026-10-05')), false);
  assert.equal(S.isTestDay(s2, D('2026-10-12')), true);
});

test('suggestions come from the last rating per notch key across sessions', () => {
  const state = S.defaultState();
  assert.equal(S.suggestionFor(state, 'soleus'), null);
  state.sessions.push(sessionRec('2026-09-28', 'A', true, [{ exerciseId: 'A1', notch: 'soleus', rating: 'faded' }, { exerciseId: 'A5', notch: 'couch', rating: 'held' }]));
  state.sessions.push(sessionRec('2026-09-29', 'B', true, [{ exerciseId: 'B1', notch: 'couch', rating: 'pinch' }]));
  assert.equal(S.suggestionFor(state, 'soleus').action, 'deeper');
  assert.equal(S.suggestionFor(state, 'soleus').text, 'Go one notch deeper today');
  assert.equal(S.suggestionFor(state, 'couch').action, 'backoff');
  assert.equal(S.suggestionFor(state, 'couch').text, 'Back off one notch and change the angle');
  assert.equal(S.suggestionFor(state, 'butterfly'), null);
  const l = S.lastRatings(state);
  assert.equal(l.couch.exerciseId, 'B1');
});

test('notch adjustments respect direction and bounds', () => {
  const state = S.defaultState();
  assert.equal(S.adjustNotch(state, 'soleus', 'deeper'), 9);
  assert.equal(S.adjustNotch(state, 'couch', 'deeper'), 14);
  assert.equal(S.adjustNotch(state, 'couch', 'easier'), 15);
  S.adjustNotch(state, 'ninetyNinety', 'deeper');
  S.adjustNotch(state, 'ninetyNinety', 'deeper');
  assert.equal(S.adjustNotch(state, 'ninetyNinety', 'deeper'), 3, 'clamped at level 3');
  state.notches.squatHang = 0;
  assert.equal(S.adjustNotch(state, 'squatHang', 'deeper'), 0, 'heel lift cannot go below 0');
  assert.equal(S.adjustNotch(state, 'rockback', 1), 1);
  assert.equal(S.formatNotch('ninetyNinety', 2), 'Level 2: hands off');
  assert.equal(S.formatNotch('soleus', 8), 'Foot to wall 8 cm');
  assert.equal(S.formatNotchValue('couch', 15), '15 cm');
});

test('record a session from an engine summary', () => {
  const state = S.defaultState();
  const phases = expandRoutine(ROUTINES.min);
  const clock = fakeClock(Date.UTC(2026, 8, 30, 12, 0, 0));
  const engine = new SessionEngine(phases, { now: clock.now });
  engine.start();
  runToEnd(engine, clock);
  const rec = S.recordSession(state, 'min', engine.summary(), engine.startedAt);
  assert.equal(rec.routine, 'min');
  assert.equal(rec.completed, true);
  assert.equal(rec.exercisesCompleted, 4);
  assert.equal(rec.longestSquatChunk, 180);
  assert.equal(rec.feels.length, 4);
  assert.equal(rec.durationSeconds, totalSeconds(phases));
  assert.equal(state.sessions.length, 1);
  assert.ok(S.isCountedSession(rec));
  const w = S.weekSummary(state, new Date(engine.startedAt));
  assert.equal(w.completed, 1);
});

test('desk phases by program week and daily totals', () => {
  assert.equal(S.deskPhaseForWeek(null).id, 1);
  assert.equal(S.deskPhaseForWeek(1).id, 1);
  assert.equal(S.deskPhaseForWeek(2).id, 1);
  assert.equal(S.deskPhaseForWeek(3).id, 2);
  assert.equal(S.deskPhaseForWeek(6).id, 2);
  assert.equal(S.deskPhaseForWeek(7).id, 3);
  assert.equal(S.deskPhaseForWeek(40).id, 3);
  const state = S.defaultState();
  assert.deepEqual(S.deskDay(state, '2026-09-30'), { slantMinutes: 0, squatHangs: 0, hamstringDone: false });
  S.updateDeskDay(state, '2026-09-28', { slantMinutes: 5 });
  S.updateDeskDay(state, '2026-09-30', { slantMinutes: 8, squatHangs: 3, hamstringDone: true });
  S.updateDeskDay(state, '2026-10-05', { slantMinutes: 100 });
  const t = S.deskWeekTotals(state, D('2026-10-01'));
  assert.deepEqual(t, { slantMinutes: 13, squatHangs: 3, hamstringDays: 1 });
  S.updateDeskDay(state, '2026-09-30', { slantMinutes: -4 });
  assert.equal(S.deskDay(state, '2026-09-30').slantMinutes, 0);
});

test('test history: latest, previous, delta, noise flag', () => {
  const state = S.defaultState();
  S.recordTest(state, '2026-09-28', { kneeToWallL: 8, kneeToWallR: 7.5, squatHoldS: 20, hamstringL: '' });
  S.recordTest(state, '2026-10-12', { kneeToWallL: 9, kneeToWallR: 9.5, squatHoldS: 35 });
  const metrics = S.testMetrics();
  const ktwL = S.metricSummary(state, metrics.find((m) => m.key === 'kneeToWallL'));
  assert.equal(ktwL.latest.value, 9);
  assert.equal(ktwL.previous.value, 8);
  assert.equal(ktwL.delta, 1);
  assert.equal(ktwL.insideNoise, true);
  const ktwR = S.metricSummary(state, metrics.find((m) => m.key === 'kneeToWallR'));
  assert.equal(ktwR.delta, 2);
  assert.equal(ktwR.insideNoise, false);
  const hold = S.metricSummary(state, metrics.find((m) => m.key === 'squatHoldS'));
  assert.equal(hold.delta, 15);
  assert.equal(hold.insideNoise, false);
  const ham = S.metricSummary(state, metrics.find((m) => m.key === 'hamstringL'));
  assert.equal(ham.latest, null);
  assert.equal(ham.history.length, 0);
});

test('export / import round trip and rejection of garbage', () => {
  const state = S.defaultState();
  state.settings.kettlebellKg = 24;
  state.sessions.push(sessionRec('2026-09-28', 'A'));
  S.updateDeskDay(state, '2026-09-28', { slantMinutes: 12 });
  const text = S.exportJSON(state);
  const back = S.importJSON(text);
  assert.deepEqual(back, S.normalizeState(state));
  assert.equal(back.settings.kettlebellKg, 24);
  assert.equal(back.sessions.length, 1);
  assert.throws(() => S.importJSON('42'));
  assert.throws(() => S.importJSON('{"foo":1}'));
  assert.throws(() => S.importJSON('nope'));
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
