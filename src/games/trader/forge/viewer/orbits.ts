/**
 * Where things are in the viewer: sun sizes, orbit radii by slot, a simplified Kepler rule for speeds, planet sizes.
 * Pure numbers, no three.js, so they can be tested. One unit is roughly "an Earth-sized planet's radius".
 */
import type { PlanetKind, SunKind, SystemDesign } from '../../../../../shared/trader/system';
import { SUNS } from '../../../../../shared/trader/system';

/** Radius of the glowing ball, and how far its look reaches (corona, disc, partner star) for spacing the orbits. */
export const SUN_SIZE: Record<SunKind, { radius: number; extent: number }> = {
  yellow: { radius: 4, extent: 6 },
  red: { radius: 2.8, extent: 4.5 },
  blue: { radius: 7, extent: 10 },
  white: { radius: 0.9, extent: 9 },
  pulsar: { radius: 0.8, extent: 5 },
  binary: { radius: 2.6, extent: 8 },
  blackhole: { radius: 2.2, extent: 11 },
  baby: { radius: 3.4, extent: 7 },
};

/** Suns are drawn this much bigger than SUN_SIZE says (the sun's own pieces are made at SUN_SIZE and scaled up). */
export const SUN_SCALE = 2.6;

export const sunExtent = (kind: SunKind | undefined): number => (kind ? SUN_SIZE[kind].extent : 5) * SUN_SCALE;

/** The first orbit's radius when there are no planets yet: the reference for orbit speeds. */
export const orbitBase = (kind: SunKind | undefined): number => sunExtent(kind) * 1.15 + 8;

/** Planets the layout needs: their kind, size, ring and moon count. */
type LayoutDesign = Pick<SystemDesign, 'planets' | 'sun' | 'beltAfter' | 'belt'>;

/** Clear space between one planet's reach and the next. */
const GAP = 2;
/** Half the asteroid belt's width. */
const BELT_HALF = 4;
/** A planet's reach when there is no planet in that slot (for the zone past the last planet). */
const EMPTY_REACH = 4.2;

/** Moon sizes and distances, scaled with the planet so they read at every planet size. */
export const moonSize = (R: number, look: number, yours = false): number => R * (0.13 + 0.035 * (look % 3) + (yours ? 0.02 : 0));
export const moonDist = (R: number, i: number, ringOuter: number): number => (ringOuter ? ringOuter + R * 0.35 : R * 1.75) + i * R * 0.42;
export const ringOuterOf = (R: number, kind: string | undefined): number => (kind ? R * (kind === 'double' ? 2.6 : 2.3) : 0);

/** How far a planet's pieces reach from its middle, for spacing orbits. Moons count for less: they are small and rarely pass a neighbour. */
export function planetReach(p: SystemDesign['planets'][number]): number {
  if (p.kind === 'ringworld') return 9;
  const R = planetRadius(p.kind, p.size);
  const ro = ringOuterOf(R, p.ring?.kind);
  const n = p.moons.length;
  const mo = n ? moonDist(R, n - 1, ro) + moonSize(R, 2) : 0;
  return Math.max(R * 1.1, ro, mo * 0.62);
}

const layoutCache = new WeakMap<object, { radii: number[]; reach: number[]; belt: [number, number] | null }>();

/** Orbit radii for every planet, spaced by what each one carries (rings, moons) and leaving room for the belt. */
export function layout(d: LayoutDesign): { radii: number[]; reach: number[]; belt: [number, number] | null } {
  const hit = layoutCache.get(d);
  if (hit) return hit;
  const sun = d.sun?.kind;
  const reach = d.planets.map(planetReach);
  const radii: number[] = [];
  let belt: [number, number] | null = null;
  let edge = sunExtent(sun) * 1.15 + 4; // the inner edge of free space
  for (let i = 0; i <= reach.length; i++) {
    if (d.belt && d.beltAfter === i) {
      belt = [edge + BELT_HALF + GAP, BELT_HALF];
      edge += BELT_HALF * 2 + GAP * 2;
    }
    if (i === reach.length) break;
    radii.push(edge + reach[i]);
    edge += reach[i] * 2 + GAP;
  }
  const out = { radii, reach, belt };
  layoutCache.set(d, out);
  return out;
}

