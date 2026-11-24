import { describe, expect, it } from 'vitest';
import { drawChoices, SOUND_NAMES, type Kit } from './audio';

describe('Class Live sounds', () => {
  it('every sound, in every game, has many different versions', () => {
    for (const kit of ['stars', 'serpent', 'mural'] as Kit[]) {
      for (const name of SOUND_NAMES) {
        const seen = new Set(Array.from({ length: 60 }, () => drawChoices(name, kit)));
        // Pick and glow are single notes; everything else has many more.
        expect(seen.size, `${kit} ${name}`).toBeGreaterThanOrEqual(name === 'pick' || name === 'glow' ? 4 : 8);
      }
    }
  });
});
