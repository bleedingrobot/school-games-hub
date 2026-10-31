import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
let authListener: ((event: string, session: { user: { id: string } } | null) => void) | null = null;
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (fn: typeof authListener) => {
        authListener = fn;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { noteQuestion } from '../maths/questionLog';
import { addNote, BATCH, fetchQuestionSkips, gameFromHash, MAX_QUEUED, queuedNotes, sendNotes, startQuestionLog, type LoggedNote } from './questionLog';

// A new student each test, so no queue carries over (the queue is also kept in memory).
let ME = '';
const note = (n = 0): LoggedNote => ({ game: 'marble', spot: 'Pit stop', skipped: n % 2 === 0, ms: 1000 + n, at: 1_800_000_000_000 + n });

beforeEach(() => {
  ME = crypto.randomUUID();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: 1, error: null });
});
afterEach(() => vi.useRealTimers());

describe('gameFromHash', () => {
  it('reads the game from the page address', () => {
    expect(gameFromHash('#/marble')).toBe('marble');
    expect(gameFromHash('#/dragon-maths?x=1')).toBe('dragon-maths');
    expect(gameFromHash('#/space-game/abc')).toBe('space');
    expect(gameFromHash('#/card-game/abc')).toBe('101');
    expect(gameFromHash('#/placement')).toBe('placement');
    expect(gameFromHash('')).toBe('other');
    expect(gameFromHash('#/Ünïcode')).toBe('other');
  });
});

describe('the queue', () => {
  it('is kept per student, and keeps only the newest notes', () => {
    for (let i = 0; i < MAX_QUEUED + 5; i++) addNote(ME, note(i));
    expect(queuedNotes(ME)).toHaveLength(MAX_QUEUED);
    expect(queuedNotes(ME)[0].ms).toBe(1005);
    expect(queuedNotes(crypto.randomUUID())).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`sgh-question-log:${ME}`)!)).toHaveLength(MAX_QUEUED);
  });

  it('goes in batches, and empties once sent', async () => {
    for (let i = 0; i < BATCH + 20; i++) addNote(ME, note(i));
    expect(await sendNotes(ME)).toBe(BATCH + 20);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe('log_questions');
    expect(rpc.mock.calls[0][1].items).toHaveLength(BATCH);
    expect(rpc.mock.calls[0][1].items[0]).toEqual({ game: 'marble', spot: 'Pit stop', skipped: true, ms: 1000, at: 1_800_000_000_000 });
    expect(queuedNotes(ME)).toEqual([]);
    expect(localStorage.getItem(`sgh-question-log:${ME}`)).toBeNull();
  });

  it('keeps everything when the send fails, and when offline', async () => {
    addNote(ME, note());
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'busy' } });
    expect(await sendNotes(ME)).toBe(0);
    rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await sendNotes(ME)).toBe(0);
    expect(queuedNotes(ME)).toHaveLength(1);
    expect(await sendNotes(ME)).toBe(1);
  });

  it('keeps notes added while a batch was on its way', async () => {
    addNote(ME, note(1));
    let finish: (v: unknown) => void = () => {};
    rpc.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const sending = sendNotes(ME);
    addNote(ME, note(2));
    finish({ data: 1, error: null });
    await sending;
    // The second note went in a second batch straight after.
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(queuedNotes(ME)).toEqual([]);
  });
});

describe('startQuestionLog', () => {
  it('queues the box’s notes for whoever is signed in, with the game, and sends them a little later', async () => {
    vi.useFakeTimers();
    startQuestionLog();
    window.location.hash = '#/marble';
    noteQuestion({ spot: 'Rescue', skipped: true, ms: 4000 });
    expect(rpc).not.toHaveBeenCalled(); // nobody signed in: dropped
    authListener!('SIGNED_IN', { user: { id: ME } });
    noteQuestion({ spot: 'Rescue', skipped: true, ms: 4000 });
    expect(queuedNotes(ME)).toEqual([expect.objectContaining({ game: 'marble', spot: 'Rescue', skipped: true, ms: 4000 })]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(queuedNotes(ME)).toEqual([]);
  });
});

describe('fetchQuestionSkips', () => {
  it('reads the teacher’s counts', async () => {
    rpc.mockResolvedValueOnce({ data: { students: [{ id: 'a' }], spots: [] }, error: null });
    expect(await fetchQuestionSkips('class-1', 7)).toEqual({ students: [{ id: 'a' }], spots: [] });
    expect(rpc).toHaveBeenCalledWith('teacher_question_skips', { target_class: 'class-1', days: 7 });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'no' } });
    await expect(fetchQuestionSkips(null, 7)).rejects.toThrow('no');
  });
});
