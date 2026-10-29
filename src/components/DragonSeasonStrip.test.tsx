import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import DragonSeasonStrip from './DragonSeasonStrip';

const show = (day: number, level: number | null = 5, title?: string) =>
  render(
    <MemoryRouter>
      <DragonSeasonStrip season={{ clock: { number: 1, day }, hero: level === null ? null : { level, ready: false } }} title={title} />
    </MemoryRouter>,
  );

describe('DragonSeasonStrip', () => {
  it('on day 10 counts down to dragon week, with Forest as the stop we are at and the pupil\'s level', () => {
    show(10);
    const strip = screen.getByRole('region', { name: /Dragon Maths\. Season 1, day 10 of 35\. Now: Forest\. Next: Masters in 5 days\./ });
    expect(within(strip).getByRole('heading', { name: 'This season' })).toBeInTheDocument();
    expect(within(strip).getByText('Season 1 · day 10 of 35')).toBeInTheDocument();
    expect(strip.textContent).toContain('19 days until dragon week.');
    expect(strip.textContent).toContain('You are level 5: 7 more masters to the dragon.');
    const stops = within(strip).getAllByRole('listitem');
    expect(stops.map((li) => li.className)).toEqual(['is-now', 'is-next', 'is-next', 'is-next']);
    expect(stops[0]).toHaveAttribute('aria-current', 'step');
  });

  it('in dragon week the earlier stops are done; with no hero there is no level line', () => {
    show(31, null, 'Dragon Maths this season');
    expect(screen.getByRole('heading', { name: 'Dragon Maths this season' })).toBeInTheDocument();
    const strip = screen.getByRole('region');
    expect(strip.textContent).toContain('Dragon week!');
    expect(strip.textContent).not.toContain('You are level');
    expect(within(strip).getAllByRole('listitem').map((li) => li.className)).toEqual(['is-done', 'is-done', 'is-now', 'is-next']);
  });

  it('has four stops with a picture each, and a link to Dragon Maths', () => {
    const { container } = show(24);
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('.season-strip__name')?.textContent)).toEqual(['Forest', 'Masters', 'Dragon week', 'New season']);
    expect(container.querySelectorAll('img')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Open Dragon Maths' })).toHaveAttribute('href', '/dragon-maths');
  });
});
