/**
 * A long, busy workload used to prove the rules give bit-for-bit the same answers everywhere
 * (copied from Mine Runner's). `determinismReport` makes many rounds of land and plays long fights
 * with odd, random-looking shots, writing down the state after every shot. The test pins the text
 * in Node, and scripts/archery-determinism.mjs runs it in real Chromium and WebKit and compares.
 */
import { ARROWS } from './arrows';
import { COLS, ROWS } from './config';
import { playFight } from './fight';
import { makeRoundLand } from './land';
import type { Archer, FightSetup, Land, Shot } from './types';

/** A small repeatable stream of numbers (integers only, so it is exact everywhere). */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s;
  };
}

/** FNV-1a over the land's cells. */
function landKey(land: Land): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < COLS * ROWS; i++) {
    h ^= land.cells[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const archerKey = (a: Archer) => `${a.x},${a.y},${a.health},${a.shield},${a.popped ? 1 : 0}`;

export function determinismReport(): string {
  const lines: string[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const r = makeRoundLand(seed * 7919);
    lines.push(`land/${seed}: ${landKey(r.land)} ${r.tries} ${archerKey(r.archers[0])} ${archerKey(r.archers[1])}`);
  }
  // Every arrow in the table that can be used in a fight, so their numbers are covered too.
  const kinds = ARROWS.filter((a) => a.forSale || a.unlimited).map((a) => a.id);
  for (const seed of [3, 4242, 987654321]) {
    const next = lcg(seed);
    const quiver = Object.fromEntries(kinds.map((k) => [k, 999]));
    const setup: FightSetup = { players: [{ quiver, shield: 20 }, { quiver, shield: 0 }] };
    const shots: Shot[] = [];
    for (let i = 0; i < 400; i++) {
      const left = i % 2 === 0;
      // Mostly lobs towards the other side, with some wild ones.
      const angle = next() % 5 === 0 ? next() % 181 : left ? 30 + (next() % 50) : 100 + (next() % 50);
      shots.push({ angle, power: 35 + (next() % 66), arrow: kinds[next() % kinds.length] });
    }
    // Play until the fight ends, then cut the list there so it's always a valid fight.
    const full = playFight(seed, setup, shots);
    const res = full.status === 'invalid' ? playFight(seed, setup, shots.slice(0, full.shots.length)) : full;
    res.shots.forEach((s, i) => {
      lines.push(`fight/${seed}/${i}: r${s.round} p${s.player} ${s.shot.angle},${s.shot.power},${s.shot.arrow} w${s.wind} ${s.hit.kind} ${s.hit.x},${s.hit.y},${s.hit.steps} d${s.damage.join(',')} f${s.fell.join(',')} ${archerKey(s.after[0])} ${archerKey(s.after[1])}`);
    });
    lines.push(`fight/${seed}/end: ${res.status} ${res.winner} ${res.roundWins.join(',')} ${landKey(res.current.land)} ${JSON.stringify(res.used)}`);
  }
  return lines.join('\n');
}

/** A short fingerprint of the report (FNV-1a), for the test and for quick comparison. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
