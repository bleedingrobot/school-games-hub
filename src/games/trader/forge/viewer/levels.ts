/**
 * The three graphics levels (docs/TRADER-SYSTEM-PLAN.md, section 5.3) and the rule 'auto' uses to pick one from frame
 * times. Pure, so it can be tested.
 */
import type { GraphicsLevel } from './types';

export interface LevelSettings {
  level: GraphicsLevel;
  /** The canvas pixel ratio. */
  pixelRatio: number;
  /** Width of a planet's drawn surface map (height is half). */
  texSize: number;
  /** Width of the drawn sky panorama. */
  skySize: number;
  /** Bloom and film finish: full, half size and lighter, or none (no composer at all). */
  post: 'full' | 'half' | 'none';
  /** Multisampling in the composer's buffer. */
  msaa: number;
  ringShadows: boolean;
  cloudShadows: boolean;
  asteroids: number;
  stars: number;
  /** Sphere detail (width segments; height is half). */
  segments: number;
  /** Frames a second at most (0: as fast as the screen). */
  fpsCap: number;
  /** Noise octaves when drawing maps. */
  octaves: number;
  /** Particles per effect, as a share of the full number. */
  particles: number;
  anisotropy: number;
}

export const LEVELS: GraphicsLevel[] = ['incredible', 'normal', 'simple'];

export function levelSettings(level: GraphicsLevel, dpr: number): LevelSettings {
  if (level === 'incredible') {
    return { level, pixelRatio: Math.min(dpr, 2), texSize: 2048, skySize: 4096, post: 'full', msaa: dpr >= 1.75 ? 0 : 4, ringShadows: true, cloudShadows: true, asteroids: 20000, stars: 7000, segments: 128, fpsCap: 0, octaves: 8, particles: 1, anisotropy: 8 };
  }
  if (level === 'normal') {
    return { level, pixelRatio: Math.min(dpr, 1.5), texSize: 1024, skySize: 2048, post: 'half', msaa: 0, ringShadows: true, cloudShadows: false, asteroids: 3000, stars: 3000, segments: 64, fpsCap: 30, octaves: 6, particles: 0.5, anisotropy: 4 };
  }
  return { level, pixelRatio: 1, texSize: 512, skySize: 1024, post: 'none', msaa: 0, ringShadows: false, cloudShadows: false, asteroids: 500, stars: 1200, segments: 40, fpsCap: 30, octaves: 5, particles: 0.25, anisotropy: 1 };
}

export const lowerLevel = (level: GraphicsLevel): GraphicsLevel => (level === 'incredible' ? 'normal' : 'simple');

/** The longest a frame may take (ms, median) for a level to be kept. */
const BUDGET: Record<GraphicsLevel, number> = { incredible: 24, normal: 45, simple: Infinity };

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Given the gaps between frames (ms) drawn at `level`, the level to use: the same, or lower when it's too slow. Far too
 * slow (over twice the budget) on Incredible drops straight to Simple.
 */
export function judgeFrames(level: GraphicsLevel, gaps: number[]): GraphicsLevel {
  if (gaps.length < 10) return level;
  const m = median(gaps);
  if (m <= BUDGET[level]) return level;
  if (level === 'incredible' && m > BUDGET.incredible * 2.5 && m > BUDGET.normal) return 'simple';
  return lowerLevel(level);
}

/** Where 'auto' starts before it has timed anything: lower on small or obviously modest devices. */
export function startLevel(nav: { hardwareConcurrency?: number; userAgent?: string } | undefined, dpr: number): GraphicsLevel {
  const ua = nav?.userAgent ?? '';
  const cores = nav?.hardwareConcurrency ?? 4;
  if (/CrOS|Android|iPhone|iPad/.test(ua) || cores <= 4) return 'normal';
  return dpr > 2.5 && cores < 8 ? 'normal' : 'incredible';
}
