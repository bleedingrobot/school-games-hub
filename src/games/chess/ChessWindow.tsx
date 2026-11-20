import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGameKeys } from '../../kit';
import { useSound } from '../../sound';
import { Locker } from './Locker';
import { READY_KINDS, loadLooks, lookByKey, revealShown, useLooks } from './looks';
import { Reveal } from './Reveal';
import { Scenery } from './Scenery';
import './chess.css';
import './locker.css';

/**
 * Chess fills the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), with the pupil's own
 * background painting behind the board: their choice from the 🎒 Chess Locker, in bot games and classmate games alike
 * (each kid sees their own look, never the opponent's). The way back to the hub, the Locker and the sound switch sit on
 * the painting. When a saved game unlocks something, the treasure chest (Reveal) opens on top of everything.
 */
export function ChessWindow({ children }: { children: ReactNode }) {
  const { soundOn, setSoundOn } = useSound();
  const { data, reveal } = useLooks();
  const [lockerOpen, setLockerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useGameKeys(rootRef);
  const fresh = data?.fresh.some((k) => {
    const look = lookByKey(k);
    return !!look && READY_KINDS.includes(look.kind);
  }) ?? false;

  useEffect(() => {
    void loadLooks();
  }, []);

  return (
    <div className="cw" ref={rootRef}>
      <Scenery background={data?.background} className="cw__bg" />
      <div className="cw__inner">
        <div className="cw__top">
          <a className="cw-btn" href="#/">
            <span aria-hidden="true">⌂</span> Hub
          </a>
          <span className="cw__title" aria-hidden="true">
            ♞ Chess
          </span>
          <div className="cw__right">
            <button type="button" className={`cw-btn cw-btn--locker${fresh ? ' is-new' : ''}`} onClick={() => setLockerOpen(true)}>
              <span aria-hidden="true">🎒</span> <span className="cw__locker-word">Locker</span>
              {fresh && <span className="cw-sr"> (something new)</span>}
            </button>
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
        </div>
        {children}
      </div>
      {lockerOpen && <Locker onClose={() => setLockerOpen(false)} />}
      {reveal.length > 0 && !lockerOpen && (
        <Reveal itemKey={reveal[0]} more={reveal.length - 1} onDone={() => revealShown(reveal[0])} />
      )}
    </div>
  );
}
