/**
 * The Star Map, Star Web's home (docs/STARWEB-PLAN.md "How a sky plays" 1): a big star for each times table 2 to 12, glowing
 * with its best medal, line-art creatures that join at 4, 8 and 11 tables lit, and one button for the next sky (or Carry on).
 * Free sky opens after 5 lit skies.
 */
import { useEffect, useRef, useState } from 'react';
import { CREATURES, FREE_AFTER_LIT, POINT_SKIES_A_DAY, TABLES } from '../../../shared/starweb/config';
import { creaturesOf, freeOpen, tableMedal, tablesLit, goldTables, type Progress } from '../../../shared/starweb/map';
import type { PublicSky } from './backend';
import { HubButtons } from './HubButtons';
import { MEDAL_COLOURS, MAP_TIP } from './words';
import { painted } from './art';

const SPOTS: Record<number, [number, number]> = {
  2: [90, 430], 3: [190, 300], 4: [305, 395], 5: [400, 250], 6: [505, 335], 7: [605, 205],
  8: [705, 300], 9: [810, 185], 10: [905, 320], 11: [790, 455], 12: [570, 480],
};

function Creature({ id }: { id: string }) {
  const paths: Record<string, { d: string[]; at: string }> = {
    whale: { at: 'translate(40 40) scale(0.62)', d: ['M22 118 C50 50 170 28 266 66 C310 84 336 104 372 86 L398 52 M372 86 L402 124 C360 140 322 136 292 124 C196 188 66 180 22 118 Z', 'M120 150 C150 190 190 200 214 176 C190 176 150 166 120 150 Z'] },
    falcon: { at: 'translate(640 20) scale(0.7)', d: ['M20 120 L150 90 L210 30 L230 95 L330 110 L235 125 L180 190 L160 130 Z', 'M210 30 L245 18 L240 40'] },
    dragon: { at: 'translate(300 470) scale(0.75)', d: ['M10 80 C60 20 120 20 160 60 C200 100 260 100 300 60 C330 30 370 30 400 50 L430 30 L425 65 L460 70 L420 85', 'M160 60 L180 10 L200 55 M240 85 L260 35 L280 80', 'M300 60 C320 110 280 140 240 130'] },
  };
  const c = paths[id];
  return (
    <g className="sw-creature" transform={c.at}>
      {c.d.map((d, i) => <path key={i} d={d} />)}
    </g>
  );
}

