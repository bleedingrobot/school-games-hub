/** The full-screen viewer (docs/TRADER-SYSTEM-PLAN.md, section 5.1): the system big, with a tour, speed, labels, graphics, photo and Esc to close. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pieceName, type SystemDesign } from '../../../../shared/trader/system';
import { ViewerBox } from './ViewerBox';
import type { GraphicsLevel, SystemViewer } from './viewer/types';

const SPEEDS: [number, string][] = [[0, 'Pause'], [1, '1×'], [4, '4×'], [16, '16×']];
const LEVELS: [GraphicsLevel, string][] = [['incredible', 'Incredible'], ['normal', 'Normal'], ['simple', 'Simple']];

export function FullscreenView({ design, lessMotion, container, onClose }: {
  design: SystemDesign;
  lessMotion: boolean;
  /** Where to put it (the Star Trader root, so it keeps the game's colours). */
  container: HTMLElement;
  onClose: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const viewer = useRef<SystemViewer | null>(null);
  const [plans, setPlans] = useState(true);
  const [labels, setLabels] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [touring, setTouring] = useState(false);
  const [level, setLevel] = useState<GraphicsLevel>('normal');
  const [focus, setFocus] = useState<number | 'sun' | null>(null);
  const [said, setSaid] = useState('');
  const full = useRef(false);
  const title = `The ${pieceName(design)} System`;

  // Full screen if the browser allows it (the overlay covers the page either way); Esc or leaving full screen closes.
  useEffect(() => {
    const el = overlay.current;
    heading.current?.focus();
    const changed = () => {
      if (document.fullscreenElement === el) full.current = true;
      else if (full.current) onClose();
    };
    document.addEventListener('fullscreenchange', changed);
    try {
      void el?.requestFullscreen?.().catch(() => {});
    } catch {
      // The page stays covered by the overlay.
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('keydown', key);
      if (document.fullscreenElement === el) void document.exitFullscreen?.().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => viewer.current?.setSpeed(speed), [speed]);
  useEffect(() => viewer.current?.tour(touring && !lessMotion), [touring, lessMotion]);
  useEffect(() => viewer.current?.focus(focus), [focus]);

  async function photo() {
    const v = viewer.current;
    if (!v) return setSaid('The picture is not ready yet.');
    try {
      const blob = await v.snapshot(1600, 900);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pieceName(design)} System.webp`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setSaid('Picture saved.');
    } catch {
      setSaid('Sorry, the picture could not be saved.');
    }
  }

  const planets = design.planets.filter((p) => plans || p.built);
  return createPortal(
    <div ref={overlay} className="stf-fs" role="dialog" aria-modal="true" aria-labelledby="stf-fs-h">
      <ViewerBox
        design={design}
        showPlans={plans}
        labels={labels}
        reducedMotion={lessMotion}
        className="stf-fs__view"
        onLevel={setLevel}
        onReady={(v) => {
          viewer.current = v;
          if (v) {
            v.setSpeed(speed);
            setLevel(v.level);
            v.tour(touring && !lessMotion);
          }
        }}
      />
      <div className="stf-fs__bar">
        <h2 id="stf-fs-h" ref={heading} tabIndex={-1} className="stf-fs__h">{title}</h2>
        <div className="stf-fs__row" role="group" aria-label="Look around">
          <button type="button" className={`st-btn st-btn--small ${touring ? 'st-btn--primary' : ''}`} aria-pressed={touring} disabled={lessMotion} title={lessMotion ? 'Turned off because you chose less movement' : undefined} onClick={() => setTouring((t) => !t)}>🎬 Tour</button>
          <button type="button" className={`st-btn st-btn--small ${labels ? 'st-btn--primary' : ''}`} aria-pressed={labels} onClick={() => setLabels((l) => !l)}>🏷️ Names</button>
          <button type="button" className={`st-btn st-btn--small ${plans ? 'st-btn--primary' : ''}`} aria-pressed={plans} onClick={() => setPlans((p) => !p)}>👻 Plans</button>
          <button type="button" className="st-btn st-btn--small" onClick={() => void photo()}>📷 Photo</button>
        </div>
        <div className="stf-fs__row" role="group" aria-label="Speed">
          {SPEEDS.map(([s, name]) => (
            <button key={s} type="button" className={`st-btn st-btn--small ${speed === s ? 'st-btn--primary' : ''}`} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{name}</button>
          ))}
        </div>
        <label className="stf-fs__row">
          <span>Graphics</span>
          <select className="stf-select" value={level} onChange={(e) => { const l = e.target.value as GraphicsLevel; setLevel(l); viewer.current?.setLevel(l); }}>
            {LEVELS.map(([l, name]) => <option key={l} value={l}>{name}</option>)}
          </select>
        </label>
        <div className="stf-fs__row" role="group" aria-label="Fly to">
          <button type="button" className={`st-btn st-btn--small ${focus === null ? 'st-btn--primary' : ''}`} aria-pressed={focus === null} onClick={() => setFocus(null)}>Whole system</button>
          {design.sun && <button type="button" className={`st-btn st-btn--small ${focus === 'sun' ? 'st-btn--primary' : ''}`} aria-pressed={focus === 'sun'} onClick={() => setFocus('sun')}>Sun</button>}
          {planets.map((p) => (
            <button key={p.id} type="button" className={`st-btn st-btn--small ${focus === p.id ? 'st-btn--primary' : ''}`} aria-pressed={focus === p.id} onClick={() => setFocus(p.id)}>{pieceName(p)}</button>
          ))}
        </div>
        <button type="button" className="st-btn st-btn--primary stf-fs__close" onClick={onClose}>Close (Esc)</button>
        <p className="st-sr" role="status">{said}</p>
        {said && <p className="stf-fs__said" aria-hidden="true">{said}</p>}
      </div>
    </div>,
    container,
  );
}
