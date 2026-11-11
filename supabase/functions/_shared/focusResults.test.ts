import { afterEach, describe, expect, it, vi } from 'vitest';
import { countForFocuses, type Rpc } from './focusResults';

const answers = [{ key: 'mul:6x7', correct: true, ms: 1000, at: 5 }];

afterEach(() => vi.restoreAllMocks());

describe('counting answers for a focus', () => {
  it('sends the student and the worked-out answers to the database', async () => {
    const rpc = vi.fn<Rpc>().mockResolvedValue({ error: null });
    await countForFocuses(rpc, 'student-1', 'times-tables', answers, 'gem-keep');
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('add_maths_focus_results');
    expect(args.player).toBe('student-1');
    expect(args.answers).toEqual([expect.objectContaining({ at: 5, correct: true, quick: true })]);
  });

});
