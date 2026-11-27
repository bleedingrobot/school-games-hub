/**
 * Class Live's rewards (docs/CLASSLIVE-PLAN.md, stage 4): hub points and the totals behind the trophies, worked out
 * once a session is over and paid once per room and session (`classlive_finish`). Pupils who only joined get 1 point.
 */
import { winningTeam } from './rocket';
import { podium } from './corners';
import { lavaPodium } from './lava';
import { podium as thronesPodium } from './thrones';
import { clashReward } from './clashServer';
import { podium as ghostPodium } from './ghost';
import { podium as crewPodium } from './crew';
import { relayPodium } from './relay';
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
  const goal = g.kind === 'stars' ? g.creature : g.kind === 'serpent' ? g.awake : g.kind === 'corners' || g.kind === 'ghost' || g.kind === 'crew' || g.kind === 'clash' || g.kind === 'thrones' || g.kind === 'lava' || g.kind === 'relay' || g.kind === 'jail' || g.kind === 'rocket' ? false : g.solvers.length > 0;
  const top = g.kind === 'corners' ? podium(g, s.order) : g.kind === 'ghost' ? ghostPodium(g, s.order) : g.kind === 'crew' ? crewPodium(g, s.order) : g.kind === 'thrones' ? thronesPodium(g, s.order) : g.kind === 'lava' ? lavaPodium(g, s.order) : g.kind === 'relay' ? relayPodium(g, s.order) : [];
  const players = s.order.map((id): PupilReward => {
    let did = false;
    const r: PupilReward = { player: id, points: 0, stars: 0, boxes: 0, head: false, tiles: 0, guessed: false, safe: 0, champion: false, escapes: 0, powers: 0 };
    let podiumPlace = false;
    if (g.kind === 'rocket') {
      // Rocket Relay (docs/ROCKET-PLAN.md): 3 for a right answer on a run; +2 if your team won; trophies count runs and wins.
      const m = g.mine[id];
      did = (m?.rightAll ?? 0) > 0;
      const won = winningTeam(g);
      podiumPlace = did && won !== null && g.teams[won].order.includes(id);
      r.extra = { rocket_runs: Math.max(0, Math.min(500, m?.runs ?? 0)), rocket_wins: podiumPlace ? 1 : 0 };
    } else if (g.kind === 'jail') {
      // Real-life Four Corners (docs/JAIL-PLAN.md): 3 for answering right at a jail station; the trophy counts comebacks.
      const m = g.mine[id];
      did = (m?.rightAll ?? 0) > 0;
      // Maths Mingle (docs/MINGLE-PLAN.md) shares the stations; its trophy counts its own comebacks.
      r.extra = { [g.mode === 'mingle' ? 'mingle_backs' : 'jail_backs']: Math.max(0, Math.min(500, m?.backs ?? 0)) };
    } else if (g.kind === 'relay') {
      // Toon Flap Relay (docs/RELAY-PLAN.md): +2 if your team won a race; trophies count races won, perks given, troubles sent.
      const m = g.mine[id];
      podiumPlace = (m?.wins ?? 0) > 0;
      did = (m?.right ?? 0) > 0 || (m?.flights ?? 0) > 0;
      const cap = (n: number | undefined) => Math.max(0, Math.min(500, Math.round(n ?? 0)));
      r.extra = { relay_wins: cap(m?.wins), relay_perks: cap(m?.perks), relay_troubles: cap(m?.troubles) };
    } else if (g.kind === 'lava') {
      // Floor is Lava (docs/LAVA-PLAN.md): rounds stayed up, top of the podium, tiles rebuilt, friends rescued.
      const m = g.mine[id];
      const place = top.find((x) => x.player === id)?.place;
      r.champion = place === 1;
      podiumPlace = place !== undefined;
      r.escapes = m?.climbs ?? 0;
      r.powers = m?.powersUsed ?? 0;
      r.extra = { lava_rounds: m?.up ?? 0, lava_wins: place === 1 ? 1 : 0, lava_built: m?.built ?? 0, lava_rescues: m?.rescues ?? 0 };
      did = (m?.up ?? 0) > 0 || (m?.answered ?? 0) > 0;
    } else if (g.kind === 'clash') {
      // Colour Clash: the winning team's pupils get the podium bonus.
      const c = clashReward(g, id);
      did = c.did;
      podiumPlace = c.won && c.did;
      r.extra = c.extra;
    } else if (g.kind === 'corners') {
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
    } else if (g.kind === 'thrones') {
      // Musical Thrones: its trophies count `extra` (classlive_thrones_sat, _crowns, _steals, _wins).
      const m = g.mine[id];
      const place = top.find((x) => x.player === id)?.place;
      podiumPlace = place !== undefined;
      r.extra = { thrones_sat: m?.sat ?? 0, thrones_crowns: m?.crowns ?? 0, thrones_steals: m?.steals ?? 0, thrones_wins: place === 1 ? 1 : 0 };
      did = (m?.sat ?? 0) > 0 || (m?.answered ?? 0) > 0;
    } else if (g.kind === 'crew') {
      // Glitches (docs/CREW-PLAN.md): 3 for a right answer or (Glitches do no maths) a jam; +2 for winning a round.
      const m = g.mine[id];
      did = (m?.right ?? 0) > 0 || (m?.jams ?? 0) > 0;
      podiumPlace = did && (m?.wins ?? 0) > 0;
      const cap = (n: number | undefined) => Math.max(0, Math.min(500, Math.round(n ?? 0)));
      r.extra = { crew_mends: cap(m?.mends), crew_detects: cap(m?.detects), crew_glitchwins: cap(m?.glitchWins) };
    } else if (g.kind === 'ghost') {
      // Ghost Tag (docs/GHOST-PLAN.md): podium place +2, like Four Corners; its trophies count catches, wins, vanishes.
      const m = g.mine[id];
      const place = top.find((x) => x.player === id)?.place;
      podiumPlace = place !== undefined;
      did = (m?.right ?? 0) > 0 || (m?.crowns ?? 0) > 0 || (m?.tags ?? 0) > 0;
      const cap = (n: number | undefined) => Math.max(0, Math.min(500, Math.round(n ?? 0)));
      r.extra = { ghost_tags: cap(m?.tags), ghost_crowns: cap(m?.crowns), ghost_vanishes: cap(m?.vanishes) };
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
