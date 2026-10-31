import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { nzDayNumber } from '../../../shared/clans/clock';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_BLURBS, BUILDING_NAMES, empireOf, upgradeCost } from '../../../shared/clans/empire';
import { landPlot, troopBill } from '../../../shared/clans/moments';
import { VILLAGE_BUILDINGS } from '../../../shared/clans/types';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { makeClan, newSession, startingDrafts, type Session } from './session';

afterEach(cleanup);
const SEED = 12345;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

function session(change: (s: Session) => void = () => {}): Session {
  const s = newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED);
  change(s);
  return s;
}
const show = (s: Session) => render(<ClanQuest seed={SEED} initial={s} />);
const toVillage = async (u: ReturnType<typeof user>) => u.click(btn('My Village'));
const rich = (s: Session) => { s.clan.gold = 5000; };
const withBarracks = (s: Session, level = 1) => { rich(s); empireOf(s.clan).levels.barracks = level; };

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}
const wrongFor = (q: PracticalQuestion) => (q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7);
const card = (name: string) => screen.getByRole('heading', { name, level: 3 }).closest('li')!;
const setCount = async (u: ReturnType<typeof user>, kind: string, n: number) => {
  const box = screen.getByLabelText(`How many ${kind}`);
  await u.clear(box);
  await u.type(box, String(n));
};

