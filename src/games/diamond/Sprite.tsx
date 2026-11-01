/**
 * A small canvas picture drawn by one of the art functions (a gem, an upgrade, Nugget). `draw` gets a context already
 * scaled so the box is `box` units square, whatever size it shows at. `animate` redraws every frame (try-on claws).
 */
import { useEffect, useRef } from 'react';

export function Sprite({
  draw,
  size,
  box = 100,
  label,
  animate = false,
  className,
}: {
  draw: (ctx: CanvasRenderingContext2D, time: number) => void;
  size: number;
  box?: number;
  /** What it shows, for screen readers; leave out for a picture beside words that already say it. */
  label?: string;
  animate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const startRef = useRef(0);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    let frame = 0;
    if (!startRef.current) startRef.current = performance.now();
    const start = startRef.current;
    const paint = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale((size * dpr) / box, (size * dpr) / box);
      drawRef.current(ctx, (performance.now() - start) / 1000);
      if (animate) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [size, box, animate, draw]);
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: size, height: size }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
