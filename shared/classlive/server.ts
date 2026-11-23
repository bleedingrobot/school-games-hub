/**
 * Class Live's server steps (docs/CLASSLIVE-PLAN.md section 5), with the database passed in (`ClassLiveServices`), so the
 * edge function (supabase/functions/classlive), the tests and the `?pretend=30` preview all run the same code. Copies
 * Class Showdown's pattern (shared/showdown/server.ts): the room keeps the whole session (hidden from pupils), every step
 * loads it, applies one change and saves it at the version it was loaded at (compare-and-swap); a refused save runs the
 * step again on the newer session.
 *
 * Three rows come out of every save:
 *   - the room's `view` (RoomView): what any pupil of the class may read: the game, its state, counts. No names.
 *   - the room's `screen` (ScreenView): what the projector draws, with first names and the latest events. Teachers only.
 *   - each changed pupil's own row (PlayerView).
 *
 * Teacher steps: open, view, start, end, spotlight. Pupil steps: join, play.
 */
import { ARMS, anchorOf, armCount, newStars, pickAnchor, spotlight, tryFact, type Arm, type Star, type StarLevel, type StarsEvent, type StarsGame, type StarsReply } from './stars';
import { LEVELS } from './stars';
import { answered, canGuess, flip, flipped, guess, guessOpen, newMural, reveal, TILES, ANSWER_GAP_MS, type MuralEvent, type MuralGame, type Picture } from './mural';
import type { FactAnswer } from '../maths/leitner';
import { markQuestion, publicQuestion, sameAnswer, seededRandom, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { isUntimed } from '../maths/untimed';
import { makeSpacePack, pickSpaceQuestion } from '../space/mathsQuestion';
import { answerBox, boxOf, newSerpent, SERPENT_LEVELS, wakeAt, type SerpentBox, type SerpentEvent, type SerpentGame, type SerpentLevel, type SerpentReply } from './serpent';

export const ACTIVITIES = ['stars', 'serpent', 'mural'] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const LENGTHS = [0, 5, 10, 15] as const;
export const ACTIVITY_NAMES: Record<Activity, string> = { stars: 'Star Web', serpent: 'Serpent Chain', mural: 'Mystery Mural' };

export interface LivePlayer {
  id: string;
  name: string;
  joinedAt: number;
  /** A colour number (0 to 11) for their token on the projector. */
  colour: number;
}

export type Game = StarsGame | SerpentGame | MuralGame;
export type GameEvent = StarsEvent | SerpentEvent | MuralEvent;

export interface Session {
  seed: number;
  activity: Activity;
  state: 'lobby' | 'live' | 'over';
  /** 0: no clock, the teacher ends it. Otherwise minutes. */
  lengthMin: number;
  players: Record<string, LivePlayer>;
  order: string[];
  game: Game;
}

export type Event =
  | GameEvent
  | { type: 'join'; t: number; pupil: string }
  | { type: 'start'; t: number }
  | { type: 'over'; t: number; why: 'teacher' | 'time' };

/** What pupils of the class may read of a room (their pop-up, their device). No names. */
export interface RoomView {
  activity: Activity;
  state: Session['state'];
  lengthMin: number;
  startedAt: number | null;
  players: number;
  game: PublicGame;
}

export type PublicGame =
  | { kind: 'stars'; anchor: StarsGame['anchor']; arms: Record<Arm, number>; total: number; creature: boolean; supernova: boolean }
  | { kind: 'serpent'; level: SerpentLevel; energy: number; wakeAt: number; awake: boolean; heads: number; tail: number }
  /** `tiles`: one character a tile, '1' flipped, '0' not. Never the picture itself (until it is revealed). */
  | { kind: 'mural'; tiles: string; flipped: number; guessOpen: boolean; choices: Picture[]; solvers: number; revealed: boolean; picture: Picture | null };

/** What the projector draws: the whole game, names (when allowed) and the newest events (each with a number). */
export interface ScreenView extends Omit<RoomView, 'game'> {
  showNames: boolean;
  people: { id: string; name: string | null; colour: number }[];
  game: Game;
  seq: number;
  events: (Event & { seq: number })[];
}

/** One pupil's own row. */
export interface PlayerView {
  player: string;
  name: string;
  colour: number;
  game:
    | { kind: 'stars'; found: number; glows: number; tries: number; mine: string[] }
    | { kind: 'serpent'; box: SerpentBox | null; at: number; right: number; shown: number }
    | { kind: 'mural'; flips: number; right: number; answered: number; tiles: number; canGuess: boolean; guesses: number; gotIt: number; nextAt: number };
}

export interface RoomRow {
  id: number;
  classId: string;
  teacher: string;
  version: number;
  startedAt: number | null;
  showNames: boolean;
  session: Session;
  /** The screen's event count, so numbers carry on across saves. */
  seq: number;
  events: ScreenView['events'];
}

export interface Change {
  session: Session;
  view: RoomView;
  screen: ScreenView;
  startedAt: number | null;
  players: PlayerView[];
  /** Marks this question answered in the same save (refused as 'answered' if it already was). */
  claim?: { player: string; slot: number; value: number; right: boolean };
}

/** A pupil's kept Mystery Mural question (pupils can't read these). */
export interface StoredQuestion {
  slot: number;
  question: Question;
  answered: boolean;
}

export type Busy = 'busy';

export interface ClassLiveServices {
  now(): number;
  random(): number;
  /** Does this teacher teach this class, and is Class Live on for it? Null if they don't teach it. */
  teacherClass(teacher: string, classId: string): Promise<{ enabled: boolean; showNames: boolean } | null | Busy>;
  /** A pupil's class, first name and switch. Null if they aren't a pupil in a class. */
  pupil(player: string): Promise<{ classId: string; name: string; enabled: boolean } | null | Busy>;
  /** Makes a room (any other open room of the class is closed). */
  openRoom(classId: string, teacher: string, change: Change): Promise<number | Busy>;
  loadRoom(room: number): Promise<RoomRow | null | Busy>;
  /** The class's newest room opened in the last 3 hours, or null. */
  classRoom(classId: string): Promise<RoomRow | null | Busy>;
  /** Saves a step if the room is still at `version`. */
  save(room: number, version: number, change: Change): Promise<'ok' | 'stale' | 'answered' | Busy>;
  /** Mystery Mural's way-A maths: the pupil's facts, focus and class settings. */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** The pupil's question not yet answered (the newest), or null. */
  openQuestion(room: number, player: string): Promise<StoredQuestion | null | Busy>;
  loadQuestion(room: number, player: string, slot: number): Promise<StoredQuestion | null | Busy>;
  /** Keeps a new question at the pupil's next slot, unless one is still open: then that one comes back. */
  keepQuestion(room: number, player: string, question: Question): Promise<StoredQuestion | Busy>;
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
}

export type StepReply = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): StepReply => ({ status: 200, body });
const no = (status: number, error: string, reason?: string): StepReply => ({ status, body: { error, ...(reason ? { reason } : {}) } });
const busy = () => no(503, 'Class Live is very busy. Try again!', 'busy');
const OFF = 'Class Live is switched off for this class.';
const MAX_TRIES = 8;
/** Events the screen row keeps (the projector animates the ones it hasn't seen). */
const KEEP_EVENTS = 40;
/** Most pupils in one room. */
export const MAX_PLAYERS = 40;

