// data/routines.js
// All program content: rules, notches, routines, desk phases, tests.
// Pure data. No DOM, no imports. Edit here to change a routine.
//
// Exercise shape:
//   id, name, short, notch (key into NOTCHES), setup ({kb} = kettlebell kg from Settings),
//   intensity, dose (display string), notchNote,
//   sides: ['L','R'] or null, rounds: how many times the side list repeats,
//   unit: ordered blocks done per side per round:
//     { type: 'hold', seconds, cues: [{ at, say, label, segment }] }
//     { type: 'reps', reps, secondsPerRep, label, instruction }
//     { type: 'accumulate', seconds (target), reminderEvery, reminder, startSay }
//   rest: { seconds, say } inserted between unsided rounds (side switches are automatic).
//
// Segments drive the on-screen phase name and colour: settle, contract, sink.

export const RULES = [
  {
    id: 'intensity',
    title: 'Intensity',
    text: 'Intensity 0-10, where 10 is the worst you would tolerate. Settle at 6-7 for the first 60 s of a hold (slow breathing, jaw loose). After the contract-relax, let the last 20-30 s creep to 8. Squat hangs 5-6. Desk exposures 4-6. Never sharp, never a joint pinch.',
  },
  {
    id: 'cr',
    title: 'Contract-relax (CR)',
    text: 'At the cued time, push into the floor or wall for 10 s at 30-50% effort, let go, exhale, sink deeper, finish the hold.',
  },
  {
    id: 'progression',
    title: 'Progression',
    text: 'If the hold has faded to 4/10 or less by the end, go one notch deeper next session. A notch is 1 cm, one block lower, or a heavier kettlebell. Depth before load.',
  },
  {
    id: 'pinch',
    title: 'Bony pinch',
    text: 'A sharp pinch or a hard block inside the joint means back off and change the angle. It is not a sign to push harder.',
  },
  {
    id: 'rest',
    title: 'Rest',
    text: 'Alternating sides is the rest. No rest periods except the listed transitions.',
  },
];

// One current value per shared key. `deeper` is the delta that makes the
// exercise harder (+1 or -1). Levels, when present, describe integer values.
export const NOTCHES = {
  soleus: {
    name: 'Soleus',
    label: 'Foot to wall',
    unit: 'cm',
    deeper: 1,
    min: 0,
    default: 8,
    hint: 'Bigger is deeper. Distance first, then kettlebell kg (Settings).',
  },
  squatHang: {
    name: 'Squat hang',
    label: 'Heel lift',
    unit: 'cm',
    deeper: -1,
    min: 0,
    default: 2,
    hint: '0 = flat. Order: heel lift to 0, then a lighter counterweight, then none.',
  },
  ninetyNinety: {
    name: '90/90',
    label: 'Level',
    unit: '',
    deeper: 1,
    min: 1,
    max: 3,
    default: 1,
    levels: { 1: 'hands on the floor', 2: 'hands off', 3: 'light kettlebell hugged at the chest' },
  },
  rockback: {
    name: 'Adductor rockback',
    label: 'Width notch',
    unit: '',
    deeper: 1,
    min: 0,
    default: 0,
    hint: '+1 = slide the straight leg 1-2 cm wider.',
  },
  couch: {
    name: 'Couch stretch',
    label: 'Knee to wall',
    unit: 'cm',
    deeper: -1,
    min: 0,
    default: 15,
    hint: 'Smaller is deeper. Then torso upright, then front foot farther forward.',
  },
  hamstring: {
    name: 'Hamstring',
    label: 'Level',
    unit: '',
    deeper: 1,
    min: 1,
    default: 1,
    levels: { 1: 'chair seat', 2: 'desk-height edge', 3: 'desk edge, deeper hinge', 4: 'desk edge, kettlebell at the chest' },
    hint: 'Past level 4, each notch is a heavier kettlebell.',
  },
  sideSplit: {
    name: 'Side split',
    label: 'Width notch',
    unit: '',
    deeper: 1,
    min: 0,
    default: 0,
    hint: '+1 = 1-2 cm wider. Crotch-to-floor height is measured on the Tests page.',
  },
  butterfly: {
    name: 'Butterfly',
    label: 'Heels from groin',
    unit: 'cm',
    deeper: -1,
    min: 5,
    default: 30,
    hint: 'Smaller is harder.',
  },
};

// ---- Cue timelines --------------------------------------------------------

const settle = (say) => ({ at: 0, say, label: 'Settle', segment: 'settle' });

