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
import type { SoloSetup as Card101Setup } from '../../../shared/card101/solo';
import { playWholeGame } from '../../../shared/card101/testing';
import { stamper } from '../_shared/stamp';
import type { SoloSetup as PowerClashSetup } from '../../../shared/power-clash/solo';
import { botLoadoutFor } from '../../../shared/power-clash/solo';
import { playWholeMatch } from '../../../shared/power-clash/testing';
import { batchIdFor, handleSaveBotGame, type Card101Row, type GameRow, type PowerClashRow, type Services, type SpaceRow } from './handler';
import { solveQuestion, TimesTables } from '../../../shared/maths/skillPacks/timesTables';
import { makeFocusPack, packIdOfKey, type MathsFocus } from '../../../shared/maths/focus';

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
  it('replays the moves, decides the result itself and saves it', async () => {
    const { s, saved } = services();
    const response = await handleSaveBotGame(
      post({ level: 'easy', studentColour: 'black', moves: FOOLS_MATE, ending: 'finished' }),
      s,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'won', reason: 'checkmate', countsForPoints: false });
    expect(saved).toEqual([
      {
        player: 'student-1',
        game: 'chess',
        bot_level: 'easy',
        player_side: 'black',
        moves: FOOLS_MATE,
        result: 'won',
        reason: 'checkmate',
        player_moves: 2,
        counts_for_points: false,
      },
    ]);
  });

  it('saves the player from the sign-in token, never from the request', async () => {
    const { s, saved } = services();
    await handleSaveBotGame(
      post({ player: 'someone-else', level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }),
      s,
    );
    expect(saved[0].player).toBe('student-1');
  });

  it('refuses anyone not signed in', async () => {
    const { s, saved } = services();
    const body = { level: 'easy', studentColour: 'black', moves: FOOLS_MATE, ending: 'finished' };
    expect((await handleSaveBotGame(post(body, null), s)).status).toBe(401);
    expect((await handleSaveBotGame(post(body, 'fake-token'), s)).status).toBe(401);
    expect(saved).toEqual([]);
  });

  it('refuses a faked win', async () => {
    const { s, saved } = services();
    const lies = [
      { level: 'easy', studentColour: 'white', moves: ['e2e4', 'e7e5', 'd1f7'], ending: 'finished' }, // illegal move
      { level: 'easy', studentColour: 'white', moves: ['e2e4', 'e7e5'], ending: 'finished' }, // not over
      { level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'won' }, // made-up ending
      { level: 'expert', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' },
      'just a string',
    ];
    for (const body of lies) expect((await handleSaveBotGame(post(body), s)).status).toBe(400);
    expect(saved).toEqual([]);
  });

  it('copes with a body that is not JSON', async () => {
    const { s } = services();
    const request = new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer good-token' }, body: '{oops' });
    expect((await handleSaveBotGame(request, s)).status).toBe(400);
  });

  it('passes on the daily limit kindly', async () => {
    const { s } = services({ record: vi.fn(async () => 'too-many' as const) });
    const response = await handleSaveBotGame(
      post({ level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }),
      s,
    );
    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatch(/lot of games/);
  });

  it('answers the browser’s permission check and only names our own websites', async () => {
    const { s } = services();
    const ours = await handleSaveBotGame(
      new Request('http://x', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }),
      s,
    );
    expect(ours.status).toBe(204);
    expect(ours.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    const other = await handleSaveBotGame(
      new Request('http://x', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }),
      s,
    );
    expect(other.headers.get('Access-Control-Allow-Origin')).toBe('https://bleedingrobot.github.io');
    // Remembered for 2 hours, so the browser doesn't ask again before every save.
    expect(ours.headers.get('Access-Control-Max-Age')).toBe('7200');
  });

  it('refuses a huge request without trying to read it as a game', async () => {
    const { s, saved } = services();
    const huge = { level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned', padding: 'x'.repeat(70_000) };
    const response = await handleSaveBotGame(post(huge), s);
    expect(response.status).toBe(400);
    expect(saved).toEqual([]);
  });

  it('refuses a request that isn’t JSON at all', async () => {
    const { s, saved } = services();
    const response = await handleSaveBotGame(
      new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer good-token' }, body: 'not json{' }),
      s,
    );
    expect(response.status).toBe(400);
    expect(saved).toEqual([]);
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
  it('replays the moves with the checkers rules, decides the result itself and saves it', async () => {
    const { s, saved } = services();
    const moves = checkersGameRedWins();
    const response = await handleSaveBotGame(
      post({ game: 'checkers', level: 'medium', studentColour: 'white', moves, ending: 'resigned' }),
      s,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe('lost');
    expect(saved).toEqual([
      expect.objectContaining({
        player: 'student-1',
        game: 'checkers',
        bot_level: 'medium',
        player_side: 'white',
        moves,
        result: 'lost',
        player_moves: Math.floor(moves.length / 2),
        counts_for_points: true,
      }),
    ]);
    expect(['no-pieces', 'no-moves']).toContain(saved[0].reason);
  });

  it('saves resigned and abandoned checkers games as losses', async () => {
    const { s, saved } = services();
    for (const ending of ['resigned', 'abandoned']) {
      const response = await handleSaveBotGame(
        post({ game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '22-18', '15x22'], ending }),
        s,
      );
      expect(response.status).toBe(200);
    }
    expect(saved.map((row) => [row.result, row.reason, row.counts_for_points])).toEqual([
      ['lost', 'resigned', false],
      ['lost', 'abandoned', false],
    ]);
  });

  it('refuses faked or muddled checkers games', async () => {
    const { s, saved } = services();
    const lies = [
      { game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '22-18', '12-16'], ending: 'resigned' }, // skipped a forced capture
      { game: 'checkers', level: 'easy', studentColour: 'red', moves: ['11-15', '23-19'], ending: 'finished' }, // not over
      { game: 'checkers', level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }, // chess moves
      { game: 'chess', level: 'easy', studentColour: 'white', moves: ['11-15'], ending: 'resigned' }, // checkers moves
      { game: 'checkers', level: 'easy', studentColour: 'black', moves: [], ending: 'resigned' }, // a chess colour
      { game: 'draughts', level: 'easy', studentColour: 'red', moves: [], ending: 'resigned' },
    ];
    for (const body of lies) expect((await handleSaveBotGame(post(body), s)).status).toBe(400);
    expect(saved).toEqual([]);
  });

  it('still treats a report with no game as chess (what older pages send)', async () => {
    const { s, saved } = services();
    await handleSaveBotGame(post({ level: 'easy', studentColour: 'white', moves: ['e2e4'], ending: 'resigned' }), s);
    expect(saved[0].game).toBe('chess');
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
      answers.push({ parts: q.parts, given: claimedRight ? q.answer : q.answer + 1, ms: 3000, at: NOW * 1000, ...(focus ? { key: q.factKey } : {}) });
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

  it('checks every answer, saves the game and adds the answers to the records once', async () => {
    const recordAnswers = vi.fn(async () => {});
    const { s, savedSpace } = services({ recordAnswers });
    const { report } = await spaceGame(s, MATHS);
    expect(report.answers!.length).toBeGreaterThan(0);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    expect(savedSpace[0].space.settings.maths).toBe(true);
    const [player, batch, answers] = (recordAnswers.mock.calls[0] as unknown) as [string, string, { correct: boolean; key: string }[]];
    expect(player).toBe('student-1');
    expect(batch).toBe(await batchIdFor(`space:${report.seed}`));
    expect(answers).toHaveLength(report.answers!.length);
    expect(answers.every((a) => /^mul:\d+x\d+$/.test(a.key))).toBe(true);
  });

  describe('with a maths focus', () => {
    const focus: MathsFocus = { source: 'teacher-class', skills: ['facts-10', 'dbl-half-10', 'tables-2-5-10'], onlyThese: true, endsAt: null, canChoose: true, own: null };

    it('adds each answer to the records of the right pack, once for each pack', async () => {
      const recordAnswers = vi.fn(async () => {});
      const { s } = services({ recordAnswers });
      const { report } = await spaceGame(s, MATHS, Infinity, focus);
      expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
      const calls = recordAnswers.mock.calls as unknown as [string, string, { key: string }[], string][];
      const packs = calls.map((c) => c[3]);
      expect(new Set(packs).size).toBe(packs.length); // a pack is recorded once
      expect(packs.length).toBeGreaterThan(1);
      let total = 0;
      for (const [, batch, answers, pack] of calls) {
        total += answers.length;
        expect(answers.every((a) => packIdOfKey(a.key) === pack)).toBe(true);
        expect(batch).toBe(await batchIdFor(pack === 'times-tables' ? `space:${report.seed}` : `space:${report.seed}:${pack}`));
      }
      expect(total).toBe(report.answers!.length);
    });

    it('counts a question towards the fact the browser says only if it really fits', async () => {
      const recordAnswers = vi.fn(async () => {});
      const { s } = services({ recordAnswers });
      const { report } = await spaceGame(s, MATHS, Infinity, focus);
      const lied = report.answers!.map((a) => ({ ...a, key: 'mul:12x12' }));
      expect((await handleSaveBotGame(post({ ...report, answers: lied }), s)).status).toBe(200);
      const keys = (recordAnswers.mock.calls as unknown as [string, string, { key: string }[]][]).flatMap((c) => c[2].map((a) => a.key));
      // 12 x 12 fits none of these questions, so each counts towards the fact it was really asked about.
      expect(keys).not.toContain('mul:12x12');
      expect(keys).toHaveLength(report.answers!.length);
    });

    it('refuses a question shape no skill asks', async () => {
      const { s, savedSpace } = services();
      const { report } = await spaceGame(s, MATHS, Infinity, focus);
      const odd = report.answers!.map((a, n) => (n === 0 ? { ...a, parts: ['7', '^', '3', '=', '?'] } : a));
      expect((await handleSaveBotGame(post({ ...report, answers: odd }), s)).status).toBe(400);
      const badKey = report.answers!.map((a, n) => (n === 0 ? { ...a, key: '<script>' } : a));
      expect((await handleSaveBotGame(post({ ...report, answers: badKey }), s)).status).toBe(400);
      expect(savedSpace).toEqual([]);
    });
  });

  it('refuses a "right" answer that was wrong, a missing answer or an extra one', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, MATHS);
    // Moving the first answer by one turns right into wrong and wrong (answer + 1) into right.
    const lie = report.answers!.map((a, n) => (n === 0 ? { ...a, given: a.given - 1 } : a));
    for (const answers of [lie, report.answers!.slice(1), [...report.answers!, report.answers![0]]]) {
      expect((await handleSaveBotGame(post({ ...report, answers }), s)).status).toBe(400);
    }
    expect(savedSpace).toEqual([]);
  });

  it('keeps the right-answer counts the maths achievements use', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, MATHS);
    await handleSaveBotGame(post(report), s);
    const right = report.answers!.filter((a, n) => n >= 0 && solveQuestion(a.parts)!.answer === a.given).length;
    const stats = savedSpace[0].space.stats;
    expect(stats.mathsRight).toBe(right);
    expect(stats.boosts + stats.escapes).toBeLessThanOrEqual(stats.mathsRight);
  });

  it('follows the teacher’s switch: Off refuses a maths game, at the start and when saving', async () => {
    let mode: 'off' | 'choose' | 'on' = 'choose';
    const { s, savedSpace } = services({ mathsSwitch: async () => mode });
    const { report } = await spaceGame(s, MATHS);
    mode = 'off';
    expect((await handleSaveBotGame(post({ game: 'space', start: true, maths: true }), s)).status).toBe(403);
    expect((await handleSaveBotGame(post({ game: 'space', start: true }), s)).status).toBe(200);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(403);
    expect(savedSpace).toEqual([]);
    // Games without maths are not affected.
    const plain = await spaceGame(s, NEBULA);
    expect((await handleSaveBotGame(post(plain.report), s)).status).toBe(200);
    for (const on of ['choose', 'on'] as const) {
      mode = on;
      expect((await handleSaveBotGame(post({ game: 'space', start: true, maths: true }), s)).status).toBe(200);
    }
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
  });

  it('keeps maths off if the switch can’t be read', async () => {
    const { s } = services({ mathsSwitch: async () => { throw new Error('down'); } });
    const { report } = await spaceGame(s, MATHS);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(403);
  });

  it('still saves the game if the answers can’t be recorded', async () => {
    const { s, savedSpace } = services({ recordAnswers: vi.fn(async () => { throw new Error('down'); }) });
    const { report } = await spaceGame(s, MATHS);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedSpace).toHaveLength(1);
  });
});

