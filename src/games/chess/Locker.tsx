import { useEffect, useState } from 'react';
import { BoardPreview } from './BoardFace';
import {
  BACKGROUNDS,
  BOARDS,
  READY_KINDS,
  SETS,
  chooseLook,
  chosenId,
  isUnlocked,
  keyOf,
  useLooks,
  type BoardLook,
  type Look,
  type LookKind,
} from './looks';
import { Scenery } from './Scenery';

const TABS: { kind: LookKind; label: string; emoji: string; looks: Look[] }[] = [
  { kind: 'set', label: 'Sets', emoji: '♞', looks: SETS },
  { kind: 'board', label: 'Boards', emoji: '🏁', looks: BOARDS },
  { kind: 'background', label: 'Backgrounds', emoji: '🖼️', looks: BACKGROUNDS },
];

/** The Chess Locker: a full-window showroom for picking a board and a background (and, from stage 4, a piece set). */
export function Locker({ onClose }: { onClose: () => void }) {
  const { data, error } = useLooks();
  const [kind, setKind] = useState<LookKind>('background');
  const [picked, setPicked] = useState<Record<LookKind, string>>(() => ({
    set: chosenId(data, 'set'),
    board: chosenId(data, 'board'),
    background: chosenId(data, 'background'),
  }));
  const tab = TABS.find((t) => t.kind === kind)!;
  const look = tab.looks.find((l) => l.id === picked[kind]) ?? tab.looks[0];
  const ready = READY_KINDS.includes(kind);
  const open = isUnlocked(data, look);
  const using = chosenId(data, kind) === look.id;
  const progress = data?.progress[keyOf(look)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const showBg = kind === 'background' ? look.id : chosenId(data, 'background');

  return (
    <div className="cl" role="dialog" aria-modal="true" aria-labelledby="cl-title">
      <Scenery background={showBg} className={`cl__scene${kind === 'background' && !open ? ' is-locked' : ''}`} />
      <div className="cl__inner">
        <div className="cl__top">
          <button type="button" className="cw-btn" onClick={onClose} autoFocus>
            <span aria-hidden="true">←</span> Back
          </button>
          <h1 id="cl-title" className="cl__title">
            <span aria-hidden="true">🎒</span> Chess Locker
          </h1>
          <span className="cl__spacer" />
        </div>

        <div className="cl__tabs" role="tablist" aria-label="What to look at">
          {TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={t.kind === kind}
              className={`cl__tab${t.kind === kind ? ' is-on' : ''}`}
              onClick={() => setKind(t.kind)}
            >
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="cl__stage" key={kind + look.id}>
          {kind !== 'background' && (
            <div className={`cl__plinth${open ? '' : ' is-locked'}${kind === 'board' ? ' cl__plinth--board' : ''}`} aria-hidden="true">
              {kind === 'board' ? <BoardPreview look={look as BoardLook} className="cl__board" /> : <span>{look.emoji}</span>}
            </div>
          )}
          <div className="cl__card" aria-live="polite">
            <h2 className="cl__name">
              {!open && <span aria-hidden="true">🔒 </span>}
              {look.name}
            </h2>
            {!ready && <p className="cl__soon">✨ Coming soon! {open ? 'You’ve already unlocked it.' : 'You can unlock it now, ready for when it arrives.'}</p>}
            {open ? (
              ready &&
              (using ? (
                <p className="cl__using">✓ You’re using this one</p>
              ) : (
                <button type="button" className="button button--play cl__use" onClick={() => void chooseLook(kind, look.id)}>
                  Use this {kind === 'background' ? 'background' : kind}
                </button>
              ))
            ) : (
              <div className="cl__how">
                <p>
                  <strong>How to unlock:</strong> {look.how}
                </p>
                {progress && progress.need > 1 && (
                  <>
                    <div
                      className="cl__bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={progress.need}
                      aria-valuenow={progress.have}
                    >
                      <span style={{ width: `${(100 * progress.have) / progress.need}%` }} />
                    </div>
                    <p className="cl__togo">
                      {look.toGo?.(progress.need - progress.have)} ({progress.have} of {progress.need})
                    </p>
                  </>
                )}
              </div>
            )}
            {error && <p className="cl__error">{error}</p>}
          </div>
        </div>

        <div className="cl__shelf" role="list" aria-label={tab.label}>
          {tab.looks.map((l) => {
            const lOpen = isUnlocked(data, l);
            const isNew = !!data?.fresh.includes(keyOf(l));
            return (
              <div role="listitem" key={l.id}>
                <button
                  type="button"
                  className={`cl__thumb${l.id === look.id ? ' is-picked' : ''}${lOpen ? '' : ' is-locked'}`}
                  onClick={() => setPicked((p) => ({ ...p, [kind]: l.id }))}
                  aria-pressed={l.id === look.id}
                >
                  {'small' in l ? (
                    <img src={(l as { small: string }).small} alt="" />
                  ) : l.kind === 'board' ? (
                    <span className="cl__thumb-emoji cl__thumb-board" aria-hidden="true">
                      <BoardPreview look={l as BoardLook} />
                    </span>
                  ) : (
                    <span className="cl__thumb-emoji" aria-hidden="true">
                      {l.emoji}
                    </span>
                  )}
                  <span className="cl__thumb-name">
                    {!lOpen && <span aria-hidden="true">🔒 </span>}
                    {l.name}
                    {!lOpen && <span className="cw-sr"> (locked)</span>}
                  </span>
                  {chosenId(data, kind) === l.id && ready && <span className="cl__badge">✓</span>}
                  {isNew && lOpen && <span className="cl__badge cl__badge--new">NEW</span>}
                </button>
              </div>
            );
          })}
        </div>
        <p className="cl__note">A game counts once you’ve made 10 moves, as long as you don’t leave half-way.</p>
      </div>
    </div>
  );
}
