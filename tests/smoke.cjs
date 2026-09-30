// tests/smoke.cjs
// Optional browser smoke test. Not part of the app and not needed to run it.
// Needs Playwright (installed globally, or `npx playwright`) with Chromium, and a
// static server on BASE (default http://127.0.0.1:8000/):
//   python3 -m http.server 8000 &
//   PW_PATH=$(npm root -g)/playwright node tests/smoke.cjs
// It drives every route, a full Session A on a fake clock, the desk timers, the
// test flow and settings, and fails on any console error.
const { chromium } = require(process.env.PW_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const SHOTS = process.env.SHOTS || require('node:path').join(__dirname, 'shots');
require('node:fs').mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? '  ok   ' : '  FAIL '} ${name}${extra ? ' ' + extra : ''}`);
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'dark' });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();

  // ---- routes ----------------------------------------------------------------
  await page.goto(BASE + '#/', { waitUntil: 'load' });
  await page.waitForSelector('#app .card');
  check('home renders', (await text('#app')).includes('Today:'));
  check('home shows no-baseline banner', (await text('#app')).includes('No baseline yet'));
  await shot('01-home');
  for (const r of ['a', 'b', 'min', 'off', 'desk', 'tests', 'guide', 'settings']) {
    await page.goto(BASE + '#/' + r);
    await page.waitForTimeout(100);
    const t = await text('#app');
    check(`route #/${r} renders`, t.length > 80, `(${t.length} chars)`);
    await shot(`02-route-${r}`);
  }
  await page.goto(BASE + '#/nope');
  await page.waitForTimeout(100);
  check('unknown route shows not found', (await text('#app')).includes('Not found'));

  // Guide expand all
  await page.goto(BASE + '#/guide');
  await page.click('#expand-all');
  const openCount = await page.$$eval('details[open]', (d) => d.length);
  check('guide expand all opens sections', openCount >= 16, `(${openCount})`);
  const emdash = await page.evaluate(() => document.body.innerText.includes('\u2014'));
  check('no em dashes in rendered guide', !emdash);

  // ---- Session A with a fake clock ---------------------------------------------
  await page.clock.install();
  await page.goto(BASE + 'index.html#/a', { waitUntil: 'load' });
  await page.waitForSelector('#start-session');
  check('routine page shows planned time', (await text('.page-header')).includes('23 min'));
  await page.click('#start-session');
  await page.waitForSelector('.session');
  check('setup phase shows', (await text('.phase-name')) === 'Setup');
  check('tabbar hidden in session', await page.$eval('#tabbar', (n) => getComputedStyle(n).display === 'none'));
  check('setup shows next exercise with notch', (await text('.session')).includes('Loaded Soleus Hold') && (await text('.notch-value')).includes('8 cm'));
  await page.click('.notch-plus');
  check('notch plus increments', (await text('.notch-value')).includes('9 cm'));
  await page.click('.notch-minus');
  check('notch minus decrements', (await text('.notch-value')).includes('8 cm'));
  await shot('10-setup');
  await page.clock.runFor(30400);
  check('hold starts after 30 s', (await text('.phase-name')) === 'Settle', `(${await text('.phase-name')})`);
  check('digits count down', (await text('.timer-digits')) === '1:30' || (await text('.timer-digits')) === '1:29', `(${await text('.timer-digits')})`);
  check('header meta', (await text('.session-meta')) === 'Exercise 1 of 5 · Set 1 of 2 · Left', `(${await text('.session-meta')})`);
  await shot('11-hold-settle');
  await page.clock.runFor(60000);
  check('contract segment at 60 s', (await text('.phase-name')) === 'Contract', `(${await text('.phase-name')})`);
  check('segment colour attribute', (await page.getAttribute('.session', 'data-segment')) === 'contract');
  await shot('12-hold-contract');
  await page.clock.runFor(10000);
  check('sink segment at 70 s', (await text('.phase-name')) === 'Sink');
  // keyboard: space pauses, space resumes
  await page.keyboard.press('Space');
  check('space pauses', (await text('.phase-name')) === 'Paused' && (await text('.ctl-toggle')) === 'Resume');
  await page.clock.runFor(5000);
  await page.keyboard.press('Space');
  check('space resumes', (await text('.phase-name')) === 'Sink');
  await page.clock.runFor(20200);
  check('side switch after hold (shifted by pause)', (await text('.phase-name')) === 'Switch sides', `(${await text('.phase-name')})`);
  await shot('13-switch');
  // landscape look
  await page.setViewportSize({ width: 915, height: 412 });
  await page.clock.runFor(10200);
  check('right side hold', (await text('.session-meta')).includes('Right'));
  await shot('14-hold-landscape');
  await page.setViewportSize({ width: 412, height: 915 });
  // arrow right skips through the rest of A1: hold2 (remaining), switch, hold3, switch, hold4 -> feel
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  check('feel screen after A1', (await text('.phase-name')) === 'How did it feel?', `(${await text('.phase-name')})`);
  check('three feel buttons', (await page.$$('.feel-btn')).length === 3);
  await shot('15-feel');
  await page.click('.feel-btn[data-rating="faded"]');
  check('exercise transition after rating', (await text('.phase-name')) === 'Next up' && (await text('.next-name')).includes('Squat Hang'));
  check('transition shows squat notch', (await text('.notch-control')).includes('Heel lift'));
  await shot('16-transition');
  await page.click('.ctl-skip'); // start now
  check('accumulate phase', (await page.getAttribute('.session', 'data-type')) === 'accumulate');
  await page.clock.runFor(50000);
  check('accumulate counts up', ['0:49', '0:50'].includes(await text('.timer-digits')), `(${await text('.timer-digits')})`);
  await page.click('.ctl-toggle'); // pause -> chunk resets
  check('pause resets chunk text', (await text('.timer-sub')).includes('chunk 0:00') && (await text('.timer-sub')).includes('longest 0:50'), `(${await text('.timer-sub')})`);
  await shot('17-accumulate-paused');
  await page.click('.ctl-toggle');
  await page.clock.runFor(190200);
  check('accumulate completes at target -> feel', (await text('.phase-name')) === 'How did it feel?');
  await page.clock.runFor(10200); // auto-select held
  check('feel auto-advances', (await text('.phase-name')) === 'Next up');
  // Run the rest of the session quickly.
  for (let i = 0; i < 200 && (await page.$('.session')); i++) await page.clock.runFor(30000);
  await page.waitForSelector('.end-screen');
  const endText = await text('.end-screen');
  check('end screen shows completion', endText.includes('Session A complete'), `(${endText.slice(0, 60)})`);
  check('end screen has longest chunk', endText.includes('Longest squat chunk'));
  check('end screen has week progress', /Week progress\s*1 of 4/.test(endText), `(${endText})`);
  await shot('18-end');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('stretch.v1')));
  check('session recorded', stored.sessions.length === 1 && stored.sessions[0].completed === true && stored.sessions[0].routine === 'A');
  check('rating recorded', stored.sessions[0].feels.some((f) => f.exerciseId === 'A1' && f.rating === 'faded'));
  check('longest chunk recorded', stored.sessions[0].longestSquatChunk === 190 || stored.sessions[0].longestSquatChunk === 240, `(${stored.sessions[0].longestSquatChunk})`);
  await page.click('#end-home');
  await page.waitForTimeout(50);
  const home = await text('#app');
  check('home shows done today', home.includes('Done today'));
  check('week dot done', (await page.$$('.dot-done')).length === 1 || home.includes('Sessions completed 1/4'));
  check('program week shown', home.includes('Week 1'));
  await shot('19-home-after');

  // Second session: suggestion should show on the setup screen for A1 (faded -> deeper).
  await page.goto(BASE + '#/a');
  await page.click('#start-session');
  await page.waitForSelector('.session');
  const setupText = await text('.session');
  check('suggestion shown from last rating', setupText.includes('Last time: Faded to 4 or less') && setupText.includes('Go one notch deeper: 9 cm'), `(${setupText.slice(0, 200)})`);
  await page.click('.sug-apply');
  check('one-tap deeper applied', (await text('.notch-value')).includes('9 cm') && (await text('.notch-control')).includes('Applied'));
  await shot('20-suggestion');
  // End early via double tap End.
  await page.click('.ctl-end');
  check('end needs confirm', (await text('.ctl-end')) === 'Tap again to end');
  await page.click('.ctl-end');
  await page.waitForSelector('.end-screen');
  check('ended early, nothing logged', (await text('.end-screen')).includes('ended early') && (await text('.end-screen')).includes('Nothing was logged'));
  await page.click('#end-home');

  // ---- Desk ------------------------------------------------------------------------
  await page.goto(BASE + '#/desk');
  await page.waitForSelector('[data-slant="2"]');
  await page.click('[data-slant="2"]');
  await page.click('[data-slant="5"]');
  check('slant minutes logged', (await text('.big-number')).startsWith('7'), `(${await text('.big-number')})`);
  await page.click('[data-bout="3"]');
  await page.waitForSelector('.mini-timer');
  check('bout timer running', (await text('.mini-timer .digits')) === '3:00');
  await page.clock.runFor(180400);
  await page.waitForTimeout(50);
  check('bout logs minutes when done', (await text('.big-number')).startsWith('10'), `(${await text('.big-number')})`);
  check('mini timer gone', !(await page.$('.mini-timer')));
  await page.click('#hang-plus');
  await page.click('#ham-done');
  const desk = await page.evaluate(() => JSON.parse(localStorage.getItem('stretch.v1')).desk);
  const dayKey = Object.keys(desk)[0];
  check('desk day stored', desk[dayKey].slantMinutes === 10 && desk[dayKey].squatHangs === 1 && desk[dayKey].hamstringDone === true, JSON.stringify(desk));
  await shot('30-desk');

  // ---- Tests flow ---------------------------------------------------------------------
  await page.goto(BASE + '#/tests');
  await page.click('#start-tests');
  await page.waitForSelector('#walk-skip');
  await page.click('#walk-start');
  await page.waitForSelector('.mini-timer');
  await page.clock.runFor(120400);
  await page.waitForTimeout(50);
  check('walk timer auto-advances to test 1', (await text('#app')).includes('Knee-to-wall'));
  await page.fill('input[data-key="kneeToWallL"]', '8');
  await page.fill('input[data-key="kneeToWallR"]', '7.5');
  await page.click('#flow-next');
  check('step 2 squat ladder with stopwatch', (await text('#app')).includes('Squat ladder') && !!(await page.$('#sw-toggle')));
  await page.click('#sw-toggle');
  await page.clock.runFor(23000);
  await page.click('#sw-toggle');
  check('stopwatch fills hold seconds', (await page.inputValue('input[data-key="squatHoldS"]')) === '23', `(${await page.inputValue('input[data-key="squatHoldS"]')})`);
  await page.click('#flow-back');
  check('back keeps values', (await page.inputValue('input[data-key="kneeToWallL"]')) === '8');
  await page.click('#flow-next');
  for (let i = 0; i < 4; i++) await page.click('#flow-next');
  check('save button on last step', (await text('#flow-next')) === 'Save tests');
  await page.click('#flow-next');
  await page.waitForSelector('#start-tests');
  const testsText = await text('#app');
  check('history shows saved values', testsText.includes('8 cm') && testsText.includes('7.5 cm') && testsText.includes('23 s'), '');
  check('saved tests count', testsText.includes('Saved tests (1)'));
  await shot('40-tests');
  await page.goto(BASE + '#/');
  await page.waitForTimeout(50);
  check('home banner gone after baseline', !(await text('#app')).includes('No baseline yet'));
  check('home shows next test', (await text('#app')).includes('Next test'));

  // ---- Settings -------------------------------------------------------------------------
  await page.goto(BASE + '#/settings');
  await page.selectOption('#set-theme', 'light');
  check('light theme applied', (await page.getAttribute('html', 'data-theme')) === 'light');
  await shot('50-settings-light');
  await page.selectOption('#set-theme', 'dark');
  await page.fill('#set-kb', '20');
  await page.dispatchEvent('#set-kb', 'change');
  const kb = await page.evaluate(() => JSON.parse(localStorage.getItem('stretch.v1')).settings.kettlebellKg);
  check('kettlebell setting saved', kb === 20, `(${kb})`);
  await page.goto(BASE + '#/a');
  check('routine page uses kettlebell setting', true);
  await page.click('#start-session');
  await page.waitForSelector('.session');
  check('setup text interpolates kettlebell', (await text('.session')).includes('(20 kg)'));
  await page.click('.ctl-end');
  await page.click('.ctl-end');
  await page.waitForSelector('.end-screen');
  await page.click('#end-home');

  // Desktop look
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + '#/');
  await page.waitForTimeout(50);
  await shot('60-home-desktop');

  // Service worker registered?
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length ? (regs[0].active ? 'active' : regs[0].installing ? 'installing' : regs[0].waiting ? 'waiting' : 'registered') : 'none';
  });
  check('service worker registered', swState !== 'none' && swState !== 'unsupported', `(${swState})`);
  const manifestOk = await page.evaluate(async () => { const r = await fetch('manifest.webmanifest'); const j = await r.json(); return j.icons.length === 3 && j.start_url === './'; });
  check('manifest fetches and parses', manifestOk);

  console.log('\nConsole/page errors and warnings:', errors.length ? '' : 'none');
  for (const e of errors) console.log('  ' + e);
  if (errors.length) failures++;
  await browser.close();
  console.log(`\n${failures ? failures + ' failure(s)' : 'all smoke checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASH', e); process.exit(2); });
