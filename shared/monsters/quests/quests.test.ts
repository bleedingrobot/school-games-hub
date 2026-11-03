import { describe, expect, it } from 'vitest';
import { makeMonster } from '../rules';
import { canMake, RECIPES } from './bits';
import { addEgg, coldEggs, eggWarmth, findEgg, hatch, isReady } from './eggs';
import { afterGiant, canWake, GIANTS } from './giants';
import { nextStep } from './nextStep';
import { jobsFor, record, talkTo } from './quests';
import { emptyQuestSave } from './types';

describe('quests, bits, giants and eggs', () => {
  it('a quest to start says where the person is', () => {
    expect(nextStep(emptyQuestSave(), { badges: [], playDays: 0 }).text).toBe('Someone needs help: talk to the Hermit in Kauri Bush.');
  });

  it('a pupil can go from a quest to a woken giant to a hatched egg, and nothing can be hurried', () => {
    const team = [makeMonster('plusplash-2', 14)];
    let q = emptyQuestSave();
    // The Shell Beach quest: start it, win 3 battles there, solve the stones, show a Water monster.
    q = talkTo(q, 'shell-beach:Hine', team, 1).q;
    for (let i = 0; i < 3; i++) q = record(q, { kind: 'won', map: 'shell-beach', area: 2, foes: ['coinrock-1'] }).q;
    expect(q.bits).toEqual({ stone: 3 });
    q = record(q, { kind: 'solved', id: 'shell-stones' }).q;
    const done = talkTo(q, 'shell-beach:Hine', team, 1);
    expect(done.said).toBe('finished');
    expect(done.given.eggs).toEqual(['quest:shell:water']);
    q = done.q;
    // The tide bell needs its bits; then the giant can be woken, and stays awake once beaten.
    const bell = RECIPES.find((r) => r.id === 'tide-bell')!;
    expect('why' in canMake(q, bell)).toBe(true);
    q = { ...q, bits: { water: 8, stone: 6 }, flags: [...q.flags, 'made:tide-bell'] };
    const drowsea = GIANTS.find((g) => g.id === 'drowsea')!;
    expect(canWake(q, drowsea, ['leaf', 'water'])).toBe(true);
    expect(afterGiant(q, drowsea, 'ran')).toBe(q);
    q = afterGiant(q, drowsea, 'won');
    expect(canWake(q, drowsea, ['leaf', 'water'])).toBe(false);
    // The egg: its insides are fixed when found; it needs its days and its own spot, and can't be found twice.
    const egg = findEgg('quest:shell:water', 'water', 10, () => 0.6);
    q = addEgg(q, egg).q;
    expect(addEgg(q, egg).added).toBe(false);
    expect(isReady(egg, 14)).toBe(false);
    expect(nextStep(q, { badges: ['leaf', 'water'], playDays: 15 }).text).toMatch(/rock pools on Lagoon Isle/);
    expect(hatch(q, egg.id, 15, { map: 'shell-beach', spot: 'rock-pools' })).toBeNull();
    const hatched = hatch(q, egg.id, 15, { map: 'lagoon-isle', spot: 'rock-pools' })!;
    expect(hatched.monster.species).toBe(egg.species);
    expect(hatched.q.eggs).toEqual([]);
    // Left 4 days in a row with no battle, eggs go cold: a warning on the 4th day, gone on the 5th.
    const kept = { ...q, lastDay: '2026-11-02' };
    expect(eggWarmth(kept, '2026-11-05')).toBe('warm');
    expect(eggWarmth(kept, '2026-11-06')).toBe('cooling');
    expect(coldEggs(kept, '2026-11-06').lost).toEqual([]);
    expect(coldEggs(kept, '2026-11-07')).toEqual({ q: { ...kept, eggs: [] }, lost: [egg] });
    expect(coldEggs(q, '2027-02-01').lost).toEqual([]);
    // Every day's jobs are three, one needing no battle, and only in areas the pupil can reach.
    for (let d = 1; d <= 60; d++) {
      const jobs = jobsFor(`2026-11-${String(d).padStart(2, '0')}`, 'pupil-a', { maxArea: 2 });
      expect(jobs).toHaveLength(3);
      expect(jobs.some((j) => j.do === 'bring' || j.do === 'visit')).toBe(true);
      expect(jobs.every((j) => !j.area || j.area <= 2)).toBe(true);
    }
  });
});
