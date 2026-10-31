/**
 * The effects of a run in one place: it turns run events into little bursts.
 * Use: `const fx = createFx(scene, settings, reducedMotion)`, then every step `fx.onEvents(runEvents(prev, now))`,
 * every frame `fx.update(dt)`.
 */
import type * as THREE from 'three';
import type { QualitySettings } from '../quality';
import type { RunEvent } from './events';
import { createParticles } from './particles';

export { runEvents, type RunEvent } from './events';
export { makeMarble, makeTrail, type MarbleKind, type MarbleObject, type Trail } from './marbleLook';
export { createParticles, type Particles } from './particles';

export interface Fx {
  /** Events come from `runEvents`, in grid units (x, y, z = height in tiles). A `gem` event shows where `gemPos(id)` says (three.js space), if given. */
  onEvents(events: RunEvent[]): void;
  /** A puff where an answer-gate door opens (three.js space). */
  doorOpen(x: number, y: number, z: number): void;
  update(dt: number): void;
  setQuality(settings: QualitySettings): void;
  dispose(): void;
}

export function createFx(scene: THREE.Object3D, settings: QualitySettings, reducedMotion: boolean, gemPos?: (id: number) => { x: number; y: number; z: number } | undefined): Fx {
  const particles = createParticles(settings, reducedMotion);
  scene.add(particles.object);
  // The engine's z is already the height three.js uses (the renderer puts the marble at z + BALL_RADIUS), and its y is three.js z.
  const up = (z: number) => z;
  return {
    onEvents(events) {
      for (const e of events) {
        if (e.kind === 'land') {
          particles.dust(e.x, up(e.z), e.y, 0xe8d4a2, Math.min(2, e.speed / 5));
        } else if (e.kind === 'fall') particles.splash(e.x, up(e.z), e.y);
        else if (e.kind === 'finish') particles.confetti(e.x, up(e.z), e.y);
        else if (e.kind === 'respawn') particles.sparkle(e.x, up(e.z), e.y);
        else if (e.kind === 'gem') {
          const at = gemPos?.(e.id);
          if (at) particles.sparkle(at.x, at.y, at.z);
        }
      }
    },
    doorOpen: (x, y, z) => particles.dust(x, y, z, 0xd6c7a1, 1.5),
    update: (dt) => particles.update(dt),
    setQuality: (s) => particles.setQuality(s),
    dispose() {
      particles.dispose();
    },
  };
}
