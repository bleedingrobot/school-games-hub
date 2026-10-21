/**
 * A scribble pad for working things out: freehand pen, rubber, clear and three colours.
 * Mouse, finger and stylus all work (pointer events). Nothing is saved or sent anywhere, and the
 * parent gives it a new `key` for each question, so every question starts on a clean page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };
type Stroke = { colour: string; width: number; erase: boolean; points: Point[] };

export const INKS = [
  { name: 'Black', value: '#0f172a' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Red', value: '#b91c1c' },
] as const;

const PEN_WIDTH = 3;
const RUBBER_WIDTH = 22;

/** Draws every stroke again, smoothing each line through the midpoints of its points. */
function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    const { points } = stroke;
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.colour;
    ctx.fillStyle = stroke.colour;
    ctx.lineWidth = stroke.width;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function ScribblePad({ onCollapse }: { onCollapse: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<{ id: number; stroke: Stroke } | null>(null);
  const [tool, setTool] = useState<'pen' | 'rubber'>('pen');
  const [ink, setInk] = useState<string>(INKS[0].value);

  const redraw = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(ctx, strokes.current, el.width / ratio, el.height / ratio);
  }, []);

  // Keep the drawing sharp and the same size as its box, and redraw after any resize.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      const box = el.getBoundingClientRect();
      el.width = Math.max(1, Math.round(box.width * ratio));
      el.height = Math.max(1, Math.round(box.height * ratio));
      redraw();
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const watcher = new ResizeObserver(fit);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [redraw]);

  const place = (e: React.PointerEvent): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // Keep focus where it was, so the keyboard still types the answer.
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const erase = tool === 'rubber';
    const stroke: Stroke = { colour: ink, width: erase ? RUBBER_WIDTH : PEN_WIDTH, erase, points: [place(e)] };
    strokes.current.push(stroke);
    drawing.current = { id: e.pointerId, stroke };
    redraw();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current?.id !== e.pointerId) return;
    drawing.current.stroke.points.push(place(e));
    redraw();
  }
  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current?.id !== e.pointerId) return;
    drawing.current = null;
  }

  function clear() {
    strokes.current = [];
    drawing.current = null;
    redraw();
  }

  // Pressing a button must not steal focus from the question box.
  const keepFocus = (e: React.PointerEvent) => e.preventDefault();

  return (
    <section
      className="scribble"
      aria-label="Scribble pad"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCollapse();
        }
      }}
    >
      <div className="scribble__bar">
        <div className="scribble__tools" role="group" aria-label="Tools">
          <button type="button" className="scribble__btn" aria-pressed={tool === 'pen'} onPointerDown={keepFocus} onClick={() => setTool('pen')}>
            <span aria-hidden="true">✏️</span> Pen
          </button>
          <button type="button" className="scribble__btn" aria-pressed={tool === 'rubber'} onPointerDown={keepFocus} onClick={() => setTool('rubber')}>
            Rubber
          </button>
          <button type="button" className="scribble__btn" onPointerDown={keepFocus} onClick={clear}>
            Clear
          </button>
        </div>
        <div className="scribble__tools" role="group" aria-label="Colour">
          {INKS.map((c) => (
            <button
              key={c.value}
              type="button"
              className="scribble__swatch"
              style={{ background: c.value }}
              aria-label={c.name}
              aria-pressed={tool === 'pen' && ink === c.value}
              onPointerDown={keepFocus}
              onClick={() => {
                setInk(c.value);
                setTool('pen');
              }}
            />
          ))}
        </div>
        <button type="button" className="scribble__btn scribble__hide" onPointerDown={keepFocus} onClick={onCollapse}>
          Hide
        </button>
      </div>
      <canvas
        ref={canvas}
        className="scribble__canvas"
        role="img"
        aria-label="Drawing space. Draw your working here."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </section>
  );
}
