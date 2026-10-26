import { describe, expect, it } from 'vitest';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, THEMES, normaliseAvatar } from './avatarParts';

// The same rules as public.is_valid_avatar() in the database migration.
const KEY = /^[a-z][a-zA-Z]{0,19}$/;
const VALUE = /^([a-z0-9-]{1,24}|#[0-9a-f]{6})$/;

describe('avatar parts', () => {
  it('only uses codes the server will accept, and fills in defaults for anything unknown', () => {
    for (const [part, options] of Object.entries(AVATAR_OPTIONS)) {
      expect(part).toMatch(KEY);
      for (const option of options) expect(option).toMatch(VALUE);
    }
    for (const theme of THEMES) expect(theme.id).toMatch(VALUE);
    expect(normaliseAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normaliseAvatar({ kind: 'robot', eyes: 'lasers', hacked: 'yes' })).toEqual({ ...DEFAULT_AVATAR, kind: 'robot' });
  });
});
