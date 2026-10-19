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

  it('costs nothing when no answer is on the ladder', async () => {
    const rpc = vi.fn<Rpc>().mockResolvedValue({ error: null });
    await countForFocuses(rpc, 'student-1', 'times-tables', [{ key: 'nonsense', correct: true, ms: 1, at: 1 }], 'gem-keep');
    await countForFocuses(rpc, 'student-1', 'times-tables', [], 'gem-keep');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('logs a database error (the code, not who) and carries on', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn<Rpc>().mockResolvedValue({ error: { code: '42883' } });
    await expect(countForFocuses(rpc, 'student-1', 'times-tables', answers, 'space-game')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('space-game: focus results not counted (42883)');
    expect(String(log.mock.calls[0])).not.toContain('student-1');
  });

  it('logs and carries on when the call itself blows up', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn<Rpc>().mockRejectedValue(new Error('network'));
    await expect(countForFocuses(rpc, 'student-1', 'times-tables', answers, 'save-bot-game')).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('save-bot-game: focus results not counted');
  });
});
