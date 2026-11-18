import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ACHIEVEMENT_POINTS, asEarned, fetchMyNewAchievements, markMyAchievementsSeen, type NewAchievement } from '../data/newAchievements';
import { gameLabel } from '../games/registry';
import { playSound } from '../games/sounds';
import { useSound } from '../sound';
import { HUB_PAGES, useTrophyMomentBusy } from '../trophies/NewTrophyMoment';
import { EarnBurst } from './EarnBurst';
import { Medallion, TIER_WORDS } from './Medallion';
import './earn.css';

/** At most this many one after another; any more are "and 3 more" in the Hall, so it never nags. */
export const SHOW_AT_MOST = 3;

const calm = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Fly the big medallion onto its own spot on the Hall's shelf (only when the moment shows on the Hall itself), then light
 * that spot up. Resolves when it has landed, or straight away when the spot isn't on the page (filtered out) or for
 * reduced motion.
 */
function flyToShelf(medal: HTMLElement | null, id: string): Promise<void> {
  const spot = document.querySelector<HTMLElement>(`[data-achievement="${CSS.escape(id)}"]`);
  if (!medal || !spot || calm() || typeof medal.animate !== 'function') {
    spot?.classList.add('is-landed');
    return Promise.resolve();
  }
  spot.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
  const from = medal.getBoundingClientRect();
  const target = (spot.querySelector('.ah-medal') ?? spot).getBoundingClientRect();
  const dx = target.left + target.width / 2 - (from.left + from.width / 2);
  const dy = target.top + target.height / 2 - (from.top + from.height / 2);
  const scale = target.width / from.width;
  const flight = medal.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 90}px) scale(${(1 + scale) / 1.6}) rotate(-25deg)`, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)` },
    ],
    { duration: 820, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'forwards' },
  );
  return flight.finished.then(
    () => {
      spot.classList.remove('is-landed');
      void spot.offsetWidth;
      spot.classList.add('is-landed');
    },
    () => undefined,
  );
}

/**
 * "New achievement!" the next time a pupil opens a hub page after earning one that no game showed them (stage 3 of
 * docs/ACHIEVEMENTS-PLAN.md), once each: the server keeps a "seen" mark. It waits for the trophy moment (a trophy first,
 * never two at once), shows up to three one after another, then "and N more" with the Hall. On the Hall itself each
 * medallion flies onto its shelf. A chime only with sound on; reduced motion keeps everything still.
 */
export function NewAchievementMoment() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { soundOn } = useSound();
  const trophyBusy = useTrophyMomentBusy();
  const [queue, setQueue] = useState<NewAchievement[]>([]);
  const [extra, setExtra] = useState(0);
  const [at, setAt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const medalRef = useRef<HTMLSpanElement>(null);
  const isPupil = profile?.role === 'student';
  const onHubPage = HUB_PAGES.includes(pathname);
  const inHall = pathname === '/achievements';
  const showing = onHubPage && !trophyBusy ? queue[at] : undefined;

  // Ask on each hub page the pupil opens (a game ends by coming back to one), unless some are waiting already.
  useEffect(() => {
    if (!isPupil || !onHubPage || queue.length > 0) return;
    let current = true;
    void fetchMyNewAchievements().then((fresh) => {
      if (!current || fresh.length === 0) return;
      setQueue(fresh.slice(0, SHOW_AT_MOST));
      setExtra(Math.max(0, fresh.length - SHOW_AT_MOST));
      setAt(0);
      // Shown once: tell the server straight away, so a reload or another tab doesn't show them again.
      void markMyAchievementsSeen(fresh.map((a) => a.id)).catch(() => undefined);
    });
    return () => {
      current = false;
    };
    // Only a new page (or a new pupil) asks again; emptying the queue does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPupil, onHubPage, pathname]);

  useEffect(() => {
    if (!showing) return;
    nextRef.current?.focus({ preventScroll: true });
    if (soundOn) setTimeout(() => playSound('medal'), calm() ? 0 : 420);
    // Each medallion chimes once, when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing?.id]);

  const close = () => {
    setQueue([]);
    setLeaving(false);
  };

  useEffect(() => {
    if (!showing) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showing]);

  if (!showing) return null;
  const last = at >= queue.length - 1;
  const tier = showing.tier ?? 2;
  const game = gameLabel(showing.game);

  /** Next one (or done). On the Hall, this medallion flies onto its shelf first. */
  const onNext = async () => {
    if (leaving) return;
    if (inHall) {
      setLeaving(true);
      await flyToShelf(medalRef.current, showing.id);
      setLeaving(false);
    }
    if (last) close();
    else setAt(at + 1);
  };

  return (
    <div
      className={`ach-moment ach-moment--t${tier}${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ach-moment-title"
    >
      <div className="ach-moment__rays" aria-hidden="true" />
      {queue.length > 1 && (
        <p className="ach-moment__count">
          {at + 1} of {queue.length}
        </p>
      )}
      <div className="ach-moment__card" key={showing.id} data-first={at === 0 ? '' : undefined}>
        <p className="ach-moment__kicker" id="ach-moment-title">
          New achievement!
        </p>
        <span className="ach-moment__medal" ref={medalRef}>
          <EarnBurst tier={tier} size={340} play={showing.id} />
          <Medallion a={asEarned(showing)} size={170} />
        </span>
        <h2 className="ach-moment__name">{showing.name}</h2>
        <p className={`ach-moment__tier ach-moment__tier--t${tier}`}>
          {TIER_WORDS[tier]}
          {game ? ` · ${game}` : ''}
        </p>
        {showing.how && <p className="ach-moment__how">{showing.how}</p>}
        <p className="ach-moment__points">+{ACHIEVEMENT_POINTS} points</p>
        {last && extra > 0 && (
          <p className="ach-moment__more">
            …and {extra} more waiting in your Achievement Hall!
          </p>
        )}
        <div className="ach-moment__buttons">
          <button ref={nextRef} type="button" className="ach-moment__go" onClick={() => void onNext()}>
            {last ? (inHall ? 'Put it on my shelf' : 'Yay!') : `Next (${queue.length - at - 1} more) ➜`}
          </button>
          {!inHall && (
            <button
              type="button"
              className="ach-moment__hall"
              onClick={() => {
                close();
                navigate('/achievements');
              }}
            >
              🏅 {last && extra > 0 ? 'See them all' : 'See it in the Hall'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
