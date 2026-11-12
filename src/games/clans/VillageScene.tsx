import { useEffect, useRef, type ReactNode } from 'react';
import { BUILDING_NAMES, maxLevel, upgradeCost } from '../../../shared/clans/empire';
import { VILLAGE_BUILDINGS, type Empire, type VillageBuilding } from '../../../shared/clans/types';
import { buildingArt, buildingSize } from './art';
import { GATE, GROUND, PLOTS, aroundEdge, diamond, pct } from './villageLayout';

export type PlotState = { ok: boolean };

/** How big a building's picture is drawn, as a share of the ground's width, by its picture size. */
const WIDTH = { small: 15, medium: 17.5, big: 20 } as const;

/** The words a screen reader hears for one building in the scene. */
export function plotLabel(b: VillageBuilding, level: number, ok: boolean): string {
  const name = BUILDING_NAMES[b];
  const max = maxLevel(b);
  if (level >= max) return `${name}, level ${level} of ${max}, fully built`;
  const next = `upgrade to level ${level + 1} for ${upgradeCost(b, level + 1)} gold`;
  return `${name}, ${level === 0 ? 'not built yet' : `level ${level} of ${max}`}, ${ok ? `you can ${next}` : next}`;
}

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** The Walls, drawn round the edge: nothing at 0, a low fence at 1-2, a palisade at 3-4, stone walls at 5. */
function Walls({ level }: { level: number }) {
  if (level <= 0) return <polygon points={pts(diamond(6))} fill="none" stroke="#c9b88f" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="8 10" />;
  const nearGate = (p: { x: number; y: number }) => Math.hypot(p.x - GATE.x, p.y - (GATE.y - 4)) < 34;
  if (level >= 5) {
    const ring = diamond(8);
    return (
      <g className="cq-vwalls cq-vwalls--stone">
        <polygon points={pts(ring.map(([x, y]) => [x, y - 22]))} fill="none" stroke="#3b3d40" strokeWidth="16" strokeLinejoin="round" />
        <polygon points={pts(ring)} fill="none" stroke="#6d6a63" strokeWidth="14" strokeLinejoin="round" />
        <polygon points={pts(ring.map(([x, y]) => [x, y - 12]))} fill="none" stroke="#8a857a" strokeWidth="12" strokeLinejoin="round" />
        {aroundEdge(8, 22).filter((p) => !nearGate(p)).map((p, i) => <rect key={i} x={p.x - 5} y={p.y - 30} width="10" height="8" fill="#8a857a" stroke="#3b3d40" strokeWidth="1.5" />)}
        {ring.map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 20} y={y - 52} width="40" height="56" rx="6" fill="#77736a" stroke="#3b3d40" strokeWidth="2" />
            <polygon points={pts([[x - 24, y - 50], [x, y - 78], [x + 24, y - 50]])} fill="#41464f" stroke="#26282c" strokeWidth="2" />
          </g>
        ))}
      </g>
    );
  }
  const palisade = level >= 3;
  const h = palisade ? 26 : level === 2 ? 16 : 12;
  const posts = aroundEdge(6, palisade ? 9 : 22).filter((p) => !nearGate(p));
  return (
    <g className="cq-vwalls">
      {!palisade && [h * 0.45, ...(level === 2 ? [h * 0.85] : [])].map((up, i) => (
        <polygon key={i} points={pts(diamond(6).map(([x, y]) => [x, y - up]))} fill="none" stroke="#7a5532" strokeWidth="3" />
      ))}
      {posts.map((p, i) => palisade
        ? <polygon key={i} points={pts([[p.x - 4.5, p.y], [p.x - 4.5, p.y - h], [p.x, p.y - h - 7], [p.x + 4.5, p.y - h], [p.x + 4.5, p.y]])} fill="#7a5532" stroke="#3d2814" strokeWidth="1.2" />
        : <rect key={i} x={p.x - 3} y={p.y - h} width="6" height={h} fill="#7a5532" stroke="#3d2814" strokeWidth="1" />)}
      {level >= 4 && diamond(6).map(([x, y], i) => (
        <g key={`t${i}`}>
          <rect x={x - 4} y={y - 46} width="5" height="46" fill="#5a3d22" /><rect x={x + 9} y={y - 46} width="5" height="46" fill="#5a3d22" />
          <rect x={x - 10} y={y - 54} width="30" height="10" fill="#7a5532" stroke="#3d2814" strokeWidth="1.5" />
          <polygon points={pts([[x - 12, y - 54], [x + 5, y - 68], [x + 22, y - 54]])} fill="#5b4a3a" />
        </g>
      ))}
    </g>
  );
}