const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 20) || 'A player';

export function publicGame(g: Game, players: number): PublicGame {
  if (g.kind === 'mural') {
    return {
      kind: 'mural', tiles: g.tiles.map((x) => (x ? '1' : '0')).join(''), flipped: flipped(g), guessOpen: guessOpen(g), choices: g.choices,
      solvers: g.solvers.length, revealed: g.revealed, picture: g.revealed ? g.picture : null,
    };
  }
  if (g.kind === 'serpent') {
    return { kind: 'serpent', level: g.chain.level, energy: g.energy, wakeAt: wakeAt(players), awake: g.awake, heads: g.heads.length, tail: g.tail };
  }
  const arms = Object.fromEntries(ARMS.map((a) => [a, armCount(g, a)])) as Record<Arm, number>;
  return { kind: 'stars', anchor: g.anchor, arms, total: g.stars.length, creature: g.creature, supernova: g.supernova };
}

export function roomView(s: Session, startedAt: number | null): RoomView {
  return { activity: s.activity, state: s.state, lengthMin: s.lengthMin, startedAt, players: s.order.length, game: publicGame(s.game, s.order.length) };
}

function screenView(row: Pick<RoomRow, 'showNames' | 'seq' | 'events'>, s: Session, startedAt: number | null): ScreenView {
  const { game: _g, ...base } = roomView(s, startedAt);
  return {
    ...base,
    showNames: row.showNames,
    people: s.order.map((id) => ({ id, name: row.showNames ? firstName(s.players[id].name) : null, colour: s.players[id].colour })),
    game: s.game,
    seq: row.seq,
    events: row.events,
  };
}

