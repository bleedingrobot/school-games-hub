/**
 * Draws a question picture (shared/maths/pictures/types.ts) as SVG above the question. The pictures only show the numbers
 * in a question (dots, bars, a number line); they never show the answer. Each one works out its own viewBox from its
 * content, then is shown at most 320px wide (scaling down on a phone), so the text stays readable.
 */
import type { ReactNode } from 'react';
import type { Picture } from '../../shared/maths/pictures';
import { Figure } from './Figure';

/** The room a picture is drawn in (viewBox units) and the widest it shows (CSS px). */
function Frame({ w, h, label, max = 320, children }: { w: number; h: number; label: string; max?: number; children: ReactNode }) {
  return (
    <svg
      className="question__picture"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      focusable="false"
      style={{ width: `min(100%, ${Math.min(max, Math.round(w * 1.4))}px)` }}
    >
      {children}
    </svg>
  );
}

type Shade = 'a' | 'b';

/** A number as the questions show it: a real minus sign, and 12 500 with a space from 5 digits. */
const fmt = (n: number) => {
  const [w, d] = String(Math.abs(+n.toFixed(6))).split('.');
  return (n < 0 ? '−' : '') + (w.length >= 5 ? w.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : w) + (d ? `.${d}` : '');
};
/** A rough width for a bit of text at the label size, to keep neighbours apart. */
const textW = (s: string, per = 8.5) => s.length * per;

function T({ x, y, text, anchor = 'middle', cls = '' }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end'; cls?: string }) {
  if (!text) return null;
  const ask = text.includes('?');
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" className={`fig__label qp__t${ask ? ' fig__label--ask' : ''}${cls ? ` ${cls}` : ''}`}>
      {text}
    </text>
  );
}

/** Which row (0, 1, 2...) each label goes on so that neighbours on one row do not overlap. */
function levelsFor(items: { x: number; w: number }[]): number[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].x - items[b].x);
  const ends: number[] = [];
  const out = items.map(() => 0);
  for (const i of order) {
    const left = items[i].x - items[i].w / 2;
    let lv = ends.findIndex((e) => e + 4 <= left);
    if (lv < 0) lv = ends.length;
    ends[lv] = items[i].x + items[i].w / 2;
    out[i] = lv;
  }
  return out;
}

