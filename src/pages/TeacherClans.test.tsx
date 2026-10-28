import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clanQuest } from '../games/clans/game';
import { GameSwitchSetting } from '../teacher/Games';

// Clan Quest on the teacher's Games table (these checks were the old panels'): the switch in its row, and made-up hero names,
// the maths settings, raids and the class report in its Settings, all for a named class. The fame
// season and each pupil's clan are under Students.
const data = vi.hoisted(() => ({
  fetchClansEnabled: vi.fn(),
  saveClansEnabled: vi.fn(),
  fetchClanInfo: vi.fn(),
  resetClan: vi.fn(async () => true),
  fetchClanRaidsEnabled: vi.fn(),
  saveClanRaidsEnabled: vi.fn(),
  fetchClanMathsSettings: vi.fn(),
  saveClanMathsSettings: vi.fn(),
  startClansNewSeason: vi.fn(),
  fetchClassClanMaths: vi.fn(),
  fetchClanMathsStudent: vi.fn(),
  fetchClanTypedNames: vi.fn(),
  saveClanTypedNames: vi.fn(),
  listHeroNames: vi.fn(),
}));
vi.mock('../data/clans', async (original) => ({ ...(await original<typeof import('../data/clans')>()), ...data }));

import { AuthContext, type AuthState } from '../auth/AuthContext';
import { ClansSeasonPanel, ClansStudentPanel, ClansTeacherSettings, clansStudentSummary } from './TeacherClans';

/** The fame season panel says whose fame it resets, so it needs to know who is signed in. */
function renderSeason(schoolAdmin = false) {
  const auth = { profile: { id: 't1', display_name: 'Wise Owl 1', avatar: {}, role: 'teacher', school_admin: schoolAdmin } } as unknown as AuthState;
  return render(
    <AuthContext.Provider value={auth}>
      <ClansSeasonPanel />
    </AuthContext.Provider>,
  );
}

const info = (over = {}) => ({ name: 'Red Banner', day: 4, gold: 220, followers: 12, fightsLeft: 6, averageLevel: 3.5, inFight: false, lastPlayed: new Date().toISOString(), ...over });

const mathsSettings = (over = {}) => ({ yearBand: 5, enabledTopics: ['percentages', 'money'], enabledTables: [2, 3], fightsPerDay: 8, season: 1, ...over });

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockReset());
  data.resetClan.mockResolvedValue(true);
  data.saveClanMathsSettings.mockResolvedValue(undefined);
  data.fetchClanMathsSettings.mockResolvedValue(mathsSettings());
  data.fetchClassClanMaths.mockResolvedValue({ players: 0, kinds: [], hardest: [] });
  data.fetchClanMathsStudent.mockResolvedValue({ fame: null, kinds: [] });
  data.startClansNewSeason.mockResolvedValue({ season: 2, clans: 20 });
  data.fetchClansEnabled.mockResolvedValue(false);
  data.saveClansEnabled.mockImplementation(async (on: boolean) => on);
  data.fetchClanInfo.mockResolvedValue(info());
  data.fetchClanRaidsEnabled.mockResolvedValue(false);
  data.saveClanRaidsEnabled.mockImplementation(async (on: boolean) => on);
  data.fetchClanTypedNames.mockResolvedValue(false);
  data.saveClanTypedNames.mockImplementation(async (on: boolean) => on);
  data.listHeroNames.mockResolvedValue(1);
});

/** A switch once it has loaded. */
const loaded = async (name: string) => {
  const sw = await screen.findByRole('switch', { name });
  await waitFor(() => expect(sw).toBeEnabled());
  return sw;
};
/** The maths settings once they have loaded. */
const mathsLoaded = async () => {
  const band = await screen.findByRole('radiogroup', { name: 'Year band' });
  const topics = screen.getByRole('group', { name: 'Topics on' });
  await waitFor(() => expect(within(topics).getAllByRole('checkbox')[0]).toBeEnabled());
  return { band, topics };
};

