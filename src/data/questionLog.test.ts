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

import { addNote, MAX_QUEUED, queuedNotes, sendNotes, type LoggedNote } from './questionLog';

// A new student each test, so no queue carries over (the queue is also kept in memory).
let ME = '';
const note = (n = 0): LoggedNote => ({ game: 'marble', spot: 'Pit stop', skipped: n % 2 === 0, ms: 1000 + n, at: 1_800_000_000_000 + n });

beforeEach(() => {
  ME = crypto.randomUUID();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: 1, error: null });
});
afterEach(() => vi.useRealTimers());

describe('the queue', () => {
  it('is kept per student, keeps only the newest notes, and keeps everything when the send fails or is offline', async () => {
    for (let i = 0; i < MAX_QUEUED + 5; i++) addNote(ME, note(i));
    expect(queuedNotes(ME)).toHaveLength(MAX_QUEUED);
    expect(queuedNotes(ME)[0].ms).toBe(1005);
    expect(queuedNotes(crypto.randomUUID())).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`sgh-question-log:${ME}`)!)).toHaveLength(MAX_QUEUED);
    expect(await sendNotes(ME)).toBe(MAX_QUEUED);

    // Keeps everything when the send fails, and when offline.
    addNote(ME, note());
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'busy' } });
    expect(await sendNotes(ME)).toBe(0);
    rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await sendNotes(ME)).toBe(0);
    expect(queuedNotes(ME)).toHaveLength(1);
    expect(await sendNotes(ME)).toBe(1);
  });
});
