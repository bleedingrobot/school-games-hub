import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACHIEVEMENT_POINTS, asEarned, fetchMyNewAchievements, markMyAchievementsSeen, type NewAchievement } from '../data/newAchievements';
import { playSound } from '../games/sounds';
import { useSound } from '../sound';
import { EarnBurst } from './EarnBurst';
import { Medallion, TIER_WORDS } from './Medallion';
import './earn.css';

/** How long each medallion shows before the next one flips in, and how long the last one stays. */
const FLIP_MS = 3600;
const STAY_MS = 9000;

const NOT_YET = Symbol('not asked yet');

/** Easiest first, so a gold one is the finale. */
const byTier = (list: NewAchievement[]) => [...list].sort((a, b) => (a.tier ?? 2) - (b.tier ?? 2));

/**
 * "New achievement!" on a game's result screen (docs/ACHIEVEMENTS-PLAN.md, stage 3): the medallion slides in with a
 * painted burst, then its name, "+10 points" and "See it" (the Achievement Hall). Several flip in one after another.
 *
 * The server decides every achievement. Like TrophyWonLine, this asks only when `watch` changes to a new value that isn't
 * null (something that changes after a finished go is saved), then shows `games`' achievements the pupil hasn't seen and
 * marks just those seen, so the hub doesn't show them again. Any others wait for the hub's own moment.
 * `atOpen` asks once as soon as it appears too (a finish panel that opens after the save, like the kit's WhatsNext).
 * `off` (a trial with no server) asks nothing and shows `pretend` instead, if given.
 */
export function AchievementPop({ games, watch, off = false, pretend, atOpen = false }: { games: string[]; watch: unknown; off?: boolean; pretend?: NewAchievement[]; atOpen?: boolean }) {
  const last = useRef<unknown>(atOpen ? NOT_YET : watch);
  const [queue, setQueue] = useState<NewAchievement[]>([]);
  const [at, setAt] = useState(0);
  const { soundOn } = useSound();
  const key = games.join(',');
  const pretendRef = useRef(pretend);
  pretendRef.current = pretend;

  useEffect(() => {
    if (watch === null || watch === undefined || Object.is(watch, last.current)) return;
    last.current = watch;
    if (off) {
      const shown = pretendRef.current ?? [];
      if (shown.length) {
        setQueue(byTier(shown));
        setAt(0);
      }
      return;
    }
    let live = true;
    void fetchMyNewAchievements().then((fresh) => {
      const mine = fresh.filter((a) => key.split(',').includes(a.game));
      if (!live || mine.length === 0) return;
      setQueue(byTier(mine));
      setAt(0);
      void markMyAchievementsSeen(mine.map((a) => a.id)).catch(() => undefined);
    });
    return () => void (live = false);
  }, [watch, key, off]);

  const showing = queue[at];

  // The chime for each one as it lands; then the next flips in, and the last one leaves by itself.
  useEffect(() => {
    if (!showing) return;
    if (soundOn) setTimeout(() => playSound('medal'), 380);
    const t = setTimeout(() => (at < queue.length - 1 ? setAt(at + 1) : setQueue([])), at < queue.length - 1 ? FLIP_MS : STAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing?.id, at]);

  if (!showing || typeof document === 'undefined') return null;
  const more = queue.length - at - 1;
  const tier = showing.tier ?? 2;
  return createPortal(
    <div className={`ach-pop ach-pop--t${tier}`} role="status" aria-live="polite">
      <div className="ach-pop__card" key={showing.id} data-first={at === 0 ? '' : undefined}>
        <span className="ach-pop__medal">
          <EarnBurst tier={tier} size={190} play={showing.id} />
          <Medallion a={asEarned(showing)} size={84} />
        </span>
        <span className="ach-pop__words">
          <span className="ach-pop__kicker">New achievement!</span>
          <strong className="ach-pop__name">{showing.name}</strong>
          <span className="ach-pop__points">
            +{ACHIEVEMENT_POINTS} points · {TIER_WORDS[tier]}
          </span>
        </span>
        <span className="ach-pop__buttons">
          <a className="ach-pop__see" href="#/achievements">
            See it
          </a>
          {more > 0 ? (
            <button type="button" className="ach-pop__next" onClick={() => setAt(at + 1)}>
              Next ({more}) ➜
            </button>
          ) : (
            <button type="button" className="ach-pop__close" onClick={() => setQueue([])} aria-label="Close">
              ✕
            </button>
          )}
        </span>
      </div>
      {queue.length > 1 && (
        <span className="ach-pop__dots" aria-hidden="true">
          {queue.map((a, i) => (
            <span key={a.id} className={i === at ? 'is-on' : ''} />
          ))}
        </span>
      )}
    </div>,
    document.body,
  );
}
