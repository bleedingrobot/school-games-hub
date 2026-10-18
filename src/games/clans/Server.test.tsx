import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type OpenFight, type ServerState } from '../../../shared/clans/actions';
import { replayFight } from '../../../shared/clans/battleCry';
import { fightSeed } from '../../../shared/clans/play';
import { publicState } from '../../../supabase/functions/clans/handler';
import { startingDrafts } from '../../../shared/clans/create';
import { empireOf } from '../../../shared/clans/empire';
import { churchBill } from '../../../shared/clans/moments';
import { buildPuzzle, todaysQuest } from '../../../shared/clans/quests';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { questPuzzle } from './places';
import { sessionFrom, type ClanServer, type ServerReply } from './remote';

const SEED = 4242;
const DAY0 = 20_000;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

function madeState(change: (s: ServerState) => void = () => {}): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: DAY0 });
  if (!out.ok || !out.state) throw new Error('create failed');
  change(out.state);
  return out.state;
}

/** A server in a box: the real rules (applyAction), saved in memory, remembering what it was sent. */
function fakeServer(start: ServerState | null, wrap?: (action: Action, next: () => ServerReply) => ServerReply | Promise<ServerReply>) {
  const box = { saved: start, sent: [] as Action[] };
  const server: ClanServer = {
    async send(action) {
      box.sent.push(action);
      const real = (): ServerReply => {
        const out = applyAction(box.saved, action, { seed: SEED, today: DAY0 });
        if (!out.ok) return { ok: false, why: out.why, say: out.say, seed: SEED, state: box.saved && publicOf(box.saved) };
        if (out.changed) box.saved = out.state;
        return { ok: true, replayed: false, seed: SEED, state: out.state && publicOf(out.state), result: out.result };
      };
      return wrap ? wrap(action, real) : real();
    },
  };
  return { box, server };
}
const publicOf = (s: ServerState) => structuredClone(publicState(s, S, { news: ['One fight was won in the Mines yesterday.'] }));

const knockedOut = (n: number) => (s: ServerState) => { for (let i = 0; i < n; i++) { s.clan.members[i].knockedOut = true; s.clan.members[i].hp = 0; } };

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}

