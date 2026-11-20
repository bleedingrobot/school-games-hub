/**
 * The hub's "I'm here" and the challenges waiting for me from any game (docs/plans/play-anyone/PLAN.md, C and D1).
 *
 * - "I'm here" every HUB_HERE_EVERY_MS (a little more, at random, so a class doesn't ask in step) while the page is open
 *   and showing, and again whenever it comes back into view. The server counts a pupil as here for 75 seconds after.
 * - Its reply says which games have a challenge waiting; that game's own "here" brings the challenges themselves.
 * - New challenges also arrive live (Realtime), since a challenge only waits 30 to 60 seconds.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type AskGame, type HubAsk, type HubAskLink } from '../data/hubAsks';

export const HUB_HERE_EVERY_MS = 30_000;

const sameAsk = (a: { game: AskGame; id: number }, b: { game: AskGame; id: number }) => a.game === b.game && a.id === b.id;

export interface HubAsks {
  /** Challenges waiting for me, oldest first (any that ran out are left out). */
  asks: HubAsk[];
  /** Now by the server's clock (ms). */
  serverNow: () => number;
  /** Takes one off the list (answered here, or opened in its game). */
  drop: (ask: HubAsk) => void;
}

export function useHubAsks(link: HubAskLink | undefined, me: string | undefined): HubAsks {
  const [asks, setAsks] = useState<HubAsk[]>([]);
  const offset = useRef(0);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const asksRef = useRef(asks);
  asksRef.current = asks;
  /** Answered or opened here: never shown again, even if a late reply still lists it. */
  const done = useRef<HubAsk[]>([]);

  const merge = useCallback((game: AskGame, fresh: HubAsk[]) => {
    setAsks((list) => {
      const keep = fresh.filter((a) => !done.current.some((d) => sameAsk(a, d)));
      return [...list.filter((a) => a.game !== game), ...keep];
    });
  }, []);

  const checkIn = useCallback(async () => {
    if (!link) return;
    const before = asksRef.current;
    const waiting = await link.checkIn();
    if (!waiting) return;
    // A game with nothing waiting: its challenges have gone (only those known before asking, so a live one isn't lost).
    setAsks((list) => list.filter((a) => waiting.includes(a.game) || !before.some((b) => sameAsk(a, b))));
    for (const game of waiting) {
      const fresh = await link.asksIn(game);
      if (fresh) merge(game, fresh);
    }
  }, [link, merge]);

  useEffect(() => {
    if (!link) return;
    void link.clockOffset().then((ms) => (offset.current = ms));
  }, [link]);

  // "I'm here": now, then every HUB_HERE_EVERY_MS while the page shows.
  useEffect(() => {
    if (!link || !me) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const beat = () => {
      if (stopped) return;
      if (document.visibilityState !== 'hidden') void checkIn();
      timer = setTimeout(beat, Math.round(HUB_HERE_EVERY_MS * (1 + 0.1 * Math.random())));
    };
    beat();
    const again = () => document.visibilityState === 'visible' && void checkIn();
    document.addEventListener('visibilitychange', again);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', again);
    };
  }, [link, me, checkIn]);

  // Live: a new challenge to me, or one that's no longer waiting.
  useEffect(() => {
    if (!link || !me) return;
    return link.watch(me, (heard) => {
      if ('gone' in heard) {
        setAsks((list) => list.filter((a) => !sameAsk(a, heard.gone)));
        return;
      }
      if (done.current.some((d) => sameAsk(d, heard.ask))) return;
      setAsks((list) => [...list.filter((a) => !sameAsk(a, heard.ask)), heard.ask]);
    });
  }, [link, me]);

  // Drop challenges as they run out (checked each second while there are any).
  useEffect(() => {
    if (!asks.length) return;
    const t = setInterval(() => {
      setAsks((list) => {
        const left = list.filter((a) => Date.parse(a.deadline) > serverNow());
        return left.length === list.length ? list : left;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [asks.length, serverNow]);

  const drop = useCallback((ask: HubAsk) => {
    done.current = [...done.current.slice(-20), ask];
    setAsks((list) => list.filter((a) => !sameAsk(a, ask)));
  }, []);

  return { asks, serverNow, drop };
}
