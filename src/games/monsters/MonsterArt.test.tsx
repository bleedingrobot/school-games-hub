import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MONSTER_BOOK } from '../../../shared/monsters/monsterBook';
import { AttackEffect, parseAnim } from './art/Effects';
import { MonsterArt } from './art/MonsterArt';
import { monsterPic } from './art/painted';

// The drawings are tested with no painted pictures (they are the fallback); the painted tests below pretend some are there.
vi.mock('./art/painted', async (actual) => ({ ...(await actual<typeof import('./art/painted')>()), monsterPic: vi.fn(() => undefined) }));
const pic = vi.mocked(monsterPic);
afterEach(() => pic.mockReset());

describe('monster art', () => {
  it('draws all 54 monsters with their name as the label', () => {
    expect(MONSTER_BOOK).toHaveLength(54);
    for (const sp of MONSTER_BOOK) {
      const { container, unmount } = render(<MonsterArt species={sp.id} />);
      expect(screen.getByRole('img', { name: sp.name })).toBeInTheDocument();
      expect(container.querySelectorAll('svg *').length).toBeGreaterThan(8);
      unmount();
    }
  });

  it('draws different pictures for different monsters and a different colour when shiny', () => {
    const html = (species: string, shiny = false) => {
      const { container, unmount } = render(<MonsterArt species={species} shiny={shiny} />);
      const out = container.innerHTML;
      unmount();
      return out;
    };
    const pics = new Set(MONSTER_BOOK.map((s) => html(s.id)));
    expect(pics.size).toBe(54);
    expect(html('digibud-1', true)).not.toBe(html('digibud-1'));
    expect(html('digibud-1', true)).toContain('(shiny)');
  });

  it('grown forms have more parts than first forms', () => {
    const parts = (id: string) => {
      const { container, unmount } = render(<MonsterArt species={id} />);
      const n = container.querySelectorAll('svg *').length;
      unmount();
      return n;
    };
    for (const family of new Set(MONSTER_BOOK.map((s) => s.family))) {
      expect(parts(`${family}-3`), family).toBeGreaterThan(parts(`${family}-1`));
    }
  });

  it('shows the hurt and faint looks', () => {
    const { container, rerender } = render(<MonsterArt species="divvy-1" state="hurt" />);
    expect(container.querySelector('.mon-art--hurt')).not.toBeNull();
    rerender(<MonsterArt species="divvy-1" state="faint" />);
    expect(container.querySelector('.mon-art--faint')).not.toBeNull();
  });

  it('has an attack effect in three sizes for every animation id in the monster book', () => {
    const anims = new Set(MONSTER_BOOK.flatMap((s) => s.attacks.map((a) => a.anim)));
    expect(anims.size).toBe(18);
    for (const anim of anims) {
      const { container, unmount } = render(<AttackEffect anim={anim} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.children.length, anim).toBeGreaterThan(0);
      unmount();
    }
    // Bigger sizes have more pieces.
    const pieces = (anim: string) => {
      const { container, unmount } = render(<AttackEffect anim={anim} />);
      const n = container.querySelectorAll('svg > *').length;
      unmount();
      return n;
    };
    for (const type of ['leaf', 'fire', 'stone']) expect(pieces(`${type}-3`)).toBeGreaterThan(pieces(`${type}-1`));
    expect(parseAnim('ice-2')).toEqual({ type: 'ice', size: 2 });
  });

  it('the book’s dark shape has no name, drawn or painted', () => {
    const { container, unmount } = render(<MonsterArt species="digibud-1" nameless />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toBe('');
    unmount();
    pic.mockReturnValue('/painted/digibud-1.webp');
    const painted = render(<MonsterArt species="digibud-1" nameless size={52} />);
    const img = painted.container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(painted.container.querySelector('.mon-art--nameless')).not.toBeNull();
    expect(painted.container.innerHTML).not.toMatch(/Digibud/); // (the lower-case species id on the wrapper is fine)
  });
});

describe('painted monster pictures', () => {
  it('draws the painted picture when there is one, in the same wrapper, named like the drawing', () => {
    pic.mockReturnValue('/painted/carrycrab-2-shiny.webp');
    const { container } = render(<MonsterArt species="carrycrab-2" shiny state="hurt" flip />);
    const img = screen.getByRole('img', { name: 'Regroupcrab (shiny)' });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/painted/carrycrab-2-shiny.webp');
    expect(img.parentElement).toHaveClass('mon-art', 'mon-art--hurt');
    expect(img.style.scale).toMatch(/^-/); // flipped to face right
    expect(container.querySelector('svg')).toBeNull(); // no drawing, and no sparkles over a painted shiny
    expect(pic).toHaveBeenCalledWith('carrycrab-2', true, false);
  });

  it('asks for the small copy at 64 px and under', () => {
    pic.mockReturnValue('/x.webp');
    render(<MonsterArt species="digibud-1" size={64} />);
    expect(pic).toHaveBeenLastCalledWith('digibud-1', undefined, true);
    render(<MonsterArt species="digibud-1" size={110} />);
    expect(pic).toHaveBeenLastCalledWith('digibud-1', undefined, false);
  });

  it('falls back to the drawing when there is no picture, or it fails to load', () => {
    const { container, unmount } = render(<MonsterArt species="digibud-1" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    unmount();
    pic.mockReturnValue('/painted/digibud-1.webp');
    const again = render(<MonsterArt species="digibud-1" />);
    fireEvent.error(again.container.querySelector('img')!);
    expect(again.container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Digibud' }).tagName.toLowerCase()).toBe('svg');
  });
});
