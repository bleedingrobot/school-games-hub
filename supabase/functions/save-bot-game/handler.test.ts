import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { seeded } from '../../../shared/seededRandom';
import { applyMove, boardResult, legalMoves, startPosition } from '../../../shared/checkers/rules';
import { botAction } from '../../../shared/space/bot';
import { DEFAULT_SETTINGS, play } from '../../../shared/space/engine';
import { randomFromSeed } from '../../../shared/space/random';
import { playBots, startSolo, type SoloSetup } from '../../../shared/space/replay';
import { encodeAction, type SpaceGameReport, type SpaceMathsAnswer } from '../../../shared/space/save';
import { stamper } from '../_shared/stamp';
import { batchIdFor, handleSaveBotGame, type Card101Row, type GameRow, type PowerClashRow, type Services, type SpaceRow } from './handler';
import { TimesTables } from '../../../shared/maths/skillPacks/timesTables';
import { makeFocusPack, type MathsFocus } from '../../../shared/maths/focus';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

const NOW = 1_792_000_000;

function services(over: Partial<Services> = {}) {
  // Seeds that count up instead of being random, so every run plays the same games (a random seed
  // sometimes made a changed game still a legal one, and the test failed about 1 run in 10).
  let seedCount = 0;
  const saved: GameRow[] = [];
  const savedSpace: SpaceRow[] = [];
  const saved101: Card101Row[] = [];
  const savedPowerClash: PowerClashRow[] = [];
  const s: Services = {
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : token === 'other-token' ? 'student-2' : null)),
    record: vi.fn(async (row: GameRow) => {
      saved.push(row);
      return 'saved' as const;
    }),
    recordSpace: vi.fn(async (row: SpaceRow) => {
      savedSpace.push(row);
      return 'saved' as const;
    }),
    record101: vi.fn(async (row: Card101Row) => {
      saved101.push(row);
      return 'saved' as const;
    }),
    recordPowerClash: vi.fn(async (row: PowerClashRow) => {
      savedPowerClash.push(row);
      return 'saved' as const;
    }),
    stamp: stamper('test-server-key', 'space-seed'),
    randomHex: (bytes: number) => (++seedCount).toString(16).padStart(bytes * 2, '0'),
    nowSeconds: () => NOW,
    ...over,
  };
  return { s, saved, savedSpace, saved101, savedPowerClash };
}

function post(body: unknown, token: string | null = 'good-token', origin = 'https://bleedingrobot.github.io') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: origin };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/save-bot-game', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('the save-bot-game server function', () => {
  it('replays the moves, decides the result itself, saves it for the signed-in player, and refuses lies and strangers', async () => {
    const { s, saved } = services();
    const response = await handleSaveBotGame(
      post({ player: 'someone-else', level: 'easy', studentColour: 'black', moves: FOOLS_MATE, ending: 'finished' }),
      s,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'won', reason: 'checkmate', countsForPoints: false });
    expect(saved).toEqual([expect.objectContaining({ player: 'student-1', game: 'chess', result: 'won', reason: 'checkmate', moves: FOOLS_MATE })]);

    const body = { level: 'easy', studentColour: 'black', moves: FOOLS_MATE, ending: 'finished' };
    expect((await handleSaveBotGame(post(body, null), s)).status).toBe(401);
    expect((await handleSaveBotGame(post(body, 'fake-token'), s)).status).toBe(401);
    const lies = [
      { level: 'easy', studentColour: 'white', moves: ['e2e4', 'e7e5', 'd1f7'], ending: 'finished' }, // illegal move
      { level: 'easy', studentColour: 'white', moves: ['e2e4', 'e7e5'], ending: 'finished' }, // not over
      { level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'won' }, // made-up ending
      { level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned', padding: 'x'.repeat(70_000) }, // huge
      'just a string',
    ];
    for (const lie of lies) expect((await handleSaveBotGame(post(lie), s)).status).toBe(400);
    const notJson = new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer good-token' }, body: '{oops' });
    expect((await handleSaveBotGame(notJson, s)).status).toBe(400);
    expect(saved).toHaveLength(1);

    // Refused, with no points, while the teacher has Non-maths games off (and carried on if the switch can't be read).
    const off = services({ nonMathsGames: vi.fn(async () => false) });
    const refused = await handleSaveBotGame(post(body), off.s);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: 'Your teacher has switched these games off for now.' });
    expect(off.saved).toHaveLength(0);
    const broken = services({ nonMathsGames: vi.fn(async () => Promise.reject(new Error('down'))) });
    expect((await handleSaveBotGame(post(body), broken.s)).status).toBe(200);
  });
});


/** A whole checkers game of random legal moves that Red wins. */
function checkersGameRedWins(): string[] {
  for (let seed = 1; ; seed++) {
    const random = seeded(seed);
    let position = startPosition();
    const moves: string[] = [];
    let result = boardResult(position);
    while (!result) {
      const options = legalMoves(position);
      const move = options[Math.floor(random() * options.length)];
      moves.push(move.notation);
      position = applyMove(position, move);
      result = boardResult(position);
    }
    if (result.winner === 'red') return moves;
  }
}

