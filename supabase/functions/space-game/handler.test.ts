import { describe, expect, it } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import type { FactAnswer } from '../../../shared/maths/leitner';
import type { Question } from '../../../shared/maths/skillPack';
import { solveQuestion } from '../../../shared/maths/skillPacks/timesTables';
import { AUTO_FOCUS, type MathsFocus } from '../../../shared/maths/focus';
import { DEFAULT_SETTINGS } from '../../../shared/space/engine';
import type { LiveSetup } from '../../../shared/space/live';
import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import {
  MAX_CREATES_PER_HOUR,
  spaceGameHandler,
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
    tick: (ms: number) => (clock += ms),
    now: () => clock,
    setMultiplayer: (on: boolean) => (multiplayerOn = on),
    setReactions: (on: boolean) => (reactionsOn = on),
    setMathsSwitch: (mode: MathsSwitch) => (mathsSwitch = mode),
    setFocus: (next: MathsFocus) => (focus = next),
  };
}

describe('starting and joining', () => {
  it('refuses no sign-in, another school’s game, hidden students, and too many new games', async () => {
    const w = world();
    expect((await w.ask(null, { action: 'create', setup: SETUP })).status).toBe(401);
    const made = await w.ask('ana', { action: 'create', setup: SETUP, host: 'ben', lobby: true });
    expect(made.game).toMatchObject({ host: 'ana', seat1: 'ana' });
    const g = made.game!;
    w.players.get('ben')!.schoolId = 2;
    expect((await w.ask('ben', { action: 'join', code: g.code })).problem).toBe('not-found');
    expect((await w.ask('ben', { action: 'join', gameId: g.id })).problem).toBe('not-found');
    w.players.get('cat')!.hidden = true;
    expect((await w.ask('cat', { action: 'join', code: g.code })).problem).toBe('hidden');
    for (let i = 1; i < MAX_CREATES_PER_HOUR; i++) await w.ask('ana', { action: 'create', setup: SETUP });
    expect((await w.ask('ana', { action: 'create', setup: SETUP })).problem).toBe('too-many');
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

});
