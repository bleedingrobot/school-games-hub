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

export const sunExtent = (kind: SunKind | undefined): number => (kind ? SUN_SIZE[kind].extent : 5);

/** The first orbit's radius. */
export const orbitBase = (kind: SunKind | undefined): number => Math.max(16, sunExtent(kind) * 1.6 + 9);

/** Orbit radius of a slot (0 = nearest). Gaps widen a little further out, like a real system. */
export function orbitRadius(slot: number, sun: SunKind | undefined): number {
  return orbitBase(sun) + slot * 20 + slot * slot * 1.0;
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

const SIZE_RADIUS = [0.75, 1, 1.35, 1.75];
const KIND_SCALE: Partial<Record<PlanetKind, number>> = { gas: 2.1, icegiant: 1.7 };

export const planetRadius = (kind: PlanetKind, size: number): number => (SIZE_RADIUS[size] ?? 1) * (KIND_SCALE[kind] ?? 1);

/** A starting angle on the orbit, spread by the golden angle so planets don't line up. */
export const startAngle = (id: number): number => (id * 2.39996 + 0.7) % (Math.PI * 2);

/** The asteroid belt's middle radius: between the planets either side of `beltAfter`. */
export function beltRadius(d: Pick<SystemDesign, 'beltAfter' | 'sun'>): number {
  const sun = d.sun?.kind;
  if (d.beltAfter <= 0) return (sunExtent(sun) + orbitRadius(0, sun)) / 2 + 2;
  return (orbitRadius(d.beltAfter - 1, sun) + orbitRadius(d.beltAfter, sun)) / 2;
}

/** Half the belt's width: a share of the gap it sits in, so it keeps clear of the planets either side. */
export function beltWidth(d: Pick<SystemDesign, 'beltAfter' | 'sun'>): number {
  const sun = d.sun?.kind;
  const gap = d.beltAfter <= 0 ? orbitRadius(0, sun) - sunExtent(sun) : orbitRadius(d.beltAfter, sun) - orbitRadius(d.beltAfter - 1, sun);
  return Math.max(2.5, gap * 0.16);
}

/** The Goldilocks zone as [inner, outer] radii on the orbit plane, or null when the sun has none. */
export function zoneBand(sun: SunKind | undefined): [number, number] | null {
  const z = sun ? SUNS[sun].zone : null;
  if (!z) return null;
  const inner = z[0] === 0 ? (sunExtent(sun) + orbitRadius(0, sun)) / 2 : (orbitRadius(z[0] - 1, sun) + orbitRadius(z[0], sun)) / 2;
  const outer = (orbitRadius(z[1], sun) + orbitRadius(z[1] + 1, sun)) / 2;
  return [inner, outer];
}

/** How far out the system reaches (for the wide shot and zoom limit). */
export function systemRadius(d: Pick<SystemDesign, 'planets' | 'sun' | 'belt' | 'beltAfter'>): number {
  const sun = d.sun?.kind;
  let r = orbitRadius(Math.max(1, d.planets.length - 1), sun) + 12;
  if (d.belt) r = Math.max(r, beltRadius(d) + 10);
  return r;
}
