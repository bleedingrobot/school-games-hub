import { describe, expect, it } from 'vitest';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, THEMES, avatarToSave, normaliseAvatar, randomAvatar, themeOf } from './avatarParts';

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

describe('the theme saved inside the avatar', () => {
  it('only uses a key and codes the server will accept', () => {
    expect('theme').toMatch(KEY);
    for (const theme of THEMES) expect(theme.id).toMatch(VALUE);
  });

  it('reads the theme, and falls back to Tidy school when it is missing or unknown', () => {
    expect(themeOf({ ...DEFAULT_AVATAR, theme: 'menu' })).toBe('menu');
    expect(themeOf({ theme: 'soft' })).toBe('soft');
    expect(themeOf({ ...DEFAULT_AVATAR })).toBe('tidy');
    expect(themeOf({ theme: 'neon' })).toBe('tidy');
    expect(themeOf({ theme: 7 })).toBe('tidy');
    expect(themeOf(null)).toBe('tidy');
    expect(themeOf('menu')).toBe('tidy');
  });

  it('does not change the avatar itself', () => {
    expect(normaliseAvatar({ kind: 'robot', theme: 'menu' })).toEqual({ ...DEFAULT_AVATAR, kind: 'robot' });
  });

  it('saves the avatar and the theme together, and fits the size limit', () => {
    const robot = { ...DEFAULT_AVATAR, kind: 'robot' } as const;
    expect(avatarToSave(robot, 'soft')).toEqual({ ...robot, theme: 'soft' });
    // Tidy school is the default, so it is saved as no theme at all.
    expect(avatarToSave(robot, 'tidy')).toEqual(robot);
    const saved = avatarToSave(robot, 'menu');
    expect(themeOf(saved)).toBe('menu');
    expect(normaliseAvatar(saved)).toEqual(robot);
    expect(JSON.stringify(saved).length).toBeLessThan(500);
  });
});
