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
}));
vi.mock('../data/clans', async (original) => ({ ...(await original<typeof import('../data/clans')>()), ...data }));

import { ClansStudentPanel, ClansTeacherPanels } from './TeacherClans';

const info = (over = {}) => ({ name: 'Red Banner', day: 4, gold: 220, followers: 12, fightsLeft: 6, averageLevel: 3.5, inFight: false, lastPlayed: new Date().toISOString(), ...over });

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
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
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(true);
    expect(await screen.findByText('On: pupils can play it.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch Clan Quest off' }));
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(false);
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
    expect(data.saveClanRaidsEnabled).toHaveBeenLastCalledWith(true);
    expect(await screen.findByText('On.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch raids off' }));
    expect(data.saveClanRaidsEnabled).toHaveBeenLastCalledWith(false);
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