/** The gate at the front, which is also the button for the Walls. */
function Gate({ level }: { level: number }) {
  const { x, y } = GATE;
  if (level <= 0) return null;
  const stone = level >= 5;
  const top = stone ? 64 : level >= 3 ? 44 : 22;
  return (
    <g>
      <rect x={x - 34} y={y - top} width="12" height={top} fill={stone ? '#77736a' : '#5a3d22'} stroke="#26282c" strokeWidth="1.5" />
      <rect x={x + 22} y={y - top} width="12" height={top} fill={stone ? '#77736a' : '#5a3d22'} stroke="#26282c" strokeWidth="1.5" />
      {level >= 3 && <rect x={x - 36} y={y - top - 8} width="72" height="10" fill={stone ? '#8a857a' : '#7a5532'} stroke="#26282c" strokeWidth="1.5" />}
      {level >= 3 && <rect x={x - 22} y={y - top + 4} width="44" height={top - 4} fill={stone ? '#3a2a1a' : '#4a321c'} opacity="0.85" />}
    </g>
  );
}

/** The ground: grass in a diamond, two crossing roads, a well in the middle and a few trees. Drawn in code until it is painted (V3-V4). */
function Ground() {
  const { cx, cy } = GROUND;
  const road = (a: [number, number], b: [number, number]) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#7a6548" strokeWidth="34" strokeLinecap="round" />;
  const [back, right, front, left] = diamond(40);
  const trees: [number, number][] = [[150, 300], [180, 270], [845, 300], [815, 268], [500, 92], [470, 112], [262, 470], [740, 470]];
  return (
    <>
      <polygon points={pts(diamond(-6))} fill="#2b2f22" />
      <polygon points={pts(diamond(0))} fill="#4c5636" />
      <polygon points={pts(diamond(70))} fill="#56603c" />
      <g opacity="0.9">
        {road([(back[0] + left[0]) / 2, (back[1] + left[1]) / 2], [(front[0] + right[0]) / 2, (front[1] + right[1]) / 2])}
        {road([(back[0] + right[0]) / 2, (back[1] + right[1]) / 2], [(front[0] + left[0]) / 2, (front[1] + left[1]) / 2])}
        {road([cx, cy], [GATE.x, GATE.y - 6])}
      </g>
      {trees.map(([x, y], i) => (
        <g key={i}><rect x={x - 2} y={y - 6} width="4" height="10" fill="#3d2814" /><ellipse cx={x} cy={y - 16} rx="13" ry="15" fill="#2f4a2a" /><ellipse cx={x - 3} cy={y - 20} rx="7" ry="8" fill="#3f5f35" /></g>
      ))}
      <ellipse cx={cx} cy={cy} rx="24" ry="13" fill="#5b5e60" stroke="#2a2c2e" strokeWidth="3" />
      <ellipse cx={cx} cy={cy - 2} rx="15" ry="7" fill="#1d2a33" />
    </>
  );
}

