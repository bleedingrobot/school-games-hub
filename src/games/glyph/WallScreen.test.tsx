import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { glyphOfLit, rightCells } from '../../../shared/glyph/play';
import { makeTemple, publicWall } from '../../../shared/glyph/walls';
import { WallScreen } from './WallScreen';

const wall = publicWall(makeTemple('screen-test', 1)[0]);
const show = () => render(<WallScreen wall={wall} index={0} templeName="Mossy Gate" help={0} onDone={vi.fn()} onLeave={vi.fn()} />);
const light = (cells: number[]) => {
  const tiles = within(screen.getByRole('group', { name: 'Wall tiles' })).getAllByRole('button');
  cells.forEach((c) => fireEvent.click(tiles[c]));
  expect(cells.every((c) => tiles[c].getAttribute('aria-pressed') === 'true')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Light the runes' }));
  return within(screen.getByRole('group', { name: 'Glyphs' })).getAllByRole('button', { name: /^Glyph/ });
};

describe('Glyph Gates wall', () => {
  it('lights tiles, shows four glyphs, and opens the wall on the matching glyph (a glyph that does not match costs no go)', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Wall 1 of 9' })).toBeInTheDocument();
    const glyphs = light(rightCells(wall));
    expect(glyphs).toHaveLength(4);
    const made = glyphOfLit(wall, rightCells(wall));
    fireEvent.click(glyphs[(made + 1) % 4]);
    expect(screen.getByText(/that glyph doesn't match your green tiles/)).toBeInTheDocument();
    fireEvent.click(glyphs[made]);
    expect(screen.getByText('The wall opens!')).toBeInTheDocument();
  });

  it('shows why after a wrong glyph that matches the lit tiles, and lets the pupil go again', () => {
    show();
    const right = rightCells(wall);
    const decoy = wall.glyphs.findIndex((g) => glyphOfLit(wall, g) !== -1 && g.some((c) => !right.includes(c)));
    const glyphs = light(wall.glyphs[decoy]);
    fireEvent.click(glyphs[decoy]);
    expect(document.querySelector('.gg-why')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Light the runes' })).toBeInTheDocument();
  });
});
