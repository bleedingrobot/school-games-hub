import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type ServerState } from '../../../shared/clans/actions';
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
const publicOf = (s: ServerState) => ({ clan: structuredClone(s.clan), seed: s.seed, day: s.day, fightsLeft: s.fightsLeft, fightNo: s.fightNo, raidNo: s.raidNo, examined: s.examined, settings: S });

const knockedOut = (n: number) => (s: ServerState) => { for (let i = 0; i < n; i++) { s.clan.members[i].knockedOut = true; s.clan.members[i].hp = 0; } };

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}

describe('Clan Quest with a server', () => {
  it('opens the clan the server has, without the test strip, and keeps the Mines for the next stage', async () => {
    const { server, box } = fakeServer(madeState());
    render(<ClanQuest server={server} />);
    expect(screen.getByText(/Opening your clan/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Red Banner' })).toBeInTheDocument();
    expect(box.sent).toEqual([{ type: 'load' }]);
    expect(screen.queryByText(/Test settings/)).toBeNull();
    await user().click(btn('Go to the Mines'));
    expect(screen.getByText(/Mine fights are not saved on the server yet/)).toBeInTheDocument();
    expect(btn('Into the Mines!')).toBeDisabled();
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
});
