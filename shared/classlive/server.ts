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
import { isMoving, lockedBecause, type OpenGame } from './limits';
import { ARMS, anchorOf, armCount, newStars, pickAnchor, spotlight, tryFact, type Arm, type Star, type StarLevel, type StarsEvent, type StarsGame, type StarsReply } from './stars';
import { LEVELS } from './stars';
import { allPicked, answered, canGuess, colsOf, flipped, guess, guessingDone, GUESS_MS, newMural, reveal, rowsOf, sizeMural, startGuessing, tilesOf, TILES, ANSWER_GAP_MS, type MuralEvent, type MuralGame, type Picture } from './mural';
import type { FactAnswer } from '../maths/leitner';
import { markQuestion, publicQuestion, sameAnswer, seededRandom, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { isUntimed } from '../maths/untimed';
import { makeSpacePack, pickSpaceQuestion } from '../space/mathsQuestion';
import { answerBox, boxOf, newSerpent, SERPENT_LEVELS, wakeAt, type SerpentBox, type SerpentEvent, type SerpentGame, type SerpentLevel, type SerpentReply } from './serpent';
import { rewardsOf, type FinishedSession } from './rewards';
import { liveName, liveNames } from '../liveNames';
import {
  advance as cornersAdvance, answered as cornersAnswered, boosted, crystalCorner, freshMine, ghostly, grab as cornersGrab, jump as cornersJump, warp as cornersWarp, freeAt as cornersFreeAt,
  cornersDone, MAPS, needsPositions, runSeconds, newCorners, nextDeadline, podium, questionFor, ANSWER_GAP_MS as CORNERS_GAP_MS,
  type Corner, type CornerMap, type CornersEvent, type CornersGame, type Item, type Positions, type Power, type Round, type Spot,
} from './corners';
import { advanceLava, freshLavaMine, lavaDeadline, lavaDone, lavaNeedsPositions, lavaRunSeconds, LAVA_MAPS, newLava, type LavaEvent, type LavaGame } from './lava';
import { lavaPlayer, lavaPublic, lavaStep, type LavaPlayer, type LavaPublic } from './lavaServer';
import {
  advance as thronesAdvance, freshMine as thronesFresh, HALLS, needsPositions as thronesNeedsPositions, newThrones, nextDeadline as thronesDeadline,
  thronesDone, type ThronesEvent, type ThronesGame,
} from './thrones';
import { thronesPlayer, thronesPublic, thronesStep, type ThronesPlayer, type ThronesPublic } from './thronesServer';
import type { ClashEvent, ClashGame } from './clash';
import { newClash, CLASH_MAPS, paintSeconds, teamCount } from './clash';
import { clashDeadline, clashJoin, clashPlayer, clashPublic, clashStep, clashTick, type ClashPlayer, type ClashPublic } from './clashServer';
import { BAYS, isShark, newShark, sharkAdvance, sharkJump, sharkQuestionFor, type BayMap } from './shark';

import { advance as ghostAdvance, freshMine as ghostFresh, ghostDone, ghostPlayer, MAPS as GHOST_MAPS, needsPositions as ghostNeeds, newGhost, nextDeadline as ghostDeadline, publicGhost, type GhostEvent, type GhostGame, type GhostPlayer, type PublicGhost } from './ghost';
import { ghostStep } from './ghostServer';
import { ghostSync, type EdgeServices } from './edge';
import { advanceRelay, joinRelay, newRelay, raceCount, relayDeadline, type RelayEvent, type RelayGame } from './relay';
import { relayPlayer, relayPublic, relayStep, type RelayPlayer, type RelayPublic } from './relayServer';
import { advance as crewAdvance, callMeeting, crewDone, crewNick, crewPlayer, freshMine as crewFresh, meetingControl, newCrew, nextDeadline as crewDeadline, publicCrew, type CrewEvent, type CrewGame, type CrewPlayer, type PublicCrew } from './crew';
import { crewStep } from './crewServer';

export const ACTIVITIES = ['stars', 'serpent', 'mural', 'corners', 'shark', 'ghost', 'clash', 'thrones', 'lava', 'crew', 'relay'] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const LENGTHS = [0, 2, 3, 5, 10, 15] as const;
export const ACTIVITY_NAMES: Record<Activity, string> = { stars: 'Star Web', serpent: 'Serpent Chain', mural: 'Mystery Mural', corners: 'Four Corners', shark: 'Shark Bay', ghost: 'Ghost Tag', clash: 'Colour Clash', thrones: 'Musical Thrones', lava: 'Floor is Lava', crew: 'Glitches', relay: 'Toon Flap Relay' };

export interface LivePlayer {
  id: string;
  name: string;
  joinedAt: number;
  /** A colour number (0 to 11) for their token on the projector. */
  colour: number;
}

export type Game = StarsGame | SerpentGame | MuralGame | CornersGame | GhostGame | ClashGame | ThronesGame | LavaGame | CrewGame | RelayGame;
export type GameEvent = StarsEvent | SerpentEvent | MuralEvent | CornersEvent | GhostEvent | ClashEvent | ThronesEvent | LavaEvent | CrewEvent | RelayEvent;

export interface Session {
  seed: number;
  activity: Activity;
  state: 'lobby' | 'live' | 'over';
  /** 0: no clock, the teacher ends it. Otherwise minutes. */
  lengthMin: number;
  players: Record<string, LivePlayer>;
  order: string[];
  game: Game;
  /**
   * Set when the teacher opened it "in the lobby" (James, 25 Nov 2026): any pupil of the school may join, from the
   * "Join now?" button on their home page or with the code. Missing: the teacher's class only.
   */
  lobby?: Lobby;
  /**
   * A class game's late-join code (James, 25 Nov 2026 NZ): shown on the big screen while it runs, typed on a pupil's
   * Class Live screen. Only pupils of the class can use it (a lobby game's code is `lobby.code`).
   */
  joinCode?: string;
  /** Music on pupils' devices too (James, 25 Nov 2026 NZ: a teacher toggle; off means the big screen only). */
  padMusic?: boolean;
  /**
   * A game the server opened at a set time (docs/plans/classlive-auto/PLAN.md): no teacher, no class. The database
   * writes it with `game: null`; the first step makes the game (`gameFor`). It starts at `startsAt` if `min` have joined.
   */
  auto?: Auto;
  /** Spots go through Cloudflare, not the database (shared/classlive/edge.ts; James's Ghost Tag pilot, 26 Nov 2026 NZ). */
  edge?: true;
}

export interface Auto {
  /** When it starts (ms since 1970). */
  startsAt: number;
  /** The fewest players it runs with. */
  min: number;
  /** Level or map, or null for a surprise. */
  level: string | null;
  /** Too few joined by the start: called off (no points). */
  calledOff?: boolean;
  /**
   * "Kids vote" (James, 25 Nov 2026 NZ): pupils in the waiting room vote for one of `choices` (3 games picked on the first
   * step); at the start the most votes wins (a tie at random) and that game is made. `winner` once decided.
   */
  vote?: { choices?: Activity[]; picks: Record<string, Activity>; winner?: Activity };
  /** A joystick game was on in another class when this opened: the vote offers only games that don't move. */
  noMoving?: boolean;
}

/** The games a set-time game may be (all but Star Web, whose shared sky needs a big screen). */
export const AUTO_ACTIVITIES: Activity[] = ['serpent', 'mural', 'corners', 'shark', 'ghost', 'clash', 'thrones', 'lava'];

export interface Lobby {
  /** Four digits, shown big on the projector. */
  code: string;
  /** What pupils call the teacher, as the teacher typed it (e.g. "Mr Riley"). */
  host: string;
}

export type Event =
  | GameEvent
  | { type: 'join'; t: number; pupil: string }
  | { type: 'start'; t: number }
  | { type: 'over'; t: number; why: 'teacher' | 'time' | 'heads' | 'guessed' | 'few' };

/** What pupils of the class may read of a room (their pop-up, their device). No names. */
export interface RoomView {
  activity: Activity;
  state: Session['state'];
  lengthMin: number;
  startedAt: number | null;
  players: number;
  game: PublicGame;
  /** A lobby game's code and host, or null for a class game. */
  lobby: Lobby | null;
  /** Pupils' devices play the background music too. */
  padMusic: boolean;
  /** A Cloudflare pilot room (shared/classlive/edge.ts): devices send spots there. */
  edge?: boolean;
  /** A game the server opened at a set time, or null. */
  auto: { startsAt: number; min: number; calledOff: boolean; vote: { choices: Activity[]; counts: number[]; winner: Activity | null } | null } | null;
}

export type PublicGame =
  | { kind: 'stars'; anchor: StarsGame['anchor']; arms: Record<Arm, number>; total: number; creature: boolean; supernova: boolean }
  | { kind: 'serpent'; level: SerpentLevel; energy: number; wakeAt: number; awake: boolean; heads: number; tail: number }
  /** `tiles`: one character a tile, '1' flipped, '0' not. Never the picture itself (until it is revealed). */
  | { kind: 'mural'; tiles: string; cols: number; rows: number; flipped: number; phase: 'flip' | 'guess'; guessEndsAt: number | null; picked: number; choices: Picture[]; solvers: number; revealed: boolean; picture: Picture | null }
  /** Four Corners: the round without the roll (until the dice lands) and without who was caught. */
  | { kind: 'corners'; map: CornerMap; round: PublicRound | null; jailed: number; free: number; variant?: 'shark'; bay?: BayMap }
  /** Ghost Tag (shared/classlive/ghost.ts). */
  | PublicGhost
  /** Colour Clash (shared/classlive/clashServer.ts). */
  | ClashPublic
  | ThronesPublic
  | LavaPublic
  | PublicCrew
  | RelayPublic;

export type PublicRound = Omit<Round, 'rolled' | 'caught' | 'saved' | 'items'> & {
  rolled: Corner[] | null;
  items: Omit<Item, 'by'>[];
  /** The run has ended (positions are fixed); the dice is rolling or has landed. */
  ended: boolean;
  caught: number;
};

/** What the projector draws: the whole game, names (when allowed) and the newest events (each with a number). */
export interface ScreenView extends Omit<RoomView, 'game'> {
  showNames: boolean;
  /** The code a late pupil types to join (the lobby code, or the class game's join code). */
  joinCode: string | null;
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
    | { kind: 'mural'; flips: number; right: number; answered: number; tiles: number; canGuess: boolean; guesses: number; gotIt: number; nextAt: number; picked: boolean; myTiles: number[]; picture: Picture }
    | {
        kind: 'corners'; safe: number; score: number; jailed: boolean; jailRight: number; held: Power | null; boost: boolean; ghost: boolean;
        shield: boolean; double: boolean; crystal: Corner | null; jump: boolean; caughtLast: boolean; savedLast: boolean;
        placed: number; spot: Spot; nextAt: number; place: 1 | 2 | 3 | null;
        /** Second half: the corner they may not stay in this round. */
        stay: Corner | null;
        /** Out of jail at this session time (all right answers in), or null. */
        freeAt: number | null;
        /** Rounds a Speed boost / Ghost still covers, this one included (0: off). */
        speedLeft: number;
        ghostLeft: number;
        /** Own stats for the end screen. */
        stats: { right: number; wrong: number; bestStreak: number; warps: number; lucky: number; grabs: number; powers: number; escapes: number; boats?: number };
      }
    | GhostPlayer
    | ClashPlayer
    | ThronesPlayer
    | LavaPlayer
    | CrewPlayer
    | RelayPlayer;
}

export interface RoomRow {
  id: number;
  /** Null for a game the server opened at a set time. */
  classId: string | null;
  /** The class's school (lobby games are open to the whole school). */
  schoolId: number;
  /** Null for a game the server opened at a set time. */
  teacher: string | null;
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
  teacherClass(teacher: string, classId: string): Promise<{ enabled: boolean; showNames: boolean; schoolId: number } | null | Busy>;
  /** A pupil's class, school, first name and switch. Null if they aren't a pupil in a class. */
  pupil(player: string): Promise<{ classId: string; schoolId: number; name: string; enabled: boolean } | null | Busy>;
  /** The school's lobby game with this code, not over, opened in the last 3 hours, or null. */
  codeRoom(schoolId: number, code: string): Promise<RoomRow | null | Busy>;
  /** Class Live and Showdown games running now in any class (shared/classlive/limits.ts). */
  openGames(): Promise<OpenGame[] | Busy>;
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
  /** Four Corners: every player's last saved spot in the room (classlive_positions). */
  positions(room: number): Promise<Positions | Busy>;
  /** Four Corners: the server moves pupils (back from jail, a jump). */
  place(room: number, spots: { player: string; x: number; y: number }[]): Promise<void>;
  /** Pays a finished session's points and trophies, once per room and session (later calls change nothing). */
  finishSession(room: number, done: FinishedSession): Promise<void>;
  /** Colour Clash: a round's board (one character a tile, '0' blank or the team) and tiles painted by each pupil in the game. */
  clashBoard(room: number, round: number): Promise<{ tiles: string; painted: Record<string, number> } | Busy>;
  /** Colour Clash: a paint bomb's tiles take the team's colour. */
  clashBomb(room: number, round: number, team: number, player: string, tiles: number[]): Promise<void>;
  /** Keeps one device's connection numbers for a game (classlive_netstats; the Cloudflare pilot's before-and-after). */
  saveStats?(room: number, player: string, part: 'pad' | 'screen', version: 'db' | 'edge', stats: Record<string, number>): Promise<void>;
  /** Cloudflare's rooms (shared/classlive/edge.ts), when its secrets are set. */
  edge?: EdgeServices;
}

/** The room's saved spots: from Cloudflare for a pilot room, else the database. */
export const roomSpots = (sv: ClassLiveServices, s: Pick<Session, 'edge'>, room: number) => (s.edge && sv.edge ? sv.edge.positions(room) : sv.positions(room));

export type StepReply = { status: number; body: Record<string, unknown> };
export const ok = (body: Record<string, unknown>): StepReply => ({ status: 200, body });
export const no = (status: number, error: string, reason?: string): StepReply => ({ status, body: { error, ...(reason ? { reason } : {}) } });
export const busy = () => no(503, 'Class Live is very busy. Try again!', 'busy');
const OFF = 'Class Live is switched off for this class.';
const MAX_TRIES = 8;
/** Events the screen row keeps (the projector animates the ones it hasn't seen). */
const KEEP_EVENTS = 40;
/** Most pupils in one room. */
export const MAX_PLAYERS = 40;

const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 20) || 'A player';
/** Every player's game name (own name, or first word + number; shared/liveNames.ts). */
const roomNames = (s: Session) => liveNames(Object.fromEntries(s.order.map((id) => [id, s.players[id].name])));

