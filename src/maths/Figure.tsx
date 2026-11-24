/**
 * Draws a question's small picture (shared/maths/figure.ts) as SVG. Decorative for screen readers: the question's `spoken`
 * text already says everything in the picture. A '?' label is drawn highlighted, as the thing being asked.
 */
import type { ReactNode } from 'react';
import type { Figure as FigureSpec } from '../../shared/maths/figure';

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
    case 'crossing':
      return (
        <>
          <line x1={30} y1={30} x2={210} y2={120} className="fig__line" />
          <line x1={30} y1={120} x2={210} y2={30} className="fig__line" />
          <Label x={120} y={38} text={f.angles[0]} />
          <Label x={120} y={112} text={f.angles[1]} />
        </>
      );
    case 'right-angle': {
      const sizes = drawSizes(f.angles, 90);
      return (
        <>
          <Fan cx={60} cy={130} sizes={sizes} labels={f.angles} start={0} />
          <rect x={60} y={118} width={12} height={12} className="fig__corner" />
        </>
      );
    }
    case 'rectangle':
      return (
        <>
          <rect x={50} y={30} width={140} height={84} className="fig__shape" />
          <Label x={120} y={130} text={f.width} />
          <Label x={36} y={72} text={f.height} anchor="end" />
          <Label x={120} y={72} text={f.inside ?? ''} />
        </>
      );
    case 'triangle-area':
      return (
        <>
          <polygon points="40,118 200,118 90,24" className="fig__shape" />
          <line x1={90} y1={24} x2={90} y2={118} className="fig__dash" />
          <Label x={120} y={134} text={f.base} />
          <Label x={84} y={70} text={f.height} anchor="end" />
          <Label x={140} y={92} text={f.inside ?? ''} />
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
      return (
        <>
          <rect x={x} y={y} width={w} height={h} className="fig__shape" />
          <polygon points={`${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}`} className="fig__shape fig__shape--top" />
          <polygon points={`${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y + h - d} ${x + w},${y + h}`} className="fig__shape fig__shape--side" />
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
          {f.radius !== undefined && <Label x={152} y={58} text={f.radius} anchor="start" />}
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
          {dirs[f.from] !== undefined && dirs[f.to] !== undefined && (
            <Arc cx={cx} cy={cy} r={26} a={dirs[f.to]} b={dirs[f.from]} />
          )}
        </>
      );
    }
  }
}

export function Figure({ figure }: { figure: FigureSpec }) {
  return (
    <svg className="question__figure" viewBox={`0 0 ${W} ${H}`} role="presentation" aria-hidden="true" focusable="false">
      <Body f={figure} />
    </svg>
  );
}