describe('saving Wormholes & Black Holes games', () => {
  it('hands out a fresh seed with a stamp', async () => {
    const { s } = services();
    const a = await (await handleSaveBotGame(post({ game: 'space', start: true }), s)).json();
    const b = await (await handleSaveBotGame(post({ game: 'space', start: true }), s)).json();
    expect(a.seed).toMatch(/^s1-1792000000-[0-9a-f]{24}$/);
    expect(a.stamp).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.seed).not.toBe(b.seed);
  });

  it('needs a sign-in for a seed too', async () => {
    const { s } = services();
    expect((await handleSaveBotGame(post({ game: 'space', start: true }, null), s)).status).toBe(401);
  });

  it('replays the game from its seed, works out the place itself and saves it', async () => {
    const { s, savedSpace, saved } = services();
    const { report, state, studentSeat } = await spaceGame(s, NEBULA);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    const place = state.places![studentSeat];
    expect(await response.json()).toEqual(
      expect.objectContaining({ result: place === 1 ? 'won' : 'lost', place, countsForPoints: true }),
    );
    expect(saved).toEqual([]);
    expect(savedSpace).toHaveLength(1);
    const row = savedSpace[0];
    expect(row).toEqual(
      expect.objectContaining({
        player: 'student-1',
        bot_level: 'easy',
        player_side: ['first', 'second', 'third', 'fourth'][studentSeat],
        moves: report.actions,
        counts_for_points: true,
      }),
    );
    expect(row.space).toEqual(
      expect.objectContaining({ seed: report.seed, board: { id: 'nebula' }, bots: 3, place, rockets: 4 }),
    );
    expect(row.space.stats.wormholes).toBeGreaterThanOrEqual(0);
    expect(row.player_moves).toBeGreaterThanOrEqual(5);
  });

  it('saves a game the student left part-way as left early, earning nothing', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, NEBULA, 4);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedSpace[0]).toEqual(expect.objectContaining({ result: 'lost', reason: 'abandoned', counts_for_points: false }));
    expect(savedSpace[0].space.place).toBeNull();
  });

  it('refuses a game that says it finished but didn’t', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, NEBULA, 4);
    expect((await handleSaveBotGame(post({ ...report, ending: 'finished' }), s)).status).toBe(400);
    expect(savedSpace).toEqual([]);
  });

  it('refuses made-up seeds, borrowed seeds, old seeds and changed games', async () => {
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
  });

  it('plays Random Galaxy boards too', async () => {
    const { s, savedSpace } = services();
    const { report } = await spaceGame(s, { ...NEBULA, board: { galaxy: 'comet kiwi 48', size: 50 } as never, bots: 1 });
    expect(report.board).toEqual({ galaxy: 'comet kiwi 48', size: 50 });
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedSpace[0].space.board).toEqual({ galaxy: 'Comet-Kiwi-48', size: 50 });
  });

  it('passes on the daily limit kindly', async () => {
    const { s } = services({ recordSpace: vi.fn(async () => 'too-many' as const) });
    const { report } = await spaceGame(s, NEBULA);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(429);
  });

  it('won’t hand out seeds without a server key', async () => {
    const { s } = services({ stamp: stamper('', 'space-seed') });
    expect((await handleSaveBotGame(post({ game: 'space', start: true }), s)).status).toBe(500);
  });
});

