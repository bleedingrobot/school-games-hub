import { describe, expect, it } from 'vitest';
import { applyStep, isNum, isReady, nextStep, parse, stepValue, type Node } from './expr';
import { memoryServices } from './memoryServices';
import type { BagEvent } from './play';
import { handleOrderUp, type KeptSet } from './server';

/** The events of a pupil who works a bag the usual way, with `slips` wrong picks first. */
function solve(text: string, slips = 0): BagEvent[] {
  let root: Node = parse(text);
  const out: BagEvent[] = [];
  for (let s = nextStep(root); s; s = nextStep(root)) {
    if (!isReady(root)) {
      for (let k = 0; k < slips; k++) out.push({ p: [999, 998], ms: 500 });
      slips = 0;
      const ids = s.kind === 'pow' && isNum(s.base) ? [s.base.id] : s.kind === 'bin' && isNum(s.left) && isNum(s.right) ? [s.left.id, s.right.id] : [];
      out.push({ p: ids, ms: 900 });
    }
    out.push({ a: stepValue(s), ms: 1500 });
    root = applyStep(root, s.id);
  }
  return out;
}

const playSet = async (services: ReturnType<typeof memoryServices>, level: number, slips = 0) => {
  const started = await handleOrderUp(services, 'p1', { action: 'start', level });
  expect(started.status).toBe(200);
  const set = started.body.set as KeptSet;
  let last;
  for (let slot = 0; slot < set.bags.length; slot++) last = await handleOrderUp(services, 'p1', { action: 'bag', seed: set.seed, slot, events: solve(set.bags[slot].text, slips) });
  return { set, last: last! };
};

describe('the orderup server', () => {
  it('a passed set opens the next level, gives the achievement and records each bag once; replays never undo it', async () => {
    const services = memoryServices(undefined, { now: () => Date.UTC(2026, 10, 13) });
    expect((await handleOrderUp(services, 'p1', { action: 'start', level: 2 })).body.code).toBe('locked');
    const { set, last } = await playSet(services, 1);
    expect(last.body).toMatchObject({ passedSet: true, newLevel: true, passed: 1, open: 2, good: 8 });
    expect(services.data.changed).toEqual(['p1']);
    expect(services.data.answers).toHaveLength(8);
    expect(services.data.answers.every((a) => a.answers[0].key === 'bedmas:left-to-right' && a.answers[0].correct)).toBe(true);
    // The same bag sent again counts once.
    const again = await handleOrderUp(services, 'p1', { action: 'bag', seed: set.seed, slot: 7, events: solve(set.bags[7].text) });
    expect(again.body.code).toBe('ended');
    // A hard replay of level 1 brings full help back but keeps level 1 passed.
    const hard = await playSet(services, 1, 2);
    expect(hard.last.body).toMatchObject({ passedSet: false, passed: 1 });
    expect(services.data.players.p1.levels['1'].help).toBe('full');
  });

  it('refuses what the pupil could not have done, other pupils’ sets, and a class with it switched off', async () => {
    const services = memoryServices();
    const set = (await handleOrderUp(services, 'p1', { action: 'start', level: 1 })).body.set as KeptSet;
    const bag = (events: unknown, who = 'p1', slot = 0) => handleOrderUp(services, who, { action: 'bag', seed: set.seed, slot, events });
    expect((await bag([{ a: 5, ms: 100 }])).status).toBe(400); // an answer with no step picked
    expect((await bag(solve(set.bags[0].text).slice(0, 1))).body.code).toBe('not-done');
    expect((await bag(solve(set.bags[0].text), 'p2')).body.code).toBe('not-yours');
    expect((await bag(solve(set.bags[1].text), 'p1', 1)).body.code).toBe('ended'); // out of order
    expect((await bag(solve(set.bags[0].text))).status).toBe(200);
    const off = memoryServices(undefined, { settings: { enabled: false, help: 'fade' } });
    expect((await handleOrderUp(off, 'p1', { action: 'load' })).body.code).toBe('game-off');
  });
});
