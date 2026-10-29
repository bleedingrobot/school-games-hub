import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { QUALITY } from '../quality';
import { createFx } from './index';
import { createParticles } from './particles';

describe('particles', () => {
  it('never holds more dots than the quality allows, and they die away', () => {
    const p = createParticles(QUALITY.simple, false);
    for (let i = 0; i < 10; i++) p.confetti(0, 0, 0);
    expect(p.alive()).toBeLessThanOrEqual(QUALITY.simple.particles);
    for (let i = 0; i < 300; i++) p.update(1 / 60);
    expect(p.alive()).toBe(0);
  });

  it('uses fewer dots with reduced motion', () => {
    const a = createParticles(QUALITY.best, false);
    const b = createParticles(QUALITY.best, true);
    a.confetti(0, 0, 0);
    b.confetti(0, 0, 0);
    expect(b.alive()).toBeLessThan(a.alive());
  });

  it('turns events into dots', () => {
    const scene = new THREE.Scene();
    const fx = createFx(scene, QUALITY.normal, false, () => ({ x: 1, y: 1, z: 1 }));
    fx.onEvents([{ kind: 'gem', id: 0 }, { kind: 'fall', x: 1, y: 1, z: 0 }]);
    fx.update(1 / 60);
    fx.setQuality(QUALITY.simple);
    fx.dispose();
  });
});
