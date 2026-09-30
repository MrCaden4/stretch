// data/guide.js
// Guide text. Pulled from docs/program.md (the canonical long-form source) and
// tightened. Every fact and number is kept. Blocks:
//   { t: 'p', text }  { t: 'ul', items }  { t: 'ol', items }
//   { t: 'h', text }  { t: 'table', head: [], rows: [[]] }
// **bold** inside text renders as <strong>. No other markup.

export const GUIDE = [
  {
    id: 'why',
    title: 'Why this program',
    blocks: [
      {
        t: 'p',
        text: 'The old routine gave about 5 min per side per week of real calf end-range time, cut into 5 s pieces, about 5 min of hip flexor stretch, zero hamstring, and almost zero static adductor or hip-rotator stretch. Evidence thresholds start at 5-10 min per muscle group per week of actual stretch time (Thomas et al. 2018; Ingram et al. 2024), so it was under-dosed and aimed at the wrong things. Over a year it could plausibly improve the squat a little. It could not produce splits.',
      },
      {
        t: 'p',
        text: '**The fix:** targeted, high-frequency static stretching of the specific limiters. Holds of 90 s to 3 min at 6-7/10, loaded or contract-relax where useful, 10+ min per muscle group per side per week. Plus heavy calf and squat-position exposure at the standing desk (30-60 min a day approaches the 1-hour-a-day doses that produced structural change in Warneke\'s calf studies), and full-range lifting as the strength-at-length layer.',
      },
      {
        t: 'p',
        text: 'An A/B split, 4 days a week at the 7:30 pm break: Mon/Wed Session A (squat, ankle, turnout), Tue/Thu Session B (splits, turnout). Every muscle group gets 10+ min per side per week.',
      },
      { t: 'h', text: 'Goals, in order' },
      {
        t: 'ol',
        items: [
          'Unsupported flat-footed resting squat, eventually effortless.',
          'Hip turnout and rotation for figure skating, lower-body mobility for surfing.',
          'Front split, and side split if the hips allow.',
          'Lifelong maintenance.',
        ],
      },
    ],
  },
  {
    id: 'why-little',
    title: 'Why years of stretching gave little',
    blocks: [
      {
        t: 'p',
        text: '**Dose.** Gains appear at about 5+ min per muscle per week with daily-ish frequency. Thomas et al. 2018 (Int J Sports Med, 23 studies): at least 5 days a week and at least 5 min per week per muscle. Ingram et al. 2024 (Sports Medicine, 189 studies, 6,654 adults): a large chronic effect (Hedges\' g = 0.96), gains maximized around 4 min per session and 10 min per week. Mendez-Rebolledo et al. 2026 hamstring dose-response (Annals of Physical and Rehabilitation Medicine, 84 trials): a single 1.5 min dose did not clear the 12° measurement-error threshold; about 70 min accumulated over at least a week was more likely to. Most people who "stretch a lot" do 20-30 s holds of random muscles a few days a week and never add up the minutes.',
      },
      {
        t: 'p',
        text: '**Targets.** In men, bent-knee ankle dorsiflexion (the soleus) and hip flexion were the main predictors of squat depth, together explaining 43.5% of the variance (Kim et al. 2015, Journal of Human Kinetics, 101 people). Generic stretching goes to the hamstrings, which barely matter for a resting squat.',
      },
      {
        t: 'p',
        text: '**Bone.** Part of a side-split limit, and possibly the right-hip turnout limit, can be skeletal. Stretching cannot fix that. It is a reason to test, not to quit.',
      },
    ],
  },
  {
    id: 'what-changes',
    title: 'What actually changes',
    blocks: [
      {
        t: 'p',
        text: '**Stretch tolerance is real and counts.** Weppler and Magnusson 2010 (Physical Therapy): gains after 3-8 week programs come mostly from changed sensation (the sensory theory), not longer muscle. Ingram et al. 2025 mechanisms meta-analysis (Sports Medicine): chronic static stretching raises stretch tolerance and lowers overall stiffness, both linked to range gains; fascicle length (how long the fibres are) did not change. Early gains are the nervous system allowing more range. That is usable range, not a trick.',
      },
      {
        t: 'p',
        text: '**Structural change needs big doses.** Warneke et al. 2022 (Frontiers in Physiology) stretched the calves 1 hour a day for 6 weeks with an orthosis and found real strength and muscle-thickness gains. Warneke et al. 2023 (European Journal of Applied Physiology) summarizes about 15.3% hypertrophy (d = 0.84) at 1 hour a day, 7 days a week, and strength gains of up to 22% (the 22% came from 2 hours a day and was not significantly better than 1 hour), at 8/10 intensity. Panidi et al. 2021 (Frontiers in Physiology; 21 adolescent female volleyball players, calf stretching 5x per week for 12 weeks) found fascicle length gains that held after detraining. Nakamura\'s group 2021 (Frontiers in Physiology): 30 min twice a week for 5 weeks (3,600 s per week) improved dorsiflexion and stiffness, but values returned to baseline after 5 weeks off.',
      },
      {
        t: 'p',
        text: '**Conflict to know about.** Ingram 2024 found no extra benefit past 10 min per week and no effect of intensity or frequency. Thomas 2018 found frequency matters. Warneke found structural change only at very high volume. Likely reconciliation: most trials are 4-8 weeks of ordinary range in untrained people, not splits-level range in a stiff adult. Past about 10 min per week this program relies on high-volume calf studies and coach experience.',
      },
      {
        t: 'p',
        text: '**Detraining is forgiving.** Konrad et al. 2025 (Sports Medicine - Open, 13 studies, 556 people): large gains from stretch training (ES 0.93), a small loss after 2-6 weeks off (ES -0.41), range still above baseline (ES 0.55). A missed week does not erase you.',
      },
    ],
  },
  {
    id: 'intensity',
    title: 'Intensity: how hard to stretch',
    blocks: [
      {
        t: 'ul',
        items: [
          'Ingram 2024: intensity did not moderate chronic gains.',
          'Acutely, high-intensity short stretching (120% of max tolerance, 100 s) beat low-intensity long stretching (50%, 240 s) at the same total load: +6.1° vs +3.6° dorsiflexion (Fukaya and Nakamura\'s group).',
          'Apostolopoulos et al. 2015: stretching at 90% of max range (pain) caused an inflammatory response; 30-60% did not.',
          'Discomfort lowers enjoyment, which kills adherence, and adherence is the known failure point.',
        ],
      },
      {
        t: 'p',
        text: '**Rule:** settle at 6-7 for the first 60 s (you can breathe slowly and talk). At 8-9 the muscle guards and you cannot stay relaxed for the 90-120 s that produces gains. After the contract-relax, let the last 20-30 s creep to 8. Squat hangs 5-6. Desk exposures 4-6. Never sharp, never a joint pinch.',
      },
    ],
  },
  {
    id: 'ranking',
    title: 'Method ranking for long-term flexibility in a lifter',
    blocks: [
      {
        t: 'table',
        head: ['Rank', 'Method', 'Evidence', 'Verdict'],
        rows: [
          [
            '1',
            'Static stretching (incl. loaded), with contract-relax (PNF) on key holds',
            'Konrad 2024 (JSHS, 77 studies): static and PNF beat dynamic and ballistic; static vs PNF no different (p = 0.28), PNF ES -1.280 vs static -1.005. Mendez-Rebolledo 2026: PNF +3.18° over static on hamstrings, below the 12° error threshold, low certainty. Borges 2018: no significant chronic difference (-2.56°).',
            'Core of the program',
          ],
          [
            '2',
            'Resistance training through full range, at long muscle lengths',
            'Alizadeh 2023 (Sports Medicine): RT improves range (ES 0.73), no different from stretching. Afonso 2021 (Healthcare, 11 RCTs, n = 452): no difference (ES -0.22, 95% CI -0.55 to 0.12). Favro 2025 (JSCR): RT ES 0.73 vs control, 0.08 vs stretching.',
            'The lifting layer. Never shown to produce splits-level range',
          ],
          [
            '3',
            'Long-duration, high-volume stretching (Warneke-style)',
            'Only strong for calves; the only route to structural change.',
            'Delivered by the desk slant board',
          ],
          [
            '4',
            'Loaded progressive and coach splits systems (Emmet Louis, Tom Merrick, Kurz)',
            'Coach opinion, no trials.',
            'Borrowed for the splits drills',
          ],
          [
            '5',
            'FRC PAILs/RAILs, end-range isometrics',
            'No published controlled trial in healthy adults. The only registered FRC trial (NCT03456050, 56 low-back-pain patients) has no results. A 2025 study in the International Journal of Exercise Science (n = 28) tested CARs, not PAILs, found only acute hip internal-rotation gains and looked no better than static stretching. Long-length isometrics grow muscle (Oranchuk 2019), but range was not measured.',
            'Plausible because it resembles PNF; unproven; poor range return per minute',
          ],
          ['6', 'Dynamic and ballistic', 'Konrad 2024: inferior for chronic range.', 'Warm-up only'],
          [
            '7',
            'Foam rolling',
            'Konrad 2022: chronic ES 0.82, but only after more than 4 weeks and only on quads and hamstrings, not calves.',
            'Skip',
          ],
        ],
      },
      {
        t: 'p',
        text: '**Why the runners-up lost.** Resistance training alone matches stretching for modest range in trials, but you already lift heavy through full range and still cannot squat flat, so more of it will not close an end-range gap. FRC has no trials and spends the minutes on 5 s contractions instead of time under stretch. Coach splits systems are good but need 30-60 min sessions and floor space. Pure Warneke-style dosing works but only for calves, which is exactly why the slant board carries it.',
      },
    ],
  },
  {
    id: 'squat',
    title: 'Deep squat: what limits you, in order',
    blocks: [
      {
        t: 'ol',
        items: [
          '**Ankle dorsiflexion (almost certainly #1).** If the lowest slant board incline is brutal, you are likely below normal. For men under 50, the middle 50% on the knee-to-wall test is about 8-14 cm. A 2009 Journal of Physical Therapy Science study of 71 healthy men found body weight and dorsiflexion were associated with the ability to deep squat; the cutoffs that best matched deep squatting were 10.75 cm (right) and 11.25 cm (left). Target: 11-12+ cm per side. Bent-knee dorsiflexion (soleus) matters most for men (Kim 2015).',
          '**Hip flexion and internal rotation.** A 2020 Journal of Physical Therapy Science motion-analysis study of 9 healthy men measured about 124-125° of hip flexion in a deep squat, with ankle dorsiflexion of about 23-26°.',
          '**Center of mass and proportions.** At 6\'0"-6\'1" you likely have long femurs, which pushes the center of mass behind the heels at the bottom. If a kettlebell counterweight lets you sit flat but you tip backward without it, the remaining gap is a few centimeters of ankle range plus balance, not the hips.',
          '**Soft-tissue approximation** (calf meeting hamstring) is the normal end point of a good squat, not a limiter.',
        ],
      },
      {
        t: 'p',
        text: '**Training the position vs the parts.** There are no trials of "hang out in a squat for 30 minutes a day" protocols (Ido Portal\'s squat challenge is coach opinion only). But the squat hold loads the number-one limiter, bent-knee dorsiflexion, in the exact goal shape, and it builds minutes cheaply. Do both: component stretching for the soleus, plus accumulated squat time.',
      },
      {
        t: 'p',
        text: '**"Squatting makes me mobile all day."** Behm et al. 2016 (Applied Physiology, Nutrition, and Metabolism) found acute range gains from all stretching forms typically last under 30 min. The all-day feeling is probably partly perceptual: less stiffness sensation and warmth. Either way it argues for squatting often, which the desk plan does.',
      },
    ],
  },
  {
    id: 'turnout',
    title: 'Hip turnout and the right hip',
    blocks: [
      {
        t: 'ul',
        items: [
          'An IADMS resource paper states that on average 60% of turnout comes from outward rotation of the hip. The rest comes from the knee, tibia (tibial torsion is bone) and foot.',
          'Pata et al. 2014 (Journal of Dance Medicine & Science, 6 dancers): targeted training raised Total Active Turnout by an average of 14°. That is mostly better use and control of existing range.',
          'Dancers used only 70-83% of their available hip external rotation in a 2020 study of 23 pre-professional dancers (Medical Problems of Performing Artists). Strength at end range (90/90 lift-offs, seated external-rotation holds) is trainable even when passive range is not.',
          '**Bony factor:** increased femoral anteversion (the angle of twist in the thigh bone) restricts external rotation, while retroverted hips maximize it (Clinical Biomechanics 2022). The 90° right-foot limit on mohawks could be muscle and capsule, femoral version, or tibial torsion. The right-hip check (below, and on the Tests page) tells you which.',
        ],
      },
    ],
  },
  {
    id: 'splits',
    title: 'Splits: front vs side',
    blocks: [
      {
        t: 'ul',
        items: [
          '**Front split is far more attainable for an adult man.** It is limited by the back leg\'s hip flexors and hip capsule (iliofemoral ligament) and by the front leg\'s hamstrings. These are soft tissues that respond to training.',
          '**Side split** needs about 90° of abduction per hip with the pelvis tilted forward. Coaching sources summarizing a 2020 cadaveric study by Han and colleagues report bony impingement in healthy hips during high abduction combined with flexion; the primary paper was only available secondhand. Acetabular depth and orientation, femoral neck angle and version all vary. Some coaches (Dani Winks) argue true bony blocks are rarer than claimed. Treat it as unknown until tested.',
        ],
      },
      { t: 'h', text: 'Coach protocols (coach opinion, no trials)' },
      {
        t: 'ul',
        items: [
          'Emmet Louis\'s loaded progressive stretching: about 20 reps into the "hard stop," then hold the last rep 60-90 s.',
          'Ido Portal\'s version, as others describe it: 10 reps, then a 10 s hold.',
          'Emmet recommends holding calf stretches at least 2 min per side, and up to 6 min for very tight calves.',
          'Tom Merrick\'s middle-split routine (based on Emmet\'s work): weighted tailor pose 10 reps + 30-60 s, weighted horse stance 10 reps + 10-30 s, 3-5 sets, twice a week, adding a set weekly and deloading in week 4.',
          'Emmet\'s front-split rule of thumb: build a long lunge with the front thigh parallel to the ground first.',
        ],
      },
    ],
  },
  {
    id: 'bone-vs-muscle',
    title: 'Bone vs muscle: how to tell',
    blocks: [
      {
        t: 'p',
        text: '**Muscular or soft tissue:** the stretch is felt in the belly of the muscle (inner thigh, buttock). The end point is springy and shifts with warm-up, time of day and contract-relax. Numbers creep over months.',
      },
      { t: 'p', text: '**Bony:**' },
      {
        t: 'ul',
        items: [
          'a hard, abrupt stop at the exact same point every day, unchanged by warm-up or contract-relax;',
          'a pinch at the front or side of the hip joint rather than a stretch in the muscle;',
          'no side-split change over 12+ months of consistent work while other tests improve.',
        ],
      },
    ],
  },
  {
    id: 'right-hip-check',
    title: 'Right-hip turnout check',
    blocks: [
      {
        t: 'p',
        text: 'Lie face down with the knees bent to 90° and measure hip internal and external rotation on both sides with the phone inclinometer.',
      },
      {
        t: 'ul',
        items: [
          'If the right hip has much more internal rotation and less external rotation, but the total arc is similar to the left, suspect femoral anteversion (bone). Train active control, and do not force passive external rotation.',
          'If the right total arc is smaller and the end-feel is soft, it is soft tissue and trainable.',
          'Also check tibial torsion: sit with the knee bent and see which way the foot points relative to the kneecap. That part is bone.',
        ],
      },
    ],
  },
  {
    id: 'lifting',
    title: 'Lifting layer (tracked in Hevy, not in this app)',
    blocks: [
      {
        t: 'ul',
        items: [
          '**Stretching 10-12 hours after heavy squats blunts nothing.** Chronic stretching does not reduce strength; the Warneke studies found strength gains.',
          '**Before lifting or surfing:** Warneke and Lohmann 2024 (Journal of Sport and Health Science, 83 studies) found a small strength loss after static stretching overall (ES -0.21), a large loss (ES -0.84) for holds of 60 s or more but only in isolated-muscle strength tests, and no loss in athletic performance.',
          'A 2025 Delphi consensus of 20 experts (Warneke, Wilke et al., Journal of Sport and Health Science) advises against more than 60 s per muscle of static stretching right before maximal or explosive isolated efforts, and for chronic range recommends at least three sets of 120 s per muscle group per session. Before dawn patrol and lifting: dynamic warm-up and short holds only. The 7:30 pm slot is ideal.',
        ],
      },
      { t: 'h', text: 'Lifting changes that double as flexibility work (Alizadeh 2023)' },
      {
        t: 'ul',
        items: [
          '**Squats:** full depth, with a 2-3 s pause at the bottom on the last set.',
          '**Leg curls:** seated, leaning forward, at full stretch. Maeo et al. 2021 found training hamstrings at long lengths (seated) grew them more than prone curls. This is the RDL substitute.',
          '**Bulgarian or ATG split squats:** deep front hip, back hip stretched under load; front-split specific.',
          '**Hip adduction machine:** from the widest start, 3 s open, 2 s pause, 2 s close, supersetted with paused calf raises (a loaded middle-split analog). Goblet Cossacks stay as an accessory.',
          '**Calf raises on a step:** 2 s pause at full stretch.',
          '**Hip thrusts** stay, but they are short-length glute work and add nothing to flexibility.',
        ],
      },
    ],
  },
  {
    id: 'desk',
    title: 'Desk micro-dose plan',
    blocks: [
      {
        t: 'p',
        text: 'This is where the ankle is won. Standing on a slant board at a standing desk is the only way a working person can approach the 1-hour-a-day calf doses of the Warneke studies.',
      },
      {
        t: 'ul',
        items: [
          '**Weeks 1-2:** lowest incline, one foot on the board, the other on the floor. 2 min per foot with the knee straight, then 1 min with the knee slightly bent (soleus). 4-6 bouts per shift. Intensity 4-5/10.',
          '**Weeks 3-6:** both feet, 3-5 min bouts, 6-10 bouts per shift, working toward 30 min per shift.',
          '**Week 7+:** 45-60 min a day in bouts. Raise the incline one notch when the lowest setting feels like 3/10.',
          '**Squat hang:** 1-2 min, counterweighted, every time you get up (bathroom, water). Aim for 4-6 a shift, heel lift allowed.',
          '**Hamstring:** 1 min per side, heel on a chair, once per shift.',
          '**What it counts for:** slant board minutes count fully toward calves. Squat hangs count toward soleus, hip flexion and partly adductors. At 30-60 min a day, desk calf volume dwarfs the session volume. That is intended.',
        ],
      },
    ],
  },
  {
    id: 'expectations',
    title: 'Expectations (estimates; there are no trials at this level)',
    blocks: [
      {
        t: 'ul',
        items: [
          '**Resting squat:** measurable knee-to-wall gains (a change of about 1.5 cm is beyond measurement noise) within 4-8 weeks. Flat-footed and unsupported in about 3-6 months; effortless in about 6-12.',
          '**Turnout:** active external-rotation control improves in 6-12 weeks (Pata 2014 saw +14° active turnout). Passive range gains are smaller and slower, and the bony share never changes.',
          '**Front split:** 12-24 months at about 90 min a week, with steady, visible block-count drops.',
          '**Side split:** 18-36 months, or anatomically off the table.',
          '**Lifelong maintenance:** once a goal is reached, drop to 3 sessions a week of 15 min. Gains fade slowly (Konrad 2025) but do fade (Nakamura 2021), so never go to zero.',
        ],
      },
    ],
  },
  {
    id: 'tally',
    title: 'Weekly time-under-stretch (per side, sessions only)',
    blocks: [
      {
        t: 'table',
        head: ['Muscle group', 'Sources', 'Min per week', 'Clears 5 min (Thomas) / 10 min (Ingram)?'],
        rows: [
          ['Calves and soleus', 'A1 (6) + squat hangs (12)', '18 + desk (150-300)', 'Yes, by far'],
          ['Hip flexors and rectus femoris', 'A5 (4) + B1 (6)', '10', 'Yes'],
          ['Hamstrings', 'B2 (6) + desk (4)', '10', 'Yes, with the desk add-on'],
          ['Adductors', 'A4 (3) + B3 (3) + B4 (4)', '10 (+ squat hangs)', 'Yes'],
          ['Hip rotators (ER/IR)', 'A3 (3) + B5 (3) + B4 (4)', '10 (+ lift-offs, skating)', 'Yes'],
        ],
      },
      { t: 'p', text: 'Total: about 92 min per week, all at work.' },
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment (exact Amazon search terms)',
    blocks: [
      {
        t: 'ul',
        items: [
          'Foam yoga blocks (heel lift, split-height gauge): "foam yoga blocks 2 pack"',
          'Sliders for side-split slides: "core sliders exercise gliding discs"',
          'Tape measure for knee-to-wall and split heights: "retractable tape measure 16 ft"',
          'Heavier kettlebell for loaded soleus holds, only if yours is under 12 kg: "cast iron kettlebell 16 kg"',
          'A free phone inclinometer app covers the angle tests.',
        ],
      },
    ],
  },
  {
    id: 'caveats',
    title: 'Caveats',
    blocks: [
      {
        t: 'ul',
        items: [
          'Hold times above 2 min, splits timelines, the squat-accumulation idea, and all coach protocols rest on coach opinion or indirect evidence. The meta-analyses mostly cover modest range over 4-12 weeks.',
          'The knee-to-wall squat cutoffs come from one study of Japanese men. Your proportions may shift your number.',
          'The side-split cadaver study was only available secondhand.',
          'There is no chronic-range evidence for PAILs/RAILs.',
          'Hip pain with pinching, clicking or catching: stop that position and see a sports physio. A pinch in forced flexion with internal rotation can signal impingement, and more stretching will not fix it.',
          'Optional home add-on: a 3-minute squat hang while the coffee brews on Fri-Sun. The program does not depend on it. Surfing and skating are the non-vegetable days.',
        ],
      },
    ],
  },
];

export function guideSection(id) {
  return GUIDE.find((s) => s.id === id) || null;
}