const SOLEUS_CUES = [
  settle('Settle at 7. Slow breathing, jaw loose.'),
  { at: 60, say: 'Contract: press the ball of the foot down, 10 seconds', label: 'Contract', segment: 'contract' },
  { at: 70, say: 'Relax, exhale, sink. Let it creep to 8', label: 'Sink', segment: 'sink' },
];

const ROCKBACK_CUES = [
  settle('Settle at 6 to 7.'),
  { at: 60, say: 'Contract: press the straight-leg foot into the floor, 10 seconds', label: 'Contract', segment: 'contract' },
  { at: 70, say: 'Relax and sink', label: 'Sink', segment: 'sink' },
];

const COUCH_LONG_CUES = [
  settle('Settle at 7. Glute squeezed, ribs down.'),
  { at: 60, say: 'Press the foot into the wall, 10 seconds', label: 'Press', segment: 'contract' },
  { at: 70, say: 'Squeeze the rear glute hard, 10 seconds', label: 'Squeeze', segment: 'contract' },
  { at: 80, say: 'Relax and sink, 40 seconds', label: 'Sink', segment: 'sink' },
];

const COUCH_CR_CUES = [
  settle('Settle at 7. Glute squeezed, ribs down.'),
  { at: 50, say: 'Press the foot into the wall, 10 seconds', label: 'Press', segment: 'contract' },
  { at: 60, say: 'Squeeze the glute, 10 seconds', label: 'Squeeze', segment: 'contract' },
  { at: 70, say: 'Relax and sink, 20 seconds', label: 'Sink', segment: 'sink' },
];

const COUCH_MIN_CUES = [
  settle('Settle at 7. Glute squeezed, ribs down.'),
  { at: 30, say: 'Press the foot into the wall, 10 seconds', label: 'Press', segment: 'contract' },
  { at: 40, say: 'Squeeze the glute, 10 seconds', label: 'Squeeze', segment: 'contract' },
  { at: 50, say: 'Relax and sink, 10 seconds', label: 'Sink', segment: 'sink' },
];

const HAMSTRING_CUES = [
  settle('Settle at 6 to 7. Flat back, hips square.'),
  { at: 60, say: 'Contract: press the heel down into the chair, 10 seconds', label: 'Contract', segment: 'contract' },
  { at: 70, say: 'Relax and sink', label: 'Sink', segment: 'sink' },
];

const SIDE_SPLIT_CUES = [
  settle('Slide the feet apart to 6 to 7. Pelvis slightly forward.'),
  { at: 30, say: 'Squeeze the feet toward each other, 10 seconds, then relax and slide 1 to 2 cm wider', label: 'Squeeze', segment: 'contract' },
  { at: 40, say: 'Relax, slide wider', label: 'Sink', segment: 'sink' },
  { at: 60, say: 'Squeeze the feet toward each other, 10 seconds, then relax and slide 1 to 2 cm wider', label: 'Squeeze', segment: 'contract' },
  { at: 70, say: 'Relax, slide wider', label: 'Sink', segment: 'sink' },
];

const BUTTERFLY_CUES = [
  settle('Sit tall, soles together. Forearms press the knees down. Intensity 6.'),
  { at: 30, say: 'Lift the knees into the forearms, 5 seconds, then relax', label: 'Lift', segment: 'contract' },
  { at: 35, say: 'Relax', label: 'Sink', segment: 'sink' },
  { at: 60, say: 'Lift the knees into the forearms, 5 seconds, then relax', label: 'Lift', segment: 'contract' },
  { at: 65, say: 'Relax', label: 'Sink', segment: 'sink' },
  { at: 90, say: 'Lift the knees into the forearms, 5 seconds, then relax', label: 'Lift', segment: 'contract' },
  { at: 95, say: 'Relax', label: 'Sink', segment: 'sink' },
];

const NINETY_CUES = [settle('Settle at 6 to 7. Hinge the chest over the front shin, back hip down.')];

// ---- Shared setups ----------------------------------------------------------

const SOLEUS_SETUP =
  'Half-kneel facing the wall, front foot flat. Kettlebell ({kb} kg) on the front thigh near the knee. Drive the knee forward over the middle toes, heel down.';
const SQUAT_SETUP =
  'Feet shoulder-width, toes slightly out. Heels on a 1-3 cm lift if needed. Kettlebell ({kb} kg) held at arm\'s length in front as a counterweight. Shift side to side, pry the knees out with the elbows.';
const NINETY_SETUP =
  'Sit in 90/90, front shin parallel to the chest. Hinge the chest over the front shin with a long spine. Keep the back hip down.';
const COUCH_SETUP =
  'Back knee at the wall or chair corner on the folded mat, shin up the wall, glute squeezed, ribs down, torso tall.';

// ---- Exercise builders --------------------------------------------------------

