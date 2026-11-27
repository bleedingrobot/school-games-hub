/**
 * Draws a question's small picture (shared/maths/figure.ts) as SVG. Decorative for screen readers: the question's `spoken`
 * text already says everything in the picture. A '?' label is drawn highlighted, as the thing being asked.
 */
import type { ReactNode } from 'react';
import type { Figure as FigureSpec, SpinnerColour } from '../../shared/maths/figure';

const W = 240;
const H = 150;

function Label({ x, y, text, anchor = 'middle' }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }) {
  if (!text) return null;
  const ask = text.includes('?');
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className={ask ? 'fig__label fig__label--ask' : 'fig__label'}>
      {text}
    </text>
  );
}

/** A small arc at (cx, cy) from angle a to b (degrees, 0 = east, counter-clockwise as on paper: y flipped). */
function Arc({ cx, cy, r, a, b }: { cx: number; cy: number; r: number; a: number; b: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(a));
  const y1 = cy - r * Math.sin(rad(a));
  const x2 = cx + r * Math.cos(rad(b));
  const y2 = cy - r * Math.sin(rad(b));
  const large = ((b - a + 360) % 360) > 180 ? 1 : 0;
  return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`} className="fig__arc" />;
}

/** Where to write a label for the angle between directions a and b at (cx, cy). */
const mid = (cx: number, cy: number, r: number, a: number, b: number) => {
  const m = (((a + ((b - a + 360) % 360) / 2) % 360) * Math.PI) / 180;
  return { x: cx + r * Math.cos(m), y: cy - r * Math.sin(m) };
};

/** Angles fanned round a point, from direction `start`, each of the given sizes (degrees). */
function Fan({ cx, cy, sizes, labels, start }: { cx: number; cy: number; sizes: number[]; labels: string[]; start: number }) {
  const out: ReactNode[] = [];
  let at = start;
  const rays = [at];
  sizes.forEach((s, i) => {
    const next = at + s;
    out.push(<Arc key={`a${i}`} cx={cx} cy={cy} r={18 + (i % 2) * 4} a={at} b={next} />);
    const p = mid(cx, cy, 44, at, next);
    out.push(<Label key={`l${i}`} x={p.x} y={p.y} text={labels[i] ?? ''} />);
    at = next;
    rays.push(at);
  });
  return (
    <>
      {rays.map((d, i) => (
        <line key={`r${i}`} x1={cx} y1={cy} x2={cx + 95 * Math.cos((d * Math.PI) / 180)} y2={cy - 95 * Math.sin((d * Math.PI) / 180)} className="fig__line" />
      ))}
      {out}
    </>
  );
}

/** Sizes to draw labelled angles at: the numbers in the labels, and the rest shared out of what's left. */
function drawSizes(labels: string[], total: number): number[] {
  const nums = labels.map((l) => (/^(\d+)°$/.exec(l) ? Number(/^(\d+)/.exec(l)![1]) : null));
  const known = nums.reduce<number>((s, n) => s + (n ?? 0), 0);
  const unknown = nums.filter((n) => n === null).length;
  const each = unknown ? Math.max(15, (total - known) / unknown) : 0;
  const sizes = nums.map((n) => n ?? each);
  const sum = sizes.reduce((s, n) => s + n, 0);
  return sizes.map((n) => (n * total) / sum);
}

function Tick({ x1, y1, x2, y2, count = 1 }: { x1: number; y1: number; x2: number; y2: number; count?: number }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * 6;
  const ny = ((x2 - x1) / len) * 6;
  const dx = ((x2 - x1) / len) * 4;
  const dy = ((y2 - y1) / len) * 4;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const o = (i - (count - 1) / 2) * 1;
        return <line key={i} x1={mx - nx + dx * o} y1={my - ny + dy * o} x2={mx + nx + dx * o} y2={my + ny + dy * o} className="fig__line" />;
      })}
    </>
  );
}

function Body({ f }: { f: FigureSpec }) {
  switch (f.kind) {
    case 'triangle': {
      const [a, b, c] = f.angles;
      const A = { x: 40, y: 130 };
      const B = { x: 200, y: 130 };
      const C = { x: f.equal ? 120 : 90, y: 22 };
      return (
        <>
          <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`} className="fig__shape" />
          {f.equal && <Tick x1={A.x} y1={A.y} x2={C.x} y2={C.y} />}
          {f.equal && <Tick x1={B.x} y1={B.y} x2={C.x} y2={C.y} />}
          {f.equal === 'three' && <Tick x1={A.x} y1={A.y} x2={B.x} y2={B.y} />}
          <Label x={A.x + 34} y={A.y - 12} text={a} />
          <Label x={B.x - 44} y={B.y - 12} text={b} />
          <Label x={C.x} y={C.y + 26} text={c} />
          <Label x={120} y={143} text="Not to scale" />
        </>
      );
    }
    case 'line': {
      const sizes = drawSizes(f.angles, 180);
      return (
        <>
          <line x1={20} y1={120} x2={220} y2={120} className="fig__line" />
          <Fan cx={120} cy={120} sizes={sizes} labels={f.angles} start={0} />
        </>
      );
    }
    case 'point':
      return <Fan cx={120} cy={75} sizes={drawSizes(f.angles, 360)} labels={f.angles} start={20} />;
    case 'crossing': {
      // Drawn at the real angle: the wedges to the right and left (the opposite pair) are the angle, the others 180° less.
      const given = f.angles.map((l) => /^(\d+)°$/.exec(l)).find((m) => m);
      const deg = Math.min(170, Math.max(10, given ? Number(given[1]) : 70));
      const half = (deg * Math.PI) / 360;
      const len = Math.min(100, 62 / Math.sin(half));
      const dx = len * Math.cos(half);
      const dy = len * Math.sin(half);
      // Far enough out for the wedge to be wide enough for its label.
      const lab = Math.min(len - 8, Math.max(40, 34 / (2 * Math.tan(half))));
      return (
        <>
          <line x1={120 - dx} y1={75 + dy} x2={120 + dx} y2={75 - dy} className="fig__line" />
          <line x1={120 - dx} y1={75 - dy} x2={120 + dx} y2={75 + dy} className="fig__line" />
          {/* The two opposite angles: the same arc and tick on each. */}
          <Arc cx={120} cy={75} r={18} a={-deg / 2} b={deg / 2} />
          <Arc cx={120} cy={75} r={18} a={180 - deg / 2} b={180 + deg / 2} />
          <line x1={138} y1={75} x2={146} y2={75} className="fig__arc" />
          <line x1={102} y1={75} x2={94} y2={75} className="fig__arc" />
          <Label x={120 + lab} y={75} text={f.angles[0]} />
          <Label x={120 - lab} y={75} text={f.angles[1]} />
        </>
      );
    }
    case 'right-angle': {
      const sizes = drawSizes(f.angles, 90);
      return (
        <>
          <Fan cx={60} cy={130} sizes={sizes} labels={f.angles} start={0} />
          <rect x={60} y={118} width={12} height={12} className="fig__corner" />
        </>
      );
    }
    case 'rectangle': {
      // Both sides labelled the same ('?' and '?', or '5 cm' and '5 cm') is a square.
      const square = f.width !== '' && f.width === f.height;
      const x = square ? 72 : 50;
      const w = square ? 96 : 140;
      const h = square ? 96 : 84;
      const y = square ? 18 : 30;
      // Whole-number sides up to 12: draw the unit squares, so the rows and columns can be read off the picture.
      const side = (t: string) => {
        const m = /^(\d+)(?: [a-z]+)?$/.exec(t);
        return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? Number(m[1]) : 0;
      };
      const cols = side(f.width);
      const rows = side(f.height);
      if (cols && rows && !/^P\b/.test(f.inside ?? '')) {
        const cell = Math.min(130 / cols, 90 / rows);
        const gw = cols * cell;
        const gh = rows * cell;
        const gx = (240 - gw) / 2;
        const gy = 30 + (90 - gh) / 2;
        return (
          <>
            <rect x={gx} y={gy} width={gw} height={gh} className="fig__shape" />
            {Array.from({ length: cols - 1 }, (_, i) => (
              <line key={`c${i}`} x1={gx + (i + 1) * cell} y1={gy} x2={gx + (i + 1) * cell} y2={gy + gh} className="fig__gridline" />
            ))}
            {Array.from({ length: rows - 1 }, (_, i) => (
              <line key={`r${i}`} x1={gx} y1={gy + (i + 1) * cell} x2={gx + gw} y2={gy + (i + 1) * cell} className="fig__gridline" />
            ))}
            <Label x={gx + gw / 2} y={gy + gh + 16} text={f.width} />
            <Label x={gx - 14} y={gy + gh / 2} text={f.height} anchor="end" />
            {f.inside !== undefined && <Label x={gx + gw / 2} y={gy + gh / 2} text={f.inside} />}
          </>
        );
      }
      return (
        <>
          <rect x={x} y={y} width={w} height={h} className="fig__shape" />
          <Label x={x + w / 2} y={y + h + 16} text={f.width} />
          <Label x={x - 14} y={y + h / 2} text={f.height} anchor="end" />
          <Label x={x + w / 2} y={y + h / 2} text={f.inside ?? ''} />
        </>
      );
    }
    case 'triangle-area':
      if (f.right)
        return (
          <>
            <rect x={60} y={24} width={140} height={94} className="fig__dash" />
            <polygon points="60,118 200,118 60,24" className="fig__shape" />
            <polyline points="60,106 72,106 72,118" className="fig__line" fill="none" />
            <Label x={130} y={134} text={f.base} />
            <Label x={54} y={74} text={f.height} anchor="end" />
            <Label x={100} y={96} text={f.inside ?? ''} />
          </>
        );
      return (
        <>
          <rect x={40} y={24} width={160} height={94} className="fig__dash" />
          <polygon points="40,118 200,118 90,24" className="fig__shape" />
          <line x1={90} y1={24} x2={90} y2={118} className="fig__dash" />
          <Label x={120} y={134} text={f.base} />
          <Label x={96} y={74} text={f.height} anchor="start" />
          <Label x={148} y={96} text={f.inside ?? ''} />
        </>
      );
    case 'parallelogram':
      return (
        <>
          <polygon points="40,118 170,118 205,30 75,30" className="fig__shape" />
          <line x1={75} y1={30} x2={75} y2={118} className="fig__dash" />
          <Label x={105} y={134} text={f.base} />
          <Label x={69} y={74} text={f.height} anchor="end" />
          <Label x={130} y={74} text={f.inside ?? ''} />
        </>
      );
    case 'trapezium':
      return (
        <>
          <polygon points="30,118 210,118 165,32 75,32" className="fig__shape" />
          <line x1={75} y1={32} x2={75} y2={118} className="fig__dash" />
          <Label x={120} y={18} text={f.top} />
          <Label x={120} y={134} text={f.bottom} />
          <Label x={69} y={75} text={f.height} anchor="end" />
          <Label x={130} y={78} text={f.inside ?? ''} />
        </>
      );
    case 'cuboid': {
      const w = f.cube ? 80 : 110;
      const h = f.cube ? 80 : 60;
      const d = 30;
      const x = 50;
      const y = 130 - h;
      // Whole-number sides up to 5: faint lines show the layers and the little cubes. A cube only labels its length.
      const unit = (t: string) => {
        const m = /^(\d+)(?: [a-z]+)?$/.exec(t);
        return m && Number(m[1]) >= 1 && Number(m[1]) <= 5 ? Number(m[1]) : 0;
      };
      const nl = unit(f.length);
      const nw = f.cube ? nl : unit(f.width);
      const nh = f.cube ? nl : unit(f.height);
      const cells = nl && nw && nh;
      const range = (n: number) => Array.from({ length: n - 1 }, (_, i) => i + 1);
      return (
        <>
          <rect x={x} y={y} width={w} height={h} className="fig__shape" />
          <polygon points={`${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}`} className="fig__shape fig__shape--top" />
          <polygon points={`${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + h - d} ${x + w},${y + h}`} className="fig__shape fig__shape--side" />
          {cells && (
            <g>
              {range(nh).map((i) => <line key={`fh${i}`} x1={x} y1={y + (i * h) / nh} x2={x + w} y2={y + (i * h) / nh} className="fig__gridline" />)}
              {range(nl).map((i) => <line key={`fv${i}`} x1={x + (i * w) / nl} y1={y} x2={x + (i * w) / nl} y2={y + h} className="fig__gridline" />)}
              {range(nl).map((i) => <line key={`tl${i}`} x1={x + (i * w) / nl} y1={y} x2={x + (i * w) / nl + d} y2={y - d} className="fig__gridline" />)}
              {range(nw).map((i) => <line key={`tw${i}`} x1={x + (i * d) / nw} y1={y - (i * d) / nw} x2={x + w + (i * d) / nw} y2={y - (i * d) / nw} className="fig__gridline" />)}
              {range(nh).map((i) => <line key={`sh${i}`} x1={x + w} y1={y + (i * h) / nh} x2={x + w + d} y2={y - d + (i * h) / nh} className="fig__gridline" />)}
              {range(nw).map((i) => <line key={`sw${i}`} x1={x + w + (i * d) / nw} y1={y - (i * d) / nw} x2={x + w + (i * d) / nw} y2={y + h - (i * d) / nw} className="fig__gridline" />)}
            </g>
          )}
          <Label x={x + w / 2} y={142} text={f.length} />
          {!f.cube && <Label x={x + w + d / 2 + 14} y={y + h - d / 2 + 4} text={f.width} anchor="start" />}
          {!f.cube && <Label x={x - 8} y={y + h / 2} text={f.height} anchor="end" />}
        </>
      );
    }
    case 'prism':
      return (
        <>
          <polygon points="40,128 120,128 80,60" className="fig__shape" />
          <polygon points="80,60 160,30 200,98 120,128" className="fig__shape fig__shape--side" />
          <line x1={120} y1={128} x2={200} y2={98} className="fig__line" />
          <line x1={80} y1={60} x2={80} y2={128} className="fig__dash" />
          <Label x={80} y={142} text={f.base} />
          <Label x={74} y={100} text={f.height} anchor="end" />
          <Label x={176} y={126} text={f.length} anchor="start" />
        </>
      );
    case 'circle':
      return (
        <>
          <circle cx={120} cy={75} r={58} className="fig__shape" />
          <circle cx={120} cy={75} r={2.5} className="fig__dot" />
          {f.diameter !== undefined && <line x1={62} y1={75} x2={178} y2={75} className="fig__line" />}
          {f.radius !== undefined && <line x1={120} y1={75} x2={161} y2={34} className="fig__line" />}
          {f.diameter !== undefined && <Label x={120} y={90} text={f.diameter} />}
          {f.radius !== undefined && <Label x={134} y={52} text={f.radius} anchor="end" />}
        </>
      );
    case 'polygon': {
      const n = Math.max(3, Math.min(12, Math.round(f.sides)));
      const pts = Array.from({ length: n }, (_, i) => {
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / n + Math.PI / n;
        return { x: 105 + 55 * Math.cos(t), y: 78 + 55 * Math.sin(t) };
      });
      // The side from the bottom-right corner carried on, to show one exterior angle.
      const [p, q] = [pts[n - 1], pts[0]];
      const ex = { x: q.x + (q.x - p.x) * 0.9, y: q.y + (q.y - p.y) * 0.9 };
      // No label: an angle-sum question, so show the triangles from one corner instead of the exterior angle.
      if (!f.label) {
        return (
          <>
            <polygon points={pts.map((o) => `${o.x},${o.y}`).join(' ')} className="fig__shape" />
            {pts.slice(2, n - 1).map((o, i) => <line key={i} x1={q.x} y1={q.y} x2={o.x} y2={o.y} className="fig__line" />)}
          </>
        );
      }
      return (
        <>
          <polygon points={pts.map((o) => `${o.x},${o.y}`).join(' ')} className="fig__shape" />
          <line x1={q.x} y1={q.y} x2={ex.x} y2={ex.y} className="fig__dash" />
          <Label x={q.x + 26} y={q.y - 4} text={f.label ?? ''} anchor="start" />
        </>
      );
    }
    case 'compass': {
      const dirs: Record<string, number> = { N: 90, NE: 45, E: 0, SE: -45, S: -90, SW: -135, W: 180, NW: 135 };
      const cx = 120;
      const cy = 75;
      return (
        <>
          {Object.entries(dirs).map(([name, d]) => {
            const r = (d * Math.PI) / 180;
            const main = name.length === 1;
            return (
              <g key={name}>
                <line x1={cx} y1={cy} x2={cx + 48 * Math.cos(r)} y2={cy - 48 * Math.sin(r)} className={main ? 'fig__line' : 'fig__dash'} />
                <Label x={cx + 62 * Math.cos(r)} y={cy - 62 * Math.sin(r)} text={name} />
              </g>
            );
          })}
          {f.to !== undefined && dirs[f.from] !== undefined && dirs[f.to] !== undefined && (
            <Arc cx={cx} cy={cy} r={26} a={dirs[f.to]} b={dirs[f.from]} />
          )}
          {f.to === undefined && dirs[f.from] !== undefined && (() => {
            // The way you face: a thick arrow from the middle, with a little person-dot at the centre.
            const r = (dirs[f.from] * Math.PI) / 180;
            const [ux, uy] = [Math.cos(r), -Math.sin(r)];
            const tip = { x: cx + 42 * ux, y: cy + 42 * uy };
            const back = { x: cx + 30 * ux, y: cy + 30 * uy };
            return (
              <g className="fig__facing">
                <line x1={cx} y1={cy} x2={back.x} y2={back.y} />
                <polygon points={`${tip.x},${tip.y} ${back.x - 7 * uy},${back.y + 7 * ux} ${back.x + 7 * uy},${back.y - 7 * ux}`} />
                <circle cx={cx} cy={cy} r={5} />
              </g>
            );
          })()}
        </>
      );
    }
    case 'shape': {
      const reg = (n: number, r = 58) =>
        Array.from({ length: n }, (_, i) => {
          const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          return `${120 + r * Math.cos(t)},${75 + r * Math.sin(t)}`;
        }).join(' ');
      const table: Record<string, string> = {
        square: '72,19 168,19 168,115 72,115',
        rectangle: '45,35 195,35 195,115 45,115',
        rhombus: '120,12 190,75 120,138 50,75',
        kite: '120,10 175,60 120,140 65,60',
        parallelogram: '40,115 150,115 200,35 90,35',
        trapezium: '30,115 210,115 165,35 75,35',
        equilateral: '40,120 200,120 120,31',
        isosceles: '55,125 185,125 120,22',
        scalene: '35,125 205,125 80,25',
        'right-triangle': '55,125 195,125 55,25',
        pentagon: reg(5),
        hexagon: reg(6),
        octagon: reg(8),
      };
      const points = table[f.name] ?? table.square;
      if (!f.side) return <polygon points={points} className="fig__shape" />;
      // Label the lowest side (its middle nearest the bottom), just outside the shape.
      const pts = points.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
      const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length;
      const cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
      const mids = pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number];
      });
      const [mx, my] = mids.reduce((best, m) => (m[1] > best[1] + 0.5 ? m : best));
      const len = Math.hypot(mx - cx, my - cy) || 1;
      const lx = mx + ((mx - cx) / len) * 14;
      const ly = Math.min(H - 6, my + ((my - cy) / len) * 12);
      return (
        <>
          <polygon points={points} className="fig__shape" />
          <Label x={lx} y={ly} text={f.side} anchor={Math.abs(mx - cx) < 4 ? 'middle' : mx > cx ? 'start' : 'end'} />
        </>
      );
    }
    case 'grid':
      return null; // Drawn bigger, in its own picture (GridFigure).
    case 'spinner': {
      const n = Math.max(2, Math.min(10, Math.round(f.parts)));
      const at = (i: number) => {
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return { x: 120 + 58 * Math.cos(t), y: 75 + 58 * Math.sin(t) };
      };
      return (
        <>
          <circle cx={120} cy={75} r={58} className="fig__shape" />
          {Array.from({ length: Math.min(n, Math.max(0, Math.round(f.shaded))) }, (_, i) => {
            const a = at(i);
            const b = at(i + 1);
            return <path key={`s${i}`} d={`M 120 75 L ${a.x} ${a.y} A 58 58 0 0 1 ${b.x} ${b.y} Z`} className="fig__fill" style={f.colour ? { fill: SPINNER_FILL[f.colour] } : undefined} />;
          })}
          {Array.from({ length: n }, (_, i) => (
            <line key={i} x1={120} y1={75} x2={at(i).x} y2={at(i).y} className="fig__line" />
          ))}
        </>
      );
    }
    case 'angle': {
      // One angle opening anticlockwise from a flat arm; a right angle gets the little square.
      const d = Math.max(1, Math.min(359, Math.round(f.degrees)));
      const cx = d > 180 ? 120 : 70;
      const cy = d > 180 ? 75 : d > 90 ? 120 : 125;
      const end = { x: cx + 95 * Math.cos((d * Math.PI) / 180), y: cy - 95 * Math.sin((d * Math.PI) / 180) };
      return (
        <>
          <line x1={cx} y1={cy} x2={cx + 100} y2={cy} className="fig__line" />
          <line x1={cx} y1={cy} x2={end.x} y2={end.y} className="fig__line" />
          {d === 90 ? <path d={`M ${cx + 16} ${cy} L ${cx + 16} ${cy - 16} L ${cx} ${cy - 16}`} className="fig__corner" /> : <Arc cx={cx} cy={cy} r={22} a={0} b={d} />}
        </>
      );
    }
    case 'clock': {
      const hour = ((Math.round(f.hour) % 12) + 12) % 12;
      const minute = ((Math.round(f.minute) % 60) + 60) % 60;
      const hand = (turns: number, len: number) => {
        const t = turns * 2 * Math.PI - Math.PI / 2;
        return { x: 120 + len * Math.cos(t), y: 75 + len * Math.sin(t) };
      };
      const short = hand((hour + minute / 60) / 12, 28);
      const long = hand(minute / 60, 44);
      return (
        <>
          <circle cx={120} cy={75} r={68} className="fig__shape" />
          {Array.from({ length: 12 }, (_, i) => {
            const at = hand((i + 1) / 12, 56);
            return (
              <text key={i} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" className="fig__num">
                {i + 1}
              </text>
            );
          })}
          <line x1={120} y1={75} x2={short.x} y2={short.y} className="fig__hand fig__hand--short" />
          <line x1={120} y1={75} x2={long.x} y2={long.y} className="fig__hand" />
          <circle cx={120} cy={75} r={4} className="fig__dot" />
        </>
      );
    }
  }
}

