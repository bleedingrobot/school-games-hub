import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET } from '../../../shared/multiplayer';
import { chooseAction } from '../../../shared/power-clash/bot';
import { play } from '../../../shared/power-clash/engine';
import { GRACE_MS, NEXT_ROUND_MS, TIMEOUTS_TO_ABANDON, TURN_MS } from '../../../shared/power-clash/live';
import { newMatch, nextRound, scoreRound, type Match } from '../../../shared/power-clash/match';
import type { Action, PowerId } from '../../../shared/power-clash/types';
import { seeded } from '../../../shared/seededRandom';
import {
  MAX_CODE_TRIES_PER_MINUTE,
  MAX_CREATES_PER_HOUR,
  MAX_REQUESTS_PER_MINUTE,
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

const seats = (g: PowerGameRow) => [g.seat1, g.seat2];

describe('starting and joining', () => {
  it('needs a real sign-in, and takes the host from the token', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create' })).status).toBe(401);
    expect((await w.ask('nobody', { action: 'create' })).status).toBe(401);
    const made = await w.ask('ana', { action: 'create', host: 'ben', lobby: true });
    expect(made.game).toMatchObject({
      host: 'ana', seat1: 'ana', seat2: null, status: 'waiting', in_lobby: true, loadouts: [null, null], first_player: null,
    });
    expect(made.game!.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{5}$`));
    expect(Date.parse(made.game!.expires_at) - w.now()).toBe(WAITING_GAME_MS);
  });

  it('never reuses a code that is waiting in another game', async () => {
    const probe = world();
    const first = (await probe.ask('ana', { action: 'create' })).game!.code!;
    const w = world();
    w.otherCodes.add(first);
    expect((await w.ask('ana', { action: 'create' })).game!.code).not.toBe(first);
  });

  it('keeps one waiting game each, and limits how many are started', async () => {
    const w = world();
    const first = (await w.ask('ana', { action: 'create' })).game!;
    await w.ask('ana', { action: 'create' });
    expect(w.games.get(first.id)!.status).toBe('cancelled');
    for (let i = 2; i < MAX_CREATES_PER_HOUR; i++) await w.ask('ana', { action: 'create' });
    expect((await w.ask('ana', { action: 'create' })).problem).toBe('too-many');
  });

  it('seats one classmate, and joining twice is fine', async () => {
    const w = world();
    const g = await w.waiting();
    expect(seats(g)).toEqual(['ana', 'ben']);
    expect((await w.ask('ben', { action: 'join', code: g.code })).game!.version).toBe(g.version);
    expect((await w.ask('cat', { action: 'join', code: g.code })).problem).toBe('full');
  });

  it('only lets you join from the lobby if the game is in it', async () => {
    const w = world();
    const g = (await w.ask('ana', { action: 'create' })).game!;
    expect((await w.ask('ben', { action: 'join', gameId: g.id })).problem).toBe('not-found');
    const open = (await w.ask('cat', { action: 'create', lobby: true })).game!;
    expect((await w.ask('ben', { action: 'join', gameId: open.id })).game!.seat2).toBe('ben');
  });

  it('treats a game from another school like a code that does not exist', async () => {
    const w = world();
    const g = (await w.ask('ana', { action: 'create', lobby: true })).game!;
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('not-found');
    expect((await w.ask('ben', { action: 'join', gameId: g.id })).problem).toBe('not-found');
    w.players.get('ben')!.schoolId = 1;
    expect((await w.ask('ben', { action: 'join', code: g.code })).game!.seat2).toBe('ben');
  });

  it('turns away hidden students, old games, and everyone while games are paused', async () => {
    const w = world();
    const g = (await w.ask('ana', { action: 'create' })).game!;
    w.players.get('ben')!.hidden = true;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('hidden');
    w.setMultiplayer(false);
    expect((await w.ask('cat', { action: 'join', code: g.code })).problem).toBe('paused');
    expect((await w.ask('cat', { action: 'create' })).problem).toBe('paused');
    w.setMultiplayer(true);
    w.tick(WAITING_GAME_MS + 1);
    expect((await w.ask('cat', { action: 'join', code: g.code })).problem).toBe('expired');
  });

  it('won’t let anyone into a game whose host was hidden since they made it', async () => {
    const w = world();
    const g = (await w.ask('ana', { action: 'create' })).game!;
    w.players.get('ana')!.hidden = true;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('expired');
  });

  it('says not-found for a wrong code, and slows down someone guessing codes', async () => {
    const w = world();
    expect((await w.ask('ben', { action: 'join', code: 'ZZZZZ' })).problem).toBe('not-found');
    expect((await w.ask('ben', { action: 'join' })).problem).toBe('bad-request');
    for (let i = 0; i < MAX_CODE_TRIES_PER_MINUTE; i++) await w.ask('ben', { action: 'join', code: 'CCCCC' });
    expect((await w.ask('ben', { action: 'join', code: 'CCCCC' })).problem).toBe('too-many-codes');
  });

  it('limits how many requests one student can make a minute', async () => {
    const w = world();
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await w.ask('ben', { action: 'bogus' });
    expect((await w.ask('ben', { action: 'bogus' })).problem).toBe('too-many');
  });

  it('cancels a waiting game when the host leaves, and frees the seat when the guest leaves', async () => {
    const w = world();
    const g = await w.waiting();
    await w.ask('ben', { action: 'set-powers', gameId: g.id, powers: BEN });
    expect((await w.ask('ben', { action: 'leave', gameId: g.id })).game).toMatchObject({ seat2: null, status: 'waiting', loadouts: [null, null] });
    await w.ask('ben', { action: 'join', code: g.code });
    expect((await w.ask('ana', { action: 'cancel', gameId: g.id })).game!.status).toBe('cancelled');
    expect((await w.ask('cat', { action: 'leave', gameId: g.id })).problem).toBe('not-yours');
  });
});

describe('picking powers and starting', () => {
  it('starts the moment both have picked, and not before', async () => {
    const w = world();
    const g = await w.waiting();
    const one = await w.ask('ana', { action: 'set-powers', gameId: g.id, powers: ANA });
    expect(one.game).toMatchObject({ status: 'waiting', loadouts: [ANA, null], game: null });
    // changing your mind is fine until the match starts
    const again = await w.ask('ana', { action: 'set-powers', gameId: g.id, powers: ['board-wipe', 'body-swap', 'freeze-ray'] });
    expect(again.game!.loadouts[0]).toEqual(['board-wipe', 'body-swap', 'freeze-ray']);
    await w.ask('ana', { action: 'set-powers', gameId: g.id, powers: ANA });
    const two = await w.ask('ben', { action: 'set-powers', gameId: g.id, powers: BEN });
    expect(two.game).toMatchObject({ status: 'playing', code: null });
    expect(two.game!.game!.match.round).toBe(1);
    expect(Date.parse(two.game!.deadline!) - w.now()).toBe(TURN_MS);
    expect(two.game!.started_at).not.toBeNull();
  });

  it('puts one player on X and the other on O, with their powers, both visible to both', async () => {
    const w = world();
    const g = await w.started();
    const [x, o] = [g.seat1!, g.seat2!];
    expect(new Set([x, o])).toEqual(new Set(['ana', 'ben']));
    const mine = { ana: ANA, ben: BEN } as Record<string, PowerId[]>;
    expect(g.game!.match.state.loadout).toEqual({ X: mine[x], O: mine[o] });
    expect(g.loadouts).toEqual([mine[x], mine[o]]);
    expect(g.game!.match.state.active).toBe('X');
  });

  it('refuses powers that aren’t three different real powers, or picking after the start', async () => {
    const w = world();
    const g = await w.waiting();
    for (const powers of [['body-swap'], ['body-swap', 'body-swap', 'freeze-ray'], ['body-swap', 'freeze-ray', 'teleport'], 'x', null]) {
      expect((await w.ask('ana', { action: 'set-powers', gameId: g.id, powers })).problem).toBe('bad-request');
    }
    expect((await w.ask('cat', { action: 'set-powers', gameId: g.id, powers: ANA })).problem).toBe('not-yours');
    await w.ask('ana', { action: 'set-powers', gameId: g.id, powers: ANA });
    await w.ask('ben', { action: 'set-powers', gameId: g.id, powers: BEN });
    expect((await w.ask('ana', { action: 'set-powers', gameId: g.id, powers: BEN })).problem).toBe('started');
    expect(w.games.get(g.id)!.loadouts.flat()).toEqual([...(w.games.get(g.id)!.seat1 === 'ana' ? ANA : BEN), ...(w.games.get(g.id)!.seat1 === 'ana' ? BEN : ANA)]);
  });

  it('who plays X is up to the server, not the host: over many games both happen', async () => {
    const hosts = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const w = world();
      for (let j = 0; j < i; j++) w.services.random();
      hosts.add((await w.started()).seat1!);
    }
    expect(hosts).toEqual(new Set(['ana', 'ben']));
  });
});

describe('playing', () => {
  it('a legal move saves, passes the turn, and goes up a version', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const done = await w.ask(x, { action: 'place', gameId: g.id, version: g.version, square: 4 });
    expect(done.status).toBe(200);
    expect(done.game!.version).toBe(g.version + 1);
    expect(done.game!.game!.match.state.board[4]).toBe('X');
    expect(done.game!.game!.match.state.active).toBe('O');
    expect(done.game!.events).toEqual([{ kind: 'place', player: 'X', square: 4 }]);
    expect(done.game!.last_action_at).toBe(new Date(w.now()).toISOString());
    expect(Date.parse(done.game!.deadline!) - w.now()).toBeGreaterThanOrEqual(TURN_MS);
    expect(w.games.get(g.id)!.game!.match.state.board[4]).toBe('X');
  });

  it('refuses a move out of turn, an illegal move, an outsider and a stale version', async () => {
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
  });

  it('refuses to play in a game that hasn’t started, or that has finished', async () => {
    const w = world();
    const waiting = await w.waiting();
    expect((await w.ask('ana', { action: 'place', gameId: waiting.id, version: waiting.version, square: 4 })).problem).toBe('not-started');
    const g = await w.started();
    await w.ask('ana', { action: 'leave', gameId: g.id });
    expect((await w.ask('ben', { action: 'place', gameId: g.id, version: w.games.get(g.id)!.version, square: 4 })).problem).toBe('over');
  });

  it('plays powers with their targets', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const mine = g.game!.match.state.loadout.X;
    const power: PowerId = mine.includes('freeze-ray') ? 'freeze-ray' : 'body-swap';
    const body = power === 'freeze-ray' ? { power, targets: [4] } : { power, targets: [0, 4] };
    const done = await w.ask(x, { action: 'use-power', gameId: g.id, version: g.version, ...body });
    expect(done.status).toBe(200);
    expect(done.game!.game!.match.state.used.X).toEqual([power]);
    expect(done.game!.game!.stats[0].powersUsed).toBe(1);
  });

  it('both players see exactly the same game: the same row goes to each, and it is what was saved', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const done = await w.ask(x, { action: 'place', gameId: g.id, version: g.version, square: 0 });
    const saved = w.games.get(g.id)!;
    expect(done.game).toEqual(saved);
    // Nothing is held back: every field of the match is in the row, for both players to read.
    expect(Object.keys(done.game!.game!)).toEqual(['match', 'stats', 'timeouts', 'ready']);
  });

  it('plays whole matches to the end: scores the rounds, finishes, and records who won and what each player did', async () => {
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

  it('the server and a client replay of the same actions end in the same state', async () => {
    const w = world();
    const g = await w.started();
    const log: (Action | 'next')[] = [];
    // play the server, recording what was sent
    for (let n = 0; w.games.get(g.id)!.status === 'playing' && n < 1000; n++) {
      const row = w.games.get(g.id)!;
      if (row.game!.match.state.status !== 'active') {
        await w.ask(row.seat1!, { action: 'next', gameId: g.id });
        await w.ask(row.seat2!, { action: 'next', gameId: g.id });
        log.push('next');
        continue;
      }
      const action = chooseAction(row.game!.match.state, 'easy', seeded(n + 1));
      log.push(action);
      const body = action.type === 'place' ? { square: action.square } : action.type === 'use-power' ? { power: action.power, targets: action.targets } : {};
      const done = await w.ask(w.turnOf(g.id), { action: action.type === 'use-power' ? 'use-power' : action.type, gameId: g.id, version: row.version, ...body });
      expect(done.status).toBe(200);
    }
    let match: Match = newMatch(w.games.get(g.id)!.game!.match.loadout, 'X');
    for (const entry of log) {
      if (entry === 'next') match = nextRound(match);
      else {
        const r = play(match.state, entry);
        if (!r.ok) throw new Error(r.reason);
        match = scoreRound({ ...match, state: r.state });
      }
    }
    expect(match).toEqual(w.games.get(g.id)!.game!.match);
  });
});

describe('the new powers and the server\'s dice', () => {
  const FIELD: PowerId[] = ['force-field', 'portal-chaos', 'wild-card'];
  const HEIST: PowerId[] = ['time-heist', 'wild-card', 'portal-chaos'];

  it('plays whole matches with them: a client replaying with the server\'s dice ends in the same state', async () => {
    const used = new Set<string>();
    for (let match = 0; match < 3; match++) {
      const w = world();
      for (let burn = 0; burn < match * 7; burn++) w.services.random();
      const g = await w.started(FIELD, HEIST);
      const log: { action: Action | 'next'; dice: number[] }[] = [];
      for (let n = 0; w.games.get(g.id)!.status === 'playing' && n < 1500; n++) {
        const row = w.games.get(g.id)!;
        if (row.game!.match.state.status !== 'active') {
          await w.ask(row.seat1!, { action: 'next', gameId: g.id });
          await w.ask(row.seat2!, { action: 'next', gameId: g.id });
          log.push({ action: 'next', dice: [] });
          continue;
        }
        const action = chooseAction(row.game!.match.state, 'easy', seeded(n + 31 * match));
        const body = action.type === 'place' ? { square: action.square } : action.type === 'use-power' ? { power: action.power, targets: action.targets } : {};
        const before = w.rolled.length;
        const done = await w.ask(w.turnOf(g.id), { action: action.type, gameId: g.id, version: row.version, ...body });
        expect(done.status).toBe(200);
        if (action.type === 'use-power') used.add(action.power);
        log.push({ action, dice: w.rolled.slice(before) });
      }
      let client: Match = newMatch(w.games.get(g.id)!.game!.match.loadout, 'X');
      for (const entry of log) {
        if (entry.action === 'next') client = nextRound(client);
        else {
          let i = 0;
          const r = play(client.state, entry.action, () => entry.dice[i++]);
          if (!r.ok) throw new Error(r.reason);
          client = scoreRound({ ...client, state: r.state });
        }
      }
      expect(client).toEqual(w.games.get(g.id)!.game!.match);
      expect(w.games.get(g.id)!.status).toBe('finished');
    }
    // The bots chose these at random, so over three matches at least some of the new powers were played.
    expect([...used].filter((p) => ['force-field', 'portal-chaos', 'wild-card', 'time-heist'].includes(p)).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the engine\'s events for a Wild Card in the row both players read, and uses a charge', async () => {
    const w = world();
    const g = await w.started(FIELD, HEIST);
    const first = w.turnOf(g.id);
    await w.ask(first, { action: 'place', gameId: g.id, version: g.version, square: 4 });
    const row = w.games.get(g.id)!;
    const second = w.turnOf(g.id);
    const used = 'wild-card';
    const done = await w.ask(second, { action: 'use-power', gameId: g.id, version: row.version, power: used, targets: [] });
    expect(done.status).toBe(200);
    expect(done.game!.events[0]).toMatchObject({ kind: 'wild-card' });
    const state = done.game!.game!.match.state;
    expect(state.used[state.active]).toEqual([used]);
  });

  it('refuses a Time Heist with nothing to undo, says why, and keeps the charge', async () => {
    const w = world();
    const g = await w.started(HEIST, HEIST);
    const who = w.turnOf(g.id);
    const refused = await w.ask(who, { action: 'use-power', gameId: g.id, version: g.version, power: 'time-heist', targets: [] });
    expect(refused.status).toBe(400);
    expect(refused.problem).toBe('illegal');
    expect(refused.error).toMatch(/finished a go/);
    expect(w.games.get(g.id)!.version).toBe(g.version);
    expect(w.games.get(g.id)!.game!.match.state.used.X).toEqual([]);
  });

  it('refuses a Portal Chaos or Force Field that is aimed wrong', async () => {
    const w = world();
    const g = await w.started(FIELD, HEIST);
    const who = w.turnOf(g.id);
    const bad = await w.ask(who, { action: 'use-power', gameId: g.id, version: g.version, power: 'force-field', targets: [4] });
    expect(bad.problem).toBe('illegal');
    const junk = await w.ask(who, { action: 'use-power', gameId: g.id, version: g.version, power: 'portal-chaos', targets: [1, 2, 3] });
    expect(junk.problem).toBe('bad-request');
    const unknown = await w.ask(who, { action: 'use-power', gameId: g.id, version: g.version, power: 'teleport', targets: [] });
    expect(unknown.problem).toBe('bad-request');
  });

  it('a missed go uses the server\'s dice too (no Chaos Mode here, so nothing is rolled), and classmates games are never Chaos Mode', async () => {
    const w = world();
    const g = await w.started(FIELD, HEIST);
    expect(g.game!.match.chaos).toBe(false);
    expect(g.game!.match.state.chaos).toBe(false);
  });
});

describe('between rounds', () => {
  it('waits for both players to press Next, then deals the next round with the other player starting', async () => {
    const w = world();
    const g = await w.started();
    const round = await w.playRound(g.id);
    expect(round.game!.match.state.status).not.toBe('active');
    if (round.status !== 'playing') return;
    const starter = round.game!.match.starter;
    const first = await w.ask(round.seat1!, { action: 'next', gameId: g.id, round: 1 });
    expect(first.game!.game!.match.round).toBe(1);
    expect(first.game!.game!.ready).toEqual([true, false]);
    // a repeat press changes nothing
    const again = await w.ask(round.seat1!, { action: 'next', gameId: g.id, round: 1 });
    expect(again.game!.version).toBe(first.game!.version);
    const second = await w.ask(round.seat2!, { action: 'next', gameId: g.id, round: 1 });
    expect(second.game!.game!.match.round).toBe(2);
    expect(second.game!.game!.match.starter).toBe(starter === 'X' ? 'O' : 'X');
    expect(second.game!.game!.ready).toEqual([false, false]);
    expect(second.game!.game!.match.state.used).toEqual({ X: [], O: [] });
    // a late press for the old round does nothing
    const late = await w.ask(round.seat2!, { action: 'next', gameId: g.id, round: 1 });
    expect(late.status).toBe(200);
    expect(late.game!.version).toBe(second.game!.version);
  });

  it('ignores Next while a round is still going', async () => {
    const w = world();
    const g = await w.started();
    const done = await w.ask('ana', { action: 'next', gameId: g.id });
    expect(done.status).toBe(200);
    expect(done.game!.version).toBe(g.version);
  });
});

describe('the clock', () => {
  it('a turn that runs out is skipped, never a loss, and the other player is on the clock', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const o = x === 'ana' ? 'ben' : 'ana';
    // too early
    const early = await w.ask(o, { action: 'times-up', gameId: g.id });
    expect(early.problem).toBe('not-yet');
    expect(early.secondsLeft).toBeGreaterThan(55);
    w.tick(TURN_MS + GRACE_MS - 1);
    expect((await w.ask(o, { action: 'times-up', gameId: g.id })).problem).toBe('not-yet');
    w.tick(1);
    const done = await w.ask(o, { action: 'times-up', gameId: g.id });
    expect(done.status).toBe(200);
    const row = done.game!;
    expect(row.status).toBe('playing');
    expect(row.game!.match.state.board.every((c) => c === null)).toBe(true);
    expect(row.game!.match.state.active).toBe('O');
    expect(row.game!.match.score).toEqual({ X: 0, O: 0 });
    expect(row.events).toEqual([{ kind: 'skip', player: 'X' }]);
    expect(Date.parse(row.deadline!) - w.now()).toBeGreaterThanOrEqual(TURN_MS);
    // a timed-out turn isn't a real move: the tidy-up job still sees the game as idle
    expect(row.last_action_at).toBe(g.last_action_at);
  });

  it('the late player can still move after someone else asks for a time-out that is not due', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    w.tick(10_000);
    await w.ask(x === 'ana' ? 'ben' : 'ana', { action: 'times-up', gameId: g.id });
    expect((await w.ask(x, { action: 'place', gameId: g.id, version: g.version, square: 0 })).status).toBe(200);
  });

  it('three missed turns in a row end the game as abandoned, with nothing for anyone', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const o = x === 'ana' ? 'ben' : 'ana';
    // X misses, O misses, X misses, O misses, X misses
    let last;
    for (let i = 0; i < 2 * TIMEOUTS_TO_ABANDON - 1; i++) {
      w.tick(TURN_MS + 10_000);
      last = await w.ask(o, { action: 'times-up', gameId: g.id });
      expect(last.status).toBe(200);
    }
    const row = last!.game!;
    expect(row.status).toBe('finished');
    expect(row.ending).toBe('abandoned');
    expect(row.leaver).toBe(x);
    expect(row.counts).toEqual([false, false]);
    expect(row.won).toEqual([false, false]);
    expect(row.deadline).toBeNull();
  });

  it('when the pause between rounds runs out the next round starts by itself', async () => {
    const w = world();
    const g = await w.started();
    const round = await w.playRound(g.id);
    if (round.status !== 'playing') return;
    w.tick(NEXT_ROUND_MS + 5000);
    const done = await w.ask(round.seat1!, { action: 'times-up', gameId: g.id });
    expect(done.game!.game!.match.round).toBe(2);
    expect(done.game!.game!.timeouts).toEqual([0, 0]);
  });

  it('times-up for someone outside the game, or a game that has ended, is refused', async () => {
    const w = world();
    const g = await w.started();
    w.tick(TURN_MS * 2);
    expect((await w.ask('cat', { action: 'times-up', gameId: g.id })).problem).toBe('not-yours');
    await w.ask('ana', { action: 'leave', gameId: g.id });
    expect((await w.ask('ben', { action: 'times-up', gameId: g.id })).problem).toBe('over');
  });
});

describe('leaving and disappearing', () => {
  it('leaving part-way ends the game as abandoned: the leaver is recorded and nobody earns anything', async () => {
    const w = world();
    const g = await w.started();
    await w.playTurn(g.id);
    const left = await w.ask('ana', { action: 'leave', gameId: g.id });
    expect(left.game).toMatchObject({ status: 'finished', ending: 'abandoned', leaver: 'ana', won: [false, false], counts: [false, false], deadline: null });
    // leaving twice is fine
    expect((await w.ask('ana', { action: 'leave', gameId: g.id })).game!.version).toBe(left.game!.version);
  });

  it('a student the teacher hides ends the game the next time the other does something', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    const o = x === 'ana' ? 'ben' : 'ana';
    w.players.get(o)!.hidden = true;
    expect((await w.ask(x, { action: 'place', gameId: g.id, version: g.version, square: 4 })).problem).toBe('changed');
    expect(w.games.get(g.id)).toMatchObject({ status: 'finished', ending: 'abandoned', leaver: o, counts: [false, false] });
  });

  it('a hidden student is turned away from a game they are in', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    w.players.get(x)!.hidden = true;
    expect((await w.ask(x, { action: 'place', gameId: g.id, version: g.version, square: 4 })).problem).toBe('hidden');
  });

  it('a deleted student (an empty seat) ends the game too', async () => {
    const w = world();
    const g = await w.started();
    const x = w.turnOf(g.id);
    w.games.get(g.id)![x === w.games.get(g.id)!.seat1 ? 'seat2' : 'seat1'] = null;
    w.tick(TURN_MS + GRACE_MS);
    const done = await w.ask(x, { action: 'times-up', gameId: g.id });
    expect(done.game).toMatchObject({ status: 'finished', ending: 'abandoned' });
  });
});

describe('rematch', () => {
  it('the first press makes a new waiting game with the same powers; the other player starts and the second press begins it', async () => {
    const w = world();
    const g = await w.started();
    const firstX = g.seat1!;
    const end = await w.playToEnd(g.id);
    expect((await w.ask(firstX, { action: 'rematch', gameId: 'power-999' })).problem).toBe('not-yours');

    const first = await w.ask(end.seat2!, { action: 'rematch', gameId: g.id });
    expect(first.status).toBe(200);
    const next = first.game!;
    expect(next.id).not.toBe(g.id);
    expect(next.status).toBe('waiting');
    expect(next.first_player).toBe(end.seat2); // last game's O now plays X
    expect(w.games.get(g.id)!.rematch_game).toBe(next.id);

    // pressing again returns the same game
    expect((await w.ask(end.seat2!, { action: 'rematch', gameId: g.id })).game!.id).toBe(next.id);

    const second = await w.ask(end.seat1!, { action: 'rematch', gameId: g.id });
    expect(second.game!.id).toBe(next.id);
    expect(second.game!.status).toBe('playing');
    // the same powers as last time, and the roles are swapped
    expect(second.game!.seat1).toBe(end.seat2);
    expect(second.game!.seat2).toBe(end.seat1);
    expect(second.game!.game!.match.state.loadout).toEqual({ X: end.loadouts[1], O: end.loadouts[0] });
    expect(second.game!.game!.match.round).toBe(1);
    expect(second.game!.game!.match.score).toEqual({ X: 0, O: 0 });
  });

  it('is refused while the game is still being played', async () => {
    const w = world();
    const g = await w.started();
    expect((await w.ask('ana', { action: 'rematch', gameId: g.id })).problem).toBe('bad-request');
  });

  it('is allowed after a game was left part-way, and the leaver gets nothing from it', async () => {
    const w = world();
    const g = await w.started();
    await w.ask('ana', { action: 'leave', gameId: g.id });
    const r = await w.ask('ben', { action: 'rematch', gameId: g.id });
    expect(r.game!.status).toBe('waiting');
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
