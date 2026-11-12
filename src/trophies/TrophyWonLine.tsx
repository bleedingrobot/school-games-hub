import { useEffect, useRef, useState } from 'react';
import { fetchMyTrophies } from '../data/trophies';
import './trophyWon.css';

/**
 * The small "Trophy won!" line a game shows when the server has just given one of its trophies (cards P7 and P8 of
 * docs/plans/profile/PLAN.md). The big "New trophy!" moment is the hub's own (card P5); this only says it happened.
 *
 * The server decides every trophy. This line only reads the pupil's own trophies when the game opens, and again each
 * time `watch` changes to a new value that isn't null (a game passes something that changes after a finished go has
 * been saved, such as the points it was given), and names any of `games`' trophies that are new or won again.
 * `off` (a trial with no server) shows nothing and asks nothing.
 */
export function TrophyWonLine({ games, watch, off = false }: { games: string[]; watch: unknown; off?: boolean }) {
  const counts = useRef<Map<string, number> | null>(null);
  const last = useRef<unknown>(watch);
  const [line, setLine] = useState<string | null>(null);
  const key = games.join(',');

  useEffect(() => {
    if (off) return;
    let live = true;
    fetchMyTrophies()
      .then((t) => {
        if (live && !counts.current) counts.current = new Map(t.trophies.filter((x) => key.split(',').includes(x.game)).map((x) => [x.id, x.count]));
      })
      .catch(() => undefined);
    return () => void (live = false);
  }, [key, off]);

  useEffect(() => {
    if (off || watch === null || watch === undefined || Object.is(watch, last.current)) return;
    last.current = watch;
    let live = true;
    fetchMyTrophies()
      .then((t) => {
        if (!live) return;
        const mine = t.trophies.filter((x) => key.split(',').includes(x.game));
        const before = counts.current;
        counts.current = new Map(mine.map((x) => [x.id, x.count]));
        if (!before) return;
        const won = mine.filter((x) => x.count > (before.get(x.id) ?? 0));
        if (won.length) setLine(won.map((x) => `${x.name} (${x.tier})`).join(', '));
      })
      .catch(() => undefined);
    return () => void (live = false);
  }, [watch, key, off]);

  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => setLine(null), 8000);
    return () => clearTimeout(t);
  }, [line]);

  if (!line) return null;
  return (
    <p className="trophy-won" role="status">
      <span aria-hidden="true">🏆</span> Trophy won! {line}. <span className="trophy-won__more">See it on your profile.</span>
    </p>
  );
}
