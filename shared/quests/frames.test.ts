import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { frameOf, QUEST_FRAMES } from './frames';

describe('Quest Frames', () => {
  it('matches the database list, fits in an avatar, and is read from one', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20261119000800_quest_frames.sql', import.meta.url), 'utf8');
    const body = sql.slice(sql.indexOf('select array['), sql.indexOf(']::text[]'));
    expect([...body.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])).toEqual(QUEST_FRAMES.map((f) => f.id));
    for (const f of QUEST_FRAMES) expect(f.id).toMatch(/^[a-z0-9-]{1,24}$/);
    expect(new Set(QUEST_FRAMES.map((f) => f.id)).size).toBe(QUEST_FRAMES.length);
    expect(frameOf({ kind: 'cat', frame: 'vine' })?.name).toBe('Vine');
    expect(frameOf({ frame: 'gold-ring' })).toBeUndefined();
    expect(frameOf(null)).toBeUndefined();
  });
});