/** An empty plot: pegs and rope round a patch of dirt, timber, and a "Build me" sign. */
function BuildingSite() {
  return (
    <svg className="cq-vsite" viewBox="0 0 120 90" aria-hidden="true">
      <polygon points="60,40 110,62 60,84 10,62" fill="#6e5a3e" stroke="#e6ddc8" strokeOpacity="0.8" strokeWidth="1.5" strokeDasharray="5 4" />
      <rect x="70" y="58" width="26" height="5" fill="#8a6a42" transform="rotate(-18 83 60)" /><rect x="72" y="64" width="26" height="5" fill="#7a5a36" transform="rotate(-18 85 66)" />
      <rect x="40" y="26" width="4" height="34" fill="#5a3d22" />
      <rect x="20" y="12" width="44" height="18" rx="2" fill="#c9a86a" stroke="#5a3d22" strokeWidth="1.5" />
      <text x="42" y="25" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2a1a0a">Build me</text>
    </svg>
  );
}

/**
 * The village seen from above: every building stands on its plot and is a button. Tapping one picks it (the panel beside
 * the scene shows what it does and the Upgrade button). Small signs show the level, a hammer where an upgrade can be done
 * now, and a crown when it is fully built.
 */
export function VillageScene({ e, states, picked, onPick }: { e: Empire; states: Record<VillageBuilding, PlotState>; picked?: VillageBuilding; onPick: (b: VillageBuilding) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // On a phone the village is wider than the screen: start in the middle.
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);
  const order = VILLAGE_BUILDINGS.filter((b): b is Exclude<VillageBuilding, 'walls'> => b !== 'walls').sort((a, b) => PLOTS[a].y - PLOTS[b].y);
  const sign = (b: VillageBuilding, level: number, at: { x: number; y: number }): ReactNode => (
    <span key={`sign-${b}`} className={`cq-vplot__sign${picked === b ? ' cq-vplot__sign--picked' : ''}`} style={pct(at)} aria-hidden="true" onClick={() => onPick(b)}>
      <span className="cq-vplot__chip">{BUILDING_NAMES[b]} · {level}</span>
      {level >= maxLevel(b) ? <span className="cq-vplot__badge cq-vplot__badge--crown" aria-hidden="true">♛</span>
        : states[b].ok ? <span className="cq-vplot__badge cq-vplot__badge--hammer" aria-hidden="true">⚒</span> : null}
    </span>
  );
  return (
    <div className="cq-vscroll" ref={scroller}>
      <div className="cq-vscene" role="group" aria-label="Your village. Tap a building.">
        <svg className="cq-vground" viewBox={`0 0 ${GROUND.w} ${GROUND.h}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          <Ground />
          <Walls level={e.levels.walls} />
          <Gate level={e.levels.walls} />
        </svg>
        {order.map((b) => {
          const level = e.levels[b];
          const art = level > 0 ? buildingArt(b, level) : undefined;
          return (
            <button
              key={b} type="button" className={`cq-vplot${picked === b ? ' cq-vplot--picked' : ''}${level === 0 ? ' cq-vplot--site' : ''}`}
              style={{ ...pct(PLOTS[b]), width: `${level === 0 ? 13 : WIDTH[buildingSize(level)]}%` }}
              aria-label={plotLabel(b, level, states[b].ok)} aria-pressed={picked === b} onClick={() => onPick(b)}
            >
              {art ? <img className="cq-vplot__art" src={art} alt="" draggable={false} /> : <BuildingSite />}
            </button>
          );
        })}
        <button
          type="button" className={`cq-vplot cq-vplot--gate${picked === 'walls' ? ' cq-vplot--picked' : ''}`} style={{ ...pct(GATE), width: '14%' }}
          aria-label={plotLabel('walls', e.levels.walls, states.walls.ok)} aria-pressed={picked === 'walls'} onClick={() => onPick('walls')}
        >
        </button>
        {order.map((b) => sign(b, e.levels[b], PLOTS[b]))}
        {sign('walls', e.levels.walls, { x: GATE.x, y: GATE.y - 10 })}
      </div>
    </div>
  );
}
