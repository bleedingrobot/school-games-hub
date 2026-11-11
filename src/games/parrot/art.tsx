/**
 * Parrot’s See-saw's pictures: the painted ones (scripts/game_art.py parrot, tidied into ./art/paint/, picks in
 * docs/parrot-art/picks.json) and, as a fallback when a picture is missing, the stand-ins drawn in code (SVG). Parrot and
 * the friends, the see-saw plank and pivot, stones, the heap, the shiny things on the bell rope and the Golden Bell.
 * Every number is drawn here in code over the pictures, so a count is always exact. The pictures download when shown.
 */
import type { CSSProperties } from 'react';
import { FRIEND_NAMES, type Friend as FriendName } from '../../../shared/parrot/config';
import type { Metal } from '../../../shared/parrot/progress';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

/** The home and finish background (a snowy tarn), as CSS variables. Nothing if it is not painted. */
export function sceneStyle(): CSSProperties | undefined {
  const full = paint('back/home');
  if (!full) return undefined;
  return { '--pr-back': `url(${full})`, '--pr-back-small': `url(${paint('back/home-800') ?? full})` } as CSSProperties;
}

export type Pose = 'sit' | 'cheer' | 'laugh';

// ---------------------------------------------------------------- the birds

interface BirdLook {
  body: string;
  belly: string;
  wing: string;
  beak: string;
  bill: 'hook' | 'point' | 'long' | 'flat';
  tufts?: boolean;
  crest?: string;
  bigEyes?: boolean;
}

const LOOKS: Record<FriendName, BirdLook> = {
  parrot: { body: '#5b9a3a', belly: '#a6d06a', wing: '#3e7a2a', beak: '#4a4a4a', bill: 'hook', crest: '#f08a24' },
  robin: { body: '#8a6a4a', belly: '#e2552e', wing: '#6a4e34', beak: '#3a3a3a', bill: 'point' },
  kiwi: { body: '#8b6b4a', belly: '#a98a64', wing: '#6e5236', beak: '#e8d29a', bill: 'long' },
  duck: { body: '#f4f1e6', belly: '#ffffff', wing: '#cfd8dc', beak: '#f5a623', bill: 'flat' },
  owl: { body: '#9a7048', belly: '#e9d9b8', wing: '#6b4a2c', beak: '#f0b429', bill: 'point', tufts: true, bigEyes: true },
};

function Bill({ look, open }: { look: BirdLook; open: boolean }) {
  const f = look.beak;
  switch (look.bill) {
    case 'hook':
      return open ? <path d="M64 28 Q82 26 76 42 Q72 36 64 36 Z M64 38 Q74 38 72 46 Q68 44 64 42 Z" fill={f} /> : <path d="M64 28 Q82 28 76 46 Q72 38 63 38 Z" fill={f} />;
    case 'long':
      return <path d="M64 32 L96 44 L64 38 Z" fill={f} stroke="#8a6a2c" strokeWidth="0.8" />;
    case 'flat':
      return <ellipse cx="73" cy="38" rx="11" ry="5" fill={f} />;
    default:
      return <path d="M64 30 L78 36 L64 40 Z" fill={f} />;
  }
}

