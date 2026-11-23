/**
 * Class Live's rewards (docs/CLASSLIVE-PLAN.md, stage 4): hub points and the totals behind the trophies, worked out
 * once a session is over and paid once per room and session (`classlive_finish`). Pupils who only joined get 1 point.
 */
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
}

export interface FinishedSession {
  seed: number;
  activity: Session['activity'];
  /** The class reached the goal (the sky creature, the serpent awake, or the picture guessed). */
  goal: boolean;
  players: PupilReward[];
}

/** Points: 1 for taking part, 3 for doing some of the maths, +2 for the class goal, +2 for guessing the picture. At most 10. */
export const POINTS = { joined: 1, played: 3, goal: 2, guessed: 2, max: 10 } as const;

export function rewardsOf(s: Session): FinishedSession {
  const g = s.game;
  const goal = g.kind === 'stars' ? g.creature : g.kind === 'serpent' ? g.awake : g.solvers.length > 0;
  const players = s.order.map((id): PupilReward => {
    let did = false;
    const r: PupilReward = { player: id, points: 0, stars: 0, boxes: 0, head: false, tiles: 0, guessed: false };
    if (g.kind === 'stars') {
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
    const points = (did ? POINTS.played : POINTS.joined) + (goal && did ? POINTS.goal : 0) + (r.guessed ? POINTS.guessed : 0);
    r.points = Math.min(POINTS.max, points);
    return r;
  });
  return { seed: s.seed, activity: s.activity, goal, players };
}