describe('Clan Quest with a server', () => {
  it('opens the clan the server has, without the test strip, and the Mines are open', async () => {
    const { server, box } = fakeServer(madeState());
    render(<ClanQuest server={server} />);
    expect(screen.getByText(/Opening your clan/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Red Banner' })).toBeInTheDocument();
    expect(box.sent).toEqual([{ type: 'load' }]);
    expect(screen.queryByText(/Test settings/)).toBeNull();
    expect(screen.getByText('One fight was won in the Mines yesterday.')).toBeInTheDocument();
    await user().click(btn('Go to the Mines'));
    expect(screen.queryByText(/not saved on the server/)).toBeNull();
    expect(btn('Into the Mines!')).toBeEnabled();
  });

  it('says so, kindly, when the teacher has Clan Quest switched off', async () => {
    const { server } = fakeServer(madeState(), () => { throw Object.assign(new Error('off'), { off: true }); });
    render(<ClanQuest server={server} />);
    expect(await screen.findByText(/isn't switched on yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('makes a new clan on the server from the creator\'s choices (the server\'s seed, not the browser\'s)', async () => {
    const { server, box } = fakeServer(null);
    const u = user();
    render(<ClanQuest seed={1} server={server} />);
    await u.click(await screen.findByRole('button', { name: 'Start the adventure' }));
    expect(await screen.findByRole('button', { name: 'The Church' })).toBeInTheDocument();
    const create = box.sent.find((a) => a.type === 'create')!;
    expect(create).toMatchObject({ type: 'create', name: expect.any(String) });
    expect((create as Extract<Action, { type: 'create' }>).drafts).toHaveLength(4);
    // The first four slots are the ones made from the server's seed.
    expect((create as Extract<Action, { type: 'create' }>).drafts[0].seed).toBe(startingDrafts(SEED)[0].seed);
    expect(box.saved!.seed).toBe(SEED);
    expect(box.saved!.clan.members).toHaveLength(4);
  });

  it('sends each Church visit to the server, which charges the true price even after a wrong answer', async () => {
    const { server, box } = fakeServer(madeState(knockedOut(2)));
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    const [a, b] = box.saved!.clan.members;
    await u.click(btn('The Church'));
    await u.click(btn(`Wake ${a.name}`));
    expect(screen.getByText(/is awake again. That one was free/)).toBeInTheDocument();
    await u.click(btn('Carry on'));
    const q = churchBill(S, [b.level])!;
    await u.click(btn(`Wake ${b.name}`));
    await answer(u, q, q.answer + 3);
    await u.click(btn(`Pay ${q.answer} gold`));
    expect(box.sent.filter((x) => x.type === 'wake')).toEqual([{ type: 'wake', member: 0 }, { type: 'wake', member: 1 }]);
    await waitFor(() => expect(box.saved!.clan.gold).toBe(200 - q.answer));
    expect(box.saved!.clan.members.every((m) => !m.knockedOut)).toBe(true);
  });

  it('moves gold to the vault on the server', async () => {
    const { server, box } = fakeServer(madeState());
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    await u.click(btn('The Empire'));
    await u.click(btn('Put in'));
    expect(box.sent).toContainEqual({ type: 'deposit', gold: 100 });
    await waitFor(() => expect(empireOf(box.saved!.clan).vault).toBe(100));
    expect(box.saved!.clan.gold).toBe(100);
  });

  it('does the quest with the typed answer, and shows what the server paid', async () => {
    const q = todaysQuest(SEED, 1, S)!;
    const { server, box } = fakeServer(madeState((s) => { for (const m of s.clan.members) m.stats.charisma = 20; }));
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    await u.click(btn('Quest'));
    for (let i = 1; i < q.story.length; i++) await u.click(btn('Read on'));
    await u.click(screen.getByRole('button', { name: /^A / }));
    const choice = q.choices[0];
    if (choice.puzzle) {
      const puzzle = buildPuzzle(questPuzzle(sessionFrom(publicOf(box.saved!)), q, 0)!);
      await answer(u, puzzle, puzzle.answer);
      await u.click(btn('See what happens'));
    }
    await waitFor(() => expect(box.sent.some((a) => a.type === 'quest')).toBe(true));
    const sent = box.sent.find((a) => a.type === 'quest') as Extract<Action, { type: 'quest' }>;
    expect(sent.choice).toBe(0);
    if (choice.puzzle) expect(sent.answer).not.toBeNull();
    await waitFor(() => expect(box.saved!.clan.questDay).toBe(1));
    expect(btn('Carry on')).toBeInTheDocument();
  });

  it('shows what the server says when it refuses, and goes back to the clan as the server has it', async () => {
    const { server, box } = fakeServer(madeState(knockedOut(1)), (action, next) =>
      action.type === 'wake' ? { ok: false, why: 'gold', say: 'The Church is closed today.', seed: SEED, state: publicOf(box.saved!) } : next(),
    );
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    await u.click(btn('The Church'));
    await u.click(btn(`Wake ${box.saved!.clan.members[0].name}`));
    expect(await screen.findByText('The Church is closed today.')).toBeInTheDocument();
    expect(box.saved!.clan.members[0].knockedOut).toBe(true);
  });

  it('puts things back, and says so, when the server cannot be reached', async () => {
    let down = false;
    const { server, box } = fakeServer(madeState(knockedOut(1)), (_a, next) => {
      if (down) throw new Error('offline');
      return next();
    });
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    await u.click(btn('The Church'));
    down = true;
    await u.click(btn(`Wake ${box.saved!.clan.members[0].name}`));
    expect(await screen.findByText(/couldn't reach the server, so that didn't happen/)).toBeInTheDocument();
    await u.click(btn('Carry on'));
    expect(screen.getByRole('button', { name: `Wake ${box.saved!.clan.members[0].name}` })).toBeInTheDocument();
  });

  it('offers to try again when the clan cannot be opened', async () => {
    let tries = 0;
    const { server } = fakeServer(madeState(), (_a, next) => {
      if (++tries === 1) throw new Error('offline');
      return next();
    });
    render(<ClanQuest server={server} />);
    const again = await screen.findByRole('button', { name: 'Try again' });
    await user().click(again);
    expect(await screen.findByRole('heading', { name: 'Red Banner' })).toBeInTheDocument();
  });

  describe('mine fights', () => {
    const dflt = () => screen.queryAllByRole('button', { name: /Default action/ })[0];

    /** Click through one or more rounds with the default orders. */
    async function playRounds(u: ReturnType<typeof user>, box: { sent: Action[] }, count: number) {
      const rounds = () => box.sent.filter((a) => a.type === 'fightRound').length;
      const target = rounds() + count;
      for (let i = 0; i < 200 && rounds() < target; i++) {
        if (screen.queryByRole('button', { name: 'See how everyone did' })) return;
        const no = screen.queryByRole('button', { name: 'No thanks' });
        if (no) await u.click(no);
        else if (screen.queryByRole('button', { name: 'Carry on' })) await u.click(btn('Carry on'));
        else await u.click(dflt());
      }
    }

    it('asks the server to start the fight, shows the monsters it picked, and uses one of the day\'s fights', async () => {
      const state = madeState();
      const { server, box } = fakeServer(state);
      const u = user();
      render(<ClanQuest server={server} />);
      await screen.findByRole('heading', { name: 'Red Banner' });
      await u.click(btn('Go to the Mines'));
      await u.click(btn('Into the Mines!'));
      await waitFor(() => expect(box.saved!.fight).not.toBeNull());
      expect(box.sent.filter((a) => a.type === 'fightStart')).toHaveLength(1);
      const open = box.saved!.fight as OpenFight;
      expect(open.seed).toBe(fightSeed(SEED, 0));
      expect(box.saved!.fightsLeft).toBe(7);
      const enemies = replayFight(box.saved!.clan.members, open.depth, open.seed, open.boss, [], open.settings).state.enemies;
      expect(await screen.findByText(new RegExp(enemies[0].name))).toBeInTheDocument();
    });

    it('sends every round, then shows what the server paid when the fight is over', async () => {
      const { server, box } = fakeServer(madeState());
      const u = user();
      render(<ClanQuest server={server} />);
      await screen.findByRole('heading', { name: 'Red Banner' });
      const goldBefore = box.saved!.clan.gold;
      await u.click(btn('Go to the Mines'));
      await u.click(btn('Into the Mines!'));
      await playRounds(u, box, 100);
      await u.click(await screen.findByRole('button', { name: 'See how everyone did' }));
      await waitFor(() => expect(box.saved!.fight).toBeNull());
      const rounds = box.sent.filter((a) => a.type === 'fightRound') as Extract<Action, { type: 'fightRound' }>[];
      expect(rounds.map((r) => r.round)).toEqual(rounds.map((_, i) => i + 1));
      expect(rounds.length).toBeGreaterThan(0);
      const gained = box.saved!.clan.gold - goldBefore;
      expect(await screen.findByText(/Gold:/)).toHaveTextContent(`+${gained}`);
      await u.click(btn('Back to the clan'));
      expect(box.saved!.fightsLeft).toBe(7);
    });

    it('picks the fight up again after a refresh: the same fight, the rounds kept, no extra fight used', async () => {
      const { server, box } = fakeServer(madeState());
      const u = user();
      const first = render(<ClanQuest server={server} />);
      await screen.findByRole('heading', { name: 'Red Banner' });
      await u.click(btn('Go to the Mines'));
      await u.click(btn('Into the Mines!'));
      await playRounds(u, box, 1);
      await waitFor(() => expect((box.saved!.fight as OpenFight).rounds.length).toBeGreaterThan(0));
      const kept = structuredClone(box.saved!.fight);
      const startsBefore = box.sent.filter((a) => a.type === 'fightStart').length;
      first.unmount();
      cleanup();
      // A refresh: a new page opens the clan again.
      render(<ClanQuest server={server} />);
      expect(await screen.findByText(/A fight begins!/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Into the Mines!' })).toBeNull();
      expect(box.sent.filter((a) => a.type === 'fightStart')).toHaveLength(startsBefore);
      expect(box.saved!.fight).toEqual(kept);
      expect(box.saved!.fightsLeft).toBe(7);
      // The rounds already played are in the log again.
      expect(screen.getByText(/^Round 1$/)).toBeInTheDocument();
    });

    it('goes back to the server\'s copy of the fight when it turns a round down', async () => {
      let refused = false;
      const { server, box } = fakeServer(madeState(), (action, next) => {
        if (action.type === 'fightRound' && !refused) {
          refused = true;
          return { ok: false, why: 'stale-round', say: 'That round was already played.', seed: SEED, state: publicOf(box.saved!) };
        }
        return next();
      });
      const u = user();
      render(<ClanQuest server={server} />);
      await screen.findByRole('heading', { name: 'Red Banner' });
      await u.click(btn('Go to the Mines'));
      await u.click(btn('Into the Mines!'));
      await playRounds(u, box, 1);
      expect(await screen.findByText('That round was already played.')).toBeInTheDocument();
      // The fight is shown again from the start, as the server has it (it kept no rounds).
      await waitFor(() => expect(screen.queryAllByText(/^Round \d/).length).toBe(0));
      expect((box.saved!.fight as OpenFight).rounds).toHaveLength(0);
    });

    it('will not start a fight when the day\'s fights are used up', async () => {
      const { server, box } = fakeServer(madeState((s) => { s.fightsLeft = 0; }));
      const u = user();
      render(<ClanQuest server={server} />);
      await screen.findByRole('heading', { name: 'Red Banner' });
      await u.click(btn('Go to the Mines'));
      expect(btn('Into the Mines!')).toBeDisabled();
      expect(box.sent.filter((a) => a.type === 'fightStart')).toHaveLength(0);
    });
  });
});