/** Soft fills for the spinner colours, dark enough to read against white and light enough for the lines to show. */
const SPINNER_FILL: Record<SpinnerColour, string> = { red: '#f87171', blue: '#60a5fa', green: '#4ade80', yellow: '#facc15', purple: '#c084fc', orange: '#fb923c' };

/** Estimated width of a label at the figure's label size (15px, bold). */
const labelWidth = (text: string) => text.length * 8.4;

type Box = { x1: number; y1: number; x2: number; y2: number };
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));

/**
 * A coordinate grid, big enough to read (James, 26 Nov 2026: "this graph is unreadable"): bold x and y axes with their
 * names and arrows, every number on small grids, big dots, and each dot's label put in the corner around it that clashes
 * least with the other dots, labels and the axes.
 */
function GridFigure({ f }: { f: Extract<FigureSpec, { kind: 'grid' }> }) {
  const n = Math.max(4, Math.min(10, Math.round(f.size)));
  const span = 220;
  const step = span / n;
  const ox = 46;
  const oy = 250;
  const at = (p: { x: number; y: number }) => ({ x: ox + p.x * step, y: oy - p.y * step });
  // Every number, so a point can be read straight off (the grid is big enough now).
  const every = 1;
  // Places already taken: the dots, the axis numbers and the axes themselves.
  const taken: Box[] = [
    { x1: ox - 30, y1: oy - span - 10, x2: ox + 3, y2: oy + 30 },
    { x1: ox - 30, y1: oy - 3, x2: ox + span + 10, y2: oy + 30 },
    ...f.points.map((p) => {
      const c = at(p);
      return { x1: c.x - 8, y1: c.y - 8, x2: c.x + 8, y2: c.y + 8 };
    }),
  ];
  const labels = f.points.map((p) => {
    const text = p.label ?? '';
    if (!text) return null;
    const c = at(p);
    const w = labelWidth(text);
    const h = 18;
    const tries = [
      { dx: 10, dy: -14, anchor: 'start' as const },
      { dx: -10, dy: -14, anchor: 'end' as const },
      { dx: 10, dy: 15, anchor: 'start' as const },
      { dx: -10, dy: 15, anchor: 'end' as const },
      { dx: 0, dy: -20, anchor: 'middle' as const },
      { dx: 0, dy: 21, anchor: 'middle' as const },
    ];
    let best = tries[0];
    let bestBox: Box | null = null;
    let bestScore = Infinity;
    for (const t of tries) {
      const x = c.x + t.dx;
      const y = c.y + t.dy;
      const x1 = t.anchor === 'start' ? x : t.anchor === 'end' ? x - w : x - w / 2;
      const box = { x1, y1: y - h / 2, x2: x1 + w, y2: y + h / 2 };
      const outside = Math.max(0, -box.x1) + Math.max(0, box.x2 - GRID_W) + Math.max(0, -box.y1) + Math.max(0, box.y2 - GRID_H);
      const score = taken.reduce((sum, b) => sum + overlap(box, b), 0) + outside * 50;
      if (score < bestScore) {
        bestScore = score;
        best = t;
        bestBox = box;
      }
    }
    if (bestBox) taken.push(bestBox);
    return { text, x: c.x + best.dx, y: c.y + best.dy, anchor: best.anchor };
  });
  return (
    <svg className="question__figure question__figure--grid" viewBox={`0 0 ${GRID_W} ${GRID_H}`} role="presentation" aria-hidden="true" focusable="false">
      {Array.from({ length: n }, (_, k) => k + 1).map((i) => (
        <g key={i}>
          <line x1={ox + i * step} y1={oy} x2={ox + i * step} y2={oy - span} className="fig__gridline" />
          <line x1={ox} y1={oy - i * step} x2={ox + span} y2={oy - i * step} className="fig__gridline" />
        </g>
      ))}
      {/* The axes, bold, with arrows and their names. */}
      <line x1={ox} y1={oy} x2={ox + span + 14} y2={oy} className="fig__axis" />
      <line x1={ox} y1={oy} x2={ox} y2={oy - span - 14} className="fig__axis" />
      <path d={`M ${ox + span + 20} ${oy} l -10 -6 v 12 z`} className="fig__dot" />
      <path d={`M ${ox} ${oy - span - 20} l -6 10 h 12 z`} className="fig__dot" />
      <text x={ox + span + 24} y={oy} dominantBaseline="middle" className="fig__label">x</text>
      <text x={ox + 12} y={oy - span - 16} dominantBaseline="middle" className="fig__label">y</text>
      {Array.from({ length: n + 1 }, (_, i) => i)
        .filter((i) => i % every === 0)
        .map((i) => (
          <g key={`n${i}`}>
            <text x={ox + i * step} y={oy + 16} textAnchor="middle" dominantBaseline="middle" className="fig__num fig__num--grid">{i}</text>
            {i > 0 && <text x={ox - 10} y={oy - i * step} textAnchor="end" dominantBaseline="middle" className="fig__num fig__num--grid">{i}</text>}
          </g>
        ))}
      {f.points.map((p, i) => {
        const c = at(p);
        return <circle key={`p${i}`} cx={c.x} cy={c.y} r={6} className="fig__dot" />;
      })}
      {labels.map((l, i) =>
        l ? (
          <text key={`l${i}`} x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline="middle" className={`fig__label fig__label--halo${l.text.includes('?') ? ' fig__label--ask' : ''}`}>
            {l.text}
          </text>
        ) : null,
      )}
    </svg>
  );
}

