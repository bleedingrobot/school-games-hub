import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../../shared/clans/config';
import { ACHIEVEMENTS } from '../../../shared/clans/rewards';
import { ClanQuest } from './ClanQuest';
import { HowToPlay } from './HowToPlay';

const SEED = 12345;

describe('How to play', () => {
  it('is reachable from the clan page and goes back to it', async () => {
    const u = userEvent.setup();
    render(<ClanQuest seed={SEED} />);
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    await u.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('region', { name: 'How to play' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to play', level: 2 })).toHaveFocus();
    await u.click(screen.getAllByRole('button', { name: 'Back to the clan' })[0]);
    expect(screen.getByRole('region', { name: 'Your clan' })).toBeInTheDocument();
  });

  it('is on the first screen of the creator, without losing the clan being made', async () => {
    const u = userEvent.setup();
    render(<ClanQuest seed={SEED} />);
    const box = screen.getByText('How to play', { selector: 'summary' }).closest('details')!;
    expect(box).not.toHaveAttribute('open');
    await u.click(within(box).getByText('How to play'));
    expect(within(box).getByRole('heading', { name: 'The Mines' })).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('covers every part of the game in short sections', () => {
    render(<HowToPlay onBack={() => {}} />);
    for (const name of ['Your clan', 'The Mines', 'Battle Cry', 'The Market', 'The Training Hall', 'The Church', 'My Village', 'Troops', 'Raids on kingdoms', 'Quests', 'Raids on classmates', 'Fame and the Scoreboard', 'Achievements']) {
      expect(screen.getByRole('heading', { name, level: 3 })).toBeInTheDocument();
    }
    for (const section of screen.getAllByRole('region')) {
      const words = (section.textContent ?? '').split(/\s+/).length;
      expect(words, section.getAttribute('aria-labelledby') ?? 'page').toBeLessThan(section.classList.contains('cq-howtoplay') ? 700 : 80);
    }
  });

  it('says that the teacher can switch raids on classmates off', () => {
    render(<HowToPlay onBack={() => {}} />);
    expect(screen.getByText(/Your teacher can switch these on or off/)).toBeInTheDocument();
  });

  it('explains My Village, troops and raids in plain words, with none of the old ones', () => {
    const { container } = render(<HowToPlay onBack={() => {}} />);
    const text = container.textContent ?? '';
    for (const needed of ['Upgrade', 'Barracks', 'Careful', 'Steady', 'Bold', 'Strongroom', 'practice battle', '1 classmate a day']) expect(text, needed).toContain(needed);
    expect(text).not.toMatch(/vault|develop|draft|energy|Friendly War|chest|vote|plot/i);
    expect(text).toMatch(/rests behind a shield/);
  });

  it('takes its numbers from CONFIG, so they are never typed in twice', () => {
    const { container } = render(<HowToPlay fightsPerDay={11} onBack={() => {}} />);
    const text = container.textContent ?? '';
    const R = CONFIG.rewards;
    for (const needed of [
      '11 fights a day', `${CONFIG.startGold} gold`, `level ${CONFIG.maxLevel}`, `${CONFIG.shopTax}%`, `${CONFIG.examinePercent}%`, `${CONFIG.pointsPerLevel} training points`,
      `${CONFIG.empire.buildsPerDay} upgrades a day`, `${CONFIG.empire.raids.classmateLootMax}%`, `${CONFIG.empire.raids.newClanDays} days`,
      `${Math.round((CONFIG.battleCryDamage - 1) * 100)}% more damage`, `${ACHIEVEMENTS.length} to collect`,
    ]) expect(text, needed).toContain(needed);
    for (const f of Object.values(R.fame)) expect(text).toContain(String(f));
  });

  it('uses the number of fights the teacher chose', async () => {
    const u = userEvent.setup();
    render(<ClanQuest seed={SEED} initial={null} />);
    await u.click(screen.getByRole('button', { name: 'Start the adventure' }));
    await u.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByText(new RegExp(`${CONFIG.fightsPerDay} fights a day`))).toBeInTheDocument();
  });
});
