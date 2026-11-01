import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { hpCost, shopPrice, spCost, trainCost } from '../../../shared/clans/character';
import { CONFIG } from '../../../shared/clans/config';
import { itemAt } from '../../../shared/clans/items';
import type { ItemDef } from '../../../shared/clans/types';
import { discountQuestion, trainingBuy, churchBill } from '../../../shared/clans/moments';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { train, trainOptions, wakeAll, wakeAllCost, wakeAllPayers, wakeMember } from './places';
import { makeClan, newSession, startingDrafts, type Session } from './session';

const SEED = 12345;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();

function session(change: (s: Session) => void = () => {}): Session {
  const s = newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED);
  change(s);
  return s;
}
const show = (s: Session) => render(<ClanQuest seed={SEED} initial={s} />);

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}
const wrongFor = (q: PracticalQuestion) => (q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7);

/** Move the keyboard focus to the control with this name (Tab only), the way a keyboard user would. */
async function tabTo(u: ReturnType<typeof user>, name: string | RegExp) {
  for (let i = 0; i < 120; i++) {
    await u.tab();
    const el = document.activeElement as HTMLElement;
    const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
    if (typeof name === 'string' ? label.trim() === name : name.test(label)) return;
  }
  throw new Error(`Could not tab to ${name}`);
}

describe('the clan page', () => {
  it('shows gear, gold, followers, what is being practised, and links to every place', () => {
    show(session((s) => { s.clan.members[0].gear.weapon = 'Dagger'; s.clan.followers = 7; }));
    expect(screen.getAllByText(/Weapon: /)).toHaveLength(4);
    expect(screen.getByText('Weapon: Dagger')).toBeInTheDocument();
    expect(screen.getByText(/Practising: /)).toBeInTheDocument();
    expect(screen.getByText(/Followers:/)).toHaveTextContent('Followers: 7');
    for (const name of ['Go to the Mines', 'The Market', 'The Training Hall', 'The Church']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
  });

  it('the test buttons give gold, points and knock-outs', async () => {
    const u = user();
    show(session());
    await u.click(screen.getByRole('button', { name: /Give 500 gold \(test only\)/ }));
    expect(screen.getAllByText(/700 gold/).length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: /Give 12 training points to everyone \(test only\)/ }));
    expect(screen.getAllByText('12 points to spend')).toHaveLength(4);
    await u.click(screen.getByRole('button', { name: /Knock out two members \(test only\)/ }));
    expect(screen.getAllByText('knocked out')).toHaveLength(2);
  });
});

