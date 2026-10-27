import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dragonMaths } from '../games/lord';
import { GameSwitchSetting } from '../teacher/Games';

// Dragon Maths on the teacher's Games table (these checks were the old panels'): the switch in its row, and forest fights, the
// season date, the topics and the class report in its Settings, all for a named class.
const data = vi.hoisted(() => ({
  fetchLordSettings: vi.fn(),
  fetchLordEnabled: vi.fn(),
  saveLordEnabled: vi.fn(async () => {}),
  saveLordChange: vi.fn(async () => {}),
  fetchClassLord: vi.fn(),
  fetchStudentLord: vi.fn(),
  resetLordHero: vi.fn(async () => {}),
}));
vi.mock('../data/lord', async (original) => ({ ...(await original<typeof import('../data/lord')>()), ...data }));

import { TOPICS } from '../../shared/maths/skillPacks';
import { LordStudentPanel, LordTeacherSettings, lordStudentSummary } from './TeacherLord';

const label = (id: string) => TOPICS.find((t) => t.id === id)!.label;

const ALL = ['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals', 'money', 'patterns'];
const settings = (over = {}) => ({ enabled: false, forestPerDay: 10, seasonStart: null, pausedSince: null, topics: ALL, ...over });
const CLASS = {
  season: { number: 2, start: '2026-11-23', daysLeft: 20 },
  players: 5,
  thisSeason: 4,
  levels: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  hardest: [{ pack: 'times-tables', key: 'mul:7x8', students: 3, attempts: 12, correct: 4 }],
  refusals: [{ name: 'Lucky Tui 21', realName: 'ana', reason: 'tampered', action: 'fight-finish', at: new Date().toISOString() }],
  hall: [{ season: 1, name: 'Brave Kiwi', realName: 'ben', kills: 2 }],
  wholeSchool: false,
};

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
  data.fetchLordSettings.mockResolvedValue(settings());
  data.fetchLordEnabled.mockResolvedValue(false);
  data.fetchClassLord.mockResolvedValue(CLASS);
  data.fetchStudentLord.mockResolvedValue({
    hero: { level: 5, heroClass: 'mage', exp: 900, stars: 1, season: 2, savedAt: new Date().toISOString(), stats: { forestWins: 20, masterWins: 4, arenaWins: 3, riddles: 15, dragons: 1, bestLevel: 7 }, hall: 1 },
    topics: [{ pack: 'times-tables', facts: 20, attempts: 30, correct: 24, fluent: 8 }, { pack: 'money', facts: 5, attempts: 9, correct: 6, fluent: 1 }],
    hardest: [{ pack: 'times-tables', key: 'mul:7x8', attempts: 5, correct: 1 }],
    refused: 2,
  });
});

const loadedSwitch = async () => {
  const on = await screen.findByRole('switch', { name: 'Dragon Maths' });
  await waitFor(() => expect(on).toBeEnabled());
  return on;
};
const topics = async () => {
  const group = await screen.findByRole('group', { name: 'Topics on' });
  await waitFor(() => expect(within(group).getAllByRole('checkbox')[0]).toBeEnabled());
  return group;
};

describe('the Dragon Maths switch on the Games table', () => {
  it('turns the game on, off (which pauses the season) and on again for the class', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={dragonMaths} classId="c12" />);
    const on = await loadedSwitch();
    expect(data.fetchLordEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(data.saveLordEnabled).toHaveBeenLastCalledWith(true, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'true');
    await user.click(on);
    expect(data.saveLordEnabled).toHaveBeenLastCalledWith(false, 'c12');
    await user.click(on);
    expect(data.saveLordEnabled).toHaveBeenLastCalledWith(true, 'c12');
  });

  it('says behind its "?" that switching off pauses the season clock, and on again carries it on', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={dragonMaths} classId="c12" />);
    await loadedSwitch();
    await user.click(screen.getByRole('button', { name: 'About Dragon Maths' }));
    expect(screen.getByText(/the season clock is paused/)).toBeVisible();
    expect(screen.getByText(/carries the season on where it left off/)).toBeVisible();
  });

  it('puts the setting back and says so in plain words when saving fails', async () => {
    data.saveLordEnabled.mockRejectedValueOnce(new Error('no'));
    render(<GameSwitchSetting game={dragonMaths} classId="c12" />);
    const on = await loadedSwitch();
    await userEvent.click(on);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(on).toHaveAttribute('aria-checked', 'false');
  });

  it('is never a red button', async () => {
    const { container } = render(<GameSwitchSetting game={dragonMaths} classId="c12" />);
    await loadedSwitch();
    expect(container.querySelector('.button--danger')).toBeNull();
  });
});

