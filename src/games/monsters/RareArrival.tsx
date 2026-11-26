/**
 * The big fuss when a rare, ultra rare or shiny wild monster jumps out (James, 26 Nov 2026):
 * a flash, light rays and a sparkle burst behind the monster, a banner ("RARE!", "ULTRA RARE!",
 * "SHINY!") and a shake, with a sound sting. Higher tiers and shinies get more of everything.
 * It is decoration only: it never blocks a tap and is over in about two seconds.
 */
import type { CSSProperties } from 'react';
import { speciesOf } from '../../../shared/monsters/monsterBook';
import type { Monster } from '../../../shared/monsters/rules';
import type { GameSound } from '../sounds';

export interface Arrival {
  /** The colour set: rare is purple, ultra gold, shiny a rainbow (and shiny + rare or ultra is a gold rainbow). */
  tone: 'rare' | 'ultra' | 'shiny' | 'shiny-max';
  /** How big a fuss: 1 rare, 2 ultra or shiny, 3 shiny and rare or ultra. */
  level: 1 | 2 | 3;
  banner: string;
  sub?: string;
  stars: string;
  sound: GameSound;
  /** How long it all lasts, in ms. */
  ms: number;
}

/** The fuss for a monster, or null for a plain common or uncommon one. */
export function arrivalOf(monster: Pick<Monster, 'species' | 'shiny'>): Arrival | null {
  const { rarity } = speciesOf(monster.species);
  const special = rarity === 'rare' || rarity === 'ultra';
  const stars = rarity === 'ultra' ? '★★★' : rarity === 'rare' ? '★★' : '';
  if (monster.shiny && special) {
    return { tone: 'shiny-max', level: 3, banner: 'SHINY!', sub: rarity === 'ultra' ? 'and ULTRA RARE!' : 'and RARE!', stars: `✦${stars}✦`, sound: 'shiny-max', ms: 2600 };
  }
  if (monster.shiny) return { tone: 'shiny', level: 2, banner: 'SHINY!', stars: '✦ ✦ ✦', sound: 'shiny', ms: 2200 };
  if (rarity === 'ultra') return { tone: 'ultra', level: 2, banner: 'ULTRA RARE!', stars, sound: 'ultra', ms: 2200 };
  if (rarity === 'rare') return { tone: 'rare', level: 1, banner: 'RARE!', stars, sound: 'rare', ms: 1800 };
  return null;
}

const SPARKS = { 1: 12, 2: 18, 3: 26 } as const;

/** The rays and sparkle burst, drawn behind the wild monster. */
export function ArrivalBurst({ arrival }: { arrival: Arrival }) {
  const n = SPARKS[arrival.level];
  return (
    <div className={`rr-burst rr--${arrival.tone} rr--l${arrival.level}`} aria-hidden="true">
      <span className="rr-rays" />
      {arrival.level >= 2 && <span className="rr-rays rr-rays--back" />}
      <span className="rr-ring" />
      {arrival.level === 3 && <span className="rr-ring rr-ring--late" />}
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={`rr-spark${i % 3 === 0 ? ' rr-spark--star' : ''}`}
          style={{ '--a': `${(i * 360) / n + (i % 2) * 9}deg`, '--d': `${70 + ((i * 37) % 45)}%`, '--t': `${(i % 4) * 0.06}s`, '--h': `${(i * 47) % 360}` } as CSSProperties}
        />
      ))}
    </div>
  );
}

/** The flash over the whole arena and the banner across it. */
export function ArrivalBanner({ arrival }: { arrival: Arrival }) {
  return (
    <div className={`rr-front rr--${arrival.tone} rr--l${arrival.level}`} aria-hidden="true">
      <span className="rr-flash" />
      <div className="rr-banner">
        <span className="rr-banner__stars">{arrival.stars}</span>
        <span className="rr-banner__word">{arrival.banner}</span>
        {arrival.sub && <span className="rr-banner__sub">{arrival.sub}</span>}
      </div>
    </div>
  );
}
