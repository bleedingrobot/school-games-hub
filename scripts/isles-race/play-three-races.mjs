// Races the Gull Riders three times in headless Chrome against the preview (every answer right, every answer wrong,
// and leaving mid-race and coming back), logs what each stop shows, and screenshots the start, a mid-race question
// and the result at laptop and phone size. Made from scripts/isles-turns/play-three-turns.mjs. Needs the preview
// running on port 5191: node scripts/isles-race/play-three-races.mjs http://localhost:5191/ <folder for pictures>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ = process.argv[2] ?? 'http://localhost:5191/';
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9341', `--user-data-dir=${OUT}/../chrome-profile`, '--no-first-run', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250);
  try {
    const list = await (await fetch('http://127.0.0.1:9341/json')).json();
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
/** What the race screen shows now: its heading, Pip's line, the main button, the open question and the boats. */
const note = async (label) => {
  const s = await js(`return [document.querySelector('.si-race h2')?.textContent, document.querySelector('.si-race__bar p')?.textContent,
    document.querySelector('.si-race__go')?.textContent ?? null, document.querySelector('.question__title, .question h2')?.textContent ?? null,
    [...document.querySelectorAll('.si-boat')].map((b) => b.style.left).join(' vs '), document.activeElement?.tagName + ':' + (document.activeElement?.textContent ?? '').slice(0, 40)]`);
  log.push([label, ...s]);
  return s;
};

async function setIsland(change) {
  await js(`const k = 'isles-trial:preview'; const d = JSON.parse(localStorage.getItem(k)); const i = d.islands.trial.island; Object.assign(i, ${JSON.stringify(change)}); localStorage.setItem(k, JSON.stringify(d)); location.reload();`).catch(() => {});
  await sleep(1500);
}

/** Waits for the next race question (or the result), up to 12 seconds. */
const waitFor = (what) => js(`for (let i = 0; i < 60; i++) { if (${what}) return true; await w(200); } return false;`);
const QUESTION = "document.querySelector('.question .numpad__key')";
const RESULT = "document.querySelector('.si-raceresult')";

/** Reads the sum and types the right answer (or one more, for a wrong one), then waits for the box to close. */
async function answer(right) {
  return js(`
    await w(300);
    const parts = [...document.querySelectorAll('.question__fact span')].map((s) => s.textContent);
    if (!parts.length) return 'no question';
    const [a, op, b] = parts; const x = Number(a), y = Number(b);
    const ans = (op === '×' ? x * y : op === '+' ? x + y : op === '−' || op === '-' ? x - y : op === '÷' ? x / y : NaN) + (${right} ? 0 : 1);
    for (const d of String(ans)) [...document.querySelectorAll('.numpad__key')].find((k) => k.textContent === d).click();
    await w(100);
    document.querySelector('.numpad__key--enter').click();
    for (let i = 0; i < 30 && document.querySelector('.question'); i++) await w(200);
    return parts.join(' ') + ' -> ' + ans;
  `);
}

async function race(label, answers, { shots = {}, leaveAfter = -1 } = {}) {
  await js(`btn('Sky Race'); await w(800);`);
  await note(`${label} start`);
  if (shots.start) await shot(shots.start);
  await js(`btn('Set sail!');`);
  for (let q = 0; q < answers.length; q++) {
    if (!(await waitFor(QUESTION))) { log.push([label, 'no question', q + 1]); break; }
    await note(`${label} stop ${q + 1}`);
    if (shots[`q${q + 1}`]) await shot(shots[`q${q + 1}`]);
    log.push([label, `question ${q + 1}`, await answer(answers[q])]);
    await js('await w(200);');
    await note(`${label} after ${q + 1}`);
    if (q === leaveAfter) {
      // Leave mid-race (close the page) and come back: the race carries on from the same stop.
      await cdp('Page.reload');
      await sleep(2000);
      await note(`${label} back`);
      if (shots.back) await shot(shots.back);
      await js(`btn('Sail on!');`);
    }
  }
  await waitFor(RESULT);
  await js('await w(400);');
  await note(`${label} result`);
  log.push([label, 'working', await js("return [...document.querySelectorAll('.si-working, .si-raceresult .si-pipsays p')].map((p) => p.textContent).join(' | ')")]);
  if (shots.result) await shot(shots.result);
  await js(`btn('Back to my island'); await w(800);`);
}

for (const [size, width, height] of [['laptop', 1366, 640], ['phone', 844, 390]]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1.5, mobile: false });
  await cdp('Page.navigate', { url: URL_ });
  await sleep(1500);
  await js(`localStorage.clear(); location.reload();`).catch(() => {});
  await sleep(1500);
  await js(`document.querySelectorAll('.si-keeper')[3].click(); await w(); btn('This is my keeper'); await w(800);`);

  // Race 1: every answer right (the season's first race, the starter race).
  await race(`${size} all right`, [true, true, true], { shots: { start: `${size}-1-start`, q2: `${size}-2-question`, result: `${size}-3-result` } });
  // Race 2: every answer wrong (an ordinary race). A race a turn: let the island race again.
  await setIsland({ racedTurn: -1, racesToday: 0 });
  await race(`${size} all wrong`, [false, false, false], { shots: { result: `${size}-3-result-wrong` } });
  // Race 3: leave after the first answer and come back.
  await setIsland({ racedTurn: -1, racesToday: 0 });
  await race(`${size} leave and come back`, [true, false, true], { leaveAfter: 0, shots: { back: `${size}-4-back` } });
}

writeFileSync(`${OUT}/../races-log.json`, JSON.stringify(log, null, 1));
for (const l of log) console.log(l.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' | '));
chrome.kill();
process.exit(0);
