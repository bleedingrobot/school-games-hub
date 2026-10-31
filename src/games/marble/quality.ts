/** Three drawing quality levels. The game picks one for the device and drops a level if it runs slowly. */
export type Quality = 'simple' | 'normal' | 'best';

export interface QualitySettings {
  pixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Most particles alive at once. */
  particles: number;
  trail: boolean;
}

/** Settings for each level. The pixel ratio is capped by the screen's own in `settingsFor`. */
export const QUALITY: Record<Quality, QualitySettings> = {
  simple: { pixelRatio: 1, antialias: false, shadows: false, shadowMapSize: 0, particles: 40, trail: false },
  normal: { pixelRatio: 1.5, antialias: true, shadows: true, shadowMapSize: 1024, particles: 150, trail: true },
  best: { pixelRatio: 2, antialias: true, shadows: true, shadowMapSize: 2048, particles: 300, trail: true },
};

/** The settings for a level on a screen with this device pixel ratio. */
export function settingsFor(q: Quality, dpr: number): QualitySettings {
  const s = QUALITY[q];
  return { ...s, pixelRatio: Math.max(1, Math.min(s.pixelRatio, dpr || 1)) };
}

/** Where to start: Chromebooks and ordinary screens begin on Normal; sharp screens (iPad, iMac) on Best. */
export function startQuality(userAgent: string, dpr: number): Quality {
  if (/CrOS/.test(userAgent) || dpr < 2) return 'normal';
  return 'best';
}

/** One level lighter (Simple stays Simple). */
export function lowerQuality(q: Quality): Quality {
  return q === 'best' ? 'normal' : 'simple';
}
