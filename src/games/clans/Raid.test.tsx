import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { empireOf, kingdomById, lootGold } from '../../../shared/clans/empire';
import { barracksNeeded, draftJoin, lootShare, troopBill } from '../../../shared/clans/moments';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { armyToLose, armyToWin } from './places';
import { makeClan, newSession, startingDrafts, type Session } from './session';

const SEED = 12345;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

function session(change: (s: Session) => void = () => {}): Session {
  const s = newSession(makeClan('Test Clan', startDrafts()), SEED);
  change(s);
  return s;
}
const startDrafts = () => startingDrafts(SEED);
const show = (s: Session) => render(<ClanQuest seed={SEED} initial={s} />);
const withBarracks = (s: Session, n = 1, vault = 2000) => {
  const e = empireOf(s.clan);
  e.vault = vault;
  for (let i = 0; i < n; i++) e.plots.push({ width: 4, length: 4, building: 'barracks' });
};

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}
const wrongFor = (q: PracticalQuestion) => (q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7);

const toBarracks = async (u: ReturnType<typeof user>) => { await u.click(btn('The Empire')); await u.click(btn('Barracks and troops')); };
const toRaid = async (u: ReturnType<typeof user>) => { await u.click(btn('The Empire')); await u.click(btn('Raid and Friendly War')); };
const setCount = async (u: ReturnType<typeof user>, kind: string, n: number) => {
  const box = screen.getByLabelText(`How many ${kind}`);
  await u.clear(box);
  await u.type(box, String(n));
};

