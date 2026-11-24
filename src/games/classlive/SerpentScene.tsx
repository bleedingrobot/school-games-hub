/**
 * Serpent Chain on the projector (docs/CLASSLIVE-PLAN.md section 3): a giant serpent winding across a jungle-temple night.
 * Each scale (box) shows its operation; every pupil is a glowing gem on the box they are on. The running answers
 * (chain.values) are drawn only once the game is over, one scale at a time. Moving parts are CSS transform/opacity
 * animations (projector.css, classes prefixed sp-).
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BODY, stepText, type SerpentGame } from '../../../shared/classlive/serpent';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { painted } from './paintedArt';

/** The painted serpent (docs/CLASSLIVE-ART-PLAN.md, folder serpent). Any piece not painted falls back to its drawing. */
const ART = {
  asleep: painted('serpent', 'head-asleep'),
  awake: painted('serpent', 'head-awake'),
  coil: painted('serpent', 'coil'),
  tail: painted('serpent', 'tail'),
  plate: painted('serpent', 'plate'),
  tablet: painted('serpent', 'tablet'),
  skin: painted('serpent', 'skin'),
  burst: painted('serpent', 'burst'),
  awakeBack: painted('back', 'jungle-awake'),
};

/** Twelve bright, different gem colours (the people[].colour index 0 to 11). */
export const GEM_COLOURS = ['#ff4d6d', '#ff9f1c', '#ffe14d', '#a6ff4d', '#2ee6a6', '#2de2ff', '#4d8dff', '#9b6bff', '#e05cff', '#ff7fc0', '#ffffff', '#ffb38a'];

export interface SerpentFx {
  hopping: Set<string>;
  banner: { text: string; key: number } | null;
  tailPulse: number;
  shake: boolean;
  roar: number;
  /** Counts up each time someone reaches the head (a flash of light there). */
  headPulse: number;
}
export const NO_SERPENT_FX: SerpentFx = { hopping: new Set(), banner: null, tailPulse: 0, shake: false, roar: 0, headPulse: 0 };

type Person = ScreenView['people'][number];

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- backdrop ---------------- */

const FLIES = Array.from({ length: 26 }, (_, i) => ({
  x: rnd(i * 5 + 1) * 100, y: 12 + rnd(i * 3 + 7) * 84, d: 5 + rnd(i * 11) * 9, s: 2 + rnd(i * 13) * 3, o: rnd(i * 17) * -8,
}));
const VINES = [4, 17, 33, 52, 68, 83, 95].map((x, i) => ({ x, len: 14 + rnd(i * 9 + 2) * 16, d: -rnd(i + 20) * 6 }));

export const JungleBackdrop = memo(function JungleBackdrop() {
  return (
    <div className="sp-back" aria-hidden="true">
      <div className="sp-back__moon" />
      <svg className="sp-temple" viewBox="0 0 200 110" preserveAspectRatio="xMidYMax meet">
        <defs>
          <radialGradient id="sp-door" cx="50%" cy="60%" r="60%"><stop offset="0" stopColor="#fff6a0" /><stop offset="0.5" stopColor="#6dffc9" /><stop offset="1" stopColor="#6dffc900" /></radialGradient>
        </defs>
        <ellipse className="sp-temple__halo" cx="100" cy="84" rx="62" ry="40" fill="url(#sp-door)" />
        <path fill="#041a1a" d="M0 110 V92 L22 92 L22 80 L44 80 L44 66 L66 66 L66 52 L86 52 L86 40 L114 40 L114 52 L134 52 L134 66 L156 66 L156 80 L178 80 L178 92 L200 92 V110 Z" />
        <path fill="#062423" d="M92 40 L100 22 L108 40 Z M96 52 H104 V40 H96 Z" />
        <rect x="93" y="70" width="14" height="22" rx="7" fill="#c9f5a0" opacity="0.45" />
        {[30, 50, 150, 170].map((x, i) => <rect key={x} x={x} y={86 - i % 2 * 6} width="3" height="6" fill="#6dffc9" opacity="0.75" />)}
      </svg>
      {VINES.map((v, i) => (
        <svg key={i} className="sp-vine" style={{ left: `${v.x}%`, height: `${v.len}vh`, animationDelay: `${v.d}s` }} viewBox="0 0 20 100" preserveAspectRatio="none">
          <path d="M10 0 C2 20 18 40 10 60 C4 76 14 88 10 100" fill="none" stroke="#0b4d36" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
        </svg>
      ))}
      {VINES.map((v, i) => <i key={`l${i}`} className="sp-leaf" style={{ left: `calc(${v.x}% - 7px)`, top: `${v.len - 3}vh`, animationDelay: `${v.d}s` }} />)}
      {FLIES.map((f, i) => (
        <i key={i} className="sp-fly" style={{ left: `${f.x}%`, top: `${f.y}%`, width: f.s, height: f.s, animationDuration: `${f.d}s, ${f.d / 2.4}s`, animationDelay: `${f.o}s` }} />
      ))}
    </div>
  );
});

