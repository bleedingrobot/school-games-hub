import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SeasonClock } from '../../shared/clans/season';
import SeasonStrip from './SeasonStrip';

const clock = (day: number): SeasonClock => ({ number: 1, day, daysLeft: 36 - day, clockOn: true });
const show = (day: number) =>
  render(
    <MemoryRouter>
      <SeasonStrip clock={clock(day)} />
    </MemoryRouter>,
  );

describe('SeasonStrip', () => {
  it('on day 10 says how long until the monster, with Build as the stop we are at', () => {
    show(10);
    const strip = screen.getByRole('region', { name: /Season 1, day 10 of 35\. Now: Build\. Next: Get ready in 12 days\./ });
    expect(within(strip).getByRole('heading', { name: 'This season' })).toBeInTheDocument();
    expect(within(strip).getByText('Season 1 · day 10 of 35')).toBeInTheDocument();
    expect(strip.textContent).toContain('19 days until Grimmor the Storm Giant comes.');
    expect(within(strip).getByText('19 days').tagName).toBe('STRONG');
    const stops = within(strip).getAllByRole('listitem');
    expect(stops.map((li) => li.className)).toEqual(['is-now', 'is-next', 'is-next', 'is-next']);
    expect(stops.filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
    expect(stops[0]).toHaveAttribute('aria-current', 'step');
  });

  it('on day 31 it is monster week and the earlier stops are done', () => {
    show(31);
    const strip = screen.getByRole('region', { name: /Season 1, day 31 of 35\. Now: Monster week\. Next: New season in 5 days\./ });
    expect(strip.textContent).toContain('Monster week!');
    const stops = within(strip).getAllByRole('listitem');
    expect(stops.map((li) => li.className)).toEqual(['is-done', 'is-done', 'is-now', 'is-next']);
    expect(stops[2]).toHaveAttribute('aria-current', 'step');
    expect(within(stops[2]).getByText('Monster week')).toBeInTheDocument();
    expect(within(stops[2]).getByText('Days 29–35')).toBeInTheDocument();
  });

  it('has four stops with a picture or an emoji each, and a link to Clan Quest', () => {
    const { container } = show(24);
    const stops = screen.getAllByRole('listitem');
    expect(stops.map((li) => li.querySelector('.season-strip__name')?.textContent)).toEqual(['Build', 'Get ready', 'Monster week', 'New season']);
    for (const li of stops) expect(li.querySelector('img') ?? li.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll('img').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: 'Open Clan Quest' })).toHaveAttribute('href', '/clan-quest');
  });
});
