import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type Context, type OpenFight, type ServerState } from '../../../shared/clans/actions';
import { replayFight } from '../../../shared/clans/battleCry';
import { fightSeed } from '../../../shared/clans/play';
import { publicState } from '../../../supabase/functions/clans/handler';
import { startingDrafts } from '../../../shared/clans/create';
import { empireOf } from '../../../shared/clans/empire';
import { churchBill } from '../../../shared/clans/moments';
import { buildPuzzle, todaysQuest } from '../../../shared/clans/quests';
import { parseFocus } from '../../../shared/maths/focus';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import type { Question } from '../../../shared/maths/skillPack';
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
function fakeServer(start: ServerState | null, wrap?: (action: Action, next: () => ServerReply) => ServerReply | Promise<ServerReply>, over: Partial<Context> = {}) {
  const box = { saved: start, sent: [] as Action[] };
  const server: ClanServer = {
    async send(action) {
      box.sent.push(action);
      const real = (): ServerReply => {
        const out = applyAction(box.saved, action, { seed: SEED, today: DAY0, ...over });
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
    const dflt = () => screen.queryAllByRole('button', { name: /Fight with this plan/ })[0];

    /** Click through one or more rounds with the suggested plan. */
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

  describe('ladder fights (Battle Cry questions from the child\'s own maths)', () => {
    const maths = { maths: { facts: [], settings: { enabledTables: [2, 5, 10] }, focus: parseFocus(null) } };
    const ladderServer = () => fakeServer(madeState(), undefined, maths);
    const storedQuestion = (box: { saved: ServerState | null }, round: number) => (box.saved!.fight as OpenFight).questions![round - 1] as Question;
    const dialog = () => screen.findByRole('dialog', { name: 'Battle Cry!' }, { timeout: 3000 });

    async function type(u: ReturnType<typeof user>, q: Question, value: number) {
      const i = q.choices?.indexOf(value) ?? -1;
      // Choice buttons are named as they are spoken ("7 tenths"), so press the right one by its place.
      if (q.choices && i >= 0) return u.click(screen.getByRole('dialog', { name: 'Battle Cry!' }).querySelectorAll<HTMLButtonElement>('.question__choice')[i]);
      await u.keyboard(String(value));
      await u.keyboard('{Enter}');
    }
    async function intoTheMines(u: ReturnType<typeof user>) {
      await screen.findByRole('heading', { name: 'Red Banner' });
      await u.click(btn('Go to the Mines'));
      await u.click(btn('Into the Mines!'));
    }

    it('asks for a ladder fight, has the server mark a right answer, then lets the child spend it', async () => {
      const { server, box } = ladderServer();
      const u = user();
      render(<ClanQuest server={server} />);
      await intoTheMines(u);
      expect(box.sent.find((a) => a.type === 'fightStart')).toMatchObject({ ladder: true });
      await dialog();
      const q = storedQuestion(box, 1);
      // The question the server made, as a screen reader hears it.
      expect(screen.getByLabelText(q.spoken)).toBeInTheDocument();
      await type(u, q, q.answer);
      expect(await screen.findByText(/Correct!/)).toBeInTheDocument();
      expect(box.sent.find((a) => a.type === 'cryCheck')).toMatchObject({ type: 'cryCheck', round: 1, answer: q.answer });
      await u.click(await screen.findByRole('button', { name: /More damage this round/ }, { timeout: 3000 }));
      await u.click(dflt());
      for (let i = 0; i < 8 && !box.sent.some((a) => a.type === 'fightRound'); i++) if (dflt()) await u.click(dflt());
      await waitFor(() => expect(box.sent.find((a) => a.type === 'fightRound')).toMatchObject({ round: 1, cry: { answer: q.answer, reward: 'damage' } }));
      // The server kept the mark with the fight (unless that round already ended it).
      const kept = box.saved!.fight as OpenFight | null;
      if (kept) expect(kept.marks?.[0]).toEqual({ answer: q.answer, correct: true });
    });

    it('shows the right answer after a wrong one and carries on with no bonus; "No thanks" sends nothing to mark', async () => {
      const { server, box } = ladderServer();
      const u = user();
      render(<ClanQuest server={server} />);
      await intoTheMines(u);
      await dialog();
      const q = storedQuestion(box, 1);
      const wrong = q.choices?.find((c) => c !== q.answer) ?? q.answer + 1;
      await type(u, q, wrong);
      expect(await screen.findByText(/The answer was/)).toBeInTheDocument();
      // After the pause the orders come.
      await waitFor(() => expect(dflt()).toBeTruthy(), { timeout: 4000 });
      for (let i = 0; i < 8 && !box.sent.some((a) => a.type === 'fightRound'); i++) if (dflt()) await u.click(dflt());
      await waitFor(() => expect(box.sent.find((a) => a.type === 'fightRound')).toMatchObject({ round: 1, cry: { answer: wrong } }));
      // Round 2: "No thanks".
      if (box.saved!.fight) {
        await dialog();
        await u.click(btn('No thanks'));
        expect(box.sent.filter((a) => a.type === 'cryCheck')).toHaveLength(1);
      }
    });

    it('does not ask an answered question again after a refresh: it carries on from the server\'s mark', async () => {
      const { server, box } = ladderServer();
      const u = user();
      const first = render(<ClanQuest server={server} />);
      await intoTheMines(u);
      await dialog();
      const q = storedQuestion(box, 1);
      await type(u, q, q.answer);
      await screen.findByRole('button', { name: /More damage this round/ }, { timeout: 3000 });
      // Reloaded before the power-up was picked.
      first.unmount();
      cleanup();
      render(<ClanQuest server={server} />);
      expect(await screen.findByRole('button', { name: /More damage this round/ })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Battle Cry!' })).toBeNull();
      expect(box.sent.filter((a) => a.type === 'cryCheck')).toHaveLength(1);
      await u.click(btn(/More damage this round/));
      for (let i = 0; i < 8 && !box.sent.some((a) => a.type === 'fightRound'); i++) if (dflt()) await u.click(dflt());
      await waitFor(() => expect(box.sent.find((a) => a.type === 'fightRound')).toMatchObject({ round: 1, cry: { answer: q.answer, reward: 'damage' } }));
    });

    it('picks a ladder fight up again after a refresh, with the same log, and never sends answers to the page', async () => {
      const { server, box } = ladderServer();
      const u = user();
      const first = render(<ClanQuest server={server} />);
      await intoTheMines(u);
      await dialog();
      const q = storedQuestion(box, 1);
      await type(u, q, q.answer);
      await u.click(await screen.findByRole('button', { name: /A little healing/ }, { timeout: 3000 }));
      for (let i = 0; i < 8 && !box.sent.some((a) => a.type === 'fightRound'); i++) if (dflt()) await u.click(dflt());
      await waitFor(() => expect((box.saved!.fight as OpenFight | null)?.rounds.length ?? 1).toBe(1));
      if (!box.saved!.fight) return;
      const logBefore = screen.getByRole('list', { name: 'Fight log' }).textContent;
      first.unmount();
      cleanup();
      const reply = await server.send({ type: 'load' });
      // The page is given what to show of each question, never its answer (the child's own answers and marks are fine).
      expect(JSON.stringify(reply.state?.fight?.questions)).not.toMatch(/"answer"|"factKey"|"params"/);
      render(<ClanQuest server={server} />);
      expect(await screen.findByText(/A fight begins!/)).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Fight log' }).textContent).toBe(logBefore);
      // The next round's question is waiting.
      await dialog();
    });
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

describe('member looks with a server (Clans art Stage A.5)', () => {
  it('"Change look" shows the four paintings, and the pick is saved on the server', async () => {
    const { server, box } = fakeServer(madeState());
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    const card = screen.getByRole('article', { name: box.saved!.clan.members[1].name });
    await u.click(within(card).getByRole('button', { name: 'Change look' }));
    const picker = within(card).getByRole('group', { name: 'Look' });
    expect(within(picker).getAllByRole('button')).toHaveLength(4);
    const other = box.saved!.clan.members[1].look === 'male-2' ? 'Boy 1' : 'Boy 2';
    await u.click(within(picker).getByRole('button', { name: other }));
    expect(within(picker).getByRole('button', { name: other })).toHaveAttribute('aria-pressed', 'true');
    const look = other === 'Boy 1' ? 'male-1' : 'male-2';
    expect(box.sent.filter((x) => x.type === 'look')).toEqual([{ type: 'look', member: 1, look }]);
    await waitFor(() => expect(box.saved!.clan.members[1].look).toBe(look));
  });

  it('a clan saved before looks existed still shows a painting for every member', async () => {
    const { server } = fakeServer(madeState((s) => { for (const m of s.clan.members) delete m.look; }));
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    expect(document.querySelectorAll('.cq-card .cq-portrait--painted img')).toHaveLength(4);
  });
});
