/**
 * Pace check for Robin's Berry Basket (docs/ROBIN-PLAN.md): pretend children play the real server rules (handleRobin on the
 * in-memory services) 3 or 4 school days a week and the script prints how many weeks they take to win the Golden Berry
 * Feast (30 finished days) and where their step and help level end up.
 * Run: npx tsx scripts/robin-sim.mjs
 */
import { memoryServices } from '../shared/robin/memoryServices';
import { handleRobin } from '../shared/robin/server';
import { showRound } from '../shared/robin/round';

const DAY = 86_400_000;
const kids = { shaky: 0.45, steady: 0.7, strong: 0.9 };
const perWeek = [3, 4];

async function play(rightRate, days) {
  let t = Date.UTC(2026, 10, 2, 8);
  let seed = 0.123;
  const services = memoryServices({ now: () => t, random: () => (seed = (seed + 0.6180339) % 1) });
  const pupil = 'sim';
  let finished = 0;
  let last = { step: 1, level: 5 };
  let feastWeek = null;
  for (let day = 0; finished < 45 && day < 400; day++) {
    t = Date.UTC(2026, 10, 2, 8) + day * DAY;
    if (day % 7 >= days) continue;
    const { round } = (await handleRobin(services, pupil, { action: 'start' })).body;
    const skill = Math.min(0.97, rightRate + finished * 0.004 + (5 - round.level) * 0.02);
    const taps = [];
    for (const go of showRound(round)) {
      const right = Math.random() < skill;
      if (!right) {
        const wrong = go.kind === 'give' ? (go.answer > 0 ? go.answer - 1 : go.answer + 1) : go.wrongs[0].n;
        taps.push({ pick: wrong, ms: 4000 });
      }
      taps.push({ pick: go.answer, ms: 3000 });
    }
    const r = await handleRobin(services, pupil, { action: 'finish', seed: round.seed, taps });
    finished = r.body.daysDone;
    last = r.body;
    if (r.body.feast && feastWeek === null) feastWeek = Math.floor(day / 7) + 1;
  }
  return { feastWeek, step: last.step, level: last.level };
}

for (const [name, rate] of Object.entries(kids)) {
  for (const days of perWeek) {
    const r = await play(rate, days);
    console.log(`${name.padEnd(7)} ${days} days a week: Golden Berry Feast in week ${r.feastWeek ?? 'after 57+'}, ends at step ${r.step}, help level ${r.level}`);
  }
}