export function playerView(s: Session, id: string): PlayerView {
  const p = s.players[id];
  if (s.game.kind === 'mural') {
    const m = s.game.mine[id];
    return {
      player: id, name: firstName(p.name), colour: p.colour,
      game: {
        kind: 'mural', flips: m?.flips ?? 0, right: m?.right ?? 0, answered: m?.answered ?? 0, tiles: m?.tiles ?? 0,
        canGuess: canGuess(s.game, id), guesses: m?.guesses ?? 0, gotIt: m?.gotIt ?? 0, nextAt: m ? m.lastAt + ANSWER_GAP_MS : 0,
      },
    };
  }
  if (s.game.kind === 'serpent') {
    const m = s.game.mine[id];
    return {
      player: id, name: firstName(p.name), colour: p.colour,
      game: { kind: 'serpent', box: boxOf(s.game, id), at: m?.at ?? 0, right: m?.right ?? 0, shown: m?.shown ?? 0 },
    };
  }
  const mine = s.game.mine[id];
  return {
    player: id,
    name: firstName(p.name),
    colour: p.colour,
    game: {
      kind: 'stars', found: mine?.found ?? 0, glows: mine?.glows ?? 0, tries: mine?.tries ?? 0,
      mine: s.game.stars.filter((x) => x.by === id).map((x) => x.text),
    },
  };
}

/** Time in ms since the start (0 in the lobby). */
const timeOf = (row: Pick<RoomRow, 'startedAt'>, now: number) => (row.startedAt === null ? 0 : Math.max(0, now - row.startedAt));

/** Is a timed session past its end? */
const timeUp = (s: Session, row: Pick<RoomRow, 'startedAt'>, now: number) => s.state === 'live' && s.lengthMin > 0 && timeOf(row, now) >= s.lengthMin * 60_000;

type Step<T> = (s: Session, t: number, row: RoomRow) => { reply: T; events: Event[]; startedAt?: number | null; players?: string[]; claim?: Change['claim'] } | { refuse: StepReply };

/** Loads the room, applies one step and saves it if nobody else saved first (else runs it again on the newer session). */
async function mutate<T>(sv: ClassLiveServices, room: number, step: Step<T>): Promise<{ reply: T; row: RoomRow; session: Session } | { refuse: StepReply }> {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const row = await sv.loadRoom(room);
    if (row === 'busy') return { refuse: busy() };
    if (!row) return { refuse: no(404, "That room couldn't be found.", 'gone') };
    const s = structuredClone(row.session);
    const now = sv.now();
    const t = timeOf(row, now);
    const events: Event[] = [];
    // A timed session ends by itself, whoever's step comes first.
    if (timeUp(s, row, now)) {
      s.state = 'over';
      events.push({ type: 'over', t, why: 'time' });
    }
    const out = step(s, t, row);
    if ('refuse' in out) {
      if (!events.length) return out;
      // Still save the ending, then refuse.
    } else events.push(...out.events);
    const startedAt = 'refuse' in out || out.startedAt === undefined ? row.startedAt : out.startedAt;
    const changed = new Set<string>('refuse' in out ? [] : (out.players ?? []));
    const claim = 'refuse' in out ? undefined : out.claim;
    if (!events.length && !changed.size && !claim && ('refuse' in out || out.startedAt === undefined)) {
      return 'refuse' in out ? out : { reply: out.reply, row, session: s };
    }
    let seq = row.seq;
    const numbered = events.map((e) => ({ ...e, seq: ++seq }));
    const next: RoomRow = { ...row, startedAt, seq, events: [...row.events, ...numbered].slice(-KEEP_EVENTS), session: s };
    for (const e of events) if ('pupil' in e && typeof e.pupil === 'string') changed.add(e.pupil);
    const players = [...changed].filter((id) => s.players[id]).map((id) => playerView(s, id));
    const saved = await sv.save(room, row.version, { session: s, view: roomView(s, startedAt), screen: screenView(next, s, startedAt), startedAt, players, ...(claim ? { claim } : {}) });
    if (saved === 'busy') return { refuse: busy() };
    if (saved === 'answered') return { refuse: no(409, "You've already answered that one.", 'answered') };
    if (saved === 'ok') return 'refuse' in out ? out : { reply: out.reply, row: { ...next, version: row.version + 1 }, session: s };
    await new Promise((done) => setTimeout(done, 5 + Math.floor(sv.random() * 25 * (tries + 1))));
  }
  return { refuse: busy() };
}

