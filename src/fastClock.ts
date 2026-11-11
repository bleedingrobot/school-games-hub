import { vi } from 'vitest';

/**
 * For screen tests that wait on the game's own timers (voice lines, hands that appear after a pause): fakes the clock and
 * runs it about 20 times faster than real time, so a 20-second guided go takes about a second. findBy, waitFor and
 * userEvent keep working, because their own timers run on the same fast clock. Call `stop()` when the test ends.
 */
export function fastClock(speed = 20) {
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  const step = 10;
  const driver = realSetInterval(() => vi.advanceTimersByTime(step * speed), step);
  return () => {
    realClearInterval(driver);
    vi.useRealTimers();
  };
}