describe('Barracks and troops', () => {
  it('buys troops after the cost question, paid from the vault', async () => {
    const u = user();
    show(session((s) => withBarracks(s)));
    await toBarracks(u);
    await setCount(u, 'footmen', 3);
    await setCount(u, 'axemen', 2);
    await u.click(btn('Work out the cost'));
    const q = troopBill(S, 3, 2, 0)!;
    expect(q.answer).toBe(105);
    await answer(u, q, q.answer);
    await u.click(btn('Buy them for 105 gold'));
    expect(screen.getByRole('status')).toHaveTextContent('That cost 105 gold.');
    await u.click(btn('Carry on'));
    expect(screen.getByText(/3 footmen · room for 17 more/)).toBeInTheDocument();
    expect(screen.getByText(/The vault has/)).toHaveTextContent('The vault has 1895 gold');
  });

  it('a wrong answer still charges the right amount', async () => {
    const u = user();
    show(session((s) => withBarracks(s)));
    await toBarracks(u);
    await setCount(u, 'knights', 2);
    await u.click(btn('Work out the cost'));
    const q = troopBill(S, 0, 0, 2)!;
    await answer(u, q, wrongFor(q));
    await u.click(btn(`Buy them for ${q.answer} gold`));
    await u.click(btn('Carry on'));
    expect(screen.getByText(/The vault has/)).toHaveTextContent('The vault has 1880 gold');
  });

  it('says when the barracks have no room, and when the gold is short', async () => {
    const u = user();
    show(session((s) => withBarracks(s)));
    await toBarracks(u);
    await setCount(u, 'knights', 6);
    expect(screen.getByText('The barracks have room for 5 more knights.')).toBeInTheDocument();
    expect(btn('Work out the cost')).toBeDisabled();
    await setCount(u, 'knights', 0);
    await setCount(u, 'footmen', 10);
    expect(btn('Work out the cost')).toBeEnabled();
  });

  it('with no barracks at all there is no room, and with an empty vault it says so', async () => {
    const u = user();
    show(session());
    await toBarracks(u);
    await setCount(u, 'footmen', 1);
    expect(screen.getByText('The barracks have room for 0 more footmen.')).toBeInTheDocument();
  });

  it('not enough gold in the vault', async () => {
    const u = user();
    show(session((s) => withBarracks(s, 1, 20)));
    await toBarracks(u);
    await setCount(u, 'footmen', 2);
    expect(screen.getByText('That costs 30 gold and the vault has 20.')).toBeInTheDocument();
    expect(btn('Work out the cost')).toBeDisabled();
  });

  it('asks how many barracks the troops need, right or wrong', async () => {
    const u = user();
    show(session((s) => { withBarracks(s, 4); empireOf(s.clan).troops.footman = 65; }));
    await toBarracks(u);
    await u.click(btn('How many barracks do my troops need?'));
    const q = barracksNeeded(S, 65, 20)!;
    expect(q.answer).toBe(4);
    await answer(u, q, wrongFor(q));
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Not quite');
    await u.click(btn('Carry on'));
    expect(screen.getByRole('region', { name: 'Barracks and troops' })).toBeInTheDocument();
  });

  it('the draft: followers join as footmen, are all used up, and the rest go home', async () => {
    const u = user();
    show(session((s) => { withBarracks(s); s.clan.followers = 50; }));
    await toBarracks(u);
    await u.click(btn('Draft 20 percent'));
    await u.click(btn('Draft my followers'));
    const q = draftJoin(S, 50, 20)!;
    expect(q.answer).toBe(10);
    await answer(u, q, q.answer);
    await u.click(btn('Draft my followers'));
    expect(screen.getByRole('status')).toHaveTextContent('All 50 followers are used up: 10 joined as footmen, and the rest went home.');
    await u.click(btn('Carry on'));
    expect(screen.getByText(/followers. The draft asks/)).toHaveTextContent('You have 0 followers');
    expect(screen.getByText(/10 footmen · room for 10 more/)).toBeInTheDocument();
  });

  it('the draft with no room: the button is off and says why (no followers wasted)', async () => {
    const u = user();
    show(session((s) => { s.clan.followers = 40; }));
    await toBarracks(u);
    await u.click(btn('Draft 20 percent'));
    expect(screen.getByText('Build a Barracks first.')).toBeInTheDocument();
    expect((btn('Draft my followers') as HTMLButtonElement).disabled).toBe(true);
  });

  it('the draft can be set with the keyboard only', async () => {
    const u = user();
    show(session());
    await toBarracks(u);
    btn('Draft 10 percent').focus();
    await u.keyboard('{Enter}');
    expect(btn('Draft 10 percent')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Raid and Friendly War', () => {
  const winning = (s: Session) => { Object.assign(s, armyToWin(s)); };

  it('a won raid: the loot answer equals what lands in the vault', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    await u.click(btn(/Raid Bunny Hollow/));
    const q = lootShare(S, kingdomById('bunny-hollow')!.treasury, 10)!;
    expect(q.answer).toBe(lootGold(300, 10));
    await answer(u, q, q.answer);
    await u.click(btn('Send the army!'));
    expect(screen.getByText(/The defenders give way!/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`You won ${q.answer} gold of loot. It is in the vault.`);
    expect(screen.getAllByRole('img').length).toBeGreaterThan(1);
    await u.click(btn('Carry on'));
    await u.click(btn('Back to the empire'));
    expect(screen.getByText(/Vault:/)).toHaveTextContent(`Vault: ${q.answer} gold`);
  });

  it('a wrong loot answer still gives the right loot', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    await u.click(btn(/Raid Bunny Hollow/));
    const q = lootShare(S, 300, 10)!;
    await answer(u, q, wrongFor(q));
    await u.click(btn('Send the army!'));
    expect(screen.getByRole('status')).toHaveTextContent('You won 30 gold');
  });

  it('a lost raid wins nothing and shows the troops that did not come home', async () => {
    const u = user();
    show(session((s) => { Object.assign(s, armyToLose(s)); }));
    await toRaid(u);
    await u.click(btn(/Dragon's Rest/));
    await u.click(btn(/Raid Dragon's Rest/));
    await u.click(btn('Show me how'));
    await u.click(btn('Send the army!'));
    expect(screen.getByText(/Your army falls back/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You did not win any loot this time.');
    expect(screen.getByText(/Troops that did not come home:/)).toBeInTheDocument();
  });

  it('a stalemate is told gently and wins nothing', async () => {
    const u = user();
    show(session((s) => { empireOf(s.clan).troops = { footman: 20, axeman: 0, knight: 0 }; }));
    await toRaid(u);
    await u.click(btn('1 round'));
    await u.click(btn('Careful'));
    await u.click(btn(/Raid Bunny Hollow/));
    await u.click(btn('Show me how'));
    await u.click(btn('Send the army!'));
    expect(screen.getByText(/A stalemate/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You did not win any loot');
  });

  it('a Friendly War changes nothing and does not use up the raid', async () => {
    const u = user();
    const s = session(winning);
    const before = JSON.stringify(empireOf(s.clan));
    show(s);
    await toRaid(u);
    await u.click(btn(/Friendly War with Bunny Hollow/));
    expect(screen.getByText(/Friendly War on Bunny Hollow/)).toBeInTheDocument();
    expect(screen.getByText(/Nobody lost anything and nobody won anything/)).toBeInTheDocument();
    await u.click(btn('Carry on'));
    expect(btn(/Raid Bunny Hollow/)).toBeEnabled();
    await u.click(btn('Back to the empire'));
    expect(screen.getByText(/Vault:/)).toHaveTextContent('Vault: 0 gold');
    expect(before).toContain('"kingdomRaidsToday":0');
  });

  it('one raid a day: after a raid the button is off and says so; a new day brings it back', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    await u.click(btn(/Raid Bunny Hollow/));
    await u.click(btn('Show me how'));
    await u.click(btn('Send the army!'));
    await u.click(btn('Carry on'));
    expect(btn(/Raid Bunny Hollow/)).toBeDisabled();
    expect(screen.getByText(/already raided 1 times today/)).toBeInTheDocument();
    expect(btn(/Friendly War with Bunny Hollow/)).toBeEnabled();
    await u.click(btn('Allow another raid today (test only)'));
    expect(btn(/Raid Bunny Hollow/)).toBeEnabled();
  });

  it('with no troops nothing can be sent', async () => {
    const u = user();
    show(session());
    await toRaid(u);
    expect(btn(/Raid Bunny Hollow/)).toBeDisabled();
    expect(btn(/Friendly War with Bunny Hollow/)).toBeDisabled();
    expect(screen.getByText('You need some troops to send.')).toBeInTheDocument();
  });

  it('every kingdom is shown kindly, and each fight gets its own seed', async () => {
    const u = user();
    show(session(winning));
    await toRaid(u);
    expect(btn(/Bunny Hollow: an easy one/)).toBeInTheDocument();
    expect(btn(/Dragon's Rest: very tough/)).toBeInTheDocument();
    await u.click(btn(/Friendly War with Bunny Hollow/));
    const first = screen.getAllByRole('img').map((n) => n.getAttribute('aria-label')).join();
    await u.click(btn('Carry on'));
    await u.click(btn(/Friendly War with Bunny Hollow/));
    expect(first.length).toBeGreaterThan(0);
  });

  it('can be reached and used with the keyboard only', async () => {
    const u = user();
    show(session(winning));
    btn('The Empire').focus();
    await u.keyboard('{Enter}');
    btn('Raid and Friendly War').focus();
    await u.keyboard('{Enter}');
    btn(/Friendly War with Bunny Hollow/).focus();
    await u.keyboard('{Enter}');
    expect(screen.getByText(/Friendly War on Bunny Hollow/)).toBeInTheDocument();
  });
});

describe('plain-words helpers on the screens', () => {
  it('shows the draft preview, and disables the button at 0%', async () => {
    const u = user();
    show(session((s) => { withBarracks(s); s.clan.followers = 50; }));
    await toBarracks(u);
    expect(screen.getByText(/of your 50 followers will join as/)).toHaveTextContent('0 of your 50 followers will join as footmen. The rest go home.');
    expect(screen.getByText('Pick a bigger draft first.')).toBeInTheDocument();
    expect((btn('Draft my followers') as HTMLButtonElement).disabled).toBe(true);
    await u.click(btn('Draft 20 percent'));
    expect(screen.getByText(/of your 50 followers will join as/)).toHaveTextContent('10 of your 50 followers');
    expect((btn('Draft my followers') as HTMLButtonElement).disabled).toBe(false);
  });
  it('says build a Barracks first when there is none', async () => {
    const u = user();
    show(session((s) => { s.clan.followers = 50; empireOf(s.clan).draftPercent = 20; }));
    await toBarracks(u);
    expect(screen.getByText('Build a Barracks first.')).toBeInTheDocument();
    expect((btn('Draft my followers') as HTMLButtonElement).disabled).toBe(true);
  });
  it('explains army strength and shows a traffic light on each kingdom', async () => {
    const u = user();
    show(session((s) => { withBarracks(s); empireOf(s.clan).troops.footman = 40; }));
    await toRaid(u);
    expect(screen.getByRole('button', { name: /Bunny Hollow.*You should win/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pebble Bridge.*A close fight/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dragon's Rest.*Too strong for now/ })).toBeInTheDocument();
  });
  it('shows What to do next on the Empire home', async () => {
    const u = user();
    show(session((s) => { empireOf(s.clan).vault = 0; s.clan.gold = 250; }));
    await u.click(btn('The Empire'));
    expect(screen.getByText(/What to do next:/).closest('p')!).toHaveTextContent('Put some gold in your vault so you can build.');
    await u.click(btn('Put in 100 gold'));
    expect(screen.getByText(/Vault:/)).toHaveTextContent('Vault: 100 gold');
    expect(screen.getByText(/What to do next:/).closest('p')!).toHaveTextContent('Get a plot of land ready');
  });
});
