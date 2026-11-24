/**
 * The one-screen "How to play" the big screen shows before a round starts (James, 24 Nov 2026): the goal, the roles, the
 * big moment to watch for and how this mode is won, for every arena and mode. The class reads it (Bella reads the top
 * line and the mode line aloud), then the teacher presses to start.
 */
import type { Arena, Mode } from '../../../shared/showdown/types';
import { arenaWords } from './arenaWords';
import { HOW_TO_LINES } from './voiceLines';

export interface HowToPlay {
  title: string;
  /** The goal in one line, also what Bella says first. */
  goal: string;
  roles: { emoji: string; name: string; line: string }[];
  /** True when everyone plays the same role (solo). */
  oneRole: boolean;
  /** The two big moments: the wind-up to stop and the bonus to grab. */
  watch: { emoji: string; text: string }[];
  /** How this mode is won, also what Bella says second. */
  win: { emoji: string; text: string };
}

const WATCH: Record<Arena, { emoji: string; text: string; solo?: string }[]> = {
  boss: [{ emoji: '⚠️', text: 'Boss winding up? Guards answer fast to hold the shield!', solo: 'Boss winding up? Answer fast to hold your shield!' }, { emoji: '🎯', text: 'Weak spot: double damage!' }],
  goldrush: [{ emoji: '⚠️', text: 'Cave-in coming? Prop-holders answer fast to hold up the roof!', solo: 'Cave-in coming? Answer fast to hold up your roof!' }, { emoji: '💎', text: 'Mother lode: double gold! Pick a rich seam on your iPad.' }],
  skyclimb: [{ emoji: '🌪️', text: 'Storm coming? Anchors hold the rope. Keep answering or get blown back!', solo: 'Storm coming? Keep answering or get blown back!' }, { emoji: '⬆️', text: '3 right in a row = a big jump. Updraft: double height!' }],
  island: [{ emoji: '🌊', text: 'Big wave coming? Wave-breakers answer fast to hold it back!', solo: 'Big wave coming? Answer fast to hold it back!' }, { emoji: '📦', text: 'Right answers move you inland, away from the water. Crates: double planks!' }],
  hill: [{ emoji: '🐎', text: 'Challengers charging? Defenders hold them off, or the crown falls!', solo: 'Challengers charging? Answer fast to hold them off, or the crown falls!' }, { emoji: '👑', text: 'Most points in the last 30 seconds wears the crown and earns crown points.' }],
  auction: [{ emoji: '🦹', text: 'Thieves sneaking in? Watchmen answer fast to catch them!', solo: 'Thieves sneaking in? Answer fast to catch them!' }, { emoji: '💰', text: 'Bid for treasure on your iPad. A bargain makes you richer!' }],
};

const WIN: Record<Mode, { emoji: string; text: (goal: string) => string }> = {
  class: { emoji: '🤝', text: (g) => `One team: ${g} together before the time runs out!` },
  teams2: { emoji: '🔴🔵', text: () => 'Red vs Blue: the team that does more wins. But beat the goal together first!' },
  teams4: { emoji: '🏁', text: () => 'Four teams: the most points wins. But beat the goal together first!' },
  solo: { emoji: '🏆', text: () => 'Everyone for themselves: get into the top 10! Bounties for most hits, longest streak and best comeback.' },
};

const GOAL: Record<Arena, string> = {
  boss: 'beat the boss',
  goldrush: 'dig out all the gold',
  skyclimb: 'reach the summit',
  island: 'build the raft',
  hill: 'build the castle',
  auction: 'fill the royal treasury',
};

export function howToPlay(arena: Arena, mode: Mode): HowToPlay {
  const W = arenaWords(arena);
  const roles = Object.values(W.roles);
  const solo = mode === 'solo';
  return {
    title: W.name,
    // Bella says the arena's name first; on screen the title already does.
    goal: HOW_TO_LINES[arena].replace(/^[^!]+! /, ''),
    roles: solo ? [roles[0]] : roles,
    oneRole: solo,
    // Solo has no Guards: everyone holds their own shield.
    watch: WATCH[arena].map((w) => ({ emoji: w.emoji, text: solo && w.solo ? w.solo : w.text })),
    win: { emoji: WIN[mode].emoji, text: WIN[mode].text(GOAL[arena]) },
  };
}

/** What Bella says, in order: the arena's goal, then how this mode is won. */
export const howToLines = (arena: Arena, mode: Mode): string[] => [HOW_TO_LINES[arena], HOW_TO_LINES[mode], HOW_TO_LINES.ready];
