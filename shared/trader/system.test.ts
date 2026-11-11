import { describe, expect, it } from 'vitest';
import { buildAll, designProblem, emptyDesign, forgeCost, newPlanet, planetPrice, SUNS, type SystemDesign } from './system';

const withSun = (built: boolean): SystemDesign => ({ ...emptyDesign(), sun: { kind: 'yellow', name: [0, 0], built } });

describe('the Star Forge', () => {
  it('charges built pieces once, a repaint for new looks, half back for taking down, and nothing for plans', () => {
    const plan: SystemDesign = { ...withSun(false), planets: [{ ...newPlanet(1, 'ocean'), ring: { kind: 'icy', tilt: 1 } }] };
    expect(forgeCost(emptyDesign(), plan).total).toBe(0);
    const sun = { ...plan, sun: { ...plan.sun!, built: true } };
    expect(forgeCost(plan, sun).total).toBe(SUNS.yellow.price);
    const all = buildAll(sun);
    expect(forgeCost(sun, all).total).toBe(planetPrice(all.planets[0]) + 1000);
    // Moving it to another slot changes nothing; a new tint is a repaint; a new type is take-down plus build.
    const moved = { ...all, planets: [newPlanet(9), ...all.planets] };
    expect(forgeCost(all, moved).total).toBe(0);
    const tinted = { ...all, planets: [{ ...all.planets[0], tint: 3 }] };
    expect(forgeCost(all, tinted).lines.map((l) => l.kind)).toEqual(['repaint']);
    const gone = { ...all, planets: [] };
    expect(forgeCost(all, gone).total).toBe(-Math.floor((planetPrice(all.planets[0]) + 1000) / 2));
  });

  it('refuses anything a browser could make up', () => {
    const good = buildAll({ ...withSun(true), planets: [newPlanet(1)] });
    expect(designProblem(good)).toBeNull();
    for (const bad of [null, { ...good, v: 2 }, { ...good, sun: { kind: 'purple', name: [0, 0] } }, { ...good, planets: [newPlanet(1), newPlanet(1)] },
      { ...good, planets: [{ ...newPlanet(1), size: 9 }] }, { ...good, planets: Array.from({ length: 9 }, (_, i) => newPlanet(i)) }]) {
      expect(designProblem(bad)).toMatch(/could not be read/);
    }
    // Typed names: tidy, kind ones only.
    expect(designProblem({ ...good, planets: [{ ...newPlanet(1), label: 'Big Blue Ball' }] })).toBeNull();
    for (const rude of ['Fuuuck', 'Poo', 'Butt Head', 'Shiiit Land', 'dumb', 'big blue ball', 'R2 D2']) {
      expect(designProblem({ ...good, planets: [{ ...newPlanet(1), label: rude }] })).toMatch(/kinder/);
    }
  });
});
