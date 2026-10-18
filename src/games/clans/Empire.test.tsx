import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { empireOf, plotCost } from '../../../shared/clans/empire';
import { energyLeft, landPlot } from '../../../shared/clans/moments';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { makeClan, newSession, skipDay, startingDrafts, type Session } from './session';

const SEED = 12345;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();

function session(change: (s: Session) => void = () => {}): Session {
  const s = newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED);
  change(s);
  return s;
}
const show = (s: Session) => render(<ClanQuest seed={SEED} initial={s} />);
const vaultOf = (s: Session, gold: number) => empireOf(s.clan).vault = gold;

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}
const wrongFor = (q: PracticalQuestion) => (q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7);
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

async function toLand(u: ReturnType<typeof user>) {
  await u.click(btn('The Empire'));
  await u.click(btn('Land and buildings'));
}

/** Pick a 4 by 5 plot and go through both questions to the price. */
async function toPrice(u: ReturnType<typeof user>, right: boolean) {
  const q = landPlot(S, 4, 5)!;
  await u.click(btn('Width 4'));
  await u.click(btn('Length 5'));
  await u.click(btn('Work out the price'));
  await answer(u, q.area, right ? q.area.answer : wrongFor(q.area));
  await u.click(btn('Next question'));
  await answer(u, q.fence, right ? q.fence.answer : wrongFor(q.fence));
  await u.click(btn('Work out the price'));
}

