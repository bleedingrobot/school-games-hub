import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../../shared/power-clash/bot';
import type { PowerId } from '../../../shared/power-clash/types';
import { seeded } from '../../../shared/seededRandom';
import {
  MAX_CODE_TRIES_PER_MINUTE,
  powerClashHandler,
  type NewPowerGame,
  type PlayerStatus,
  type PowerGameRow,
  type Services,
} from './handler';

const START = Date.parse('2026-10-20T09:00:00Z');
const NAMES = ['ana', 'ben', 'cat', 'dan'];
const ANA: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const BEN: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];

/** A pretend Supabase: games in memory, a fixed clock, and "save only if unchanged". */
function world() {
  const clock = START;
  let nextId = 1;
  const games = new Map<string, PowerGameRow>();
  const players = new Map<string, Omit<PlayerStatus, 'gone' | 'createdLastHour'>>();
  for (const name of NAMES) players.set(name, { school: true, hidden: false, multiplayerEnabled: true, schoolId: 1 });

  const copy = (g: PowerGameRow | undefined) => (g ? structuredClone(g) : null);
  const random = seeded(11);

  const services: Services = {
    now: () => clock,
    random,
    userIdFor: async (token) => (token.endsWith('-token') && players.has(token.slice(0, -6)) ? token.slice(0, -6) : null),
    playerStatus: async (player, others = []) => {
      const p = players.get(player);
      if (!p) return null;
      const createdLastHour = [...games.values()].filter((g) => g.host === player && clock - Date.parse(g.created_at) < 3_600_000).length;
      const gone = others.filter((o) => !players.get(o) || players.get(o)!.hidden);
      return { ...p, createdLastHour, gone };
    },
    loadGame: async (id) => copy(games.get(id)),
    findWaitingByCode: async (code) => copy([...games.values()].find((g) => g.status === 'waiting' && g.code === code)),
    codeTaken: async (code) => [...games.values()].some((g) => g.status === 'waiting' && g.code === code),
    findWaitingHostedBy: async (player) => copy([...games.values()].find((g) => g.status === 'waiting' && g.host === player)),
    insertGame: async (row: NewPowerGame) => {
      const waiting = [...games.values()].filter((g) => g.status === 'waiting');
      if (waiting.some((g) => g.code === row.code)) return 'code-taken';
      if (waiting.some((g) => g.host === row.host)) return 'already-waiting';
      const game: PowerGameRow = {
        id: `power-${nextId++}`,
        seat2: null,
        game: null,
        events: [],
        version: 0,
        created_at: new Date(clock).toISOString(),
        started_at: null,
        deadline: null,
        last_action_at: null,
        finished_at: null,
        ending: null,
        leaver: null,
        won: null,
        counts: null,
        stats: null,
        rematch_game: null,
        ...structuredClone(row),
      };
      games.set(game.id, game);
      return copy(game)!;
    },
    updateGame: async (id, version, patch) => {
      const g = games.get(id);
      if (!g || g.version !== version) return null;
      Object.assign(g, structuredClone(patch));
      return copy(g);
    },
  };

  const handle = powerClashHandler(services);
  async function ask(who: string | null, body: object) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
    if (who) headers.Authorization = `Bearer ${who}-token`;
    const response = await handle(new Request('http://x/power-clash', { method: 'POST', headers, body: JSON.stringify(body) }));
    const json = (await response.json()) as { game?: PowerGameRow; error?: string; problem?: string; secondsLeft?: number };
    return { status: response.status, ...json };
  }

  /** Ana hosts and Ben joins with the code. Nobody has picked powers yet. */
  async function waiting() {
    const made = await ask('ana', { action: 'create' });
    const joined = await ask('ben', { action: 'join', code: made.game!.code });
    if (joined.status !== 200) throw new Error(`join: ${joined.problem}`);
    return structuredClone(games.get(made.game!.id)!);
  }

  /** Both pick their powers: the match starts. */
  async function started(ana: PowerId[] = ANA, ben: PowerId[] = BEN) {
    const g = await waiting();
    await ask('ana', { action: 'set-powers', gameId: g.id, powers: ana });
    const done = await ask('ben', { action: 'set-powers', gameId: g.id, powers: ben });
    if (done.status !== 200) throw new Error(`set-powers: ${done.problem}`);
    return structuredClone(games.get(g.id)!);
  }

  /** The student at a seat of a playing game. */
  const seatName = (g: PowerGameRow, seat: number) => [g.seat1, g.seat2][seat]!;
  /** Whose turn it is in a playing game (their name). */
  const turnOf = (id: string) => {
    const g = games.get(id)!;
    return seatName(g, g.game!.match.state.active === 'X' ? 0 : 1);
  };

  /** The student whose turn it is does what a bot would. */
  async function playTurn(id: string) {
    const g = games.get(id)!;
    const action = chooseAction(g.game!.match.state, 'easy', random);
    const body: Record<string, unknown> =
      action.type === 'place'
        ? { action: 'place', square: action.square }
        : action.type === 'skip'
          ? { action: 'skip' }
          : { action: 'use-power', power: action.power, targets: action.targets };
    const done = await ask(turnOf(id), { ...body, gameId: id, version: g.version });
    if (done.status !== 200) throw new Error(`${String(body.action)}: ${done.problem} ${done.error}`);
    return done.game!;
  }

  /** Plays to the end of the match, both players pressing Next between rounds. */
  async function playToEnd(id: string) {
    for (let n = 0; games.get(id)!.status === 'playing'; n++) {
      if (n > 1000) throw new Error('never ended');
      const g = games.get(id)!;
      if (g.game!.match.state.status !== 'active') {
        await ask(g.seat1, { action: 'next', gameId: id, round: g.game!.match.round });
        await ask(g.seat2, { action: 'next', gameId: id, round: g.game!.match.round });
        continue;
      }
      await playTurn(id);
    }
    return games.get(id)!;
  }

  return { games, players, ask, started, turnOf, playToEnd };
}