describe('the Market', () => {
  /** The first member's next weapon (tier 2), which a new clan can buy straight away. */
  const firstNext = (s: Session) => itemAt(s.clan.members[0].cls, 'weapon', 2)!;
  const buyName = (s: Session, i: ItemDef, mi = 0) => `Buy the ${i.name} for ${s.clan.members[mi].name}, ${i.price} gold`;

  it('shows a card for each member: what they wear in each slot, the next item up, and what it adds', async () => {
    const u = user();
    const s = session();
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    expect(screen.getAllByRole('article', { name: /'s gear$/ })).toHaveLength(s.clan.members.length);
    const m = s.clan.members[0];
    const card = screen.getByRole('article', { name: `${m.name}'s gear` });
    for (const kind of ['weapon', 'armor', 'shield'] as const) {
      expect(card).toHaveTextContent(itemAt(m.cls, kind, 1)!.name);
      expect(card).toHaveTextContent(itemAt(m.cls, kind, 2)!.name);
    }
    expect(card).toHaveTextContent('(R)');
    expect(screen.getByRole('button', { name: buyName(s, firstNext(s)) })).toBeEnabled();
    expect(screen.queryByText(/Look closely/)).not.toBeInTheDocument();
  });

  it('a right answer to "what is 10% of the price?" takes 10% off, and the member wears the item', async () => {
    const u = user();
    const s = session();
    const it2 = firstNext(s);
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    await u.click(screen.getByRole('button', { name: buyName(s, it2) }));
    const q = discountQuestion(S, it2.price, it2.name)!;
    expect(screen.getByText(q.text)).toBeInTheDocument();
    await answer(u, q, q.answer);
    expect(screen.getByText(/Right!/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Pay and wear it' }));
    const paid = shopPrice(it2, true);
    expect(paid).toBe(it2.price - it2.price / 10);
    expect(screen.getByRole('status')).toHaveTextContent(`${s.clan.members[0].name} is wearing the ${it2.name}. You paid ${paid} gold (${CONFIG.shopDiscount}% off!)`);
    expect(screen.getByRole('region', { name: 'The Market' })).toHaveTextContent(`You have ${CONFIG.startGold - paid} gold`);
    // Tier 3 is next, and the Smithy does not sell it yet.
    expect(screen.getByRole('article', { name: `${s.clan.members[0].name}'s gear` })).toHaveTextContent('Needs the Smithy at level 1');
  });

  it('a wrong answer or "Show me how" still buys it, at the full price', async () => {
    const u = user();
    const s = session();
    const it2 = firstNext(s);
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    await u.click(screen.getByRole('button', { name: buyName(s, it2) }));
    const q = discountQuestion(S, it2.price, it2.name)!;
    await answer(u, q, wrongFor(q));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(q.working[0])).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Pay and wear it' }));
    expect(screen.getByRole('status')).toHaveTextContent(`You paid ${it2.price} gold.`);
    const armour = itemAt(s.clan.members[1].cls, 'armor', 2)!;
    await u.click(screen.getByRole('button', { name: buyName(s, armour, 1) }));
    await u.click(screen.getByRole('button', { name: 'Show me how' }));
    await u.click(screen.getByRole('button', { name: 'Pay and wear it' }));
    expect(screen.getByRole('region', { name: 'The Market' })).toHaveTextContent(`You have ${CONFIG.startGold - it2.price - armour.price} gold`);
  });

  it('says which Smithy level sells the next tiers, and once it does, any tier can be bought from the whole line', async () => {
    const u = user();
    const s = session();
    const m = s.clan.members[0];
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    const card = screen.getByRole('article', { name: `${m.name}'s gear` });
    await u.click(within(card).getAllByRole('button', { name: /^See all/ })[0]);
    const line = screen.getByRole('list', { name: `${m.name}'s weapon line` });
    expect(line.querySelectorAll(':scope > li')).toHaveLength(7);
    expect(line).toHaveTextContent('Needs the Smithy at level 1');
    expect(line).toHaveTextContent('Needs the Smithy at level 6');
  });

  it('skips ahead when the Smithy sells a higher tier and the purse can pay', async () => {
    const u = user();
    const s = session((x) => { x.clan.gold = 5000; x.clan.empire = { ...x.clan.empire!, levels: { ...x.clan.empire!.levels, smithy: 3 } }; x.clan.village.smithy = 3; });
    const m = s.clan.members[0];
    const four = itemAt(m.cls, 'weapon', 4)!;
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    await u.click(within(screen.getByRole('article', { name: `${m.name}'s gear` })).getAllByRole('button', { name: /^See all/ })[0]);
    await u.click(screen.getByRole('button', { name: buyName(s, four) }));
    await u.click(screen.getByRole('button', { name: 'Show me how' }));
    await u.click(screen.getByRole('button', { name: 'Pay and wear it' }));
    expect(screen.getByRole('status')).toHaveTextContent(`${m.name} is wearing the ${four.name}`);
  });

  it('does not let you buy without the gold, and says how much you have', async () => {
    const u = user();
    const s = session((x) => { x.clan.gold = 5; });
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    expect(screen.getByRole('button', { name: buyName(s, firstNext(s)) })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'The Market' })).toHaveTextContent('You have 5 gold');
  });

  it('with percentages switched off there is no question: it just buys at the full price', async () => {
    const u = user();
    const s = session((x) => { x.settings = { ...x.settings, enabledTopics: [] }; });
    const it2 = firstNext(s);
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    await u.click(screen.getByRole('button', { name: buyName(s, it2) }));
    expect(screen.queryByText(/What is 10%/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`You paid ${it2.price} gold.`);
  });

  it('buys with the keyboard alone', async () => {
    const u = user();
    const s = session();
    const it2 = firstNext(s);
    show(s);
    await tabTo(u, 'The Market');
    await u.keyboard('{Enter}');
    await tabTo(u, buyName(s, it2));
    await u.keyboard('{Enter}');
    const q = discountQuestion(S, it2.price, it2.name)!;
    if (q.choices) await tabTo(u, q.choices.find((c) => c.value === q.answer)!.label);
    await u.keyboard(q.choices ? '{Enter}' : `${q.answer}{Enter}`);
    await u.keyboard('{Enter}'); // "Pay and wear it" has the focus
    expect(screen.getByRole('status')).toHaveTextContent(`You paid ${shopPrice(it2, true)} gold`);
  });
});

describe('the Training Hall', () => {
  const withPoints = (n: number) => session((s) => { s.clan.members[0].points = n; });

  it('a wrong answer never blocks: the right result is still bought', async () => {
    const u = user();
    const s = withPoints(12);
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Training Hall' }));
    expect(screen.getAllByRole('button', { name: /Train / }).filter((b) => !(b as HTMLButtonElement).disabled).length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: 'Train Agility' }));
    const t = trainingBuy(S, 12, trainCost('agility', 0))!;
    expect(screen.getByText(t.howMany.text)).toBeInTheDocument();
    await answer(u, t.howMany, wrongFor(t.howMany));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Next question' }));
    expect(screen.getByText(t.leftOver.text)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Show me how' }));
    await u.click(screen.getByRole('button', { name: 'Carry on' }));
    await u.click(screen.getByRole('button', { name: 'Buy 4 (all you can)' }));
    expect(screen.getByText(/trained agility 4 times. 0 points left/)).toBeInTheDocument();
    expect(screen.getByText(/points left\.$/, { selector: 'p[aria-live]' })).toHaveTextContent('Zed has 0 points left');
    expect(t.howMany.answer).toBe(4);
  });

  it('buys one thing, and shows the points left clearly', async () => {
    const u = user();
    show(withPoints(7));
    await u.click(screen.getByRole('button', { name: 'The Training Hall' }));
    await u.click(screen.getByRole('button', { name: 'Train Health' }));
    const t = trainingBuy(S, 7, hpCost(0))!;
    await answer(u, t.howMany, t.howMany.answer);
    await u.click(screen.getByRole('button', { name: 'Next question' }));
    await answer(u, t.leftOver, t.leftOver.answer);
    await u.click(screen.getByRole('button', { name: 'Carry on' }));
    await u.click(screen.getByRole('button', { name: 'Buy 1' }));
    expect(screen.getByText(/trained health once. 5 points left/)).toBeInTheDocument();
  });

  it('disables what a member cannot afford, and members with no points have nothing to buy', async () => {
    const u = user();
    show(withPoints(2));
    await u.click(screen.getByRole('button', { name: 'The Training Hall' }));
    expect(screen.getByRole('button', { name: 'Train Armour' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Train Health' })).toBeEnabled();
    await u.click(screen.getAllByRole('button', { name: /points to spend/ })[1]);
    for (const b of screen.getAllByRole('button', { name: /^Train / })) expect(b).toBeDisabled();
  });

  it('works with the maths topic switched off: no question, just the buy', async () => {
    const u = user();
    const s = withPoints(12);
    s.settings = { ...s.settings, enabledTopics: [] };
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Training Hall' }));
    await u.click(screen.getByRole('button', { name: 'Train Agility' }));
    expect(screen.queryByText(/How many can you buy/)).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Buy 1' }));
    expect(screen.getByText(/9 points left/)).toBeInTheDocument();
  });
});

describe('the Church', () => {
  const out = (n: number, gold = 100) => session((s) => { s.clan.gold = gold; for (let i = 0; i < n; i++) { s.clan.members[i].knockedOut = true; s.clan.members[i].hp = 0; } });

  it('wakes someone free the first time, then charges for the next (even after a wrong answer)', async () => {
    const u = user();
    const s = out(2);
    const [a, b] = s.clan.members;
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Church' }));
    expect(screen.getByText(/The first wake-up today is free/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: `Wake ${a.name}` }));
    expect(screen.getByText(/is awake again. That one was free. 100 gold left/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Carry on' }));
    const q = churchBill(S, [b.level])!;
    await u.click(screen.getByRole('button', { name: `Wake ${b.name}` }));
    expect(screen.getByText(q.text)).toBeInTheDocument();
    await answer(u, q, wrongFor(q));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: `Pay ${q.answer} gold` }));
    expect(screen.getByText(new RegExp(`That cost ${q.answer} gold. ${100 - q.answer} gold left`))).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Carry on' }));
    expect(screen.getByText(/Nobody needs the Church/)).toBeInTheDocument();
  });

  it('"Wake everyone" shows the bill after the free wake-up and charges it', async () => {
    const u = user();
    const s = out(3, 200);
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Church' }));
    const q = churchBill(S, wakeAllPayers(s.clan))!;
    expect(wakeAllPayers(s.clan)).toHaveLength(2);
    await u.click(screen.getByRole('button', { name: /^Wake everyone/ }));
    expect(screen.getByText(q.text)).toBeInTheDocument();
    await answer(u, q, q.answer);
    await u.click(screen.getByRole('button', { name: `Pay ${q.answer} gold` }));
    expect(screen.getByText(new RegExp(`Everyone is awake again. That cost ${q.answer} gold. ${200 - q.answer} gold left`))).toBeInTheDocument();
  });

  it('says so kindly when there is not enough gold', async () => {
    const u = user();
    const s = out(2, 0);
    s.clan.wakesToday = 1; // today's free wake-up is used
    show(s);
    await u.click(screen.getByRole('button', { name: 'The Church' }));
    for (const m of s.clan.members.slice(0, 2)) expect(screen.getByRole('button', { name: `Wake ${m.name}` })).toBeDisabled();
    expect(screen.getAllByText(/Fights in the Mines earn more/).length).toBeGreaterThan(0);
    expect(screen.getByText(/You can still wake them one at a time/)).toBeInTheDocument();
  });

  it('with nobody knocked out, says everyone is well', async () => {
    const u = user();
    show(session());
    await u.click(screen.getByRole('button', { name: 'The Church' }));
    expect(screen.getByText(/Everyone is awake and well/)).toBeInTheDocument();
  });
});

describe('the rules behind the places (plain functions)', () => {
  it('training lists a price for everything and stops when points run out', () => {
    const s = session((x) => { x.clan.members[0].points = 7; });
    const opts = trainOptions(s.clan.members[0], 0);
    expect(opts.find((o) => o.key === 'agility')).toMatchObject({ cost: 3, most: 2 });
    expect(opts.find((o) => o.key === 'hp')).toMatchObject({ cost: hpCost(0), most: 3 });
    expect(opts.find((o) => o.key === 'charisma')!.most).toBe(1);
    expect(spCost(0)).toBe(CONFIG.spBuy.cost);
    expect(train(s, 0, 'strength', 5)!.clan.members[0].points).toBe(1);
    expect(train(s, 1, 'strength', 1)).toBeNull();
  });

  it('wake everyone goes dearest first, so the free wake-up saves the most', () => {
    const s = session((x) => {
      x.clan.gold = 1000;
      x.clan.members.forEach((m, i) => { m.knockedOut = true; m.level = i + 1; });
    });
    expect(wakeAllPayers(s.clan)).toEqual([3, 2, 1]);
    expect(wakeAllCost(s.clan)).toBe((4 + 3 + 2) * 10);
    const done = wakeAll(s)!;
    expect(done.clan.gold).toBe(1000 - 90);
    expect(done.clan.members.every((m) => !m.knockedOut)).toBe(true);
    expect(wakeAll({ ...s, clan: { ...s.clan, gold: 50 } })).toBeNull();
    expect(wakeMember(s, 0)!.clan.gold).toBe(1000);
  });
});
