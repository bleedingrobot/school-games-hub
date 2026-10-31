/**
 * What each fight choice and spell does, in a line a child can read. Display only: the rules are in
 * shared/clans/fight.ts, and the ranges here copy its sums (abilities.test.ts checks them against real casts).
 */
import type { SpellDef } from '../../../shared/clans/spells';

/** The fight menu's choices. */
export const ACTION_HELP = {
  attack: 'Hit one enemy with your weapon. Quick enemies may dodge.',
  spell: 'Use skill points (SP) to cast one of your spells.',
  guard: 'Take half damage from every hit this round.',
  run: 'The whole clan tries to escape. Harder against quick enemies.',
  /** Monster fights only. */
  potion: (percent: number) => `Heal a friend by ${percent}% of their health. Uses one potion.`,
  plan: 'Everyone does what the plan says. Change anyone first if you like.',
  keep: 'Leave this member on the plan.',
} as const;

/** Who is casting: a member's level and wisdom (gear and spells included). */
export interface Caster {
  level: number;
  wisdom: number;
}

/** The smallest and biggest amount a damage or healing spell can do for this caster. */
export function spellRange(spell: SpellDef, caster: Caster): [number, number] {
  const lvl = Math.min(caster.level, 10);
  if (spell.kind === 'heal') {
    const base = spell.value + Math.floor(lvl / 2);
    return [Math.floor((base * 50) / 100), Math.floor((base * 99) / 100)];
  }
  const base = spell.value + Math.floor((lvl + caster.wisdom) / 3);
  return [Math.max(1, Math.floor((base * 50) / 100)), Math.max(1, Math.floor((base * 109) / 100))];
}

const UP: Record<string, string> = { strength: 'hits harder', agility: 'quicker and harder to hit', dexterity: 'aims better' };
const DOWN: Record<string, string> = { strength: 'hits softer', agility: 'slower and easier to hit', dexterity: 'misses more' };

/** One line on what a spell does, with this caster's numbers. */
export function spellHelp(spell: SpellDef, caster: Caster): string {
  const [lo, hi] = spellRange(spell, caster);
  const amount = lo === hi ? `${lo}` : `${lo} to ${hi}`;
  switch (spell.kind) {
    case 'damage':
      return spell.all ? `Hurts every enemy for ${amount} each. Never misses.` : `Hurts one enemy for ${amount}. Never misses.`;
    case 'heal':
      return `Heals one clan member for ${amount} HP.`;
    case 'tie':
      return 'Ties up one enemy so they lose their next turn. They might wriggle free.';
    case 'summon':
      return 'Calls a helper to fight for you (coming later).';
    default: {
      const mod = spell.mod;
      if (!mod) return '';
      const sign = mod.amount > 0 ? '+' : '';
      if (spell.friendly) return `A clan member ${UP[mod.stat] ?? `gets better ${mod.stat}`} for ${mod.rounds} rounds (${sign}${mod.amount} ${mod.stat}).`;
      return `One enemy ${DOWN[mod.stat] ?? `gets worse ${mod.stat}`} for ${mod.rounds} rounds (${sign}${mod.amount} ${mod.stat}). They might shrug it off.`;
    }
  }
}
