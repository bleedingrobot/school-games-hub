import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Action, ServerState } from '../../../shared/clans/actions';
import { applyAction } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import { publicState } from '../../../supabase/functions/clans/handler';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { Scoreboard } from './Scoreboard';
import { Results } from './Mines';
import { makeClan, newSession } from './session';
import type { ClanServer, ServerReply } from './remote';
import type { ScoreRow } from './fame';

const SEED = 4242;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const fresh = () => newSession(makeClan('Red Banner', startingDrafts(SEED)), SEED);

describe('fame, the scoreboard and achievements on the test page', () => {
  it('shows the pretend clans and you, and moves you up when you earn fame', async () => {
    const u = user();
    render(<ClanQuest initial={fresh()} />);
    await u.click(btn('Scoreboard'));
    const table = screen.getByRole('table');
    expect(within(table).getByText('Swift Foxes')).toBeInTheDocument();
    expect(within(table).getByText(/Red Banner/)).toBeInTheDocument();
    expect(within(table).getByText(/\(you\)/)).toBeInTheDocument();
    await u.click(btn('Back to the clan'));
    await u.click(btn('Give 10 fame (test only)'));
    expect(screen.getByText(/Fame:/).textContent).toContain('10');
    await u.click(btn('Scoreboard'));
    const mine = screen.getByText(/\(you\)/).closest('tr')!;
    expect(within(mine).getAllByRole('cell').map((c) => c.textContent)).toEqual(['10', '10']);
  });

  it('celebrates an achievement, lists all eight, and does not celebrate again', async () => {
    const u = user();
    render(<ClanQuest initial={fresh()} />);
    expect(screen.queryByText(/New achievement/)).toBeNull();
    await u.click(btn('Earn the next achievement (test only)'));
    const note = screen.getByText(/New achievement!/).closest('div')!;
    expect(note).toHaveTextContent('First win');
    expect(note).toHaveTextContent('+10 points each');
    await u.click(btn('Great!'));
    expect(screen.queryByText(/New achievement/)).toBeNull();
    await u.click(btn(/Achievements \(1 of 8\)/));
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    expect(within(list).getByText(/First win/).closest('li')).toHaveTextContent('Earned!');
    expect(within(list).getByText(/Boss beaten/).closest('li')).toHaveTextContent('Not yet');
  });

  it('starts a new season: fame goes to 0 and the clan and achievements stay', async () => {
    const u = user();
    render(<ClanQuest initial={fresh()} />);
    await u.click(btn('Beat a boss: 5 fame and an achievement (test only)'));
    expect(screen.getByText(/Fame:/).textContent).toContain('5');
    await u.click(btn('Start a new season: fame back to 0 (test only)'));
    expect(screen.getByText(/Fame:/).textContent).toMatch(/Fame:\s*0\s*\(season 2\)/);
    expect(screen.getByRole('heading', { name: 'Red Banner' })).toBeInTheDocument();
    expect(btn(/Achievements \(\d+ of 8\)/).textContent).not.toContain('(0 of 8)');
  });
});

describe('the scoreboard with a server', () => {
  const session = { ...fresh(), fame: 12, season: 3 };

  it('shows what the database gives: clan names and fame, you marked', async () => {
    const rows: ScoreRow[] = [{ place: 1, name: 'Blue Fox', fame: 90, isMe: false }, { place: 2, name: 'Red Banner', fame: 12, isMe: true }];
    render(<Scoreboard session={session} load={async () => rows} onBack={() => {}} />);
    expect(await screen.findByText('Blue Fox')).toBeInTheDocument();
    expect(screen.getByText(/Season 3/)).toBeInTheDocument();
    const mine = screen.getByText(/\(you\)/).closest('tr')!;
    expect(mine).toHaveAttribute('aria-current', 'true');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Place', 'Clan', 'Fame']);
    cleanup();
  });

  it('says so, kindly, when it cannot be loaded', async () => {
    render(<Scoreboard session={session} load={async () => { throw new Error('down'); }} onBack={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load the scoreboard");
  });
});

describe('the results screen', () => {
  const summary = { result: 'won' as const, gold: 40, followers: 3, xp: [5, 5, 5, 5], levels: [0, 0, 0, 0] };
  it('says how much fame a win earned', () => {
    render(<Results summary={summary} members={fresh().clan.members} fame={5} onDone={() => {}} />);
    expect(screen.getByText(/Fame:/).textContent).toContain('+5');
    cleanup();
    render(<Results summary={{ ...summary, result: 'lost' }} members={fresh().clan.members} onDone={() => {}} />);
    expect(screen.queryByText(/Fame:/)).toBeNull();
  });
  it('offers Back to the Mines only when another fight is possible', () => {
    render(<Results summary={summary} members={fresh().clan.members} onDone={() => {}} onMines={() => {}} />);
    expect(screen.getByRole('button', { name: 'Back to the Mines' })).toBeTruthy();
    cleanup();
    render(<Results summary={summary} members={fresh().clan.members} onDone={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Back to the Mines' })).toBeNull();
  });
});

describe('achievements from the server', () => {
  function stateWith(extra: { fame: number; achievements: string[]; season?: number }): ServerState & { extra: typeof extra } {
    const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: 20_000 });
    if (!out.ok || !out.state) throw new Error('create failed');
    return Object.assign(out.state, { extra });
  }

  it('does not celebrate the ones already earned when the game opens, but celebrates a new one and shows fame', async () => {
    const box = stateWith({ fame: 7, achievements: ['cq-first-win'] });
    const shown = (s: typeof box) => structuredClone(publicState(s, DEFAULT_PRACTICAL_SETTINGS, { news: [], village: { name: 'Room 12', chest: 100, levels: { trainingHall: 0, smithy: 0, church: 0 }, week: 1, votes: {}, myVote: null, clans: 3 } }, { settings: { enabledTopics: [], yearBand: 5, enabledTables: [], fightsPerDay: 6, season: 2 }, ...s.extra }));
    const server: ClanServer = {
      async send(action: Action): Promise<ServerReply> {
        if (action.type === 'chestGive') box.extra = { fame: 12, achievements: ['cq-first-win', 'cq-village'] };
        return { ok: true, replayed: false, seed: SEED, state: shown(box), result: { type: 'load' } };
      },
    };
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    expect(screen.queryByText(/New achievement/)).toBeNull();
    expect(screen.getByText(/Fame:/).textContent).toMatch(/Fame:\s*7\s*\(season 2\)/);
    expect(btn(/Achievements \(1 of 8\)/)).toBeInTheDocument();
    // Something happens on the server that earns one more.
    await u.click(btn('The Village'));
    await u.click(btn('Give 10'));
    expect(await screen.findByText(/New achievement!/)).toBeInTheDocument();
    expect(screen.getByText(/Village builders/)).toBeInTheDocument();
  });
});
