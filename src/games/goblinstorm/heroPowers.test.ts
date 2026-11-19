import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEROES, WEAPON_IDS, WEAPONS } from '../../../shared/goblinstorm/config';
import { HERO_POWERS, HERO_TINT, powerColour, powerPic, powerWords } from './heroPowers';

const config = JSON.parse(readFileSync('docs/goblinstorm-art/config.json', 'utf8')) as { pictures: { folder?: string; file?: string }[] };
const painted = new Set(config.pictures.map((p) => `${p.folder}/${p.file}`));

describe("each hero's own weapons", () => {
  it('the Knight keeps the plain set', () => {
    expect(HERO_POWERS.knight).toBeUndefined();
    for (const id of WEAPON_IDS) expect(powerWords('knight', id).name).toBe(WEAPONS[id].name);
  });

  it('every own version has a picture to paint, for the weapon and its evolution', () => {
    for (const [hero, set] of Object.entries(HERO_POWERS)) {
      for (const id of Object.keys(set ?? {})) {
        expect(painted.has(`weapons/${hero}/${id}`), `weapons/${hero}/${id}`).toBe(true);
        expect(painted.has(`evolved/${hero}/${id}`), `evolved/${hero}/${id}`).toBe(true);
      }
    }
  });

  it("no two of a hero's weapons share a name, and the words are short", () => {
    for (const h of HEROES) {
      const names = WEAPON_IDS.flatMap((id) => [powerWords(h.id, id).name, powerWords(h.id, id).evolved]);
      expect(new Set(names).size, h.id).toBe(names.length);
      for (const id of WEAPON_IDS) {
        const w = powerWords(h.id, id);
        expect(w.name.length).toBeLessThanOrEqual(20);
        expect(w.evolved.length).toBeLessThanOrEqual(20);
        expect(w.blurb.length).toBeLessThanOrEqual(60);
        expect(w.evolvedBlurb.length).toBeLessThanOrEqual(60);
      }
    }
  });

  it('every hero with their own set has a colour, and it changes only their own weapons', () => {
    for (const hero of Object.keys(HERO_POWERS) as (keyof typeof HERO_POWERS)[]) expect(HERO_TINT[hero]).toMatch(/^#[0-9a-f]{6}$/);
    expect(powerColour('wizard', 'blades').main).not.toBe(powerColour('knight', 'blades').main);
    expect(powerColour('wizard', 'fireball')).toEqual(powerColour('knight', 'fireball'));
    expect(powerColour('wizard', 'blades').main).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a picture not painted yet falls back to the plain one', () => {
    expect(powerPic('knight', 'blades')).toBe('weapons/blades');
    expect(powerPic('wizard', 'fireball', true)).toBe('evolved/fireball');
  });
});