describe('the Clan Quest switch on the Games table', () => {
  it('starts off, turns the game on for the class and off again', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={clanQuest} classId="c12" />);
    const on = await loaded('Clan Quest');
    expect(data.fetchClansEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(true, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    await user.click(on);
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(false, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
  });

  it('says so if it cannot be saved, and goes back', async () => {
    data.saveClansEnabled.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<GameSwitchSetting game={clanQuest} classId="c12" />);
    const on = await loaded('Clan Quest');
    await user.click(on);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(on).toHaveAttribute('aria-checked', 'false');
  });

  it('says what the game is behind its "?", not in a paragraph', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={clanQuest} classId="c12" />);
    await user.click(await screen.findByRole('button', { name: 'About Clan Quest' }));
    expect(screen.getByText(/Pupils make a clan of four/)).toBeVisible();
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

describe('the village groups are gone', () => {
  it('shows no group, chest or move-pupil controls in the drawer', async () => {
    render(<ClansTeacherSettings classId="c12" />);
    await loaded('Raids on classmates');
    expect(screen.queryByText(/villages \(whole school\)/i)).toBeNull();
    expect(screen.queryByLabelText('Group name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make a group' })).toBeNull();
    expect(screen.queryByRole('table', { name: /Who is in which group/ })).toBeNull();
  });
});

describe('raids on classmates in the drawer (per class)', () => {
  it('start off, and a teacher switches them on and off for the class', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    const raids = await loaded('Raids on classmates');
    expect(data.fetchClanRaidsEnabled).toHaveBeenCalledWith('c12');
    expect(raids).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Clans can raid other clans in the same class, once a day, and a raided clan is safe the next day\./)).toBeInTheDocument();
    await user.click(raids);
    expect(data.saveClanRaidsEnabled).toHaveBeenLastCalledWith(true, 'c12');
    expect(raids).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(raids).toBeEnabled());
    await user.click(raids);
    expect(data.saveClanRaidsEnabled).toHaveBeenLastCalledWith(false, 'c12');
  });
});