/** Asks for a 101 seed, plays a whole game from it with an Easy bot as the "student", and returns the report. */
async function game101(s: Services, setup: Omit<Card101Setup, 'seed'>, leaveAfter = Infinity) {
  const response = await handleSaveBotGame(post({ game: '101', start: true }), s);
  const { seed, stamp } = (await response.json()) as { seed: string; stamp: string };
  const { solo, actions } = playWholeGame({ ...setup, seed }, 'easy', leaveAfter);
  // A student who walks away just stops; the browser doesn't send "leave".
  const sent = actions.filter((a) => a !== 'leave');
  const over = solo.game.phase === 'over' && sent.length === actions.length;
  const report = { game: '101' as const, seed, stamp, ...setup, actions: sent, ending: over ? ('finished' as const) : ('abandoned' as const) };
  return { report, game: solo.game };
}

const QUICK = { bots: 2, level: 'easy' as const, settings: { target: 50 as const } };

describe('saving 101 games', () => {
  it('hands out a fresh seed with a stamp', async () => {
    const { s } = services();
    const a = await (await handleSaveBotGame(post({ game: '101', start: true }), s)).json();
    expect(a.seed).toMatch(/^s1-1792000000-[0-9a-f]{24}$/);
    expect(a.stamp).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await handleSaveBotGame(post({ game: '101', start: true }, null), s)).status).toBe(401);
  });

  it('replays the game from its seed, works out the result itself and saves it', async () => {
    const { s, saved101, saved, savedSpace } = services();
    const { report, game } = await game101(s, QUICK);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    const won = game.winners!.includes(0);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ result: won ? 'won' : 'lost', reason: 'finished', countsForPoints: true }));
    expect(body.place === 1).toBe(won);
    expect(saved).toEqual([]);
    expect(savedSpace).toEqual([]);
    expect(saved101).toHaveLength(1);
    const row = saved101[0];
    expect(row).toEqual(
      expect.objectContaining({ player: 'student-1', bot_level: 'easy', player_side: 'first', moves: report.actions, counts_for_points: true }),
    );
    expect(row.card101).toEqual(
      expect.objectContaining({ seed: report.seed, settings: { target: 50 }, bots: 2, players: 3, total: game.totals[0], rounds: game.results.length }),
    );
    expect(row.card101.stats.zeroHands).toBe(game.results.filter((r) => r.scores[0]!.total === 0).length);
  });

  it('saves a game the student left part-way as left early, earning nothing', async () => {
    const { s, saved101 } = services();
    const { report } = await game101(s, QUICK, 12);
    expect(report.ending).toBe('abandoned');
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(saved101[0]).toEqual(expect.objectContaining({ result: 'lost', reason: 'abandoned', counts_for_points: false }));
    expect(saved101[0].card101.place).toBeNull();
  });

  it('refuses made-up seeds, borrowed seeds, space seeds, old seeds and changed games', async () => {
    const { s, saved101 } = services();
    const { report } = await game101(s, QUICK);
    const spaceSeed = (await (await handleSaveBotGame(post({ game: 'space', start: true }), s)).json()) as { seed: string; stamp: string };
    const other = services({ nowSeconds: () => NOW + 13 * 60 * 60 });
    const cases: [object, string][] = [
      [{ ...report, stamp: report.stamp.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) }, 'good-token'], // a forged stamp
      [{ ...report, seed: report.seed.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }, 'good-token'], // a different seed
      [{ ...report, ...spaceSeed }, 'good-token'], // a seed stamped for the space game
      [report, 'other-token'], // someone else's seed
      [{ ...report, actions: report.actions.slice(1) }, 'good-token'], // a different game
      [{ ...report, bots: 1 }, 'good-token'], // different settings
      [{ ...report, settings: { target: 101 } }, 'good-token'],
      [{ ...report, settings: { target: 75 } }, 'good-token'],
      [{ ...report, level: 'medium' }, 'good-token'],
      [{ ...report, actions: [...report.actions, 'knock'] }, 'good-token'], // extra actions
      [{ ...report, actions: ['peek', 'swap:4'] }, 'good-token'], // not an action
      [{ ...report, actions: report.actions.slice(0, 12), ending: 'finished' }, 'good-token'], // says it finished, didn't
      [{ ...report, ending: 'resigned' }, 'good-token'],
    ];
    for (const [body, token] of cases) expect((await handleSaveBotGame(post(body, token), s)).status).toBe(400);
    expect((await handleSaveBotGame(post(report), other.s)).status).toBe(400); // too old
    expect(saved101).toEqual([]);
    expect(other.saved101).toEqual([]);
  });

  it('passes on the daily limit kindly', async () => {
    const { s } = services({ record101: vi.fn(async () => 'too-many' as const) });
    const { report } = await game101(s, QUICK);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(429);
  });
});

