import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, type ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import { VILLAGE_TOTAL, empireOf, maxLevel } from '../../../shared/clans/empire';
import type { SeasonClock } from '../../../shared/clans/season';
import { VILLAGE_BUILDINGS } from '../../../shared/clans/types';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import { publicState } from '../../../supabase/functions/clans/handler';
import type { HallRow } from '../../data/clans';
import { ClanQuest } from './ClanQuest';
import { Hall } from './Hall';
import { Scoreboard } from './Scoreboard';
import type { ClanServer, ServerReply } from './remote';
import { makeClan, newSession, type Session } from './session';

afterEach(cleanup);
const SEED = 4242;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const fresh = (change: (s: Session) => void = () => {}) => {
  const s = newSession(makeClan('Red Banner', startingDrafts(SEED)), SEED);
  change(s);
  return s;
};

function madeState(change: (s: ServerState) => void = () => {}): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: 20_000 });
  if (!out.ok || !out.state) throw new Error('create failed');
  change(out.state);
  return out.state;
}
/** A server that answers every action with the same clan (and clock), plus whatever `extra` adds. */
function stillServer(clock: SeasonClock | null, extra: Partial<ServerReply> & Record<string, unknown> = {}, answer?: (type: string) => Record<string, unknown> | null): ClanServer {
  const state = { ...publicState(madeState(), DEFAULT_PRACTICAL_SETTINGS, { news: [], raidsOn: true }), clock };
  return {
    async send(action) {
      const special = answer?.(action.type);
      if (special) return { ok: true, replayed: false, seed: SEED, state, ...special } as unknown as ServerReply;
      return { ok: true, replayed: false, seed: SEED, state, result: { type: 'load' }, ...extra } as unknown as ServerReply;
    },
  };
}
const clock = (day: number, over: Partial<SeasonClock> = {}): SeasonClock => ({ number: 2, day, daysLeft: 35 - day, clockOn: true, ...over });

describe('the village goal in My Village', () => {
  it('shows the progress bar with the numbers', async () => {
    const u = user();
    render(<ClanQuest initial={fresh((s) => { const l = empireOf(s.clan).levels; l.barracks = 3; l.walls = 2; })} />);
    await u.click(btn('My Village'));
    expect(screen.getByText('Village 5 / 39')).toBeInTheDocument();
    expect(screen.getByText('34 levels to go')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Village progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '5');
    expect(bar).toHaveAttribute('aria-valuemax', String(VILLAGE_TOTAL));
    expect(screen.queryByText('Village complete!')).toBeNull();
  });

  it('shows the golden ribbon when every building is at the top', async () => {
    const u = user();
    render(<ClanQuest initial={fresh((s) => { for (const b of VILLAGE_BUILDINGS) empireOf(s.clan).levels[b] = maxLevel(b); })} />);
    await u.click(btn('My Village'));
    expect(screen.getByText('Village complete!')).toBeInTheDocument();
    expect(screen.getByText('Every building is at its top level!')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Village progress' })).toHaveAttribute('aria-valuenow', '39');
  });

  it('shows saved builds and explains them', async () => {
    const u = user();
    render(<ClanQuest initial={fresh((s) => { empireOf(s.clan).buildsSaved = 3; })} />);
    await u.click(btn('My Village'));
    expect(screen.getByText(/Builds left:/)).toHaveTextContent('Builds left: 5 (2 today + 3 saved)');
    expect(screen.getByText("Builds you don't use are saved for later, up to 4.")).toBeInTheDocument();
  });

  it('celebrates once when an upgrade finishes the village', async () => {
    const u = user();
    render(<ClanQuest initial={fresh((s) => {
      s.clan.gold = 5000;
      s.settings = { ...s.settings, enabledTopics: [] };
      for (const b of VILLAGE_BUILDINGS) empireOf(s.clan).levels[b] = maxLevel(b);
      empireOf(s.clan).levels.church = maxLevel('church') - 1;
    })} />);
    await u.click(btn('My Village'));
    expect(screen.queryByRole('dialog', { name: 'Village complete' })).toBeNull();
    await u.click(btn(/^Upgrade Church to level/));
    const dialog = screen.getByRole('dialog', { name: 'Village complete' });
    expect(dialog).toHaveTextContent('Your whole village is built! +50 fame and the Master Builder badge.');
    await u.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Village complete' })).toBeNull();
  });
});

describe('the season on the clan screen', () => {
  it('shows nothing before a season is set', async () => {
    render(<ClanQuest server={stillServer(clock(12, { number: 0 }))} />);
    await screen.findByRole('region', { name: 'Your clan' });
    expect(screen.queryByText(/Season \d+ ·/)).toBeNull();
  });

  it('shows the season and day, without a countdown early on', async () => {
    render(<ClanQuest server={stillServer(clock(12))} />);
    expect(await screen.findByText('Season 2 · day 12 of 35')).toBeInTheDocument();
    expect(screen.queryByText(/New season in/)).toBeNull();
  });

  it('counts down kindly in the last two weeks when the clock is on', async () => {
    render(<ClanQuest server={stillServer(clock(30))} />);
    expect(await screen.findByText('New season in 6 days: your clan starts fresh, your trophies stay forever.')).toBeInTheDocument();
  });

  it('shows no season line or countdown while the clock is off', async () => {
    render(<ClanQuest server={stillServer(clock(30, { clockOn: false }))} />);
    await screen.findByRole('region', { name: 'Your clan' });
    expect(screen.queryByText(/Season \d+ ·/)).toBeNull();
    expect(screen.queryByText(/New season in/)).toBeNull();
  });

  it('tells the pupil once that a new season has begun', async () => {
    const u = user();
    render(<ClanQuest server={stillServer(clock(1), { newSeason: true })} />);
    const note = await screen.findByText('A new season has begun! Your clan starts fresh. Your badges and the Hall of Legends stay forever.');
    expect(note).toBeInTheDocument();
    await u.click(within(note.closest('div')!).getByRole('button', { name: 'OK' }));
    expect(screen.queryByText(/A new season has begun/)).toBeNull();
  });
});

describe('raids when they rest', () => {
  const message = 'Raids on classmates rest for the last two weeks of the season. Computer kingdoms are still open!';
  it('says so instead of the list when raidTargets says resting', async () => {
    const u = user();
    render(<ClanQuest server={stillServer(clock(30), {}, (t) => (t === 'raidTargets' ? { result: { type: 'raidTargets', targets: [], resting: true } } : null))} />);
    await screen.findByRole('region', { name: 'Your clan' });
    await u.click(btn('My Village'));
    await u.click(btn('Raid a classmate'));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('Pick a clan in your class')).toBeNull();
  });
});

