/**
 * Round playback (docs/CLANS-FIGHT-FEEL.md, stage 1): the steps shown one at a time must add up to exactly what the
 * engine played, and the summary must count the round right.
 */
import { describe, expect, it } from 'vitest';
import { botOrders } from '../../../shared/clans/bot';
import { newFight, playRound, type FightState } from '../../../shared/clans/fight';
import { newClan } from '../../../shared/clans/sim';
import { labelDuplicates } from './fightView';
import { BIG_HIT, inOrder, roundSteps, roundSummary, spellBurst, stepMs, type Who } from './playback';

const hpNow = (f: FightState) => {
  const hp: Record<string, number> = {};
  for (const c of f.clan) hp[`c${c.index}`] = c.hp;
  for (const e of f.enemies) hp[`e${e.index}`] = e.hp;
  return hp;
};

describe('round playback', () => {
  it("ends every round on exactly the engine's HP, round after round, with heals, spells and Battle Cries", () => {
    for (const lineup of ['balanced', 'fighters'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const clan = newClan(lineup, seed);
        let f = labelDuplicates(newFight(clan.members, seed % 6, seed * 31));
        const names = new Set(f.clan.map((c) => c.name));
        for (let round = 0; !f.result && round < 10; round++) {
          const next = structuredClone(f);
          const from = next.log.length;
          playRound(next, botOrders(next), (['damage', 'heal', null] as const)[(seed + round) % 3]);
          const steps = roundSteps(f, next, from, names);
          expect(steps.length).toBeGreaterThan(0);
          expect(steps[steps.length - 1].hp).toEqual(hpNow(next));
          f = next;
        }
      }
    }
  });

  it('gives every hit a floating number, every miss a "miss!", and every heal a green "+"', () => {
    const clan = newClan('balanced', 3);
    const f = labelDuplicates(newFight(clan.members, 4, 99));
    const next = structuredClone(f);
    playRound(next, botOrders(next), 'heal');
    const steps = roundSteps(f, next, f.log.length, new Set(f.clan.map((c) => c.name)));
    for (const st of steps) {
      if (/ hits .* for \d+\./.test(st.line)) expect(['damage', 'big']).toContain(st.targets[0].float?.kind);
      if (/ and misses\.$/.test(st.line)) expect(st.targets[0].float).toEqual({ text: 'miss!', kind: 'miss' });
    }
    const cry = steps.find((st) => st.line.includes('Battle Cry'))!;
    expect(cry.targets.length).toBeGreaterThan(0);
    for (const t of cry.targets) expect(t.float?.text ?? '+0').toMatch(/^\+\d+$/);
  });

  it('shows the attacker and the target of each action', () => {
    const clan = newClan('fighters', 5);
    const f = labelDuplicates(newFight(clan.members, 2, 7));
    const next = structuredClone(f);
    playRound(next, botOrders(next), null);
    const steps = roundSteps(f, next, f.log.length, new Set(f.clan.map((c) => c.name)));
    const hit = steps.find((st) => / hits /.test(st.line))!;
    expect(hit.actor).toMatch(/^[ce]\d$/);
    expect(hit.targets[0].who).toMatch(/^[ce]\d$/ as unknown as Who);
  });

  it('sums up the round: damage done and taken, who is beaten and who is resting', () => {
    const clan = newClan('balanced', 2);
    const f = labelDuplicates(newFight(clan.members, 1, 1234));
    const names = new Set(f.clan.map((c) => c.name));
    const from = f.log.length;
    playRound(f, botOrders(f), null);
    const s = roundSummary(f, from, names);
    const lines = f.log.slice(from);
    const dealt = lines.reduce((t, e) => t + (e.type === 'hit' && names.has(e.who) ? e.damage : 0), 0);
    expect(s.dealt).toBeGreaterThanOrEqual(dealt);
    expect(s.text).toMatch(/^Round 1: you did \d+ damage and took \d+\./);
    for (const name of s.beaten) expect(s.text).toContain(name);
  });

  it('shows a knock-out just after the hit that caused it', () => {
    const events = inOrder([
      { type: 'down', who: 'Rat' },
      { type: 'hit', who: 'Ash', target: 'Rat', damage: 5 },
      { type: 'miss', who: 'Rat', target: 'Ash' },
    ]);
    expect(events.map((e) => e.type)).toEqual(['hit', 'down', 'miss']);
  });

  it('marks big hits, knock-outs and close calls, round after round', () => {
    let big = 0;
    let downs = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const clan = newClan('balanced', seed);
      let f = labelDuplicates(newFight(clan.members, 3 + (seed % 4), seed * 17));
      const names = new Set(f.clan.map((c) => c.name));
      for (let round = 0; !f.result && round < 10; round++) {
        const next = structuredClone(f);
        const from = next.log.length;
        playRound(next, botOrders(next), null);
        const max = new Map<string, number>([...next.clan.map((c) => [`c${c.index}`, c.maxHp] as const), ...next.enemies.map((e) => [`e${e.index}`, e.maxHp] as const)]);
        const steps = roundSteps(f, next, from, names);
        for (const st of steps) {
          for (const t of st.targets) {
            const amount = Number(t.float?.text.match(/-(\d+)$/)?.[1] ?? 0);
            if (t.float?.kind === 'damage' || t.float?.kind === 'big') expect(t.big).toBe(amount >= max.get(t.who)! * BIG_HIT);
            if (t.big) (big++, expect(t.float?.text).toMatch(/^BIG HIT! -\d+$/));
            if (t.down) (downs++, expect(st.hp[t.who]).toBe(0));
            if (t.close) expect(st.hp[t.who] / max.get(t.who)!).toBeLessThan(0.2);
          }
        }
        // Every knock-out the engine logged is on a step.
        expect(steps.flatMap((st) => st.targets.filter((t) => t.down)).length).toBe(next.log.slice(from).filter((e) => e.type === 'down').length);
        f = next;
      }
    }
    expect(big).toBeGreaterThan(0);
    expect(downs).toBeGreaterThan(0);
  });

  it('gives each spell its own light', () => {
    expect(spellBurst('Fireball')).toBe('fire');
    expect(spellBurst('Lightning Bolt')).toBe('lightning');
    expect(spellBurst('Thunder Rain')).toBe('lightning');
    expect(spellBurst('Little Heal')).toBe('heal');
    expect(spellBurst('Heavy Blow')).toBe('impact');
    expect(spellBurst('Ropes')).toBe('magic');
    expect(spellBurst('Wither')).toBe('magic');
  });

  it('takes about a third of a second an action, and never much more than 4 seconds a round', () => {
    expect(stepMs(8)).toBe(350);
    expect(stepMs(20) * 20).toBeLessThanOrEqual(4000);
  });
});