const shadeClass = (s: Shade) => (s === 'a' ? 'qp__a' : 'qp__b');
const list = (xs: (string | number)[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** A clock face centred at (cx, cy) with hands; with no time it is blank with a '?'. */
function Face({ cx, cy, r, time }: { cx: number; cy: number; r: number; time: { hour: number; minute: number } | null }) {
  const pt = (turns: number, len: number) => {
    const t = turns * 2 * Math.PI - Math.PI / 2;
    return { x: cx + len * Math.cos(t), y: cy + len * Math.sin(t) };
  };
  if (!time) {
    return (
      <>
        <circle cx={cx} cy={cy} r={r} className="fig__shape qp__ask-shape" />
        <T x={cx} y={cy} text="?" />
      </>
    );
  }
  const hour = ((Math.round(time.hour) % 12) + 12) % 12;
  const minute = ((Math.round(time.minute) % 60) + 60) % 60;
  const short = pt((hour + minute / 60) / 12, r * 0.45);
  const long = pt(minute / 60, r * 0.7);
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className="fig__shape" />
      {Array.from({ length: 12 }, (_, i) => {
        const at = pt((i + 1) / 12, r * 0.8);
        return (
          <text key={i} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" className="fig__num">
            {i + 1}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={short.x} y2={short.y} className="fig__hand fig__hand--short" />
      <line x1={cx} y1={cy} x2={long.x} y2={long.y} className="fig__hand" />
      <circle cx={cx} cy={cy} r={3.5} className="fig__dot" />
    </>
  );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const bx = x2 - ux * 8;
  const by = y2 - uy * 8;
  return (
    <>
      <line x1={x1} y1={y1} x2={bx} y2={by} className="fig__line" />
      <polygon points={`${x2},${y2} ${bx - uy * 5},${by + ux * 5} ${bx + uy * 5},${by - ux * 5}`} className="fig__dot" />
    </>
  );
}

/** A wedge of a circle, from angle a to b (degrees clockwise from the top). */
function wedge(cx: number, cy: number, r: number, a: number, b: number) {
  const p = (d: number) => {
    const t = (d * Math.PI) / 180 - Math.PI / 2;
    return `${cx + r * Math.cos(t)} ${cy + r * Math.sin(t)}`;
  };
  return `M ${cx} ${cy} L ${p(a)} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${p(b)} Z`;
}

function Frames({ size, counts, frames = 1 }: { size: 5 | 10; counts: number[]; frames?: number }) {
  const cell = 28;
  const rows = size === 10 ? 2 : 1;
  const fw = 5 * cell;
  const fh = rows * cell;
  const seq: Shade[] = counts.flatMap((n, i) => Array.from({ length: Math.max(0, Math.round(n)) }, () => (i % 2 === 0 ? 'a' : 'b') as Shade));
  const n = Math.max(1, Math.min(4, Math.round(frames)), Math.ceil(seq.length / size));
  const perRow = Math.min(n, 2);
  const lines = Math.ceil(n / perRow);
  const gap = 16;
  const pad = 3;
  const w = perRow * fw + (perRow - 1) * gap + pad * 2;
  const h = lines * fh + (lines - 1) * gap + pad * 2;
  const label = `${size === 10 ? 'Ten' : 'Five'}-${n > 1 ? 'frames' : 'frame'} with ${list(counts)} counters`;
  return (
    <Frame w={w} h={h} label={label} max={perRow === 1 ? 220 : 320}>
      {Array.from({ length: n }, (_, f) => {
        const ox = pad + (f % perRow) * (fw + gap);
        const oy = pad + Math.floor(f / perRow) * (fh + gap);
        return (
          <g key={f}>
            {Array.from({ length: size }, (_, k) => {
              const x = ox + (k % 5) * cell;
              const y = oy + Math.floor(k / 5) * cell;
              const s = seq[f * size + k];
              return (
                <g key={k}>
                  <rect x={x} y={y} width={cell} height={cell} className="qp__cell" />
                  {s && <circle cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.36} className={`qp__counter ${shadeClass(s)}`} />}
                </g>
              );
            })}
            <rect x={ox} y={oy} width={fw} height={fh} className="qp__outline" />
          </g>
        );
      })}
    </Frame>
  );
}

function DotRows({ rows, fives }: { rows: number[]; fives?: boolean }) {
  const s = 20;
  const gap = fives ? 10 : 0;
  const widest = Math.max(1, ...rows);
  const w = Math.max(60, widest * s + (fives ? Math.floor((widest - 1) / 5) * gap : 0) + 16);
  const lineH = 24;
  const h = rows.length * lineH + 8;
  return (
    <Frame w={w} h={h} label={`Rows of dots: ${rows.join(', ')}`}>
      {rows.map((n, i) =>
        Array.from({ length: Math.max(0, n) }, (_, k) => (
          <circle key={`${i}-${k}`} cx={8 + s / 2 + k * s + Math.floor(k / 5) * gap} cy={4 + lineH / 2 + i * lineH} r={7.5} className={`qp__counter ${i % 2 === 0 ? 'qp__a' : 'qp__b'}`} />
        )),
      )}
    </Frame>
  );
}

function Track({ cells, arcs }: { cells: string[]; arcs?: '+' | '−' }) {
  const cw = Math.max(36, ...cells.map((c) => textW(c, 9.5) + 14));
  const perRow = cells.length > 10 ? Math.ceil(cells.length / 2) : cells.length;
  const lines = Math.ceil(cells.length / perRow);
  const gap = 4;
  const ch = 38;
  // Jump arrows over the gaps (one row only): a small curve from the middle of each box to the next.
  const jumps = Boolean(arcs) && lines === 1 && cells.length > 1;
  const top = jumps ? 34 : 0;
  const w = perRow * cw + (perRow - 1) * gap + 6;
  const h = top + lines * ch + (lines - 1) * 8 + 6;
  return (
    <Frame w={w} h={h} label={`Number track: ${cells.map((c) => (c.includes('?') ? 'a missing number' : c)).join(', ')}${jumps ? ', with equal jumps between them' : ''}`}>
      {jumps &&
        cells.slice(1).map((c, i) => {
          const x1 = 3 + i * (cw + gap) + cw / 2 + 4;
          const x2 = 3 + (i + 1) * (cw + gap) + cw / 2 - 4;
          const y = top + 1;
          const mid = (x1 + x2) / 2;
          const ask = c.includes('?') || cells[i].includes('?');
          return (
            <g key={`j${i}`}>
              <path d={`M ${x1} ${y} Q ${mid} ${y - 22} ${x2 - 2} ${y - 3}`} className={`fig__line qp__thin qp__jump${ask ? ' qp__dash' : ''}`} fill="none" strokeDasharray={ask ? '4 3' : undefined} />
              <polygon points={`${x2},${y} ${x2 - 7},${y - 3} ${x2 - 2},${y - 8}`} className="fig__dot" />
              <T x={mid} y={y - 22} text={`${arcs}?`} cls="qp__small" />
            </g>
          );
        })}
      {cells.map((c, i) => {
        const x = 3 + (i % perRow) * (cw + gap);
        const y = top + 3 + Math.floor(i / perRow) * (ch + 8);
        const ask = c.includes('?');
        return (
          <g key={i}>
            <rect x={x} y={y} width={cw} height={ch} rx={5} className={ask ? 'qp__cell qp__cell--ask' : 'qp__cell qp__cell--box'} />
            <T x={x + cw / 2} y={y + ch / 2} text={c} />
          </g>
        );
      })}
    </Frame>
  );
}

function NumberLine({ p }: { p: Extract<Picture, { kind: 'number-line' }> }) {
  const { from, to, step } = p;
  const marks = p.marks ?? [];
  const words = p.words ?? [];
  const span = to - from || 1;
  const edge = Math.max(26, ...words.map((o) => textW(o.label, 8) / 2 + 6), ...marks.map((o) => textW(o.label) / 2 + 6), ...p.labels.map((v) => textW(fmt(v)) / 2 + 6));
  const W = 340;
  const L = W - edge * 2;
  const X = (v: number) => edge + ((v - from) / span) * L;
  const markLv = levelsFor(marks.map((o) => ({ x: X(o.at), w: textW(o.label) + 6 })));
  const topLv = Math.max(-1, ...markLv) + 1;
  const lineY = 22 + Math.max(0, topLv - 1) * 17 + (topLv ? 10 : 0);
  const labelled = p.labels.length > 0;
  const wordLv = levelsFor(words.map((o) => ({ x: X(o.at), w: textW(o.label, 8) + 6 })));
  const wordsTop = lineY + (labelled ? 44 : 24);
  const h = Math.max(wordsTop - 12, lineY + (labelled ? 36 : 14)) + (words.length ? Math.max(...wordLv) * 18 + 22 : 0) + 4;
  const count = Math.min(200, Math.max(0, Math.round(span / (step || 1))));
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a));
  const isLabel = (v: number) => p.labels.some((l) => same(l, v));
  const ticks = Array.from({ length: count + 1 }, (_, i) => from + i * (step || 1));
  const extra = [...p.labels, ...words.map((o) => o.at)].filter((v) => !ticks.some((t) => same(t, v)));
  const label = `Number line from ${fmt(from)} to ${fmt(to)}${marks.length ? ` with ${list(marks.map((o) => o.label || fmt(o.at)))} marked` : words.length ? ` labelled ${list(words.map((o) => o.label))}` : ''}`;
  return (
    <Frame w={W} h={h} label={label}>
      <line x1={X(from)} y1={lineY} x2={X(to)} y2={lineY} className="fig__line" />
      {[...ticks, ...extra].map((v, i) => {
        const big = isLabel(v) || words.some((o) => same(o.at, v)) || same(v, from) || same(v, to);
        return <line key={i} x1={X(v)} y1={lineY - (big ? 8 : 5)} x2={X(v)} y2={lineY + (big ? 8 : 5)} className="fig__line qp__tick" />;
      })}
      {p.labels.map((v, i) => (
        <T key={`l${i}`} x={X(v)} y={lineY + 22} text={fmt(v)} />
      ))}
      {marks.map((o, i) => (
        <g key={`m${i}`}>
          <circle cx={X(o.at)} cy={lineY} r={6} className="qp__counter qp__b" />
          <T x={X(o.at)} y={lineY - 16 - markLv[i] * 17} text={o.label} />
        </g>
      ))}
      {words.map((o, i) => (
        <T key={`w${i}`} x={X(o.at)} y={wordsTop + wordLv[i] * 18} text={o.label} cls="qp__small" />
      ))}
    </Frame>
  );
}

function Hundred({ shaded }: { shaded: number }) {
  const c = 18;
  const pad = 3;
  const n = Math.max(0, Math.min(100, Math.round(shaded)));
  return (
    <Frame w={c * 10 + pad * 2} h={c * 10 + pad * 2} label={`Hundred square with ${n} squares shaded`} max={240}>
      {Array.from({ length: 100 }, (_, i) => (
        <rect key={i} x={pad + (i % 10) * c} y={pad + Math.floor(i / 10) * c} width={c} height={c} className={i < n ? 'qp__cell qp__cell--a' : 'qp__cell'} />
      ))}
      <rect x={pad} y={pad} width={c * 10} height={c * 10} className="qp__outline" />
    </Frame>
  );
}

function Bars({ bars }: { bars: Extract<Picture, { kind: 'bars' }>['bars'] }) {
  const bw = 270;
  const bh = 30;
  const pad = 4;
  let y = pad;
  const rows = bars.map((b) => {
    const top = y + (b.label ? 22 : 0);
    y = top + bh + 12;
    return { b, top };
  });
  return (
    <Frame w={bw + pad * 2} h={y - 12 + pad} label={`Fraction bars: ${list(bars.map((b) => `${b.shaded} of ${b.parts} parts shaded${b.label ? ` (${b.label})` : ''}`))}`}>
      {rows.map(({ b, top }, i) => {
        const parts = Math.max(1, Math.round(b.parts));
        const pw = bw / parts;
        return (
          <g key={i}>
            <T x={pad + bw / 2} y={top - 11} text={b.label ?? ''} />
            {Array.from({ length: parts }, (_, k) => (
              <rect key={k} x={pad + k * pw} y={top} width={pw} height={bh} className={k >= (b.start ?? 0) && k < (b.start ?? 0) + b.shaded ? `qp__cell qp__cell--${b.shade ?? 'a'}` : 'qp__cell'} />
            ))}
            <rect x={pad} y={top} width={bw} height={bh} className="qp__outline" />
          </g>
        );
      })}
    </Frame>
  );
}

function Wholes({ count, parts, shaded }: { count: number; parts: number; shaded: number }) {
  const n = Math.max(1, Math.round(count));
  const k = Math.max(1, Math.round(parts));
  const r = 34;
  const perRow = Math.min(n, 4);
  const lines = Math.ceil(n / perRow);
  const step = r * 2 + 14;
  const w = perRow * step - 14 + 8;
  const h = lines * step - 14 + 8;
  return (
    <Frame w={w} h={h} label={`${n} ${n === 1 ? 'circle' : 'circles'} each cut into ${k} equal parts, ${Math.round(shaded)} parts shaded`} max={perRow === 1 ? 160 : 320}>
      {Array.from({ length: n }, (_, i) => {
        const cx = 4 + r + (i % perRow) * step;
        const cy = 4 + r + Math.floor(i / perRow) * step;
        const sh = Math.max(0, Math.min(k, Math.round(shaded) - i * k));
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} className="fig__shape" />
            {Array.from({ length: sh }, (_, j) =>
              k === 1 ? <circle key={j} cx={cx} cy={cy} r={r} className="qp__fill" /> : <path key={j} d={wedge(cx, cy, r, (j * 360) / k, ((j + 1) * 360) / k)} className="qp__fill" />,
            )}
            {k > 1 &&
              Array.from({ length: k }, (_, j) => {
                const t = (j * 2 * Math.PI) / k - Math.PI / 2;
                return <line key={j} x1={cx} y1={cy} x2={cx + r * Math.cos(t)} y2={cy + r * Math.sin(t)} className="fig__line qp__thin" />;
              })}
            <circle cx={cx} cy={cy} r={r} className="qp__outline" />
          </g>
        );
      })}
    </Frame>
  );
}

