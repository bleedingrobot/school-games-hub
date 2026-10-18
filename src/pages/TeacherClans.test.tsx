import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  fetchClansEnabled: vi.fn(),
  saveClansEnabled: vi.fn(),
  fetchClanInfo: vi.fn(),
  resetClan: vi.fn(async () => true),
  fetchClanRaidsEnabled: vi.fn(),
  saveClanRaidsEnabled: vi.fn(),
  fetchVillages: vi.fn(),
  createVillage: vi.fn(async () => 2),
  renameVillage: vi.fn(async () => undefined),
  deleteVillage: vi.fn(async () => true),
  movePupil: vi.fn(async () => undefined),
  fetchClanMathsSettings: vi.fn(),
  saveClanMathsSettings: vi.fn(async () => undefined),
  startClansNewSeason: vi.fn(),
  fetchClanMathsClass: vi.fn(),
  fetchClanMathsStudent: vi.fn(),
}));
vi.mock('../data/clans', async (original) => ({ ...(await original<typeof import('../data/clans')>()), ...data }));

import { ClansStudentPanel, ClansTeacherPanels } from './TeacherClans';

const info = (over = {}) => ({ name: 'Red Banner', day: 4, gold: 220, followers: 12, fightsLeft: 6, averageLevel: 3.5, inFight: false, lastPlayed: new Date().toISOString(), ...over });

const mathsSettings = (over = {}) => ({ yearBand: 5, enabledTopics: ['percentages', 'money'], enabledTables: [2, 3], fightsPerDay: 8, season: 1, ...over });

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
  data.fetchClanMathsSettings.mockResolvedValue(mathsSettings());
  data.fetchClanMathsClass.mockResolvedValue({ players: 0, kinds: [], hardest: [] });
  data.fetchClanMathsStudent.mockResolvedValue({ fame: null, kinds: [] });
  data.startClansNewSeason.mockResolvedValue({ season: 2, clans: 20 });
  data.fetchClansEnabled.mockResolvedValue(false);
  data.saveClansEnabled.mockImplementation(async (on: boolean) => on);
  data.fetchClanInfo.mockResolvedValue(info());
  data.fetchClanRaidsEnabled.mockResolvedValue(false);
  data.saveClanRaidsEnabled.mockImplementation(async (on: boolean) => on);
  data.fetchVillages.mockResolvedValue({
    villages: [
      { id: 1, name: 'Everyone else', isDefault: true, chest: 30, levels: { trainingHall: 0, smithy: 0, church: 0 }, pupils: 2 },
      { id: 2, name: 'Room 12', isDefault: false, chest: 750, levels: { trainingHall: 1, smithy: 2, church: 0 }, pupils: 1 },
    ],
    pupils: [{ id: 'p1', name: 'Brave Otter 12', village: 2 }, { id: 'p2', name: 'Calm Heron 3', village: 1 }],
  });
});