const MOTES = Array.from({ length: 34 }, (_, i) => ({
  x: rnd(i * 7 + 3) * 100, y: 8 + rnd(i * 5 + 9) * 88, d: 7 + rnd(i * 13 + 1) * 10, s: 3 + rnd(i * 19) * 5, o: rnd(i * 23) * -12,
}));
const LEAVES = Array.from({ length: 9 }, (_, i) => ({ x: rnd(i * 31 + 4) * 100, d: 11 + rnd(i * 7 + 2) * 9, o: rnd(i * 3 + 8) * -20, s: 14 + rnd(i * 41) * 14 }));

/**
 * Over the painted jungle: light shafts, drifting mist, golden fireflies and falling leaves; when the serpent wakes, the
 * glowing temple (back/jungle-awake) fades in behind them.
 */
export const SerpentAmbience = memo(function SerpentAmbience({ awake }: { awake: boolean }) {
  return (
    <div className={`sp-amb ${awake ? 'sp-amb--awake' : ''}`} aria-hidden="true">
      {ART.awakeBack && <div className="sp-amb__awake" style={{ backgroundImage: `url(${ART.awakeBack})` }} />}
      <div className="sp-amb__rays" />
      <div className="sp-amb__mist sp-amb__mist--a" />
      <div className="sp-amb__mist sp-amb__mist--b" />
      {MOTES.map((m, i) => (
        <i key={i} className="sp-mote" style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s, animationDuration: `${m.d}s, ${m.d / 3}s`, animationDelay: `${m.o}s` }} />
      ))}
      {LEAVES.map((l, i) => (
        <i key={`l${i}`} className="sp-fall" style={{ left: `${l.x}%`, width: l.s, height: l.s * 0.6, animationDuration: `${l.d}s`, animationDelay: `${l.o}s` }} />
      ))}
      <div className="sp-amb__vignette" />
    </div>
  );
});

/* ---------------- the coiled sleeping serpent (lobby) ---------------- */

export function CoiledSerpent() {
  if (ART.coil) {
    return (
      <div className="sp-coilp" role="img" aria-label="A sleeping serpent, coiled up">
        <i className="sp-coilp__glow" aria-hidden="true" />
        <img className="sp-coilp__img" src={ART.coil} alt="" draggable={false} />
        <span className="sp-coilp__zzz" aria-hidden="true"><b>z</b><b>z</b><b>z</b></span>
      </div>
    );
  }
  return (
    <svg className="sp-coil" viewBox="0 0 260 160" role="img" aria-label="A sleeping serpent, coiled up">
      <defs>
        <linearGradient id="sp-coilg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3fe0a0" /><stop offset="1" stopColor="#0c7a56" /></linearGradient>
      </defs>
      {[{ cy: 118, rx: 108, ry: 30 }, { cy: 84, rx: 84, ry: 25 }, { cy: 52, rx: 58, ry: 19 }].map((e, i) => (
        <g key={i}>
          <ellipse cx="124" cy={e.cy} rx={e.rx} ry={e.ry} fill="none" stroke="#04281f" strokeWidth="32" />
          <ellipse cx="124" cy={e.cy} rx={e.rx} ry={e.ry} fill="none" stroke="url(#sp-coilg)" strokeWidth="26" />
          <ellipse cx="124" cy={e.cy} rx={e.rx} ry={e.ry} fill="none" stroke="#b9ffe0" strokeOpacity="0.5" strokeWidth="5" strokeDasharray="2 15" strokeLinecap="round" />
        </g>
      ))}
      <g className="sp-coil__head">
        <path d="M150 30 C150 6 196 2 218 22 C232 34 226 54 204 54 C178 56 150 52 150 30 Z" fill="#17b980" stroke="#04281f" strokeWidth="3" />
        <path d="M174 24 q7 6 14 0 M196 28 q7 6 14 0" fill="none" stroke="#04281f" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="219" cy="40" r="1.8" fill="#04281f" />
      </g>
      <g className="sp-zzz" fill="#d9fff0"><text x="214" y="22" fontSize="20" fontWeight="900">z</text><text x="232" y="10" fontSize="15" fontWeight="900">z</text><text x="246" y="2" fontSize="11" fontWeight="900">z</text></g>
    </svg>
  );
}

/* ---------------- layout ---------------- */

interface Pt { x: number; y: number }
interface TailLay { boxes: Pt[]; bw: number; bh: number; top: number; label: Pt; link: string; curl: Pt | null }
interface Lay {
  w: number; h: number; C: number;
  nodes: Pt[]; path: string; th: number; bw: number; bh: number;
  head: { x: number; y: number; hw: number; hh: number; dir: number };
  tail: TailLay | null;
  /** Distance along the body path to each node, and to the head (the path's end). */
  at: number[]; total: number;
}
const TOP = 54;
const BOTTOM = 66;