function publicRound(r: Round, t: number): PublicRound {
  const { rolled, caught, saved: _saved, items, ...rest } = r;
  return {
    ...rest, rolled: t >= r.rollEnd ? rolled : null, items: items.filter((x) => !x.by).map(({ by: _by, ...x }) => x), ended: caught !== null,
    caught: t >= r.rollEnd ? (caught?.length ?? 0) : 0,
  };
}

/** `t`: ms since the start, so a pupil's device only learns the rolled corner once the dice has landed. */
export function publicGame(g: Game, players: number, t = 0, order: string[] = []): PublicGame {
  if (g.kind === 'ghost') return publicGhost(g, order);
  if (g.kind === 'crew') return publicCrew(g, order);
  if (g.kind === 'relay') return relayPublic(g);
  if (g.kind === 'clash') return clashPublic(g);
  if (g.kind === 'lava') return lavaPublic(g, players);
  if (g.kind === 'thrones') return thronesPublic(g, players);
  if (g.kind === 'corners') {
    const jailed = Object.values(g.mine).filter((m) => m.jailedIn !== null).length;
    return { kind: 'corners', map: g.map, round: g.round ? publicRound(g.round, t) : null, jailed, free: players - jailed, ...(isShark(g) ? { variant: 'shark' as const, bay: g.bay } : {}) };
  }
  if (g.kind === 'mural') {
    return {
      kind: 'mural', tiles: g.tiles.map((x) => (x ? '1' : '0')).join(''), cols: colsOf(g), rows: rowsOf(g), flipped: flipped(g), phase: g.phase ?? 'flip',
      guessEndsAt: g.phase === 'guess' ? (g.guessFrom ?? 0) + GUESS_MS : null, picked: Object.values(g.mine).filter((m) => m.pick).length, choices: g.choices,
      solvers: g.solvers.length, revealed: g.revealed, picture: g.revealed ? g.picture : null,
    };
  }
  if (g.kind === 'serpent') {
    return { kind: 'serpent', level: g.chain.level, energy: g.energy, wakeAt: wakeAt(players), awake: g.awake, heads: g.heads.length, tail: g.tail };
  }
  const arms = Object.fromEntries(ARMS.map((a) => [a, armCount(g, a)])) as Record<Arm, number>;
  return { kind: 'stars', anchor: g.anchor, arms, total: g.stars.length, creature: g.creature, supernova: g.supernova };
}