export function MapScreen({ progress, open, pointsLeft, busy, onNew, onCarryOn, onFree, onHow, onGuide, extra }: {
  progress: Progress;
  open: PublicSky | null;
  pointsLeft: number;
  busy: boolean;
  onNew(): void;
  onCarryOn(): void;
  onFree(x: number, y: number): void;
  onHow(): void;
  onGuide(): void;
  extra?: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const [picking, setPicking] = useState(false);
  const [fx, setFx] = useState(6);
  const [fy, setFy] = useState(7);
  const lit = tablesLit(progress);
  const golds = goldTables(progress);
  const back = painted('map');
  const order = TABLES.filter((t) => tableMedal(progress, t) >= 1);

  return (
    <div className="sw-map">
      {back && <img className="sw-map__paint" src={back} alt="" aria-hidden="true" />}
      <header className="sw-map__top">
        <div>
          <h1 className="sw-title" tabIndex={-1} ref={heading}>Star Web</h1>
          <p className="sw-map__count"><b>{lit} of {TABLES.length}</b> tables lit{golds ? ` · ${golds} gold` : ''}</p>
        </div>
        <HubButtons />
      </header>

      <div className="sw-map__paper">
        <svg className="sw-map__svg" viewBox="0 0 1000 600" role="img" aria-label={`Star Map: ${lit} of ${TABLES.length} times tables lit`}>
          <defs>
            <radialGradient id="sw-map-glow">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#fff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {creaturesOf(progress).map((c) => <Creature key={c.id} id={c.id} />)}
          {TABLES.slice(1).map((t, i) => {
            const a = SPOTS[TABLES[i]];
            const b = SPOTS[t];
            const on = tableMedal(progress, t) >= 1 && tableMedal(progress, TABLES[i]) >= 1;
            return <line key={t} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={`sw-map__line${on ? ' sw-map__line--on' : ''}`} />;
          })}
          {TABLES.map((t) => {
            const m = tableMedal(progress, t);
            const [x, y] = SPOTS[t];
            return (
              <g key={t} transform={`translate(${x} ${y})`} className={`sw-tstar${m ? ' sw-tstar--lit' : ''}`} style={{ '--medal': MEDAL_COLOURS[m], animationDelay: `${(t % 5) * 0.5}s` } as React.CSSProperties}>
                {m > 0 && <circle r={m === 3 ? 62 : 48} fill="url(#sw-map-glow)" opacity={0.5 + m * 0.15} />}
                <path d="M0 -30 L8 -8 L30 0 L8 8 L0 30 L-8 8 L-30 0 L-8 -8 Z" className="sw-tstar__shape" />
                <circle r={m ? 9 : 6} className="sw-tstar__core" />
                <text y={58} textAnchor="middle" className="sw-tstar__n">{t}×</text>
                {m > 0 && <text y={-40} textAnchor="middle" className="sw-tstar__medal">{m === 3 ? '🥇' : m === 2 ? '🥈' : '🥉'}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <section className="sw-map__panel" aria-label="Play">
        {open ? (
          <>
            <button type="button" className="sw-btn sw-btn--play sw-btn--big" disabled={busy} onClick={onCarryOn}>Carry on: {open.anchor.x} × {open.anchor.y} ({open.stars.length} ⭐)</button>
            <button type="button" className="sw-btn" disabled={busy} onClick={onNew}>New sky</button>
          </>
        ) : (
          <button type="button" className="sw-btn sw-btn--play sw-btn--big" disabled={busy} onClick={onNew}>New sky ✨</button>
        )}
        {freeOpen(progress) ? (
          <button type="button" className="sw-btn" disabled={busy} onClick={() => setPicking(!picking)} aria-expanded={picking}>Free sky</button>
        ) : (
          <p className="sw-soft">Free sky opens after {FREE_AFTER_LIT} lit skies ({progress.lit} so far).</p>
        )}
        <button type="button" className="sw-btn sw-btn--ghost" onClick={onHow}>How to play</button>
        <button type="button" className="sw-btn sw-btn--ghost" onClick={onGuide}>Replay the guide</button>
      </section>

      {picking && (
        <form className="sw-free" onSubmit={(e) => { e.preventDefault(); if (fx !== fy) onFree(fx, fy); }}>
          <p>Pick any times fact up to 12 × 12 to start from. Free skies are for fun: they don’t light the map.</p>
          <div className="sw-free__row">
            <label>
              <span className="sw-sr">First number</span>
              <select value={fx} onChange={(e) => setFx(Number(e.target.value))}>{TABLES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </label>
            <span aria-hidden="true">×</span>
            <label>
              <span className="sw-sr">Second number</span>
              <select value={fy} onChange={(e) => setFy(Number(e.target.value))}>{TABLES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </label>
            <span>= {fx === fy ? '?' : fx * fy}</span>
            <button type="submit" className="sw-btn sw-btn--primary" disabled={busy || fx === fy}>Start</button>
          </div>
          {fx === fy && <p className="sw-soft">Pick two different numbers.</p>}
        </form>
      )}

      <p className="sw-map__foot">
        {pointsLeft > 0 ? `Points for ${pointsLeft} more lit ${pointsLeft === 1 ? 'sky' : 'skies'} today (of ${POINT_SKIES_A_DAY}).` : 'No more points today, but every sky still lights your map.'}
        {progress.lit === 0 && ` ${MAP_TIP}`}
        {order.length > 0 && lit < TABLES.length && ` Next creature at ${CREATURES.find((c) => c.at > lit)?.at ?? TABLES.length} tables.`}
      </p>
      {extra}
    </div>
  );
}