function soleus(id, rounds) {
  return {
    id,
    name: 'Loaded Soleus Hold',
    short: 'Soleus',
    notch: 'soleus',
    setup: SOLEUS_SETUP,
    intensity: 'Settle at 7 for 60 s. After the contract-relax, let it creep to 8.',
    dose: rounds === 2 ? '4 x 90 s, alternating L, R, L, R' : '90 s per side, L then R',
    notchNote: 'Foot distance from the wall in cm (bigger is deeper). Secondary: kettlebell kg. Distance first, load second.',
    sides: ['L', 'R'],
    rounds,
    unit: [{ type: 'hold', seconds: 90, cues: SOLEUS_CUES }],
  };
}

function squatHang(id, targetSeconds, extraNote) {
  const min = targetSeconds / 60;
  return {
    id,
    name: 'Squat Hang',
    short: 'Squat hang',
    notch: 'squatHang',
    setup: SQUAT_SETUP,
    intensity: 'Intensity 5-6.' + (extraNote ? ' ' + extraNote : ''),
    dose: `Accumulate ${min}:00. Log the longest unbroken chunk.`,
    notchNote: 'Heel lift cm (0 = flat) and counterweight kg (0 = none). Order: heel lift to 0, then lighter counterweight, then none.',
    sides: null,
    rounds: 1,
    unit: [
      {
        type: 'accumulate',
        seconds: targetSeconds,
        reminderEvery: 60,
        reminder: 'Shift side to side, pry the knees out.',
        startSay: `Squat hang. Accumulate ${min} minute${min === 1 ? '' : 's'} at 5 to 6. Pause when you need to stand.`,
      },
    ],
  };
}

function ninetyHold(id, seconds, withLiftOffs) {
  const unit = [{ type: 'hold', seconds, cues: NINETY_CUES }];
  if (withLiftOffs) {
    unit.push({
      type: 'reps',
      reps: 5,
      secondsPerRep: 3,
      label: 'Lift-offs',
      instruction: 'Lift the back leg, no hands. Lift, hold, down.',
    });
  }
  return {
    id,
    name: withLiftOffs ? '90/90 Loaded Hold + Lift-Offs' : '90/90 Hold',
    short: withLiftOffs ? '90/90 + lift-offs' : '90/90',
    notch: 'ninetyNinety',
    setup: NINETY_SETUP + (withLiftOffs ? ' After the hold: 5 lift-offs of the back leg, 3 s each, no hands.' : ' Hold only.'),
    intensity: 'Settle at 6-7. No contract-relax.',
    dose: withLiftOffs ? `${seconds} s hold + 5 lift-offs per side, L then R` : `${seconds} s per side, L then R`,
    notchNote: 'Levels: 1 = hands on the floor, 2 = hands off, 3 = light kettlebell hugged at the chest.',
    sides: ['L', 'R'],
    rounds: 1,
    unit,
  };
}

function couch(id, name, seconds, rounds, cues, dose) {
  return {
    id,
    name,
    short: 'Couch',
    notch: 'couch',
    setup: COUCH_SETUP,
    intensity: 'Settle at 7. Creep to 8 in the final sink.',
    dose,
    notchNote: 'Knee distance from the wall in cm (smaller is deeper), then torso upright, then front foot farther forward.',
    sides: ['L', 'R'],
    rounds,
    unit: [{ type: 'hold', seconds, cues }],
  };
}

// ---- Routines ---------------------------------------------------------------

const SETUP = { seconds: 30, say: 'Mat out, kettlebell ready, shoes off.' };

