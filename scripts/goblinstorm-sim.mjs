// Goblin Storm's balance sim (docs/GOBLINSTORM-PLAN.md, "Stage 4 results"). Bot runs live here, never in the tests.
// Run from the project folder: node scripts/goblinstorm-sim.mjs [--seeds 6] [--only grid|still|journey]
//
// 1. still:   a hero who never moves on Castle Fields (how harsh are the first seconds?).
// 2. grid:    every hero on every map, with no shop, half the shop and the whole shop, steering like a pupil
//             (keeps away from monsters, walks to gems) and mostly right answers.
// 3. journey: a steady player, 5 runs a school day, spending gold on the cheapest shop level (with the real shop's
//             rules, shared/goblinstorm/shop.ts), playing the best open
//             hero on the first map whose boss isn't beaten yet. How many days to each boss and hero?
import { mkdtempSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { rolldown } from 'rolldown';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SEEDS = Number(opt('seeds', 6));
const ONLY = opt('only', 'all');

async function buildBundle() {
  const dir = mkdtempSync(join(tmpdir(), 'goblinstorm-sim-'));
  const root = process.cwd();
  writeFileSync(join(dir, 'entry.ts'), [
    `export * from ${JSON.stringify(join(root, 'shared/goblinstorm/bot.ts'))};`,
    `export * from ${JSON.stringify(join(root, 'shared/goblinstorm/config.ts'))};`,
    `export { summary } from ${JSON.stringify(join(root, 'shared/goblinstorm/engine.ts'))};`,
    `export { heroOpen, mapOpen, newUnlocks, freshSave } from ${JSON.stringify(join(root, 'shared/goblinstorm/server.ts'))};`,
    `export { buy, nextCost, allBought as shopAllBought } from ${JSON.stringify(join(root, 'shared/goblinstorm/shop.ts'))};`,
  ].join('\n'));
  const bundle = await rolldown({ input: join(dir, 'entry.ts'), logLevel: 'silent', platform: 'node' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  return join(dir, 'sim.mjs');
}

const bundlePath = isMainThread ? await buildBundle() : workerData.bundlePath;
const G = await import(pathToFileURL(bundlePath).href);
const { botRun, sensibleDirection, sensiblePick, HEROES, MAPS, SHOP_IDS, SHOP_LEVELS, SHOP_ARMOUR_MAX, summary, STEPS_PER_SECOND } = G;

const STYLES = { pupil: { steer: sensibleDirection, pick: sensiblePick }, still: { steer: () => 16, pick: sensiblePick }, simple: {} };
/** Mostly right: 65% right, 20% quick, 15% wrong, fixed by the seed and slot. */
const answers = (seed) => (slot) => {
  const r = ((seed * 7919 + slot * 104729) % 100 + 100) % 100;
  return r < 15 ? 2 : r < 35 ? 4 : 3;
};
const fullShop = (n) => Object.fromEntries(SHOP_IDS.map((id) => [id, id === 'armour' ? Math.min(n, SHOP_ARMOUR_MAX) : n]));
const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n, d) => `${Math.round((100 * n) / d)}%`.padStart(4);

function playNow(heroIndex, mapIndex, shop, seed, style = 'pupil') {
  const r = botRun({ seed, hero: HEROES[heroIndex], map: MAPS[mapIndex], shop }, answers(seed), Infinity, STYLES[style]);
  return { ...summary(r.state), levelUps: r.state.levelUps, questions: r.choices.length };
}

/** Best hero for a map: a rough "how strong" a pupil would go for. */
const STRENGTH = { knight: 1, ranger: 0.9, wizard: 1.1, barbarian: 1.2, cleric: 1.3, rogue: 1.1, witch: 1.3, dragonkid: 1.3 };
function journey(p) {
  const save = { ...G.freshSave() };
  const events = [];
  let spent = 0;
  let day = 0;
  let runNo = 0;
  let allBought = null;
  // Keeps going until every boss, every hero and the whole shop are done (or 40 days).
  while (day < 40 && (save.bosses.length < MAPS.length || save.heroes.length < HEROES.length - 2 || allBought === null)) {
    day++;
    for (let r = 0; r < 5; r++) {
      runNo++;
      const map = MAPS.findIndex((_, i) => G.mapOpen(save, i) && !save.bosses.includes(i));
      const mapIndex = map < 0 ? p % MAPS.length : map;
      const open = HEROES.filter((h) => G.heroOpen(save, h.id)).sort((a, b) => STRENGTH[b.id] - STRENGTH[a.id]);
      const hero = open[runNo % 3 === 0 ? Math.min(1, open.length - 1) : 0];
      const s = playNow(HEROES.indexOf(hero), mapIndex, save.shop, 50000 + p * 1000 + runNo);
      const unlocked = G.newUnlocks(save, s, mapIndex);
      save.gold += s.gold;
      save.kills += s.kills;
      if (s.bossBeaten && !save.bosses.includes(mapIndex)) { save.bosses.push(mapIndex); events.push(`d${day} ${MAPS[mapIndex].monsters[4].name}`); }
      for (const u of unlocked) { save.heroes.push(u); events.push(`d${day} +${HEROES.find((h) => h.id === u).name}`); }
      for (;;) {
        if (G.shopAllBought(save.shop)) { allBought ??= day; break; }
        const next = SHOP_IDS.filter((id) => G.nextCost(save.shop, id) !== null)
          .sort((a, b) => G.nextCost(save.shop, a) - G.nextCost(save.shop, b))[0];
        const done = G.buy(save, next);
        if (typeof done === 'string') break;
        spent += save.gold - done.gold;
        save.gold = done.gold;
        save.shop = done.shop;
      }
    }
  }
  return { day, events, spent, gold: save.gold, allBought };
}

if (!isMainThread) {
  parentPort.on('message', ({ id, job }) => {
    const out = job.kind === 'journey' ? journey(job.p) : playNow(job.hero, job.map, job.shop, job.seed, job.style);
    parentPort.postMessage({ id, out });
  });
} else {
  await main();
}

async function main() {
  const workers = Array.from({ length: Math.max(1, availableParallelism() - 1) }, () =>
    new Worker(fileURLToPath(import.meta.url), { workerData: { bundlePath } }));
  const waiting = new Map();
  let next = 0;
  const queue = [];
  const idle = [...workers];
  for (const w of workers) {
    w.on('message', ({ id, out }) => {
      waiting.get(id)(out);
      waiting.delete(id);
      const more = queue.shift();
      if (more) { waiting.set(more.id, more.done); w.postMessage({ id: more.id, job: more.job }); } else idle.push(w);
    });
  }
  const run = (job) => new Promise((done) => {
    const id = next++;
    const w = idle.pop();
    if (w) { waiting.set(id, done); w.postMessage({ id, job }); } else queue.push({ id, job, done });
  });
  const play = (hero, map, shop, seed, style = 'pupil') => run({ kind: 'run', hero, map, shop, seed, style });

  if (ONLY === 'all' || ONLY === 'still') {
    console.log('\n== The first go on Castle Fields (no shop): when a hero falls ==');
    for (const [label, style] of [['standing still', 'still'], ['simple bot (runs away, first card)', 'simple'], ['like a pupil', 'pupil']]) {
      for (const h of [0, 1]) {
        const runs = await Promise.all(Array.from({ length: SEEDS }, (_, k) => play(h, 0, {}, 1000 + k, style)));
        console.log(`${HEROES[h].name.padEnd(8)} ${label.padEnd(36)} ${runs.map((r) => (r.outcome === 'lost' ? clock(r.seconds) : r.outcome === 'won' ? 'WON' : '3:00')).join(' ')}`);
      }
    }
  }

  if (ONLY === 'all' || ONLY === 'grid') {
    for (const [label, shop] of [['no shop', {}], ['half shop (level 2)', fullShop(2)], ['whole shop', fullShop(SHOP_LEVELS)]]) {
      console.log(`\n== Every hero on every map, ${label}, ${SEEDS} seeds: won/survived/fell (avg fall), level-ups, questions, gold ==`);
      console.log(`${''.padEnd(12)}${MAPS.map((m) => m.name.padEnd(30)).join('')}`);
      const cells = await Promise.all(HEROES.map((_, h) => Promise.all(MAPS.map((_, mi) =>
        Promise.all(Array.from({ length: SEEDS }, (_, k) => play(h, mi, shop, 2000 + k * 31 + mi)))))));
      const totals = MAPS.map(() => ({ won: 0, n: 0, ups: [], qs: [], gold: [] }));
      HEROES.forEach((hero, h) => {
        let line = hero.name.padEnd(12);
        MAPS.forEach((m, mi) => {
          const runs = cells[h][mi];
          const won = runs.filter((r) => r.outcome === 'won').length;
          const surv = runs.filter((r) => r.outcome === 'survived').length;
          const fell = runs.filter((r) => r.outcome === 'lost');
          const t = totals[mi];
          t.won += won; t.n += runs.length; t.ups.push(...runs.map((r) => r.levelUps)); t.qs.push(...runs.map((r) => r.questions)); t.gold.push(...runs.map((r) => r.gold));
          line += `${won}/${surv}/${fell.length}${fell.length ? ` (${clock(Math.round(avg(fell.map((r) => r.seconds))))})` : ''} L${Math.round(avg(runs.map((r) => r.levelUps)))} Q${Math.round(avg(runs.map((r) => r.questions)))} 🪙${Math.round(avg(runs.map((r) => r.gold)))}`.padEnd(30);
        });
        console.log(line);
      });
      console.log(`${'all heroes'.padEnd(12)}${totals.map((t) => `won${pct(t.won, t.n)} L${Math.round(avg(t.ups))} Q${Math.round(avg(t.qs))} 🪙${Math.round(avg(t.gold))}`.padEnd(30)).join('')}`);
    }
  }

  if (ONLY === 'all' || ONLY === 'journey') {
    console.log('\n== A steady player: 5 runs a school day, cheapest shop level first, best open hero, first unbeaten map ==');
    const js = await Promise.all(Array.from({ length: Math.max(4, SEEDS) }, (_, p) => run({ kind: 'journey', p })));
    js.forEach((j, p) => console.log(`player ${p + 1}: ${j.day} days; shop all bought day ${j.allBought ?? '–'}; ${j.spent} gold spent, ${j.gold} left. ${j.events.join(', ')}`));
  }

  for (const w of workers) await w.terminate();
}
void STEPS_PER_SECOND;
