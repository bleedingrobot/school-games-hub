import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { BUILDING_NAMES, maxLevel, upgradeCost } from '../../../shared/clans/empire';
import { VILLAGE_BUILDINGS, type Empire, type VillageBuilding } from '../../../shared/clans/types';
import { buildingArt, villageArt } from './art';
import { GATE, GROUND, PLOTS, aroundEdge, diamond, pct, type Plot } from './villageLayout';

export type PlotState = { ok: boolean };

/** How wide a building is drawn, as a share of the ground's width: it grows with every level. */
const widthAt = (level: number) => (level === 0 ? 13 : 13.5 + level * 1.3);

/** The ground has three looks as the village grows (V2): a muddy camp, a gravel village, a paved town. */
export const groundLook = (total: number): 1 | 2 | 3 => (total >= 30 ? 3 : total >= 13 ? 2 : 1);

/** The building that was just upgraded, for the scaffolding-and-dust moment. `n` changes every time so it plays again. */
export type Cheer = { b: VillageBuilding; level: number; n: number };

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
    <g className="cq-vgate">
      <rect x={x - 34} y={y - top} width="12" height={top} fill={stone ? '#77736a' : '#5a3d22'} stroke="#26282c" strokeWidth="1.5" />
      <rect x={x + 22} y={y - top} width="12" height={top} fill={stone ? '#77736a' : '#5a3d22'} stroke="#26282c" strokeWidth="1.5" />
      {level >= 3 && <rect x={x - 36} y={y - top - 8} width="72" height="10" fill={stone ? '#8a857a' : '#7a5532'} stroke="#26282c" strokeWidth="1.5" />}
      {level >= 3 && <rect x={x - 22} y={y - top + 4} width="44" height={top - 4} fill={stone ? '#3a2a1a' : '#4a321c'} opacity="0.85" />}
    </g>
  );
}

/** The ground: grass in a diamond, two crossing roads, a well in the middle and a few trees, in one of three looks.
 * Drawn in code until the ground is painted (V3-V4); then the painting is used instead. */
