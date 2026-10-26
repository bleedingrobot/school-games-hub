import { describe, expect, it } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import { CARD_PATTERN, type Card } from '../../../shared/card101/cards';
import type { Game } from '../../../shared/card101/engine';
import { type SeatRow, type SeatWrite } from '../../../shared/card101/live';
import { seededDice } from '../../../shared/card101/random';
import { cardGameHandler, type CardGameRow, type PlayerStatus, type Services } from './handler';

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
  for (const name of NAMES) players.set(name, { school: true, hidden: false, schoolId: 1 });

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
    moveToSchool: (who: string, school: number) => (players.get(who)!.schoolId = school),
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
  });
});

describe('refereeing', () => {
  async function started(w: World, names = ['ana', 'ben']) {
    const id = await gameFor(w, names[0], names.slice(1), names.length);
    for (const who of names) await w.ask(who, { action: 'peek-done', gameId: id });
    return id;
  }

  it('needs a sign-in, keeps out other schools, and refuses out-of-turn moves, old versions, double taps and nonsense', async () => {
    const w = world();
    const names = ['ana', 'ben'];
    const id = await started(w);
    const g = w.game(id);
    const me = names[g.game!.turn];
    const notMe = names[1 - g.game!.turn];
    expect((await w.ask('nobody', { action: 'draw', gameId: id, version: g.version, from: 'stack' })).status).toBe(401);
    w.moveToSchool('cat', 2);
    expect((await w.ask('cat', { action: 'join', gameId: id })).body.problem).toBe('not-found');
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
});