export const ROUTINES = {
  A: {
    id: 'A',
    name: 'Session A',
    focus: 'Squat / Ankle / Turnout',
    days: [1, 3],
    countsTowardWeek: true,
    setup: SETUP,
    exercises: [
      soleus('A1', 2),
      squatHang('A2', 240),
      ninetyHold('A3', 90, true),
      {
        id: 'A4',
        name: 'Adductor Rockback',
        short: 'Rockback',
        notch: 'rockback',
        setup: 'Hands and knees, one leg straight out to the side, foot flat. Sit the hips back toward the heel.',
        intensity: 'Settle at 6-7.',
        dose: '90 s per side, L then R',
        notchNote: 'Integer notch. +1 = slide the straight leg 1-2 cm wider.',
        sides: ['L', 'R'],
        rounds: 1,
        unit: [{ type: 'hold', seconds: 90, cues: ROCKBACK_CUES }],
      },
      couch('A5', 'Couch Stretch (long)', 120, 1, COUCH_LONG_CUES, '120 s per side, L then R'),
    ],
  },
  B: {
    id: 'B',
    name: 'Session B',
    focus: 'Splits / Turnout',
    days: [2, 4],
    countsTowardWeek: true,
    setup: SETUP,
    exercises: [
      couch('B1', 'Couch Stretch CR', 90, 2, COUCH_CR_CUES, '4 x 90 s, alternating L, R, L, R'),
      {
        id: 'B2',
        name: 'Elevated Hamstring Hold',
        short: 'Hamstring',
        notch: 'hamstring',
        setup: 'Heel on a chair seat that does not roll, leg straight, toes up. Hinge forward with a flat back, hips square. Optional kettlebell hugged at the chest.',
        intensity: 'Settle at 6-7.',
        dose: '4 x 90 s, alternating L, R, L, R',
        notchNote: 'Levels: 1 = chair seat, 2 = desk-height edge; then deeper hinge; then kettlebell kg.',
        sides: ['L', 'R'],
        rounds: 2,
        unit: [{ type: 'hold', seconds: 90, cues: HAMSTRING_CUES }],
      },
      {
        id: 'B3',
        name: 'Supported Side-Split Slide',
        short: 'Side split',
        notch: 'sideSplit',
        setup: 'Face the desk, hands on it, feet wide, toes forward. Slide the feet apart until 6-7/10, pelvis slightly forward. Sliders on carpet; at home, socks on bare floor.',
        intensity: 'Settle at 6-7.',
        dose: '2 x 90 s, 20 s rest between',
        notchNote: 'Integer notch. +1 = 1-2 cm wider. Crotch-to-floor height is measured on the Tests page, not here.',
        sides: null,
        rounds: 2,
        rest: { seconds: 20, say: 'Stand up, shake out' },
        unit: [{ type: 'hold', seconds: 90, cues: SIDE_SPLIT_CUES }],
      },
      {
        id: 'B4',
        name: 'Loaded Butterfly',
        short: 'Butterfly',
        notch: 'butterfly',
        setup: 'Sit tall against the wall, soles together, heels 20-30 cm from the groin. Forearms press the knees down.',
        intensity: 'Intensity 6.',
        dose: 'One 120 s hold',
        notchNote: 'Heel distance from the groin in cm (smaller is harder).',
        sides: null,
        rounds: 1,
        unit: [{ type: 'hold', seconds: 120, cues: BUTTERFLY_CUES }],
      },
      ninetyHold('B5', 90, false),
      squatHang('B6', 120),
    ],
  },
  min: {
    id: 'min',
    name: 'Minimum',
    focus: 'Bad-day dose',
    days: [],
    countsTowardWeek: true,
    setup: SETUP,
    transitions: { side: 5, exercise: 10 },
    exercises: [
      squatHang('M1', 180, 'Any counterweight or heel lift.'),
      soleus('M2', 1),
      couch('M3', 'Couch Stretch', 60, 1, COUCH_MIN_CUES, '60 s per side, L then R'),
      ninetyHold('M4', 45, false),
    ],
  },
  off: {
    id: 'off',
    name: 'Off-day Squat Hang',
    focus: 'Optional. Fri to Sun',
    days: [5, 6, 0],
    countsTowardWeek: false,
    setup: { seconds: 10, say: 'Kettlebell ready, shoes off.' },
    transitions: { side: 5, exercise: 10 },
    exercises: [squatHang('O1', 180, 'Any counterweight or heel lift.')],
  },
};

export const SCHEDULE = [
  { day: 'Mon', text: 'Session A' },
  { day: 'Tue', text: 'Session B' },
  { day: 'Wed', text: 'Session A' },
  { day: 'Thu', text: 'Session B' },
  { day: 'Fri to Sun', text: 'Off. Optional 3-min squat hang' },
];

export const SCHEDULE_NOTE = 'Sessions at the 7:30 pm break. Test days add 5 min.';

export const EXPECTATIONS = [
  'Knee-to-wall gains in 4-8 weeks. Flat-footed unsupported squat in 3-6 months, effortless in 6-12. Turnout control in 6-12 weeks. Front split 12-24 months. Side split 18-36 months, or not possible if the hip bones block it; the tests will tell.',
  'Missed days do not erase you (Konrad 2025). Do the next session.',
];