export function roomView(s: Session, startedAt: number | null, now?: number): RoomView {
  const t = startedAt === null ? 0 : Math.max(0, (now ?? startedAt) - startedAt);
  return {
    activity: s.activity, state: s.state, lengthMin: s.lengthMin, startedAt, players: s.order.length, game: publicGame(s.game, s.order.length, t, s.order),
    lobby: s.lobby ?? null, padMusic: s.padMusic === true, ...(s.edge ? { edge: true as const } : {}),
    auto: s.auto ? {
      startsAt: s.auto.startsAt, min: s.auto.min, calledOff: s.auto.calledOff === true,
      vote: s.auto.vote?.choices ? {
        choices: s.auto.vote.choices, counts: s.auto.vote.choices.map((c) => Object.values(s.auto!.vote!.picks).filter((p) => p === c).length),
        winner: s.auto.vote.winner ?? null,
      } : null,
    } : null,
  };
}

function screenView(row: Pick<RoomRow, 'showNames' | 'seq' | 'events'>, s: Session, startedAt: number | null): ScreenView {
  const { game: _g, ...base } = roomView(s, startedAt);
  const names = roomNames(s);
  return {
    ...base,
    showNames: row.showNames,
    joinCode: s.lobby?.code ?? s.joinCode ?? null,
    // Glitches shows everyone's factory name instead (always: it is no one's real name).
    people: s.order.map((id) => ({ id, name: s.game.kind === 'crew' && s.game.mine[id]?.nick ? s.game.mine[id].nick : row.showNames ? names[id] : null, colour: s.players[id].colour })),
    game: s.game,
    seq: row.seq,
    events: row.events,
  };
}

export function playerView(s: Session, id: string): PlayerView {
  const p = s.players[id];
  const name = roomNames(s)[id] ?? liveName(p.name);
  if (s.game.kind === 'relay') return { player: id, name, colour: p.colour, game: relayPlayer(s, s.game, id) };
  if (s.game.kind === 'lava') return { player: id, name, colour: p.colour, game: lavaPlayer(s, s.game, id, () => freshLavaMine(s.order.indexOf(id))) };
  if (s.game.kind === 'thrones') return { player: id, name, colour: p.colour, game: thronesPlayer(s.game, s.order, id, s.state === 'over') };
  if (s.game.kind === 'clash') return { player: id, name, colour: p.colour, game: clashPlayer(s, s.game, id) };
  if (s.game.kind === 'crew') {
    // Glitches: everyone is only ever their factory name (a first name only for a game saved before factory names).
    const cg = s.game;
    return { player: id, name: cg.mine[id]?.nick ?? firstName(p.name), colour: p.colour, game: crewPlayer(cg, id, s.order, s.state === 'over', (x) => ({ name: cg.mine[x]?.nick ?? firstName(s.players[x]?.name ?? ''), colour: s.players[x]?.colour ?? 0 })) };
  }
  if (s.game.kind === 'ghost') return { player: id, name, colour: p.colour, game: ghostPlayer(s.game, id, s.order, s.state === 'over') };
  if (s.game.kind === 'corners') {
    const g = s.game;
    const m = g.mine[id] ?? freshMine(s.order.indexOf(id));
    const r = g.round;
    const n = r?.n ?? 0;
    const place = s.state === 'over' ? (podium(g, s.order).find((x) => x.player === id)?.place ?? null) : null;
    return {
      player: id, name, colour: p.colour,
      game: {
        kind: 'corners', safe: m.safe, score: m.score, jailed: m.jailedIn !== null, jailRight: m.jailRight, held: m.held,
        boost: boosted(m, n), ghost: ghostly(m, n), shield: !!r && m.shieldIn === n, double: !!r && m.doubleIn === n,
        crystal: r && m.crystalIn === n ? crystalCorner(r) : null, jump: !!r && m.jumpIn === n,
        caughtLast: !!r?.caught?.includes(id), savedLast: !!r?.saved.includes(id), placed: m.placed, spot: m.spot,
        nextAt: m.lastAt + CORNERS_GAP_MS, place, stay: r?.swap && m.jailedIn === null ? m.lastCorner ?? null : null, freeAt: cornersFreeAt(g, m),
        speedLeft: m.speedTo !== null && n <= m.speedTo ? m.speedTo - n + 1 : 0, ghostLeft: m.ghostTo !== null && n <= m.ghostTo ? m.ghostTo - n + 1 : 0,
        stats: {
          right: m.right ?? 0, wrong: m.wrong ?? 0, bestStreak: m.bestStreak ?? 0, warps: m.warps ?? 0, lucky: m.lucky ?? 0,
          grabs: m.grabs, powers: m.powersUsed, escapes: m.escapes, ...(isShark(g) ? { boats: (m as { boats?: number }).boats ?? 0 } : {}),
        },
      },
    };
  }
  if (s.game.kind === 'mural') {
    const m = s.game.mine[id];
    return {
      player: id, name, colour: p.colour,
      game: {
        kind: 'mural', flips: m?.flips ?? 0, right: m?.right ?? 0, answered: m?.answered ?? 0, tiles: m?.tiles ?? 0,
        canGuess: canGuess(s.game, id), guesses: m?.guesses ?? 0, nextAt: m ? m.lastAt + ANSWER_GAP_MS : 0,
        // Right or not stays secret until the reveal.
        gotIt: s.game.revealed || s.state === 'over' ? (m?.gotIt ?? 0) : 0, picked: !!m?.pick,
        // The pupil's own tiles, drawn on their device from the picture (James, 24 Nov 2026).
        myTiles: tilesOf(s.game, id), picture: s.game.picture,
      },
    };
  }
  if (s.game.kind === 'serpent') {
    const m = s.game.mine[id];
    return {
      player: id, name, colour: p.colour,
      game: { kind: 'serpent', box: boxOf(s.game, id), at: m?.at ?? 0, right: m?.right ?? 0, shown: m?.shown ?? 0 },
    };
  }
  const mine = s.game.mine[id];
  return {
    player: id,
    name,
    colour: p.colour,
    game: {
      kind: 'stars', found: mine?.found ?? 0, glows: mine?.glows ?? 0, tries: mine?.tries ?? 0,
      mine: s.game.stars.filter((x) => x.by === id).map((x) => x.text),
    },
  };
}

/** Time in ms since the start (0 in the lobby). */
export const timeOf = (row: Pick<RoomRow, 'startedAt'>, now: number) => (row.startedAt === null ? 0 : Math.max(0, now - row.startedAt));

