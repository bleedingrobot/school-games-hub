/**
 * Swamp Hen's Reed Rows' pictures: the painted ones (scripts/game_art.py swamphen, tidied into ./art/paint/, picks in
 * docs/swamphen-art/picks.json) and, as a fallback when a picture is missing, the stand-ins drawn in code (SVG). The garden
 * of shoots, the mat and the pile are laid out here in code, one painted shoot repeated, so every count is exact. The pictures
 * download when shown.
 */
import type { CSSProperties } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/swamphen/progress';
import { FRIEND_NAMES } from '../../../shared/swamphen/progress';
import type { View } from '../../../shared/swamphen/round';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

/** The home and play background for a day's colour, as CSS variables (a full and a small copy). Nothing if it is not painted. */
export function sceneStyle(scenery: Scenery): CSSProperties | undefined {
  const full = paint(`back/${scenery}`);
  if (!full) return undefined;
  return { '--sh-back': `url(${full})`, '--sh-back-small': `url(${paint(`back/${scenery}-800`) ?? full})` } as CSSProperties;
}

export type Pose = 'sit' | 'eat' | 'cheer';
export type Scenery = 'bronze' | 'silver' | 'gold';

const BODY: Record<FriendName, { body: string; belly: string }> = {
  swamphen: { body: '#2c3a8c', belly: '#5a6ad0' },
  pigeon: { body: '#3f7d5a', belly: '#f6f1e4' },
  kea: { body: '#6a7d2a', belly: '#c9742f' },
  weka: { body: '#7a5a3a', belly: '#b08a5a' },
  tui: { body: '#1f5f6f', belly: '#2b3b55' },
  heron: { body: '#eeeeee', belly: '#ffffff' },
};

/** A round bird with a red shield and beak, in each friend's colours. */
export function Friend({ friend, pose }: { friend: FriendName; pose: Pose }) {
  const c = BODY[friend];
  const src = paint(`friends/${friend}-${pose === 'cheer' ? 'cheer' : 'sit'}`);
  if (src) {
    return (
      <span className={`sh-friend sh-friend--${pose} sh-friend--painted`}>
        <img src={src} alt="" aria-hidden="true" draggable={false} />
        <span className="sh-sr">{FRIEND_NAMES[friend]}</span>
      </span>
    );
  }
  return (
    <span className={`sh-friend sh-friend--${pose}`}>
      <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden="true">
        <ellipse cx="38" cy="48" rx="24" ry="22" fill={c.body} />
        <ellipse cx="40" cy="54" rx="15" ry="14" fill={c.belly} />
        <circle cx="52" cy="28" r="14" fill={c.body} />
        <path d="M54 16 L62 17 L60 24 L55 24 Z" fill="#d83a2e" />
        <path d="M63 27 L75 32 L63 35 Z" fill="#e8a317" />
        <circle cx="55" cy="25" r="2.6" fill="#fff" />
        <circle cx="55.6" cy="25" r="1.3" fill="#111" />
        <path d="M14 52 L2 60 L16 62 Z" fill={c.body} />
        <path d="M32 68 L30 76 M44 68 L46 76" stroke="#d8553a" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="sh-sr">{FRIEND_NAMES[friend]}</span>
    </span>
  );
}

const METAL: Record<Metal, string> = { mud: '#8a6e4a', bronze: '#c8803a', silver: '#c9ced6', gold: '#f4c20d' };