describe('the Dragon Maths topic tick-list', () => {
  it('shows all eight topics ticked to start', async () => {
    render(<LordTeacherSettings classId="c12" />);
    const group = await topics();
    const boxes = within(group).getAllByRole('checkbox');
    expect(boxes).toHaveLength(8);
    boxes.forEach((b) => expect(b).toBeChecked());
    expect(within(group).getByRole('checkbox', { name: 'Gold and shopping' })).toBeChecked();
    expect(within(group).getByRole('checkbox', { name: 'Number patterns' })).toBeChecked();
    expect(data.fetchLordSettings).toHaveBeenCalledWith('c12');
  });

  it('switches a topic off and saves the list for the class (the switch is kept by the save)', async () => {
    const user = userEvent.setup();
    data.fetchLordSettings.mockResolvedValue(settings({ enabled: true }));
    render(<LordTeacherSettings classId="c14" />);
    await user.click(within(await topics()).getByRole('checkbox', { name: 'Gold and shopping' }));
    expect(data.saveLordChange).toHaveBeenLastCalledWith({ topics: ALL.filter((t) => t !== 'money') }, 'c14');
    expect(screen.getByRole('checkbox', { name: 'Gold and shopping' })).not.toBeChecked();
  });

  it('switches a topic back on, in the usual order', async () => {
    const user = userEvent.setup();
    data.fetchLordSettings.mockResolvedValue(settings({ topics: ['add-sub', 'patterns'] }));
    render(<LordTeacherSettings classId="c12" />);
    await user.click(within(await topics()).getByRole('checkbox', { name: label('fractions') }));
    expect(data.saveLordChange).toHaveBeenLastCalledWith({ topics: ['add-sub', 'fractions', 'patterns'] }, 'c12');
  });

  it('will not let the last topic be switched off', async () => {
    const user = userEvent.setup();
    data.fetchLordSettings.mockResolvedValue(settings({ topics: ['patterns'] }));
    render(<LordTeacherSettings classId="c12" />);
    const last = within(await topics()).getByRole('checkbox', { name: 'Number patterns' });
    await user.click(last);
    expect(await screen.findByText('Leave at least one ticked.')).toBeInTheDocument();
    expect(last).toBeChecked();
    expect(data.saveLordChange).not.toHaveBeenCalled();
  });
});

describe('Dragon Maths’ other settings', () => {
  it('saves the forest fights a day and the first season date for the class, with no Save buttons', async () => {
    const user = userEvent.setup();
    data.fetchLordSettings.mockResolvedValue(settings({ enabled: true, seasonStart: '2026-11-02' }));
    render(<LordTeacherSettings classId="c12" />);
    await topics();
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
    const perDay = screen.getByLabelText('Forest fights a day');
    await user.clear(perDay);
    await user.type(perDay, '6{Enter}');
    expect(data.saveLordChange).toHaveBeenLastCalledWith({ forestPerDay: 6 }, 'c12');
    const date = screen.getByLabelText('First day of season 1');
    await user.clear(date);
    await user.type(date, '2026-11-23');
    await user.tab();
    expect(data.saveLordChange).toHaveBeenLastCalledWith({ seasonStart: '2026-11-23' }, 'c12');
  });

  it('refuses forest fights out of range', async () => {
    const user = userEvent.setup();
    data.fetchLordSettings.mockResolvedValue(settings({ enabled: true }));
    render(<LordTeacherSettings classId="c12" />);
    await topics();
    const perDay = screen.getByLabelText('Forest fights a day');
    await user.clear(perDay);
    await user.type(perDay, '31{Enter}');
    expect(await screen.findByText('Pick a whole number from 1 to 30.')).toBeInTheDocument();
    expect(data.saveLordChange).not.toHaveBeenCalled();
  });

  it('says when the season clock is paused, and that switching on carries the season on', async () => {
    data.fetchLordSettings.mockResolvedValue(settings({ pausedSince: '2026-12-18', seasonStart: '2026-11-23' }));
    render(<LordTeacherSettings classId="c12" />);
    expect(await screen.findByText(/off for this class since 2026-12-18, so its season clock is paused/)).toBeInTheDocument();
    expect(screen.getByText(/carry on the season where it left off/)).toBeInTheDocument();
  });

  it('says the settings only matter once the game is on, and nothing while it is on', async () => {
    const { unmount } = render(<LordTeacherSettings classId="c12" />);
    expect(await screen.findByText(/off for this class, so this only matters/)).toBeInTheDocument();
    unmount();
    data.fetchLordSettings.mockResolvedValue(settings({ enabled: true }));
    render(<LordTeacherSettings classId="c12" />);
    await topics();
    expect(screen.queryByText(/off for this class/)).not.toBeInTheDocument();
  });

  it('puts a topic back and says so in plain words when saving fails', async () => {
    data.saveLordChange.mockRejectedValueOnce(new Error('no'));
    render(<LordTeacherSettings classId="c12" />);
    const money = within(await topics()).getByRole('checkbox', { name: 'Gold and shopping' });
    await userEvent.click(money);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(money).toBeChecked();
  });
});

