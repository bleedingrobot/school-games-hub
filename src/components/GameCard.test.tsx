import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { findGame } from '../games/registry';
import { GameCard } from './GameCard';

describe('GameCard', () => {
  it('has a Play button named after the game, going to its bot level', () => {
    const chess = findGame('chess')!;
    render(
      <MemoryRouter>
        <GameCard game={chess} level="medium" onLevelChange={() => {}} />
      </MemoryRouter>,
    );
    const play = screen.getByRole('link', { name: 'Play Chess vs bot' });
    expect(play.getAttribute('href')).toBe('/chess?bot=medium');
    expect(screen.getByRole('group', { name: 'Bot level' })).toBeInTheDocument();
  });

  it('a game with no bots has just Play', () => {
    const noBots = findGame('clan-quest')!;
    render(
      <MemoryRouter>
        <GameCard game={noBots} level="easy" onLevelChange={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: `Play ${noBots.name}` }).getAttribute('href')).toBe('/clan-quest');
    expect(screen.queryByRole('group', { name: 'Bot level' })).toBeNull();
  });
});
