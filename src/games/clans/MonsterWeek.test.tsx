/**
 * The season monster's screens: the button in monster week, the calm warning before it, supplies in the Market, the siege question
 * and what is sent for it, the re-pick after a new season, and a monster fight booting from an open fight.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, monsterSeed, type Action, type OpenFight, type ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import { nzDayNumber } from '../../../shared/clans/clock';
import { CONFIG } from '../../../shared/clans/config';
import { siegeQuestion, supplyPrice } from '../../../shared/clans/monster';
import type { SeasonClock } from '../../../shared/clans/season';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { publicFight, publicState } from '../../../supabase/functions/clans/handler';
import { ClanQuest } from './ClanQuest';
import { Fight } from './Fight';
import { MonsterResult } from './MonsterWeek';
import type { ClanServer, ServerReply } from './remote';
import { newSession } from './session';

afterEach(cleanup);
const SEED = 4242;
const DAY0 = 20_000;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const clock = (day: number, over: Partial<SeasonClock> = {}): SeasonClock => ({ number: 1, day, daysLeft: 35 - day, clockOn: true, ...over });

function madeState(change: (s: ServerState) => void = () => {}): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: DAY0 });
  if (!out.ok || !out.state) throw new Error('create failed');
  change(out.state);
  return out.state;
}

/** A server in a box: the real rules, saved in memory, on a given day of the season, remembering what it was sent. */
function fakeServer(day: number, change: (s: ServerState) => void = () => {}, over: Partial<SeasonClock> = {}) {
  const now = clock(day, over);
  const box = { saved: madeState(change) as ServerState, sent: [] as Action[] };
  const publicOf = (s: ServerState) => structuredClone({ ...publicState(s, S, { news: [] }), clock: now });
  const server: ClanServer = {
    async send(action) {
      box.sent.push(action);
      const out = applyAction(box.saved, action, { seed: SEED, today: DAY0, clock: now });
      if (!out.ok) return { ok: false, why: out.why, say: out.say, seed: SEED, state: publicOf(box.saved) } as ServerReply;
      if (out.changed) box.saved = out.state!;
      return { ok: true, replayed: false, seed: SEED, state: out.state && publicOf(out.state), result: out.result } as ServerReply;
    },
  };
  return { box, server };
}

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}

describe('the monster on the clan page', () => {
  it('has the Monster button only in monster week', async () => {
    const { server } = fakeServer(CONFIG.season.monsterFrom - 1);
    render(<ClanQuest server={server} />);
    await screen.findByRole('region', { name: 'Your clan' });
    expect(screen.queryByRole('button', { name: /The Monster/ })).toBeNull();
    cleanup();
    render(<ClanQuest server={fakeServer(CONFIG.season.monsterFrom).server} />);
    await screen.findByRole('region', { name: 'Your clan' });
    expect(btn('The Monster')).toBeInTheDocument();
    cleanup();
    render(<ClanQuest server={fakeServer(CONFIG.season.monsterFrom, undefined, { clockOn: false }).server} />);
    await screen.findByRole('region', { name: 'Your clan' });
    expect(screen.queryByRole('button', { name: /The Monster/ })).toBeNull();
  });

  it('warns calmly in the weeks before, with the name, the days left and the day\'s sign', async () => {
    render(<ClanQuest server={fakeServer(25).server} />);
    const panel = await screen.findByRole('group', { name: 'The monster is coming' });
    expect(within(panel).getByText('Grimmor the Storm Giant arrives in 4 days.')).toBeInTheDocument();
    expect(within(panel).getByText('Giant footprints were found by the river.', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /The Monster/ })).toBeNull();
    cleanup();
    render(<ClanQuest server={fakeServer(10).server} />);
    await screen.findByRole('region', { name: 'Your clan' });
    expect(screen.queryByRole('group', { name: 'The monster is coming' })).toBeNull();
    cleanup();
    render(<ClanQuest server={fakeServer(30).server} />);
    await screen.findByRole('region', { name: 'Your clan' });
    expect(screen.queryByRole('group', { name: 'The monster is coming' })).toBeNull();
  });

  it('shows the practice button with no server, marked Practice', async () => {
    const u = user();
    render(<ClanQuest initial={newSession({ ...madeState().clan }, SEED)} />);
    await u.click(btn('The Monster (practice)'));
    expect(screen.getByText('Practice.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grimmor the Storm Giant' })).toBeInTheDocument();
  });

  it('plays the siege and the fight locally as Practice', async () => {
    const u = user();
    render(<ClanQuest initial={newSession({ ...madeState().clan }, SEED)} />);
    await u.click(btn('The Monster (practice)'));
    await u.click(btn('Fight!'));
    await u.click(btn('No thanks'));
    await u.click(btn('Next round'));
    await u.click(btn('Next round'));
    await u.click(btn('Into the fight!'));
    expect(await screen.findByRole('region', { name: 'The fight' })).toBeInTheDocument();
    expect(screen.getByText('Grimmor the Storm Giant')).toBeInTheDocument();
  });
});

