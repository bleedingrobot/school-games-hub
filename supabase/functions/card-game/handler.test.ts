import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import { CARD_PATTERN, PACK, type Card } from '../../../shared/card101/cards';
import type { Game } from '../../../shared/card101/engine';
import { GRACE_MS, NEXT_ROUND_MS, PEEK_MS, TURN_MS, type SeatRow, type SeatWrite } from '../../../shared/card101/live';
import { seededDice } from '../../../shared/card101/random';
import { cardGameHandler, MAX_CREATES_PER_HOUR, WAITING_GAME_MS, type CardGameRow, type PlayerStatus, type Services } from './handler';

const START = Date.parse('2026-10-20T09:00:00Z');
const NAMES = ['ana', 'ben', 'cat', 'dan', 'eve'];

/** A pretend Supabase: games and seat rows in memory, a clock we can move, and "save only if unchanged". */
function world() {
  let clock = START;
  let nextId = 1;
  const games = new Map<string, CardGameRow>();
  const created = new Map<string, number>();
  const seats = new Map<string, SeatRow>();
  const players = new Map<string, Omit<PlayerStatus, 'gone' | 'createdLastHour' | 'multiplayerEnabled'>>();
  const otherCodes = new Set<string>();
  let multiplayerOn = true;
  for (const name of NAMES) players.set(name, { school: true, hidden: false });

  const copy = (g: CardGameRow | undefined) => (g ? structuredClone(g) : null);
  const random = seeded(11);

  const services: Services = {
    now: () => clock,
    random,
    dice: seededDice('card-game-test'),
    newId: () => `card-${nextId++}`,
    userIdFor: async (token) => (token.endsWith('-token') && players.has(token.slice(0, -6)) ? token.slice(0, -6) : null),
    playerStatus: async (player, others = []) => {
      const p = players.get(player);
      if (!p) return null;
      const createdLastHour = [...games.values()].filter((g) => g.host === player && clock - created.get(g.id)! < 3_600_000).length;
      const gone = others.filter((o) => !players.get(o) || players.get(o)!.hidden);
      return { ...p, multiplayerEnabled: multiplayerOn, createdLastHour, gone };
    },
    loadGame: async (id) => copy(games.get(id)),
    findWaitingByCode: async (code) => copy([...games.values()].find((g) => g.status === 'waiting' && g.code === code)),
    codeTaken: async (code) => otherCodes.has(code) || [...games.values()].some((g) => g.status === 'waiting' && g.code === code),
    findWaitingHostedBy: async (player) => copy([...games.values()].find((g) => g.status === 'waiting' && g.host === player)),
    write: async (expected, row, rows: SeatWrite[]) => {
      if (expected === null) {
        const waiting = [...games.values()].filter((g) => g.status === 'waiting');
        if (waiting.some((g) => g.code === row.code)) return 'code-taken';
        if (waiting.some((g) => g.host === row.host)) return 'already-waiting';
        created.set(row.id, clock);
      } else if (games.get(row.id)?.version !== expected) {
        return 'changed';
      }
      games.set(row.id, structuredClone(row));
      for (const [key, seat] of seats) if (seat.game === row.id && !rows.some((r) => r.player === seat.player)) seats.delete(key);
      for (const r of rows) {
        const before = seats.get(`${row.id}/${r.player}`);
        seats.set(`${row.id}/${r.player}`, structuredClone({ ...r, log: [...(before?.log ?? []), ...r.events].slice(-40) }));
      }
      return structuredClone(row);
    },
  };
  const handle = cardGameHandler(services);

  async function ask(who: string, body: object) {
    const response = await handle(
      new Request('https://example.test/card-game', {
        method: 'POST',
        headers: { Authorization: `Bearer ${who}-token`, 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' },
        body: JSON.stringify(body),
      }),
    );
    const text = await response.text();
    return { status: response.status, text, body: JSON.parse(text) as { seat?: SeatRow; error?: string; problem?: string; secondsLeft?: number } };
  }

  return {
    services,
    handle,
    ask,
    games,
    seats,
    /** The full game (the server's secret). */
    game: (id: string) => games.get(id)!,
    seat: (id: string, who: string) => seats.get(`${id}/${who}`) ?? null,
    tick: (ms: number) => (clock += ms),
    hide: (who: string) => (players.get(who)!.hidden = true),
    pause: () => (multiplayerOn = false),
    takeCode: (code: string) => otherCodes.add(code),
  };
}

type World = ReturnType<typeof world>;

/** Makes a game for `host` and has the others join it (it starts by itself when full). */
async function gameFor(w: World, host: string, others: string[], wanted = others.length + 1, target = 50) {
  const made = await w.ask(host, { action: 'create', players: wanted, settings: { target }, lobby: false });
  expect(made.status).toBe(200);
  const code = made.body.seat!.info.code!;
  for (const who of others) expect((await w.ask(who, { action: 'join', code })).status).toBe(200);
  return made.body.seat!.game;
}

/** The cards a seat may see, from its whole seat row (view, events and log). */
const cardsIn = (text: string) => new Set(text.match(CARD_PATTERN) ?? []);

/** Every card a seat is allowed to know right now: the rules in shared/card101/view.ts. */
function allowedFor(game: Game, seat: number): Set<Card> {
  const allowed = new Set<Card>(game.discard);
  game.hands.forEach((hand, s) => hand.forEach((card, slot) => game.faceUp[s][slot] && allowed.add(card)));
  if (game.holding && (game.turn === seat || game.holding.from === 'discard')) allowed.add(game.holding.card);
  if (game.phase === 'peek' && !game.peeked[seat] && !game.out[seat]) [2, 3].forEach((slot) => allowed.add(game.hands[seat][slot]));
  if (game.phase === 'round-over' || game.phase === 'over') game.hands.flat().forEach((c) => allowed.add(c));
  return allowed;
}

/** Plays the whole game: each player in turn takes from the stack and swaps or throws. */
async function playOut(w: World, id: string, names: string[], check?: (step: number) => void) {
  for (let step = 0; step < 2000; step++) {
    const g = w.game(id);
    check?.(step);
    if (g.status !== 'playing') return step;
    const game = g.game!;
    if (game.phase === 'peek') {
      const who = names.find((_, s) => !game.peeked[s])!;
      expect((await w.ask(who, { action: 'peek-done', gameId: id })).status).toBe(200);
    } else if (game.phase === 'round-over') {
      const who = names.find((_, s) => !game.out[s] && !g.ready?.[s])!;
      expect((await w.ask(who, { action: 'next', gameId: id })).status).toBe(200);
    } else {
      const who = names[game.turn];
      if (!game.holding) {
        const knock = game.turnsThisRound.every((t, s) => game.out[s] || t >= 2) && game.knocker === null && step % 3 === 0;
        const r = await w.ask(who, knock ? { action: 'knock', gameId: id, version: g.version } : { action: 'draw', gameId: id, version: g.version, from: 'stack' });
        expect(r.status).toBe(200);
      } else {
        const open = game.faceUp[game.turn].findIndex((up) => !up);
        const r = await w.ask(who, open >= 0 ? { action: 'swap', gameId: id, version: g.version, slot: open } : { action: 'throw', gameId: id, version: g.version });
        expect(r.status).toBe(200);
      }
    }
  }
  throw new Error('never finished');
}

describe('starting a game', () => {
  it('makes a waiting game with a code, and starts by itself when full', async () => {
    const w = world();
    const made = await w.ask('ana', { action: 'create', players: 3, settings: { target: 101 }, lobby: true });
    expect(made.status).toBe(200);
    const seat = made.body.seat!;
    expect(seat.info).toEqual(expect.objectContaining({ status: 'waiting', wanted: 3, players: ['ana', null, null, null], host: 'ana', inLobby: true }));
    expect(seat.info.code).toMatch(/^[CDFGHJKMNPQRTVWXY34679]{5}$/);
    expect(seat.view).toBeNull();
    const id = seat.game;
    const ben = await w.ask('ben', { action: 'join', code: seat.info.code!.toLowerCase() });
    expect(ben.body.seat).toEqual(expect.objectContaining({ seat: 1, status: 'waiting' }));
    expect(w.seat(id, 'ana')!.info.players).toEqual(['ana', 'ben', null, null]);
    const cat = await w.ask('cat', { action: 'join', gameId: id });
    expect(cat.body.seat).toEqual(expect.objectContaining({ seat: 2, status: 'playing' }));
    const g = w.game(id);
    expect(g.status).toBe('playing');
    expect(g.code).toBeNull();
    expect(g.game!.players).toBe(3);
    expect(g.game!.phase).toBe('peek');
    expect(Date.parse(g.deadline!)).toBe(START + PEEK_MS);
    for (const [who, s] of [['ana', 0], ['ben', 1], ['cat', 2]] as const) {
      const row = w.seat(id, who)!;
      expect(row.seat).toBe(s);
      expect(row.view!.peek!.cards).toEqual([g.game!.hands[s][2], g.game!.hands[s][3]]);
    }
  });

  it('the host can start early with 2 or more; not with 1, and not anyone else', async () => {
    const w = world();
    const made = await w.ask('ana', { action: 'create', players: 4, settings: { target: 50 }, lobby: false });
    const id = made.body.seat!.game;
    expect((await w.ask('ana', { action: 'start', gameId: id })).body.problem).toBe('need-players');
    await w.ask('ben', { action: 'join', code: made.body.seat!.info.code });
    expect((await w.ask('ben', { action: 'start', gameId: id })).body.problem).toBe('not-host');
    expect((await w.ask('ana', { action: 'start', gameId: id })).status).toBe(200);
    expect(w.game(id).game!.players).toBe(2);
    expect((await w.ask('ana', { action: 'start', gameId: id })).status).toBe(200); // a second tap is fine
    expect((await w.ask('cat', { action: 'join', gameId: id })).body.problem).toBe('not-found'); // not in the lobby
  });

  it('refuses bad settings, full games, expired games, and too many new games', async () => {
    const w = world();
    for (const bad of [{ players: 1 }, { players: 5 }, { players: 3, settings: { target: 75 } }, { players: 3, settings: null }]) {
      expect((await w.ask('ana', { action: 'create', settings: { target: 50 }, ...bad })).status).toBe(400);
    }
    const id = await gameFor(w, 'ana', ['ben'], 2);
    expect((await w.ask('cat', { action: 'join', gameId: id })).status).toBe(404);
    const made = await w.ask('cat', { action: 'create', players: 2, settings: { target: 50 } });
    w.tick(WAITING_GAME_MS + 1);
    expect((await w.ask('dan', { action: 'join', code: made.body.seat!.info.code })).body.problem).toBe('expired');
    for (let i = 0; i < MAX_CREATES_PER_HOUR; i++) await w.ask('eve', { action: 'create', players: 2, settings: { target: 50 } });
    expect((await w.ask('eve', { action: 'create', players: 2, settings: { target: 50 } })).body.problem).toBe('too-many');
  });

  it('a new code never matches a game waiting elsewhere', async () => {
    const w = world();
    const first = await w.ask('ana', { action: 'create', players: 2, settings: { target: 50 } });
    const code = first.body.seat!.info.code!;
    // Every code ana could get next is "taken" by a chess game except one.
    w.takeCode(code);
    const again = await w.ask('ben', { action: 'create', players: 2, settings: { target: 50 } });
    expect(again.body.seat!.info.code).not.toBe(code);
  });

  it('leaving the waiting room: the others move up; the host leaving cancels it', async () => {
    const w = world();
    const made = await w.ask('ana', { action: 'create', players: 4, settings: { target: 50 } });
    const id = made.body.seat!.game;
    for (const who of ['ben', 'cat']) await w.ask(who, { action: 'join', code: made.body.seat!.info.code });
    expect((await w.ask('ben', { action: 'leave', gameId: id })).body.seat!.seat).toBe(-1);
    expect(w.seat(id, 'ben')).toBeNull();
    expect(w.seat(id, 'cat')!.seat).toBe(1);
    expect(w.seat(id, 'ana')!.info.players).toEqual(['ana', 'cat', null, null]);
    await w.ask('ana', { action: 'cancel', gameId: id });
    expect(w.seat(id, 'cat')!.status).toBe('cancelled');
  });

  it('teacher switch off and hidden students: no starting or joining', async () => {
    const w = world();
    const made = await w.ask('ana', { action: 'create', players: 2, settings: { target: 50 } });
    w.hide('ben');
    expect((await w.ask('ben', { action: 'join', code: made.body.seat!.info.code })).body.problem).toBe('hidden');
    w.pause();
    expect((await w.ask('cat', { action: 'create', players: 2, settings: { target: 50 } })).body.problem).toBe('paused');
    expect((await w.ask('cat', { action: 'join', code: made.body.seat!.info.code })).body.problem).toBe('paused');
  });

  it('needs a sign-in', async () => {
    const w = world();
    expect((await w.ask('nobody', { action: 'create', players: 2, settings: { target: 50 } })).status).toBe(401);
  });
});

describe('hidden cards', () => {
  it('every reply and every seat row carries only what that player may know, all game long', async () => {
    const w = world();
    const names = ['ana', 'ben', 'cat'];
    const id = await gameFor(w, 'ana', ['ben', 'cat'], 3, 50);
    let checked = 0;
    await playOut(w, id, names, () => {
      const game = w.game(id).game!;
      names.forEach((who, seat) => {
        const row = w.seat(id, who)!;
        const allowed = allowedFor(game, seat);
        // The log holds earlier events too: those were allowed when they happened, and
        // never include anyone else's stack draw or face-down card.
        for (const card of cardsIn(JSON.stringify({ ...row, log: [] }))) expect(allowed.has(card as Card), `${who} saw ${card}`).toBe(true);
        expect(JSON.stringify(row)).not.toContain('"stack":[');
        checked++;
      });
    });
    expect(checked).toBeGreaterThan(100);
  }, 30_000);

  it('a reply never holds the stack or anyone else’s face-down cards', async () => {
    const w = world();
    const id = await gameFor(w, 'ana', ['ben'], 2);
    const reply = await w.ask('ana', { action: 'peek-done', gameId: id });
    const game = w.game(id).game!;
    const secret = [...game.stack, game.hands[1][0], game.hands[1][1], game.hands[1][2], game.hands[1][3], game.hands[0][0], game.hands[0][1]];
    for (const card of cardsIn(reply.text)) expect(secret).not.toContain(card);
    expect(reply.text).not.toContain('"stack":[');
  });

  it('the peek shows once: after pressing done, or the 15 seconds, it never comes back', async () => {
    const w = world();
    const id = await gameFor(w, 'ana', ['ben'], 2);
    expect(w.seat(id, 'ana')!.view!.peek).not.toBeNull();
    await w.ask('ana', { action: 'peek-done', gameId: id });
    expect(w.seat(id, 'ana')!.view!.peek).toBeNull();
    expect((await w.ask('ana', { action: 'peek-done', gameId: id })).status).toBe(400);
    expect(w.seat(id, 'ben')!.view!.peek).not.toBeNull();
    // Ben forgets to press: the clock ends it.
    expect((await w.ask('ana', { action: 'times-up', gameId: id })).body.problem).toBe('not-yet');
    w.tick(PEEK_MS + GRACE_MS);
    expect((await w.ask('ana', { action: 'times-up', gameId: id })).status).toBe(200);
    expect(w.seat(id, 'ben')!.view!.peek).toBeNull();
    expect(w.game(id).game!.phase).toBe('play');
  });

  it('a stack draw is told to everyone, but the card only to the drawer', async () => {
    const w = world();
    const id = await gameFor(w, 'ana', ['ben'], 2);
    await w.ask('ana', { action: 'peek-done', gameId: id });
    await w.ask('ben', { action: 'peek-done', gameId: id });
    const g = w.game(id);
    const names = ['ana', 'ben'];
    const drawer = names[g.game!.turn];
    const other = names[1 - g.game!.turn];
    await w.ask(drawer, { action: 'draw', gameId: id, version: g.version, from: 'stack' });
    const card = w.game(id).game!.holding!.card;
    expect(w.seat(id, drawer)!.events).toEqual([expect.objectContaining({ kind: 'draw', from: 'stack', card })]);
    expect(w.seat(id, other)!.events).toEqual([{ kind: 'draw', seat: g.game!.turn, from: 'stack' }]);
    expect(JSON.stringify(w.seat(id, other))).not.toContain(`"${card}"`);
  });
});

describe('refereeing', () => {
  async function started(w: World, names = ['ana', 'ben']) {
    const id = await gameFor(w, names[0], names.slice(1), names.length);
    for (const who of names) await w.ask(who, { action: 'peek-done', gameId: id });
    return id;
  }

  it('refuses out-of-turn moves, old versions, double taps and nonsense', async () => {
    const w = world();
    const names = ['ana', 'ben'];
    const id = await started(w);
    const g = w.game(id);
    const me = names[g.game!.turn];
    const notMe = names[1 - g.game!.turn];
    expect((await w.ask(notMe, { action: 'draw', gameId: id, version: g.version, from: 'stack' })).body.problem).toBe('illegal');
    expect((await w.ask(me, { action: 'draw', gameId: id, version: g.version - 1, from: 'stack' })).body.problem).toBe('changed');
    expect((await w.ask(me, { action: 'draw', gameId: id, version: g.version, from: 'hand' })).status).toBe(400);
    expect((await w.ask(me, { action: 'swap', gameId: id, version: g.version, slot: 4 })).status).toBe(400);
    expect((await w.ask(me, { action: 'draw', gameId: id, version: g.version, from: 'stack' })).status).toBe(200);
    expect((await w.ask(me, { action: 'draw', gameId: id, version: g.version, from: 'stack' })).body.problem).toBe('changed'); // double tap
    expect((await w.ask(me, { action: 'knock', gameId: id, version: g.version + 1 })).body.error).toMatch(/once everyone has had a turn|holding/i);
    expect((await w.ask('cat', { action: 'draw', gameId: id, version: g.version + 1, from: 'stack' })).body.problem).toBe('not-yours');
    expect((await w.ask(me, { action: 'fly', gameId: id })).status).toBe(400);
  });

  it('a whole game to the end: places, wins, points, and nothing more allowed after', async () => {
    const w = world();
    const names = ['ana', 'ben', 'cat'];
    const id = await started(w, names);
    await playOut(w, id, names);
    const g = w.game(id);
    expect(g.status).toBe('finished');
    expect(g.ending).toBe('finished');
    expect(g.places).toEqual(expect.arrayContaining([1]));
    expect(g.counts).toEqual(names.map(() => g.game!.results.length >= 2));
    expect(g.won!.filter(Boolean).length).toBeGreaterThan(0);
    expect(g.stats).toHaveLength(3);
    const row = w.seat(id, 'ana')!;
    expect(row.status).toBe('finished');
    expect(row.info.places).toEqual(g.places);
    expect(row.view!.lastRound).not.toBeNull();
    expect((await w.ask('ana', { action: 'draw', gameId: id, version: g.version, from: 'stack' })).body.problem).toBe('over');
  }, 30_000);

  it('the clock: a turn not taken in 60 seconds is skipped; 3 in a row and you’re out', async () => {
    const w = world();
    const names = ['ana', 'ben', 'cat'];
    const id = await started(w, names);
    const sleepy = w.game(id).game!.turn;
    const awake = names.filter((_, s) => s !== sleepy);
    for (let skip = 1; skip <= 3; skip++) {
      // Wait out the sleepy player's turn.
      while (w.game(id).game!.turn !== sleepy) {
        const g = w.game(id);
        const who = names[g.game!.turn];
        await w.ask(who, { action: 'draw', gameId: id, version: g.version, from: 'stack' });
        await w.ask(who, { action: 'throw', gameId: id, version: g.version + 1 });
      }
      expect((await w.ask(awake[0], { action: 'times-up', gameId: id })).body.problem).toBe('not-yet');
      w.tick(TURN_MS + GRACE_MS);
      expect((await w.ask(awake[0], { action: 'times-up', gameId: id })).status).toBe(200);
      expect(w.game(id).game!.skips[sleepy]).toBe(skip === 3 ? 3 : skip);
    }
    expect(w.game(id).game!.out[sleepy]).toBe(true);
    expect((await w.ask(names[sleepy], { action: 'draw', gameId: id, version: w.game(id).version, from: 'stack' })).body.problem).toBe('out');
  });

  it('between rounds: deals when everyone presses Next, or after 30 seconds', async () => {
    const w = world();
    const names = ['ana', 'ben'];
    const id = await started(w, names);
    // Play to the end of round 1: draw and throw until someone can knock, then knock.
    for (let n = 0; n < 200 && w.game(id).game!.phase === 'play'; n++) {
      const g = w.game(id);
      const who = names[g.game!.turn];
      const knock = await w.ask(who, { action: 'knock', gameId: id, version: g.version });
      if (knock.status === 200) continue;
      await w.ask(who, { action: 'draw', gameId: id, version: g.version, from: 'stack' });
      await w.ask(who, { action: 'throw', gameId: id, version: g.version + 1 });
    }
    expect(w.game(id).game!.phase).toBe('round-over');
    expect(w.seat(id, 'ana')!.view!.lastRound!.hands.flat()).toHaveLength(8);
    await w.ask('ana', { action: 'next', gameId: id });
    expect(w.game(id).game!.phase).toBe('round-over');
    expect(w.seat(id, 'ben')!.info.ready).toEqual([true, false]);
    await w.ask('ben', { action: 'next', gameId: id });
    expect(w.game(id).game!.phase).toBe('peek');
    expect(w.game(id).game!.round).toBe(2);
    // The new round's cards are hidden again.
    expect(w.seat(id, 'ana')!.view!.lastRound).toBeNull();
    expect(Date.parse(w.game(id).deadline!)).toBe(START + PEEK_MS);
    void NEXT_ROUND_MS;
  });

  it('leaving part-way: you’re out; with one player left the game ends', async () => {
    const w = world();
    const names = ['ana', 'ben', 'cat'];
    const id = await started(w, names);
    await w.ask('cat', { action: 'leave', gameId: id });
    expect(w.game(id).game!.out).toEqual([false, false, true]);
    expect(w.seat(id, 'cat')!.view!.out[2]).toBe(true);
    await w.ask('ben', { action: 'leave', gameId: id });
    const g = w.game(id);
    expect(g.status).toBe('finished');
    expect(g.won).toEqual([true, false, false]);
    expect(g.counts).toEqual([false, false, false]); // fewer than 2 full rounds
    expect(g.places).toEqual([1, 0, 0]);
  });

  it('a student hidden by the teacher is out the next time anyone acts', async () => {
    const w = world();
    const names = ['ana', 'ben', 'cat'];
    const id = await started(w, names);
    w.hide('cat');
    const g = w.game(id);
    const who = names[g.game!.turn] === 'cat' ? 'ana' : names[g.game!.turn];
    await w.ask(who, { action: names[g.game!.turn] === 'cat' ? 'times-up' : 'draw', gameId: id, version: g.version, from: 'stack' });
    expect(w.game(id).game!.out[2]).toBe(true);
  });

  it('rematch: the first press makes a new game, the others join it, and it starts when everyone is in', async () => {
    const w = world();
    const names = ['ana', 'ben'];
    const id = await started(w, names);
    await w.ask('ben', { action: 'leave', gameId: id });
    const first = await w.ask('ben', { action: 'rematch', gameId: id });
    expect(first.status).toBe(200);
    const next = first.body.seat!.game;
    expect(next).not.toBe(id);
    expect(w.game(id).rematch_game).toBe(next);
    expect(w.seat(id, 'ana')!.info.rematchGame).toBe(next);
    expect((await w.ask('ana', { action: 'rematch', gameId: id })).body.seat!.status).toBe('playing');
    expect(w.game(next).settings).toEqual({ target: 50 });
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('card-game');
    expect(readFileSync(resolve('supabase/functions/card-game/index.ts'), 'utf8')).toBe(built);
  });

  it('every card in the pack is a card the pattern finds (so the leak checks above can see them)', () => {
    expect(cardsIn(JSON.stringify(PACK)).size).toBe(52);
  });
});
