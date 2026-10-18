import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BondMatchItem, SaveResult } from '../../shared/bond-match/save';

const rpc = vi.fn();
let session: { access_token: string } | null = { access_token: 'token' };
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { enqueue, fetchStudentBondMatch, flushGames, makeSaver, queuedGames } from './bondMatch';

const fetchMock = vi.fn<typeof fetch>();
let ME = '';
let n = 0;

const game = (over: Partial<BondMatchItem> = {}): BondMatchItem => ({
  runId: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, seed: 5, bondId: 'whole-10', size: 'small', flips: [0, 1, 2, 3], seconds: 40, ...over,
});
const saved = (over = {}): SaveResult => ({ status: 'saved', points: 2, stars: 3, best: { flips: 6, seconds: 40, stars: 3 }, ...over }) as SaveResult;
const reply = (results: SaveResult[], handled = results.length) => new Response(JSON.stringify({ handled, results }));
const sentRuns = (call: number) => (JSON.parse(fetchMock.mock.calls[call][1]!.body as string).items as BondMatchItem[]).map((i) => i.runId);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  rpc.mockReset();
  session = { access_token: 'token' };
  ME = crypto.randomUUID();
});

describe('the Bond Match save queue', () => {
  it('keeps a game once, however many times it is queued', () => {
    const g = game();
    enqueue(ME, g);
    enqueue(ME, g);
    expect(queuedGames(ME)).toEqual([g]);
    expect(JSON.parse(localStorage.getItem(`sgh-bond-match-queue:${ME}`)!)).toHaveLength(1);
  });

  it('sends the queue with the sign-in token, and empties it once the server has dealt with the games', async () => {
    const a = game();
    const b = game();
    enqueue(ME, a);
    enqueue(ME, b);
    fetchMock.mockResolvedValueOnce(reply([saved(), saved()]));
    const answers = await flushGames(ME);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/functions\/v1\/bond-match$/);
    expect((fetchMock.mock.calls[0][1]!.headers as Record<string, string>).Authorization).toBe('Bearer token');
    expect(sentRuns(0)).toEqual([a.runId, b.runId]);
    expect(answers.get(a.runId)).toMatchObject({ status: 'saved' });
    expect(queuedGames(ME)).toEqual([]);
    expect(localStorage.getItem(`sgh-bond-match-queue:${ME}`)).toBeNull();
  });

  it('keeps the games when the server cannot be reached, and sends them next time, once each', async () => {
    const a = game();
    enqueue(ME, a);
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect((await flushGames(ME)).size).toBe(0);
    expect(queuedGames(ME)).toEqual([a]);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await flushGames(ME);
    expect(queuedGames(ME)).toEqual([a]);
    fetchMock.mockResolvedValueOnce(reply([saved()]));
    await flushGames(ME);
    expect(queuedGames(ME)).toEqual([]);
    expect(sentRuns(2)).toEqual([a.runId]);
  });

  it('keeps the games when nobody is signed in', async () => {
    session = null;
    enqueue(ME, game());
    expect((await flushGames(ME)).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queuedGames(ME)).toHaveLength(1);
  });

  it('keeps what the server has not dealt with yet (it stopped at the daily limit)', async () => {
    const [a, b, c] = [game(), game(), game()];
    [a, b, c].forEach((g) => enqueue(ME, g));
    fetchMock.mockResolvedValueOnce(reply([saved()], 1));
    await flushGames(ME);
    expect(queuedGames(ME).map((g) => g.runId)).toEqual([b.runId, c.runId]);
  });

  it('drops a game the server will never take, so it is not sent again for ever', async () => {
    enqueue(ME, game());
    fetchMock.mockResolvedValueOnce(reply([{ status: 'invalid', problem: 'too fast' }]));
    await flushGames(ME);
    expect(queuedGames(ME)).toEqual([]);
  });

  it('sends a long queue in several requests', async () => {
    const games = Array.from({ length: 25 }, () => game());
    games.forEach((g) => enqueue(ME, g));
    fetchMock.mockImplementation(async (_url, init) => {
      const items = JSON.parse(init!.body as string).items as BondMatchItem[];
      return reply(items.map(() => saved()));
    });
    await flushGames(ME);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(queuedGames(ME)).toEqual([]);
  });

  it('still works when localStorage is blocked (the queue lasts until the page closes)', async () => {
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const g = game();
    enqueue(ME, g);
    expect(queuedGames(ME)).toEqual([g]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(real);
    vi.restoreAllMocks();
  });
});

describe('the saver the screens use', () => {
  it('saves a game and gives back the server\'s answer for that game', async () => {
    const g = game();
    fetchMock.mockResolvedValueOnce(reply([saved({ points: 2 })]));
    expect(await makeSaver(ME).save(g)).toMatchObject({ status: 'saved', points: 2 });
  });

  it('gives back null when it could not be saved yet, and the game waits in the queue', async () => {
    const g = game();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await makeSaver(ME).save(g)).toBeNull();
    expect(queuedGames(ME)).toEqual([g]);
  });

  it('loads the bests after sending what is waiting, and gives null if it cannot', async () => {
    enqueue(ME, game());
    fetchMock.mockResolvedValueOnce(reply([saved()]));
    rpc.mockResolvedValueOnce({ data: { bests: [{ bondId: 'whole-10', size: 'small', flips: 6, seconds: 40, stars: 3, plays: 1 }] }, error: null });
    expect(await makeSaver(ME).loadBests()).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('my_bond_match');
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'x' } });
    expect(await makeSaver(ME).loadBests()).toBeNull();
    rpc.mockRejectedValueOnce(new Error('offline'));
    expect(await makeSaver(ME).loadBests()).toBeNull();
  });
});

describe('the teacher view', () => {
  it('asks the database for one student', async () => {
    rpc.mockResolvedValueOnce({ data: { bests: [], games: 0, lastPlayed: null }, error: null });
    await fetchStudentBondMatch('student-7');
    expect(rpc).toHaveBeenCalledWith('teacher_bond_match_student', { student: 'student-7' });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023' } });
    await expect(fetchStudentBondMatch('student-8')).rejects.toThrow();
  });
});