describe('monster supplies in the Market', () => {
  it('are on sale from day 22 and not before', async () => {
    const u = user();
    render(<ClanQuest server={fakeServer(21).server} />);
    await u.click(await screen.findByRole('button', { name: 'The Market' }));
    expect(screen.queryByRole('region', { name: 'Monster supplies' })).toBeNull();
    cleanup();
    render(<ClanQuest server={fakeServer(22).server} />);
    await u.click(await screen.findByRole('button', { name: 'The Market' }));
    const shelf = screen.getByRole('region', { name: 'Monster supplies' });
    for (const word of ['Fire arrows', 'Healing potions', 'Giant nets']) expect(within(shelf).getByText(word)).toBeInTheDocument();
    expect(within(shelf).getByText(/You have 0 of 3/)).toBeInTheDocument();
  });

  it('are bought with the bill checked first, and sent to the server', async () => {
    const u = user();
    const { server, box } = fakeServer(25, (s) => { s.clan.gold = 5000; });
    render(<ClanQuest server={server} />);
    await u.click(await screen.findByRole('button', { name: 'The Market' }));
    await u.click(btn(`Buy a fire arrow for ${supplyPrice('arrows')} gold`));
    // The same "check the bill" moment as an item; "Show me how" carries on without a gate.
    const asked = screen.queryByRole('button', { name: 'Show me how' });
    if (asked) {
      await u.click(asked);
      await u.click(btn(`Pay ${supplyPrice('arrows')} gold`));
    }
    expect(box.sent).toContainEqual({ type: 'buySupply', kind: 'arrows', count: 1 });
    expect(await screen.findByText(/You have 1 of 3/)).toBeInTheDocument();
    expect(box.saved.clan.gold).toBe(5000 - supplyPrice('arrows'));
  });
});