describe('the Dragon Maths class view', () => {
  it('shows the season, the levels, the hardest questions, the Hall and the requests turned down with real names, for the class', async () => {
    render(<LordTeacherSettings classId="c14" />);
    expect(await screen.findByRole('region', { name: /^Dragon Maths: this class/ })).toBeInTheDocument();
    expect(data.fetchClassLord).toHaveBeenCalledWith('c14');
    expect(await screen.findByText(/Season 2, 20 days left/)).toBeInTheDocument();
    expect(screen.getByText('4 playing this season')).toBeInTheDocument();
    const levels = screen.getByRole('table', { name: 'Heroes at each level this season' });
    expect(within(levels).getByText('12 (the dragon is next)')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: /Hardest questions/ })).getByText('7 × 8')).toBeInTheDocument();
    const hall = screen.getByRole('table', { name: 'Hall of Heroes' });
    expect(hall).toHaveTextContent('ben');
    const refusals = screen.getByRole('table', { name: /Requests the game turned down/ });
    expect(refusals).toHaveTextContent('ana');
    expect(refusals).toHaveTextContent('a fight that didn’t play out the way it was sent');
  });

  it('says when nothing has started', async () => {
    data.fetchClassLord.mockResolvedValue({ season: { number: null, start: null, daysLeft: null }, players: 0, thisSeason: 0, levels: [], hardest: [], refusals: [], hall: [], wholeSchool: false });
    render(<LordTeacherSettings classId="c12" />);
    expect(await screen.findByText('The first season has not started yet.')).toBeInTheDocument();
    expect(screen.getByText('Nobody has beaten the Red Dragon yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Requests the game turned down/ })).not.toBeInTheDocument();
  });

  it('says it is the whole school while the database only has the whole-school report', async () => {
    data.fetchClassLord.mockResolvedValueOnce({ ...CLASS, wholeSchool: true });
    render(<LordTeacherSettings classId="c12" />);
    expect(await screen.findByRole('region', { name: /^Dragon Maths: the whole school/ })).toBeInTheDocument();
    expect(screen.getByText(/shows every class for now/)).toBeInTheDocument();
  });

  it('has no red buttons', async () => {
    const { container } = render(<LordTeacherSettings classId="c12" />);
    await screen.findByRole('table', { name: /Hardest questions/ });
    await topics();
    expect(container.querySelector('.button--danger')).toBeNull();
  });
});

describe('one pupil’s Dragon Maths', () => {
  it('shows their hero, their topics and their hardest questions', async () => {
    render(<LordStudentPanel student="kid-1" />);
    expect(await screen.findByText(/level 5 mage, season 2, 1 dragon star/)).toBeInTheDocument();
    expect(screen.getByText(/20 forest wins, 4 masters, 3 arena wins, 15 right answers, 1 dragons/)).toBeInTheDocument();
    expect(screen.getByText(/2 requests turned down this week/)).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: /How they are getting on/ })).getByText('Gold and shopping')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: /Their hardest questions/ })).getByText('7 × 8')).toBeInTheDocument();
  });

  it('resets a hero only after asking, and says what stays', async () => {
    const user = userEvent.setup();
    render(<LordStudentPanel student="kid-1" />);
    await user.click(await screen.findByRole('button', { name: 'Reset this hero…' }));
    expect(screen.getByText(/points, achievements and Hall of Heroes entries stay/)).toBeInTheDocument();
    expect(data.resetLordHero).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(data.resetLordHero).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reset this hero…' }));
    data.fetchStudentLord.mockResolvedValue({ hero: null, topics: [], hardest: [], refused: 0 });
    await user.click(screen.getByRole('button', { name: 'Yes, reset the hero' }));
    expect(data.resetLordHero).toHaveBeenCalledWith('kid-1');
    expect(await screen.findByText('Dragon Maths: no hero.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Done. They will pick a class next time they play.')).toBeInTheDocument());
  });

  it('says so for a pupil with no hero', async () => {
    data.fetchStudentLord.mockResolvedValue({ hero: null, topics: [], hardest: [], refused: 0 });
    render(<LordStudentPanel student="kid-2" />);
    expect(await screen.findByText('Dragon Maths: no hero.')).toBeInTheDocument();
  });

  it('sums a pupil up in one line, or says nothing without a hero', async () => {
    expect(await lordStudentSummary('kid-1')).toBe('Level 5 mage, season 2, 1 dragon star, 2 requests turned down');
    data.fetchStudentLord.mockResolvedValue({ hero: null, topics: [], hardest: [], refused: 0 });
    expect(await lordStudentSummary('kid-2')).toBeNull();
  });
});
