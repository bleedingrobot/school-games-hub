import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../../shared/power-clash/bot';
import type { PowerId } from '../../../shared/power-clash/types';
import { seeded } from '../../../shared/seededRandom';
import {
  MAX_CODE_TRIES_PER_MINUTE,
  powerClashHandler,
  WAITING_GAME_MS,
  type NewPowerGame,
  type PlayerStatus,
  type PowerGameRow,
  type Services,
} from './handler';

const START = Date.parse('2026-10-20T09:00:00Z');
const NAMES = ['ana', 'ben', 'cat', 'dan'];
const ANA: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const BEN: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];

/** A pretend Supabase: games in memory, a clock we can move, and "save only if unchanged". */
function world() {
  let clock = START;
  let nextId = 1;
  const games = new Map<string, PowerGameRow>();
  const players = new Map<string, Omit<PlayerStatus, 'gone' | 'createdLastHour'>>();
  const otherCodes = new Set<string>();
  let multiplayerOn = true;
  for (const name of NAMES) players.set(name, { school: true, hidden: false, multiplayerEnabled: true, schoolId: 1 });

  const copy = (g: PowerGameRow | undefined) => (g ? structuredClone(g) : null);
  const random = seeded(11);
  /** Every number the server's dice gave out, in order. */
  const rolled: number[] = [];

  const services: Services = {
    now: () => clock,
    random: () => {
      const value = random();
      rolled.push(value);
      return value;
    },
    userIdFor: async (token) => (token.endsWith('-token') && players.has(token.slice(0, -6)) ? token.slice(0, -6) : null),
    playerStatus: async (player, others = []) => {
      const p = players.get(player);
      if (!p) return null;
      const createdLastHour = [...games.values()].filter((g) => g.host === player && clock - Date.parse(g.created_at) < 3_600_000).length;
      const gone = others.filter((o) => !players.get(o) || players.get(o)!.hidden);
      return { ...p, multiplayerEnabled: multiplayerOn, createdLastHour, gone };
    },
    loadGame: async (id) => copy(games.get(id)),
    findWaitingByCode: async (code) => copy([...games.values()].find((g) => g.status === 'waiting' && g.code === code)),
    codeTaken: async (code) => otherCodes.has(code) || [...games.values()].some((g) => g.status === 'waiting' && g.code === code),
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

  /** Plays one round to its end, whoever wins. */
  async function playRound(id: string) {
    const round = games.get(id)!.game!.match.round;
    for (let n = 0; games.get(id)!.game!.match.round === round && games.get(id)!.game!.match.state.status === 'active'; n++) {
      if (n > 100) throw new Error('round never ended');
      await playTurn(id);
    }
    return games.get(id)!;
  }

  return {
    services,
    games,
    players,
    otherCodes,
    ask,
    waiting,
    started,
    rolled,
    turnOf,
    playTurn,
    playRound,
    playToEnd,
    tick: (ms: number) => (clock += ms),
    now: () => clock,
    setMultiplayer: (on: boolean) => (multiplayerOn = on),
  };
}


describe('power clash server', () => {
  it('refuses a missing sign-in, a wrong code, code guessing, another school, a hidden student, a third player, an old game and paused games', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create' })).status).toBe(401);
    expect((await w.ask('nobody', { action: 'create' })).status).toBe(401);
    const g = (await w.ask('ana', { action: 'create', lobby: true })).game!;
    expect((await w.ask('ben', { action: 'join', code: 'ZZZZZ' })).problem).toBe('not-found');
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('not-found');
    expect((await w.ask('ben', { action: 'join', gameId: g.id })).problem).toBe('not-found');
    w.players.get('ben')!.schoolId = 1;
    expect((await w.ask('ben', { action: 'join', code: g.code })).game!.seat2).toBe('ben');
    expect((await w.ask('ben', { action: 'join', code: g.code })).game!.seat2).toBe('ben');
    expect((await w.ask('cat', { action: 'join', code: g.code })).problem).toBe('full');
    for (let i = 0; i < MAX_CODE_TRIES_PER_MINUTE; i++) await w.ask('dan', { action: 'join', code: 'CCCCC' });
    expect((await w.ask('dan', { action: 'join', code: 'CCCCC' })).problem).toBe('too-many-codes');

    const v = world();
    const h = (await v.ask('ana', { action: 'create' })).game!;
    v.players.get('ben')!.hidden = true;
    expect((await v.ask('ben', { action: 'join', code: h.code })).problem).toBe('hidden');
    v.setMultiplayer(false);
    expect((await v.ask('cat', { action: 'join', code: h.code })).problem).toBe('paused');
    expect((await v.ask('cat', { action: 'create' })).problem).toBe('paused');
    v.setMultiplayer(true);
    v.tick(WAITING_GAME_MS + 1);
    expect((await v.ask('cat', { action: 'join', code: h.code })).problem).toBe('expired');
  });

  it('refuses a move out of turn, an illegal move, an outsider, a stale version, a game not started or finished, and a double tap plays once', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const o = x === 'ana' ? 'ben' : 'ana';
    const move = (who: string, extra: object = {}) => w.ask(who, { action: 'place', gameId: g.id, version: g.version, square: 4, ...extra });
    expect((await move(o)).problem).toBe('not-your-turn');
    expect((await move('cat')).problem).toBe('not-yours');
    expect((await move(x, { version: g.version - 1 })).problem).toBe('changed');
    expect((await move(x, { version: undefined })).problem).toBe('changed');
    expect((await move(x, { square: 9 })).problem).toBe('bad-request');
    expect((await move(x, { square: 'x' })).problem).toBe('bad-request');
    expect((await w.ask(x, { action: 'skip', gameId: g.id, version: g.version })).problem).toBe('illegal');
    expect((await w.ask(x, { action: 'use-power', gameId: g.id, version: g.version, power: 'teleport', targets: [] })).problem).toBe('bad-request');
    // a power you don't have
    const hasNo = w.games.get(g.id)!.game!.match.state.loadout.X.includes('board-wipe') ? 'force-field' : 'board-wipe';
    const refused = await w.ask(x, { action: 'use-power', gameId: g.id, version: g.version, power: hasNo, targets: [4] });
    expect(refused.problem).toBe('illegal');
    expect(refused.error).toBeTruthy();
    expect((await w.ask(x, { action: 'use-power', gameId: g.id, version: g.version, power: 'body-swap', targets: [1, 2, 3] })).problem).toBe('bad-request');
    // nothing above changed the game
    expect(w.games.get(g.id)!.version).toBe(g.version);
    // a double tap plays only once
    expect((await move(x)).status).toBe(200);
    expect((await move(x)).problem).toBe('changed');
    expect(w.games.get(g.id)!.version).toBe(g.version + 1);
    const waiting = await w.waiting();
    expect((await w.ask('ana', { action: 'place', gameId: waiting.id, version: waiting.version, square: 4 })).problem).toBe('not-started');
    const g2 = await w.started();
    await w.ask('ana', { action: 'leave', gameId: g2.id });
    expect((await w.ask('ben', { action: 'place', gameId: g2.id, version: w.games.get(g2.id)!.version, square: 4 })).problem).toBe('over');
  });

  it('plays a whole match to the end: scores the rounds, finishes, and records who won', async () => {
    const w = world();
    const g = await w.started();
    const end = await w.playToEnd(g.id);
    expect(end.status).toBe('finished');
    expect(end.ending).toBe('finished');
    expect(end.deadline).toBeNull();
    expect(end.finished_at).not.toBeNull();
    const winner = end.game!.match.winner!;
    expect(end.game!.match.score[winner]).toBe(3);
    expect(end.won).toEqual([winner === 'X', winner === 'O']);
    expect(end.counts).toEqual([true, true]);
    expect(end.stats).toHaveLength(2);
    expect(end.stats![0].roundsWon + end.stats![1].roundsWon + end.game!.match.draws).toBe(end.game!.match.round);
    // finished means finished
    expect((await w.ask(end.seat1!, { action: 'place', gameId: g.id, version: end.version, square: 4 })).problem).toBe('over');
  });

  it('leaving part-way ends the game as abandoned: the leaver is recorded and nobody earns anything', async () => {
    const w = world();
    const g = await w.started();
    await w.playTurn(g.id);
    const left = await w.ask('ana', { action: 'leave', gameId: g.id });
    expect(left.game).toMatchObject({ status: 'finished', ending: 'abandoned', leaver: 'ana', won: [false, false], counts: [false, false], deadline: null });
    // leaving twice is fine
    expect((await w.ask('ana', { action: 'leave', gameId: g.id })).game!.version).toBe(left.game!.version);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('power-clash');
    expect(readFileSync(resolve('supabase/functions/power-clash/index.ts'), 'utf8')).toBe(built);
  });
});