/** Is a timed session past its end? */
const timeUp = (s: Session, row: Pick<RoomRow, 'startedAt'>, now: number) => s.state === 'live' && s.lengthMin > 0 && timeOf(row, now) >= s.lengthMin * 60_000;

export type Step<T> = (s: Session, t: number, row: RoomRow) => { reply: T; events: Event[]; startedAt?: number | null; players?: string[]; claim?: Change['claim'] } | { refuse: StepReply };

/** Pays out a finished session. A failure is only logged: the teacher's next view tries again (it pays once). */
async function payOut(sv: ClassLiveServices, room: number, s: Session) {
  if (s.auto?.calledOff) return;
  try {
    await sv.finishSession(room, rewardsOf(s));
  } catch {
    console.error(`classlive: finishing room ${room} failed`);
  }
}

/** Loads the room, applies one step and saves it if nobody else saved first (else runs it again on the newer session). */
export async function mutate<T>(sv: ClassLiveServices, room: number, step: Step<T>): Promise<{ reply: T; row: RoomRow; session: Session } | { refuse: StepReply }> {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    let row = await sv.loadRoom(room);
    if (row === 'busy') return { refuse: busy() };
    if (!row) return { refuse: no(404, "That room couldn't be found.", 'gone') };
    const version = row.version;
    const s = structuredClone(row.session);
    // A game the server opened at a set time: made on its first step, started (or called off) at its time.
    const made = !s.game && !!s.auto;
    if (made) {
      const v = s.auto!.vote;
      if (v && !v.choices) {
        // Kids vote: three different games to pick from.
        // A joystick game was already on when it opened (classlive_auto_open): only games that don't move.
        const pool = AUTO_ACTIVITIES.filter((a) => !s.auto!.noMoving || !isMoving(a));
        v.choices = [];
        const n = Math.min(3, pool.length);
        while (v.choices.length < n) v.choices.push(pool.splice(Math.floor(sv.random() * pool.length) % pool.length, 1)[0]);
        s.activity = v.choices[0];
      }
      s.game = gameFor(s.activity, s.auto!.level, () => sv.random());
    }
    const autoEvents: Event[] = [];
    if (s.auto && s.state === 'lobby' && sv.now() >= s.auto.startsAt) {
      if (s.order.length >= s.auto.min) {
        const v = s.auto.vote;
        if (v?.choices && !v.winner) {
          // The most votes wins; a tie (or no votes) is settled at random among the top.
          const counts = v.choices.map((c) => Object.values(v.picks).filter((p) => p === c).length);
          const top = v.choices.filter((_, i) => counts[i] === Math.max(...counts));
          v.winner = top[Math.floor(sv.random() * top.length) % top.length];
          if (v.winner !== s.activity) {
            s.activity = v.winner;
            s.game = gameFor(v.winner, null, () => sv.random());
            s.order.forEach((id, i) => joinGame(s.game, id, i));
          }
        }
        startGame(s, sv.now());
        row = { ...row, startedAt: sv.now() };
        autoEvents.push({ type: 'start', t: 0 });
      } else {
        s.state = 'over';
        s.auto.calledOff = true;
        autoEvents.push({ type: 'over', t: 0, why: 'few' });
      }
    }
    const now = sv.now();
    const t = timeOf(row, now);
    const events: Event[] = [...autoEvents];
    const g0 = s.game;
    // Four Corners: the server moves pupils (back from jail, a jump); their devices snap to the new spot.
    const placedBefore = g0.kind === 'corners' || g0.kind === 'ghost' || g0.kind === 'crew' || g0.kind === 'clash' || g0.kind === 'thrones' || g0.kind === 'lava' ? new Map(s.order.map((id) => [id, g0.mine[id]?.placed ?? 0])) : null;
    if (g0.kind === 'crew') {
      // Glitches runs on the clock too: role cards, delayed jams, the power bar, meetings, rounds (docs/CREW-PLAN.md).
      if (s.state === 'live') {
        const last = timeUp(s, row, now);
        events.push(...crewAdvance(g0, t, s.order, () => sv.random(), last));
        if (last && crewDone(g0, t)) {
          s.state = 'over';
          events.push({ type: 'over', t, why: 'time' });
        }
      }
    } else if (g0.kind === 'ghost') {
      // Ghost Tag runs on the clock too: rounds, the hunt, tags from the saved spots (docs/GHOST-PLAN.md).
      if (s.state === 'live') {
        let spots: Positions = {};
        if (ghostNeeds(g0, t)) {
          const got = await roomSpots(sv, s, room);
          if (got === 'busy') return { refuse: busy() };
          spots = got;
        }
        const last = timeUp(s, row, now);
        events.push(...ghostAdvance(g0, t, s.order, spots, () => sv.random(), last));
        if (last && ghostDone(g0, t)) {
          s.state = 'over';
          events.push({ type: 'over', t, why: 'time' });
        }
      }
    } else if (g0.kind === 'clash') {
      // Colour Clash runs on the clock too: count a round when painting ends, start the next (clashServer.ts).
      if (s.state === 'live') {
        const got = await clashTick(sv, room, s, t, timeUp(s, row, now));
        if (got === 'busy') return { refuse: busy() };
        events.push(...got);
      }
    } else if (g0.kind === 'corners') {
      // Rounds run on the clock: end the run (who is caught, from the saved spots), start the next round. When the time is
      // up, the round that is on is the last one.
      if (s.state === 'live') {
        let spots: Positions = {};
        if (needsPositions(g0, t)) {
          const got = await sv.positions(room);
          if (got === 'busy') return { refuse: busy() };
          spots = got;
        }
        const last = timeUp(s, row, now);
        events.push(...(isShark(g0) ? sharkAdvance : cornersAdvance)(g0, t, s.order, spots, () => sv.random(), last));
        if (last && cornersDone(g0, t)) {
          s.state = 'over';
          events.push({ type: 'over', t, why: 'time' });
        }
      }
    } else if (g0.kind === 'thrones') {
      // Musical Thrones runs on the clock too: the music stops, the scramble ends, the next round starts.
      if (s.state === 'live') {
        let spots: Positions = {};
        if (thronesNeedsPositions(g0, t)) {
          const got = await sv.positions(room);
          if (got === 'busy') return { refuse: busy() };
          spots = got;
        }
        const last = timeUp(s, row, now);
        events.push(...thronesAdvance(g0, t, s.order, spots, () => sv.random(), last));
        if (last && thronesDone(g0, t)) {
          s.state = 'over';
          events.push({ type: 'over', t, why: 'time' });
        }
      }
    } else if (g0.kind === 'relay') {
      // Toon Flap Relay runs on the clock too: the countdown, turns that ran out, the race's time, the next race.
      if (s.state === 'live') {
        const last = timeUp(s, row, now);
        const out = advanceRelay(g0, t, s.order, () => sv.random(), last);
        events.push(...out.events);
        if (out.over) {
          s.state = 'over';
          events.push({ type: 'over', t, why: 'time' });
        }
      }
    } else if (g0.kind === 'lava') {
      // Floor is Lava runs on the clock too: crack the floor when a run ends (from the saved spots), start the next round.
      if (s.state === 'live') {
        let spots: Positions = {};
        if (lavaNeedsPositions(g0, t)) {
          const got = await sv.positions(room);
          if (got === 'busy') return { refuse: busy() };
          spots = got;
        }
        const last = timeUp(s, row, now);
        events.push(...advanceLava(g0, t, s.order, spots, () => sv.random(), last));
        if (last && lavaDone(g0, t)) {
          s.state = 'over';
          events.push({ type: 'over', t, why: 'time' });
        }
      }
    } else if (timeUp(s, row, now)) {
      // A timed session ends by itself, whoever's step comes first.
      // Mystery Mural's time ends the flipping instead; then the guessing runs its own time.
      if (s.game.kind === 'mural' && s.game.phase !== 'guess' && !s.game.revealed) events.push(...startGuessing(s.game, t));
      else if (s.game.kind !== 'mural' || s.game.revealed || guessingDone(s.game, t)) {
        if (s.game.kind === 'mural') events.push(...reveal(s.game, t));
        s.state = 'over';
        events.push({ type: 'over', t, why: 'time' });
      }
    } else if (s.state === 'live' && s.game.kind === 'mural' && guessingDone(s.game, t)) {
      events.push(...reveal(s.game, t));
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
    if (!made && !events.length && !changed.size && !claim && ('refuse' in out || out.startedAt === undefined)) {
      return 'refuse' in out ? out : { reply: out.reply, row, session: s };
    }
    let seq = row.seq;
    const numbered = events.map((e) => ({ ...e, seq: ++seq }));
    const next: RoomRow = { ...row, startedAt, seq, events: [...row.events, ...numbered].slice(-KEEP_EVENTS), session: s };
    for (const e of events) if ('pupil' in e && typeof e.pupil === 'string') changed.add(e.pupil);
    const g1 = s.game;
    const places = (g1.kind === 'corners' || g1.kind === 'ghost' || g1.kind === 'crew' || g1.kind === 'clash' || g1.kind === 'thrones' || g1.kind === 'lava') && placedBefore
      ? s.order.filter((id) => (g1.mine[id]?.placed ?? 0) !== (placedBefore.get(id) ?? 0)).map((id) => ({ player: id, x: g1.mine[id].spot.x, y: g1.mine[id].spot.y }))
      : [];
    for (const p of places) changed.add(p.player);
    // A round's end changes every pupil's own row (caught, safe, scores).
    if ((g1.kind === 'corners' || g1.kind === 'lava') && events.some((e) => e.type === 'roll' || e.type === 'crack' || e.type === 'round' || e.type === 'over')) for (const id of s.order) changed.add(id);
    if ((g1.kind === 'corners' || g1.kind === 'clash') && events.some((e) => e.type === 'roll' || e.type === 'clash_count' || e.type === 'clash_round' || e.type === 'round' || e.type === 'over')) for (const id of s.order) changed.add(id);
    // Glitches: roles, meetings (the ballot), reveals and rounds change everyone's own row.
    if (g1.kind === 'crew' && events.some((e) => e.type === 'c_round' || e.type === 'c_meeting' || e.type === 'c_vote' || e.type === 'c_out' || e.type === 'c_resume' || e.type === 'c_end' || e.type === 'over')) for (const id of s.order) changed.add(id);
    if (g1.kind === 'ghost' && events.some((e) => e.type === 'g_round' || e.type === 'g_end' || e.type === 'over' || (e.type === 'g_grab' && e.froze > 0))) for (const id of s.order) changed.add(id);
    if (g1.kind === 'relay') {
      // A new race (new teams) or a race's end changes everyone's row; a new turn changes that team's.
      if (events.some((e) => e.type === 'relay_race' || e.type === 'relay_end' || e.type === 'relay_go' || e.type === 'over')) for (const id of s.order) changed.add(id);
      for (const e of events) if (e.type === 'relay_turn') for (const id of g1.teams[e.team]?.members ?? []) changed.add(id);
    }
    if (g1.kind === 'thrones' && events.some((e) => e.type === 'stop' || e.type === 'seated' || e.type === 'round' || e.type === 'over')) for (const id of s.order) changed.add(id);
    const players = [...changed].filter((id) => s.players[id]).map((id) => playerView(s, id));
    const saved = await sv.save(room, version, { session: s, view: roomView(s, startedAt, now), screen: screenView(next, s, startedAt), startedAt, players, ...(claim ? { claim } : {}) });
    if (saved === 'busy') return { refuse: busy() };
    if (saved === 'answered') return { refuse: no(409, "You've already answered that one.", 'answered') };
    if (saved === 'ok') {
      if (s.edge && sv.edge) {
        // The Cloudflare room learns who is a ghost and who the server moved (instead of classlive_place).
        try {
          await sv.edge.sync(room, ghostSync(room, s, startedAt, places));
        } catch {
          console.error(`classlive: edge sync for room ${room} failed`);
        }
      } else if (places.length) {
        try {
          await sv.place(room, places);
        } catch {
          console.error(`classlive: placing in room ${room} failed`);
        }
      }
      if (s.state === 'over' && events.some((e) => e.type === 'over')) await payOut(sv, room, s);
      return 'refuse' in out ? out : { reply: out.reply, row: { ...next, version: version + 1 }, session: s };
    }
    await new Promise((done) => setTimeout(done, 5 + Math.floor(sv.random() * 25 * (tries + 1))));
  }
  return { refuse: busy() };
}