describe('saving checkers games', () => {
  it('replays the moves with the checkers rules, decides the result itself, and refuses faked or muddled games', async () => {
    const { s, saved } = services();
    const moves = checkersGameRedWins();
    const response = await handleSaveBotGame(
      post({ game: 'checkers', level: 'medium', studentColour: 'white', moves, ending: 'resigned' }),
      s,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe('lost');
    expect(saved).toEqual([expect.objectContaining({ player: 'student-1', game: 'checkers', result: 'lost', moves, counts_for_points: true })]);

    const lies = [
      { game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '22-18', '12-16'], ending: 'resigned' }, // skipped a forced capture
      { game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '23-19'], ending: 'finished' }, // not over
      { game: 'checkers', level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }, // chess moves
      { game: 'chess', level: 'easy', studentColour: 'white', moves: ['11-15'], ending: 'resigned' }, // checkers moves
    ];
    for (const body of lies) expect((await handleSaveBotGame(post(body), s)).status).toBe(400);
    expect(saved).toHaveLength(1);
  });
});

/** Asks for a seed, plays a whole game from it with a Pilot-like "student", and returns the report. */
async function spaceGame(s: Services, setup: Omit<SoloSetup, 'seed'>, stopAfter = Infinity, focus?: MathsFocus) {
  const response = await handleSaveBotGame(post({ game: 'space', start: true }), s);
  const { seed, stamp } = (await response.json()) as { seed: string; stamp: string };
  const game = startSolo({ ...setup, seed });
  const student = randomFromSeed('student');
  const actions: string[] = [];
  const answers: SpaceMathsAnswer[] = [];
  const pack = focus ? makeFocusPack([], focus, {}, randomFromSeed('questions')) : new TimesTables([], randomFromSeed('questions'));
  playBots(game, setup.level);
  while (game.state.phase !== 'over' && actions.length < stopAfter) {
    const action = botAction(game.state, 'easy', student);
    const claimedRight = action.kind === 'charge' ? action.right : action.kind === 'choose' && action.option === 1;
    if (action.kind === 'charge' || (action.kind === 'choose' && game.state.pending?.kind === 'question')) {
      // A Mission Control question: answer it right or wrong to match the choice.
      const q = pack.nextQuestion({ level: 3 })!;
      answers.push({ parts: q.parts, given: claimedRight ? q.answer : (q.answer + 1) % (q.choices ? q.choices.length : 10 ** 6), ms: 3000, at: NOW * 1000, ...(focus ? { key: q.factKey } : {}), ...(focus && q.params?.length ? { params: q.params } : {}) });
    }
    actions.push(encodeAction(action));
    game.state = play(game.state, action, game.dice).state;
    playBots(game, setup.level);
  }
  const report: SpaceGameReport = {
    game: 'space',
    seed,
    stamp,
    ...setup,
    actions,
    ending: game.state.phase === 'over' ? 'finished' : 'abandoned',
    ...(answers.length ? { answers } : {}),
  };
  return { report, state: game.state, studentSeat: game.studentSeat };
}

const NEBULA = { board: { id: 'nebula' as const }, settings: DEFAULT_SETTINGS, bots: 3, level: 'easy' as const };

describe('Mission Control maths in space games against bots', () => {
  const MATHS = { ...NEBULA, settings: { ...DEFAULT_SETTINGS, maths: true } };

  it('checks every answer, refuses a wrong, missing or extra one, and adds the answers to the records once', async () => {
    const recordAnswers = vi.fn(async () => {});
    const { s, savedSpace } = services({ recordAnswers });
    const { report } = await spaceGame(s, MATHS);
    expect(report.answers!.length).toBeGreaterThan(0);
    // Moving the first answer by one turns right into wrong and wrong (answer + 1) into right.
    const lie = report.answers!.map((a, n) => (n === 0 ? { ...a, given: a.given - 1 } : a));
    for (const answers of [lie, report.answers!.slice(1), [...report.answers!, report.answers![0]]]) {
      expect((await handleSaveBotGame(post({ ...report, answers }), s)).status).toBe(400);
    }
    expect(savedSpace).toEqual([]);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    const [player, batch, answers] = (recordAnswers.mock.calls[0] as unknown) as [string, string, { correct: boolean; key: string }[]];
    expect(player).toBe('student-1');
    expect(batch).toBe(await batchIdFor(`space:${report.seed}`));
    expect(answers).toHaveLength(report.answers!.length);
  });
});

describe('saving Wormholes & Black Holes games', () => {
  it('refuses made-up seeds, borrowed seeds, old seeds and changed games, and saves a real one', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, NEBULA);
    const other = services({ nowSeconds: () => NOW + 13 * 60 * 60 });
    const cases: [object, string][] = [
      [{ ...report, stamp: report.stamp.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) }, 'good-token'], // a forged stamp
      [{ ...report, seed: report.seed.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }, 'good-token'], // a different seed
      [report, 'other-token'], // someone else's seed
      [{ ...report, actions: [...report.actions.slice(1)] }, 'good-token'], // a different game
      [{ ...report, bots: 2 }, 'good-token'], // different settings
      [{ ...report, actions: [...report.actions, 'roll'] }, 'good-token'], // extra actions
      [{ ...report, actions: ['use:laser'] }, 'good-token'], // not an action
      [{ ...report, settings: { ...report.settings, maths: true } }, 'good-token'],
      [{ ...report, board: { id: 'moon' } }, 'good-token'],
      [{ ...report, ending: 'resigned' }, 'good-token'],
    ];
    for (const [body, token] of cases) expect((await handleSaveBotGame(post(body, token), s)).status).toBe(400);
    expect((await handleSaveBotGame(post(report), other.s)).status).toBe(400); // too old
    expect(savedSpace).toEqual([]);
    expect(other.savedSpace).toEqual([]);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedSpace).toHaveLength(1);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('save-bot-game');
    expect(readFileSync(resolve('supabase/functions/save-bot-game/index.ts'), 'utf8')).toBe(built);
  });
});
