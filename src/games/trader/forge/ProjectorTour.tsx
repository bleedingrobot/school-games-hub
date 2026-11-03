/**
 * The teacher's projector tour (docs/TRADER-SYSTEM-PLAN.md, section 7): full screen, flying through each pupil's system in
 * turn with the cinematic tour, about a minute each, the system's name big at the bottom (never a pupil's name: the
 * screen is projected). Next, Skip (leave this one out of the rest of the showing) and Stop; Esc closes. Incredible
 * graphics when the device can manage it (the viewer's own check). Less movement: no camera flights, the systems still
 * change each minute.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describeSystem, pieceName, type SystemDesign } from '../../../../shared/trader/system';
import { fetchClassSystems } from '../../../data/trader';
import { FriendlyError } from '../../../data/profile';
import { ViewerBox } from './ViewerBox';
import type { SystemViewer } from './viewer/types';
import '../trader.css';

/** How long each system is shown. */
export const TOUR_SECONDS = 60;

const lessMotionWanted = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ProjectorTour({ classId, onClose, load = fetchClassSystems }: {
  classId: string;
  onClose: () => void;
  /** For tests: where the systems come from. */
  load?: (classId: string) => Promise<SystemDesign[]>;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const viewer = useRef<SystemViewer | null>(null);
  const [systems, setSystems] = useState<SystemDesign[] | null>(null);
  const [problem, setProblem] = useState('');
  /** Positions in `systems` still in this showing, and which of them is on screen. */
  const [order, setOrder] = useState<number[]>([]);
  const [at, setAt] = useState(0);
  const [lessMotion] = useState(lessMotionWanted);
  const latestClose = useRef(onClose);
  latestClose.current = onClose;

  useEffect(() => {
    let dead = false;
    load(classId).then(
      (list) => {
        if (dead) return;
        setSystems(list);
        setOrder(list.map((_, i) => i));
      },
      (error: unknown) => !dead && setProblem(error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.'),
    );
    return () => {
      dead = true;
    };
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full screen if the browser allows it; Esc or leaving full screen stops the tour. Tab stays inside.
  useEffect(() => {
    const el = overlay.current;
    heading.current?.focus();
    let full = false;
    const changed = () => {
      if (document.fullscreenElement === el) full = true;
      else if (full) latestClose.current();
    };
    document.addEventListener('fullscreenchange', changed);
    try {
      void el?.requestFullscreen?.().catch(() => {});
    } catch {
      // The overlay still covers the page.
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latestClose.current();
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button:not(:disabled)')];
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
  }, []);

  const showing = order.length ? order[at % order.length] : null;
  const design = showing !== null && systems ? systems[showing] : null;

  // A minute each, then the next (round again after the last).
  useEffect(() => {
    if (order.length < 2) return;
    const timer = window.setTimeout(() => setAt((a) => (a + 1) % order.length), TOUR_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [at, order]);

  // A fresh flight for each system.
  useEffect(() => {
    const v = viewer.current;
    if (!v || !design) return;
    v.tour(false);
    v.focus(null);
    if (!lessMotion) v.tour(true);
  }, [showing]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => setAt((a) => (order.length ? (a + 1) % order.length : 0));
  const skip = () => {
    const left = order.filter((_, i) => i !== at % order.length);
    setOrder(left);
    setAt((a) => (left.length ? a % left.length : 0));
  };

  const name = design ? `The ${pieceName(design)} System` : '';
  return createPortal(
    <div className="st-root stp" ref={overlay} role="dialog" aria-modal="true" aria-labelledby="stp-h">
      {design && (
        <ViewerBox
          design={design}
          showPlans={false}
          labels={false}
          reducedMotion={lessMotion}
          interactive={false}
          className="stp__view"
          label={`${name}, in 3D`}
          onReady={(v) => {
            viewer.current = v;
            if (v) v.tour(!lessMotion);
          }}
        />
      )}
      {!design && (
        <div className="stp__empty" role="status">
          {problem || (!systems ? 'Getting the class’s systems…' : order.length || !systems.length ? 'Nobody in this class has built a sun yet.' : 'That was every system. Well done, everyone!')}
        </div>
      )}
      <div className="stp__bottom">
        <h2 id="stp-h" ref={heading} tabIndex={-1} className="stp__name" aria-live="polite">{design ? name : 'Our solar systems'}</h2>
        {design && <p className="st-sr">{describeSystem(design)}</p>}
        <div className="stp__bar">
          {order.length > 0 && <span className="stp__count">{(at % order.length) + 1} of {order.length}</span>}
          <button type="button" className="st-btn" disabled={order.length < 2} onClick={next}>Next ▶</button>
          <button type="button" className="st-btn" disabled={!design} onClick={skip}>Skip this one</button>
          <button type="button" className="st-btn st-btn--primary" onClick={onClose}>Stop (Esc)</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