const readRoom = (v: unknown): number | null => (Number.isSafeInteger(v) && (v as number) > 0 ? (v as number) : null);

/** A new session from the teacher's choices, or a refusal. */
export function newSession(body: Record<string, unknown>, seed: number, random: () => number): Session | string {
  const activity = ACTIVITIES.find((a) => a === body.activity) ?? 'stars';
  const lengthMin = (LENGTHS as readonly number[]).includes(body.length as number) ? (body.length as number) : 0;
  let game: Game;
  if (activity === 'stars') {
    const own = anchorOf(Number(body.x), Number(body.y));
    const level = (Object.keys(LEVELS) as StarLevel[]).find((l) => l === body.level) ?? 'middle';
    if ((body.x !== undefined || body.y !== undefined) && !own) return 'Pick two different numbers from 2 to 12.';
    game = newStars(own ?? pickAnchor(level, random), own ? 'own' : level);
  } else if (activity === 'serpent') {
    const level = SERPENT_LEVELS.find((l) => l === body.level) ?? 'gold';
    game = newSerpent(level, random);
  } else game = newMural(random);
  return { seed, activity, state: 'lobby', lengthMin, players: {}, order: [], game };
}

/** One request from a signed-in person (`who`). */
export async function classLiveStep(sv: ClassLiveServices, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const action = body.action;

  // ---- Teacher steps ----
  if (action === 'open') {
    const classId = typeof body.classId === 'string' && /^[0-9a-f-]{36}$/i.test(body.classId) ? body.classId : null;
    if (!classId) return no(400, 'Pick a class first.');
    const teach = await sv.teacherClass(who, classId);
    if (teach === 'busy') return busy();
    if (!teach) return no(403, "That isn't one of your classes.", 'not-yours');
    if (!teach.enabled) return no(403, OFF, 'off');
    const session = newSession(body, Math.floor(sv.random() * 2 ** 31), () => sv.random());
    if (typeof session === 'string') return no(400, session);
    const row = { showNames: teach.showNames, seq: 0, events: [] };
    const change: Change = { session, view: roomView(session, null), screen: screenView(row, session, null), startedAt: null, players: [] };
    const id = await sv.openRoom(classId, who, change);
    if (id === 'busy') return busy();
    return ok({ room: id, screen: change.screen, now: sv.now() });
  }

  if (action === 'view' || action === 'start' || action === 'end' || action === 'spotlight' || action === 'reveal') {
    const room = readRoom(body.room);
    if (!room) return no(400, "That room couldn't be found.");
    const row = await sv.loadRoom(room);
    if (row === 'busy') return busy();
    // Only the teacher who opened it runs the projector.
    if (!row || row.teacher !== who) return no(403, "That isn't your room.", 'not-yours');
    const teach = await sv.teacherClass(who, row.classId);
    if (teach === 'busy') return busy();
    if (!teach) return no(403, "That isn't one of your classes.", 'not-yours');
    if (!teach.enabled && action !== 'view' && action !== 'end') return no(403, OFF, 'off');

    const done = await mutate(sv, room, (s, t) => {
      if (action === 'view') return { reply: null, events: [] };
      if (action === 'start') {
        if (s.state !== 'lobby') return { refuse: no(409, 'It has already started.', 'not-now') };
        s.state = 'live';
        return { reply: null, events: [{ type: 'start', t: 0 }], startedAt: sv.now() };
      }
      if (action === 'reveal') {
        if (s.game.kind !== 'mural') return { refuse: no(400, 'Only a mural can be revealed.') };
        return { reply: null, events: reveal(s.game, t) };
      }
      if (action === 'spotlight') {
        const id = body.id === null ? null : Number.isInteger(body.id) ? (body.id as number) : undefined;
        if (id === undefined || s.game.kind !== 'stars') return { refuse: no(400, 'Pick a star.') };
        return { reply: null, events: spotlight(s.game, id, t) };
      }
      // end
      if (s.state === 'over') return { reply: null, events: [] };
      s.state = 'over';
      return { reply: null, events: [{ type: 'over', t, why: 'teacher' }] };
    });
    if ('refuse' in done) return done.refuse;
    return ok({ room, screen: screenView(done.row, done.session, done.row.startedAt), now: sv.now() });
  }

  // ---- Pupil steps ----
  if (action === 'join' || action === 'play' || action === 'ask' || action === 'answer') {
    const me = await sv.pupil(who);
    if (me === 'busy') return busy();
    if (!me) return no(403, 'Class Live is for pupils in a class.', 'no-class');
    if (!me.enabled) return no(403, OFF, 'off');
    let room: number | null;
    if (action === 'join') {
      const open = await sv.classRoom(me.classId);
      if (open === 'busy') return busy();
      if (!open || open.session.state === 'over') return no(404, 'There is nothing on in your class right now.', 'none');
      room = open.id;
    } else room = readRoom(body.room);
    if (!room) return no(400, "That room couldn't be found.");
    const cur = await sv.loadRoom(room);
    if (cur === 'busy') return busy();
    if (!cur || cur.classId !== me.classId) return no(403, "That room isn't in your class.", 'not-yours');

    if (action === 'join') {
      const done = await mutate(sv, room, (s, t) => {
        if (s.state === 'over') return { refuse: no(409, 'This one has finished.', 'over') };
        if (s.players[who]) return { reply: null, events: [], players: [who] };
        if (s.order.length >= MAX_PLAYERS) return { refuse: no(409, 'This room is full.', 'full') };
        s.players[who] = { id: who, name: me.name, joinedAt: t, colour: s.order.length % 12 };
        s.order.push(who);
        return { reply: null, events: [{ type: 'join', t, pupil: who }] };
      });
      if ('refuse' in done) return done.refuse;
      return ok({ room, view: roomView(done.session, done.row.startedAt), me: playerView(done.session, who), now: sv.now() });
    }

    if (!cur.session.players[who]) return no(409, 'Join first.', 'not-playing');
    if (action === 'ask' || action === 'answer') return muralMaths(sv, cur, who, body);
    const done = await mutate<StarsReply | SerpentReply | MuralReply>(sv, room, (s, t) => {
      if (s.state !== 'live') return { refuse: no(409, s.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s.state) };
      if (s.game.kind === 'mural') {
        if (body.tile !== undefined) {
          const out = flip(s.game, who, body.tile, t);
          if (!out.ok) {
            const words = { no_flips: 'Answer a question to earn a flip!', taken: 'That tile is already flipped. Pick another!', bad_tile: 'Pick a tile.', revealed: 'The picture is showing!' };
            return { refuse: no(409, words[out.reason], out.reason) };
          }
          return { reply: { result: 'flipped' as const, tile: body.tile as number }, events: out.events, players: [who] };
        }
        const out = guess(s.game, who, body.guess, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'not_now' ? 'Not yet! Wait for more tiles.' : 'Pick a picture.', out.reason) };
        return { reply: { result: out.right ? ('guessed' as const) : ('not_it' as const) }, events: out.events, players: [who] };
      }
      if (s.game.kind === 'serpent') {
        const out = answerBox(s.game, who, body.box, body.value, t, s.order.length);
        if (!out.ok) {
          const words = { too_soon: 'One at a time!', stale: 'That box is done. Here is your next one.', done: 'You have finished the whole chain!', unreadable: "That answer couldn't be read." };
          return { refuse: { status: 409, body: { error: words[out.reason], reason: out.reason, box: boxOf(s.game, who) } } };
        }
        return { reply: out.reply, events: out.events, players: [who] };
      }
      const out = tryFact(s.game, who, body.fact, t);
      if (!out.ok) return { refuse: no(409, 'One at a time!', out.reason) };
      return { reply: out.reply, events: out.events, players: [who] };
    });
    if ('refuse' in done) return done.refuse;
    return ok({ room, reply: done.reply, view: roomView(done.session, done.row.startedAt), me: playerView(done.session, who), now: sv.now() });
  }

  return no(400, "That couldn't be read.");
}

