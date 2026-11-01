// Plays three whole Sky Isles turns in headless Chrome against the preview (rich, nearly broke, after "Skip to
// tomorrow"), logs every step shown, and screenshots steps 4, 5, 6, 9 and 11 at laptop and phone size.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5191/';
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9339', `--user-data-dir=${OUT}/../chrome-profile`, '--no-first-run', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250);
  try {
    const list = await (await fetch('http://127.0.0.1:9339/json')).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const waiting = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: `(async () => { ${HELPERS}; ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails));
  return r.result?.result?.value;
};
const HELPERS = `
  const w = (ms = 350) => new Promise((r) => setTimeout(r, ms));
  const find = (t) => [...document.querySelectorAll('.si button')].find((b) => { const s = (b.getAttribute('aria-label') || b.textContent).trim(); return (t instanceof RegExp ? t.test(s) : s === t) && !b.disabled; });
  const btn = (t) => { const b = find(t); if (!b) throw new Error('no button ' + t + ' on ' + (document.querySelector('.si-steps')?.getAttribute('aria-label'))); b.click(); };
  const strip = () => document.querySelector('.si-steps')?.getAttribute('aria-label') ?? null;
  const off = () => document.querySelector('.si-step')?.classList.contains('si-step--off') ?? false;
  const why = () => [...document.querySelectorAll('.si-step .si-step__why, .si-step .si-choice__why, .si-step__greyed li')].map((e) => e.textContent).join(' / ');
  const top = () => window.scrollTo(0, document.querySelector('.si').getBoundingClientRect().top + window.scrollY);
`;
const shot = async (name) => {
  await js('top(); await w(150);');
  const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(r.result.data, 'base64'));
};
await cdp('Page.enable');
await cdp('Runtime.enable');
const log = [];
const note = async (turn) => { const s = await js('return [strip(), document.querySelector(".si-step h3")?.textContent, off(), why(), document.querySelector(".si-res strong")?.textContent]'); log.push([turn, ...s]); return s; };

async function setIsland(change) {
  await js(`const k = 'isles-trial:preview'; const d = JSON.parse(localStorage.getItem(k)); const i = d.islands.trial.island; Object.assign(i, ${JSON.stringify(change)}); localStorage.setItem(k, JSON.stringify(d)); location.reload();`).catch(() => {});
  await sleep(1500);
}

async function answer() {
  // Read the sum from the question and type the answer on the number pad.
  return js(`
    await w(500);
    const parts = [...document.querySelectorAll('.question__fact span')].map((s) => s.textContent);
    if (!parts.length) return 'no question';
    const [a, op, b] = parts; const x = Number(a), y = Number(b);
    const ans = op === '×' ? x * y : op === '+' ? x + y : op === '−' || op === '-' ? x - y : op === '÷' ? x / y : NaN;
    for (const d of String(ans)) [...document.querySelectorAll('.numpad__key')].find((k) => k.textContent === d).click();
    await w(100);
    document.querySelector('.numpad__key--enter').click();
    for (let i = 0; i < 30 && document.querySelector('.question'); i++) {
      await w(300);
      const go = [...document.querySelectorAll('.question button')].find((b) => /next|continue|ok|done|carry on/i.test(b.textContent));
      if (go) go.click();
    }
    return parts.join(' ') + ' = ' + ans;
  `);
}

async function turn(label, plan, shots) {
  await js(`btn('Play a turn'); await w();`);
  await note(label); // 1
  await js(`btn('Start my turn'); await w(700);`);
  await note(label); // 2 (the question)
  if (plan.answer) log.push([label, 'answered', await answer()]);
  else await js(`[...document.querySelectorAll('.question button')].find((b) => b.textContent.trim() === 'Skip')?.click(); await w(500);`);
  for (let i = 0; i < 12; i++) {
    const [s] = await note(label);
    const n = Number(s?.match(/Step (\d+)/)?.[1]);
    if (!n) break;
    if (shots[n]) await shot(shots[n]);
    const act = plan[n];
    if (act) await js(act);
    else await js(`btn(find('Not this turn') ? 'Not this turn' : 'Next'); await w();`);
    if (n === 11) break;
  }
  await js('await w(800);');
  log.push([label, 'after', await js('return document.querySelector(".si h2")?.textContent + " / " + document.querySelector(".si-pips")?.getAttribute("aria-label") + " / coins " + document.querySelector(".si-res strong")?.textContent')]);
}

for (const [size, width, height] of [['laptop', 1366, 640], ['phone', 844, 390]]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1.5, mobile: false });
  await cdp('Page.navigate', { url: URL_ });
  await sleep(1500);
  await js(`localStorage.clear(); location.reload();`).catch(() => {});
  await sleep(1500);
  await js(`document.querySelectorAll('.si-keeper')[3].click(); await w(); btn('This is my keeper'); await w(800);`);

  // Turn 1: lots of coins, ideas and goods (set in the preview's own saved island).
  await setIsland({ coins: 3000, ideas: 9, goods: 30 });
  await turn(`${size} rich`, {
    answer: true,
    4: `btn('Anchor it'); await w(); if (find('Yes')) { btn('Yes'); await w(); } btn(find('No, thanks') ? 'No, thanks' : 'Next'); await w();`,
    5: `btn('Spot 6: Empty spot'); await w(); ${size === 'laptop' ? '' : ''} btn(/^Library: /); await w(); btn('Yes'); await w(); btn(/^Spot \\d+: Empty spot$/); await w(); btn(/^Workshop: /); await w(); btn('No, thanks'); await w();`,
    6: `btn(/^High/); await w(); btn('Next'); await w();`,
    8: `btn(/^Hold a festival/); await w();`,
    9: `btn(/^Better Ploughs/); await w();`,
    11: `btn('End turn'); await w(1000);`,
  }, { 4: `${size}-step4-land`, 6: `${size}-step6-tax`, 9: `${size}-step9-projects`, 11: `${size}-step11-check` });
  // Step 5 with a spot chosen, on its own (a fresh look at the Build step).
  if (size) {
    await js(`btn('Play a turn'); await w(); btn('Start my turn'); await w(700); [...document.querySelectorAll('.question button')].find((b) => b.textContent.trim() === 'Skip')?.click(); await w(500); btn('Next'); await w(); btn(find('Not this turn') ? 'Not this turn' : 'Next'); await w(); btn(/^Spot 1: Farm/); await w();`);
    await shot(`${size}-step5-build`);
    await js(`btn('Stop, back to my island'); await w();`);
  }

  // Turn 2: almost no coins.
  await setIsland({ coins: 3, ideas: 0, goods: 0 });
  await turn(`${size} broke`, { 11: `btn('End turn'); await w(1000);` }, { 4: `${size}-step4-greyed` });

  // Turn 3: after "Skip to tomorrow".
  await js(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Skip to tomorrow').click(); await w(1200);`);
  await turn(`${size} tomorrow`, { 11: `btn('End turn'); await w(1000);` }, {});
}

writeFileSync(`${OUT}/../turns-log.json`, JSON.stringify(log, null, 1));
for (const l of log) console.log(l.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' | '));
chrome.kill();
process.exit(0);