describe('the Empire home', () => {
  it('starts with 10 plots of wild land, an empty vault and a link from the clan page', async () => {
    const u = user();
    show(session());
    await u.click(btn('The Empire'));
    expect(screen.getByText(/Vault:/)).toHaveTextContent('Vault: 0 gold');
    expect(screen.getByText(/Wild land:/)).toHaveTextContent('Wild land: 10 plots');
    expect(screen.getByText(/0 footmen/)).toBeInTheDocument();
    expect(screen.getByText(/of today's work left/)).toHaveTextContent('100%');
  });

  it('moves gold in and out of the vault, and says kindly when there is not enough', async () => {
    const u = user();
    show(session());
    await u.click(btn('The Empire'));
    await u.click(btn('Put in'));
    expect(screen.getByText(/Vault:/)).toHaveTextContent('Vault: 100 gold');
    expect(screen.getByText(/Clan purse:/)).toHaveTextContent('Clan purse: 100 gold');
    await u.clear(screen.getByLabelText('Gold to move'));
    await u.type(screen.getByLabelText('Gold to move'), '500');
    await u.click(btn('Put in'));
    expect(screen.getByRole('status')).toHaveTextContent('The clan purse only has 100 gold.');
    await u.click(btn('Take out'));
    expect(screen.getByRole('status')).toHaveTextContent('The vault only has 100 gold.');
    await u.clear(screen.getByLabelText('Gold to move'));
    await u.type(screen.getByLabelText('Gold to move'), '40');
    await u.click(btn('Take out'));
    expect(screen.getByText(/Vault:/)).toHaveTextContent('Vault: 60 gold');
  });

  it('the test buttons give followers, vault gold and a full barracks', async () => {
    const u = user();
    show(session());
    await u.click(btn(/Give 100 followers/));
    await u.click(btn(/Put 1,000 gold in the vault/));
    await u.click(btn(/Build a barracks and fill it/));
    await u.click(btn('The Empire'));
    expect(screen.getByText(/Vault:/)).toHaveTextContent('Vault: 1000 gold');
    expect(screen.getByText(/20 footmen/)).toBeInTheDocument();
    expect(screen.getByText(/10 axemen/)).toBeInTheDocument();
    expect(screen.getByText(/5 knights/)).toBeInTheDocument();
    expect(screen.getByText(/You have 100 followers/)).toBeInTheDocument();
  });

  it('can be reached with the keyboard only', async () => {
    const u = user();
    show(session());
    btn('The Empire').focus();
    await u.keyboard('{Enter}');
    expect(screen.getByRole('region', { name: 'The Empire' })).toBeInTheDocument();
  });
});

describe('Land', () => {
  it('a right answer: the plot costs 2 gold a square plus the fence, paid from the vault', async () => {
    const u = user();
    show(session((s) => vaultOf(s, 1000)));
    await toLand(u);
    await toPrice(u, true);
    expect(screen.getByRole('group', { name: 'The price' })).toHaveTextContent('Price: 58 gold');
    await u.click(btn('Develop it for 58 gold'));
    expect(screen.getByRole('status')).toHaveTextContent('A 4 by 5 plot is ready. That cost 58 gold.');
    expect(screen.getByRole('status')).toHaveTextContent('Vault: 942 gold');
  });

  it('a wrong answer still charges the right price', async () => {
    const u = user();
    show(session((s) => vaultOf(s, 1000)));
    await toLand(u);
    await toPrice(u, false);
    await u.click(btn(`Develop it for ${plotCost(empireOf(session().clan), 4, 5)} gold`));
    expect(screen.getByRole('status')).toHaveTextContent('Vault: 942 gold');
  });

  it('with an empty vault the plot cannot be developed, and says why', async () => {
    const u = user();
    show(session());
    await toLand(u);
    await toPrice(u, true);
    expect(btn(/Develop it for 58 gold/)).toBeDisabled();
    expect(screen.getByText('That plot costs 58 gold and the vault has 0.')).toBeInTheDocument();
  });

  it('claims more land when the wild land has run out, for 50 gold then 75', async () => {
    const u = user();
    show(session((s) => { vaultOf(s, 200); empireOf(s.clan).wild = 0; }));
    await toLand(u);
    expect(screen.getByText(/no wild land left/i)).toBeInTheDocument();
    await u.click(btn('Claim more land (50 gold)'));
    expect(screen.getByRole('status')).toHaveTextContent('You claimed one more plot of wild land for 50 gold. Vault: 150 gold.');
    await u.click(btn('Carry on'));
    expect(screen.getByText(/You have 1 plot of wild land/)).toBeInTheDocument();
  });

  it('cannot claim without the gold', async () => {
    const u = user();
    show(session((s) => { empireOf(s.clan).wild = 0; }));
    await toLand(u);
    expect(btn(/Claim more land/)).toBeDisabled();
    expect(screen.getByText('Claiming land costs 50 gold and the vault has 0.')).toBeInTheDocument();
  });
});

describe('Buildings', () => {
  const withPlot = (s: Session) => { vaultOf(s, 1000); empireOf(s.clan).plots.push({ width: 4, length: 4 }); };

  it('asks how much energy is left, then builds, even after a wrong answer', async () => {
    const u = user();
    const s = session(withPlot);
    show(s);
    await toLand(u);
    await u.click(btn(/Plot 1/));
    await u.click(btn('Build Barracks'));
    const q = energyLeft(S, 30)!;
    expect(q.answer).toBe(70);
    await answer(u, q, wrongFor(q));
    await u.click(btn('Build it for 100 gold'));
    expect(screen.getByRole('status')).toHaveTextContent('The Barracks is built. 70% of today\'s work is left.');
    expect(screen.getByRole('status')).toHaveTextContent('Vault: 900 gold');
  });

  it('counts the energy already used today in the question', async () => {
    const u = user();
    show(session((s) => { withPlot(s); empireOf(s.clan).energyUsed = 30; }));
    await toLand(u);
    await u.click(btn(/Plot 1/));
    await u.click(btn('Build Barracks'));
    const q = energyLeft(S, 30, 30)!;
    await answer(u, q, q.answer);
    await u.click(btn('Build it for 100 gold'));
    expect(screen.getByRole('status')).toHaveTextContent('40% of today\'s work is left');
  });

  it('not enough energy: the button is off and says so kindly', async () => {
    const u = user();
    show(session((s) => { withPlot(s); empireOf(s.clan).energyUsed = 80; }));
    await toLand(u);
    await u.click(btn(/Plot 1/));
    expect(btn('Build Barracks')).toBeDisabled();
    expect(screen.getAllByText(/needs 30% of a day's work and only 20% is left today/).length).toBeGreaterThan(0);
  });

  it('a plot that is too small says how many squares it needs; not enough gold says so too', async () => {
    const u = user();
    show(session((s) => { vaultOf(s, 50); empireOf(s.clan).plots.push({ width: 2, length: 2 }); }));
    await toLand(u);
    await u.click(btn(/Plot 1/));
    expect(btn('Build Barracks')).toBeDisabled();
    expect(screen.getAllByText(/needs 15 squares and this plot has 4/).length).toBeGreaterThan(0);
  });

  it('a new day gives the workers their energy back', async () => {
    const s = session((x) => { empireOf(x.clan).energyUsed = 60; });
    expect(empireOf(skipDay(s).clan).energyUsed).toBe(0);
    expect(empireOf(skipDay(s).clan).day).toBe(2);
  });
});
