/**
 * The quest side of a Maths Monsters game (docs/MONSTERS-QUESTS-PLAN.md): what is kept in the save,
 * and the shapes of quests, rewards and eggs. Plain data only, like the rest of `WorldState`.
 */
import type { Bag } from '../engine';
import type { TypeId } from '../types';

/** Crafting bits, one kind per type (kawakawa leaves, shells, embers, frost crystals, glow dust, pebbles). */
export type Bits = Partial<Record<TypeId, number>>;

/** Which hatching spot an egg wants: one per type. */
export type EggKind = 'leafy' | 'water' | 'warm' | 'cold' | 'glowing' | 'stony';

export interface Egg {
  /** Where it came from, unique for the whole game (e.g. "quest:kauri", "nest:steam-valley:2026-11-02"). */
  id: string;
  kind: EggKind;
  /** What's inside, fixed when it is found so reloading can't change it. The pupil doesn't see it. */
  species: string;
  shiny?: true;
  /** The pupil's play-day count (counted by the database) when it was found. */
  found: number;
  /** An egg warmer was used on it: one day fewer. */
  warmed?: true;
}

/**
 * How far through a story quest: which step (0 = first), and the count towards it. `ready`: the step
 * is done but not handed in yet; the next part starts when you go back to the quest giver.
 */
export interface QuestStepState {
  step: number;
  n: number;
  ready?: true;
}

/** Today's notice-board jobs: the NZ day they are for, and the count towards each. A job is done when its count is reached. */
export interface BoardDay {
  day: string;
  n: number[];
  /** Jobs whose reward has been given. */
  paid: number[];
}

/** Everything quests add to a save. Missing on games saved before quests: `emptyQuestSave()` is the same as missing. */
export interface QuestSave {
  /** Things that have happened, each once, never removed: "quest-done:kauri", "made:warm-whistle", "woke:snorumble", "solved:shell-stones". */
  flags: string[];
  bits: Bits;
  /** Story quests started (and not yet finished). A finished one has the flag "quest-done:<id>" instead. */
  quests: Record<string, QuestStepState>;
  board?: BoardDay;
  /** Up to 3 eggs carried. */
  eggs: Egg[];
  /** The NZ day of the last battle (any outcome). Eggs go cold after EGGS.coldAfter days in a row without one. */
  lastDay?: string;
}

export const emptyQuestSave = (): QuestSave => ({ flags: [], bits: {}, quests: {}, eggs: [] });

/** What a quest, a job, a puzzle or a nest gives. */
export interface Reward {
  items?: Bag;
  bits?: Bits;
  egg?: EggKind;
  /** A flag set when it is given, e.g. a part for a wake-up item. */
  flag?: string;
}

/**
 * One thing to do. `count` defaults to 1.
 *  - catch: catch monsters (of `type`, in `area`, if given)
 *  - win: win battles (in `area` or on `map`, if given; `trainer` for trainers only)
 *  - bring: hand over `count` bits of `type` when you talk to `person`
 *  - show: talk to `person` with a `type` monster of at least `level` on your team
 *  - visit: stand on the map spot `spot` of `map`
 *  - solve: solve the puzzle `id`
 *  - talk: talk to `person`
 *  - beat: beat the trainer `id`
 */
export interface Task {
  do: 'catch' | 'win' | 'bring' | 'show' | 'visit' | 'solve' | 'talk' | 'beat';
  type?: TypeId;
  area?: number;
  map?: string;
  spot?: string;
  person?: string;
  id?: string;
  level?: number;
  count?: number;
  trainer?: true;
  /** The "what next" line for this step, with {left} for how many are still to go. */
  hint: string;
}

export interface Quest {
  id: string;
  title: string;
  /** The person who gives it (a thing id on a map) and the area it belongs to. */
  giver: string;
  /** What to do once a part is done: "Go back to the Hermit in Kauri Bush". */
  back: string;
  area: number;
  /** Needs this flag first (the finale needs every giant woken, for example). */
  needs?: string[];
  /** Needs this many badges first. */
  badges?: number;
  steps: Task[];
  reward: Reward;
}

/** Something that happened in the game that quests and jobs count. */
export type ProgressEvent =
  | { kind: 'won'; map: string; area: number; trainer?: string; foes: string[] }
  | { kind: 'caught'; map: string; area: number; species: string }
  | { kind: 'visit'; map: string; spot: string }
  | { kind: 'solved'; id: string }
  | { kind: 'talk'; person: string };