describe('the Hall of Legends', () => {
  const rows: HallRow[] = [
    { season: 1, clanName: 'Old Owls', villageDoneOn: '2026-09-20', monsterDoneOn: null, isMe: false },
    { season: 2, clanName: 'Red Banner', villageDoneOn: '2026-11-03', monsterDoneOn: null, isMe: true },
    { season: 2, clanName: 'Swift Foxes', villageDoneOn: '2026-11-10', monsterDoneOn: '2026-12-01', isMe: false },
  ];

  it('groups rows by season, newest first, with dates and you', async () => {
    render(<Hall load={async () => rows} onBack={() => {}} />);
    await screen.findByText('Season 2');
    const seasons = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(seasons).toEqual(['Season 2', 'Season 1']);
    const two = screen.getByRole('region', { name: 'Season 2' });
    expect(within(two).getByText('Village builders')).toBeInTheDocument();
    expect(within(two).getByText('3 Nov')).toBeInTheDocument();
    expect(within(two).getByText('(you)')).toBeInTheDocument();
    expect(within(two).getByText('Monster slayers')).toBeInTheDocument();
    expect(within(two).getByText('1 Dec')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Season 1' })).queryByText('Monster slayers')).toBeNull();
  });

  it('has a kind empty state', async () => {
    render(<Hall load={async () => []} onBack={() => {}} />);
    expect(await screen.findByText('No legends yet. Be the first to finish your whole village!')).toBeInTheDocument();
  });

  it('is reached from the Scoreboard', async () => {
    const u = user();
    render(<Scoreboard session={fresh()} hall={async () => rows} onBack={() => {}} />);
    await u.click(await screen.findByRole('button', { name: 'Hall of Legends' }));
    expect(await screen.findByRole('heading', { name: 'Hall of Legends' })).toBeInTheDocument();
    await u.click(btn('Back to the scoreboard'));
    expect(screen.getByRole('heading', { name: 'Scoreboard' })).toBeInTheDocument();
  });

  it('hides the button when the database has no Hall yet', async () => {
    let asked = false;
    render(<Scoreboard session={fresh()} hall={async () => { asked = true; return null; }} onBack={() => {}} />);
    await screen.findByRole('table');
    await new Promise((r) => setTimeout(r, 10));
    expect(asked).toBe(true);
    expect(screen.queryByRole('button', { name: 'Hall of Legends' })).toBeNull();
  });
});
