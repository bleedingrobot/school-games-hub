/**
 * Class Live's rewards (docs/CLASSLIVE-PLAN.md, stage 4): hub points and the totals behind the trophies, worked out
 * once a session is over and paid once per room and session (`classlive_finish`). Pupils who only joined get 1 point.
 */
import { podium } from './corners';
import type { Session } from './server';

export interface PupilReward {
  player: string;
  points: number;
  /** For the trophies. */
  stars: number;
  boxes: number;
  head: boolean;
  tiles: number;
  guessed: boolean;
  /** Four Corners: safe rounds, top of the podium, jail escapes, power-ups switched on. */
  safe: number;
  champion: boolean;
  escapes: number;
  powers: number;
  /**
   * Per-game totals for a game's own trophies (migration 20261125000800_classlive_activities): keys of 2 to 30 lowercase
   * letters or _, whole numbers 0 to 500 a session. classlive_counts returns each as the measure 'classlive_<key>'.
   */
  extra?: Record<string, number>;
}

export interface FinishedSession {
  seed: number;
  activity: Session['activity'];
  /** The class reached the goal (the sky creature, the serpent awake, or the picture guessed). */
  goal: boolean;
  players: PupilReward[];
}

/**
 * Points: 1 for taking part, 3 for doing some of the maths, +2 for the class goal, +2 for guessing the picture. At most 10.
 * Four Corners has no class goal: +2 for a podium place instead (the `guessed` bonus).
 */
export const POINTS = { joined: 1, played: 3, goal: 2, guessed: 2, max: 10 } as const;

export function rewardsOf(s: Session): FinishedSession {
  const g = s.game;
  const goal = g.kind === 'stars' ? g.creature : g.kind === 'serpent' ? g.awake : g.kind === 'corners' ? false : g.solvers.length > 0;
  const top = g.kind === 'corners' ? podium(g, s.order) : [];
  const players = s.order.map((id): PupilReward => {
    let did = false;
    const r: PupilReward = { player: id, points: 0, stars: 0, boxes: 0, head: false, tiles: 0, guessed: false, safe: 0, champion: false, escapes: 0, powers: 0 };
    let podiumPlace = false;
    if (g.kind === 'corners') {
      const m = g.mine[id];
      r.safe = m?.safe ?? 0;
      r.escapes = m?.escapes ?? 0;
      r.powers = m?.powersUsed ?? 0;
      const place = top.find((x) => x.player === id)?.place;
      r.champion = place === 1;
      podiumPlace = place !== undefined;
      did = r.safe > 0 || (m?.answered ?? 0) > 0;
      if (g.variant === 'shark') {
        // Shark Bay has its own trophies (migration 20261125001400): kept out of Four Corners' totals.
        r.extra = { shark_safe: r.safe, shark_boats: (m as { boats?: number } | undefined)?.boats ?? 0, shark_wins: r.champion ? 1 : 0, shark_escapes: r.escapes };
        r.safe = 0; r.escapes = 0; r.powers = 0; r.champion = false;
      }
    } else if (g.kind === 'stars') {
      r.stars = g.mine[id]?.found ?? 0;
      did = r.stars + (g.mine[id]?.glows ?? 0) > 0;
    } else if (g.kind === 'serpent') {
      r.boxes = g.mine[id]?.right ?? 0;
      r.head = g.heads.includes(id);
      did = r.boxes > 0;
    } else {
      r.tiles = g.mine[id]?.tiles ?? 0;
      r.guessed = (g.mine[id]?.gotIt ?? 0) > 0;
      did = (g.mine[id]?.right ?? 0) > 0;
    }
    const points = (did ? POINTS.played : POINTS.joined) + (goal && did ? POINTS.goal : 0) + (r.guessed || podiumPlace ? POINTS.guessed : 0);
    r.points = Math.min(POINTS.max, points);
    return r;
  });
  return { seed: s.seed, activity: s.activity, goal, players };
}
