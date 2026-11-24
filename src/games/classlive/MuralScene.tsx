/**
 * Mystery Mural on the projector (docs/CLASSLIVE-PLAN.md section 4): a hidden picture under a 12 x 8 grid of opaque
 * tiles. The projector's screen row carries the whole game (the picture and who flipped each tile), so the picture is
 * drawn under the tiles and each tile flips away (a CSS 3D turn) when a pupil uses a flip. Progress, the guess choices,
 * who guessed right (in order) and the teacher's Reveal button sit beside it. On reveal every tile flips in a wave, the
 * picture zooms and confetti falls. Moving parts are CSS transform/opacity (projector.css, classes prefixed mu-).
 */
import { memo, useEffect, useRef, useState } from 'react';
import { CLUES, COLS, GUESS_FROM, PICTURES, TILES, type MuralGame } from '../../../shared/classlive/mural';
import type { ScreenView } from '../../../shared/classlive/server';
import { MuralPicture } from './muralPictures';
import { PLAYER_COLOURS } from './StarSky';

export interface MuralFx {
  /** Tiles just flipped, with who flipped them (their name only when names are shown). */
  fresh: Record<number, { name: string | null; colour: number }>;
  banner: { text: string; key: number } | null;
  /** True for a few seconds after the reveal, while the confetti falls. */
  revealing: boolean;
}
export const NO_MURAL_FX: MuralFx = { fresh: {}, banner: null, revealing: false };

type Person = ScreenView['people'][number];

const OPEN_AT = Math.ceil(TILES * GUESS_FROM);
const CONFETTI = Array.from({ length: 56 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin((i + 1) * 91.7 + n * 17.3) * 43758.5453; return x - Math.floor(x); };
  return { x: r(1) * 100, d: 2.6 + r(2) * 2.4, o: r(3) * 1.6, h: Math.floor(r(4) * 360), w: 8 + r(5) * 10, s: r(6) > 0.5 ? 1 : -1 };
});

const Tile = memo(function Tile({ i, open, wave, fresh }: { i: number; open: boolean; wave: number | null; fresh: MuralFx['fresh'][number] | undefined }) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const hue = 258 + ((col + row) % 3) * 22;
  return (
    <div className="mu-tile" role="presentation">
      <div
        className={`mu-cover${open ? ' is-open' : ''}`}
        style={{ ['--h' as string]: hue, ...(wave !== null ? { transitionDelay: `${wave}ms` } : {}) }}
      />
      {fresh && (
        <>
          <span className="mu-sparks" aria-hidden="true">
            {Array.from({ length: 8 }, (_, k) => <i key={k} style={{ ['--a' as string]: `${k * 45}deg` }} />)}
          </span>
          <span className="mu-pop" style={{ ['--c' as string]: PLAYER_COLOURS[fresh.colour % 12] }}>
            <i className="mu-pop__dot" />
            {fresh.name && <span className="mu-pop__name">{fresh.name}</span>}
          </span>
        </>
      )}
    </div>
  );
});

function Who({ p, n }: { p: Person | undefined; n: number }) {
  const colour = p ? PLAYER_COLOURS[p.colour % 12] : '#fff';
  return (
    <li className="mu-solver" style={{ ['--c' as string]: colour }}>
      <b className="mu-solver__n">{n}</b>
      <i className="mu-who__dot" />
      <span>{p?.name ?? 'A pupil'}</span>
    </li>
  );
}

