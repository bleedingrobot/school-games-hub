/**
 * Mixed teams (docs/SHOWDOWN-PLAN.md section 5): balanced by ladder place and by number of players. Ladder places are
 * only used here to mix teams and are never shown.
 */
import { hashSeed } from './schedule';
import type { Round, TeamId } from './types';

/**
 * Deal pupils into teams like picking sides in turn ("snake": 1 2 2 1, 1 2 3 4 4 3 2 1), strongest ladder place first,
 * so each team gets the same spread. Pupils on the same place are ordered by the seed, so Reshuffle gives new teams.
 */
export function balanceTeams(pupils: { id: string; ladder: number }[], teams: readonly TeamId[], seed: number): Record<string, TeamId> {
  const sorted = [...pupils].sort((a, b) => b.ladder - a.ladder || hashSeed(seed, a.id) - hashSeed(seed, b.id));
  const out: Record<string, TeamId> = {};
  sorted.forEach((p, i) => {
    const lap = Math.floor(i / teams.length);
    const pos = i % teams.length;
    out[p.id] = teams[lap % 2 === 0 ? pos : teams.length - 1 - pos];
  });
  return out;
}

/** A late joiner goes to the smallest team; on a tie, the team with the lowest ladder places in total. */
export function teamForLateJoiner(r: Round): TeamId {
  const size = (k: TeamId) => r.order.filter((id) => r.players[id].team === k).length;
  const ladder = (k: TeamId) => r.order.filter((id) => r.players[id].team === k).reduce((s, id) => s + r.players[id].ladder, 0);
  return [...r.teams].sort((a, b) => size(a) - size(b) || ladder(a) - ladder(b))[0];
}

/** Teacher's Reshuffle (before Start): new balanced teams from a new seed. Also used as pupils join the lobby. */
export function reshuffle(r: Round, seed: number): boolean {
  if (r.state !== 'lobby' || !r.teams.length) return false;
  const teams = balanceTeams(r.order.map((id) => r.players[id]), r.teams, seed);
  for (const id of r.order) r.players[id].team = teams[id];
  return true;
}
