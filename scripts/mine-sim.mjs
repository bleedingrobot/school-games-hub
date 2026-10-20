// Plays a pretend class of Mine Runner pupils through the REAL server function against a SCRATCH database, and counts
// every request, to put a real number on the server cost (docs/MINE-PLAN.md, section 8).
//
//   scripts/scratch-db.sh mine            (builds the throw-away database; needs the local Supabase copy running)
//   npm run mine:sim -- [--pupils 30] [--levels 4] [--wrong 0.25] [--db mine] [--keep]
//
// Each pupil starts a dive (steady flight, with maths), flies it with the pretend pilot, answers the question doors
// (a quarter of them wrong first), tries two power-up pads, finishes, and looks at their times and the board, for the
// first `--levels` mines. The handler is the one that gets deployed; only the database plumbing is different (it talks
// to the scratch database through psql). The pretend pupils are removed at the end unless --keep.
// It will not run against anything called "postgres": only a scratch copy.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const PUPILS = Number(arg('pupils', 30));
const LEVELS = Math.min(6, Number(arg('levels', 4)));
const WRONG = Number(arg('wrong', 0.25));
const DB = arg('db', 'mine');
const KEEP = process.argv.includes('--keep');
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_school-games-hub';
if (!/^[a-z0-9_]+$/.test(DB) || DB === 'postgres' || DB.startsWith('template')) {
  console.error('Pick a scratch database (scripts/scratch-db.sh mine). Not the shared one.');
  process.exit(2);
}

// ---------------------------------------------------------------- bundle the real handler and rules
const entryFile = join(process.cwd(), `.mine-sim-entry-${process.pid}.ts`);
writeFileSync(
  entryFile,
  [
    "export { makeHandler } from './supabase/functions/mine/handler.ts';",
    "export { stamper } from './supabase/functions/_shared/stamp.ts';",
    "export { recordMathsAnswers } from './supabase/functions/_shared/recordAnswers.ts';",
    "export { parseFocus } from './shared/maths/focus.ts';",
    "export { flyLevel } from './shared/mine/bot.ts';",
    "export { makeWorld } from './shared/mine/engine.ts';",
    "export { encodeInputs, GRANT, PENALTY } from './shared/mine/inputs.ts';",
    "export { makeLevel, recipeById, RECIPES } from './shared/mine/level.ts';",
    "export { questionPlan } from './shared/mine/maths.ts';",
    "export { MINE_RUNS_PER_DAY } from './shared/mine/save.ts';",
  ].join('\n') + '\n',
);
const dir = mkdtempSync(join(tmpdir(), 'mine-sim-'));
let mod;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  mod = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- one long-lived psql, one statement at a time
const psql = spawn('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-t', '-A', '-q', '-X', '-v', 'VERBOSITY=terse'], { stdio: ['pipe', 'pipe', 'pipe'] });
let out = '';
let err = '';
let waiting = null;
psql.stdout.on('data', (d) => {
  out += d;
  settle();
});
psql.stderr.on('data', (d) => {
  err += d;
  settle();
});
function settle() {
  if (!waiting) return;
  const end = out.indexOf('__END__\n');
  if (end < 0) return;
  const body = out.slice(0, end).trim();
  const problem = err.trim();
  out = out.slice(end + 8);
  err = '';
  const { resolve } = waiting;
  waiting = null;
  resolve({ body, problem });
}
let queue = Promise.resolve();
/** Runs one SQL statement. Resolves { body, problem } (problem is psql's error text, if any). */
function sql(text) {
  const run = () =>
    new Promise((resolve) => {
      waiting = { resolve };
      psql.stdin.write(`${text};\nselect '__END__';\n`);
    });
  const next = queue.then(run);
  queue = next.catch(() => {});
  return next.then((r) => ({ body: r.body.replace(/\n?__END__$/, '').replace(/^__END__$/, '').trim(), problem: r.problem }));
}