const GRID_W = 300;
const GRID_H = 290;

export function Figure({ figure }: { figure: FigureSpec }) {
  if (figure.kind === 'grid') return <GridFigure f={figure} />;
  return (
    <svg className="question__figure" viewBox={`0 0 ${W} ${H}`} role="presentation" aria-hidden="true" focusable="false">
      <Body f={figure} />
    </svg>
  );
}

/** The kinds of angle, each drawn with its name: the "Help me" picture for angle questions (James, 26 Nov 2026). */
const ANGLE_KINDS: { name: string; degrees: number; words: string }[] = [
  { name: 'Acute', degrees: 45, words: 'less than 90°' },
  { name: 'Right', degrees: 90, words: 'exactly 90°' },
  { name: 'Obtuse', degrees: 135, words: '90° to 180°' },
  { name: 'Straight', degrees: 180, words: 'exactly 180°' },
  { name: 'Reflex', degrees: 270, words: 'more than 180°' },
];

export function AngleNames({ hideRanges = false }: { hideRanges?: boolean }) {
  return (
    <ul className="angle-names" aria-label="Kinds of angle">
      {ANGLE_KINDS.map((k) => {
        const cx = k.degrees > 180 ? 40 : 18;
        const cy = k.degrees > 180 ? 34 : 56;
        const r = (k.degrees * Math.PI) / 180;
        return (
          <li key={k.name} className="angle-names__item">
            <svg viewBox="0 0 80 66" aria-hidden="true" focusable="false" className="angle-names__pic">
              <line x1={cx} y1={cy} x2={cx + 36} y2={cy} className="fig__line" />
              <line x1={cx} y1={cy} x2={cx + 36 * Math.cos(r)} y2={cy - 36 * Math.sin(r)} className="fig__line" />
              {k.degrees === 90 ? <path d={`M ${cx + 9} ${cy} L ${cx + 9} ${cy - 9} L ${cx} ${cy - 9}`} className="fig__corner" /> : <Arc cx={cx} cy={cy} r={11} a={0} b={k.degrees} />}
            </svg>
            <strong>{k.name}</strong>
            {!hideRanges && <span>{k.words}</span>}
          </li>
        );
      })}
    </ul>
  );
}
