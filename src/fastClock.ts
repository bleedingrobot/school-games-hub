import { configure, getConfig } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * For screen tests that wait on the game's own timers (voice lines, hands that appear after a pause): fakes the clock and
 * runs it about 20 times faster than real time, so a 20-second guided go takes about a second. findBy, waitFor and
 * userEvent keep working, because their own timers run on the same fast clock. Call `stop()` when the test ends.
 *
 * Because findBy and waitFor time out on the fast clock too, their 5-second limit is stretched by the same speed, so they
 * still wait about 5 real seconds. Without that, a lazy screen that took more than a quarter of a second to load on a busy
 * PR machine failed the test at random (Weka's guide test, three times in a week). So: don't pass `{ timeout }` in a
 * fast-clock test; the default already covers the game's own waits.
 */
export function fastClock(speed = 20) {
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const timeout = getConfig().asyncUtilTimeout;
  configure({ asyncUtilTimeout: timeout * speed });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  const step = 10;
  const driver = realSetInterval(() => vi.advanceTimersByTime(step * speed), step);
  return () => {
    realClearInterval(driver);
    vi.useRealTimers();
    configure({ asyncUtilTimeout: timeout });
  };
}
