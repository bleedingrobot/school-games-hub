/**
 * Pace check for Parrot's See-saw (docs/PARROT-PLAN.md): pretend children play the real server rules (handleParrot on the
 * in-memory services) 3 or 4 school days a week and the script prints how many weeks they take to win the Golden Bell
 * (30 finished days; the plan aims at weeks 8 to 10) and where their step and help level end up.
 * Run: npx tsx scripts/parrot-sim.mjs
 */
import { memoryServices } from '../shared/parrot/memoryServices';
import { handleParrot } from '../shared/parrot/server';
import { showRound, isStoneGo } from '../shared/parrot/round';

const DAY = 86_400_000;
/** A pretend child: chance of a first-tap right answer, growing a little with every challenge played. */
const kids = { shaky: 0.45, steady: 0.7, strong: 0.9 };
const perWeek = [3, 4];

async function play(rightRate, days) {
  let t = Date.UTC(2026, 10, 2, 8); // Monday 2 Nov 2026, 9 pm NZ
  let seed = 0.123;
  const services = memoryServices({ now: () => t, random: () => (seed = (seed + 0.6180339) % 1) });
  const pupil = 'sim';
  let finished = 0;
  let weeks = 0;
  let last = null;
  let bellWeek = null;
  const rnd = () => Math.random();
  for (let day = 0; finished < 45 && day < 400; day++) {
    t = Date.UTC(2026, 10, 2, 8) + day * DAY;
    const weekday = day % 7;
    if (weekday >= days) continue;
    const { round } = (await handleParrot(services, pupil, { action: 'start' })).body;
    const level = round.level;
    const taps = [];
    const skill = Math.min(0.97, rightRate + finished * 0.004 + (5 - level) * 0.02);
    for (const go of showRound(round)) {
      const right = rnd() < skill;
      const wrong = isStoneGo(go) ? (go.answer + 1) % 21 : go.wrongs[0].n;
      if (!right) taps.push({ pick: wrong, ms: 4000 });
      taps.push({ pick: go.answer, ms: 3000 });
    }
    const r = await handleParrot(services, pupil, { action: 'finish', seed: round.seed, taps });
    finished = r.body.daysDone;
    last = r.body;
    weeks = Math.floor(day / 7) + 1;
    if (r.body.goldenBell && bellWeek === null) bellWeek = weeks;
  }
  return { bellWeek, step: last.step, level: last.level };
}

for (const [name, rate] of Object.entries(kids)) {
  for (const days of perWeek) {
    const r = await play(rate, days);
    console.log(`${name.padEnd(7)} ${days} days a week: Golden Bell in week ${r.bellWeek ?? 'after 57+'}, ends at step ${r.step}, help level ${r.level}`);
  }
}