/** A bird of the see-saw: Parrot, or one of the friends. */
export function Bird({ friend, pose = 'sit' }: { friend: FriendName; pose?: Pose }) {
  const look = LOOKS[friend];
  const raised = pose === 'cheer';
  const src = paint(friend === 'parrot' ? `friends/parrot-${pose === 'sit' ? 'sit' : 'cheer'}` : `friends/${friend}`);
  if (src) return <img className={`pr-bird pr-bird--${pose} pr-bird--painted`} src={src} alt="" draggable={false} />;
  return (
    <svg className={`pr-bird pr-bird--${pose}`} viewBox="0 0 100 100" role="img" aria-label={FRIEND_NAMES[friend]}>
      <path d="M30 80 L14 96 L38 90 Z" fill={look.wing} />
      <ellipse cx="50" cy="62" rx="24" ry="28" fill={look.body} />
      <ellipse cx="53" cy="68" rx="14" ry="20" fill={look.belly} />
      {raised ? (
        <>
          <path d="M30 62 Q10 40 14 22 Q32 34 38 56 Z" fill={look.wing} />
          <path d="M70 62 Q90 40 86 22 Q68 34 62 56 Z" fill={look.wing} />
        </>
      ) : (
        <ellipse cx="36" cy="64" rx="9" ry="17" fill={look.wing} transform="rotate(8 36 64)" />
      )}
      {friend === 'parrot' && !raised && <path d="M30 70 Q36 82 42 70 Z" fill="#f08a24" />}
      <circle cx="50" cy="32" r="17" fill={look.body} />
      {look.crest && <path d="M44 16 L40 4 L50 12 L54 2 L58 14 Z" fill={look.crest} />}
      {look.tufts && <path d="M36 20 L34 6 L46 16 Z M64 20 L66 6 L54 16 Z" fill={look.wing} />}
      {look.bigEyes ? (
        <>
          <circle cx="43" cy="31" r="8" fill="#fff" />
          <circle cx="58" cy="31" r="8" fill="#fff" />
          <circle cx="44" cy="31" r="4" fill="#111" />
          <circle cx="59" cy="31" r="4" fill="#111" />
        </>
      ) : (
        <>
          <circle cx="55" cy="29" r="5.5" fill="#fff" />
          <circle cx="56.5" cy="29" r="2.8" fill="#111" />
        </>
      )}
      <Bill look={look} open={pose === 'laugh'} />
      <path d="M42 90 L40 99 M58 90 L60 99" stroke="#e08a24" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Parrot or a friend, sized by its box, with the name for screen readers (the picture alone is not read). */
export function Friend({ friend, pose = 'sit' }: { friend: FriendName; pose?: Pose }) {
  return (
    <span className={`pr-friend pr-friend--${pose}`}>
      <Bird friend={friend} pose={pose} />
    </span>
  );
}

// ---------------------------------------------------------------- the see-saw

/** What is on a pan: a pile of stones, a numbered weight, a take-away block, or the gap (empty, or filled with a weight). */
export type Item =
  | { t: 'stones'; n: number; tint?: 'a' | 'b' }
  | { t: 'weight'; n: number }
  | { t: 'minus'; n: number }
  | { t: 'gap'; fill?: number | null };
export type Tilt = 'left' | 'level' | 'right' | 'rest';

const ANGLE: Record<Tilt, number> = { left: -8, level: 0, right: 8, rest: 0 };
const INK = '#1b2340';
const STEP = 15;
const GROUP_GAP = 8;
const PLANK_Y = 166;

const widthOf = (item: Item): number => (item.t === 'stones' ? Math.min(5, Math.max(item.n, 1)) * STEP : 40);

function StonePile({ n, tint = 'a' }: { n: number; tint?: 'a' | 'b' }) {
  const src = paint(tint === 'a' ? 'seesaw/stone' : 'seesaw/orange');
  if (src) {
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <image key={i} href={src} x={(i % 5) * STEP - 0.5} y={-(Math.floor(i / 5) * 12 + 13)} width="16" height="13.1" style={{ filter: 'contrast(1.12) drop-shadow(0 0.5px 0.4px rgb(20 20 30 / 0.6))' }} />
        ))}
      </>
    );
  }
  const fills = tint === 'a' ? ['#9a958c', '#aaa59b', '#8a867d'] : ['#e0914c', '#ee9f5a', '#cf8340'];
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={(i % 5) * STEP + 7} cy={-(Math.floor(i / 5) * 12 + 7)} r="6.4" fill={fills[i % 3]} stroke={INK} strokeWidth="0.8" />
      ))}
    </>
  );
}

function Block({ label, kind }: { label: string; kind: 'weight' | 'minus' | 'gap' | 'pending' }) {
  const fill = kind === 'weight' ? '#f4c20d' : kind === 'pending' ? '#ffd9a8' : 'rgb(255 253 245 / 0.85)';
  const dashed = kind === 'minus' || kind === 'gap';
  return (
    <>
      <path d="M13 -34 Q20 -44 27 -34" stroke={INK} strokeWidth="2" fill="none" />
      <rect x="1" y="-34" width="38" height="34" rx="6" fill={fill} stroke={INK} strokeWidth="2" strokeDasharray={dashed ? '5 3' : undefined} />
      <text x="20" y="-11" textAnchor="middle" fontSize={label.length > 2 ? 15 : 20} fontWeight="900" fill={INK} fontFamily="system-ui, sans-serif">{label}</text>
    </>
  );
}

/** How wide a pan's things are, from the first one's left edge to the last one's right edge. */
export const rowWidth = (items: Item[]): number => items.reduce((w, item) => w + widthOf(item), 0) + GROUP_GAP * Math.max(0, items.length - 1);

/** Where the pans' things sit: the left side starts this far in from the left end, the right side ends as far in from the right end. */
const PAN_IN = 34;
const SAW_WIDTH = 440;
/** The room on each side, from the end of the plank to just short of the post. */
export const PAN_ROOM = SAW_WIDTH / 2 - PAN_IN - 12;