/** One reed row on the home screen: a short line of reeds, mud-brown until it changes. */
export function ReedRow({ metal, glow = false }: { metal: Metal; glow?: boolean }) {
  const fill = METAL[metal];
  const reed = paint(`reeds/${metal === 'gold' ? 'reed' : metal === 'mud' ? 'mud' : metal}`);
  if (reed) {
    return (
      <span className={`sh-reedrow sh-reedrow--${metal} sh-reedrow--painted${glow ? ' sh-reedrow--glow' : ''}`}>
        {Array.from({ length: 6 }, (_, i) => <img key={i} src={reed} alt="" aria-hidden="true" draggable={false} />)}
      </span>
    );
  }
  return (
    <span className={`sh-reedrow sh-reedrow--${metal}${glow ? ' sh-reedrow--glow' : ''}`}>
      <svg viewBox="0 0 120 30" width="100%" height="100%" aria-hidden="true">
        <rect x="2" y="24" width="116" height="5" rx="2.5" fill="#6a5636" />
        {[12, 32, 52, 72, 92, 110].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 26 Q${x + (i % 2 ? 4 : -4)} 14 ${x} 4`} stroke={fill} strokeWidth="5" fill="none" strokeLinecap="round" />
            <ellipse cx={x} cy="5" rx="4" ry="6" fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
          </g>
        ))}
      </svg>
    </span>
  );
}

export function GoldenGarden() {
  const src = paint('reeds/golden-garden');
  if (src) {
    return (
      <span className="sh-golden" role="img" aria-label="The Golden Reed Garden">
        <img src={src} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className="sh-golden" role="img" aria-label="The Golden Reed Garden">
      <svg viewBox="0 0 120 60" width="100%" height="100%" aria-hidden="true">
        {[8, 26, 44].map((y) =>
          [14, 34, 54, 74, 94].map((x) => <ellipse key={`${x}-${y}`} cx={x + (y % 16 ? 8 : 0)} cy={y} rx="5" ry="7" fill="#f4c20d" stroke="#b8860b" strokeWidth="1.5" />),
        )}
      </svg>
    </span>
  );
}

const CELL = 26;
const PAD = 8;
const EDGE = 26;

export interface GardenProps {
  /** Rows and shoots in a row. */
  rows: number;
  cols: number;
  view: View;
  /** Rows planted so far (all when omitted). */
  planted?: number;
  /** A mat covers every row but the first. */
  mat?: boolean;
  /** A line after this many rows, the rows beyond it drawn in another colour. */
  cutAt?: number;
  /** A tenth row, faded, to take away. */
  short?: boolean;
  /** Draw it a different size: small picture cards. */
  small?: boolean;
  label: string;
}

export type CellMode = 'full' | 'faint' | 'covered' | 'none';

/** How one cell of a garden is drawn: the first row and column always show; only the inside fades or is covered by the mat. */
export function cellMode(view: string, r: number, c: number, mat: boolean): CellMode {
  if (view !== 'count' && view !== 'rows' && view !== 'bars' && view !== 'edges') return 'none';
  if (mat && r > 0 && c > 0) return 'covered';
  if (view === 'count' || view === 'rows') return 'full';
  return r === 0 || c === 0 ? 'full' : 'faint';
}

/**
 * A garden of shoots. The help level's `view` sets how much it says: 'count' shades the rows and counts along them (not the
 * last one: the child does the last jump), 'rows' shades them, 'bars' draws each row as a bar, 'edges' only the outline and the
 * two edge numbers, and 'peek' and 'plain' show nothing. The total is never drawn.
 */
export function Garden({ rows, cols, view, planted, mat = false, cutAt, short = false, small = false, label }: GardenProps) {
  const drawn = short ? rows + 1 : rows;
  const w = cols * CELL + PAD * 2 + (small ? 0 : EDGE) + (view === "count" && !small ? 30 : 0);
  const h = drawn * CELL + PAD * 2 + (small ? 0 : EDGE * 0.8);
  const shown = planted ?? drawn;
  const x0 = PAD + (small ? 0 : EDGE * 0.5);
  const green = paint('reeds/green');
  const amber = paint('reeds/amber');
  const matSrc = paint('garden/mat');
  const bands = view === 'count' || view === 'rows' || view === 'bars';
  return (
    <svg className={`sh-garden${small ? ' sh-garden--small' : ''}`} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <rect x={x0 - 4} y={PAD - 4} width={cols * CELL + 8} height={drawn * CELL + 8} rx="8" fill="#6b4f2c" opacity={view === 'plain' || view === 'peek' ? 0.25 : 0.85} />
      {Array.from({ length: drawn }, (_, r) => {
        const here = r < shown;
        const cut = cutAt !== undefined && r >= cutAt;
        const fade = short && r === rows;
        const colour = cut ? '#e8b04a' : r % 2 ? '#9bd06a' : '#7fbe4f';
        const y = PAD + r * CELL;
        const rowCovered = mat && r > 0;
        return (
          <g key={r} opacity={here ? (fade ? 0.35 : 1) : 0.15}>
            {bands && here && <rect x={x0} y={y + 1} width={cols * CELL} height={CELL - 2} rx="6" fill={view === 'bars' ? colour : colour} opacity={view === 'bars' ? 0.95 : 0.5} />}
            {here &&
              Array.from({ length: cols }, (_, c) => {
                const mode = cellMode(view, r, c, mat);
                if (mode === 'none' || mode === 'covered') return null;
                return (
                <g key={c} opacity={mode === 'faint' ? 0.22 : 1} transform={`translate(${x0 + c * CELL + CELL / 2} ${y + CELL / 2})`}>
                  {(cut ? amber : green) ? (
                    <image href={cut ? amber : green} x="-9" y="-12" width="18" height="24" preserveAspectRatio="xMidYMid meet" />
                  ) : (
                    <>
                          <path d="M0 8 V-2" stroke="#2f6b3f" strokeWidth="3" strokeLinecap="round" />
                      <ellipse cx="0" cy="-6" rx="3.6" ry="6" fill={cut ? '#c9862a' : '#3f8a3f'} />
                    </>
                  )}
                </g>
                );
              })}
            {view === 'count' && here && r < rows - 1 && !rowCovered && !fade && (
              <text x={x0 + cols * CELL + 8} y={y + CELL / 2 + 5} fontSize="14" fontWeight="800" fill="#1b2340">{(r + 1) * cols}</text>
            )}
          </g>
        );
      })}
      {mat && drawn > 1 && cols > 1 && (
        <g>
          {matSrc ? (
            <image href={matSrc} x={x0 + CELL} y={PAD + CELL} width={(cols - 1) * CELL} height={(drawn - 1) * CELL} preserveAspectRatio="none" />
          ) : (
            <>
              <rect x={x0 + CELL} y={PAD + CELL} width={(cols - 1) * CELL} height={(drawn - 1) * CELL} rx="8" fill="#b8793a" stroke="#6b3f14" strokeWidth="3" />
              <path d={`M${x0 + CELL + 8} ${PAD + CELL + 8} H${x0 + cols * CELL - 8}`} stroke="#d9a064" strokeWidth="3" strokeDasharray="6 5" />
            </>
          )}
        </g>
      )}
      {cutAt !== undefined && <path d={`M${x0 - 6} ${PAD + cutAt * CELL} H${x0 + cols * CELL + 6}`} stroke="#d83a2e" strokeWidth="3.5" strokeDasharray="7 4" />}
      {!small && view !== 'plain' && !(view === 'peek') && (
        <g fontSize="15" fontWeight="800" fill="#1b2340">
          <text x={x0 + (cols * CELL) / 2} y={h - 4} textAnchor="middle">{cols}</text>
          <text x={4} y={PAD + (drawn * CELL) / 2 + 5}>{rows}</text>
        </g>
      )}
    </svg>
  );
}

/** A pile of loose shoots, for sharing out and for the scatter card. */
export function Pile({ n, label }: { n: number; label: string }) {
  const per = 10;
  const rowsN = Math.ceil(n / per);
  const green = paint('reeds/green');
  return (
    <svg className="sh-pile" viewBox={`0 0 ${per * 18 + 12} ${rowsN * 22 + 12}`} role="img" aria-label={label}>
      {Array.from({ length: n }, (_, i) => {
        const x = 12 + (i % per) * 18 + (Math.floor(i / per) % 2) * 5 + ((i * 7) % 5);
        const y = 14 + Math.floor(i / per) * 22 + ((i * 3) % 6);
        if (green) return <image key={i} href={green} x={x - 7} y={y - 10} width="14" height="20" transform={`rotate(${((i * 37) % 50) - 25} ${x} ${y})`} />;
        return <ellipse key={i} cx={x} cy={y} rx="4" ry="7" fill="#3f8a3f" transform={`rotate(${((i * 37) % 50) - 25} ${x} ${y})`} />;
      })}
    </svg>
  );
}

export interface DealLanesProps {
  /** The shoots in each lane now. */
  counts: readonly number[];
  /** The lane to point at (the next one in turn), or null. */
  glow?: number | null;
  /** Lanes with more than the others, once the pile is out. */
  more?: readonly number[];
  fair?: boolean;
  /** Not tappable: the look-together picture and the end of a go. */
  still?: boolean;
  onDeal?: (lane: number) => void;
  laneLabel: (lane: number, has: number) => string;
}

/** Lanes for sharing: each lane is a button, and one tap deals one shoot into it. */
export function DealLanes({ counts, glow = null, more = [], fair = false, still = false, onDeal, laneLabel }: DealLanesProps) {
  const green = paint('reeds/green');
  return (
    <div className={`sh-lanes${counts.length >= 6 ? ' sh-lanes--two' : ''}${fair ? ' sh-lanes--fair' : ''}`}>
      {counts.map((n, r) => (
        <button
          key={r}
          type="button"
          disabled={still}
          tabIndex={still ? -1 : 0}
          className={`sh-lane${glow === r ? ' sh-lane--glow' : ''}${more.includes(r) ? ' sh-lane--more' : ''}`}
          aria-label={laneLabel(r + 1, n)}
          onClick={() => onDeal?.(r)}
        >
          {Array.from({ length: n }, (_, i) => (green ? <img key={i} src={green} alt="" className="sh-lane__reed" /> : <span key={i} className="sh-lane__reed" aria-hidden="true">🌱</span>))}
        </button>
      ))}
    </div>
  );
}