/** Orbit radius of a slot (0 = nearest); slots past the last planet carry on as if a middling planet were there. */
export function orbitRadius(slot: number, d: LayoutDesign): number {
  const { radii, reach } = layout(d);
  if (slot < radii.length) return radii[slot];
  const n = radii.length;
  const last = n ? radii[n - 1] + reach[n - 1] + GAP : sunExtent(d.sun?.kind) * 1.15 + 4;
  return last + EMPTY_REACH + (slot - n) * (EMPTY_REACH * 2 + GAP);
}

/** Seconds for one trip round at speed 1, for the first orbit. */
const BASE_PERIOD = 22;

/**
 * Angular speed (radians a second at speed 1) at this radius, by Kepler's third law (period² ∝ radius³), so inner
 * planets zip round and outer ones crawl.
 */
export function orbitSpeed(radius: number, sun: SunKind | undefined): number {
  const r0 = orbitBase(sun);
  return ((2 * Math.PI) / BASE_PERIOD) * Math.pow(radius / r0, -1.5);
}

/** Planet radii by size (Small to Huge): big enough to read as balls from the whole-system view. */
const SIZE_RADIUS = [5.6, 6.3, 7.1, 8];
const KIND_SCALE: Partial<Record<PlanetKind, number>> = { gas: 1.1, icegiant: 1.05 };

export const planetRadius = (kind: PlanetKind, size: number): number => (SIZE_RADIUS[size] ?? 1) * (KIND_SCALE[kind] ?? 1);

/** A starting angle on the orbit, spread by the golden angle so planets don't line up. */
export const startAngle = (id: number): number => (id * 2.39996 + 0.7) % (Math.PI * 2);

/** The asteroid belt's middle radius. */
export function beltRadius(d: LayoutDesign): number {
  const b = layout(d).belt;
  if (b) return b[0];
  // no belt in the design: where it would go
  const before = d.beltAfter <= 0 ? sunExtent(d.sun?.kind) * 1.15 + 4 : orbitRadius(d.beltAfter - 1, d) + (layout(d).reach[d.beltAfter - 1] ?? EMPTY_REACH);
  return before + GAP + BELT_HALF;
}

/** Half the belt's width. */
export const beltWidth = (_d?: LayoutDesign): number => BELT_HALF;

/** The Goldilocks zone as [inner, outer] radii on the orbit plane, or null when the sun has none. */
export function zoneBand(d: LayoutDesign): [number, number] | null {
  const sun = d.sun?.kind;
  const z = sun ? SUNS[sun].zone : null;
  if (!z) return null;
  const mid = (i: number) => (i <= 0 ? (sunExtent(sun) * 1.15 + orbitRadius(0, d)) / 2 : (orbitRadius(i - 1, d) + orbitRadius(i, d)) / 2);
  return [mid(z[0]), mid(z[1] + 1)];
}

/** How far out the system reaches (for the wide shot and zoom limit). */
export function systemRadius(d: LayoutDesign): number {
  const { radii, reach, belt } = layout(d);
  let r = sunExtent(d.sun?.kind) * 1.3 + 10;
  d.planets.forEach((p, i) => {
    const R = planetRadius(p.kind, p.size);
    const ro = ringOuterOf(R, p.ring?.kind);
    const mo = p.moons.length ? moonDist(R, p.moons.length - 1, ro) + R * 0.2 : 0;
    r = Math.max(r, radii[i] + Math.max(reach[i], mo) + 3);
  });
  if (belt) r = Math.max(r, belt[0] + belt[1] + 3);
  return r;
}