const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const text = typeof v === 'string' ? v : JSON.stringify(v);
  return `$q$${text}$q$`;
};
/** Calls a database function the way the real server does through supabase-js: named arguments in, { data, error } out. */
async function rpc(name, args) {
  const named = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
  const { body, problem } = await sql(`select (public.${name}(${named}))::text`);
  if (problem) {
    return { data: null, error: { code: 'XX000', message: problem } };
  }
  let data = body;
  if (body === 't') data = true;
  else if (body === 'f') data = false;
  else if (body === '') data = null;
  else {
    try {
      data = JSON.parse(body);
    } catch {
      /* raw text */
    }
  }
  return { data, error: null };
}
const one = async (text) => (await sql(text)).body;

// ---------------------------------------------------------------- the pretend class
if (!(await one("select to_regclass('public.mine_runs')"))) {
  console.error(`The database "${DB}" has no Mine Runner tables. Run scripts/scratch-db.sh ${DB} first.`);
  psql.kill();
  process.exit(2);
}
const pupils = [];
for (let n = 0; n < PUPILS; n++) {
  const id = (await one(`select gen_random_uuid()`)).trim();
  const tag = String(n).padStart(3, '0');
  await sql(`insert into auth.users (id, email) values ('${id}', 'minesim${tag}-${id.slice(0, 6)}@douglaspark.school.nz')`);
  pupils.push({ id, token: `token-${n}`, n });
}
const byToken = new Map(pupils.map((p) => [p.token, p.id]));

let clock = Date.now();
const counts = { start: 0, answer: 0, finish: 0, byStatus: {} };
const browserCalls = { settings: 0, my_mine: 0, mine_board: 0 };
const outcomes = { best: 0, saved: 0, duplicate: 0, refused: 0 };

const secret = 'mine-sim-secret';
const handler = mod.makeHandler({
  now: () => clock,
  randomHex: (bytes) => Array.from({ length: bytes }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''),
  stamp: mod.stamper(secret, 'mine-run'),
  userIdFor: async (token) => byToken.get(token) ?? null,
  async mathsSwitch(player) {
    const { body } = await sql(`select mine_maths from public.settings_of('${player}')`);
    return body || null;
  },
  async mathsContext(player) {
    const { data } = await rpc('space_maths_context', { player });
    if (!data) return null;
    const { enabledTables, division, missingFactor, multipleChoice } = data.settings;
    return { facts: data.facts, focus: mod.parseFocus(data.focus), settings: { enabledTables, division, multipleChoice, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) } };
  },
  async runsToday(player) {
    const { data, error } = await rpc('mine_runs_today', { player });
    return error ? 'busy' : data;
  },
  async storeRun(player, seed, level, questions) {
    return !(await rpc('mine_store_run', { player, seed, level, questions })).error;
  },
  async loadRun(player, seed) {
    const { data, error } = await rpc('mine_load_run', { player, seed });
    return error ? 'busy' : (data ?? null);
  },
  async claimAnswer(player, seed, slot, value, right) {
    const { data, error } = await rpc('mine_claim_answer', { player, seed, slot, value, right_answer: right });
    return error ? 'busy' : data === true;
  },
  async recordAnswers(player, once, answers) {
    await mod.recordMathsAnswers(rpc, player, answers, once, 'mine');
  },
  async record(player, report, run) {
    const { data, error } = await rpc('record_mine_run', {
      player, seed: report.seed, level: report.level, mode: report.mode, maths: report.maths, steps: run.steps,
      grants: run.grants.length, wrong: run.penalties, inputs: report.inputs, daily_limit: mod.MINE_RUNS_PER_DAY,
    });
    if (error) return { ok: false, why: /54000|lot of mining/.test(error.message) ? 'too-many' : 'busy' };
    return { ok: true, value: data };
  },
});