const NET_KEYS = ['seconds', 'calls', 'empty', 'fresh', 'rttP50', 'rttP95', 'gapP50', 'gapP95', 'freshPerS', 'movedPerS'] as const;
const readRoom = (v: unknown): number | null => (Number.isSafeInteger(v) && (v as number) > 0 ? (v as number) : null);
const readCode = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}$/.test(v.trim()) ? v.trim() : null);

/** What pupils call the teacher, tidied: letters, spaces and . ' - only, at most 30 characters. Null if nothing is left. */
export function cleanHost(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.normalize('NFC').replace(/[^\p{L}\p{M} .'’-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 30).trim();
  return /\p{L}/u.test(t) ? t : null;
}

/** May this pupil use this room? Their class's room, or a lobby game of their school. */
const canUse = (row: RoomRow, me: { classId: string; schoolId: number }) =>
  row.classId === me.classId || (!!row.session.lobby && row.schoolId === me.schoolId);

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
  } else if (activity === 'crew') {
    game = newCrew('factory', random);
  } else if (activity === 'ghost') {
    game = newGhost(GHOST_MAPS.find((m) => m === body.map) ?? GHOST_MAPS[Math.floor(random() * GHOST_MAPS.length) % GHOST_MAPS.length]);
  } else if (activity === 'corners') {
    const map = MAPS.find((m) => m === body.map) ?? MAPS[Math.floor(random() * MAPS.length) % MAPS.length];
    game = newCorners(map, runSeconds(body.run));
  } else if (activity === 'lava') {
    const map = LAVA_MAPS.find((m) => m === body.map) ?? LAVA_MAPS[Math.floor(random() * LAVA_MAPS.length) % LAVA_MAPS.length];
    game = newLava(map, lavaRunSeconds(body.run));
  } else if (activity === 'clash') {
    const map = CLASH_MAPS.find((m) => m === body.map) ?? CLASH_MAPS[Math.floor(random() * CLASH_MAPS.length) % CLASH_MAPS.length];
    game = newClash(map, teamCount(body.teams), paintSeconds(body.paint));
  } else if (activity === 'shark') {
    // Shark Bay (docs/SHARK-PLAN.md): Four Corners' engine with spinning quarters, boats and a shark.
    const bay = BAYS.find((m) => m === body.map) ?? BAYS[Math.floor(random() * BAYS.length) % BAYS.length];
    game = newShark(bay, runSeconds(body.run));
  } else if (activity === 'relay') {
    game = newRelay(raceCount(body.races));
  } else if (activity === 'thrones') {
    game = newThrones(HALLS.find((h) => h === body.hall) ?? HALLS[Math.floor(random() * HALLS.length) % HALLS.length]);
  } else game = newMural(random);
  return { seed, activity, state: 'lobby', lengthMin, players: {}, order: [], game, ...(body.padMusic === true ? { padMusic: true } : {}) };
}

/** A new game of this activity for a set-time game (`level`: its level or map; anything unknown is a surprise). */
export function gameFor(activity: Activity, level: string | null, random: () => number): Game {
  const s = newSession({ activity, level, map: level, hall: level }, 0, random);
  return typeof s === 'string' ? newMural(random) : s.game;
}

