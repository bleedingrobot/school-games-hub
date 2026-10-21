/**
 * The home screen, in the pupil's own layout (docs/ARCHERY-PLAN.md, section 1): the title banner at the top, the coins
 * top right, the four world buttons around the archer on a rock, a big Play button, and along the bottom More Bows,
 * Armory and the speed round ("Earn coins: speed round", with the pupil's words under it: "Maths to get better").
 */
import { useEffect, useRef } from 'react';
import { WORLD_IDS, type BowId, type WorldId } from '../../../shared/archery/types';
import { CoinCount } from './CoinCount';
import { HomeScene } from './HomeScene';
import { WORLD_NAMES } from './text';

const WORLD_ICONS: Record<WorldId, string> = {
  forest: 'M12 2 4 12h4l-5 6h7v4h4v-4h7l-5-6h4z',
  desert: 'M10 22V5a2 2 0 0 1 4 0v17zM14 12h3V8a1.5 1.5 0 0 1 3 0v6a2 2 0 0 1-2 2h-4zM10 14H7a2 2 0 0 1-2-2V9a1.5 1.5 0 0 1 3 0v2h2z',
  snow: 'M11 2h2v7.3l6.3-3.6 1 1.7L14 11l6.3 3.6-1 1.7L13 12.7V22h-2v-9.3l-6.3 3.6-1-1.7L10 11 3.7 7.4l1-1.7L11 9.3z',
  city: 'M2 22V11h5V6h6v6h3V3h6v19z',
};

export function HomeScreen({ coins, world, bow, lessMotion, onPlay, onWorld, onArmory, onBows, onSpeed, onHowTo, onExit, onClassmate }: {
  coins: number;
  /** The world shown behind (the last one played). */
  world: WorldId;
  bow: BowId;
  lessMotion: boolean;
  onPlay: () => void;
  onWorld: (w: WorldId) => void;
  onArmory: () => void;
  onBows: () => void;
  onSpeed: () => void;
  onHowTo: () => void;
  onExit?: () => void;
  /** Challenge a classmate (left out when classmate fights aren't available). */
  onClassmate?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <section className="ar-home" aria-labelledby="ar-home-title">
      <HomeScene world={world} bow={bow} lessMotion={lessMotion} />
      <div className="ar-home__ui">
        <div className="ar-home__top">
          <div className="ar-home__corner">
            {onExit && <button type="button" className="button button--light ar-btn" onClick={onExit}>Leave</button>}
            <button type="button" className="button button--light ar-btn" onClick={onHowTo}>How to play</button>
          </div>
          <h2 id="ar-home-title" ref={heading} tabIndex={-1} className="ar-banner">
            <span>Archery</span>
            <small>Challenge</small>
          </h2>
          <div className="ar-home__corner ar-home__corner--right">
            <CoinCount coins={coins} onEarn={onSpeed} />
          </div>
        </div>
        <div className="ar-home__worlds" role="group" aria-label="Pick a world to fight in">
          {WORLD_IDS.map((w) => (
            <button key={w} type="button" className={`button button--play ar-btn ar-chunky ar-chunky--${w}`} onClick={() => onWorld(w)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={WORLD_ICONS[w]} fill="#fff" /></svg>
              {WORLD_NAMES[w]}
            </button>
          ))}
        </div>
        <div className="ar-home__go">
          <button type="button" className="button button--play ar-btn ar-chunky ar-chunky--play" onClick={onPlay}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h13l-3 3 1.5 1.5L21 12l-6.5-5.5L13 8l3 3H3z" fill="#fff" /></svg>
            Play
          </button>
          {onClassmate && (
            <button type="button" className="button button--play ar-btn ar-chunky ar-chunky--mates" onClick={onClassmate}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1 20c0-3.5 3-6 7-6s7 2.5 7 6zm14.5 0c0-2-.7-3.8-2-5.1.8-.3 1.6-.4 2.5-.4 3.6 0 7 2.1 7 5.5z" fill="#fff" /></svg>
              Challenge a classmate
            </button>
          )}
        </div>
        <div className="ar-home__bottom">
          <button type="button" className="button button--play ar-btn ar-chunky ar-chunky--bows" onClick={onBows}>More Bows</button>
          <button type="button" className="button button--play ar-btn ar-chunky ar-chunky--armory" onClick={onArmory}>Armory</button>
          <button type="button" className="button button--play ar-btn ar-chunky ar-chunky--speed" onClick={onSpeed}>
            <span>Earn coins: speed round<small>Maths to get better</small></span>
          </button>
        </div>
      </div>
    </section>
  );
}
