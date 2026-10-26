import { render, screen } from '@testing-library/react';
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

import { ClansStudentPanel } from './TeacherClans';

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

describe("a pupil's Clan Quest maths on the teacher page", () => {
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