describe('the power clash server function', () => {
  it('needs a real sign-in, keeps other schools out, and slows down someone guessing codes', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create' })).status).toBe(401);
    expect((await w.ask('nobody', { action: 'create' })).status).toBe(401);
    // The host comes from the token, not the request.
    const g = (await w.ask('ana', { action: 'create', host: 'ben' })).game!;
    expect(g.host).toBe('ana');
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('not-found');
    for (let i = 0; i < MAX_CODE_TRIES_PER_MINUTE; i++) await w.ask('cat', { action: 'join', code: 'CCCCC' });
    expect((await w.ask('cat', { action: 'join', code: 'CCCCC' })).problem).toBe('too-many-codes');
  });

  it('refuses a move out of turn, an outsider, an illegal move and a stale version, and plays a double tap once', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const o = x === 'ana' ? 'ben' : 'ana';
    const move = (who: string, extra: object = {}) => w.ask(who, { action: 'place', gameId: g.id, version: g.version, square: 4, ...extra });
    expect((await move(o)).problem).toBe('not-your-turn');
    expect((await move('cat')).problem).toBe('not-yours');
    expect((await move(x, { version: g.version - 1 })).problem).toBe('changed');
    expect((await move(x, { square: 9 })).problem).toBe('bad-request');
    const hasNo = g.game!.match.state.loadout.X.includes('board-wipe') ? 'force-field' : 'board-wipe';
    expect((await w.ask(x, { action: 'use-power', gameId: g.id, version: g.version, power: hasNo, targets: [4] })).problem).toBe('illegal');
    expect(w.games.get(g.id)!.version).toBe(g.version);
    const done = await move(x);
    expect(done.status).toBe(200);
    expect(done.game!.game!.match.state.board[4]).toBe('X');
    expect((await move(x)).problem).toBe('changed');
    expect(w.games.get(g.id)!.version).toBe(g.version + 1);
  });

  it('plays a match to the end and records who won; leaving part-way earns nobody anything', async () => {
    const w = world();
    const g = await w.started();
    const end = await w.playToEnd(g.id);
    const winner = end.game!.match.winner!;
    expect(end).toMatchObject({ status: 'finished', ending: 'finished', won: [winner === 'X', winner === 'O'], counts: [true, true] });
    expect(end.game!.match.score[winner]).toBe(3);
    expect((await w.ask(end.seat1!, { action: 'place', gameId: g.id, version: end.version, square: 4 })).problem).toBe('over');
    const v = world();
    const left = await v.ask('ana', { action: 'leave', gameId: (await v.started()).id });
    expect(left.game).toMatchObject({ status: 'finished', ending: 'abandoned', leaver: 'ana', won: [false, false], counts: [false, false] });
  });
});
