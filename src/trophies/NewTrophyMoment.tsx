import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { fetchMyNewTrophies, markMyTrophiesSeen, type NewTrophy } from '../data/trophies';
import { playSound } from '../games/sounds';
import { useSound } from '../sound';
import { trophyGame } from './cabinet';
import { TrophyArt } from './TrophyArt';
import './trophies.css';

/** The hub's own pages, where the moment may appear. Never inside a game, a lesson or a teacher page. */
const HUB_PAGES = ['/', '/lobby', '/leaderboard', '/profile', '/points', '/warp'];

const METAL_WORDS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' } as const;

/** The line under the trophy's name: what this win did. */
function winWords(t: NewTrophy): string {
  if (t.count <= 1) return t.kind === 'picture' ? 'You can wear it as your picture: tap “Change my look”.' : 'It’s in your trophy cabinet for good.';
  if (t.tier === 'gold' && t.count > 3) return `Gold, ${t.count} times! What a champion.`;
  return `You won it again, so it’s ${METAL_WORDS[t.tier].toLowerCase()} now!`;
}

/**
 * A full-screen "New trophy!" the next time a pupil opens a hub page after winning one, once per trophy (the server
 * remembers it was shown). Several at once come one after another. It plays the fanfare only with sound on, and keeps
 * still for pupils whose device asks for less motion.
 */
export function NewTrophyMoment() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { soundOn } = useSound();
  const [queue, setQueue] = useState<NewTrophy[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isPupil = profile?.role === 'student';
  const onHubPage = HUB_PAGES.includes(pathname);
  const showing = onHubPage ? queue[0] : undefined;

  // Ask on each hub page the pupil opens (a game ends by coming back to one), unless one is showing already.
  useEffect(() => {
    if (!isPupil || !onHubPage || queue.length > 0) return;
    let current = true;
    void fetchMyNewTrophies().then((fresh) => {
      if (!current || fresh.length === 0) return;
      setQueue(fresh);
      // Shown once: tell the server straight away, so a reload or another tab doesn't show them again.
      void markMyTrophiesSeen().catch(() => {});
    });
    return () => {
      current = false;
    };
    // Only a new page (or a new pupil) asks again; emptying the queue does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPupil, onHubPage, pathname]);

  useEffect(() => {
    if (!showing) return;
    closeRef.current?.focus();
    if (soundOn) playSound('badge');
    // Each trophy plays its fanfare once, when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing?.id]);

  useEffect(() => {
    if (!showing) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setQueue([]);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showing]);

  if (!showing) return null;
  const more = queue.length - 1;
  const game = trophyGame(showing.game);

  return (
    <div className="new-trophy" role="dialog" aria-modal="true" aria-labelledby="new-trophy-title" data-tier={showing.tier}>
      <div className="new-trophy__rays" aria-hidden="true" />
      <div className="new-trophy__confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <div className="new-trophy__card" key={showing.id}>
        <p className="new-trophy__kicker" id="new-trophy-title">
          {showing.kind === 'picture' ? 'New picture!' : 'New trophy!'}
        </p>
        <div className="new-trophy__art">
          <TrophyArt id={showing.id} game={showing.game} kind={showing.kind} tier={showing.tier} size={170} />
        </div>
        <h2 className="new-trophy__name">{showing.name}</h2>
        <p className={`new-trophy__metal cabinet__metal--${showing.tier}`}>
          {METAL_WORDS[showing.tier]}
          {game ? ` · ${game.name}` : ''}
        </p>
        <p className="new-trophy__how">{showing.how}</p>
        <p className="new-trophy__line">{winWords(showing)}</p>
        <div className="new-trophy__buttons">
          {more > 0 ? (
            <button ref={closeRef} type="button" className="button button--primary" onClick={() => setQueue((q) => q.slice(1))}>
              Next ({more} more) ➜
            </button>
          ) : (
            <button ref={closeRef} type="button" className="button button--primary" onClick={() => setQueue([])}>
              Yay!
            </button>
          )}
          {pathname !== '/profile' && (
            <button
              type="button"
              className="button button--light"
              onClick={() => {
                setQueue([]);
                navigate('/profile#trophies');
              }}
            >
              🏆 See my cabinet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