function layoutOf(w: number, h: number, tail: number): Lay {
  const C = w < 640 ? 3 : 5;
  const rows = Math.ceil((BODY + 1) / C);
  const tcols = w < 640 ? 6 : 12;
  const trows = Math.ceil(tail / tcols);
  const free = Math.max(120, h - TOP - BOTTOM);
  let stripH = 0;
  let tcellH = 0;
  if (tail > 0) {
    tcellH = Math.min((w - 32) / tcols * 0.95, 66);
    stripH = Math.min(free * 0.4, trows * tcellH + 30);
    tcellH = (stripH - 30) / trows;
  }
  const mainH = free - stripH;
  const ch = mainH / rows;
  const th = Math.min(ch * 0.8, (w / C) * 0.8);
  const rx = Math.min(ch / 2, w * 0.06);
  const pad = rx + th / 2 + 6;
  const cw = (w - 2 * pad) / (C - 1);
  const nodes: Pt[] = Array.from({ length: BODY + 1 }, (_, k) => {
    const row = Math.floor(k / C);
    const col = k % C;
    return { x: pad + (row % 2 === 0 ? col : C - 1 - col) * cw, y: TOP + (row + 0.5) * ch };
  });
  const bh = th * 0.84;
  const bw = Math.min(cw * 0.88, bh * 1.8);
  let path = `M ${nodes[0].x} ${nodes[0].y}`;
  const k = rx * 1.33;
  const at = [0];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    if (Math.abs(a.y - b.y) < 1) {
      path += ` L ${b.x} ${b.y}`;
      at.push(at[i - 1] + Math.abs(b.x - a.x));
    } else {
      const dir = Math.floor((i - 1) / C) % 2 === 0 ? 1 : -1;
      path += ` C ${a.x + dir * k} ${a.y} ${b.x + dir * k} ${b.y} ${b.x} ${b.y}`;
      at.push(at[i - 1] + cubicLength(a, { x: a.x + dir * k, y: a.y }, { x: b.x + dir * k, y: b.y }, b));
    }
  }
  const last = nodes[BODY];
  const lastDir = Math.floor(BODY / C) % 2 === 0 ? 1 : -1;
  const head = { x: last.x + lastDir * cw * 0.92, y: last.y, hw: Math.min(cw * 0.52, th * 1.05), hh: th * 0.6, dir: lastDir };
  path += ` L ${head.x} ${head.y}`;
  const total = at[BODY] + Math.abs(head.x - last.x);
  let tl: TailLay | null = null;
  if (tail > 0) {
    const top = TOP + mainH;
    const tcw = (w - 32) / tcols;
    const startRight = head.x > w / 2;
    const boxes: Pt[] = Array.from({ length: tail }, (_, i) => {
      const row = Math.floor(i / tcols);
      const col = i % tcols;
      const rtl = (row % 2 === 0) === startRight;
      return { x: 16 + (rtl ? tcols - 1 - col : col) * tcw + tcw / 2, y: top + 24 + (row + 0.5) * tcellH };
    });
    const nxt = tail;
    const nrow = Math.floor(nxt / tcols);
    const ncol = nxt % tcols;
    const nrtl = (nrow % 2 === 0) === startRight;
    const curl = nxt < tcols * trows + tcols && nrow < trows + 1 && (nrow === trows - 1 || nrow === trows)
      ? { x: 16 + (nrtl ? tcols - 1 - ncol : ncol) * tcw + tcw / 2, y: top + 24 + (nrow + 0.5) * tcellH } : null;
    const f = boxes[0];
    tl = {
      boxes, top, bw: tcw * 0.9, bh: Math.min(tcellH * 0.9, tcw * 0.8), label: { x: w / 2, y: top + 14 },
      link: `M ${head.x} ${head.y + head.hh * 0.6} C ${head.x} ${(head.y + f.y) / 2} ${f.x} ${(head.y + f.y) / 2} ${f.x} ${f.y - 12}`,
      curl: curl && curl.x > 20 && curl.x < w - 20 ? curl : null,
    };
  }
  return { w, h, C, nodes, path, th, bw, bh, head, tail: tl, at, total };
}

