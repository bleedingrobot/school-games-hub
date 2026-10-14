import { describe, expect, it } from 'vitest';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, normaliseAvatar, randomAvatar } from './avatarParts';

// The same rules as public.is_valid_avatar() in the database migration.
const KEY = /^[a-z][a-zA-Z]{0,19}$/;
const VALUE = /^([a-z0-9-]{1,24}|#[0-9a-f]{6})$/;

describe('avatar parts', () => {
  it('only uses codes the server will accept', () => {
    for (const [part, options] of Object.entries(AVATAR_OPTIONS)) {
      expect(part).toMatch(KEY);
      for (const option of options) expect(option).toMatch(VALUE);
    }
  });

  it('fits within the server size limit', () => {
    const longest = Object.fromEntries(
      Object.entries(AVATAR_OPTIONS).map(([part, options]) => [part, [...options].sort((a, b) => b.length - a.length)[0]]),
    );
    expect(JSON.stringify(longest).length).toBeLessThan(500);
  });

  it('fills in defaults for anything missing or unknown', () => {
    expect(normaliseAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normaliseAvatar({ kind: 'robot', eyes: 'lasers', hacked: 'yes' })).toEqual({ ...DEFAULT_AVATAR, kind: 'robot' });
  });

  it('makes random avatars from real options', () => {
    let seed = 0;
    const avatar = randomAvatar(() => (seed = (seed + 0.37) % 1));
    expect(normaliseAvatar(avatar)).toEqual(avatar);
  });
});