function ArrayPic({ rows, cols, extra = 0, groups }: { rows: number; cols: number; extra?: number; groups?: boolean }) {
  const R = Math.max(1, Math.round(rows));
  const C = Math.max(1, Math.round(cols));
  const E = Math.max(0, Math.round(extra));
  const extraRows = Math.ceil(E / C);
  const s = Math.max(12, Math.min(24, 300 / C, 170 / (R + extraRows)));
  const r = s * 0.36;
  const pad = 8;
  const gapY = E ? 12 : 0;
  const w = C * s + pad * 2;
  const h = (R + extraRows) * s + gapY + pad * 2;
  return (
    <Frame w={w} h={h} label={`Array of ${R} rows of ${C} dots${E ? `, and ${E} more dots` : ''}`}>
      {Array.from({ length: R }, (_, i) => (
        <g key={i}>
          {groups && <rect x={pad - 3} y={pad + i * s + 3} width={C * s + 6} height={s - 6} rx={(s - 6) / 2} className="qp__ring" />}
          {Array.from({ length: C }, (_, k) => (
            <circle key={k} cx={pad + k * s + s / 2} cy={pad + i * s + s / 2} r={r} className="qp__counter qp__a" />
          ))}
        </g>
      ))}
      {Array.from({ length: E }, (_, k) => (
        <circle key={`e${k}`} cx={pad + (k % C) * s + s / 2} cy={pad + (R + Math.floor(k / C)) * s + gapY + s / 2} r={r} className="qp__counter qp__b" />
      ))}
    </Frame>
  );
}

