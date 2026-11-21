import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERO_TITLES, SPECIAL_TITLES, titleOf } from './titles';

describe('Hero Titles', () => {
  it('matches the lists the database checks (hero_title_ids, special_title_ids)', () => {
    const idsIn = (file: string) => {
      const sql = readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
      const body = sql.slice(sql.indexOf('select array['), sql.indexOf(']::text[]'));
      return [...body.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    };
    expect(idsIn('20261119000500_hero_titles.sql')).toEqual(HERO_TITLES.map((t) => t.id));
    expect(idsIn('20261122000200_gem_lord.sql')).toEqual(SPECIAL_TITLES.map((t) => t.id));
  });

  it('has ids an avatar can carry, no repeats, and is read from an avatar', () => {
    const all = [...HERO_TITLES, ...SPECIAL_TITLES];
    for (const t of all) expect(t.id).toMatch(/^[a-z0-9-]{1,24}$/);
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    expect(new Set(all.map((t) => t.name)).size).toBe(all.length);
    expect(titleOf({ kind: 'cat', title: 'moon-walker' })?.name).toBe('Moon Walker');
    expect(titleOf({ title: 'ultimate-dragon-slayer' })).toMatchObject({ name: 'Ultimate Dragon Slayer', special: true });
    expect(titleOf({ title: 'the-best' })).toBeUndefined();
    expect(titleOf(null)).toBeUndefined();
  });
});
