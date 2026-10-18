import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MONSTER_BOOK } from '../../../shared/monsters/monsterBook';
import { AttackEffect, parseAnim } from './art/Effects';
import { MonsterArt } from './art/MonsterArt';

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
});
