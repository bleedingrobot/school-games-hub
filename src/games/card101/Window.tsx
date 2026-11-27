/**
 * 101 fills the whole window over the hub's bar (game guide "Full window"): card night at the bach. The scene behind
 * is painted (art/paint/back/) or drawn in CSS until it is. The ⌂ Hub and sound buttons sit in the top corner.
 * Every face-down card inside uses the pupil's own card back (CardBackContext).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSound } from '../../sound';
import { CardBackSvg } from './CardBack';
import { backInfo, BACKS, CardBackContext, progressFor, type BackId } from './backs';
import { scene, texture } from './art';
import type { CardBacks } from './useCardBacks';

export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="c101-hubbtns">
      <a className="c101-hubbtn" href="#/">
        <span aria-hidden="true">⌂</span> Hub
      </a>
      <button
        type="button"
        className="c101-hubbtn c101-hubbtn--round"
        aria-pressed={soundOn}
        onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
        <span className="sr-only">Sound</span>
      </button>
    </span>
  );
}

export type WindowMode = 'setup' | 'play';

export function Card101Window({ mode, back, children }: { mode: WindowMode; back: BackId; children: ReactNode }) {
  const day = scene('bach-day');
  const wood = texture('wood');
  const felt = texture('felt');
  const style = {
    ...(wood ? { '--c101-wood': `url(${wood})` } : {}),
    ...(felt ? { '--c101-felt': `url(${felt})` } : {}),
  } as React.CSSProperties;
  return (
    <CardBackContext.Provider value={back}>
      <div className={`c101-window c101-window--${mode}`} style={style}>
        <div className={`c101-scene c101-scene--${mode}${mode === 'setup' && day ? ' is-painted' : ''}`} aria-hidden="true">
          {mode === 'setup' && day && <img className="c101-scene__img" src={day.src} srcSet={day.srcSet} sizes="100vw" alt="" />}
        </div>
        <div className="c101-window__corner">
          <HubButtons />
        </div>
        {children}
      </div>
    </CardBackContext.Provider>
  );
}

/** Choose your card back: every back, locked ones with how to earn them. */
export function BackPicker({ backs, onClose }: { backs: CardBacks; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const count = BACKS.filter((b) => backs.unlocked.has(b.id)).length;
  return (
    <div className="c101-guide c101-backs" role="dialog" aria-modal="true" aria-labelledby="c101-backs-title">
      <div className="c101-guide__card">
        <div className="c101-guide__top">
          <h2 id="c101-backs-title">
            Card backs <small>{count} of {BACKS.length} unlocked</small>
          </h2>
          <button ref={closeRef} type="button" className="c101-guide__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="c101-guide__body">
          <p className="c101-backs__about">Your back is on every face-down card you see. Earn more by playing.</p>
          <ul className="c101-backs__grid">
            {BACKS.map((b) => {
              const open = backs.unlocked.has(b.id);
              const on = backs.back === b.id;
              const progress = progressFor(b, backs.achievements);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    className={`c101-backs__item${on ? ' is-on' : ''}${open ? '' : ' is-locked'}`}
                    disabled={!open}
                    aria-pressed={on}
                    onClick={() => backs.choose(b.id)}
                  >
                    <span className="c101-backs__card">
                      <CardBackSvg id={b.id} />
                      {!open && (
                        <span className="c101-backs__lock" aria-hidden="true">
                          🔒
                        </span>
                      )}
                    </span>
                    <strong>{b.name}</strong>
                    {open ? (
                      <small>{on ? '✓ Using' : 'Tap to use'}</small>
                    ) : (
                      <small>
                        {b.needs!.emoji} {b.needs!.how}
                        {progress && <em> ({progress})</em>}
                      </small>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** The "Card back" row on the setup screen: a fan of your back and the button to change it. */
export function BackRow({ backs }: { backs: CardBacks }) {
  const [open, setOpen] = useState(false);
  const fresh = backs.unseen.length > 0;
  return (
    <div className="c101-backrow">
      <span className="c101-fan" aria-hidden="true">
        <CardBackSvg id={backs.back} />
        <CardBackSvg id={backs.back} />
        <CardBackSvg id={backs.back} />
      </span>
      <span className="c101-backrow__text">
        <strong>Card back</strong>
        <span>{backInfo(backs.back).name}</span>
      </span>
      <button
        type="button"
        className="button button--light c101-backrow__btn"
        onClick={() => {
          setOpen(true);
          backs.markSeen();
        }}
      >
        Change
        {fresh && <span className="c101-new">New!</span>}
      </button>
      {open && <BackPicker backs={backs} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** On the podium: a back unlocked by the game just played. */
export function NewBacks({ ids, backs }: { ids: BackId[]; backs: CardBacks }) {
  if (ids.length === 0) return null;
  return (
    <div className="c101-newback" role="status">
      <p className="c101-newback__title">{ids.length > 1 ? 'New card backs!' : 'New card back!'}</p>
      <div className="c101-newback__list">
        {ids.map((id) => (
          <div key={id} className="c101-newback__item">
            <CardBackSvg id={id} className="c101-newback__card" />
            <strong>{backInfo(id).name}</strong>
            {backs.back === id ? (
              <small>✓ Using</small>
            ) : (
              <button
                type="button"
                className="button button--light"
                onClick={() => {
                  backs.choose(id);
                  backs.markSeen();
                }}
              >
                Use it
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