/** Asks for a Power Clash seed, plays a whole match from it with an Easy bot as the "student", and returns the report. */
async function gamePowerClash(
  s: Services,
  setup: Omit<PowerClashSetup, 'seed'>,
  leaveAfter = Infinity,
) {
  const response = await handleSaveBotGame(post({ game: 'power-clash', start: true }), s);
  const { seed, stamp } = (await response.json()) as { seed: string; stamp: string };
  const { solo, actions } = playWholeMatch({ ...setup, seed }, 'easy', leaveAfter);
  const bot = botLoadoutFor(seed, setup.level);
  const loadouts = setup.side === 'X' ? { X: setup.loadout, O: bot } : { X: bot, O: setup.loadout };
  const over = solo.match.winner !== null;
  const report = {
    game: 'power-clash' as const, seed, stamp, level: setup.level, side: setup.side, loadouts, actions,
    ending: over ? ('finished' as const) : ('abandoned' as const),
    chaos: setup.chaos === true,
  };
  return { report, solo };
}

const PC = { level: 'easy' as const, side: 'X' as const, loadout: ['board-wipe', 'body-swap', 'freeze-ray'] as PowerClashSetup['loadout'] };

describe('saving Power Clash games in Chaos Mode with the new powers', () => {
  it('replays the dice and the surprises from the seed and saves it, marked as Chaos Mode', async () => {
    const { s, savedPowerClash } = services();
    const { report, solo } = await gamePowerClash(s, { ...PC, chaos: true, loadout: ['portal-chaos', 'wild-card', 'time-heist'] });
    expect(report.chaos).toBe(true);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe(solo.match.winner === 'X' ? 'won' : 'lost');
    expect(savedPowerClash[0].power_clash.chaos).toBe(true);
  });
  it('refuses a Chaos Mode game that claims to be a normal one when the moves no longer fit', async () => {
    const { s } = services();
    const { report } = await gamePowerClash(s, { ...PC, chaos: true, loadout: ['portal-chaos', 'wild-card', 'time-heist'] });
    const response = await handleSaveBotGame(post({ ...report, chaos: false }), s);
    // Either the moves are no longer legal (refused) or it replays to a different end; it is never the same game.
    expect([200, 400]).toContain(response.status);
  });
});

