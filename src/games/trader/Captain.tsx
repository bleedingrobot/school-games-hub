/**
 * Choose your captain (docs/prompts/trader-captains-pickup.md): 40 painted captains, 20 men and 20 women. Only a look:
 * the choice is saved in the pupil's game by the server (a 'captain' move) and shows on the top strip and the Ship tab.
 * A pupil who hasn't picked yet sees a "Choose your captain" button instead; nothing waits on it.
 */
import { useEffect, useRef, useState } from 'react';
import { CAPTAINS_MEN, CAPTAINS_WOMEN, isCaptain } from '../../../shared/trader/captains';
import { captainArt } from './art/captains';

/** Men and women side by side, so neither group comes second. */
const ORDER: readonly string[] = CAPTAINS_MEN.flatMap((m, i) => [CAPTAINS_WOMEN[i], m]);

/** A captain's round portrait (a plain badge if the picture isn't there). */
export function CaptainFace({ id, size = 40 }: { id: string; size?: number }) {
  const src = captainArt(id);
  return src ? (
    <img className="st-capface" src={src} alt="" width={size} height={size} decoding="async" loading="lazy" style={{ width: size, height: size }} />
  ) : (
    <span className="st-capface st-capface--none" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.5 }}>🧑‍✈️</span>
  );
}

/** The captain on the Ship tab, with the button that opens the picker. */
export function CaptainCard({ captain, busy, onOpen }: { captain?: string; busy: boolean; onOpen: () => void }) {
  const has = isCaptain(captain);
  return (
    <div className="st-capcard">
      {has ? <CaptainFace id={captain} size={96} /> : <CaptainFace id="" size={96} />}
      <div>
        <p className="st-capcard__line">{has ? 'Your captain is on the bridge.' : 'Your ship needs a captain!'}</p>
        <button type="button" className="st-btn" disabled={busy} onClick={onOpen} data-coach="captain">
          {has ? 'Change captain' : 'Choose your captain'}
        </button>
      </div>
    </div>
  );
}

/** The picker: every captain in a grid; pick one, then "This one!". Escape or Cancel closes it. */
export function CaptainPicker({ current, busy, onPick, onClose }: { current?: string; busy: boolean; onPick: (id: string) => void; onClose: () => void }) {
  const [chosen, setChosen] = useState<string | null>(isCaptain(current) ? current : null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="st-capback">
      <section className="st-cappick" role="dialog" aria-modal="true" aria-labelledby="st-cap-h">
        <h2 id="st-cap-h" className="st-h" ref={heading} tabIndex={-1}>Choose your captain</h2>
        <p className="st-soft st-cappick__sub">Who flies your ship? You can change your mind any time.</p>
        <div className="st-capgrid" role="radiogroup" aria-label="Captains">
          {ORDER.map((id, i) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={chosen === id}
              aria-label={`Captain ${i + 1}`}
              className={`st-capbtn ${chosen === id ? 'st-capbtn--on' : ''}`}
              onClick={() => setChosen(id)}
            >
              <CaptainFace id={id} size={72} />
            </button>
          ))}
        </div>
        <div className="st-cappick__foot">
          {chosen && <CaptainFace id={chosen} size={64} />}
          <button type="button" className="st-btn st-btn--primary" disabled={busy || !chosen || chosen === current} onClick={() => chosen && onPick(chosen)}>
            This one!
          </button>
          <button type="button" className="st-btn" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