describe('My Village', () => {
  it('is the one place on the home screen, replacing The Village and The Empire', async () => {
    const u = user();
    show(session());
    expect(screen.queryByRole('button', { name: 'The Village' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'The Empire' })).toBeNull();
    await toVillage(u);
    expect(screen.getByRole('region', { name: 'My Village' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My Village', level: 2 })).toHaveFocus();
    expect(document.querySelector('[data-scene="village"]')).not.toBeNull();
    await u.click(btn('Back to the clan'));
    expect(screen.getByRole('region', { name: 'Your clan' })).toBeInTheDocument();
  });

  it('shows what to do next, the builds left and the one purse', async () => {
    const u = user();
    show(session());
    await toVillage(u);
    expect(screen.getByText(/What to do next:/).closest('p')!).toHaveTextContent('Build your first Barracks so troops can join you.');
    expect(screen.getByText(/Builds left:/)).toHaveTextContent(`Builds left: 2`);
    expect(screen.getByText(/Clan purse/).closest('p')!).toHaveTextContent(`Clan purse: ${CONFIG.startGold} gold`);
  });

  it('has a card for each of the 8 buildings: name, level, what it does, price', async () => {
    const u = user();
    show(session());
    await toVillage(u);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent).slice(0, 8)).toEqual(VILLAGE_BUILDINGS.map((b) => BUILDING_NAMES[b]));
    for (const b of VILLAGE_BUILDINGS) {
      const c = within(card(BUILDING_NAMES[b]));
      expect(c.getByText(`Level 0 of ${CONFIG.empire.buildings[b].max} (not built yet)`)).toBeInTheDocument();
      expect(c.getByText(BUILDING_BLURBS[b])).toBeInTheDocument();
      expect(c.getByRole('button', { name: new RegExp(`^Upgrade ${BUILDING_NAMES[b]} to level 1 for ${upgradeCost(b, 1)} gold$`) })).toHaveTextContent(`Upgrade · ${upgradeCost(b, 1)} gold`);
    }
  });

  it('upgrades after the area and fence questions, paid from the purse, and uses up a build', async () => {
    const u = user();
    show(session());
    await toVillage(u);
    await u.click(btn('Upgrade Barracks to level 1 for 50 gold'));
    const q = landPlot(S, 'barracks', 1)!;
    expect(q.area.answer).toBe(q.width * q.length);
    await answer(u, q.area, q.area.answer);
    await u.click(btn('Next question'));
    await answer(u, q.fence, q.fence.answer);
    await u.click(btn('Upgrade for 50 gold'));
    expect(screen.getByRole('status')).toHaveTextContent('The Barracks is now level 1. That cost 50 gold. Builds left: 1.');
    await u.click(btn('Carry on'));
    expect(within(card('Barracks')).getByText('Level 1 of 5')).toBeInTheDocument();
    expect(screen.getByText(/Clan purse/).closest('p')!).toHaveTextContent('Clan purse: 150 gold');
    expect(screen.getByText(/Builds left:/)).toHaveTextContent('Builds left: 1');
  });

  it('wrong answers and skipping still upgrade, and the working is shown', async () => {
    const u = user();
    show(session(rich));
    await toVillage(u);
    await u.click(btn('Upgrade Smithy to level 1 for 50 gold'));
    const q = landPlot(S, 'smithy', 1)!;
    await answer(u, q.area, wrongFor(q.area));
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Not quite');
    await u.click(btn('Next question'));
    await u.click(btn('Show me how'));
    await u.click(btn('Upgrade for 50 gold'));
    await u.click(btn('Carry on'));
    expect(within(card('Smithy')).getByText('Level 1 of 6')).toBeInTheDocument();
    expect(screen.getByText(/Clan purse/).closest('p')!).toHaveTextContent('Clan purse: 4950 gold');
  });

  it('the plan grows with the level (the area is asked about the new level)', async () => {
    const u = user();
    show(session((s) => { rich(s); empireOf(s.clan).levels.walls = 2; }));
    await toVillage(u);
    await u.click(btn('Upgrade Walls to level 3 for 150 gold'));
    const q = landPlot(S, 'walls', 3)!;
    expect(screen.getByText(`Level 3 needs a space ${q.width} squares by ${q.length} squares.`)).toBeInTheDocument();
    expect(q.length).toBeGreaterThan(landPlot(S, 'walls', 2)!.length);
  });

  it('upgrades straight away when the teacher has the area and fence topics off', async () => {
    const u = user();
    show(session((s) => { rich(s); s.settings = { ...s.settings, enabledTopics: [] }; }));
    await toVillage(u);
    await u.click(btn('Upgrade Tower to level 1 for 50 gold'));
    expect(screen.getByRole('status')).toHaveTextContent('The Tower is now level 1.');
  });

  it('turns an upgrade button off with the engine\'s kind reason when the gold is short', async () => {
    const u = user();
    show(session((s) => { s.clan.gold = 30; }));
    await toVillage(u);
    const b = btn('Upgrade Barracks to level 1 for 50 gold');
    expect(b).toBeDisabled();
    expect(within(card('Barracks')).getByText('The Barracks (level 1) costs 50 gold and the clan has 30.')).toBeInTheDocument();
    // The reason is tied to the button for screen readers.
    expect(b.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(b.getAttribute('aria-describedby')!)).toHaveTextContent('costs 50 gold and the clan has 30');
  });

  it('turns every upgrade off after 2 builds a day, and a new day brings them back', async () => {
    const u = user();
    show(session((s) => { rich(s); s.settings = { ...s.settings, enabledTopics: [] }; }));
    await toVillage(u);
    for (const name of ['Barracks', 'Smithy']) {
      await u.click(btn(new RegExp(`^Upgrade ${name} to level 1`)));
      await u.click(btn('Carry on'));
    }
    expect(screen.getByText(/Builds left:/)).toHaveTextContent('Builds left: 0');
    const b = btn(/^Upgrade Church to level 1/);
    expect(b).toBeDisabled();
    expect(within(card('Church')).getByText(/Your builders have done every job they can/)).toBeInTheDocument();
    expect(screen.getByText(/What to do next:/).closest('p')!).not.toHaveTextContent(/Barracks so troops/);
    await u.click(btn('Back to the clan'));
    await u.click(btn('Skip a day'));
    await toVillage(u);
    expect(btn(/^Upgrade Church to level 1/)).toBeEnabled();
    expect(screen.getByText(/Builds left:/)).toHaveTextContent('Builds left: 2');
  });

  it('says a top-level building is fully built and cannot be upgraded', async () => {
    const u = user();
    show(session((s) => { rich(s); empireOf(s.clan).levels.church = CONFIG.empire.buildings.church.max; }));
    await toVillage(u);
    const c = within(card('Church'));
    expect(c.getByText('Level 3 of 3')).toBeInTheDocument();
    expect(c.getByRole('button', { name: 'Church is fully built' })).toBeDisabled();
    expect(c.getByText(/already as big as it can be/)).toBeInTheDocument();
  });

  it('a Church upgrade gives the free wake-ups at the Church', async () => {
    const u = user();
    show(session((s) => { rich(s); s.settings = { ...s.settings, enabledTopics: [] }; s.clan.members[0].knockedOut = true; s.clan.members[1].knockedOut = true; }));
    await toVillage(u);
    await u.click(btn(/^Upgrade Church to level 1/));
    await u.click(btn('Carry on'));
    await u.click(btn('Back to the clan'));
    await u.click(btn('The Church'));
    expect(screen.getByText(/The first 2 wake-ups today are free/)).toBeInTheDocument();
  });

  it('shows no picture, and does not break, when a building has none', async () => {
    const u = user();
    show(session());
    await toVillage(u);
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(8);
    for (const img of document.querySelectorAll('.cq-bcard img')) expect(img.getAttribute('alt')).toBe('');
  });

  it('shows the pictures of built buildings with an empty alt (the words say the same)', async () => {
    const u = user();
    show(session((s) => { Object.assign(empireOf(s.clan).levels, { barracks: 1, walls: 3, forge: 5 }); }));
    await toVillage(u);
    const srcs = [...document.querySelectorAll<HTMLImageElement>('.cq-bcard__art')].map((i) => i.getAttribute('src') ?? '');
    expect(srcs.some((x) => x.includes('barracks'))).toBe(true);
    expect(srcs.some((x) => x.includes('walls'))).toBe(true);
    expect(srcs.some((x) => /steelmill|forge/.test(x))).toBe(true);
    expect(document.querySelectorAll('.cq-bcard img:not([alt=""])')).toHaveLength(0);
  });

  it('never uses the old words', async () => {
    const u = user();
    show(session(withBarracks));
    await toVillage(u);
    const region = screen.getByRole('region', { name: 'My Village' });
    expect(region.textContent).not.toMatch(/vault|develop|draft|energy|plot/i);
  });

  it('says "You are safe from raids until" when the clan has a shield, and nothing when it has not', async () => {
    const u = user();
    const { unmount } = show(session());
    await toVillage(u);
    expect(screen.queryByText(/safe from raids/)).toBeNull();
    unmount();
    show(session((s) => { empireOf(s.clan).shieldUntil = nzDayNumber(Date.now()) + 1; }));
    await u.click(btn('My Village'));
    expect(screen.getByRole('status')).toHaveTextContent(/^You are safe from raids until the end of (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\.$/);
  });

  it('forgets an old shield', async () => {
    const u = user();
    show(session((s) => { empireOf(s.clan).shieldUntil = nzDayNumber(Date.now()) - 1; }));
    await toVillage(u);
    expect(screen.queryByText(/safe from raids/)).toBeNull();
  });
});

describe('Troops in My Village', () => {
  it('shows counts, room from the barracks level, strength with its key and the followers line', async () => {
    const u = user();
    show(session((s) => { withBarracks(s, 2); empireOf(s.clan).troops.footman = 5; s.clan.followers = 7; }));
    await toVillage(u);
    const troops = within(screen.getByRole('group', { name: 'Troops' }));
    expect(troops.getByText(/5 footmen/)).toHaveTextContent('room for 35 more, holds 40');
    expect(troops.getByText(/0 axemen/)).toHaveTextContent('holds 20');
    expect(troops.getByText(/0 knights/)).toHaveTextContent('holds 10');
    expect(troops.getByText(/Army strength/)).toHaveTextContent('Army strength: 5 (footman 1, axeman 2, knight 4)');
    expect(troops.getByText(/New followers join as footmen while there is room/)).toHaveTextContent('You have 7 followers.');
    expect(document.querySelectorAll('.cq-troop-art:not([alt=""])')).toHaveLength(0);
  });

  it('a Barracks upgrade lets waiting followers join as footmen, and says so', async () => {
    const u = user();
    show(session((s) => { rich(s); s.settings = { ...s.settings, enabledTopics: [] }; s.clan.followers = 30; }));
    await toVillage(u);
    await u.click(btn(/^Upgrade Barracks to level 1/));
    expect(screen.getByRole('status')).toHaveTextContent('20 footmen joined your army.');
    await u.click(btn('Carry on'));
    expect(screen.getByText(/You have/)).toHaveTextContent('You have 10 followers.');
    expect(within(screen.getByRole('group', { name: 'Troops' })).getByText(/^20 footmen/)).toBeInTheDocument();
  });

  it('buys troops after the cost question, paid from the purse', async () => {
    const u = user();
    show(session((s) => withBarracks(s)));
    await toVillage(u);
    await setCount(u, 'footmen', 3);
    await setCount(u, 'axemen', 2);
    await u.click(btn('Work out the cost'));
    const q = troopBill(S, 3, 2, 0)!;
    expect(q.answer).toBe(105);
    await answer(u, q, q.answer);
    await u.click(btn('Buy them for 105 gold'));
    expect(screen.getByRole('status')).toHaveTextContent('That cost 105 gold.');
    await u.click(btn('Carry on'));
    expect(screen.getByText(/3 footmen/)).toHaveTextContent('room for 17 more');
    expect(screen.getByText(/Clan purse/).closest('p')!).toHaveTextContent('Clan purse: 4895 gold');
  });

  it('a wrong answer still charges the right amount', async () => {
    const u = user();
    show(session((s) => withBarracks(s)));
    await toVillage(u);
    await setCount(u, 'knights', 2);
    await u.click(btn('Work out the cost'));
    const q = troopBill(S, 0, 0, 2)!;
    await answer(u, q, wrongFor(q));
    await u.click(btn(`Buy them for ${q.answer} gold`));
    await u.click(btn('Carry on'));
    expect(screen.getByText(/Clan purse/).closest('p')!).toHaveTextContent('Clan purse: 4880 gold');
  });

  it('says when the barracks have no room, and when the gold is short', async () => {
    const u = user();
    show(session((s) => withBarracks(s)));
    await toVillage(u);
    await setCount(u, 'knights', 6);
    expect(screen.getByText('The barracks have room for 5 more knights.')).toBeInTheDocument();
    expect(btn('Work out the cost')).toBeDisabled();
    cleanup();
    show(session((s) => { empireOf(s.clan).levels.barracks = 1; s.clan.gold = 20; }));
    await u.click(btn('My Village'));
    await setCount(u, 'footmen', 2);
    expect(screen.getByText('That costs 30 gold and the clan has 20.')).toBeInTheDocument();
  });

  it('with no barracks there is no room', async () => {
    const u = user();
    show(session());
    await toVillage(u);
    await setCount(u, 'footmen', 1);
    expect(screen.getByText('The barracks have room for 0 more footmen.')).toBeInTheDocument();
    expect(btn('Work out the cost')).toBeDisabled();
  });

  it('has the raid buttons', async () => {
    const u = user();
    show(session());
    await toVillage(u);
    await u.click(btn('Raid a kingdom / Practice battle'));
    expect(screen.getByRole('region', { name: 'Raid a kingdom' })).toBeInTheDocument();
    await u.click(btn('Back to My Village'));
    await u.click(btn('Raid a classmate'));
    expect(screen.getByRole('region', { name: 'Raid a classmate' })).toBeInTheDocument();
    await u.click(btn('Back to My Village'));
    expect(screen.getByRole('region', { name: 'My Village' })).toBeInTheDocument();
  });
});