export function MuralScene({ game, people, state, fx, showReveal, onReveal, onRevealed }: {
  game: MuralGame;
  people: Person[];
  state: 'live' | 'over';
  fx: MuralFx;
  showReveal: boolean;
  onReveal: () => void;
  /** Called a few seconds after the picture is fully shown, in an ended game (the finish card comes after it). */
  onRevealed: () => void;
}) {
  const shown = game.revealed || state === 'over';
  const flipped = game.tiles.filter(Boolean).length;
  const open = flipped >= OPEN_AT;
  const [sure, setSure] = useState(false);
  const calm = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doneRef = useRef(onRevealed);
  doneRef.current = onRevealed;

  useEffect(() => {
    if (!sure) return;
    const id = window.setTimeout(() => setSure(false), 3500);
    return () => window.clearTimeout(id);
  }, [sure]);
  useEffect(() => {
    if (state !== 'over') return;
    const id = window.setTimeout(() => doneRef.current(), calm ? 800 : 5200);
    return () => window.clearTimeout(id);
  }, [state, calm]);

  const byId = (id: string) => people.find((p) => p.id === id);
  const pct = Math.round((flipped / TILES) * 100);
  const name = PICTURES[game.picture];

  return (
    <div className={`mu${shown ? ' mu--shown' : ''}${fx.revealing ? ' mu--reveal' : ''}`}>
      <div className="mu-head">
        <span className="mu-count" aria-label={`${flipped} of ${TILES} tiles flipped`}><b>{flipped}</b> / {TILES}</span>
        <span className="mu-progress" role="progressbar" aria-valuemin={0} aria-valuemax={TILES} aria-valuenow={flipped} aria-label="Tiles flipped">
          <span className="mu-progress__fill" style={{ transform: `scaleX(${flipped / TILES})` }} />
          <span className="mu-progress__mark" style={{ left: `${GUESS_FROM * 100}%` }} aria-hidden="true" />
        </span>
        <span className="mu-pct">{shown ? 'All done!' : `${pct}%`}</span>
      </div>

      <div className="mu-main">
        <div className="mu-stage">
          <div className="mu-board">
            <div className="mu-art"><MuralPicture id={game.picture} label={shown ? name : undefined} /></div>
            <div className="mu-grid">
              {Array.from({ length: TILES }, (_, i) => {
                const was = !!game.tiles[i];
                const col = i % COLS;
                const row = Math.floor(i / COLS);
                return <Tile key={i} i={i} open={was || shown} wave={shown && !was ? (col + row) * 85 + 250 : null} fresh={fx.fresh[i]} />;
              })}
            </div>
            {shown && <div className="mu-glow" aria-hidden="true" />}
          </div>
          {fx.banner && <div key={fx.banner.key} className="mu-banner" role="status">{fx.banner.text}</div>}
          {shown
            ? <h2 className="mu-title mu-title--shown" role="status">It's {name.replace(/^An? /, (m) => m.toLowerCase())}!</h2>
            : <p className="mu-title">What could it be?</p>}
          {fx.revealing && !calm && (
            <div className="mu-confetti" aria-hidden="true">
              {CONFETTI.map((c, i) => (
                <i key={i} style={{ left: `${c.x}%`, width: c.w, height: c.w * 0.6, background: `hsl(${c.h} 90% 60%)`, animationDuration: `${c.d}s`, animationDelay: `${c.o}s`, ['--s' as string]: c.s }} />
              ))}
            </div>
          )}
        </div>

        <aside className="mu-side" aria-label="Guessing">
          <h2 className={`mu-side__title${open && !shown ? ' mu-side__title--open' : ''}`}>
            {shown ? 'The picture is…' : open ? 'Guessing is open!' : `Guessing opens at ${OPEN_AT} tiles`}
          </h2>
          {open || shown ? (
            <div className="mu-clue" role="status">
              <span className="mu-clue__key" aria-hidden="true">🗝️</span>
              <b className="mu-clue__label">Clue</b>
              <p className="mu-clue__text">{CLUES[game.picture]}</p>
            </div>
          ) : (
            <div className="mu-clue mu-clue--locked">
              <span className="mu-clue__key" aria-hidden="true">🔒</span>
              <p className="mu-clue__text">A clue appears when guessing opens.</p>
            </div>
          )}
          <h3 className="mu-side__sub">Guessed it</h3>
          {game.solvers.length === 0 ? <p className="mu-none">Nobody yet</p> : (
            <ol className="mu-solvers" aria-label="Who guessed right, in order">
              {game.solvers.map((id, i) => <Who key={id} p={byId(id)} n={i + 1} />)}
            </ol>
          )}
          {showReveal && !game.revealed && (
            sure
              ? <button type="button" className="cl-btn cl-btn--go mu-reveal" onClick={() => { setSure(false); onReveal(); }}>Yes, show it!</button>
              : <button type="button" className="cl-btn mu-reveal" onClick={() => setSure(true)}>Reveal</button>
          )}
        </aside>
      </div>
    </div>
  );
}


/** The lobby's mystery: a painting on an easel, still under its cloth. */
export function MuralCloth() {
  return (
    <svg className="mu-cloth" viewBox="0 0 240 150" role="img" aria-label="A painting hidden under a cloth">
      <path d="M60 148 L84 104 M180 148 L156 104 M120 150 V112" stroke="#8a5a2b" strokeWidth="8" strokeLinecap="round" />
      <rect x="22" y="8" width="196" height="108" rx="6" fill="#d7a24a" />
      <path d="M28 14 H212 V108 q-10 8 -20 -2 q-10 10 -22 0 q-10 12 -24 0 q-10 10 -22 0 q-12 12 -26 0 q-10 10 -22 0 q-12 8 -24 0 q-10 6 -8 0z" fill="#8f4fd8" />
      <path d="M28 14 H212 V30 q-30 10 -60 0 q-30 10 -60 0 q-30 8 -64 0z" fill="#a66be8" />
      <path d="M70 30 q-6 40 -2 78 M110 34 q-4 36 0 74 M150 32 q6 38 2 76 M190 30 q-4 40 0 78" stroke="#6a35b0" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
      <text x="120" y="82" textAnchor="middle" fontSize="64" fontWeight="900" fill="#fff6c9" stroke="#4a1f86" strokeWidth="4" paintOrder="stroke">?</text>
      <circle cx="36" cy="22" r="3" fill="#fff6b0" /><circle cx="204" cy="40" r="2.5" fill="#fff6b0" /><circle cx="196" cy="18" r="2" fill="#fff6b0" />
    </svg>
  );
}