describe('the Clan Quest maths settings in the drawer', () => {
  it('shows the settings for the class and saves each change at once, with no Save button', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    const { band, topics } = await mathsLoaded();
    expect(data.fetchClanMathsSettings).toHaveBeenCalledWith('c12');
    expect(within(band).getByRole('radio', { name: 'Year 5' })).toBeChecked();
    expect(within(topics).getByRole('checkbox', { name: /Percentages/ })).toBeChecked();
    expect(within(topics).getByRole('checkbox', { name: /Ratios/ })).not.toBeChecked();
    expect(screen.getByLabelText('Mine fights a day')).toHaveValue(8);
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();

    await user.click(within(band).getByRole('radio', { name: 'Year 6' }));
    expect(data.saveClanMathsSettings).toHaveBeenLastCalledWith({ yearBand: 6 }, 'c12');
    await user.click(within(topics).getByRole('checkbox', { name: /Ratios/ }));
    await waitFor(() => expect(data.saveClanMathsSettings).toHaveBeenLastCalledWith({ enabledTopics: ['percentages', 'money', 'ratios'] }, 'c12'));
    const fights = screen.getByLabelText('Mine fights a day');
    await user.clear(fights);
    await user.type(fights, '5{Enter}');
    await waitFor(() => expect(data.saveClanMathsSettings).toHaveBeenLastCalledWith({ fightsPerDay: 5 }, 'c12'));
    expect(data.saveClanMathsSettings).toHaveBeenCalledTimes(3);
  });

  it('saves one at a time, in order, so a slow save can’t land after a newer one', async () => {
    let finishFirst = () => {};
    data.saveClanMathsSettings.mockImplementationOnce(() => new Promise<void>((done) => (finishFirst = done)));
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    const { band, topics } = await mathsLoaded();
    await user.click(within(band).getByRole('radio', { name: 'Year 6' }));
    await user.click(within(topics).getByRole('checkbox', { name: /Ratios/ }));
    expect(data.saveClanMathsSettings).toHaveBeenCalledTimes(1);
    expect(data.saveClanMathsSettings).toHaveBeenLastCalledWith({ yearBand: 6 }, 'c12');
    finishFirst();
    await waitFor(() => expect(data.saveClanMathsSettings).toHaveBeenCalledTimes(2));
    expect(data.saveClanMathsSettings).toHaveBeenLastCalledWith({ enabledTopics: ['percentages', 'money', 'ratios'] }, 'c12');
  });

  it('never lets the last topic be switched off, and keeps fights a day between 1 and 30', async () => {
    data.fetchClanMathsSettings.mockResolvedValue(mathsSettings({ enabledTopics: ['area'] }));
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    const { topics } = await mathsLoaded();
    const area = within(topics).getByRole('checkbox', { name: /Area and perimeter/ });
    await user.click(area);
    expect(area).toBeChecked();
    expect(await within(topics).findByText('Leave at least one ticked.')).toBeInTheDocument();
    const fights = screen.getByLabelText('Mine fights a day');
    await user.clear(fights);
    await user.type(fights, '99{Enter}');
    expect(await screen.findByText('Pick a whole number from 1 to 30.')).toBeInTheDocument();
    expect(fights).toHaveValue(8);
    expect(data.saveClanMathsSettings).not.toHaveBeenCalled();
  });

  it('shows the times tables only when that topic is on', async () => {
    data.fetchClanMathsSettings.mockResolvedValue(mathsSettings({ enabledTopics: ['times'], enabledTables: [3] }));
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    await mathsLoaded();
    const tables = screen.getByRole('group', { name: 'Times tables for the times-tables topic' });
    expect(within(tables).getByRole('checkbox', { name: '3' })).toBeChecked();
    expect(within(tables).getByRole('checkbox', { name: '4' })).not.toBeChecked();
    await user.click(within(tables).getByRole('checkbox', { name: '3' }));
    expect(await within(tables).findByText('Leave at least one ticked.')).toBeInTheDocument();
    await user.click(within(tables).getByRole('checkbox', { name: '4' }));
    await waitFor(() => expect(data.saveClanMathsSettings).toHaveBeenLastCalledWith({ enabledTables: [3, 4] }, 'c12'));
  });

  it('shows the times tables once that topic is switched on', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    const { topics } = await mathsLoaded();
    expect(screen.queryByRole('group', { name: 'Times tables for the times-tables topic' })).not.toBeInTheDocument();
    await user.click(within(topics).getByRole('checkbox', { name: /Times tables/ }));
    expect(await screen.findByRole('group', { name: 'Times tables for the times-tables topic' })).toBeInTheDocument();
  });

  it('says what went wrong in plain words when it cannot save, and goes back', async () => {
    data.saveClanMathsSettings.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    const { band } = await mathsLoaded();
    await user.click(within(band).getByRole('radio', { name: 'Year 4' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(within(band).getByRole('radio', { name: 'Year 5' })).toBeChecked();
  });

  it('says when Clan Quest is off for the class', async () => {
    render(<ClansTeacherSettings classId="c12" />);
    expect(await screen.findByText(/Clan Quest is off for this class/)).toBeInTheDocument();
  });

  it('says nothing about being off while it is on', async () => {
    data.fetchClansEnabled.mockResolvedValue(true);
    render(<ClansTeacherSettings classId="c12" />);
    await mathsLoaded();
    await waitFor(() => expect(data.fetchClansEnabled).toHaveBeenCalledWith('c12'));
    expect(screen.queryByText(/Clan Quest is off for this class/)).not.toBeInTheDocument();
  });
});

describe('the Clan Quest class report in the drawer', () => {
  it('shows how the class is getting on, hardest first, without any pupil’s name', async () => {
    data.fetchClassClanMaths.mockResolvedValue({
      players: 14,
      kinds: [{ key: 'clan:y5:ratio', attempts: 20, correct: 8 }, { key: 'clan:y5:percent-of', attempts: 30, correct: 27 }],
      hardest: [{ key: 'clan:y5:ratio', attempts: 20, correct: 8, students: 9 }],
    });
    render(<ClansTeacherSettings classId="c12" />);
    expect(await screen.findByRole('heading', { name: 'Clan Quest maths: this class' })).toBeInTheDocument();
    expect(await screen.findByText(/14 pupils have answered Clan Quest questions/)).toBeInTheDocument();
    expect(data.fetchClassClanMaths).toHaveBeenCalledWith('c12');
    const hardest = screen.getByRole('table', { name: 'Questions most often wrong' });
    const ratio = within(hardest).getByRole('rowheader', { name: 'Ratio (Year 5)' }).closest('tr')!;
    expect(within(ratio).getAllByRole('cell').map((c) => c.textContent)).toEqual(['40%', '20', '9']);
    const every = screen.getByRole('table', { name: 'Every kind of question' });
    const percent = within(every).getByRole('rowheader', { name: 'Percent of (Year 5)' }).closest('tr')!;
    expect(within(percent).getAllByRole('cell').map((c) => c.textContent)).toEqual(['90%', '30']);
  });

  it('says when nobody has answered yet, and when it can’t load', async () => {
    const { unmount } = render(<ClansTeacherSettings classId="c12" />);
    expect(await screen.findByText('Nobody has answered a Clan Quest question yet.')).toBeInTheDocument();
    unmount();
    data.fetchClassClanMaths.mockRejectedValue(new Error('x'));
    render(<ClansTeacherSettings classId="c12" />);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

describe('a pupil’s clan in one line', () => {
  it('sums up the clan, or says nothing without one', async () => {
    expect(await clansStudentSummary('s1')).toBe('Red Banner, day 4, average level 3.5');
    data.fetchClanInfo.mockResolvedValue(null);
    expect(await clansStudentSummary('s1')).toBeNull();
  });
});

describe('the Clan Quest fame season on the teacher page', () => {
  it('asks for NEW SEASON to be typed before it starts one, and says what stays', async () => {
    const user = userEvent.setup();
    renderSeason();
    expect(await screen.findByText(/It is season 1/)).toBeInTheDocument();
    expect(screen.getByText(/for the pupils in the classes you teach/)).toBeInTheDocument();
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
    renderSeason();
    await user.click(await screen.findByRole('button', { name: 'Start a new season…' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(data.startClansNewSeason).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start a new season…' })).toBeInTheDocument();
  });

  it('tells a school admin it resets every pupil at the school', async () => {
    renderSeason(true);
    expect(await screen.findByText(/for every pupil at the school/)).toBeInTheDocument();
  });

  it('is not in the Games table’s drawer: it stays with the other seasons', async () => {
    render(<ClansTeacherSettings classId="c12" />);
    expect(await screen.findByRole('heading', { name: 'Maths' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start a new season…' })).not.toBeInTheDocument();
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

describe('made-up hero names', () => {
  it('start off, and a teacher switches them on and off for the class', async () => {
    const user = userEvent.setup();
    render(<ClansTeacherSettings classId="c12" />);
    const names = await loaded('Made-up hero names');
    expect(data.fetchClanTypedNames).toHaveBeenCalledWith('c12');
    expect(names).toHaveAttribute('aria-checked', 'false');
    await user.click(names);
    expect(data.saveClanTypedNames).toHaveBeenLastCalledWith(true, 'c12');
    await waitFor(() => expect(names).toBeEnabled());
    await user.click(names);
    expect(data.saveClanTypedNames).toHaveBeenLastCalledWith(false, 'c12');
    expect(names).toHaveAttribute('aria-checked', 'false');
  });

  it("shows a pupil's hero names and swaps made-up ones for list names", async () => {
    const user = userEvent.setup();
    data.fetchClanInfo.mockResolvedValueOnce(info({ heroes: ['Zoe', 'Wren', 'Finn', 'Pip'] }));
    data.fetchClanInfo.mockResolvedValueOnce(info({ heroes: ['Aria', 'Wren', 'Finn', 'Pip'] }));
    render(<ClansStudentPanel student="p1" />);
    expect(await screen.findByText(/Heroes: Zoe, Wren, Finn, Pip/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Swap made-up names for list names' }));
    expect(data.listHeroNames).toHaveBeenCalledWith('p1');
    expect(await screen.findByText(/Heroes: Aria, Wren/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Swap made-up names for list names' })).toBeNull();
  });

  it('offers no swap when every name is from the list', async () => {
    data.fetchClanInfo.mockResolvedValueOnce(info({ heroes: ['Aria', 'Wren', 'Finn', 'Pip'] }));
    render(<ClansStudentPanel student="p1" />);
    expect(await screen.findByText(/Heroes: Aria/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Swap made-up names for list names' })).toBeNull();
  });
});