/** A new player's own part of the game (the `index`th to join). */
function joinGame(g: Game, who: string, index: number) {
  if (g.kind === 'corners') g.mine[who] = freshMine(index);
  if (g.kind === 'lava') g.mine[who] = freshLavaMine(index);
  if (g.kind === 'thrones') g.mine[who] = thronesFresh(index);
  if (g.kind === 'clash') clashJoin(g, who);
  if (g.kind === 'ghost') g.mine[who] = ghostFresh(index);
  if (g.kind === 'crew') g.mine[who] = { ...crewFresh(index), nick: crewNick(g, who) };
  if (g.kind === 'relay') joinRelay(g, who);
}

/** Lobby to live (the teacher's Start, or a set-time game's start). */
function startGame(s: Session, now: number) {
  s.state = 'live';
  // Four Corners: change corners every round in the second half (a timed game's halfway point).
  if (s.game.kind === 'corners' && s.lengthMin > 0) s.game.halfAt = (s.lengthMin * 60_000) / 2;
  if (s.game.kind === 'clash') s.game.zeroMs = now;
  // Mystery Mural: the grid fits the class and the time (about 75% uncovered by a class doing well).
  if (s.game.kind === 'mural') sizeMural(s.game, s.order.length, s.lengthMin);
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
    // James can still pick the school server for a game, to compare (body.edge false).
    if (body.edge !== false && sv.edge?.allowed(who, session.activity)) session.edge = true;
    // One live game at a time, of any kind (James, 26 Nov 2026 NZ: the database stalled with two classes on).
    const running = await sv.openGames();
    if (running === 'busy') return busy();
    const locked = lockedBecause(session.activity, running, classId);
    if (locked) return no(409, locked, 'locked');
    if (body.where === 'lobby') {
      const host = cleanHost(body.host);
      if (!host) return no(400, 'Type the name pupils call you, like Mr Riley.');
      // A code no other open lobby game of the school has.
      let code: string | null = null;
      for (let i = 0; i < 12 && !code; i++) {
        const tryCode = String(1000 + Math.floor(sv.random() * 9000) % 9000);
        const taken = await sv.codeRoom(teach.schoolId, tryCode);
        if (taken === 'busy') return busy();
        if (!taken) code = tryCode;
      }
      if (!code) return busy();
      session.lobby = { code, host };
    } else session.joinCode = String(1000 + (Math.floor(sv.random() * 9000) % 9000));
    const row = { showNames: teach.showNames, seq: 0, events: [] };
    const change: Change = { session, view: roomView(session, null), screen: screenView(row, session, null), startedAt: null, players: [] };
    const id = await sv.openRoom(classId, who, change);
    if (id === 'busy') return busy();
    return ok({ room: id, screen: change.screen, now: sv.now() });
  }

  if (action === 'view' || action === 'start' || action === 'end' || action === 'spotlight' || action === 'reveal' || action === 'padmusic' || action === 'crew') {
    const room = readRoom(body.room);
    if (!room) return no(400, "That room couldn't be found.");
    const row = await sv.loadRoom(room);
    if (row === 'busy') return busy();
    // Only the teacher who opened it runs the projector.
    // A set-time game (no teacher, no class) runs on pupils' iPads only (James, 25 Nov 2026 NZ).
    if (!row || row.teacher !== who || !row.classId) return no(403, "That isn't your room.", 'not-yours');
    const teach = await sv.teacherClass(who, row.classId);
    if (teach === 'busy') return busy();
    if (!teach) return no(403, "That isn't one of your classes.", 'not-yours');
    if (!teach.enabled && action !== 'view' && action !== 'end') return no(403, OFF, 'off');

    const done = await mutate(sv, room, (s, t) => {
      if (action === 'view') return { reply: null, events: [] };
      if (action === 'start') {
        if (s.state !== 'lobby') return { refuse: no(409, 'It has already started.', 'not-now') };
        startGame(s, sv.now());
        return { reply: null, events: [{ type: 'start', t: 0 }], startedAt: sv.now() };
      }
      if (action === 'reveal') {
        // First press: stop flipping, time to guess. Second press (or the guessing's end): show it and finish.
        if (s.game.kind !== 'mural') return { refuse: no(400, 'Only a mural can be revealed.') };
        if (s.state !== 'live') return { reply: null, events: [] };
        if (s.game.phase !== 'guess') return { reply: null, events: startGuessing(s.game, t) };
        s.state = 'over';
        return { reply: null, events: [...reveal(s.game, t), { type: 'over', t, why: 'teacher' }] };
      }
      if (action === 'crew') {
        // Glitches' meeting buttons (James: only the teacher calls a meeting).
        if (s.game.kind !== 'crew' || s.state !== 'live') return { refuse: no(400, 'No meeting here.') };
        const out = body.do === 'meeting' ? callMeeting(s.game, t, s.order) : body.do === 'vote' || body.do === 'more' ? meetingControl(s.game, t, body.do) : { ok: false as const };
        if (!out.ok) return { refuse: no(409, 'Not now.', 'not_now') };
        return { reply: null, events: out.events, players: s.order };
      }
      if (action === 'padmusic') {
        s.padMusic = body.on === true;
        return { reply: null, events: [] };
      }
      if (action === 'spotlight') {
        const id = body.id === null ? null : Number.isInteger(body.id) ? (body.id as number) : undefined;
        if (id === undefined || s.game.kind !== 'stars') return { refuse: no(400, 'Pick a star.') };
        return { reply: null, events: spotlight(s.game, id, t) };
      }
      // end
      if (s.state === 'over') return { reply: null, events: [] };
      s.state = 'over';
      return { reply: null, events: [...(s.game.kind === 'mural' ? reveal(s.game, t) : []), { type: 'over', t, why: 'teacher' }] };
    });
    if ('refuse' in done) return done.refuse;
    if (done.session.state === 'over' && (action === 'view' || action === 'end')) await payOut(sv, room, done.session);
    return ok({ room, screen: screenView(done.row, done.session, done.row.startedAt), now: sv.now() });
  }

  // A pilot room's ticket for Cloudflare (shared/classlive/edge.ts): its teacher or one of its players.
  if (action === 'edge') {
    const room = readRoom(body.room);
    if (!room) return no(400, "That room couldn't be found.");
    const row = await sv.loadRoom(room);
    if (row === 'busy') return busy();
    if (!row) return no(404, "That room couldn't be found.", 'gone');
    if (!row.session.edge || !sv.edge) return no(409, 'This game runs on the school server.', 'not_edge');
    const kind = row.teacher === who ? 't' : row.session.players[who] ? 'p' : null;
    if (!kind) return no(403, "That game isn't open to you.", 'not-yours');
    try {
      return ok({ room, ...(await sv.edge.ticket(room, who, kind)) });
    } catch {
      return busy();
    }
  }

  // A Ghost Tag device's connection numbers at the end of a game (src/games/classlive/netStats.ts).
  if (action === 'stats') {
    const room = readRoom(body.room);
    const part = body.part === 'pad' || body.part === 'screen' ? body.part : null;
    const version = body.version === 'edge' || body.version === 'db' ? body.version : null;
    if (!room || !part || !version || !body.stats || typeof body.stats !== 'object' || !sv.saveStats) return no(400, "That couldn't be read.");
    const row = await sv.loadRoom(room);
    if (row === 'busy') return busy();
    if (!row || row.session.activity !== 'ghost' || (row.teacher !== who && !row.session.players[who])) return no(403, "That isn't your room.", 'not-yours');
    const stats: Record<string, number> = {};
    for (const k of NET_KEYS) {
      const v = (body.stats as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v)) stats[k] = Math.max(0, Math.min(1e7, Math.round(v * 10) / 10));
    }
    try {
      await sv.saveStats(room, who, part, version, stats);
    } catch {
      return busy();
    }
    return ok({ room });
  }

  // ---- Pupil steps ----
  if (action === 'join' || action === 'play' || action === 'ask' || action === 'answer' || action === 'look' || action === 'vote') {
    const me = await sv.pupil(who);
    if (me === 'busy') return busy();
    if (!me) return no(403, 'Class Live is for pupils in a class.', 'no-class');
    if (!me.enabled) return no(403, OFF, 'off');
    let room: number | null;
    if (action === 'join' && body.code !== undefined) {
      // A lobby game's code, typed by the pupil.
      const code = readCode(body.code);
      const found = code ? await sv.codeRoom(me.schoolId, code) : null;
      if (found === 'busy') return busy();
      // Not a lobby game: their own class's game, joining late with its code.
      const own = !found && code ? await sv.classRoom(me.classId) : null;
      if (own === 'busy') return busy();
      const late = own && own.session.state !== 'over' && own.session.joinCode === code ? own : null;
      if (!found && !late) return no(404, "That code didn't work. Check the big screen!", 'bad-code');
      room = (found || late)!.id;
    } else if (action === 'join' && body.room === undefined) {
      const open = await sv.classRoom(me.classId);
      if (open === 'busy') return busy();
      if (!open || open.session.state === 'over') return no(404, 'There is nothing on in your class right now.', 'none');
      room = open.id;
    } else room = readRoom(body.room);
    if (!room) return no(400, "That room couldn't be found.");
    const cur = await sv.loadRoom(room);
    if (cur === 'busy') return busy();
    if (!cur || !canUse(cur, me)) return no(403, "That game isn't open to you.", 'not-yours');

    if (action === 'join') {
      const done = await mutate(sv, room, (s, t) => {
        if (s.state === 'over') return { refuse: no(409, 'This one has finished.', 'over') };
        if (s.players[who]) return { reply: null, events: [], players: [who] };
        if (s.order.length >= MAX_PLAYERS) return { refuse: no(409, 'This room is full.', 'full') };
        s.players[who] = { id: who, name: me.name, joinedAt: t, colour: s.order.length % 12 };
        joinGame(s.game, who, s.order.length);
        s.order.push(who);
        return { reply: null, events: [{ type: 'join', t, pupil: who }] };
      });
      if ('refuse' in done) return done.refuse;
      return ok({ room, view: roomView(done.session, done.row.startedAt), me: playerView(done.session, who), now: sv.now() });
    }

    if (!cur.session.players[who]) return no(409, 'Join first.', 'not-playing');
    // The room as it is now, for this pupil. Each device asks every couple of seconds instead of listening to every change
    // of the room row: a class of devices each sent every change goes over Realtime's messages-per-second limit, and
    // changes are dropped (Class Showdown hung in a real class, 24 Nov 2026).
    const withRoom = (r: StepReply): StepReply =>
      r.status === 200 ? r : { ...r, body: { ...r.body, view: roomView(cur.session, cur.startedAt, sv.now()), me: playerView(cur.session, who) } };
    if (action === 'vote') {
      // Kids vote: one vote each, changeable until the start.
      const done = await mutate(sv, room, (s) => {
        const v = s.auto?.vote;
        if (!v?.choices || s.state !== 'lobby' || v.winner) return { refuse: no(409, 'Voting has finished.', 'not_now') };
        const pick = v.choices.find((c) => c === body.pick);
        if (!pick) return { refuse: no(400, 'Pick a game.') };
        v.picks[who] = pick;
        return { reply: null, events: [], players: [who] };
      });
      if ('refuse' in done) return withRoom(done.refuse);
      return ok({ room, view: roomView(done.session, done.row.startedAt, sv.now()), me: playerView(done.session, who), now: sv.now() });
    }
    if (action === 'look') {
      // Four Corners runs on the clock: if the big screen hasn't moved a round on (closed, asleep), a pupil's look does.
      const cg = cur.session.game;
      const due = cur.session.state !== 'live' ? null : cg.kind === 'corners' ? nextDeadline(cg, cur.startedAt) : cg.kind === 'ghost' ? ghostDeadline(cg, cur.startedAt) : cg.kind === 'crew' ? crewDeadline(cg, cur.startedAt) : cg.kind === 'clash' ? clashDeadline(cg, cur.startedAt) : cg.kind === 'thrones' ? thronesDeadline(cg, cur.startedAt) : cg.kind === 'lava' ? lavaDeadline(cg, cur.startedAt) : cg.kind === 'relay' ? relayDeadline(cg, cur.startedAt) : null;
      // Also anything else due with no big screen to move it on (a set-time game): its start, the time up, Mural's guessing.
      const n = sv.now(), tt = timeOf(cur, n), cs = cur.session;
      const otherDue = cs.auto && cs.state === 'lobby' ? n >= cs.auto.startsAt
        : cs.state === 'live' && ((cs.lengthMin > 0 && tt >= cs.lengthMin * 60_000) || (cg.kind === 'mural' && guessingDone(cg, tt)));
      if ((due !== null && tt >= due + 1500) || otherDue) {
        const done = await mutate(sv, room, () => ({ reply: null, events: [] }));
        if (!('refuse' in done)) return ok({ room, view: roomView(done.session, done.row.startedAt, sv.now()), me: playerView(done.session, who), now: sv.now() });
      }
      return ok({ room, view: roomView(cur.session, cur.startedAt, sv.now()), me: playerView(cur.session, who), now: sv.now() });
    }
    if (cur.session.game.kind === 'relay' && (action === 'ask' || action === 'answer' || action === 'play')) {
      const out = await relayStep(sv, cur, who, body);
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    if (cur.session.game.kind === 'lava' && (action === 'ask' || action === 'answer' || action === 'play')) {
      const out = await lavaStep(sv, cur, who, body, { mutate, nextQuestion, roomView, playerView, ok, no, busy });
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    if (cur.session.game.kind === 'thrones' && (action === 'ask' || action === 'answer' || action === 'play')) {
      const out = await thronesStep({ sv, mutate, nextQuestion, roomView, playerView, timeOf, ok, no, busy, maxAnswerMs: MAX_ANSWER_MS }, cur, who, body);
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    if (cur.session.game.kind === 'clash' && (action === 'ask' || action === 'answer' || action === 'play')) {
      const out = await clashStep(sv, cur, who, body);
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    if (cur.session.game.kind === 'crew' && (action === 'ask' || action === 'answer' || action === 'play')) {
      const out = await crewStep(sv, cur, who, body);
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    if (cur.session.game.kind === 'ghost' && (action === 'ask' || action === 'answer' || action === 'play')) {
      const out = await ghostStep(sv, cur, who, body);
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    if (cur.session.game.kind === 'corners' && (action === 'ask' || action === 'answer' || action === 'play')) {
      const out = await cornersStep(sv, cur, who, body);
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    if (action === 'ask' || action === 'answer') {
      const out = await muralMaths(sv, cur, who, body);
      return cur.session.state === 'live' ? out : withRoom(out);
    }
    const done = await mutate<StarsReply | SerpentReply | MuralReply>(sv, room, (s, t) => {
      if (s.state !== 'live') return { refuse: no(409, s.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s.state) };
      if (s.game.kind === 'mural') {
        // Tiles flip at random with right answers now; an old pad's tile pick gets a plain no.
        if (body.tile !== undefined) return { refuse: no(409, 'Answer a question to flip a tile!', 'no_flips') };
        const out = guess(s.game, who, body.guess, t);
        if (!out.ok) return { refuse: no(409, out.reason === 'not_now' ? 'Guessing comes at the end!' : 'Pick a riddle.', out.reason) };
        // Everyone has picked: show it now.
        if (allPicked(s.game, s.order)) {
          s.state = 'over';
          return { reply: { result: 'picked' as const }, events: [...out.events, ...reveal(s.game, t), { type: 'over' as const, t, why: 'guessed' as const }], players: [who] };
        }
        return { reply: { result: 'picked' as const }, events: out.events, players: [who] };
      }
      if (s.game.kind === 'serpent') {
        const out = answerBox(s.game, who, body.box, body.value, t, s.order.length);
        if (!out.ok) {
          const words = { too_soon: 'One at a time!', stale: 'That box is done. Here is your next one.', done: 'You have finished the whole chain!', unreadable: "That answer couldn't be read." };
          return { refuse: { status: 409, body: { error: words[out.reason], reason: out.reason, box: boxOf(s.game, who) } } };
        }
        // Serpent Chain ends by itself once every pupil has reached the head (James, 24 Nov 2026).
        const g = s.game;
        if (out.events.some((e) => e.type === 'head') && s.order.every((id) => g.heads.includes(id))) {
          s.state = 'over';
          return { reply: out.reply, events: [...out.events, { type: 'over' as const, t, why: 'heads' as const }], players: [who] };
        }
        return { reply: out.reply, events: out.events, players: [who] };
      }
      if (s.game.kind === 'corners' || s.game.kind === 'ghost' || s.game.kind === 'crew' || s.game.kind === 'clash' || s.game.kind === 'thrones' || s.game.kind === 'lava' || s.game.kind === 'relay') return { refuse: no(409, 'Use the joystick!', 'not_now') };
      const out = tryFact(s.game, who, body.fact, t);
      if (!out.ok) return { refuse: no(409, 'One at a time!', out.reason) };
      return { reply: out.reply, events: out.events, players: [who] };
    });
    if ('refuse' in done) {
      // A refused step on a room that has moved on (ended, or not started) brings the room back, so the device catches up.
      const st = (done.refuse.body as { reason?: unknown }).reason;
      if (st !== 'over' && st !== 'lobby') return done.refuse;
      const now = await sv.loadRoom(room);
      if (!now || now === 'busy') return withRoom(done.refuse);
      return { ...done.refuse, body: { ...done.refuse.body, view: roomView(now.session, now.startedAt), me: playerView(now.session, who) } };
    }
    return ok({ room, reply: done.reply, view: roomView(done.session, done.row.startedAt), me: playerView(done.session, who), now: sv.now() });
  }

  return no(400, "That couldn't be read.");
}

export type MuralReply = { result: 'picked' };

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

export async function nextQuestion(sv: ClassLiveServices, row: RoomRow, who: string): Promise<PublicQuestion | null | Busy> {
  const open = await sv.openQuestion(row.id, who);
  if (open === 'busy') return 'busy';
  if (open) return publicQuestion(open.question, open.slot);
  const ctx = await sv.mathsContext(who);
  if (!ctx) return null;
  const g = row.session.game;
  const m = g.kind === 'mural' || g.kind === 'corners' || g.kind === 'ghost' || g.kind === 'crew' || g.kind === 'clash' || g.kind === 'thrones' || g.kind === 'lava' || g.kind === 'relay' ? g.mine[who] : undefined;
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
    const out = answered(s.game, who, right, t, () => sv.random(), s.lengthMin > 0 ? s.lengthMin * 60_000 * 0.9 : undefined);
    if (!out.ok) return { refuse: no(409, 'Wait for the ring to fill!', out.reason) };
    return { reply: null, events: out.events, players: [who], claim: { player: who, slot: slot as number, value, right } };
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

/**
 * Four Corners' pupil steps: `play` with `grab` (an item, checked against their saved spot) or `jump` (a corner), and
 * `ask`/`answer` (jail questions, or switching on a held power-up while standing in a corner). Way-A maths as the mural.
 */
async function cornersStep(sv: ClassLiveServices, cur: RoomRow, who: string, body: Record<string, unknown>): Promise<StepReply> {
  const room = cur.id;
  const s0 = cur.session;
  if (s0.state !== 'live') return no(409, s0.state === 'lobby' ? 'Wait for the start!' : 'This one has finished.', s0.state);
  const spotOf = async (): Promise<Spot | undefined | Busy> => {
    const all = await sv.positions(room);
    if (all === 'busy') return 'busy';
    return all[who];
  };
  const reply = (session: Session, startedAt: number | null, extra: Record<string, unknown> = {}) =>
    ok({ room, view: roomView(session, startedAt, sv.now()), me: playerView(session, who), now: sv.now(), ...extra });

  if (body.action === 'play') {
    const at = body.grab !== undefined || body.warp !== undefined ? await spotOf() : undefined;
    if (at === 'busy') return busy();
    const done = await mutate(sv, room, (s, t) => {
      if (s.state !== 'live' || s.game.kind !== 'corners') return { refuse: no(409, 'This one has finished.', 'over') };
      if (body.jump !== undefined) {
        const out = (isShark(s.game) ? sharkJump : cornersJump)(s.game, who, body.jump, s.order, t);
        if (!out.ok) return { refuse: no(409, "You can't jump there now.", 'not_now') };
        return { reply: null, events: [], players: [who] };
      }
      const g = s.game;
      const mine = g.mine[who];
      if (body.warp !== undefined) {
        if (!cornersWarp(g, who, at ?? mine?.spot, t)) return { refuse: no(409, 'No teleport there.', 'not_now') };
        return { reply: null, events: [], players: [] };
      }
      const out = cornersGrab(g, who, body.grab, at ?? mine?.spot, t);
      if (!out.ok) return { refuse: no(409, out.reason === 'full' ? 'You are already carrying one!' : out.reason === 'far' ? 'Get closer!' : 'Too late!', out.reason) };
      return { reply: null, events: out.events, players: [who] };
    });
    if ('refuse' in done) return done.refuse;
    return reply(done.session, done.row.startedAt);
  }

  const g0 = s0.game as CornersGame;
  const t0 = timeOf(cur, sv.now());
  if (body.action === 'ask') {
    const at = await spotOf();
    if (at === 'busy') return busy();
    const purpose = (isShark(g0) ? sharkQuestionFor : questionFor)(g0, who, at ?? g0.mine[who]?.spot, t0);
    if (!purpose) return no(409, 'No question right now.', 'not_now');
    const question = await nextQuestion(sv, cur, who);
    if (question === 'busy') return busy();
    if (!question) return no(503, "We couldn't make a question just now.");
    return ok({ room, question, purpose, now: sv.now() });
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
  const at = await spotOf();
  if (at === 'busy') return busy();
  const ms = Math.round(Math.min(typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : MAX_ANSWER_MS, MAX_ANSWER_MS));
  const done = await mutate(sv, room, (s, t) => {
    if (s.state !== 'live' || s.game.kind !== 'corners') return { refuse: no(409, 'This one has finished.', 'over') };
    const purpose = (isShark(s.game) ? sharkQuestionFor : questionFor)(s.game, who, at ?? s.game.mine[who]?.spot, t);
    if (!purpose) return { refuse: no(409, isShark(s.game) ? 'Swim off the jetty first!' : 'Get to a corner first!', 'not_now') };
    const out = cornersAnswered(s.game, who, right, purpose, s.order, t, typeof body.ms === 'number' ? ms : undefined);
    if (!out.ok) return { refuse: no(409, out.reason === 'too_soon' ? 'One at a time!' : 'No question right now.', out.reason) };
    const freed = out.events.flatMap((e) => (e.type === 'power' && e.freed ? [e.freed] : []));
    return { reply: purpose, events: out.events, players: [who, ...freed], claim: { player: who, slot: slot as number, value, right } };
  });
  if ('refuse' in done) return done.refuse;
  try {
    await sv.recordAnswers(who, `classlive:${room}:${s0.seed}:${slot}`, [{ key: marked.key, correct: right, ms, at: sv.now(), given: value }]);
  } catch {
    // The maths records are a bonus.
  }
  // In jail, the next question straight away (until 3 right).
  const g1 = done.session.game as CornersGame;
  const more = done.reply === 'jail' && g1.mine[who]?.jailedIn !== null && (g1.mine[who]?.jailRight ?? 0) < 3;
  const next = more ? await nextQuestion(sv, { ...done.row, session: done.session }, who) : null;
  return reply(done.session, done.row.startedAt, { right, answer: marked.answer, purpose: done.reply, ...(next && next !== 'busy' ? { question: next } : {}) });
}

export { TILES };
export type { Star, Arm };

/** For the games' own server files (clashServer.ts). */
export { mutate as mutateRoom, nextQuestion as nextQuestionFor };