export type MuralReply = { result: 'flipped'; tile: number } | { result: 'guessed' | 'not_it' };

/** Longest answer time kept (ms), as Class Showdown. */
const MAX_ANSWER_MS = 120_000;

/** The pupil's next question from their own focus pack (way A), never an untimed (worked-out) skill in a live game. */
export function makeQuestion(context: MathsContext, seed: string): Question | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const pack = makeSpacePack(context.facts, context.focus, context.settings, seededRandom(`${seed}:${attempt}`));
    const q = pickSpaceQuestion(pack, context.settings);
    if (q && !isUntimed(q.factKey) && markQuestion(q)) return q;
  }
  return null;
}

async function nextQuestion(sv: ClassLiveServices, row: RoomRow, who: string): Promise<PublicQuestion | null | Busy> {
  const open = await sv.openQuestion(row.id, who);
  if (open === 'busy') return 'busy';
  if (open) return publicQuestion(open.question, open.slot);
  const ctx = await sv.mathsContext(who);
  if (!ctx) return null;
  const g = row.session.game;
  const m = g.kind === 'mural' ? g.mine[who] : undefined;
  const q = makeQuestion(ctx, `${row.session.seed}:${who}:${m?.answered ?? 0}`);
  if (!q) return null;
  const kept = await sv.keepQuestion(row.id, who, q);
  if (kept === 'busy') return 'busy';
  return publicQuestion(kept.question, kept.slot);
}