function SplitBox({ tens, ones, by }: { tens: number; ones: number; by: number }) {
  const total = 250;
  const sum = Math.max(1, tens + ones);
  const minW = 34; // just room for the ones label; the rest is in proportion (20 is drawn about 7 times as wide as 3)
  const tw = Math.min(total - minW, Math.max(minW, (tens / sum) * total));
  const ow = total - tw;
  const x0 = 40;
  const y0 = 30;
  // Height in proportion to the side too, within reason: 4 × 23 is a long, low box.
  const bh = Math.round(Math.min(110, Math.max(40, (total * by) / sum)));
  return (
    <Frame w={x0 + total + 8} h={y0 + bh + 6} label={`Area box split into ${tens} and ${ones} across, ${by} down`}>
      <rect x={x0} y={y0} width={tw} height={bh} className="qp__cell qp__cell--a" />
      <rect x={x0 + tw} y={y0} width={ow} height={bh} className="qp__cell qp__cell--b" />
      <rect x={x0} y={y0} width={total} height={bh} className="qp__outline" />
      <T x={x0 + tw / 2} y={y0 - 14} text={String(tens)} />
      <T x={x0 + tw + ow / 2} y={y0 - 14} text={String(ones)} />
      <T x={x0 - 10} y={y0 + bh / 2} text={String(by)} anchor="end" />
    </Frame>
  );
}

