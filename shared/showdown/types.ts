/** Class Showdown's shapes (docs/SHOWDOWN-PLAN.md). Plain JSON, so the server can save a round in one row. */
import type { Planned } from './schedule';

/** Whole class vs the boss, 2 teams, 4 teams, everyone for themselves. */
export type Mode = 'class' | 'teams2' | 'teams4' | 'solo';
export type Role = 'striker' | 'guard' | 'healer';
export type TeamId = 'red' | 'blue' | 'gold' | 'green';

export interface Player {
  id: string;
  /** First name, for the projector (the teacher can hide names on screen). */
  name: string;
  /** Ladder place (higher = further on), only used to mix teams fairly. Never shown. */
  ladder: number;
  team: TeamId | null;
  role: Role;
  joinedAt: number;
  /** The next time an answer is accepted (the iPad's filling ring). */
  nextAt: number;
  dazedUntil: number;
  /** Last time this pupil answered or joined: idle pupils don't count towards the shield target. */
  lastActive: number;
  score: number;
  damage: number;
  streak: number;
  bestStreak: number;
  correct: number;
  wrong: number;
  shields: number;
  revives: number;
  chests: number;
  goldenUsed: boolean;
  /** What the pupil got when the round ended (set once, by the server). */
  reward?: import('./bosses').Reward | null;
  /** When this pupil got the golden question right, for the "golden moment" award. */
  goldenRightAt: number | null;
  /** Worst place held after the first minute, for "best comeback" (1 = top). */
  worstRank: number | null;
}

export interface WindUp {
  endsAt: number;
  /** Started by the teacher's enrage button: a weak spot opens when it's over. */
  enraged: boolean;
  /** Group key ('all', a team id, or a pupil id in solo) -> shield needed, shield so far, and who helped. */
  groups: Record<string, { needed: number; got: number; counted: string[]; done: 'held' | 'broke' | null }>;
}

export interface Round {
  seed: number;
  mode: Mode;
  lengthMin: number;
  state: 'lobby' | 'live' | 'over';
  result: 'beaten' | 'time' | null;
  /** The time the round was last brought up to (ms from the start). */
  t: number;
  boss: { max: number; hp: number; phase: 1 | 2 | 3 };
  /** Which boss of the roster (shared/showdown/bosses.ts). Missing in rounds from before Stage 5: the River Titan. */
  bossId?: import('./bosses').BossId;
  players: Record<string, Player>;
  /** Pupil ids in the order they joined. */
  order: string[];
  teams: TeamId[];
  teamPoints: Partial<Record<TeamId, number>>;
  teamDamage: Partial<Record<TeamId, number>>;
  schedule: Planned[];
  /** Index of the next planned event still to happen. */
  nextPlanned: number;
  windUp: WindUp | null;
  /** Shield banked by Guards between wind-ups, per group. */
  bank: Record<string, number>;
  weakSpotUntil: number;
  goldenFrom: number | null;
  goldenUntil: number;
  enrageUntil: number;
  lastEnrageAt: number | null;
  finalStarted: boolean;
  roleSwapUntil: number;
  /** 2 teams: where the boss stands on the bridge, from -1 (pushed right onto red's side) to 1 (onto blue's side). */
  tug: number;
  tugShown: number;
  /** 4 teams: the team the boss is facing (the one in front). */
  facing: TeamId | null;
  facingSince: number;
  lastHit: string | null;
  nextRankAt: number;
  /** The teacher has moved someone by hand, so joining no longer re-mixes the teams. */
  teamsByHand: boolean;
  /** Testing and the simulator only: a fixed boss health instead of the tuned table. */
  bossOverride: number | null;
}

/** Everything the projector and iPads animate. `t` is ms from the start of the round. */
export type ShowdownEvent =
  | { type: 'join'; t: number; pupil: string; team: TeamId | null }
  | { type: 'team_move'; t: number; pupil: string; team: TeamId }
  | { type: 'role'; t: number; pupil: string; role: Role }
  | { type: 'start'; t: number; bossMax: number }
  | { type: 'boss_grows'; t: number; bossMax: number }
  | {
      type: 'hit';
      t: number;
      pupil: string;
      team: TeamId | null;
      role: Role;
      points: number;
      damage: number;
      streak: number;
      /** Total multiplier (streak x weak spot x golden): bigger numbers, bigger burst. */
      times: number;
      weakSpot: boolean;
      golden: boolean;
    }
  /** iPad only: a wrong answer is never shown on the projector. */
  | { type: 'wrong'; t: number; pupil: string; waitUntil: number }
  | { type: 'streak'; t: number; pupil: string; streak: number }
  | { type: 'lucky_chest'; t: number; pupil: string; points: number }
  | { type: 'revive'; t: number; pupil: string; woke: string }
  | { type: 'wind_up'; t: number; endsAt: number; enraged: boolean; groups: { group: string; needed: number }[] }
  | { type: 'shield_progress'; t: number; group: string; got: number; needed: number }
  | { type: 'shield_held'; t: number; group: string; guards: string[] }
  | { type: 'shield_broke'; t: number; group: string; dazed: string[]; dazedUntil: number }
  | { type: 'boss_heals'; t: number; amount: number; hp: number }
  | { type: 'weak_spot'; t: number; endsAt: number; times: number }
  | { type: 'weak_spot_end'; t: number }
  | { type: 'phase'; t: number; phase: 2 | 3; roleSwapUntil: number }
  | { type: 'golden'; t: number; endsAt: number }
  | { type: 'golden_end'; t: number }
  | { type: 'final'; t: number; endsAt: number }
  | { type: 'enrage'; t: number; endsAt: number }
  | { type: 'enrage_end'; t: number }
  | { type: 'tug'; t: number; position: number; leading: TeamId | null }
  | { type: 'boss_turns'; t: number; team: TeamId }
  | { type: 'boss_beaten'; t: number; lastHit: string | null }
  | { type: 'time_up'; t: number };

export type Refusal = 'not_live' | 'not_playing' | 'too_soon' | 'dazed' | 'not_now' | 'no_such_team' | 'cooldown';
export type Outcome = { ok: true; events: ShowdownEvent[] } | { ok: false; reason: Refusal; events: ShowdownEvent[] };
