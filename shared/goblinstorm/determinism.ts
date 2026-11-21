/**
 * A long, busy workload that proves the Goblin Storm engine gives bit-for-bit the same answers everywhere
 * (docs/GOBLINSTORM-PLAN.md, "Replay"). `determinismReport` plays every hero on every map with random-looking steering
 * and picks, and writes down the whole state every 300 steps. `scripts/goblinstorm-determinism.mjs` runs it in Node,
 * real WebKit and Chromium and compares. Copied from shared/marble/determinism.ts.
 */
import { HEROES, MAPS } from './config';
import { applyPick, makeOffer, newRun, stepRun, waiting, type RunState } from './engine';
import { STILL } from './trig';

/** A small repeatable stream of numbers (integers only, so it is exact everywhere). */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s;
  };
}

/** Everything that matters about a moment of a run, with numbers written in full. */
export function stateKey(s: RunState): string {
  const h = s.hero;
  let ex = 0;
  let ey = 0;
  let ehp = 0;
  let alive = 0;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    alive++;
    ex += e.x * (alive % 7 + 1);
    ey += e.y * (alive % 5 + 1);
    ehp += e.hp;
  }
  let gx = 0;
  let gems = 0;
  for (const g of s.gems) if (g.alive) { gems++; gx += g.x + g.y * 3 + g.value; }
  let sx = 0;
  let shots = 0;
  for (const sh of s.shots) if (sh.alive) { shots++; sx += sh.x + sh.y * 3; }
  const weapons = s.weapons.map((w) => `${w.id}${w.level}${w.evolved ? '*' : ''}:${w.cooldown}:${w.angle}`).join('|');
  const passives = s.passives.map((p) => `${p.id}${p.level}`).join('|');
  return [s.t, h.x, h.y, h.hp, h.facing, s.level, s.gemBar, s.kills, alive, ex, ey, ehp, gems, gx, shots, sx, weapons, passives, s.outcome].join(' ');
}

export function determinismReport(): string {
  const lines: string[] = [];
  for (const map of MAPS) {
    for (const hero of HEROES) {
      const seed = 1000 + MAPS.indexOf(map) * 17 + HEROES.indexOf(hero) * 131;
      const next = lcg(seed);
      const s = newRun({ seed, hero, map, shop: { might: seed % 6, armour: (seed >> 2) % 6, magnet: seed % 4, fifth: seed % 2, secondwind: (seed >> 1) % 2, stormmight: seed % 4, surge: (seed >> 3) % 4, anchor: seed % 3 } });
      let dir: number = STILL;
      let steps = 0;
      while (s.outcome === 'running' && steps < 10800) {
        if (waiting(s)) {
          const offer = makeOffer(s, 2 + (next() % 3));
          applyPick(s, next() % offer.length);
          continue;
        }
        if (steps % 30 === 0) dir = next() % 17;
        stepRun(s, dir);
        steps++;
        if (steps % 300 === 0) lines.push(`${map.id}/${hero.id}/${steps}: ${stateKey(s)}`);
      }
      lines.push(`${map.id}/${hero.id}/end: ${stateKey(s)}`);
    }
  }
  return lines.join('\n');
}

/** A short fingerprint of the report (FNV-1a), for quick comparison. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