function Place({ headings, digits }: { headings: string[]; digits: string[] }) {
  const lines = headings.map((h) => h.split(' '));
  const longest = Math.max(1, ...lines.flat().map((x) => x.length));
  // A chart with decimals sizes each column to its own heading ('1s' is narrow, 'thousandths' wide), so it stays readable.
  const point = headings.indexOf('tenths');
  const cws = headings.map((_, i) => Math.max(40, (point >= 0 ? Math.max(...lines[i].map((x) => x.length)) : longest) * 8.2 + 8));
  const xs = cws.map((_, i) => 3 + cws.slice(0, i).reduce((a, b) => a + b, 0));
  const hh = Math.max(...lines.map((l) => l.length), 1) * 17 + 10;
  const dh = 44;
  const w = cws.reduce((a, b) => a + b, 0) + 6;
  return (
    <Frame max={360} w={w} h={hh + dh + 6} label={`Place value chart with columns ${list(headings)}${digits.some(Boolean) ? ` and digits ${digits.map((d) => d || 'blank').join(', ')}` : ''}`}>
      {headings.map((_, i) => {
        const x = xs[i];
        const cw = cws[i];
        return (
          <g key={i}>
            <rect x={x} y={3} width={cw} height={hh} className="qp__cell qp__cell--head" />
            <rect x={x} y={3 + hh} width={cw} height={dh} className="qp__cell qp__cell--box" />
            {lines[i].map((word, j) => (
              <T key={j} x={x + cw / 2} y={3 + hh / 2 + (j - (lines[i].length - 1) / 2) * 17} text={word} cls="qp__head" />
            ))}
            <T x={x + cw / 2} y={3 + hh + dh / 2} text={digits[i] ?? ''} cls="qp__big" />
          </g>
        );
      })}
      {/* The decimal point, between the 1s and the tenths. */}
      {point > 0 && <circle cx={xs[point]} cy={3 + hh + dh - 9} r={4} className="fig__dot" />}
    </Frame>
  );
}