async function call(pupil, body) {
  counts[body.action]++;
  const response = await handler(
    new Request('http://sim/mine', { method: 'POST', headers: { Authorization: `Bearer ${pupil.token}`, 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify(body) }),
  );
  counts.byStatus[`${body.action} ${response.status}`] = (counts.byStatus[`${body.action} ${response.status}`] ?? 0) + 1;
  return { status: response.status, body: await response.json() };
}

/** What a pupil's browser asks the database itself (not the function): settings, their bests, a board. */
async function browserRead(pupil, kind, ...rest) {
  browserCalls[kind]++;
  const claims = JSON.stringify({ sub: pupil.id, email: `p${pupil.n}@douglaspark.school.nz`, role: 'authenticated' });
  const call = kind === 'settings' ? 'select 1' : kind === 'my_mine' ? 'select public.my_mine()' : `select public.mine_board('${rest[0]}', true)`;
  const { problem } = await sql(`begin; set local role authenticated; select set_config('request.jwt.claims', '${claims}', true); ${call}; rollback`);
  if (problem) console.error('browser read problem:', problem);
}

const started = Date.now();
let wrongAnswers = 0;
let rightAnswers = 0;
for (const pupil of pupils) {
  await browserRead(pupil, 'settings');
  await browserRead(pupil, 'my_mine');
  for (let li = 0; li < LEVELS; li++) {
    const recipe = mod.RECIPES[li];
    const level = recipe.id;
    const world = mod.makeWorld(mod.makeLevel(mod.recipeById(level)), { steady: true, maths: true });
    const plan = mod.questionPlan(world.level);
    const bot = mod.flyLevel(world);
    if (bot.state.outcome !== 'finished') {
      console.error(`the pretend pilot could not finish ${level}`);
      continue;
    }
    const startedAt = clock;
    const s = await call(pupil, { action: 'start', level, mode: 'steady', maths: true });
    if (s.status !== 200) {
      console.error(`start refused for ${level}: ${s.status} ${JSON.stringify(s.body)}`);
      continue;
    }
    const { seed, stamp } = s.body;
    // The pretend pilot's recorded answers: each question door it opened has a GRANT; a quarter of the time the pupil gets one wrong first.
    let runs = bot.runs.map((r) => [...r]);
    const doors = plan.targets.filter((t) => t.kind === 'door');
    for (const door of doors) {
      const at = runs.findIndex(([code]) => code === mod.GRANT + door.id);
      if (at < 0) continue;
      const answerBody = (slot, value) => ({ action: 'answer', seed, stamp, level, mode: 'steady', slot, value, ms: 4000 });
      let slot = door.first;
      if (Math.random() < WRONG) {
        const r = await call(pupil, answerBody(slot, 99999));
        wrongAnswers++;
        if (r.status !== 200) console.error('answer problem', r.status, r.body);
        runs = [...runs.slice(0, at), [mod.PENALTY, 1], ...runs.slice(at)];
        slot++;
      }
      // The right answer is whatever the server stored: ask the database for it (the pupil's browser would be told the mark, not the answer).
      const stored = await rpc('mine_load_run', { player: pupil.id, seed });
      const rightValue = stored.data.questions[slot].answer;
      const r = await call(pupil, answerBody(slot, rightValue));
      rightAnswers++;
      if (r.status !== 200 || r.body.correct !== true) console.error('right answer problem', r.status, r.body);
    }
    // Two tries at a power-up pad (one wrong, one right): they cost requests but change nothing in the run.
    const pad = plan.targets.find((t) => t.kind === 'pad');
    if (pad) {
      const stored = await rpc('mine_load_run', { player: pupil.id, seed });
      for (const [i, value] of [[0, 99999], [1, stored.data.questions[pad.first + 1].answer]]) {
        await call(pupil, { action: 'answer', seed, stamp, level, mode: 'steady', slot: pad.first + i, value, ms: 5000 });
      }
    }
    // Time passes while it is flown (a little more than the real play time, so the real-time check is fair).
    clock = startedAt + Math.ceil((bot.state.steps / 30) * 1000) + 5000;
    const f = await call(pupil, { action: 'finish', seed, stamp, level, mode: 'steady', maths: true, inputs: mod.encodeInputs(runs) });
    if (f.status === 200) outcomes[f.body.result] = (outcomes[f.body.result] ?? 0) + 1;
    else {
      outcomes.refused++;
      console.error(`finish refused for ${level}: ${f.status} ${JSON.stringify(f.body)}`);
    }
    await browserRead(pupil, 'my_mine');
    // One look at the board for the mine just flown.
    await browserRead(pupil, 'mine_board', level);
  }
}
const seconds = (Date.now() - started) / 1000;

// ---------------------------------------------------------------- what is in the database now
const rows = JSON.parse(
  (await one(`select json_build_object(
    'runs', (select count(*) from public.mine_runs r join auth.users u on u.id = r.player where u.email like 'minesim%'),
    'bests', (select count(*) from public.mine_bests b join auth.users u on u.id = b.player where u.email like 'minesim%'),
    'questionLists', (select count(*) from public.mine_questions q join auth.users u on u.id = q.player where u.email like 'minesim%'),
    'runBytes', (select coalesce(sum(length(r.inputs)), 0) from public.mine_runs r join auth.users u on u.id = r.player where u.email like 'minesim%'),
    'answerBatches', (select count(*) from public.fact_answer_batches b join auth.users u on u.id = b.player where u.email like 'minesim%')
  )`)) || '{}',
);

if (!KEEP) {
  await sql(`delete from auth.users where email like 'minesim%'`);
}
psql.stdin.end();

const handlerRequests = counts.start + counts.answer + counts.finish;
const browserTotal = browserCalls.settings + browserCalls.my_mine + browserCalls.mine_board;
const runsPlayed = outcomes.best + outcomes.saved + outcomes.duplicate;
console.log(`\nA pretend class: ${PUPILS} pupils, ${LEVELS} mines each (${runsPlayed} saved runs, ${outcomes.refused} refused), ${(WRONG * 100).toFixed(0)}% of question doors wrong first. Took ${seconds.toFixed(1)} s.`);
console.log(`\nServer function requests (each is one function call):`);
console.log(`  start   ${String(counts.start).padStart(6)}`);
console.log(`  answer  ${String(counts.answer).padStart(6)}   (${rightAnswers} right and ${wrongAnswers} wrong at doors, plus ${PUPILS * LEVELS * 2} at pads)`);
console.log(`  finish  ${String(counts.finish).padStart(6)}`);
console.log(`  total   ${String(handlerRequests).padStart(6)}   = ${(handlerRequests / PUPILS).toFixed(1)} a pupil, ${(handlerRequests / Math.max(1, runsPlayed)).toFixed(1)} a mine`);
console.log(`  by reply: ${Object.entries(counts.byStatus).map(([k, v]) => `${k} x${v}`).join(', ')}`);
console.log(`\nDatabase calls made by the pupils' browsers (settings, their times, a board): ${browserTotal}  (${browserCalls.settings} settings, ${browserCalls.my_mine} times, ${browserCalls.mine_board} boards)`);
console.log(`\nSaved: ${rows.runs} runs, ${rows.bests} bests, ${rows.questionLists} question lists, ${rows.answerBatches} maths answer batches recorded; run text ${(rows.runBytes / 1024).toFixed(0)} KB (${runsPlayed ? (rows.runBytes / runsPlayed / 1024).toFixed(1) : 0} KB a run).`);
console.log(`Results: ${JSON.stringify(outcomes)}`);
const perLesson = handlerRequests;
console.log(`\nOne lesson like this = ${perLesson} function requests. Once a week (4 lessons a month) = ${perLesson * 4} a month; every school day (20 a month) = ${perLesson * 20} a month. The free plan allows 500,000 function calls a month.`);
process.exit(outcomes.refused ? 1 : 0);
