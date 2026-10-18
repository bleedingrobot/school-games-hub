import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Action } from '../../../shared/clans/actions';
import { applyAction, type ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import { empireOf } from '../../../shared/clans/empire';
import { publicState } from '../../../supabase/functions/clans/handler';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import type { VillageView } from '../../../shared/clans/village';
import { ClanQuest } from './ClanQuest';
import { barracksAndFill, giveGold } from './places';
import type { ClanServer, ServerReply } from './remote';
import { makeClan, newSession, type Session } from './session';

afterEach(cleanup);
const SEED = 777;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const chest = () => screen.getByRole('heading', { name: 'The village chest' }).parentElement!;
const start = (over: (s: Session) => Session = (s) => s) => render(<ClanQuest initial={over(newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED))} />);

describe('the village (test page, with a pretend village)', () => {
  it('shows the class goal as a fraction with a bar, and the chest', async () => {
    const u = user();
    start();
    await u.click(btn('The Village'));
    expect(screen.getByText('Smithy level 1: 120 / 250 gold')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Chest 120 of 250' })).toBeInTheDocument();
    expect(chest()).toHaveTextContent('The chest has 120 gold');
  });

  it('gives gold to the chest from the purse, and cannot give more than there is', async () => {
    const u = user();
    start();
    await u.click(btn('The Village'));
    await u.click(btn('Give 50'));
    expect(chest()).toHaveTextContent('The chest has 170 gold. Your clan purse has 150 gold');
    await u.click(btn('Give 100'));
    expect(btn('Give 100')).toBeDisabled();
    expect(chest()).toHaveTextContent('The chest has 270 gold. Your clan purse has 50 gold');
    expect(btn('Give 50')).toBeEnabled();
    expect(btn('Give 100')).toBeDisabled();
  });

  it('counts a vote once, and moves it when you change your mind', async () => {
    const u = user();
    start();
    await u.click(btn('The Village'));
    await u.click(btn(/Church level 1/));
    expect(btn(/Church level 1/)).toHaveAttribute('aria-pressed', 'true');
    expect(btn(/Church level 1/)).toHaveTextContent('3 votes');
    await u.click(btn(/Church level 1/));
    expect(btn(/Church level 1/)).toHaveTextContent('3 votes');
    await u.click(btn(/Training Hall level 1/));
    expect(btn(/Church level 1/)).toHaveTextContent('2 votes');
    expect(btn(/Training Hall level 1/)).toHaveTextContent('1 vote');
    expect(btn(/Church level 1/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks how much more gold the class needs; a wrong answer blocks nothing and shows the working', async () => {
    const u = user();
    start();
    await u.click(btn('The Village'));
    await u.type(screen.getByLabelText('Gold needed'), '100');
    await u.click(btn('Check'));
    expect(screen.getByText(/250 − 120 = 130/)).toBeInTheDocument();
    await u.click(btn('Give 10'));
    expect(chest()).toHaveTextContent('130 gold');
  });

  it('says yes to the right answer', async () => {
    const u = user();
    start();
    await u.click(btn('The Village'));
    await u.type(screen.getByLabelText('Gold needed'), '130');
    await u.click(btn('Check'));
    expect(screen.getByText(/^Yes!/)).toBeInTheDocument();
  });

  it('builds the winner when the week ends and the chest is big enough, and writes the news', async () => {
    const u = user();
    start();
    await u.click(btn('Pretend classmates give 200 gold (test only)'));
    await u.click(btn('End the village week now (test only)'));
    await u.click(btn('The Village'));
    expect(screen.getByText(/Smithy: level 1 of 6/)).toBeInTheDocument();
    await u.click(btn('Village news'));
    expect(screen.getByText('The class built the Smithy (level 1)!')).toBeInTheDocument();
  });

  it('says how short the chest was when it cannot build', async () => {
    const u = user();
    start();
    await u.click(btn('End the village week now (test only)'));
    await u.click(btn('Village news'));
    expect(screen.getByText('The class voted for the Smithy (level 1) but the chest was 130 gold short.')).toBeInTheDocument();
  });

  it('the Church level gives free wake-ups at the Church', async () => {
    const u = user();
    start((s) => {
      const next = structuredClone(s);
      next.clan.village.church = 2;
      next.clan.members[0].knockedOut = true;
      next.clan.members[1].knockedOut = true;
      next.clan.members[2].knockedOut = true;
      return next;
    });
    await u.click(btn('The Church'));
    expect(screen.getByText(/The first 3 wake-ups today are free/)).toBeInTheDocument();
  });
});

describe('raiding a classmate (test page, with pretend classmates)', () => {
  const army = (s: Session) => barracksAndFill(giveGold(s, 0));
  it('lists who can be raided and why the others cannot', async () => {
    const u = user();
    start(army);
    await u.click(btn('The Empire'));
    await u.click(btn('Raid a classmate'));
    expect(await screen.findByRole('button', { name: /Swift Foxes: a fair match/ })).toBeEnabled();
    expect(btn(/Iron Wolves/)).toBeDisabled();
    expect(screen.getByText(/not a fair match/)).toBeInTheDocument();
    expect(btn(/Lucky Stars/)).toBeDisabled();
    expect(screen.getByText(/brand new and is still protected/)).toBeInTheDocument();
  });

  it('sends the army, shows how it went, and then only allows one raid a day', async () => {
    const u = user();
    start(army);
    await u.click(btn('The Empire'));
    await u.click(btn('Raid a classmate'));
    await u.click(await screen.findByRole('button', { name: /Swift Foxes: a fair match/ }));
    await u.click(btn('Raid the Swift Foxes clan'));
    const result = screen.getByRole('group', { name: 'How it went' });
    expect(within(result).getByRole('heading')).toHaveTextContent('Raid on the Swift Foxes clan');
    expect(within(result).getByText(/shield for a day/)).toBeInTheDocument();
    await u.click(btn('Carry on'));
    expect((await screen.findAllByText(/already raided once today/)).length).toBeGreaterThan(0);
    expect(btn(/Brave Owls/)).toBeDisabled();
  });

  it('is switched off by the teacher', async () => {
    const u = user();
    start((s) => ({ ...army(s), raidsOn: false }));
    await u.click(btn('The Empire'));
    await u.click(btn('Raid a classmate'));
    expect(screen.getByText(/switched raids on classmates off/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// With a server
// ---------------------------------------------------------------------------

const DAY0 = 20_000;
const view = (over: Partial<VillageView> = {}): VillageView => ({ name: 'Room 12', chest: 100, levels: { trainingHall: 0, smithy: 0, church: 0 }, week: 5, votes: {}, myVote: null, clans: 3, ...over });

function made(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: DAY0 });
  if (!out.ok || !out.state) throw new Error('create failed');
  out.state.createdNzDay = DAY0 - 14;
  out.state.day = 15;
  const e = empireOf(out.state.clan);
  e.day = 15;
  e.troops.footman = 40;
  e.vault = 500;
  return out.state;
}
const defender = () => ({ id: 'pid-2', name: 'Swift Foxes', createdNzDay: DAY0 - 14, empire: { ...empireOf(made().clan), vault: 800 } });

/** A server in a box with a village: the real rules, remembering what it was sent. */
function box() {
  const t = { saved: made(), sent: [] as Action[], village: view(), notes: ['A raider from the Swift Foxes clan attacked, and your defenders drove them off!'] };
  const server: ClanServer = {
    async send(action) {
      t.sent.push(action);
      const out = applyAction(t.saved, action, { seed: SEED, today: DAY0, village: t.village, self: 'pid-1', raidsOn: true, target: action.type === 'raidClass' && action.target === 'pid-2' ? defender() : null,
        mates: [{ id: 'pid-2', name: 'Swift Foxes', createdNzDay: DAY0 - 14, shieldUntil: 0, troops: { footman: 40, axeman: 0, knight: 0 } }] });
      const shown = (s: ServerState) => structuredClone(publicState(s, DEFAULT_PRACTICAL_SETTINGS, { news: ['The class built the Smithy (level 1)!'], village: t.village, raidsOn: true, notes: t.notes }));
      if (!out.ok) return { ok: false, why: out.why, say: out.say, seed: SEED, state: shown(t.saved) } satisfies ServerReply;
      if (action.type === 'vote' && out.effects?.vote) t.village = { ...t.village, myVote: out.effects.vote, votes: { [out.effects.vote]: 1 } };
      if (action.type === 'chestGive') t.village = { ...t.village, chest: t.village.chest + (out.result.type === 'chestGive' ? out.result.gold : 0) };
      if (out.changed && out.state) t.saved = out.state;
      return { ok: true, replayed: false, seed: SEED, state: out.state && shown(out.state), result: out.result } satisfies ServerReply;
    },
  };
  return { t, server };
}

describe('the village with a server', () => {
  it('shows the village the server sent, and what raiders did while you were away', async () => {
    const u = user();
    const { server } = box();
    render(<ClanQuest server={server} />);
    expect(await screen.findByText('While you were away')).toBeInTheDocument();
    expect(screen.getByText(/Swift Foxes clan attacked/)).toBeInTheDocument();
    await u.click(btn('The Village'));
    expect(screen.getByText('Smithy level 1: 100 / 250 gold')).toBeInTheDocument();
  });

  it('sends a gift and a vote as actions, and shows what the server answered', async () => {
    const u = user();
    const { server, t } = box();
    render(<ClanQuest server={server} />);
    await u.click(await screen.findByRole('button', { name: 'The Village' }));
    await u.click(btn('Give 50'));
    await u.click(btn(/Church level 1/));
    expect(t.sent).toEqual([{ type: 'load' }, { type: 'chestGive', gold: 50 }, { type: 'vote', kind: 'church' }]);
    expect(t.saved.clan.gold).toBe(150);
    expect(chest()).toHaveTextContent('The chest has 150 gold. Your clan purse has 150 gold');
    expect(btn(/Church level 1/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks the server who can be raided, sends the raid, and shows the answer', async () => {
    const u = user();
    const { server, t } = box();
    render(<ClanQuest server={server} />);
    await u.click(await screen.findByRole('button', { name: 'The Empire' }));
    await u.click(btn('Raid a classmate'));
    await u.click(await screen.findByRole('button', { name: /Swift Foxes: a fair match/ }));
    await u.click(btn('Raid the Swift Foxes clan'));
    const result = await screen.findByRole('group', { name: 'How it went' });
    expect(within(result).getByRole('heading')).toHaveTextContent('Raid on the Swift Foxes clan');
    expect(t.sent.map((a) => a.type)).toEqual(['load', 'raidTargets', 'raidClass']);
    expect(t.sent[2]).toMatchObject({ type: 'raidClass', target: 'pid-2', take: 'gold' });
    expect(empireOf(t.saved.clan).raidsToday).toBe(1);
  });
});