function Thermometer({ from, to, start }: { from: number; to: number; start: number }) {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const range = hi - lo || 1;
  // A small mark for every 1° when there is room (up to 30°, as the help card says), else every 5°; numbers every 2, 5 or 10.
  const minor = range <= 30 ? 1 : 5;
  const step = [2, 5, 10, 20, 25, 50, 100].find((s) => range / s <= 6 && s % minor === 0) ?? range;
  const top = 14;
  const bottom = 134;
  const Y = (v: number) => bottom - ((Math.max(lo, Math.min(hi, v)) - lo) / range) * (bottom - top);
  const tx = 100;
  const tw = 18;
  const marks: number[] = [];
  for (let v = Math.ceil(lo / minor) * minor; v <= hi + 1e-9; v += minor) marks.push(v);
  const labelled = (v: number) => Math.abs(v % step) < 1e-9;
  return (
    <Frame w={230} h={172} label={`Thermometer from ${fmt(from)} to ${fmt(to)} degrees with ${fmt(start)} marked`} max={230}>
      <rect x={tx} y={top - 6} width={tw} height={bottom - top + 12} rx={tw / 2} className="fig__shape" />
      <circle cx={tx + tw / 2} cy={bottom + 22} r={17} className="fig__shape" />
      <rect x={tx + 4} y={Y(start)} width={tw - 8} height={bottom + 20 - Y(start)} className="qp__counter qp__b" />
      <circle cx={tx + tw / 2} cy={bottom + 22} r={13} className="qp__counter qp__b" />
      {marks.map((v) => (
        <g key={v}>
          <line x1={tx + tw} y1={Y(v)} x2={tx + tw + (labelled(v) ? 9 : 5)} y2={Y(v)} className={labelled(v) ? 'fig__line' : 'fig__line qp__thin'} />
          {labelled(v) && <T x={tx + tw + 15} y={Y(v)} text={fmt(v)} anchor="start" cls="qp__small" />}
        </g>
      ))}
      <Arrow x1={tx - 44} y1={Y(start)} x2={tx - 4} y2={Y(start)} />
      <T x={tx - 50} y={Y(start)} text={`${fmt(start)}°`} anchor="end" />
    </Frame>
  );
}