function PanItems({ items, from }: { items: Item[]; from: number }) {
  let x = from;
  return (
    <>
      {items.map((item, i) => {
        const at = x;
        x += widthOf(item) + GROUP_GAP;
        return (
          <g key={i} transform={`translate(${at} ${PLANK_Y})`}>
            {item.t === 'stones' && <StonePile n={item.n} tint={item.tint} />}
            {item.t === 'weight' && <Block label={String(item.n)} kind="weight" />}
            {item.t === 'minus' && <Block label={`−${item.n}`} kind="minus" />}
            {item.t === 'gap' && (item.fill === undefined || item.fill === null ? <Block label="?" kind="gap" /> : <Block label={String(item.fill)} kind="pending" />)}
          </g>
        );
      })}
    </>
  );
}

/**
 * The see-saw: a plank on a post, the pans at its ends. It tips (left end down, right end down) or lies flat. The post says
 * what is true: "=" only when the plank is level, "?" when nothing is judged yet (it rests on two props), nothing when it tips.
 */
export function SeeSaw({ left, right, tilt, label = 'A see-saw', className = '', wobble = false, focus = null, close = false, zoom = 1 }: { left: Item[]; right: Item[]; tilt: Tilt; label?: string; className?: string; wobble?: boolean; focus?: 'left' | 'right' | null; close?: boolean; zoom?: number }) {
  const style: CSSProperties = { transform: `rotate(${ANGLE[tilt]}deg)`, transformOrigin: '220px 172px' };
  const plank = paint('seesaw/plank');
  const pivot = paint('seesaw/pivot');
  const painted = Boolean(plank && pivot);
  return (
    <svg className={`pr-saw ${className}${wobble ? ' pr-saw--wobble' : ''}`} viewBox={close ? '0 76 440 174' : '0 0 440 250'} role="img" aria-label={label}>
      <ellipse cx="220" cy="236" rx="120" ry="9" fill="rgb(0 0 0 / 0.15)" />
      {painted ? (
        <image href={pivot} x="190" y="184" width="60" height="52" preserveAspectRatio="none" />
      ) : (
        <polygon points="192,232 248,232 220,174" fill="#7a5a34" stroke={INK} strokeWidth="2" />
      )}
      {(tilt === 'level' || tilt === 'rest') && (
        <text x="220" y="226" textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff" stroke={painted ? INK : undefined} strokeWidth={painted ? 5 : undefined} paintOrder="stroke" fontFamily="system-ui, sans-serif">{tilt === 'level' ? '=' : '?'}</text>
      )}
      <g className={`pr-saw__props${tilt === 'rest' ? '' : ' pr-saw__props--gone'}`} aria-hidden="true">
        <rect x="30" y="182" width="16" height="52" rx="5" fill="#7a5a34" stroke={INK} strokeWidth="2" />
        <rect x="394" y="182" width="16" height="52" rx="5" fill="#7a5a34" stroke={INK} strokeWidth="2" />
      </g>
      <g className="pr-saw__plank" style={style}>
        {painted ? (
          <image href={plank} x="12" y="164" width="416" height="24" preserveAspectRatio="none" />
        ) : (
          <>
            <rect x="18" y="166" width="404" height="14" rx="7" fill="#c9954d" stroke={INK} strokeWidth="2" />
            <rect x="26" y="160" width="190" height="8" rx="4" fill="#e6c98e" stroke={INK} strokeWidth="1.5" />
            <rect x="224" y="160" width="190" height="8" rx="4" fill="#e6c98e" stroke={INK} strokeWidth="1.5" />
          </>
        )}
        {focus && (
          <rect className="pr-saw__focus" x={focus === 'left' ? 16 : SAW_WIDTH / 2 + 8} y="80" width={SAW_WIDTH / 2 - 24} height="84" rx="14" fill="#ffe27a" fillOpacity="0.55" stroke="#f4c20d" strokeWidth="3" />
        )}
        {/* zoom (the big "Let's look together" picture) grows both sides' things alike, from the ends of the plank. */}
        <g transform={`translate(${PAN_IN} ${PLANK_Y}) scale(${zoom}) translate(${-PAN_IN} ${-PLANK_Y})`}>
          <PanItems items={left} from={PAN_IN} />
        </g>
        <g transform={`translate(${SAW_WIDTH - PAN_IN} ${PLANK_Y}) scale(${zoom}) translate(${PAN_IN - SAW_WIDTH} ${-PLANK_Y})`}>
          <PanItems items={right} from={SAW_WIDTH - PAN_IN - rowWidth(right)} />
        </g>
      </g>
      {!painted && <circle cx="220" cy="173" r="6" fill="#f4c20d" stroke={INK} strokeWidth="2" />}
    </svg>
  );
}

