import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AvatarImage } from './AvatarImage';
import { EARNED_PICTURES, pictureOf, tierOf } from './earnedPictures';

describe('earned pictures', () => {
  it('gives bronze, silver, then gold for three or more', () => {
    expect([0, 1, 2, 3, 7].map(tierOf)).toEqual([null, 'bronze', 'silver', 'gold', 'gold']);
  });

  it('reads the picture an avatar is wearing, and nothing from a built avatar or a bad code', () => {
    expect(pictureOf({ kind: 'cat' })).toBeNull();
    expect(pictureOf({ pic: 'Not OK!' })).toBeNull();
    expect(pictureOf({ pic: 'dm-first-five', picTier: 'silver' })).toMatchObject({ id: 'dm-first-five', tier: 'silver', emoji: '🏆' });
    expect(pictureOf({ pic: 'dm-first-five', picTier: 'diamond' })?.tier).toBe('bronze');
  });

  it('draws the built avatar when no picture is worn', () => {
    const html = renderToStaticMarkup(<AvatarImage avatar={{ kind: 'robot' }} label="Speedy Otter 27" />);
    expect(html).toContain('aria-label="Speedy Otter 27"');
    expect(html).not.toContain('data-pic');
  });

  it('draws a worn picture in its ring: the emoji until it is painted, then the painting', () => {
    const placeholder = renderToStaticMarkup(<AvatarImage avatar={{ kind: 'robot', pic: 't-pic', picTier: 'gold' }} size={44} label="Me" />);
    expect(placeholder).toContain('data-tier="gold"');
    expect(placeholder).toContain('🏆');
    expect(placeholder).toContain('width="44"');
    expect(placeholder).not.toContain('<image');

    EARNED_PICTURES['t-pic'] = { emoji: '🐉', art: '/dragon-head.webp' };
    try {
      const painted = renderToStaticMarkup(<AvatarImage avatar={{ pic: 't-pic', picTier: 'silver' }} />);
      expect(painted).toContain('data-tier="silver"');
      expect(painted).toContain('href="/dragon-head.webp"');
      expect(painted).toContain('🐉');
    } finally {
      delete EARNED_PICTURES['t-pic'];
    }
  });
});
