import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { KINGDOMS, empireOf } from '../../../shared/clans/empire';
import { ClanQuest } from './ClanQuest';
import { armyToWin } from './places';
import { makeClan, newSession, startingDrafts, type Session } from './session';

afterEach(cleanup);
// Clans art Stage A.7: the village's paintings. All decoration: the words beside them say the same.
const SEED = 12345;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const srcs = (selector: string) => [...document.querySelectorAll<HTMLImageElement>(selector)].map((i) => i.getAttribute('src') ?? '');

function session(change: (s: Session) => void = () => {}): Session {
  const s = newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED);
  change(s);
  return s;
}
const built = (s: Session) => {
  const e = empireOf(s.clan);
  e.levels.barracks = 1;
  e.levels.walls = 2;
  e.troops.footman = 5;
};

describe('the village paintings', () => {
  it('My Village shows a picture for each built building (faded when not built yet) and for the troops', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} initial={session(built)} />);
    await u.click(btn('My Village'));
    expect(srcs('.cq-bcard__art').some((s) => s.includes('barracks'))).toBe(true);
    expect(srcs('.cq-bcard__art').some((s) => s.includes('walls'))).toBe(true);
    expect(document.querySelectorAll('.cq-bcard__art--unbuilt').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.cq-bcard__art:not(.cq-bcard__art--unbuilt)')).toHaveLength(2);
    expect(srcs('.cq-troop-art').map((s) => s.match(/(footman|axeman|knight)/)?.[1])).toEqual(['footman', 'axeman', 'knight']);
  });

  it('the raid screen shows the kingdom picked, and a practice battle shows the battlefield', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} initial={armyToWin(session())} />);
    await u.click(btn('My Village'));
    await u.click(btn('Raid a kingdom / Practice battle'));
    const shown = () => document.querySelector<HTMLImageElement>('.cq-wide-art')?.dataset.art;
    expect(shown()).toBe(KINGDOMS[0].id);
    await u.click(btn(new RegExp(`^${KINGDOMS[2].name}:`)));
    expect(shown()).toBe(KINGDOMS[2].id);
    await u.click(btn(`Practice battle with ${KINGDOMS[2].name}`));
    expect(shown()).toBe('battlefield');
  });
});
