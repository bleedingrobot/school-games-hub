import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createSpaceView, type Scene, type SpaceView } from './renderer';

/** The full-screen picture behind the game. `view` lets the screens fire effects (warp, lasers, explosions). */
export const SpaceCanvas = forwardRef<SpaceView | null, { scene: Scene; lessMotion: boolean; simple: boolean; label: string }>(function SpaceCanvas(
  { scene, lessMotion, simple, label },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<SpaceView | null>(null);
  useImperativeHandle(ref, () => ({
    setScene: (s) => view.current?.setScene(s),
    warp: (ms) => view.current?.warp(ms) ?? Promise.resolve(),
    shoot: (f, o) => view.current?.shoot(f, o) ?? Promise.resolve(),
    raiseShields: (on) => view.current?.raiseShields(on),
    setHull: (w, r) => view.current?.setHull(w, r),
    explode: (w) => view.current?.explode(w) ?? Promise.resolve(),
    flee: () => view.current?.flee() ?? Promise.resolve(),
    robbed: () => view.current?.robbed() ?? Promise.resolve(),
    resetFight: () => view.current?.resetFight(),
    setOptions: (o) => view.current?.setOptions(o),
    stats: () => view.current?.stats() ?? { simple: true, slowSwitches: 0, frames: 0, particles: 0 },
    destroy: () => view.current?.destroy(),
  }));
  useEffect(() => {
    if (!canvas.current) return;
    const v = createSpaceView(canvas.current, { lessMotion, simple });
    view.current = v;
    v.setScene(scene);
    return () => {
      v.destroy();
      view.current = null;
    };
    // The view is made once; scenes and options are passed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    view.current?.setScene(scene);
  }, [scene]);
  useEffect(() => {
    view.current?.setOptions({ lessMotion, simple });
  }, [lessMotion, simple]);
  return <canvas ref={canvas} className="st-canvas" role="img" aria-label={label} />;
});
