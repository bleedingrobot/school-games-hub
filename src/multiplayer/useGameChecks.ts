import { useEffect, useRef } from 'react';
import type { LiveStatus } from '../data/multiplayer';

/**
 * How often a game with classmates checks for changes in case a live update was missed (docs/SERVER-LOAD-PLAN.md, S.3). Rarely
 * while live updates work. When they break, soon at first and then less and less often, because if they break for a whole class
 * at once, the server is probably struggling already and a class asking every 4 seconds would make it worse.
 */
export const CHECK_EVERY_MS = { live: 20_000, down: [4_000, 8_000, 16_000, 30_000] };

/** Each wait is made up to a quarter longer, at random, so a class doesn't ask in step. */
export const SPREAD = 0.25;
/** No wait is longer than this, so an opponent's move shows within 30 seconds even with live updates broken (James, 19 Oct 2026). */
export const LONGEST_WAIT_MS = 30_000;

/** The wait before check number `step` (0 is the first) since live updates were last working or not. */
export function checkGap(live: boolean, step: number, random: () => number = Math.random): number {
  const gap = live ? CHECK_EVERY_MS.live : CHECK_EVERY_MS.down[Math.min(step, CHECK_EVERY_MS.down.length - 1)];
  // Capping the 30-second waits keeps a class spread out: the random parts of the shorter waits before them stay.
  return Math.min(LONGEST_WAIT_MS, Math.round(gap * (1 + SPREAD * random())));
}

/**
 * Checks the game now and then while it is `active`. Nothing is checked while the tab is hidden (the game's own "coming back
 * to the tab" check looks again straight away). Your own moves never wait for this: they go straight to the server.
 */
export function useGameChecks(active: boolean, live: LiveStatus, check: () => void) {
  const latest = useRef(check);
  useEffect(() => {
    latest.current = check;
  }, [check]);
  // Connecting and down are the same here, so a connection that keeps dropping doesn't start the waits again each time.
  const isLive = live === 'live';
  useEffect(() => {
    if (!active) return;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => {
        step += 1;
        if (document.visibilityState !== 'hidden') latest.current();
        wait();
      }, checkGap(isLive, step));
    };
    wait();
    return () => clearTimeout(timer);
  }, [active, isLive]);
}