const LOOKS = {
  1: { edge: '#2e2a1e', outer: '#4f4a33', inner: '#5a5236', road: '#6d5a40', roadW: 22 },
  2: { edge: '#2b2f22', outer: '#4c5636', inner: '#56603c', road: '#7a6548', roadW: 34 },
  3: { edge: '#262c20', outer: '#4e5c36', inner: '#5d6b3f', road: '#77736a', roadW: 38 },
} as const;
function Ground({ look }: { look: 1 | 2 | 3 }) {
  const { cx, cy } = GROUND;
  const L = LOOKS[look];
  const painted = villageArt(`ground-${look}`);
  if (painted) return <image href={painted} x="0" y="0" width={GROUND.w} height={GROUND.h} preserveAspectRatio="xMidYMid slice" />;
  const road = (a: [number, number], b: [number, number]) => (
    <g>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={L.road} strokeWidth={L.roadW} strokeLinecap="round" />
      {look === 3 && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#5d5a52" strokeWidth={L.roadW - 6} strokeDasharray="3 13" strokeLinecap="butt" />}
    </g>
  );
  const [back, right, front, left] = diamond(40);
  const trees: [number, number][] = [[150, 300], [180, 270], [845, 300], [815, 268], [500, 92], [470, 112], [262, 470], [740, 470]];
  const tent = (x: number, y: number, c: string) => (
    <g><polygon points={pts([[x - 18, y], [x, y - 26], [x + 18, y]])} fill={c} stroke="#3a2d1c" strokeWidth="1.5" /><polygon points={pts([[x - 4, y], [x, y - 14], [x + 4, y]])} fill="#2a1f12" /></g>
  );
  const lantern = (x: number, y: number) => (
    <g><rect x={x - 1.5} y={y - 24} width="3" height="24" fill="#2a2420" /><circle cx={x} cy={y - 26} r="4.5" fill="#f2b85a" /><circle cx={x} cy={y - 26} r="10" fill="#f2b85a" opacity="0.18" /></g>
  );
  const cart = (x: number, y: number) => (
    <g><rect x={x - 14} y={y - 14} width="28" height="10" fill="#7a5532" stroke="#3d2814" strokeWidth="1.2" /><rect x={x - 12} y={y - 22} width="10" height="8" fill="#a8864e" /><rect x={x} y={y - 20} width="9" height="6" fill="#8a6a42" /><circle cx={x - 8} cy={y - 3} r="4" fill="#3d2814" /><circle cx={x + 8} cy={y - 3} r="4" fill="#3d2814" /></g>
  );
  const flag = (x: number, y: number, c: string) => (
    <g><rect x={x - 1.5} y={y - 44} width="3" height="44" fill="#4a3a2a" /><polygon points={pts([[x + 1.5, y - 44], [x + 24, y - 38], [x + 1.5, y - 31]])} fill={c} /></g>
  );
  return (
    <>
      <polygon points={pts(diamond(-6))} fill={L.edge} />
      <polygon points={pts(diamond(0))} fill={L.outer} />
      <polygon points={pts(diamond(70))} fill={L.inner} />
      <g opacity="0.9">
        {road([(back[0] + left[0]) / 2, (back[1] + left[1]) / 2], [(front[0] + right[0]) / 2, (front[1] + right[1]) / 2])}
        {road([(back[0] + right[0]) / 2, (back[1] + right[1]) / 2], [(front[0] + left[0]) / 2, (front[1] + left[1]) / 2])}
        {road([cx, cy], [GATE.x, GATE.y - 6])}
      </g>
      {look === 3 && <polygon points={pts([[cx, cy - 46], [cx + 80, cy], [cx, cy + 46], [cx - 80, cy]])} fill="#7d796f" stroke="#5d5a52" strokeWidth="3" />}
      {trees.map(([x, y], i) => (
        <g key={i}><rect x={x - 2} y={y - 6} width="4" height="10" fill="#3d2814" /><ellipse cx={x} cy={y - 16} rx="13" ry="15" fill="#2f4a2a" /><ellipse cx={x - 3} cy={y - 20} rx="7" ry="8" fill="#3f5f35" /></g>
      ))}
      {look === 1 && (
        <g>
          {tent(430, 250, '#8f7a58')}{tent(585, 245, '#7d6a4c')}{tent(340, 405, '#8a7452')}{tent(665, 410, '#93805e')}
          <circle cx={cx} cy={cy} r="9" fill="#e07a3a" /><circle cx={cx} cy={cy - 4} r="5" fill="#f2c25a" />
          <ellipse cx={cx} cy={cy + 4} rx="18" ry="7" fill="none" stroke="#5b5e60" strokeWidth="4" />
        </g>
      )}
      {look >= 2 && (
        <>
          <ellipse cx={cx} cy={cy} rx={look === 3 ? 30 : 24} ry={look === 3 ? 16 : 13} fill="#5b5e60" stroke="#2a2c2e" strokeWidth="3" />
          <ellipse cx={cx} cy={cy - 2} rx={look === 3 ? 22 : 15} ry={look === 3 ? 10 : 7} fill={look === 3 ? '#3f6f8c' : '#1d2a33'} />
          {look === 3 && <><rect x={cx - 3} y={cy - 30} width="6" height="26" fill="#8a857a" /><ellipse cx={cx} cy={cy - 31} rx="9" ry="4" fill="#8fc0dc" /></>}
          {cart(560, 345)}
          {lantern(445, 290)}{lantern(560, 290)}{lantern(445, 365)}{lantern(560, 365)}
        </>
      )}
      {look === 3 && <>{flag(cx - 70, cy - 10, '#b8423a')}{flag(cx + 70, cy - 10, '#3a6ab8')}{flag(cx - 70, cy + 40, '#d6a43a')}{flag(cx + 70, cy + 40, '#4a9a5a')}{cart(430, 420)}</>}
    </>
  );
}

/** An empty plot: pegs and rope round a patch of dirt, timber, and a "Build me" sign. */
function BuildingSite() {
  const painted = villageArt('site');
  if (painted) return <img className="cq-vsite" src={painted} alt="" draggable={false} />;
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

/** Scaffolding over a building while it is upgraded. */
function Scaffold() {
  const painted = villageArt('scaffold');
  if (painted) return <img className="cq-vscaffold" src={painted} alt="" draggable={false} />;
  return (
    <svg className="cq-vscaffold" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
      {[12, 37, 63, 88].map((x) => <rect key={x} x={x - 2} y="8" width="4" height="88" fill="#a07a48" stroke="#4a3018" strokeWidth="0.8" />)}
      {[22, 48, 74].map((y) => <rect key={y} x="6" y={y} width="88" height="4" fill="#b08a56" stroke="#4a3018" strokeWidth="0.8" />)}
      <line x1="12" y1="96" x2="37" y2="48" stroke="#8a6a42" strokeWidth="2.5" /><line x1="63" y1="74" x2="88" y2="22" stroke="#8a6a42" strokeWidth="2.5" />
    </svg>
  );
}

/** Dust and smoke: soft puffs that rise (dust while building, dark smoke after a raid). */
function Puffs({ kind }: { kind: 'dust' | 'smoke' }) {
  const painted = kind === 'smoke' ? villageArt('smoke') : undefined;
  if (painted) return <img className="cq-vsmoke-art" src={painted} alt="" draggable={false} />;
  return <span className={`cq-vpuffs cq-vpuffs--${kind}`} aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</span>;
}

/** V5, village life: chimney smoke, made in code and laid over the painting. */
const Chimney = () => <span className="cq-vchimney" aria-hidden="true"><i /><i /><i /></span>;

/** V5: a pennant flying from the top of the Tower. */
const Pennant = () => (
  <svg className="cq-vpennant" viewBox="0 0 40 50" aria-hidden="true">
    <rect x="2" y="0" width="2.5" height="50" fill="#3a2d22" />
    <path className="cq-vpennant__cloth" d="M4.5 3 L38 10 L4.5 19 Z" fill="#b8423a" stroke="#5a1a14" strokeWidth="1" />
  </svg>
);

/** V5: a villager (hood, body, legs) seen from the side, small enough for the roads. */
const Villager = ({ coat }: { coat: string }) => (
  <svg viewBox="0 0 20 34" aria-hidden="true">
    <ellipse cx="10" cy="32" rx="7" ry="2" fill="rgba(0,0,0,0.35)" />
    <rect className="cq-vwalker__leg" x="6.5" y="22" width="3" height="10" rx="1.4" fill="#3a2d22" />
    <rect className="cq-vwalker__leg cq-vwalker__leg--b" x="10.5" y="22" width="3" height="10" rx="1.4" fill="#2e241b" />
    <path d="M4 24 Q4 12 10 11 Q16 12 16 24 Z" fill={coat} stroke="#1e1812" strokeWidth="1" />
    <circle cx="10" cy="8" r="4.2" fill="#d9b48c" />
    <path d="M5.5 8 Q6 2 10 2 Q14 2 14.5 8 Q12 5 10 5.2 Q8 5 5.5 8 Z" fill={coat} />
  </svg>
);

/** The roads the villagers walk along (in ground units), back and forth. More walk as the village grows. */
function roads(): [Plot, Plot][] {
  const [back, right, front, left] = diamond(60);
  const mid = (a: [number, number], b: [number, number]): Plot => ({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 });
  return [
    [mid(back, left), mid(front, right)],
    [mid(front, left), mid(back, right)],
    [{ x: GROUND.cx, y: GROUND.cy + 20 }, { x: GATE.x, y: GATE.y - 30 }],
  ];
}
const COATS = ['#6a4a8a', '#8a5a2a', '#3a6a5a'];

/** V5: fireworks over a finished village (all 39 levels). */
function Fireworks() {
  const bursts = [{ x: 18, y: 14, c: '#ffd36b', d: 0 }, { x: 80, y: 12, c: '#ff7b6b', d: 0.9 }, { x: 50, y: 6, c: '#8fd0ff', d: 1.7 }, { x: 30, y: 22, c: '#b6ff8f', d: 2.6 }];
  return (
    <span className="cq-vfireworks" aria-hidden="true">
      {bursts.map((b, i) => (
        <span key={i} className="cq-vburst" style={{ left: `${b.x}%`, top: `${b.y}%`, color: b.c, animationDelay: `${b.d}s` }}>
          {Array.from({ length: 12 }, (_, k) => <i key={k} style={{ transform: `rotate(${k * 30}deg)`, animationDelay: `${b.d}s` }} />)}
        </span>
      ))}
    </span>
  );
}

/** "Level 4!" (or "Fully built!") floating up when the dust clears. */
const floatText = (c: Cheer) => (c.level >= maxLevel(c.b) ? 'Fully built!' : `Level ${c.level}!`);

/**
 * The village seen from above: every building stands on its plot and is a button. Tapping one picks it (the panel beside
 * the scene shows what it does and the Upgrade button). Small signs show the level, a hammer where an upgrade can be done
 * now, and a crown when it is fully built.
 */
export function VillageScene({ e, states, picked, onPick, total, cheer, smoky }: {
  e: Empire; states: Record<VillageBuilding, PlotState>; picked?: VillageBuilding; onPick: (b: VillageBuilding) => void;
  /** The Village total (0-39), which picks the ground's look. */
  total: number;
  /** The building just upgraded, for the scaffolding moment. */
  cheer?: Cheer;
  /** Buildings a raid knocked a level off since this pupil last looked. */
  smoky?: ReadonlySet<VillageBuilding>;
}) {
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
        <svg className={`cq-vground${cheer ? ' cq-vground--shake' : ''}`} key={cheer ? `g${cheer.n}` : 'g'} viewBox={`0 0 ${GROUND.w} ${GROUND.h}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          <Ground look={groundLook(total)} />
          <Walls level={e.levels.walls} />
          <Gate level={e.levels.walls} />
        </svg>
        {roads().slice(0, groundLook(total)).map(([a, b], i) => (
          <span
            key={`walker-${i}`} className="cq-vwalker" aria-hidden="true"
            style={{ '--x0': pct(a).left, '--y0': pct(a).top, '--x1': pct(b).left, '--y1': pct(b).top, animationDelay: `${-i * 7}s`, animationDuration: `${22 + i * 5}s` } as CSSProperties}
          >
            <Villager coat={COATS[i]} />
          </span>
        ))}
        {order.map((b) => {
          const level = e.levels[b];
          const art = level > 0 ? buildingArt(b, level) : undefined;
          const building = cheer?.b === b;
          return (
            <button
              key={building ? `${b}-${cheer.n}` : b} type="button"
              className={`cq-vplot${picked === b ? ' cq-vplot--picked' : ''}${level === 0 ? ' cq-vplot--site' : ''}${building ? ' cq-vplot--building' : ''}${smoky?.has(b) && !building ? ' cq-vplot--smoky' : ''}`}
              style={{ ...pct(PLOTS[b]), width: `${widthAt(level)}%` }}
              aria-label={plotLabel(b, level, states[b].ok)} aria-pressed={picked === b} onClick={() => onPick(b)}
            >
              {art ? <img className="cq-vplot__art" src={art} alt="" draggable={false} /> : <BuildingSite />}
              {level > 0 && !building && !smoky?.has(b) && (b === 'smithy' || b === 'forge') && <Chimney />}
              {level > 0 && !building && b === 'tower' && <Pennant />}
              {smoky?.has(b) && !building && <Puffs kind="smoke" />}
              {building && <><Scaffold /><Puffs kind="dust" /><span className="cq-vfloat" aria-hidden="true">{floatText(cheer)}</span></>}
            </button>
          );
        })}
        <button
          key={cheer?.b === 'walls' ? `walls-${cheer.n}` : 'walls'} type="button"
          className={`cq-vplot cq-vplot--gate${picked === 'walls' ? ' cq-vplot--picked' : ''}${cheer?.b === 'walls' ? ' cq-vplot--building' : ''}`} style={{ ...pct(GATE), width: '14%' }}
          aria-label={plotLabel('walls', e.levels.walls, states.walls.ok)} aria-pressed={picked === 'walls'} onClick={() => onPick('walls')}
        >
          {smoky?.has('walls') && cheer?.b !== 'walls' && <Puffs kind="smoke" />}
          {cheer?.b === 'walls' && <><Puffs kind="dust" /><span className="cq-vfloat" aria-hidden="true">{floatText(cheer)}</span></>}
        </button>
        {VILLAGE_BUILDINGS.every((b) => e.levels[b] >= maxLevel(b)) && <Fireworks />}
        {order.map((b) => sign(b, e.levels[b], PLOTS[b]))}
        {sign('walls', e.levels.walls, { x: GATE.x, y: GATE.y - 10 })}
      </div>
    </div>
  );
}