function cubicLength(a: Pt, b: Pt, c: Pt, d: Pt) {
  let len = 0;
  let prev = a;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const p = {
      x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
      y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
    };
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

/** Lay the gems of one box out in rows (each maybe with a first-name label), as big as will fit. */
function flow(items: { id: string; name: string | null }[], w: number, h: number, dMax: number) {
  const tries = items.some((i) => i.name) ? [true, false] : [false];
  for (const named of tries) {
    for (let d = Math.min(dMax, h); d >= 11; d -= 1.5) {
      const fs = d * 0.66;
      const width = (i: { name: string | null }) => d + 3 + (named && i.name ? i.name.length * fs * 0.6 + 6 : 0);
      const pos: { id: string; x: number; y: number; name: string | null }[] = [];
      let x = 0;
      let row = 0;
      for (const it of items) {
        const iw = width(it);
        if (x > 0 && x + iw > w) { x = 0; row++; }
        pos.push({ id: it.id, x: x + d / 2, y: row * (d + 2) + d / 2, name: named ? it.name : null });
        x += iw;
      }
      if ((row + 1) * (d + 2) <= h + 1) return { d, fs, pos, rows: row + 1 };
    }
  }
  return null;
}

/* ---------------- pieces ---------------- */

function Gem({ colour, d }: { colour: string; d: number }) {
  const r = d / 2;
  return (
    <g>
      <circle r={r * 1.55} fill={colour} opacity="0.3" />
      <polygon points={`0,${-r} ${r * 0.9},${-r * 0.25} ${r * 0.55},${r * 0.9} ${-r * 0.55},${r * 0.9} ${-r * 0.9},${-r * 0.25}`} fill={colour} stroke="#fff" strokeWidth={Math.max(1, d * 0.08)} strokeLinejoin="round" />
      <polygon points={`0,${-r * 0.8} ${r * 0.4},${-r * 0.15} 0,${r * 0.1} ${-r * 0.4},${-r * 0.15}`} fill="#fff" opacity="0.55" />
    </g>
  );
}

function Eye({ x, y, r, open, dir }: { x: number; y: number; r: number; open: boolean; dir: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M ${-r} 0 Q 0 ${r * 0.9} ${r} 0`} fill="none" stroke="#02150f" strokeWidth={r * 0.28} strokeLinecap="round" className="sp-eye__shut" style={{ opacity: open ? 0 : 1 }} />
      <g className="sp-eye__open" style={{ opacity: open ? 1 : 0 }}>
        <circle r={r * 1.9} fill="#ffe14d" opacity="0.4" className="sp-eye__glow" />
        <ellipse rx={r * 1.15} ry={r} fill="#ffe94d" stroke="#02150f" strokeWidth={r * 0.18} />
        <ellipse cx={dir * r * 0.15} rx={r * 0.26} ry={r * 0.85} fill="#1a0500" />
      </g>
    </g>
  );
}

function Scale({ p, bw, bh, text, lit, answer, over, i, small }: { p: Pt; bw: number; bh: number; text: string; lit: boolean; answer: number | null; over: boolean; i: number; small?: boolean }) {
  const fs = Math.min(bh * (over ? 0.34 : small ? 0.3 : 0.38), (bw * 0.92) / (Math.max(3, text.length) * 0.6));
  const textY = over ? -bh * 0.18 : small ? -bh * 0.2 : -bh * 0.2;
  const af = Math.min(bh * 0.34, (bw * 0.9) / (String(answer ?? 0).length * 0.62 + 1));
  return (
    <g transform={`translate(${p.x} ${p.y})`}><g className={`sp-scale ${lit ? 'sp-scale--lit' : ''}`} style={{ animationDelay: `${(i % 12) * 0.35}s` }}>
      {lit && <rect x={-bw / 2 - 5} y={-bh / 2 - 5} width={bw + 10} height={bh + 10} rx={bh * 0.3} className="sp-scale__glow" />}
      {ART.plate ? (
        <>
          <image href={ART.plate} x={-bw / 2 - bw * 0.04} y={-bh / 2 - bh * 0.06} width={bw * 1.08} height={bh * 1.12} preserveAspectRatio="none" className="sp-plate" />
          <rect x={-bw * 0.4} y={-bh * 0.36} width={bw * 0.8} height={bh * 0.72} rx={bh * 0.2} className="sp-plate__well" />
          {lit && <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={bh * 0.26} className="sp-plate__shine" />}
        </>
      ) : (
        <>
          <rect x={-bw / 2} y={-bh / 2} width={bw} height={bh} rx={bh * 0.26} className="sp-scale__face" strokeWidth={Math.max(2, bh * 0.04)} />
          <path d={`M ${-bw * 0.36} ${-bh * 0.4} Q 0 ${-bh * 0.5} ${bw * 0.36} ${-bh * 0.4}`} className="sp-scale__ridge" strokeWidth={Math.max(2, bh * 0.045)} fill="none" />
        </>
      )}
      <text y={textY} textAnchor="middle" dominantBaseline="central" className="sp-op" style={{ fontSize: fs, strokeWidth: fs * 0.14 }}>{text}</text>
      {answer !== null && (
        <text y={bh * 0.22} textAnchor="middle" dominantBaseline="central" className="sp-ans" style={{ fontSize: af, strokeWidth: af * 0.14 }}>= {answer}</text>
      )}
    </g></g>
  );
}

/* ---------------- the scene ---------------- */

export interface SerpentSceneProps {
  game: SerpentGame;
  people: Person[];
  players: number;
  wakeAt: number;
  over: boolean;
  fx: SerpentFx;
  sound: ClassLiveSound;
  onRevealed: () => void;
}

export function SerpentScene({ game, people, wakeAt, over, fx, sound, onRevealed }: SerpentSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { chain } = game;
  const tail = Math.min(game.tail, chain.steps.length - BODY);
  const lay = useMemo(() => (size.w && size.h ? layoutOf(size.w, size.h, tail) : null), [size.w, size.h, tail]);

  // The finish: the answers light up one scale at a time (400 ms apart), then the head roars.
  const [revealed, setRevealed] = useState(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const doneRef = useRef(onRevealed);
  doneRef.current = onRevealed;
  useEffect(() => {
    if (!over) { setRevealed(0); return; }
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      setRevealed(n);
      if (n <= BODY) soundRef.current.play('twinkle');
      if (n === BODY + 1) soundRef.current.play('roar');
      if (n >= BODY + 1) { window.clearInterval(id); window.setTimeout(() => doneRef.current(), 2600); }
    }, 400);
    return () => window.clearInterval(id);
  }, [over]);
  const roaring = over && revealed > BODY;

  const colour = useMemo(() => Object.fromEntries(people.map((p) => [p.id, GEM_COLOURS[p.colour % 12]])), [people]);
  const maxAt = useMemo(() => Object.values(game.mine).reduce((m, v) => Math.max(m, v.at), 0), [game.mine]);

  // Which gems sit on which box.
  const gems = useMemo(() => {
    if (!lay) return null;
    const byBox = new Map<number, { id: string; name: string | null }[]>();
    const lastBox = BODY + Math.max(tail, 1) - 1;
    for (const p of people) {
      const at = game.mine[p.id]?.at ?? 0;
      const box = at < BODY ? at : tail === 0 ? BODY - 1 : Math.min(at, lastBox);
      (byBox.get(box) ?? byBox.set(box, []).get(box)!).push({ id: p.id, name: p.name });
    }
    const out: { box: number; at: Pt; flow: NonNullable<ReturnType<typeof flow>> }[] = [];
    for (const [box, items] of byBox) {
      if (over) continue;
      const small = box >= BODY;
      const p = small ? lay.tail?.boxes[box - BODY] : lay.nodes[box + 1];
      if (!p) continue;
      const bw = small ? lay.tail!.bw : lay.bw;
      const bh = small ? lay.tail!.bh : lay.bh;
      const zoneW = bw - 10;
      const zoneH = small ? bh * 0.36 : bh * 0.36;
      const dMax = small ? 16 : Math.max(14, Math.min(34, bh * 0.28));
      let f = flow(items, zoneW, zoneH, dMax);
      for (let k = items.length - 1; !f && k >= 0; k--) {
        f = flow([...items.slice(0, k), { id: `more:${box}`, name: `+${items.length - k}` }], zoneW, zoneH, dMax);
      }
      if (!f) continue;
      out.push({ box, at: { x: p.x - zoneW / 2, y: p.y + bh / 2 - zoneH - 5 + (small ? 2 : 0) }, flow: f });
    }
    return out;
  }, [lay, people, game.mine, tail, over]);

  const awakeLook = game.awake || over;
  // How far the gold life has run up the body: to the furthest scale anyone has passed, or all the way.
  const lit = !lay ? 0 : awakeLook ? lay.total : lay.at[Math.min(maxAt, BODY)];
  const pct = Math.min(1, game.energy / Math.max(1, wakeAt));
  const tailWord = tail > 0 ? `, tail grown to ${tail} extra scales` : '';

  return (
    <div className={`sp-scene ${fx.shake ? 'sp-scene--shake' : ''} ${over ? 'sp-scene--over' : ''} ${awakeLook ? 'sp-scene--awake' : ''}`} ref={ref}>
      {lay && (
        <svg className="sp-svg" width={lay.w} height={lay.h} viewBox={`0 0 ${lay.w} ${lay.h}`} role="img"
          aria-label={`Serpent Chain: ${people.length} pupils climbing the serpent${tailWord}`}>
          <defs>
            <linearGradient id="sp-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f9a78" /><stop offset="1" stopColor="#0a5540" /></linearGradient>
            <linearGradient id="sp-facelit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2a0" /><stop offset="1" stopColor="#4de8a8" /></linearGradient>
            <linearGradient id="sp-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9aa89d" /><stop offset="1" stopColor="#4d5c55" /></linearGradient>
            <radialGradient id="sp-head" cx="40%" cy="40%" r="75%"><stop offset="0" stopColor="#4ff0b0" /><stop offset="1" stopColor="#0b6b4c" /></radialGradient>
            <filter id="sp-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
            <radialGradient id="sp-halo"><stop offset="0" stopColor="#ffe14d" stopOpacity="0.55" /><stop offset="1" stopColor="#ffe14d" stopOpacity="0" /></radialGradient>
            <filter id="sp-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={Math.max(2, lay.th * 0.06)} /></filter>
            {ART.skin && (
              <pattern id="sp-skin" patternUnits="userSpaceOnUse" width={lay.th * 1.4} height={lay.th * 1.4}>
                <image href={ART.skin} width={lay.th * 1.4} height={lay.th * 1.4} preserveAspectRatio="none" />
              </pattern>
            )}
          </defs>

          <g className={`sp-serpent ${over ? 'sp-serpent--rise' : ''}`}>
            {/* the tail tip, behind the start tablet */}
            {ART.tail && (
              <g transform={`translate(${lay.nodes[0].x - lay.bw * 0.32} ${lay.nodes[0].y + lay.bh * 0.32})`}>
                <g className="sp-tailtip">
                  <image href={ART.tail} x={-lay.th * 2.1} y={-lay.th * 0.75} width={lay.th * 2.6} height={lay.th * 1.5} preserveAspectRatio="xMaxYMid meet" />
                </g>
              </g>
            )}

            {/* the body */}
            <g className="sp-bodyg" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={lay.path} stroke="#6dffcf" strokeOpacity={awakeLook ? 0.55 : 0.22} strokeWidth={lay.th + 26} filter="url(#sp-blur)" className="sp-body__aura" />
              <path d={lay.path} stroke="#021a14" strokeWidth={lay.th + 10} />
              {ART.skin ? (
                <>
                  <path d={lay.path} stroke="url(#sp-skin)" strokeWidth={lay.th} />
                  <path d={lay.path} stroke="#021a14" strokeOpacity="0.45" strokeWidth={lay.th} strokeDasharray={`1 ${lay.th * 0.55}`} className="sp-body__ribs" />
                </>
              ) : (
                <>
                  <path d={lay.path} stroke="#0f7a58" strokeWidth={lay.th} />
                  <path d={lay.path} stroke="#27b886" strokeWidth={lay.th * 0.7} />
                  <path d={lay.path} stroke="#c5ffe6" strokeOpacity="0.4" strokeWidth={lay.th * 0.9} strokeDasharray={`2 ${lay.th * 0.3}`} />
                </>
              )}
              {/* roundness: dark edges, a soft shine down the middle */}
              <path d={lay.path} stroke="#00140e" strokeOpacity="0.38" strokeWidth={lay.th} />
              <path d={lay.path} stroke="url(#sp-skin)" strokeOpacity={ART.skin ? 1 : 0} strokeWidth={lay.th * 0.74} />
              {!ART.skin && <path d={lay.path} stroke="#27b886" strokeWidth={lay.th * 0.7} />}
              <path d={lay.path} stroke="#eafff4" strokeOpacity="0.2" strokeWidth={lay.th * 0.22} filter="url(#sp-soft)" />
              {/* the life running up the serpent: gold as far as the furthest pupil, all the way when awake */}
              <path d={lay.path} stroke="#ffd84d" strokeWidth={lay.th * 0.5} filter="url(#sp-soft)" className="sp-life"
                strokeDasharray={`${lit} ${lay.total + 10}`} style={{ opacity: lit > 0 ? 0.42 : 0 }} />
              <path d={lay.path} stroke="#fff6c4" strokeWidth={Math.max(3, lay.th * 0.07)} strokeDasharray={`${lay.th * 0.18} ${lay.th * 0.9}`} className="sp-flow"
                style={{ opacity: awakeLook ? 0.9 : 0.35, animationDuration: awakeLook ? '1.6s' : '4s' }} />
            </g>

            {/* start tablet */}
            <g transform={`translate(${lay.nodes[0].x} ${lay.nodes[0].y})`} className="sp-tablet">
              {ART.tablet ? (
                <image href={ART.tablet} x={-lay.bw * 0.56} y={-lay.bh * 0.66} width={lay.bw * 1.12} height={lay.bh * 1.32} preserveAspectRatio="none" />
              ) : (
                <>
                  <rect x={-lay.bw * 0.5} y={-lay.bh * 0.58} width={lay.bw} height={lay.bh * 1.16} rx={lay.bh * 0.18} fill="url(#sp-stone)" stroke="#1d2a25" strokeWidth="4" />
                  <path d={`M ${-lay.bw * 0.3} ${-lay.bh * 0.58} l ${lay.bw * 0.08} ${lay.bh * 0.2} l ${-lay.bw * 0.05} ${lay.bh * 0.15} M ${lay.bw * 0.34} ${lay.bh * 0.58} l ${-lay.bw * 0.06} ${-lay.bh * 0.25}`} stroke="#2c3a34" strokeWidth="3" fill="none" strokeLinecap="round" />
                </>
              )}
              <text y={-lay.bh * 0.34} textAnchor="middle" dominantBaseline="central" className="sp-tablet__word" style={{ fontSize: lay.bh * 0.2 }}>START</text>
              <text y={lay.bh * 0.12} textAnchor="middle" dominantBaseline="central" className="sp-tablet__num" style={{ fontSize: Math.min(lay.bh * 0.62, (lay.bw * 0.86) / (String(chain.start).length * 0.6)) }}>{chain.start}</text>
            </g>

            {/* the twelve scales */}
            {chain.steps.slice(0, BODY).map((s, i) => (
              <Scale key={i} i={i} p={lay.nodes[i + 1]} bw={lay.bw} bh={lay.bh} text={stepText(s)} lit={maxAt > i || over} over={over}
                answer={over && revealed > i ? chain.values[i + 1] : null} />
            ))}

            {/* the head */}
            <g transform={`translate(${lay.head.x} ${lay.head.y}) scale(${lay.head.dir} 1)`}><g className={`sp-headg ${roaring ? 'sp-headg--roar' : ''}`}>
              {ART.burst && (awakeLook || fx.headPulse > 0) && (
                <image key={`burst${fx.headPulse}${awakeLook}`} href={ART.burst} x={-lay.th * 2.6} y={-lay.th * 2.6} width={lay.th * 5.2} height={lay.th * 5.2} className="sp-burst" />
              )}
              {awakeLook && <circle cx={lay.head.hw * 0.3} r={lay.th * 1.4} fill="url(#sp-halo)" className="sp-head__halo" />}
              {ART.asleep && ART.awake ? (
                <g className="sp-headp">
                  <image href={ART.asleep} x={-lay.th * 0.6} y={-lay.th * 1.15} width={lay.th * 1.7} height={lay.th * 1.65} preserveAspectRatio="xMinYMax meet"
                    className="sp-headp__img" style={{ opacity: awakeLook ? 0 : 1 }} />
                  <image href={ART.awake} x={-lay.th * 0.6} y={-lay.th * 1.15} width={lay.th * 1.7} height={lay.th * 1.65} preserveAspectRatio="xMinYMax meet"
                    className="sp-headp__img sp-headp__img--awake" style={{ opacity: awakeLook ? 1 : 0 }} />
                </g>
              ) : (
                <>
                  <g className="sp-tongue" stroke="#ff4d6d" strokeWidth={Math.max(3, lay.head.hh * 0.1)} fill="none" strokeLinecap="round">
                    <path d={`M ${lay.head.hw * 0.85} 0 H ${lay.head.hw + lay.head.hh * 0.9} M ${lay.head.hw + lay.head.hh * 0.9} 0 l ${lay.head.hh * 0.38} ${-lay.head.hh * 0.24} M ${lay.head.hw + lay.head.hh * 0.9} 0 l ${lay.head.hh * 0.38} ${lay.head.hh * 0.24}`} />
                  </g>
                  <path d={`M ${-lay.head.hw * 0.7} ${-lay.head.hh * 0.55} C ${-lay.head.hw * 0.1} ${-lay.head.hh * 1.25} ${lay.head.hw * 0.9} ${-lay.head.hh * 0.8} ${lay.head.hw} 0 C ${lay.head.hw * 0.9} ${lay.head.hh * 0.8} ${-lay.head.hw * 0.1} ${lay.head.hh * 1.25} ${-lay.head.hw * 0.7} ${lay.head.hh * 0.55} Z`}
                    fill="url(#sp-head)" stroke="#032b21" strokeWidth={Math.max(3, lay.head.hh * 0.07)} strokeLinejoin="round" />
                  <circle cx={lay.head.hw * 0.86} cy={-lay.head.hh * 0.14} r={lay.head.hh * 0.05} fill="#032b21" />
                  <circle cx={lay.head.hw * 0.86} cy={lay.head.hh * 0.14} r={lay.head.hh * 0.05} fill="#032b21" />
                  <Eye x={lay.head.hw * 0.18} y={-lay.head.hh * 0.5} r={lay.head.hh * 0.19} open={awakeLook} dir={1} />
                  <Eye x={lay.head.hw * 0.18} y={lay.head.hh * 0.5} r={lay.head.hh * 0.19} open={awakeLook} dir={1} />
                </>
              )}
              {!awakeLook && (
                <g className="sp-zzz sp-zzz--head" fill="#d9fff0" transform={`scale(${lay.head.dir} 1)`}>
                  <text x={lay.head.dir * lay.head.hw * 0.4} y={-lay.th * 0.9} fontSize={lay.th * 0.34} fontWeight="900">z</text>
                  <text x={lay.head.dir * lay.head.hw * 0.4 + lay.th * 0.3} y={-lay.th * 1.2} fontSize={lay.th * 0.26} fontWeight="900">z</text>
                  <text x={lay.head.dir * lay.head.hw * 0.4 + lay.th * 0.55} y={-lay.th * 1.45} fontSize={lay.th * 0.2} fontWeight="900">z</text>
                </g>
              )}
            </g></g>

            {/* the bonus tail */}
            {lay.tail && (
              <g className={`sp-tail ${fx.tailPulse ? 'sp-tail--whoosh' : ''}`} key={`tail${fx.tailPulse}`}>
                <path d={lay.tail.link} className="sp-link" fill="none" />
                <text x={lay.tail.label.x} y={lay.tail.label.y} textAnchor="middle" className="sp-tail__label">Bonus tail</text>
                <path d={lay.tail.boxes.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="#052f27" strokeWidth={lay.tail.bh * 1.05} strokeLinecap="round" strokeLinejoin="round" />
                <path d={lay.tail.boxes.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="#8cffe0" strokeOpacity="0.5" strokeWidth={lay.tail.bh * 0.5} strokeLinecap="round" strokeLinejoin="round" className="sp-tail__glow" />
                {lay.tail.curl && (
                  <path className="sp-curl" transform={`translate(${lay.tail.curl.x} ${lay.tail.curl.y})`} fill="none" stroke="#8cffe0" strokeWidth={Math.max(3, lay.tail.bh * 0.14)} strokeLinecap="round"
                    d={`M ${-lay.tail.bw * 0.5} 0 C ${-lay.tail.bw * 0.2} ${lay.tail.bh * 0.3} ${lay.tail.bw * 0.2} ${lay.tail.bh * 0.3} ${lay.tail.bw * 0.2} 0 C ${lay.tail.bw * 0.2} ${-lay.tail.bh * 0.2} ${-lay.tail.bw * 0.05} ${-lay.tail.bh * 0.15} ${0} ${-lay.tail.bh * 0.02}`} />
                )}
                {chain.steps.slice(BODY, BODY + tail).map((s, j) => (
                  <Scale key={j} i={j} small p={lay.tail!.boxes[j]} bw={lay.tail!.bw} bh={lay.tail!.bh} text={stepText(s)} lit={maxAt > BODY + j || over} over={false} answer={null} />
                ))}
              </g>
            )}

            {/* the answer-roar */}
            {roaring && (
              <g transform={`translate(${lay.head.x} ${Math.max(lay.head.y - lay.head.hh * 1.9, 70)})`}><g className="sp-roar">
                <ellipse rx={Math.min(lay.w * 0.3, 230)} ry={lay.th * 0.62} fill="#fff6c9" stroke="#ff9f1c" strokeWidth="6" />
                <text textAnchor="middle" dominantBaseline="central" className="sp-roar__num" style={{ fontSize: Math.min(lay.th * 0.95, lay.w * 0.12) }}>{chain.values[BODY]}</text>
              </g></g>
            )}
          </g>

          {/* the gems */}
          {gems && gems.flatMap(({ at, flow: f }) => f.pos.map((q) => (
            <g key={q.id} className="sp-tok" style={{ transform: `translate(${at.x + q.x}px, ${at.y + q.y}px)` }}>
              <g className={fx.hopping.has(q.id) ? 'sp-hop' : undefined}>
                {q.id.startsWith('more:') ? null : <Gem colour={colour[q.id] ?? '#fff'} d={f.d} />}
                {q.name && (
                  <text x={q.id.startsWith('more:') ? -f.d * 0.4 : f.d * 0.72} y={0} dominantBaseline="central" className="sp-tok__name" style={{ fontSize: f.fs, strokeWidth: f.fs * 0.22 }}>{q.name}</text>
                )}
              </g>
            </g>
          )))}
        </svg>
      )}

      {fx.banner && <div className="sp-banner" key={fx.banner.key} role="status">{fx.banner.text}</div>}

      <div className="sp-hud">
        <span className="sp-hud__word">{game.awake ? 'The serpent is awake!' : 'Wake the serpent!'}</span>
        <span className="sp-hud__bar" role="progressbar" aria-valuemin={0} aria-valuemax={wakeAt} aria-valuenow={Math.min(game.energy, wakeAt)} aria-label="Serpent stirring">
          <span className="sp-hud__fill" style={{ transform: `scaleX(${game.awake ? 1 : pct})` }} />
        </span>
        <span className="sp-hud__n">{game.heads.length > 0 ? `${game.heads.length} at the head` : 'Nobody at the head yet'}</span>
      </div>
    </div>
  );
}
