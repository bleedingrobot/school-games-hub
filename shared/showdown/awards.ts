/**
 * The recap (docs/SHOWDOWN-PLAN.md section 1 step 7 and section 5): who won, and 6 to 8 shout-outs, one each to
 * different pupils before anyone gets a second. Only good things are shouted out; nothing here ranks pupils by maths.
 */
import { SHOWDOWN } from './config';
import { ranks } from './engine';
import type { Player, Round, TeamId } from './types';

export type AwardKind =
  | 'top_score'
  | 'last_hit'
  | 'longest_streak'
  | 'most_damage'
  | 'best_comeback'
  | 'shield_wall'
  | 'best_healer'
  | 'golden_moment'
  | 'most_careful'
  | 'hard_worker';

export interface Award {
  kind: AwardKind;
  pupil: string;
  /** The number behind it (points, streak, places climbed...), for the card. */
  value: number;
}

type Ranker = { kind: AwardKind; value: (p: Player, r: Round) => number | null };

/** In the order they're handed out. Each gives a value (bigger is better) or null when a pupil can't get it. */
const RANKERS: Ranker[] = [
  { kind: 'top_score', value: (p) => (p.score > 0 ? p.score : null) },
  { kind: 'last_hit', value: (p, r) => (r.lastHit === p.id ? 1 : null) },
  { kind: 'longest_streak', value: (p) => (p.bestStreak >= 3 ? p.bestStreak : null) },
  { kind: 'most_damage', value: (p, r) => (r.mode !== 'solo' && p.damage > 0 ? p.damage : null) },
  {
    kind: 'best_comeback',
    value: (p, r) => {
      const climbed = (p.worstRank ?? 0) - (ranks(r)[p.id] ?? 0);
      return p.worstRank !== null && climbed >= SHOWDOWN.awards.comebackMinPlaces ? climbed : null;
    },
  },
  { kind: 'shield_wall', value: (p) => (p.shields > 0 ? p.shields : null) },
  { kind: 'best_healer', value: (p) => (p.revives > 0 ? p.revives : null) },
  // Earliest right golden answer wins: a smaller time is better, so it's turned round.
  { kind: 'golden_moment', value: (p) => (p.goldenRightAt !== null ? 1e9 - p.goldenRightAt : null) },
  {
    kind: 'most_careful',
    value: (p) => {
      const n = p.correct + p.wrong;
      return n >= SHOWDOWN.awards.carefulMinAnswers ? p.correct / n + p.correct / 1e6 : null;
    },
  },
  { kind: 'hard_worker', value: (p) => (p.correct > 0 ? p.correct : null) },
];

/** Shout-outs for the recap: up to 8, to different pupils first; repeats only to reach 6 when the class is small. */
export function pickAwards(r: Round): Award[] {
  const players = r.order.map((k) => r.players[k]);
  const lists = RANKERS.map((rk) => ({
    kind: rk.kind,
    ranked: players
      .map((p, i) => ({ p, v: rk.value(p, r), i }))
      .filter((x): x is { p: Player; v: number; i: number } => x.v !== null)
      .sort((a, b) => b.v - a.v || a.i - b.i),
  }));
  const picked: (Award & { at: number })[] = [];
  const awarded = new Set<string>();
  lists.forEach(({ kind, ranked }, at) => {
    if (picked.length >= SHOWDOWN.awards.max) return;
    const best = ranked.find((x) => !awarded.has(x.p.id));
    if (!best) return;
    awarded.add(best.p.id);
    picked.push({ kind, pupil: best.p.id, value: round(best.v, kind), at });
  });
  // Too few different pupils for 6? Give the skipped awards to their best pupil anyway.
  for (const [at, { kind, ranked }] of lists.entries()) {
    if (picked.length >= SHOWDOWN.awards.min) break;
    if (picked.some((a) => a.kind === kind) || !ranked[0]) continue;
    picked.push({ kind, pupil: ranked[0].p.id, value: round(ranked[0].v, kind), at });
  }
  return picked.sort((a, b) => a.at - b.at).map(({ at: _at, ...a }) => a);
}

function round(v: number, kind: AwardKind): number {
  if (kind === 'golden_moment') return Math.round(1e9 - v);
  if (kind === 'most_careful') return Math.round(v * 100);
  return Math.round(v * 10) / 10;
}

export interface Recap {
  result: 'beaten' | 'time';
  /** The team that won (team modes) or the pupil (solo); null in whole-class mode. */
  winner: { team: TeamId } | { pupil: string } | null;
  /** Team modes: teams best first. 2 teams are decided by damage (the tug of war), 4 teams by points. */
  teams: { team: TeamId; points: number; damage: number }[];
  /** Solo: the top 10. */
  top: { pupil: string; score: number }[];
  awards: Award[];
}

export function recap(r: Round): Recap {
  const teams = r.teams
    .map((team) => ({ team, points: r.teamPoints[team] ?? 0, damage: Math.round(r.teamDamage[team] ?? 0) }))
    .sort((a, b) => (r.mode === 'teams2' && r.arena !== 'hill' && r.arena !== 'auction' ? b.damage - a.damage : 0) || b.points - a.points);
  const top = r.order
    .map((k) => r.players[k])
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((p) => ({ pupil: p.id, score: p.score }));
  let winner: Recap['winner'] = null;
  if (teams.length && (teams.length < 2 || teams[0].points !== teams[1].points || teams[0].damage !== teams[1].damage)) winner = { team: teams[0].team };
  if (r.mode === 'solo' && top[0] && top[0].score > 0) winner = { pupil: top[0].pupil };
  return { result: r.result ?? 'time', winner, teams, top, awards: pickAwards(r) };
}