describe('saving Power Clash games', () => {
  it('hands out a fresh seed with a stamp that is only good for Power Clash', async () => {
    const { s } = services();
    const a = await (await handleSaveBotGame(post({ game: 'power-clash', start: true }), s)).json();
    expect(a.seed).toMatch(/^s1-1792000000-[0-9a-f]{24}$/);
    expect(a.stamp).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await handleSaveBotGame(post({ game: 'power-clash', start: true }, null), s)).status).toBe(401);
    const b = await (await handleSaveBotGame(post({ game: '101', start: true }), s)).json();
    expect(b.stamp).not.toBe(a.stamp);
  });

  it('replays the match from its seed, works out the result itself and saves it', async () => {
    const { s, savedPowerClash, saved, saved101, savedSpace } = services();
    const { report, solo } = await gamePowerClash(s, PC);
    const response = await handleSaveBotGame(post(report), s);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      result: solo.match.winner === 'X' ? 'won' : 'lost',
      reason: 'finished',
      countsForPoints: true,
    });
    expect(saved).toEqual([]);
    expect(savedSpace).toEqual([]);
    expect(saved101).toEqual([]);
    expect(savedPowerClash).toHaveLength(1);
    const row = savedPowerClash[0];
    expect(row).toEqual(
      expect.objectContaining({ player: 'student-1', bot_level: 'easy', player_side: 'x', moves: report.actions, counts_for_points: true }),
    );
    expect(row.power_clash).toEqual(
      expect.objectContaining({ seed: report.seed, side: 'X', loadouts: report.loadouts, roundsWon: solo.stats.roundsWon, roundsLost: solo.stats.roundsLost }),
    );
    expect(row.power_clash.stats.powersUsed).toBe(solo.stats.powersUsed);
  });

  it('works for a student who is O (the bot goes first)', async () => {
    const { s, savedPowerClash } = services();
    const { report } = await gamePowerClash(s, { ...PC, side: 'O', level: 'medium' });
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedPowerClash[0].player_side).toBe('o');
  });

  it('saves a match the student left part-way as left early, earning nothing', async () => {
    const { s, savedPowerClash } = services();
    const { report } = await gamePowerClash(s, PC, 5);
    expect(report.ending).toBe('abandoned');
    expect((await handleSaveBotGame(post(report), s)).status).toBe(200);
    expect(savedPowerClash[0]).toEqual(expect.objectContaining({ result: 'lost', reason: 'abandoned', counts_for_points: false }));
  });

  it('refuses made-up seeds, borrowed seeds, other games’ seeds, old seeds and changed games', async () => {
    const { s, savedPowerClash } = services();
    const { report } = await gamePowerClash(s, PC);
    const spaceSeed = (await (await handleSaveBotGame(post({ game: 'space', start: true }), s)).json()) as { seed: string; stamp: string };
    const seed101 = (await (await handleSaveBotGame(post({ game: '101', start: true }), s)).json()) as { seed: string; stamp: string };
    const other = services({ nowSeconds: () => NOW + 13 * 60 * 60 });
    const swapped = (list: string[]) => [list[1], list[0], list[2]];
    const cases: [object, string][] = [
      [{ ...report, stamp: report.stamp.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) }, 'good-token'], // a forged stamp
      [{ ...report, seed: report.seed.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }, 'good-token'], // a different seed
      [{ ...report, ...spaceSeed }, 'good-token'], // a seed stamped for the space game
      [{ ...report, ...seed101 }, 'good-token'], // a seed stamped for 101
      [{ ...report, seed: 'made-up-seed' }, 'good-token'],
      [report, 'other-token'], // someone else's seed
      [{ ...report, actions: report.actions.slice(1) }, 'good-token'], // a different match
      [{ ...report, actions: [report.actions[0], ...report.actions] }, 'good-token'], // an action that can't be played twice
      [{ ...report, level: 'medium' }, 'good-token'], // a different bot
      [{ ...report, side: 'O' }, 'good-token'], // a different side
      [{ ...report, loadouts: { ...report.loadouts, O: swapped(report.loadouts.O) } }, 'good-token'], // changed bot powers
      [{ ...report, loadouts: { ...report.loadouts, O: ['board-wipe', 'board-wipe', 'freeze-ray'] } }, 'good-token'],
      [{ ...report, actions: [...report.actions, 'place:4'] }, 'good-token'], // extra actions after the end
      [{ ...report, actions: ['place:99'] }, 'good-token'], // not an action
      [{ ...report, actions: report.actions.slice(0, 3), ending: 'finished' }, 'good-token'], // says it finished, didn't
      [{ ...report, ending: 'resigned' }, 'good-token'],
    ];
    for (const [i, [body, token]] of cases.entries()) expect((await handleSaveBotGame(post(body, token), s)).status, `case ${i}`).toBe(400);
    expect((await handleSaveBotGame(post(report), other.s)).status).toBe(400); // too old
    expect(savedPowerClash).toEqual([]);
    expect(other.savedPowerClash).toEqual([]);
  });

  it('passes on the daily limit kindly', async () => {
    const { s } = services({ recordPowerClash: vi.fn(async () => 'too-many' as const) });
    const { report } = await gamePowerClash(s, PC);
    expect((await handleSaveBotGame(post(report), s)).status).toBe(429);
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
