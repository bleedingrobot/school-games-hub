import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERO_TITLES, titleOf } from './titles';

describe('Hero Titles', () => {
  it('matches the list the database checks (hero_title_ids)', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20261119000500_hero_titles.sql', import.meta.url), 'utf8');
    const body = sql.slice(sql.indexOf('select array['), sql.indexOf(']::text[]'));
    const ids = [...body.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(HERO_TITLES.map((t) => t.id));
  });

  it('has ids an avatar can carry, and no repeats', () => {
    for (const t of HERO_TITLES) expect(t.id).toMatch(/^[a-z0-9-]{1,24}$/);
    expect(new Set(HERO_TITLES.map((t) => t.id)).size).toBe(HERO_TITLES.length);
    expect(new Set(HERO_TITLES.map((t) => t.name)).size).toBe(HERO_TITLES.length);
  });

  it('reads the worn title from an avatar', () => {
    expect(titleOf({ kind: 'cat', title: 'moon-walker' })?.name).toBe('Moon Walker');
    expect(titleOf({ title: 'the-best' })).toBeUndefined();
    expect(titleOf(null)).toBeUndefined();
  });
});
