import { useEffect, type CSSProperties } from 'react';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import chestOpen from './art/fx/chest-open.webp';
import chestShut from './art/fx/chest-shut.webp';
import stand from './art/fx/stand.webp';
import { BoardPreview } from './BoardFace';
import { SetPreview } from './SetFace';
import { READY_KINDS, chooseLook, lookByKey, type Background, type BoardLook } from './looks';

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  angle: i * 20 + ((i * 7) % 11),
  far: 120 + ((i * 37) % 120),
  delay: (i % 6) * 0.04,
}));
const KIND_WORDS = { background: 'background', set: 'piece set', board: 'board' } as const;
/** When the lid bursts open, in step with the CSS (.cr__chest). */
const BURST_MS = 1300;

/**
 * The treasure chest: after a game unlocks something, a chest drops in, shakes, bursts open, and the new look rises
 * out and spins on a stand. Shown by ChessWindow on top of the result card.
 */
export function Reveal({ itemKey, more, onDone }: { itemKey: string; more: number; onDone: () => void }) {
  const { soundOn } = useSound();
  const look = lookByKey(itemKey);

  useEffect(() => {
    if (!soundOn) return;
    const t = setTimeout(() => playSound('win'), BURST_MS);
    return () => clearTimeout(t);
  }, [itemKey, soundOn]);

  if (!look) return null;
  const picture = 'small' in look ? (look as Background).small : null;

  return (
    <div className="cr" role="dialog" aria-modal="true" aria-labelledby="cr-title" key={itemKey}>
      <div className="cr__rays" aria-hidden="true" />
      <div className="cr__show" aria-hidden="true">
        <div className="cr__chest">
          <img className="cr__shut" src={chestShut} alt="" />
          <img className="cr__open" src={chestOpen} alt="" />
          <div className="cr__flash" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="cr__spark"
              style={{ '--a': `${s.angle}deg`, '--far': `${s.far}px`, animationDelay: `${1.3 + s.delay}s` } as CSSProperties}
            />
          ))}
        </div>
        <div className="cr__prize">
          <div className="cr__spin">
            {picture ? (
              <img src={picture} alt="" />
            ) : look.kind === 'board' ? (
              <BoardPreview look={look as BoardLook} className="cr__board" />
            ) : (
              <span className="cr__set">
                <SetPreview set={look.id} big />
              </span>
            )}
          </div>
          <img className="cr__stand" src={stand} alt="" />
        </div>
      </div>
      <div className="cr__words">
        <h2 id="cr-title">New {KIND_WORDS[look.kind]} unlocked!</h2>
        <p className="cr__name">{look.name}</p>
        <div className="cr__buttons">
          {READY_KINDS.includes(look.kind) && (
            <button
              type="button"
              className="button button--play"
              autoFocus
              onClick={() => {
                void chooseLook(look.kind, look.id);
                onDone();
              }}
            >
              Use it now
            </button>
          )}
          <button type="button" className="button button--light" onClick={onDone}>
            {more > 0 ? `Next prize (${more} more)` : 'Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
