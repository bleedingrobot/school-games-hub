import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET } from '../../../shared/multiplayer';
import { seeded } from '../../../shared/seededRandom';
import { botAction } from '../../../shared/space/bot';
import type { FactAnswer } from '../../../shared/maths/leitner';
import type { Question } from '../../../shared/maths/skillPack';
import { solveQuestion } from '../../../shared/maths/skillPacks/timesTables';
import { AUTO_FOCUS, solveParts, type MathsFocus } from '../../../shared/maths/focus';
import { DEFAULT_SETTINGS } from '../../../shared/space/engine';
import { AUTOPILOT_AFTER, type LiveSetup } from '../../../shared/space/live';
import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import { MIN_TURNS_TO_COUNT } from '../../../shared/space/save';
import {
  MAX_CREATES_PER_HOUR,
  spaceGameHandler,
  WAITING_GAME_MS,
  type NewSpaceGame,
  type PlayerStatus,
  type QuestionKind,
  type ReactionResult,
  type Services,
  type StoredQuestion,
  type SpaceGameRow,
} from './handler';

const START = Date.parse('2026-10-20T09:00:00Z');
const SETUP: LiveSetup = { board: { id: 'asteroid-belt' }, settings: DEFAULT_SETTINGS };
const NAMES = ['ana', 'ben', 'cat', 'dan', 'eve'];

