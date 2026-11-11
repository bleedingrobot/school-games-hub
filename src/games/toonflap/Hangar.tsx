/** The Hangar: pick any flyer and trail you have unlocked. They only change how the bird looks, never how it flies. */
import { useEffect, useRef } from 'react';
import { FLYERS, TRAILS, flyersUnlocked, finishesToUnlock, shiny, trailsUnlocked, type Flyer, type Progress } from '../../../shared/toonflap/collection';
import { screenArt } from './art/art';
import { paintedBackground } from './MapScreen';
import { UNLOCK_RUNS } from '../../../shared/toonflap/config';
import { levelById } from '../../../shared/toonflap/levels';
import type { Picks } from './backend';
import { drawFlyer, drawTrailSwatch } from './renderer';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A small canvas that draws a flyer (and, if given, its trail behind it) with the same code the run uses. */
export function FlyerCanvas({ flyer, trail, gold, size, label }: { flyer: string; trail?: string | null; gold: boolean; size: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = trail ? size * 2 : size;
    canvas.width = w * dpr;
    canvas.height = size * dpr;
    const still = reducedMotion();
    let raf = 0;
    let lastDraw = 0;
    const draw = (now: number) => {
      if (now - lastDraw > 50 || still) {
        lastDraw = now;
        const t = still ? 0 : now / 1000;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, size);
        if (trail) drawTrailSwatch(ctx, trail, size * 1.1, size, t);
        drawFlyer(ctx, flyer, trail ? size * 1.5 : size / 2, size / 2 + (still ? 0 : Math.sin(t * 3) * size * 0.03), size * 0.78, 'glide', gold, t);
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw(0);
    if (!still) raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [flyer, trail, gold, size]);
  return <canvas ref={ref} className="tf-fcanvas" style={{ width: trail ? size * 2 : size, height: size }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export function TrailCanvas({ trail, size }: { trail: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * 2 * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTrailSwatch(ctx, trail, size * 2, size, 0);
  }, [trail, size]);
  return <canvas ref={ref} className="tf-fcanvas" style={{ width: size * 2, height: size }} aria-hidden="true" />;
}

export function Hangar({ progress, picks, onPick, onBack }: { progress: Progress; picks: Picks; onPick: (p: Picks) => void; onBack: () => void }) {
  const flyers = flyersUnlocked(progress);
  const trails = trailsUnlocked(progress);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const how = (f: Flyer): string => {
    if (f.level === null) return 'Gold on every level';
    const left = finishesToUnlock(progress, f.level);
    const name = levelById(f.level)?.name ?? '';
    return `Finish ${name} ${UNLOCK_RUNS} times${left < UNLOCK_RUNS ? ` (${left} to go)` : ''}`;
  };
  const current = FLYERS.find((f) => f.id === picks.flyer) ?? FLYERS[0];
  return (
    <section className="tf-hangar" aria-labelledby="tf-hangar-h" style={paintedBackground(screenArt('hangar'))}>
      <header className="tf-map__top">
        <h2 id="tf-hangar-h" className="tf-h" tabIndex={-1} ref={heading}>Hangar</h2>
        <button type="button" className="tf-btn" onClick={onBack}>Back to the map</button>
      </header>

      <div className="tf-hangar__now">
        <FlyerCanvas flyer={picks.flyer} trail={picks.trail} gold={shiny(progress, current)} size={96} label={`Your flyer: ${current.name}`} />
        <p>
          <strong>{current.name}</strong>
          <br />
          <span className="tf-dim">{picks.trail ? `Trail: ${TRAILS.find((t) => t.id === picks.trail)?.name}` : 'No trail'}. Every flyer flies the same.</span>
        </p>
      </div>

      <h3 className="tf-h3">Flyers</h3>
      <ul className="tf-grid">
        {FLYERS.map((f) => {
          const have = flyers.includes(f.id);
          const gold = shiny(progress, f);
          return (
            <li key={f.id}>
              <button
                type="button"
                className="tf-card"
                data-locked={!have || undefined}
                data-gold={(have && gold) || undefined}
                aria-pressed={have ? picks.flyer === f.id : undefined}
                aria-disabled={!have || undefined}
                onClick={() => have && onPick({ ...picks, flyer: f.id })}
              >
                <FlyerCanvas flyer={f.id} gold={have && gold} size={72} />
                <span className="tf-card__name">{f.name}</span>
                <span className="tf-card__sub">{have ? (gold ? 'Shiny! Gold earned' : picks.flyer === f.id ? 'Flying with this one' : 'Tap to pick') : how(f)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="tf-h3">Trails</h3>
      <ul className="tf-grid">
        <li>
          <button type="button" className="tf-card" aria-pressed={picks.trail === null} onClick={() => onPick({ ...picks, trail: null })}>
            <span className="tf-fcanvas tf-none" aria-hidden="true">–</span>
            <span className="tf-card__name">No trail</span>
            <span className="tf-card__sub">{picks.trail === null ? 'Picked' : 'Tap to pick'}</span>
          </button>
        </li>
        {TRAILS.map((t) => {
          const have = trails.includes(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                className="tf-card"
                data-locked={!have || undefined}
                aria-pressed={have ? picks.trail === t.id : undefined}
                aria-disabled={!have || undefined}
                onClick={() => have && onPick({ ...picks, trail: t.id })}
              >
                <TrailCanvas trail={t.id} size={56} />
                <span className="tf-card__name">{t.name}</span>
                <span className="tf-card__sub">{have ? (picks.trail === t.id ? 'Picked' : 'Tap to pick') : t.how}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