/** Mystery Mural's maths: `ask` (the open question or a new one) and `answer` (marked here, claimed once, recorded). */
async function muralMaths(sv: ClassLiveServices, cur: RoomRow, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const room = cur.id;
  if (cur.session.game.kind !== 'mural') return no(400, 'This game has no questions.');
  if (cur.session.state !== 'live') return no(409, cur.session.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', cur.session.state);
  if (body.action === 'ask') {
    const question = await nextQuestion(sv, cur, who);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    return ok({ room, question, now: sv.now() });
  }
  const slot = body.slot;
  const value = body.answer;
  if (!Number.isInteger(slot) || typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000) return no(400, "That answer couldn't be read.");
  const kept = await sv.loadQuestion(room, who, slot as number);
  if (kept === 'busy') return busy();
  const marked = kept ? markQuestion(kept.question) : null;
  if (!kept || !marked) return no(400, "That answer couldn't be marked.");
  if (kept.answered) return no(409, "You've already answered that one.", 'answered');
  const right = sameAnswer(value, marked.answer);
  const done = await mutate(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'mural') return { refuse: no(409, 'This one has finished.', 'over') };
    const out = answered(s.game, who, right, t);
    if (!out.ok) return { refuse: no(409, 'Wait for the ring to fill!', out.reason) };
    return { reply: null, events: [], players: [who], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) {
    const g = cur.session.game;
    return { ...done.refuse, body: { ...done.refuse.body, nextAt: (g.mine[who]?.lastAt ?? 0) + ANSWER_GAP_MS, now: sv.now() } };
  }
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
  try {
    await sv.recordAnswers(who, `classlive:${room}:${cur.session.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus: the flip still counts.
  }
  const next = done.session.state === 'live' ? await nextQuestion(sv, { ...done.row, session: done.session }, who) : null;
  return ok({
    room, right, answer: marked.answer, me: playerView(done.session, who), view: roomView(done.session, done.row.startedAt), now: sv.now(),
    ...(next && next !== 'busy' ? { question: next } : {}),
  });
}

export { TILES };
export type { Star, Arm };