/** A pretend Supabase: games in memory, a clock we can move, and "save only if unchanged". */
function world() {
  let clock = START;
  let nextId = 1;
  const games = new Map<string, SpaceGameRow>();
  const players = new Map<string, Omit<PlayerStatus, 'gone' | 'createdLastHour'>>();
  const friendCodes = new Set<string>();
  let multiplayerOn = true;
  let reactionsOn = false;
  let mathsSwitch: MathsSwitch = 'choose';
  let focus: MathsFocus = AUTO_FOCUS;
  for (const name of NAMES) players.set(name, { school: true, hidden: false, multiplayerEnabled: true, reactionsEnabled: false, schoolId: 1 });

  const questions = new Map<string, StoredQuestion>();
  const recorded: { player: string; once: string; answer: FactAnswer }[] = [];
  const qKey = (game: string, seat: number, kind: QuestionKind) => `${game}:${seat}:${kind}`;
  const copy = (g: SpaceGameRow | undefined) => (g ? structuredClone(g) : null);
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
      return { ...p, multiplayerEnabled: multiplayerOn, reactionsEnabled: reactionsOn, createdLastHour, gone };
    },
    mathsSwitch: async () => mathsSwitch,
    loadGame: async (id) => copy(games.get(id)),
    findWaitingByCode: async (code) => copy([...games.values()].find((g) => g.status === 'waiting' && g.code === code)),
    friendCodeTaken: async (code) => friendCodes.has(code),
    findWaitingHostedBy: async (player) => copy([...games.values()].find((g) => g.status === 'waiting' && g.host === player)),
    insertGame: async (row: NewSpaceGame) => {
      const waiting = [...games.values()].filter((g) => g.status === 'waiting');
      if (waiting.some((g) => g.code === row.code)) return 'code-taken';
      if (waiting.some((g) => g.host === row.host)) return 'already-waiting';
      const game: SpaceGameRow = {
        id: `space-${nextId++}`,
        seat2: null,
        seat3: null,
        seat4: null,
        rockets: null,
        seat_info: null,
        state: null,
        events: [],
        actions: [],
        version: 0,
        created_at: new Date(clock).toISOString(),
        started_at: null,
        turn_deadline: null,
        last_action_at: null,
        finished_at: null,
        ending: null,
        places: null,
        counts: null,
        reactions: { last: null, sent: [0, 0, 0, 0], at: [0, 0, 0, 0] },
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
    addReaction: async (id, seat, emoji): Promise<ReactionResult> => {
      const g = games.get(id)!;
      if (g.status !== 'playing') return 'not-playing';
      if (g.reactions.sent[seat] >= 20) return 'too-many';
      if (clock / 1000 - g.reactions.at[seat] < 5) return 'too-soon';
      g.reactions = {
        last: { seat, emoji, id: (g.reactions.last?.id ?? 0) + 1 },
        sent: g.reactions.sent.map((n, i) => (i === seat ? n + 1 : n)),
        at: g.reactions.at.map((t, i) => (i === seat ? clock / 1000 : t)),
      };
      return 'ok';
    },
    loadMathsContext: async () => ({ facts: [], settings: { enabledTables: [2, 5, 10] }, focus }),
    loadQuestion: async (game, seat, kind) => structuredClone(questions.get(qKey(game, seat, kind)) ?? null),
    saveQuestion: async (game, seat, kind, stamp, question) => {
      questions.set(qKey(game, seat, kind), { stamp, question, askedAt: clock, answered: false });
    },
    claimQuestion: async (game, seat, kind) => {
      const q = questions.get(qKey(game, seat, kind));
      if (!q || q.answered) return false;
      q.answered = true;
      return true;
    },
    dropQuestion: async (game, seat, kind) => void questions.delete(qKey(game, seat, kind)),
    recordAnswer: async (player, once, answer) => void recorded.push({ player, once, answer }),
  };

  const handle = spaceGameHandler(services);
  async function ask(who: string | null, body: object) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
    if (who) headers.Authorization = `Bearer ${who}-token`;
    const response = await handle(new Request('http://x/space-game', { method: 'POST', headers, body: JSON.stringify(body) }));
    const json = (await response.json()) as {
      game?: SpaceGameRow;
      error?: string;
      problem?: string;
      secondsLeft?: number;
      question?: Question;
      done?: boolean;
      right?: boolean;
      answer?: number;
    };
    return { status: response.status, ...json };
  }

  /** Ana hosts, the others join with the code. */
  async function waiting(who: string[] = ['ben'], setup: LiveSetup = SETUP) {
    const made = await ask('ana', { action: 'create', setup });
    for (const name of who) {
      const joined = await ask(name, { action: 'join', code: made.game!.code });
      if (joined.status !== 200) throw new Error(`${name}: ${joined.problem}`);
    }
    return games.get(made.game!.id)!;
  }

  async function launched(who: string[] = ['ben'], bots = 0, setup: LiveSetup = SETUP) {
    const g = await waiting(who, setup);
    const done = await ask('ana', { action: 'launch', gameId: g.id, bots });
    if (done.status !== 200) throw new Error(`launch: ${done.problem}`);
    return done.game!;
  }

  /** Whose turn it is in a playing game (their name). */
  const turnOf = (id: string) => {
    const g = games.get(id)!;
    return [g.seat1, g.seat2, g.seat3, g.seat4][g.state!.turn]!;
  };

  /** The student whose turn it is does what a Pilot would. */
  async function playTurn(id: string) {
    const g = games.get(id)!;
    const action = botAction(g.state!, 'easy', random);
    const body =
      action.kind === 'roll'
        ? { action: 'roll' }
        : action.kind === 'choose'
          ? { action: 'choose', option: action.option }
          : action.kind === 'use-item'
            ? { action: 'use-item', item: action.item, target: action.target, value: action.value }
            : { action: 'roll' };
    const done = await ask(turnOf(id), { ...body, gameId: id, version: g.version });
    if (done.status !== 200) throw new Error(`${body.action}: ${done.problem} ${done.error}`);
    return done.game!;
  }

  async function playToEnd(id: string) {
    for (let n = 0; games.get(id)!.status === 'playing'; n++) {
      if (n > 1000) throw new Error('never ended');
      await playTurn(id);
    }
    return games.get(id)!;
  }

  return {
    services,
    games,
    players,
    friendCodes,
    questions,
    recorded,
    ask,
    waiting,
    launched,
    turnOf,
    playTurn,
    playToEnd,
    tick: (ms: number) => (clock += ms),
    now: () => clock,
    setMultiplayer: (on: boolean) => (multiplayerOn = on),
    setReactions: (on: boolean) => (reactionsOn = on),
    setMathsSwitch: (mode: MathsSwitch) => (mathsSwitch = mode),
    setFocus: (next: MathsFocus) => (focus = next),
  };
}

const seats = (g: SpaceGameRow) => [g.seat1, g.seat2, g.seat3, g.seat4];

