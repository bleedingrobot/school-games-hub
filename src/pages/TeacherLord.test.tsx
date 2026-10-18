import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  fetchLordSettings: vi.fn(),
  saveLordSettings: vi.fn(),
  fetchClassLord: vi.fn(),
  fetchStudentLord: vi.fn(),
  resetLordHero: vi.fn(async () => {}),
}));
vi.mock('../data/lord', async (original) => ({ ...(await original<typeof import('../data/lord')>()), ...data }));

import { LordStudentPanel, LordTeacherPanels } from './TeacherLord';

const settings = (over = {}) => ({ enabled: false, forestPerDay: 10, seasonStart: null, pausedSince: null, ...over });

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
  data.fetchLordSettings.mockResolvedValue(settings());
  data.saveLordSettings.mockImplementation(async (s: object) => settings(s));
  data.fetchClassLord.mockResolvedValue({
    season: { number: 2, start: '2026-11-23', daysLeft: 20 },
    players: 5,
    thisSeason: 4,
    levels: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    hardest: [{ pack: 'times-tables', key: 'mul:7x8', students: 3, attempts: 12, correct: 4 }],
    refusals: [{ name: 'Lucky Tui 21', realName: 'ana', reason: 'tampered', action: 'fight-finish', at: new Date().toISOString() }],
    hall: [{ season: 1, name: 'Brave Kiwi', realName: 'ben', kills: 2 }],
  });
  data.fetchStudentLord.mockResolvedValue({
    hero: { level: 5, heroClass: 'mage', exp: 900, stars: 1, season: 2, savedAt: new Date().toISOString(), stats: { forestWins: 20, masterWins: 4, arenaWins: 3, riddles: 15, dragons: 1, bestLevel: 7 }, hall: 1 },
    topics: [{ pack: 'times-tables', facts: 20, attempts: 30, correct: 24, fluent: 8 }, { pack: 'money', facts: 5, attempts: 9, correct: 6, fluent: 1 }],
    hardest: [{ pack: 'times-tables', key: 'mul:7x8', attempts: 5, correct: 1 }],
    refused: 2,
  });
});

describe('the Dragon Maths teacher switches', () => {
  it('turns the game on, off (which pauses the season) and on again', async () => {
    const user = userEvent.setup();
    render(<LordTeacherPanels />);
    expect(await screen.findByText('Off: pupils can’t play it yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch Dragon Maths on' }));
    expect(data.saveLordSettings).toHaveBeenLastCalledWith({ enabled: true }, null);
    expect(await screen.findByText('On: pupils can play it.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch Dragon Maths off/ }));
    expect(data.saveLordSettings).toHaveBeenLastCalledWith({ enabled: false }, null);
    expect(await screen.findByText('Dragon Maths is off, and the season clock is paused.')).toBeInTheDocument();
  });

  it('says when the season clock is paused and offers to carry on', async () => {
    data.fetchLordSettings.mockResolvedValue(settings({ pausedSince: '2026-12-18', seasonStart: '2026-11-23' }));
    render(<LordTeacherPanels />);
    expect(await screen.findByText(/Off since 2026-12-18: the season clock is paused/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /carry on the season/ }));
    expect(data.saveLordSettings).toHaveBeenLastCalledWith({ enabled: true }, null);
    expect(await screen.findByText(/The season carries on where it left off/)).toBeInTheDocument();
  });

  it('saves the forest fights a day and the first season date', async () => {
    const user = userEvent.setup();
    data.fetchLordSettings.mockResolvedValue(settings({ enabled: true }));
    render(<LordTeacherPanels />);
    const perDay = await screen.findByLabelText('Forest fights a day');
    await user.clear(perDay);
    await user.type(perDay, '6');
    await user.click(screen.getByRole('button', { name: 'Save forest fights' }));
    expect(data.saveLordSettings).toHaveBeenLastCalledWith({ enabled: true, forestPerDay: 6 }, null);
    await user.type(screen.getByLabelText('First day of season 1'), '2026-11-23');
    await user.click(screen.getByRole('button', { name: 'Save the date' }));
    expect(data.saveLordSettings).toHaveBeenLastCalledWith({ enabled: true, seasonStart: '2026-11-23' }, null);
  });

  it('puts the setting back and says so in plain words when saving fails', async () => {
    data.saveLordSettings.mockRejectedValueOnce(new Error('no'));
    render(<LordTeacherPanels />);
    await userEvent.click(await screen.findByRole('button', { name: 'Switch Dragon Maths on' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Off: pupils can’t play it yet.')).toBeInTheDocument();
  });
});

describe('the Dragon Maths class view', () => {
  it('shows the season, the levels, the hardest questions, the Hall and the requests turned down with real names', async () => {
    render(<LordTeacherPanels />);
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
    data.fetchClassLord.mockResolvedValue({ season: { number: null, start: null, daysLeft: null }, players: 0, thisSeason: 0, levels: [], hardest: [], refusals: [], hall: [] });
    render(<LordTeacherPanels />);
    expect(await screen.findByText('The first season has not started yet.')).toBeInTheDocument();
    expect(screen.getByText('Nobody has beaten the Red Dragon yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Requests the game turned down/ })).not.toBeInTheDocument();
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
});