describe('a monster try', () => {
  const toQuestion = async (u: ReturnType<typeof user>, day = CONFIG.season.monsterFrom) => {
    const f = fakeServer(day);
    render(<ClanQuest server={f.server} />);
    await u.click(await screen.findByRole('button', { name: 'The Monster' }));
    return f;
  };

  it('shows the monster, the tries and what the village will do', async () => {
    const u = user();
    await toQuestion(u);
    expect(screen.getByRole('heading', { name: 'The Monster' })).toBeInTheDocument();
    expect(screen.getByText('Tries this season:', { exact: false })).toHaveTextContent('Tries this season: 0');
    expect(screen.getByText('You have not beaten Grimmor yet.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'What your village will do' })).toHaveTextContent(/knock about \d+% off/);
    expect(btn('Fight!')).toBeEnabled();
  });

  it('asks the siege question first and sends monsterStart with the answer, then plays the siege and goes into the fight', async () => {
    const u = user();
    const { box } = await toQuestion(u);
    const q = siegeQuestion(monsterSeed(SEED, 1, 0), S)!;
    await u.click(btn('Fight!'));
    expect(screen.getByRole('heading', { name: 'The siege!' })).toBeInTheDocument();
    expect(screen.getByText(q.text)).toBeInTheDocument();
    await answer(u, q, q.answer);
    expect(box.sent.find((a) => a.type === 'monsterStart')).toEqual({ type: 'monsterStart', siege: q.answer, ladder: true });
    expect(await screen.findByText(/Round 1\./)).toBeInTheDocument();
    await u.click(btn('Next round'));
    await u.click(btn('Next round'));
    expect(screen.getByText('Your answer was right, so the village hit 20% harder!')).toBeInTheDocument();
    await u.click(btn('Into the fight!'));
    expect(await screen.findByRole('region', { name: 'The fight' })).toBeInTheDocument();
    expect(screen.getByText('Grimmor the Storm Giant')).toBeInTheDocument();
  });

  it('sends no answer for "No thanks"', async () => {
    const u = user();
    const { box } = await toQuestion(u);
    await u.click(btn('Fight!'));
    await u.click(btn('No thanks'));
    expect(await screen.findByText(/Round 1\./)).toBeInTheDocument();
    expect(box.sent.find((a) => a.type === 'monsterStart')).toEqual({ type: 'monsterStart', siege: null, ladder: true });
    expect(screen.queryByText(/Your answer was right/)).toBeNull();
  });

  it('tells a clan that has had its try today, before the question, and shows how tired the monster is', async () => {
    const u = user();
    const f = fakeServer(CONFIG.season.monsterFrom, (s) => {
      s.clan.monster = { season: 1, tries: 1, losses: 1, lastDay: nzDayNumber(Date.now()), supplies: { arrows: 0, potions: 0, net: 0 } };
    });
    render(<ClanQuest server={f.server} />);
    await u.click(await screen.findByRole('button', { name: 'The Monster' }));
    expect(screen.getByText('You have had your try today. Come back tomorrow!')).toBeInTheDocument();
    expect(btn('Fight!')).toBeDisabled();
    expect(screen.getByText('10% weaker')).toBeInTheDocument();
  });
});

describe('after a try', () => {
  const session = () => {
    const s = newSession(madeState().clan, SEED);
    s.clan.monster = { season: 1, tries: 2, losses: 2, lastDay: 1, supplies: { arrows: 0, potions: 0, net: 0 } };
    return s;
  };
  it('says what the clan keeps after a first win, in gentle words', () => {
    render(<MonsterResult outcome={{ kind: 'giant', season: 1, won: true, first: true, tries: 3 }} session={{ ...session(), clock: clock(30) }} />);
    expect(screen.getByText('Grimmor stomps off back to the mountains for good!')).toBeInTheDocument();
    expect(screen.getByText(/You keep Grimmor's club/)).toHaveTextContent('+100 fame');
  });
  it('says how much weaker it will be tomorrow after a loss', () => {
    render(<MonsterResult outcome={{ kind: 'giant', season: 1, won: false, first: false, tries: 2 }} session={session()} />);
    expect(screen.getByText('Grimmor stomps off for the night. He will be back tomorrow.')).toBeInTheDocument();
    expect(screen.getByText('20% weaker')).toBeInTheDocument();
  });
});

describe('re-picking after a new season', () => {
  const repick = (s: ServerState) => { s.clan.season = 1; s.clan.repick = 1; };

  it('shows the re-pick screen instead of home, sends each change, and "Keep going" goes home', async () => {
    const u = user();
    const { server, box } = fakeServer(1, repick);
    render(<ClanQuest server={server} />);
    expect(await screen.findByRole('heading', { name: 'A new season!' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your clan' })).toBeNull();
    const first = screen.getAllByRole('combobox', { name: 'Class' })[0];
    const other = within(first).getAllByRole('option').map((o) => o.textContent!).find((c) => c !== (first as HTMLSelectElement).value)!;
    await u.selectOptions(first, other);
    const sent = box.sent.find((a) => a.type === 'repick');
    expect(sent).toMatchObject({ type: 'repick', member: 0, cls: other });
    await u.click(btn('Keep going'));
    expect(box.sent.at(-1)).toEqual({ type: 'repickDone' });
    expect(await screen.findByRole('region', { name: 'Your clan' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A new season!' })).toBeNull();
  });

  it('shows home as usual when there is nothing to re-pick', async () => {
    render(<ClanQuest server={fakeServer(1).server} />);
    expect(await screen.findByRole('region', { name: 'Your clan' })).toBeInTheDocument();
  });
});

describe('the monster fight', () => {
  /** A monster try started by the real rules, with healing potions, and a clan that will last a few rounds. */
  const started = (potions: number): ServerState => {
    const state = madeState((s) => {
      for (const m of s.clan.members) { m.maxHp = 5000; m.hp = 5000; }
      s.clan.monster = { season: 1, tries: 0, losses: 0, lastDay: 0, supplies: { arrows: 0, potions, net: 0 } };
    });
    const go = applyAction(state, { type: 'monsterStart', siege: null }, { seed: SEED, today: DAY0, clock: clock(CONFIG.season.monsterFrom) });
    if (!go.ok || !go.state) throw new Error('monsterStart failed');
    return go.state;
  };
  const toPlan = async (state: ServerState, rounds = 0) => {
    const fight = structuredClone(state.fight as OpenFight);
    const guard = state.clan.members.map(() => ({ action: 'guard' as const }));
    for (let i = 0; i < rounds; i++) fight.rounds.push({ orders: guard, cry: null });
    const u = user();
    render(<Fight session={newSession(state.clan, SEED)} open={publicFight(fight)} onFinish={() => {}} />);
    const no = screen.queryByRole('button', { name: 'No thanks' });
    if (no) {
      await u.click(no);
      await u.keyboard('{Enter}');
    }
    await screen.findByRole('group', { name: 'The plan for this round' });
    return u;
  };

  it('boots from an open fight with a monster setup: the monster, its big HP bar, and the rounds out of 12', async () => {
    await toPlan(started(0));
    expect(screen.getByText('Grimmor the Storm Giant')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Grimmor the Storm Giant' })).toBeInTheDocument();
    const hp = within(screen.getByRole('list', { name: 'Enemies' })).getByRole('img', { name: /^HP \d+ of \d+$/ });
    expect(Number(/of (\d+)/.exec(hp.getAttribute('aria-label')!)![1])).toBeGreaterThan(1000);
    expect(screen.getByText(/Round 1 of 12/)).toBeInTheDocument();
    expect(screen.queryByText(/Healing potion/)).toBeNull();
  });

  it('offers a healing potion order (key P) when the clan has potions, and puts it in the plan', async () => {
    const u = await toPlan(started(2));
    await u.keyboard('1');
    expect(btn(/Healing potion/)).toBeInTheDocument();
    await u.keyboard('p');
    await u.keyboard('2');
    expect(screen.getByRole('button', { name: /Change .*: Healing potion for / })).toBeInTheDocument();
  });

  it('warns kindly when the big move is coming next round', async () => {
    await toPlan(started(0), 2);
    const warning = screen.getAllByRole('status').find((el) => el.className === 'cq-warning')!;
    expect(warning).toHaveTextContent('Grimmor lifts a boulder! The big move comes next round. Guard to take half the damage!');
  });
});
