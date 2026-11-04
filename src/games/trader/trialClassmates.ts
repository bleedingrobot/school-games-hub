/** Pretend classmates with built systems, for the preview's gallery and the screen tests (never in the real game). */
import { newPlanet, type PlanetKind, type PlanetPick, type SunKind, type SystemDesign } from '../../../shared/trader/system';

const planet = (id: number, kind: PlanetKind, more: Partial<PlanetPick> = {}): PlanetPick => ({ ...newPlanet(id, kind), built: true, ...more });

const system = (name: [number, number], sun: SunKind, planets: PlanetPick[], more: Partial<SystemDesign> = {}): SystemDesign => ({
  v: 1, name, sun: { kind: sun, name, built: true }, planets, belt: null, beltAfter: 2, comets: null, background: name[0] % 8, tech: [], ...more,
});

export interface PretendClassmate {
  id: string;
  name: string;
  design: SystemDesign;
}

export const PRETEND_CLASSMATES: PretendClassmate[] = [
  { id: 'classmate-aroha', name: 'Aroha T', design: system([1, 2], 'yellow', [
    planet(1, 'rocky'), planet(4, 'desert'), planet(2, 'ocean', { size: 2, clouds: 'thick', life: { kind: 'sea', creature: 1, built: true }, ring: { kind: 'icy', tilt: 1, built: true } }),
    planet(3, 'gas', { size: 3, moons: [{ id: 1, look: 2, built: true }] }),
  ], { label: 'Zephyr' }) },
  { id: 'classmate-ben', name: 'Ben K', design: system([4, 1], 'blackhole', [
    planet(1, 'lava', { effects: [{ kind: 'volcano', built: true }] }), planet(2, 'crystal', { size: 2 }),
  ], { belt: { kind: 'golden', built: true }, beltAfter: 1 }) },
  { id: 'classmate-mere', name: 'Mere W', design: system([7, 4], 'baby', [
    planet(1, 'ice', { ring: { kind: 'rainbow', tilt: 2, built: true } }), planet(2, 'icegiant', { size: 3 }), planet(3, 'jungle', { life: { kind: 'animals', creature: 0, built: true } }),
  ], { comets: { count: 2, built: true } }) },
  { id: 'classmate-sam', name: 'Sam P', design: system([2, 6], 'red', [planet(1, 'desert'), planet(2, 'donut', { size: 1 })]) },
  { id: 'classmate-lily', name: 'Lily C', design: system([9, 3], 'binary', [
    planet(1, 'toxic'), planet(2, 'ocean', { tech: [{ kind: 'satellites', built: true }] }), planet(3, 'gas', { size: 3, ring: { kind: 'dusty', tilt: 0, built: true } }), planet(4, 'cube'),
  ], { label: 'Sparkle Town' }) },
  // A sun only, so far: no picture yet in the preview.
  { id: 'classmate-noah', name: 'Noah R', design: system([5, 5], 'white', []) },
];