/** The heap of stones to take from. */
export function StoneHeap() {
  const src = paint('seesaw/heap');
  if (src) return <img className="pr-heap pr-heap--painted" src={src} alt="" aria-hidden="true" draggable={false} />;
  const spots: [number, number][] = [[20, 60], [44, 60], [68, 60], [92, 60], [32, 42], [56, 42], [80, 42], [44, 24], [68, 24], [56, 8]];
  return (
    <svg className="pr-heap" viewBox="0 0 112 76" aria-hidden="true">
      {spots.map(([x, y], i) => (
        <circle key={i} cx={x + 4} cy={y + 8} r="11" fill={['#9a958c', '#aaa59b', '#8a867d'][i % 3]} stroke={INK} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** A tiny see-saw for the three true or false cards. */
export function TipGlyph({ dir }: { dir: 'left' | 'level' | 'right' }) {
  const deg = ANGLE[dir] * 2.2;
  return (
    <svg className="pr-glyph" viewBox="0 0 80 50" aria-hidden="true">
      <polygon points="30,48 50,48 40,32" fill="#7a5a34" stroke={INK} strokeWidth="2" />
      <g style={{ transform: `rotate(${deg}deg)`, transformOrigin: '40px 32px' }}>
        <rect x="6" y="28" width="68" height="8" rx="4" fill="#c9954d" stroke={INK} strokeWidth="2" />
        <circle cx="16" cy="20" r="7" fill="#9a958c" stroke={INK} strokeWidth="1.5" />
        <circle cx="64" cy="20" r="7" fill="#9a958c" stroke={INK} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- the bell rope

const METAL_FILL: Record<Exclude<Metal, 'bud'>, [string, string]> = { bronze: ['#d98b4a', '#8a4f1c'], silver: ['#dfe5ec', '#8d97a5'], gold: ['#ffd23f', '#b88a00'] };

/** One shiny thing on the rope: a green bud, or a bell in bronze, silver or gold. */
export function Shiny({ metal, glow = false }: { metal: Metal; glow?: boolean }) {
  const src = paint(metal === 'bud' ? 'rope/bud' : metal === 'gold' ? 'rope/bell' : `rope/${metal}`);
  if (src) {
    return (
      <span className={`pr-shiny pr-shiny--${metal}${glow ? ' pr-shiny--glow' : ''}`}>
        <img src={src} alt="" aria-hidden="true" draggable={false} />
      </span>
    );
  }
  return (
    <span className={`pr-shiny pr-shiny--${metal}${glow ? ' pr-shiny--glow' : ''}`}>
      {metal === 'bud' ? (
        <svg viewBox="0 0 40 56" aria-hidden="true">
          <path d="M20 8 C6 20 8 44 20 50 C32 44 34 20 20 8 Z" fill="#8fb04a" stroke="#4a5d1f" strokeWidth="2" />
          <path d="M20 14 L20 46" stroke="#4a5d1f" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 40 56" aria-hidden="true">
          <circle cx="20" cy="7" r="4" fill="none" stroke={METAL_FILL[metal][1]} strokeWidth="2.5" />
          <path d="M20 10 C8 10 9 30 5 42 L35 42 C31 30 32 10 20 10 Z" fill={METAL_FILL[metal][0]} stroke={METAL_FILL[metal][1]} strokeWidth="2" />
          <path d="M13 18 Q12 30 10 38" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="20" cy="47" r="4.5" fill={METAL_FILL[metal][1]} />
        </svg>
      )}
    </span>
  );
}

/** Parrot's bell rope: the ten shiny things, five to a row. */
export function BellRope({ things, glowAt = null }: { things: { metal: Metal }[]; glowAt?: number | null }) {
  const changed = things.filter((t) => t.metal !== 'bud').length;
  return (
    <div className="pr-rope" role="img" aria-label={`${changed} of ${things.length} shiny things changed`}>
      {things.map((t, i) => (
        <span key={i} className="pr-rope__spot">
          <Shiny metal={t.metal} glow={i === glowAt} />
        </span>
      ))}
    </div>
  );
}

/** The Golden Bell, the shiniest thing of all. */
export function GoldenBell() {
  const src = paint('rope/golden-bell');
  if (src) return <img className="pr-golden pr-golden--painted" src={src} alt="The Golden Bell" draggable={false} />;
  return (
    <svg className="pr-golden" viewBox="0 0 120 140" role="img" aria-label="The Golden Bell">
      <circle cx="60" cy="12" r="9" fill="none" stroke="#b88a00" strokeWidth="5" />
      <path d="M60 20 C24 20 28 70 12 106 L108 106 C92 70 96 20 60 20 Z" fill="#ffd23f" stroke="#b88a00" strokeWidth="4" strokeLinejoin="round" />
      <path d="M40 40 Q36 76 28 98" stroke="#fff" strokeOpacity="0.7" strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="8" y="104" width="104" height="12" rx="6" fill="#f2b800" stroke="#b88a00" strokeWidth="4" />
      <circle cx="60" cy="126" r="12" fill="#b88a00" />
      <path d="M96 22 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 Z" fill="#fff6b0" />
    </svg>
  );
}