describe('the Clan Quest teacher switch', () => {
  it('starts off, turns the game on for the class and off again', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    expect(await screen.findByText('Off: pupils can’t see it yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch Clan Quest on' }));
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(true, null);
    expect(await screen.findByText('On: pupils can play it.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch Clan Quest off' }));
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(false, null);
    expect(await screen.findByText(/Clan Quest is off/)).toBeInTheDocument();
  });

  it('says so if it cannot be saved', async () => {
    data.saveClansEnabled.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    await user.click(await screen.findByRole('button', { name: 'Switch Clan Quest on' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

describe('a pupil\'s clan on the teacher page', () => {
  it('shows the clan at a glance', async () => {
    render(<ClansStudentPanel student="s1" />);
    expect(await screen.findByText('Red Banner')).toBeInTheDocument();
    expect(screen.getByText(/day 4, average level 3.5, 220 gold, 12 followers, 6 mine fights left today/)).toBeInTheDocument();
  });

  it('says when a clan is in the middle of a fight', async () => {
    data.fetchClanInfo.mockResolvedValue(info({ inFight: true }));
    render(<ClansStudentPanel student="s1" />);
    expect(await screen.findByText(/in the middle of a fight/)).toBeInTheDocument();
  });

  it('asks before resetting, and then resets the clan', async () => {
    const user = userEvent.setup();
    render(<ClansStudentPanel student="s1" />);
    await user.click(await screen.findByRole('button', { name: /Reset this clan/ }));
    expect(data.resetClan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(data.resetClan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Reset this clan/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, reset the clan' }));
    expect(data.resetClan).toHaveBeenCalledWith('s1');
    expect(await screen.findByText(/make a new clan/)).toBeInTheDocument();
    expect(screen.getByText('No clan yet.')).toBeInTheDocument();
  });

  it('says so when there is no clan', async () => {
    data.fetchClanInfo.mockResolvedValue(null);
    render(<ClansStudentPanel student="s1" />);
    expect(await screen.findByText('No clan yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull();
  });
});

describe('the village groups on the teacher page', () => {
  it('shows the groups with their chest and buildings, and who is in which', async () => {
    render(<ClansTeacherPanels />);
    expect(await screen.findByText(/750 gold in the chest, Training Hall 1, Smithy 2, Church 0/)).toBeInTheDocument();
    expect(screen.getByLabelText('Group for Brave Otter 12')).toHaveValue('2');
    expect(screen.getByLabelText('Group for Calm Heron 3')).toHaveValue('1');
  });

  it('raids on classmates start off, and a teacher switches them on and off', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    expect(await screen.findByText('Off.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch raids on' }));
    expect(data.saveClanRaidsEnabled).toHaveBeenLastCalledWith(true, null);
    expect(await screen.findByText('On.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch raids off' }));
    expect(data.saveClanRaidsEnabled).toHaveBeenLastCalledWith(false, null);
  });

  it('makes a group, moves a pupil, and asks before deleting a group', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    await user.type(await screen.findByLabelText('Group name'), 'Room 14');
    await user.click(screen.getByRole('button', { name: 'Make a group' }));
    expect(data.createVillage).toHaveBeenCalledWith('Room 14');
    await user.selectOptions(await screen.findByLabelText('Group for Calm Heron 3'), '2');
    expect(data.movePupil).toHaveBeenCalledWith('p2', 2);
    await user.click(screen.getByRole('button', { name: 'Delete…' }));
    expect(data.deleteVillage).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, delete Room 12' }));
    expect(data.deleteVillage).toHaveBeenCalledWith(2);
  });

  it('cannot delete the default group', async () => {
    render(<ClansTeacherPanels />);
    await screen.findByText(/Everyone else/);
    expect(screen.getAllByRole('button', { name: 'Delete…' })).toHaveLength(1);
  });

  it('says what went wrong in plain words', async () => {
    data.createVillage.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    await user.type(await screen.findByLabelText('Group name'), 'Room 14');
    await user.click(screen.getByRole('button', { name: 'Make a group' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

describe('the Clan Quest maths settings on the teacher page', () => {
  it('shows the settings and saves a change in year band, topics and fights a day', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    expect(await screen.findByRole('heading', { name: 'Clan Quest maths' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Year 5/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Percentages/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Ratios/ })).not.toBeChecked();
    expect(screen.getByRole('spinbutton', { name: /Mine fights a day/ })).toHaveValue(8);
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Year 6/ }));
    await user.click(screen.getByRole('checkbox', { name: /Ratios/ }));
    const fights = screen.getByRole('spinbutton', { name: /Mine fights a day/ });
    await user.clear(fights);
    await user.type(fights, '5');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(data.saveClanMathsSettings).toHaveBeenCalledWith({ yearBand: 6, enabledTopics: ['percentages', 'money', 'ratios'].sort((a, b) => ['times', 'percentages', 'money', 'area', 'division', 'ratios', 'rates', 'integers'].indexOf(a) - ['times', 'percentages', 'money', 'area', 'division', 'ratios', 'rates', 'integers'].indexOf(b)), enabledTables: [2, 3], fightsPerDay: 5 }, null);
    expect(await screen.findByText(/A fight that is already open keeps the questions it started with/)).toBeInTheDocument();
  });

  it('never lets the last topic be switched off, and keeps fights a day between 1 and 30', async () => {
    data.fetchClanMathsSettings.mockResolvedValue(mathsSettings({ enabledTopics: ['area'] }));
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    expect(await screen.findByRole('checkbox', { name: /Area and perimeter/ })).toBeDisabled();
    const fights = screen.getByRole('spinbutton', { name: /Mine fights a day/ });
    await user.clear(fights);
    await user.type(fights, '99');
    expect(fights).toHaveValue(30);
  });

  it('shows the times tables only when that topic is on', async () => {
    data.fetchClanMathsSettings.mockResolvedValue(mathsSettings({ enabledTopics: ['times'], enabledTables: [3] }));
    render(<ClansTeacherPanels />);
    expect(await screen.findByText('Times tables for the times-tables topic')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '3' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '4' })).not.toBeChecked();
  });

  it('says what went wrong in plain words when it cannot save', async () => {
    data.saveClanMathsSettings.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    await user.click(await screen.findByRole('radio', { name: /Year 4/ }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('shows how the school is getting on, hardest first, without any pupil\'s name', async () => {
    data.fetchClanMathsClass.mockResolvedValue({
      players: 14,
      kinds: [{ key: 'clan:y5:ratio', attempts: 20, correct: 8 }, { key: 'clan:y5:percent-of', attempts: 30, correct: 27 }],
      hardest: [{ key: 'clan:y5:ratio', attempts: 20, correct: 8, students: 9 }],
    });
    render(<ClansTeacherPanels />);
    expect(await screen.findByText(/14 pupils have answered Clan Quest questions/)).toBeInTheDocument();
    expect(screen.getByText('Ratio (Year 5): 8 of 20 right (9 pupils)')).toBeInTheDocument();
    expect(screen.getByText('Percent of (Year 5): 27 of 30 right (90% right)')).toBeInTheDocument();
  });
});

describe('the Clan Quest fame season on the teacher page', () => {
  it('asks for NEW SEASON to be typed before it starts one, and says what stays', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    expect(await screen.findByText(/It is season 1/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start a new season…' }));
    const go = screen.getByRole('button', { name: 'Start season 2' });
    expect(go).toBeDisabled();
    await user.type(screen.getByLabelText(/Type NEW SEASON/), 'NEW SEASON');
    await user.click(go);
    expect(data.startClansNewSeason).toHaveBeenCalledWith('NEW SEASON');
    expect(await screen.findByText(/Season 2 has begun. Every clan’s fame is 0 again. Clans, gold, levels and achievements stay./)).toBeInTheDocument();
    expect(screen.getByText(/It is season 2/)).toBeInTheDocument();
  });

  it('can be cancelled without starting anything', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherPanels />);
    await user.click(await screen.findByRole('button', { name: 'Start a new season…' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(data.startClansNewSeason).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start a new season…' })).toBeInTheDocument();
  });
});

describe('a pupil\'s Clan Quest maths on the teacher page', () => {
  it('shows their fame and each kind of question, hardest first', async () => {
    data.fetchClanMathsStudent.mockResolvedValue({
      fame: 33,
      kinds: [{ key: 'clan:y5:ratio', attempts: 5, correct: 1 }, { key: 'clan:y5:quest-pattern', attempts: 2, correct: 2 }],
    });
    render(<ClansStudentPanel student="s1" />);
    expect(await screen.findByText(/Fame 33\./)).toBeInTheDocument();
    expect(screen.getByText('Ratio (Year 5): 1 of 5 right')).toBeInTheDocument();
    expect(screen.getByText('Quest puzzle: pattern (Year 5): 2 of 2 right')).toBeInTheDocument();
  });
});