describe('starting and joining', () => {
  it('needs a real sign-in, and takes the host from the token', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create', setup: SETUP })).status).toBe(401);
    const made = await w.ask('ana', { action: 'create', setup: SETUP, host: 'ben', lobby: true });
    expect(made.game).toMatchObject({ host: 'ana', seat1: 'ana', seat2: null, status: 'waiting', in_lobby: true, setup: SETUP });
    expect(made.game!.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{5}$`));
    expect(Date.parse(made.game!.expires_at) - w.now()).toBe(WAITING_GAME_MS);
  });

  it('refuses a setup that isn’t one, and never reuses a chess or checkers code', async () => {
    const w = world();
    expect((await w.ask('ana', { action: 'create', setup: { board: { id: 'pluto' }, settings: DEFAULT_SETTINGS } })).problem).toBe(
      'bad-request',
    );
    // Fill the friend-game codes the seeded random would pick first.
    const probe = world();
    const first = (await probe.ask('ana', { action: 'create', setup: SETUP })).game!.code!;
    w.friendCodes.add(first);
    expect((await w.ask('ana', { action: 'create', setup: SETUP })).game!.code).not.toBe(first);
  });

  it('keeps one waiting game each, and limits how many are started', async () => {
    const w = world();
    const first = (await w.ask('ana', { action: 'create', setup: SETUP })).game!;
    await w.ask('ana', { action: 'create', setup: SETUP });
    expect(w.games.get(first.id)!.status).toBe('cancelled');
    for (let i = 2; i < MAX_CREATES_PER_HOUR; i++) await w.ask('ana', { action: 'create', setup: SETUP });
    expect((await w.ask('ana', { action: 'create', setup: SETUP })).problem).toBe('too-many');
  });

  it('seats up to 4 students, in the order they join, and joining twice is fine', async () => {
    const w = world();
    const g = await w.waiting(['ben', 'cat', 'dan']);
    expect(seats(g)).toEqual(['ana', 'ben', 'cat', 'dan']);
    expect((await w.ask('ben', { action: 'join', code: g.code })).game!.version).toBe(g.version);
    expect((await w.ask('eve', { action: 'join', code: g.code })).problem).toBe('full');
  });

  it('only lets you join from the lobby if the game is in it', async () => {
    const w = world();
    const g = await w.waiting([]);
    expect((await w.ask('ben', { action: 'join', gameId: g.id })).problem).toBe('not-found');
    const open = (await w.ask('cat', { action: 'create', setup: SETUP, lobby: true })).game!;
    expect((await w.ask('ben', { action: 'join', gameId: open.id })).game!.seat2).toBe('ben');
  });

  it('treats a game from another school like a code that does not exist', async () => {
    const w = world();
    const g = (await w.ask('ana', { action: 'create', setup: SETUP, lobby: true })).game!;
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('not-found');
    expect((await w.ask('ben', { action: 'join', gameId: g.id })).problem).toBe('not-found');
    w.players.get('ben')!.schoolId = 1;
    expect((await w.ask('ben', { action: 'join', code: g.code })).game!.seat2).toBe('ben');
  });

  it('turns away hidden students, old games, and everyone while games are paused', async () => {
    const w = world();
    const g = await w.waiting([]);
    w.players.get('ben')!.hidden = true;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('hidden');
    w.setMultiplayer(false);
    expect((await w.ask('cat', { action: 'join', code: g.code })).problem).toBe('paused');
    expect((await w.ask('cat', { action: 'create', setup: SETUP })).problem).toBe('paused');
    w.setMultiplayer(true);
    w.tick(WAITING_GAME_MS + 1);
    expect((await w.ask('cat', { action: 'join', code: g.code })).problem).toBe('expired');
  });

  it('lets a student leave the waiting room, and the host cancel it', async () => {
    const w = world();
    const g = await w.waiting(['ben', 'cat']);
    expect(seats((await w.ask('ben', { action: 'leave', gameId: g.id })).game!)).toEqual(['ana', 'cat', null, null]);
    expect((await w.ask('ana', { action: 'cancel', gameId: g.id })).game!.status).toBe('cancelled');
  });
});

describe('launching', () => {
  it('only the host can launch, with at least 2 students', async () => {
    const w = world();
    const alone = await w.waiting([]);
    expect((await w.ask('ana', { action: 'launch', gameId: alone.id, bots: 3 })).problem).toBe('need-players');
    const g = await w.waiting(['ben']);
    expect((await w.ask('ben', { action: 'launch', gameId: g.id })).problem).toBe('not-host');
    expect((await w.ask('ana', { action: 'launch', gameId: g.id, bots: 3 })).problem).toBe('bad-request'); // 5 rockets
    const launched = (await w.ask('ana', { action: 'launch', gameId: g.id, bots: 2 })).game!;
    expect(launched).toMatchObject({ status: 'playing', rockets: 4 });
    expect(launched.seat_info!.filter((s) => s.bot)).toHaveLength(2);
    expect(seats(launched).filter(Boolean).sort()).toEqual(['ana', 'ben']);
    // A second tap just hands back the game.
    expect((await w.ask('ana', { action: 'launch', gameId: g.id })).game!.version).toBe(launched.version);
  });

  it('shuffles the turn order, and flies any bots before the first student', async () => {
    const w = world();
    const firsts = new Set<string | null>();
    for (let i = 0; i < 12; i++) {
      w.tick(61_000); // (each round of joining uses up code tries)
      const g = await w.launched(['ben', 'cat'], 1);
      expect(w.games.get(g.id)!.seat_info![g.state!.turn].bot).toBe(false);
      firsts.add(seats(g)[0]);
    }
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('starts the clock, and saves the opening events for the screens', async () => {
    const w = world();
    const g = await w.launched();
    expect(Date.parse(g.turn_deadline!) - w.now()).toBeGreaterThanOrEqual(30_000);
    expect(g.events[0]).toEqual({ kind: 'round-start', round: 1 });
  });
});

describe('playing', () => {
  it('only takes a move from the student whose turn it is, at the version they saw', async () => {
    const w = world();
    const g = await w.launched();
    const mover = w.turnOf(g.id);
    const other = mover === 'ana' ? 'ben' : 'ana';
    expect((await w.ask(other, { action: 'roll', gameId: g.id, version: g.version })).problem).toBe('not-your-turn');
    expect((await w.ask('cat', { action: 'roll', gameId: g.id, version: g.version })).problem).toBe('not-yours');
    const rolled = await w.ask(mover, { action: 'roll', gameId: g.id, version: g.version });
    expect(rolled.game!.version).toBe(g.version + 1);
    expect(rolled.game!.events.some((e) => e.kind === 'dice')).toBe(true);
    // A double tap arrives with the old version: refused, nothing rolled twice.
    expect((await w.ask(mover, { action: 'roll', gameId: g.id, version: g.version })).problem).toBe('changed');
  });

  it('passes on the rules’ own message when a move isn’t allowed', async () => {
    const w = world();
    const g = await w.launched();
    const done = await w.ask(w.turnOf(g.id), { action: 'use-item', item: 'booster', gameId: g.id, version: g.version });
    expect(done).toMatchObject({ status: 400, problem: 'illegal', error: "You don't have that item." });
    expect((await w.ask(w.turnOf(g.id), { action: 'use-item', item: 'laser', gameId: g.id, version: g.version })).problem).toBe(
      'bad-request',
    );
  });

  it('plays whole games, with places and points for students who stayed', async () => {
    for (const [who, bots] of [[['ben'], 0], [['ben', 'cat'], 1], [['ben', 'cat', 'dan'], 0]] as const) {
      const w = world();
      const g = await w.launched([...who], bots);
      const end = await w.playToEnd(g.id);
      expect(end).toMatchObject({ status: 'finished', turn_deadline: null });
      expect(['docked', 'mission-clock']).toContain(end.ending);
      expect(end.places).toHaveLength(who.length + 1 + bots);
      const expected = end.seat_info!.map((s) => !s.bot && s.stats.turns >= MIN_TURNS_TO_COUNT);
      expect(end.counts).toEqual(expected);
      expect((await w.ask('ana', { action: 'roll', gameId: g.id, version: end.version })).problem).toBe('over');
    }
  });

  it('stops new moves while games are paused, but leaving still works', async () => {
    const w = world();
    const g = await w.launched(['ben', 'cat']);
    w.setMultiplayer(false);
    expect((await w.ask(w.turnOf(g.id), { action: 'roll', gameId: g.id, version: g.version })).problem).toBe('paused');
    const left = await w.ask('cat', { action: 'leave', gameId: g.id });
    expect(left.status).toBe(200);
  });
});

describe('the clock and autopilot', () => {
  it('won’t time anyone out early, whoever asks', async () => {
    const w = world();
    const g = await w.launched();
    const other = w.turnOf(g.id) === 'ana' ? 'ben' : 'ana';
    const early = await w.ask(other, { action: 'times-up', gameId: g.id });
    expect(early).toMatchObject({ problem: 'not-yet' });
    expect(early.secondsLeft).toBeGreaterThan(29);
  });

  it('rolls for a student who runs out of time; 3 in a row and autopilot flies them', async () => {
    const w = world();
    const g = await w.launched(['ben']);
    const sleeper = w.turnOf(g.id);
    const awake = sleeper === 'ana' ? 'ben' : 'ana';
    for (let n = 1; n <= AUTOPILOT_AFTER; n++) {
      w.tick(70_000);
      const timedOut = await w.ask(awake, { action: 'times-up', gameId: g.id });
      expect(timedOut.status).toBe(200);
      expect(timedOut.game!.events[0]).toMatchObject({ kind: 'timeout' });
      if (n < AUTOPILOT_AFTER) {
        expect(w.turnOf(g.id)).toBe(awake);
        await w.playTurn(g.id);
      }
    }
    const row = w.games.get(g.id)!;
    const seat = seats(row).indexOf(sleeper);
    expect(row.seat_info![seat]).toMatchObject({ autopilot: true, left: true });
    // From now on the sleeper's turns are flown inside the awake student's own requests.
    if (row.status === 'playing') {
      expect(w.turnOf(g.id)).toBe(awake);
      const after = await w.playTurn(g.id);
      expect(after.actions.some((a) => a.seat === seat && a.by === 'autopilot') || after.status === 'finished').toBe(true);
      expect((await w.ask(sleeper, { action: 'roll', gameId: g.id, version: after.version })).problem).toMatch(/autopilot|not-your-turn|over/);
    }
    // The sleeper can take the controls back, but the game still counts as left for them.
    const back = await w.ask(sleeper, { action: 'take-controls', gameId: g.id });
    if (back.game!.status === 'playing') expect(back.game!.seat_info![seat]).toMatchObject({ autopilot: false, left: true });
    const end = await w.playToEnd(g.id);
    expect(end.counts![seat]).toBe(false);
  });

  it('puts a student the teacher hides on autopilot straight away', async () => {
    const w = world();
    const g = await w.launched(['ben', 'cat']);
    w.players.get('cat')!.hidden = true;
    const mover = w.turnOf(g.id) === 'cat' ? 'ana' : w.turnOf(g.id);
    const asked = await w.ask(mover, { action: 'roll', gameId: g.id, version: g.version });
    // The game changed (Cat's on autopilot now), so the page looks again.
    expect(asked.problem).toBe('changed');
    const row = w.games.get(g.id)!;
    expect(row.seat_info![seats(row).indexOf('cat')]).toMatchObject({ autopilot: true, left: true });
    expect(w.turnOf(g.id)).not.toBe('cat');
  });

  it('ends the game with no points when every student has left', async () => {
    const w = world();
    const g = await w.launched(['ben'], 1);
    await w.ask('ben', { action: 'leave', gameId: g.id });
    const end = (await w.ask('ana', { action: 'leave', gameId: g.id })).game!;
    expect(end).toMatchObject({ status: 'finished', ending: 'abandoned', counts: [false, false, false] });
  });
});

describe('rematch', () => {
  it('the first to press it makes a new waiting game; everyone else’s joins it', async () => {
    const w = world();
    const g = await w.launched(['ben', 'cat']);
    const end = await w.playToEnd(g.id);
    const first = await w.ask('cat', { action: 'rematch', gameId: end.id });
    expect(first.game).toMatchObject({ host: 'cat', seat1: 'cat', status: 'waiting', setup: SETUP, in_lobby: false });
    expect(w.games.get(g.id)!.rematch_game).toBe(first.game!.id);
    const second = await w.ask('ana', { action: 'rematch', gameId: end.id });
    expect(second.game!.id).toBe(first.game!.id);
    expect(seats(second.game!)).toEqual(['cat', 'ana', null, null]);
    expect((await w.ask('ana', { action: 'rematch', gameId: end.id })).game!.id).toBe(first.game!.id);
    expect((await w.ask('dan', { action: 'rematch', gameId: end.id })).problem).toBe('not-yours');
  });

  it('isn’t for games still going', async () => {
    const w = world();
    const g = await w.launched();
    expect((await w.ask('ana', { action: 'rematch', gameId: g.id })).problem).toBe('bad-request');
  });
});

describe('reactions', () => {
  it('are off until the teacher switches them on, then limited', async () => {
    const w = world();
    const g = await w.launched();
    expect((await w.ask('ana', { action: 'react', gameId: g.id, emoji: '🎉' })).problem).toBe('reactions-off');
    w.setReactions(true);
    const sent = await w.ask('ana', { action: 'react', gameId: g.id, emoji: '🎉' });
    expect(sent.game!.reactions.last).toMatchObject({ emoji: '🎉', seat: seats(g).indexOf('ana') });
    expect(sent.game!.version).toBe(g.version); // never gets in the way of a move
    expect((await w.ask('ana', { action: 'react', gameId: g.id, emoji: '👍' })).problem).toBe('reaction-wait');
    expect((await w.ask('ana', { action: 'react', gameId: g.id, emoji: 'hello' })).problem).toBe('bad-request');
    expect((await w.ask('ana', { action: 'react', gameId: g.id, emoji: '💩' })).problem).toBe('bad-request');
    expect((await w.ask('cat', { action: 'react', gameId: g.id, emoji: '🎉' })).problem).toBe('not-yours');
    w.players.get('ben')!.hidden = true;
    expect((await w.ask('ben', { action: 'react', gameId: g.id, emoji: '🎉' })).problem).toBe('hidden');
  });
});

const MATHS_SETUP: LiveSetup = { board: { id: 'asteroid-belt' }, settings: { ...DEFAULT_SETTINGS, maths: true } };

/** Puts the student whose turn it is on a wormhole with its question waiting (as if they'd just landed there). */
function landOnWormhole(g: SpaceGameRow) {
  const square = Object.entries(g.state!.board.squares).find(([, q]) => q.kind === 'wormhole')![0];
  g.state!.rockets[g.state!.turn].position = Number(square);
  g.state!.phase = 'choice';
  g.state!.pending = { kind: 'question', square: Number(square), moment: 'wormhole' };
  g.state!.turnInfo.rolled = true;
  g.version++;
}

describe('Mission Control maths with classmates', () => {
  const typedFor = (q: Question, right: boolean) => solveQuestion(q.parts)!.answer + (right ? 0 : 1);

  it('takes maths in the host’s setup, and shows the waiting room the setting', async () => {
    const w = world();
    const made = await w.ask('ana', { action: 'create', setup: MATHS_SETUP });
    expect(made.status).toBe(200);
    expect(made.game!.setup.settings.maths).toBe(true);
  });

  it('follows the teacher’s switch: Off refuses maths, On makes every game a maths game', async () => {
    const w = world();
    w.setMathsSwitch('off');
    const refused = await w.ask('ana', { action: 'create', setup: MATHS_SETUP });
    expect(refused.problem).toBe('maths-off');
    expect(refused.status).toBe(403);
    expect((await w.ask('ana', { action: 'create', setup: SETUP })).game!.setup.settings.maths).toBe(false);
    w.setMathsSwitch('on');
    const forced = await w.ask('ben', { action: 'create', setup: SETUP });
    expect(forced.game!.setup.settings.maths).toBe(true);
    w.setMathsSwitch('choose');
    expect((await w.ask('cat', { action: 'create', setup: SETUP })).game!.setup.settings.maths).toBe(false);
    expect((await w.ask('dan', { action: 'create', setup: MATHS_SETUP })).game!.setup.settings.maths).toBe(true);
  });

  it('a game that was waiting when the switch changed follows the switch at launch', async () => {
    const w = world();
    const made = (await w.ask('ana', { action: 'create', setup: MATHS_SETUP })).game!;
    await w.ask('ben', { action: 'join', code: made.code });
    w.setMathsSwitch('off');
    const launched = await w.ask('ana', { action: 'launch', gameId: made.id });
    expect(launched.game!.setup.settings.maths).toBe(false);
    expect(launched.game!.state!.settings.maths).toBe(false);
  });

  it('picks the question on the server and never sends the answer', async () => {
    const w = world();
    const g = await w.launched(['ben'], 0, MATHS_SETUP);
    const row = w.games.get(g.id)!;
    landOnWormhole(row);
    const who = w.turnOf(g.id);
    const asked = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version: row.version });
    expect(asked.question!.parts).toHaveLength(5);
    expect(JSON.stringify(asked)).not.toContain('"answer"');
    // Asking again (a reload) shows the same question.
    const again = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version: row.version });
    expect(again.question).toEqual(asked.question);
    // The other student can't ask for it.
    const other = who === 'ana' ? 'ben' : 'ana';
    expect((await w.ask(other, { action: 'question', kind: 'moment', gameId: g.id, version: row.version })).problem).toBe('not-your-turn');
  });

  it('marks the answer itself: right flies further, wrong is a normal ride, and nobody can just claim "right"', async () => {
    const w = world();
    const g = await w.launched(['ben'], 0, MATHS_SETUP);
    const row = w.games.get(g.id)!;
    landOnWormhole(row);
    const who = w.turnOf(g.id);
    const version = row.version;
    // "choose 1" (claiming a right answer) is refused.
    const claim = await w.ask(who, { action: 'choose', gameId: g.id, version, option: 1 });
    expect(claim.status).toBe(400);
    expect(claim.problem).toBe('illegal');
    const asked = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version });
    // A made-up answer to a question that wasn't asked of this version.
    expect((await w.ask(who, { action: 'answer', kind: 'moment', gameId: g.id, version: version + 1, answer: 1 })).problem).toBe('changed');
    w.tick(1500);
    const done = await w.ask(who, { action: 'answer', kind: 'moment', gameId: g.id, version, answer: typedFor(asked.question!, true), ms: 900 });
    expect(done.status).toBe(200);
    expect(done.right).toBe(true);
    expect(done.game!.events).toContainEqual(expect.objectContaining({ kind: 'question', correct: true }));
    expect(done.game!.version).toBe(version + 1);
    expect(w.recorded).toHaveLength(1);
    expect(w.recorded[0]).toMatchObject({ player: who, answer: { correct: true, ms: 900 } });
    // The question is used up: answering again is refused.
    expect((await w.ask(who, { action: 'answer', kind: 'moment', gameId: g.id, version, answer: 1 })).status).not.toBe(200);
  });

  it('a wrong answer is recorded as wrong, and the server says what the answer was', async () => {
    const w = world();
    const g = await w.launched(['ben'], 0, MATHS_SETUP);
    const row = w.games.get(g.id)!;
    landOnWormhole(row);
    const who = w.turnOf(g.id);
    const asked = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version: row.version });
    w.tick(2000);
    const done = await w.ask(who, { action: 'answer', kind: 'moment', gameId: g.id, version: row.version, answer: typedFor(asked.question!, false), ms: 99_999 });
    expect(done.right).toBe(false);
    expect(done.answer).toBe(solveQuestion(asked.question!.parts)!.answer);
    // The time is never more than the server saw.
    expect(w.recorded[0].answer).toMatchObject({ correct: false, ms: 2000 });
  });

  describe('with a maths focus', () => {
    const teacherFocus = (skills: string[], onlyThese = true): MathsFocus => ({
      source: 'teacher-class', skills, onlyThese, endsAt: '2026-12-01T00:00:00Z', canChoose: true, own: null,
    });

    it('asks from the focus: early facts here, which the times-table marking could not read', async () => {
      const w = world();
      w.setFocus(teacherFocus(['dbl-half-10']));
      const g = await w.launched(['ben'], 0, MATHS_SETUP);
      const row = w.games.get(g.id)!;
      landOnWormhole(row);
      const who = w.turnOf(g.id);
      const asked = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version: row.version });
      const solved = solveParts(asked.question!.parts)!;
      expect(solved.keys.some((k) => /^(dbl|half):/.test(k))).toBe(true);
      expect(JSON.stringify(asked)).not.toContain('"answer"');
      w.tick(1500);
      const done = await w.ask(who, { action: 'answer', kind: 'moment', gameId: g.id, version: row.version, answer: solved.answer, ms: 900 });
      expect(done.status).toBe(200);
      expect(done.right).toBe(true);
      // The record is the one the question was asked for.
      expect(w.recorded[0].answer.key).toMatch(/^(dbl|half):/);
      expect(w.recorded[0].answer.correct).toBe(true);
    });

    it('marks a wrong answer wrong, and says what the answer was', async () => {
      const w = world();
      w.setFocus(teacherFocus(['facts-10']));
      const g = await w.launched(['ben'], 0, MATHS_SETUP);
      const row = w.games.get(g.id)!;
      landOnWormhole(row);
      const who = w.turnOf(g.id);
      const asked = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version: row.version });
      const solved = solveParts(asked.question!.parts)!;
      w.tick(1500);
      const done = await w.ask(who, { action: 'answer', kind: 'moment', gameId: g.id, version: row.version, answer: solved.answer + 1, ms: 900 });
      expect(done.right).toBe(false);
      expect(done.answer).toBe(solved.answer);
      expect(w.recorded[0].answer.correct).toBe(false);
    });

    it('with no focus, the questions are times tables as always', async () => {
      const w = world();
      w.setFocus(AUTO_FOCUS);
      const g = await w.launched(['ben'], 0, MATHS_SETUP);
      const row = w.games.get(g.id)!;
      landOnWormhole(row);
      const who = w.turnOf(g.id);
      const asked = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version: row.version });
      expect(solveQuestion(asked.question!.parts)).not.toBeNull();
    });

    it('still marks a question that was saved before the focus existed (no record on it)', async () => {
      const w = world();
      const g = await w.launched(['ben'], 0, MATHS_SETUP);
      const row = w.games.get(g.id)!;
      landOnWormhole(row);
      const who = w.turnOf(g.id);
      const asked = await w.ask(who, { action: 'question', kind: 'moment', gameId: g.id, version: row.version });
      const seat = [row.seat1, row.seat2, row.seat3, row.seat4].indexOf(who);
      const stored = [...w.questions.entries()].find(([k]) => k.includes(`${g.id}`))!;
      const old = { ...stored[1].question } as Record<string, unknown>;
      delete old.answer;
      delete old.factKey;
      stored[1].question = old as unknown as Question;
      void seat;
      w.tick(1500);
      const done = await w.ask(who, { action: 'answer', kind: 'moment', gameId: g.id, version: row.version, answer: solveQuestion(asked.question!.parts)!.answer, ms: 900 });
      expect(done.right).toBe(true);
      expect(w.recorded[0].answer.key).toBe(solveQuestion(asked.question!.parts)!.key);
    });
  });

  it('refuses questions when maths is off in the game', async () => {
    const w = world();
    const g = await w.launched(['ben']);
    const who = w.turnOf(g.id);
    expect((await w.ask(who, { action: 'question', kind: 'charge', gameId: g.id })).problem).toBe('illegal');
  });

  it('the question after a turn: none on a first turn, one a turn, right waits for the next turn, wrong leaves no trace', async () => {
    const w = world();
    const g = await w.launched(['ben'], 0, MATHS_SETUP);
    const first = w.turnOf(g.id);
    const second = first === 'ana' ? 'ben' : 'ana';
    expect((await w.ask(first, { action: 'question', kind: 'charge', gameId: g.id })).problem).toBe('illegal');
    await w.playTurn(g.id);
    expect(w.turnOf(g.id)).toBe(second);
    // The first student's turn is over: their question can be asked, during the second student's turn.
    const asked = await w.ask(first, { action: 'question', kind: 'charge', gameId: g.id });
    expect(asked.question).toBeDefined();
    expect((await w.ask(first, { action: 'question', kind: 'charge', gameId: g.id })).question).toEqual(asked.question);
    const done = await w.ask(first, { action: 'answer', kind: 'charge', gameId: g.id, answer: typedFor(asked.question!, true), ms: 2000 });
    expect(done.right).toBe(true);
    const row = w.games.get(g.id)!;
    expect(row.seat_info![[row.seat1, row.seat2].indexOf(first)].charged).toBe(true);
    // Only once: the same turn can't be asked or answered again.
    expect((await w.ask(first, { action: 'question', kind: 'charge', gameId: g.id })).done).toBe(true);
    expect((await w.ask(first, { action: 'answer', kind: 'charge', gameId: g.id, answer: 1 })).status).not.toBe(200);
    // Their next turn starts with the +1 already in.
    await w.playTurn(g.id); // the second student's turn
    const after = w.games.get(g.id)!;
    expect(after.state!.turn).toBe([after.seat1, after.seat2].indexOf(first));
    expect(after.state!.turnInfo.mathsCharge).toBe(true);
    expect(after.actions.map((a) => a.action)).toContain('charge:1');
    const seat = [after.seat1, after.seat2].indexOf(first);
    expect(after.seat_info![seat].charged).toBe(false);
  });

  it('a wrong charge answer changes nothing in the game', async () => {
    const w = world();
    const g = await w.launched(['ben'], 0, MATHS_SETUP);
    const first = w.turnOf(g.id);
    await w.playTurn(g.id);
    const asked = await w.ask(first, { action: 'question', kind: 'charge', gameId: g.id });
    const before = w.games.get(g.id)!.version;
    const done = await w.ask(first, { action: 'answer', kind: 'charge', gameId: g.id, answer: typedFor(asked.question!, false), ms: 2000 });
    expect(done.right).toBe(false);
    expect(w.games.get(g.id)!.version).toBe(before);
    expect(w.games.get(g.id)!.seat_info!.every((s) => !s.charged)).toBe(true);
    expect(w.recorded[0].answer.correct).toBe(false);
  });

  it('a right charge answer given on your own turn, before rolling, counts straight away; after rolling, not', async () => {
    const w = world();
    const g = await w.launched(['ben'], 0, MATHS_SETUP);
    const first = w.turnOf(g.id);
    await w.playTurn(g.id);
    await w.playTurn(g.id); // back to the first student
    expect(w.turnOf(g.id)).toBe(first);
    const asked = await w.ask(first, { action: 'question', kind: 'charge', gameId: g.id });
    const done = await w.ask(first, { action: 'answer', kind: 'charge', gameId: g.id, answer: typedFor(asked.question!, true), ms: 1500 });
    expect(done.game!.state!.turnInfo.mathsCharge).toBe(true);
    // The clock isn't restarted by the +1.
    expect(done.game!.turn_deadline).toBe(w.games.get(g.id)!.turn_deadline);
    const rolled = await w.ask(first, { action: 'roll', gameId: g.id, version: done.game!.version });
    expect(rolled.game!.events).toContainEqual(expect.objectContaining({ kind: 'roll', changes: expect.arrayContaining(['maths-charge']) }));
  });
});

describe('the server function', () => {
  it('refuses unknown actions and unreadable requests', async () => {
    const w = world();
    expect((await w.ask('ana', { action: 'teleport' })).problem).toBe('bad-request');
    expect((await w.ask('ana', { action: 'roll', gameId: 'nope', version: 0 })).problem).toBe('not-yours');
  });

  it('has an up-to-date index.ts (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('space-game');
    expect(readFileSync(resolve('supabase/functions/space-game/index.ts'), 'utf8')).toBe(built);
  });
});