// Desk micro-dose phases by program week. dailyTargetMinutes is the number used
// for the progress bar; targetLabel is what the user reads.
export const DESK_PHASES = [
  {
    id: 1,
    weeks: 'Weeks 1-2',
    fromWeek: 1,
    toWeek: 2,
    text: 'Lowest incline, one foot on the board, the other on the floor. 2 min per foot knee straight, then 1 min knee slightly bent (soleus). 4-6 bouts per shift. Intensity 4-5.',
    dailyTargetMinutes: 15,
    targetLabel: '4-6 bouts, about 15 min',
    boutMinutes: 3,
  },
  {
    id: 2,
    weeks: 'Weeks 3-6',
    fromWeek: 3,
    toWeek: 6,
    text: 'Both feet, 3-5 min bouts, 6-10 bouts per shift, working toward 30 min per shift.',
    dailyTargetMinutes: 30,
    targetLabel: '6-10 bouts, toward 30 min',
    boutMinutes: 5,
  },
  {
    id: 3,
    weeks: 'Week 7+',
    fromWeek: 7,
    toWeek: Infinity,
    text: '45-60 min per day in bouts. Raise the incline one notch when the lowest setting feels like 3/10.',
    dailyTargetMinutes: 45,
    targetLabel: '45-60 min',
    boutMinutes: 5,
  },
];

export const DESK_NOTE =
  'Slant board minutes count fully toward calves. Squat hangs count toward soleus, hip flexion and partly adductors. At 30-60 min per day the desk volume dwarfs the session volume, which is intended.';

export const DESK_SQUAT = { target: '4-6 per shift', note: 'Counterweight and heel lift allowed.', timerSeconds: 90 };
export const DESK_HAMSTRING = { secondsPerSide: 60, note: 'Heel on a chair, 1 min per side, once per shift.' };

// Tests. Each field becomes an input; `metrics` are the history rows.
export const TESTS = [
  {
    id: 'kneeToWall',
    name: 'Knee-to-wall',
    howTo: 'Big toe X cm from the wall, knee touches the wall, heel stays down. Record the max cm for each side.',
    target: '11-12+ cm',
    noise: 1.5,
    fields: [
      { key: 'kneeToWallL', label: 'Left', unit: 'cm', step: 0.5 },
      { key: 'kneeToWallR', label: 'Right', unit: 'cm', step: 0.5 },
    ],
  },
  {
    id: 'squatLadder',
    name: 'Squat ladder',
    howTo: 'Longest unbroken flat-foot hold with no counterweight (use the stopwatch). Then the lightest counterweight kg or lowest heel lift cm that allows a relaxed 60 s.',
    target: '60 s relaxed, no weight, flat',
    stopwatch: 'squatHoldS',
    fields: [
      { key: 'squatHoldS', label: 'Flat, no weight', unit: 's', step: 1 },
      { key: 'squatAssistKg', label: 'Lightest counterweight for 60 s', unit: 'kg', step: 1 },
      { key: 'squatHeelCm', label: 'Lowest heel lift for 60 s', unit: 'cm', step: 0.5 },
    ],
  },
  {
    id: 'hipRotation',
    name: 'Hip ER and IR',
    howTo: 'Sit on the desk edge, knees at 90°. Phone inclinometer on the shin; rotate the shin in (ER) and out (IR). Degrees per side.',
    target: 'Symmetry; track the trend',
    fields: [
      { key: 'hipErL', label: 'ER left', unit: '°', step: 1 },
      { key: 'hipErR', label: 'ER right', unit: '°', step: 1 },
      { key: 'hipIrL', label: 'IR left', unit: '°', step: 1 },
      { key: 'hipIrR', label: 'IR right', unit: '°', step: 1 },
    ],
  },
  {
    id: 'frontSplit',
    name: 'Front split height',
    howTo: 'Blocks under the front-hip crease. Measure cm from the floor (or count blocks and stay consistent).',
    target: 'Floor',
    fields: [
      { key: 'frontSplitL', label: 'Left leg forward', unit: 'cm', step: 0.5 },
      { key: 'frontSplitR', label: 'Right leg forward', unit: 'cm', step: 0.5 },
    ],
  },
  {
    id: 'sideSplit',
    name: 'Side split height',
    howTo: 'Crotch-to-floor cm in the B3 position (hands on the desk, feet wide, toes forward).',
    target: 'Trend down',
    fields: [{ key: 'sideSplitCm', label: 'Crotch to floor', unit: 'cm', step: 0.5 }],
  },
  {
    id: 'hamstring',
    name: 'Hamstring',
    howTo: 'Lie on the back, phone on the shin, raise the straight leg. Record degrees per side.',
    target: 'Trend up',
    fields: [
      { key: 'hamstringL', label: 'Left', unit: '°', step: 1 },
      { key: 'hamstringR', label: 'Right', unit: '°', step: 1 },
    ],
  },
];

export const TEST_SCHEDULE_TEXT =
  'Every other Monday, in the first 5 minutes of the session, after 2 minutes of walking. Same time, shoes off.';