function Clocks({ start, end }: { start: { hour: number; minute: number; label: string }; end: { hour: number; minute: number; label: string } | null }) {
  const r = 58;
  return (
    <Frame w={300} h={r * 2 + 40} label={`Two clocks: ${start.label}${end ? ` and ${end.label}` : ' and a blank clock with a question mark'}`}>
      <Face cx={75} cy={r + 4} r={r} time={start} />
      <Arrow x1={140} y1={r + 4} x2={162} y2={r + 4} />
      <Face cx={227} cy={r + 4} r={r} time={end} />
      <T x={75} y={r * 2 + 24} text={start.label} />
      <T x={227} y={r * 2 + 24} text={end ? end.label : ''} />
    </Frame>
  );
}

function Clock24() {
  const c = 100;
  const pt = (n: number, len: number) => {
    const t = (n / 12) * 2 * Math.PI - Math.PI / 2;
    return { x: c + len * Math.cos(t), y: c + len * Math.sin(t) };
  };
  return (
    <Frame w={200} h={200} label="Clock face with the hours 1 to 12, and 13 to 24 in a ring around it" max={250}>
      <circle cx={c} cy={c} r={97} className="fig__shape" />
      <circle cx={c} cy={c} r={66} className="fig__shape qp__inner" />
      {Array.from({ length: 12 }, (_, i) => {
        const inner = pt(i + 1, 51);
        const outer = pt(i + 1, 81.5);
        return (
          <g key={i}>
            <text x={inner.x} y={inner.y} textAnchor="middle" dominantBaseline="central" className="fig__num qp__num-in">
              {i + 1}
            </text>
            <text x={outer.x} y={outer.y} textAnchor="middle" dominantBaseline="central" className="fig__num qp__num-out">
              {i + 13}
            </text>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={3.5} className="fig__dot" />
    </Frame>
  );
}

function Balance({ left, right }: { left: string; right: string }) {
  const lw = Math.max(88, textW(left, 9) + 22);
  const rw = Math.max(88, textW(right, 9) + 22);
  const gap = 24;
  const w = lw + rw + gap + 16;
  const lc = 8 + lw / 2;
  const rc = w - 8 - rw / 2;
  const mid = w / 2;
  const beamY = 32;
  const panY = 116;
  const pan = (cx: number, pw: number, text: string) => (
    <g>
      <line x1={cx} y1={beamY} x2={cx - pw / 2} y2={panY} className="fig__line qp__thin" />
      <line x1={cx} y1={beamY} x2={cx + pw / 2} y2={panY} className="fig__line qp__thin" />
      <path d={`M ${cx - pw / 2} ${panY} L ${cx + pw / 2} ${panY} L ${cx + pw / 2 - 10} ${panY + 12} L ${cx - pw / 2 + 10} ${panY + 12} Z`} className="qp__counter qp__a" />
      <T x={cx} y={panY - 14} text={text} />
    </g>
  );
  return (
    <Frame w={w} h={panY + 40} label={`Balance with ${left} on one side and ${right} on the other`}>
      <line x1={lc} y1={beamY} x2={rc} y2={beamY} className="fig__line qp__beam" />
      <line x1={mid} y1={beamY} x2={mid} y2={panY + 22} className="fig__line qp__beam" />
      <path d={`M ${mid - 26} ${panY + 30} L ${mid - 14} ${panY + 22} L ${mid + 14} ${panY + 22} L ${mid + 26} ${panY + 30} Z`} className="fig__shape" />
      <circle cx={mid} cy={beamY} r={5} className="fig__dot" />
      {pan(lc, lw, left)}
      {pan(rc, rw, right)}
    </Frame>
  );
}

function Towers({ values, mark }: { values: number[]; mark?: 'range' }) {
  // Range: only the tallest and the shortest stand out; otherwise one plain colour.
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const lit = (v: number) => mark === 'range' && (v === hi || v === lo);
  const bw = 38;
  const gap = 14;
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const ph = 110;
  const w = values.length * (bw + gap) - gap + 16;
  const base = 28 + ph;
  return (
    <Frame w={Math.max(w, 80)} h={base + 8} label={`Towers of height ${list(values)}${mark === 'range' ? `, the tallest and shortest picked out` : ''}`}>
      {values.map((v, i) => {
        const hgt = Math.max(6, (Math.abs(v) / max) * ph);
        const x = 8 + i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={base - hgt} width={bw} height={hgt} rx={3} className={`qp__counter ${lit(v) ? 'qp__b' : 'qp__a'}`} />
            <T x={x + bw / 2} y={base - hgt - 12} text={fmt(v)} />
          </g>
        );
      })}
      <line x1={2} y1={base} x2={Math.max(w, 80) - 2} y2={base} className="fig__line" />
    </Frame>
  );
}

function UnitLadder({ units, links, highlight }: { units: string[]; links: string[]; highlight: string[] }) {
  const bw = Math.max(76, ...units.map((u) => textW(u, 10) + 24));
  const bh = 28;
  const gap = 26;
  const lw = Math.max(0, ...links.map((l) => textW(l, 9)));
  const x0 = 6;
  const w = x0 * 2 + bw + 18 + lw;
  const h = units.length * bh + (units.length - 1) * gap + 8;
  return (
    <Frame w={w} h={h} label={`Unit ladder from ${list(units)}, with ${list(highlight)} picked out`} max={260}>
      {units.map((u, i) => {
        const y = 4 + i * (bh + gap);
        const on = highlight.includes(u);
        return (
          <g key={i}>
            <rect x={x0} y={y} width={bw} height={bh} rx={7} className={on ? 'qp__cell qp__cell--b qp__on' : 'qp__cell qp__cell--box'} />
            <T x={x0 + bw / 2} y={y + bh / 2} text={u} />
            {i < units.length - 1 && (
              <>
                <Arrow x1={x0 + bw / 2} y1={y + bh + 2} x2={x0 + bw / 2} y2={y + bh + gap - 2} />
                <T x={x0 + bw / 2 + 14} y={y + bh + gap / 2} text={links[i] ?? ''} anchor="start" cls="qp__small" />
              </>
            )}
          </g>
        );
      })}
    </Frame>
  );
}

export function QuestionPicture({ picture }: { picture: Picture }) {
  switch (picture.kind) {
    case 'frames':
      return <Frames size={picture.size} counts={picture.counts} frames={picture.frames} />;
    case 'dot-rows':
      return <DotRows rows={picture.rows} fives={picture.fives} />;
    case 'track':
      return <Track cells={picture.cells} arcs={picture.arcs} />;
    case 'number-line':
      return <NumberLine p={picture} />;
    case 'hundred':
      return <Hundred shaded={picture.shaded} />;
    case 'bars':
      return <Bars bars={picture.bars} />;
    case 'wholes':
      return <Wholes count={picture.count} parts={picture.parts} shaded={picture.shaded} />;
    case 'array':
      return <ArrayPic rows={picture.rows} cols={picture.cols} extra={picture.extra} groups={picture.groups} />;
    case 'split-box':
      return <SplitBox tens={picture.tens} ones={picture.ones} by={picture.by} />;
    case 'place':
      return <Place headings={picture.headings} digits={picture.digits} />;
    case 'thermometer':
      return <Thermometer from={picture.from} to={picture.to} start={picture.start} />;
    case 'clocks':
      return <Clocks start={picture.start} end={picture.end} />;
    case 'clock-24':
      return <Clock24 />;
    case 'balance':
      return <Balance left={picture.left} right={picture.right} />;
    case 'towers':
      return <Towers values={picture.values} mark={picture.mark} />;
    case 'unit-ladder':
      return <UnitLadder units={picture.units} links={picture.links} highlight={picture.highlight} />;
    case 'figure':
      return <Figure figure={picture.figure} />;
    default: {
      const never: never = picture;
      void never;
      return null;
    }
  }
}
