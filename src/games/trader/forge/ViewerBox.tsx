/** Hosts the 3D viewer (loaded on demand) and keeps it in step with the design. Shows a flat picture if it can't load. */
import { useEffect, useRef, useState } from 'react';
import { describeSystem, PLANETS, SUNS, type SystemDesign } from '../../../../shared/trader/system';
import { loadViewer } from './loadViewer';
import { PLANET_LOOK, SUN_LOOK, TINT_SWATCHES } from './looks';
import type { GraphicsLevel, SystemViewer } from './viewer/types';

export function ViewerBox({ design, showPlans = true, labels = true, reducedMotion = false, interactive = true, className = '', label = 'Your solar system, in 3D', onPick, onReady, onLevel }: {
  design: SystemDesign;
  showPlans?: boolean;
  labels?: boolean;
  reducedMotion?: boolean;
  interactive?: boolean;
  className?: string;
  /** What a screen reader calls the 3D view. */
  label?: string;
  onPick?: (planetId: number | null) => void;
  /** The viewer is ready (or gone: null). */
  onReady?: (v: SystemViewer | null) => void;
  onLevel?: (level: GraphicsLevel) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<SystemViewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'flat'>('loading');
  const latest = useRef({ design, labels, onPick, onReady, onLevel });
  latest.current = { design, labels, onPick, onReady, onLevel };

  useEffect(() => {
    let dead = false;
    let made: SystemViewer | null = null;
    setStatus('loading');
    void (async () => {
      const create = await loadViewer();
      const el = host.current;
      if (dead || !el) return;
      if (!create) return setStatus('flat');
      try {
        made = await create(el, latest.current.design, {
          level: 'auto', showPlans, labels: latest.current.labels, reducedMotion, interactive,
          onPick: (id) => latest.current.onPick?.(id),
          onLevel: (l) => latest.current.onLevel?.(l),
        });
      } catch {
        if (!dead) setStatus('flat');
        return;
      }
      if (dead) {
        made.dispose();
        return;
      }
      viewer.current = made;
      setStatus('ready');
      latest.current.onReady?.(made);
    })();
    return () => {
      dead = true;
      made?.dispose();
      viewer.current = null;
      latest.current.onReady?.(null);
    };
  }, [showPlans, reducedMotion, interactive]);

  useEffect(() => {
    viewer.current?.setDesign(design);
  }, [design, status]);
  useEffect(() => {
    viewer.current?.setLabels(labels);
  }, [labels, status]);

  const words = describeSystem(design, showPlans);
  return (
    <div className={`stf-viewer ${className}`} role="group" aria-label={label} aria-describedby="stf-words">
      <div ref={host} className="stf-viewer__host" />
      {status === 'loading' && <p className="stf-viewer__msg" role="status">Loading the 3D view…</p>}
      {status === 'flat' && <FlatView design={design} />}
      <p id="stf-words" className="st-sr">{words}</p>
    </div>
  );
}

/** The simple picture used when the 3D viewer isn't there: a sun and a row of coloured worlds. */
function FlatView({ design }: { design: SystemDesign }) {
  const sun = design.sun;
  return (
    <div className="stf-flat" aria-hidden="true">
      <span className={`stf-flat__sun ${sun && !sun.built ? 'is-plan' : ''}`} style={{ background: sun ? SUN_LOOK[sun.kind].colour : 'transparent' }} title={sun ? SUNS[sun.kind].name : 'No sun yet'}>{sun ? '' : '+'}</span>
      {design.planets.map((p) => (
        <span key={p.id} className={`stf-flat__planet ${p.built ? '' : 'is-plan'}`} style={{ background: PLANET_LOOK[p.kind].colour, boxShadow: `inset 0 0 0 4px ${TINT_SWATCHES[p.tint][1]}55`, width: 16 + p.size * 6, height: 16 + p.size * 6 }} title={PLANETS[p.kind].name} />
      ))}
    </div>
  );
}
