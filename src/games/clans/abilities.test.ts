import { describe, expect, it } from 'vitest';
import { rollMember } from '../../../shared/clans/character';
import { newFight, playRound } from '../../../shared/clans/fight';
import { SPELLS } from '../../../shared/clans/spells';
import { spellHelp, spellRange } from './abilities';

describe('spell help', () => {
  it('has a line for every spell a player can cast', () => {
    for (const s of Object.values(SPELLS).filter((s) => !s.notYet)) expect(spellHelp(s, { level: 1, wisdom: 3 })).not.toBe('');
  });

  it('gives Fireball and Lightning Bolt their real damage for a level 1 caster with 5 wisdom', () => {
    expect(spellHelp(SPELLS[8], { level: 1, wisdom: 5 })).toBe('Hurts one enemy for 5 to 11. Never misses.');
    expect(spellHelp(SPELLS[15], { level: 1, wisdom: 5 })).toBe('Hurts one enemy for 13 to 29. Never misses.');
    expect(spellHelp(SPELLS[3], { level: 1, wisdom: 5 })).toBe('One enemy slower and easier to hit for 3 rounds (-2 agility). They might shrug it off.');
  });

  // The ranges copy the engine's sums: cast each spell many times and check every amount lands inside, and both ends turn up.
  it.each([8, 15, 25, 1, 2])('matches what the fight engine does for spell %i', (id) => {
    const spell = SPELLS[id];
    const member = { ...rollMember({ rng: 3 }, 'Caster', 'Elf', 'Wizard'), level: 4 };
    const seen = new Set<number>();
    let range: [number, number] = [0, 0];
    for (let seed = 1; seed <= 400; seed++) {
      const fight = newFight([member], 1, seed);
      const me = fight.clan[0];
      me.spells = [id];
      me.sp = me.maxSp = 999;
      me.stats.agility = 60; // goes first, before anything can hurt it
      me.hp = 1; // room to heal
      me.maxHp = 999;
      for (const e of fight.enemies) e.hp = e.maxHp = 9999;
      playRound(fight, [{ action: 'spell', spell: id, target: 0 }]);
      for (const e of fight.log) if (e.type === 'cast' && e.who === 'Caster') seen.add(e.amount);
      range = spellRange(spell, { level: me.level, wisdom: me.stats.wisdom });
    }
    const [lo, hi] = range;
    expect(Math.min(...seen)).toBe(lo);
    expect(Math.max(...seen)).toBe(hi);
  });
});
