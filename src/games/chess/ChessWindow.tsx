import type { CSSProperties, ReactNode } from 'react';
import { useSound } from '../../sound';
import castle from './art/bg/castle.webp';
import castleSmall from './art/bg/castle-800.webp';
import './chess.css';

/** Golden dust drifting up through the hall's light. Fixed numbers, so it looks the same every time. */
const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 3 + ((i * 7) % 5),
  duration: 9 + ((i * 13) % 9),
  delay: -((i * 11) % 17),
  drift: ((i * 29) % 60) - 30,
}));

/**
 * Chess fills the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), with a painted
 * background behind the board. The way back to the hub and the sound switch sit on the painting instead.
 */
export function ChessWindow({ children }: { children: ReactNode }) {
  const { soundOn, setSoundOn } = useSound();
  return (
    <div className="cw">
      <div className="cw__bg" aria-hidden="true">
        <img src={castle} srcSet={`${castleSmall} 800w, ${castle} 1600w`} sizes="100vw" alt="" />
        <div className="cw__motes">
          {MOTES.map((m, i) => (
            <span
              key={i}
              style={
                {
                  left: `${m.left}%`,
                  width: m.size,
                  height: m.size,
                  animationDuration: `${m.duration}s`,
                  animationDelay: `${m.delay}s`,
                  '--cw-drift': `${m.drift}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <div className="cw__inner">
        <div className="cw__top">
          <a className="cw-btn" href="#/">
            <span aria-hidden="true">⌂</span> Hub
          </a>
          <span className="cw__title" aria-hidden="true">
            ♞ Chess
          </span>
          <button
            type="button"
            className="cw-btn"
            aria-pressed={soundOn}
            onClick={() => setSoundOn(!soundOn)}
            title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
          >
            <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
            <span className="cw-sr">Sound</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
