import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KINGDOMS, empireOf } from '../../../shared/clans/empire';
import { ClanQuest } from './ClanQuest';
import { armyToWin } from './places';
import { makeClan, newSession, startingDrafts, type Session } from './session';

// Clans art Stage A.7: the Empire's paintings. All decoration: the words beside them say the same.
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
  e.vault = 2000;
  e.plots.push({ width: 4, length: 4, building: 'barracks' }, { width: 3, length: 3 });
  e.troops.footman = 5;
};

describe('the Empire paintings', () => {
  it('the Empire and Land show the buildings that are built, and the troops', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} initial={session(built)} />);
    await u.click(btn('The Empire'));
    expect(srcs('.cq-estate img').some((s) => s.includes('barracks'))).toBe(true);
    expect(srcs('.cq-troop-art')).toHaveLength(3);
    await u.click(btn('Land and buildings'));
    expect(srcs('.cq-estate img')).toHaveLength(1);
    await u.click(btn(/^Plot 2: 3×3/));
    expect(srcs('.cq-building-art').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.cq-building-art:not([alt=""])')).toHaveLength(0);
  });

  it('the barracks show each kind of troop', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} initial={session(built)} />);
    await u.click(btn('The Empire'));
    await u.click(btn('Barracks and troops'));
    expect(srcs('.cq-troop-art').map((s) => s.match(/(footman|axeman|knight)/)?.[1])).toEqual(['footman', 'axeman', 'knight']);
  });

  it('the raid screen shows the kingdom picked, and a Friendly War shows the battlefield', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} initial={armyToWin(session())} />);
    await u.click(btn('The Empire'));
    await u.click(btn('Raid and Friendly War'));
    const shown = () => document.querySelector<HTMLImageElement>('.cq-wide-art')?.dataset.art;
    expect(shown()).toBe(KINGDOMS[0].id);
    await u.click(btn(new RegExp(`^${KINGDOMS[2].name}:`)));
    expect(shown()).toBe(KINGDOMS[2].id);
    await u.click(btn(`Friendly War with ${KINGDOMS[2].name}`));
    expect(shown()).toBe('battlefield');
  });
});
