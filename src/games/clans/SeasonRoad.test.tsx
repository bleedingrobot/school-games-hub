import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { startingDrafts } from '../../../shared/clans/create';
import type { SeasonClock } from '../../../shared/clans/season';
import { SeasonRoad } from './SeasonRoad';
import { makeClan } from './session';

afterEach(cleanup);
const clock = (day: number, extra: Partial<SeasonClock> = {}): SeasonClock => ({ number: 1, day, daysLeft: 35 - day, clockOn: true, ...extra });
const stop = (id: string) => document.querySelector(`li[data-stage="${id}"]`) as HTMLElement;

describe('the season road', () => {
  it('is hidden with the clock off, no season or no clock', () => {
    for (const c of [null, undefined, clock(12, { clockOn: false }), clock(12, { number: 0 })]) {
      const { container } = render(<SeasonRoad clock={c} />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });

  it('shows the heading, the headline and a screen reader label', () => {
    render(<SeasonRoad clock={clock(24)} />);
    expect(screen.getByRole('heading', { name: 'Season 1 · day 24 of 35' })).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Season 1, day 24 of 35. Now: Get ready. Next: Monster week in 5 days.' });
    expect(within(region).getByText('5 days').tagName).toBe('STRONG');
    expect(region).toHaveTextContent('Grimmor comes in 5 days! Buy supplies in the Market and get strong.');
  });

  it('marks the stop for today, the ones before and the ones after', () => {
    render(<SeasonRoad clock={clock(24)} />);
    expect(stop('build')).toHaveClass('is-done');
    expect(stop('ready')).toHaveClass('is-now');
    expect(stop('monster')).toHaveClass('is-next');
    expect(stop('new')).toHaveClass('is-next');
  });

  it('shows a painted medallion for each stop', () => {
    render(<SeasonRoad clock={clock(24)} />);
    for (const id of ['build', 'ready', 'monster', 'new']) {
      const img = stop(id).querySelector('img');
      expect(img, id).not.toBeNull();
      expect(img).toHaveAttribute('alt', '');
      expect(img?.getAttribute('src')).toBeTruthy();
    }
  });

  it('opens a note when a stop is tapped, and closes it when tapped again', async () => {
    const u = userEvent.setup();
    render(<SeasonRoad clock={clock(24)} />);
    const ready = within(stop('ready')).getByRole('button');
    expect(ready).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.cq-road__note')).toBeNull();
    await u.click(ready);
    expect(ready).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.cq-road__note')).toHaveTextContent('The Market sells fire arrows');
    const monster = within(stop('monster')).getByRole('button');
    await u.click(monster);
    expect(ready).toHaveAttribute('aria-expanded', 'false');
    expect(monster).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.cq-road__note')).toHaveTextContent('Every third round he throws a boulder');
    expect(document.querySelector('.cq-road__note')).toHaveTextContent('Lose and it comes back tomorrow, a little more tired.');
    await u.click(monster);
    expect(document.querySelector('.cq-road__note')).toBeNull();
  });

  it('says you beat the monster once the clan has won this season', () => {
    const clan = makeClan('Red Banner', startingDrafts(4242));
    clan.monster = { season: 1, tries: 1, losses: 0, lastDay: 1, wonDay: 30, supplies: { arrows: 0, potions: 0, net: 0 } };
    render(<SeasonRoad clock={clock(31)} clan={clan} />);
    expect(screen.getByRole('region')).toHaveTextContent('You beat Grimmor! New season in 5 days.');
  });
});
