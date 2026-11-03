/**
 * What the Star Forge screens need from the 3D solar system viewer (docs/TRADER-SYSTEM-PLAN.md, section 5). The viewer
 * itself (`./index.ts`, three.js) is loaded only when a Forge screen opens, with `import('./viewer')`, so the rest of
 * Star Trader never downloads three.js.
 *
 * Painted pictures (docs/TRADER-SYSTEM-ART-PLAN.md) are looked up by `../art.ts` and live in `../art/paint/`:
 *   planets/<kind>-<surface>.webp (1024 × 512) and planets/<kind>-<surface>-hd.webp (4096 × 2048), plus -normal / -normal-hd
 *   night/<kind>.webp, clouds/<cloudKind>.webp (+ -hd), suns/<sunKind>.webp, rings/<ringKind>.webp, moons/<look>.webp,
 *   skies/<background>.webp (2048 × 1024) and skies/<background>-hd.webp (8192 × 4096), tech/<name>.webp,
 *   postcards/<lifeKind>-<creature>.webp, buttons/<group>-<key>.webp
 * Any missing picture falls back to one drawn in code, so the viewer works with no paintings at all.
 */
import type { SystemDesign } from '../../../../../shared/trader/system';

export type GraphicsLevel = 'incredible' | 'normal' | 'simple';

export interface ViewerOptions {
  /** 'auto' (the default) times the first frames and picks; the pupil can change it in the viewer. */
  level?: GraphicsLevel | 'auto';
  /** Draw planned (not yet built) pieces as see-through holograms. Off in the gallery. */
  showPlans?: boolean;
  /** The names the pupil gave, floating by each planet. */
  labels?: boolean;
  /** No camera flights or spinning (prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** Drag, zoom and tap. Off for still pictures (gallery thumbnails). */
  interactive?: boolean;
  /** A planet was tapped (its id), or empty space (null). */
  onPick?: (planetId: number | null) => void;
  /** The level in use changed (after 'auto' decided, or the pupil picked). */
  onLevel?: (level: GraphicsLevel) => void;
}

export interface SystemViewer {
  /** Redraw for a changed design. Cheap: only what changed is rebuilt. */
  setDesign(design: SystemDesign): void;
  /** Fly to a planet (its id), the sun ('sun'), or back to the whole system (null). */
  focus(target: number | 'sun' | null): void;
  /** The cinematic tour: the camera flies round by itself until turned off or the pupil drags. */
  tour(on: boolean): void;
  /** How fast the planets go round: 0 (paused), 1, 4 or 16. */
  setSpeed(speed: number): void;
  setLabels(on: boolean): void;
  setLevel(level: GraphicsLevel): void;
  readonly level: GraphicsLevel;
  /** A still picture of the system now, as a .webp, without labels (photo mode, the gallery, the profile album). */
  snapshot(width: number, height: number): Promise<Blob>;
  /** Stop drawing and free the GPU. */
  dispose(): void;
}

export type CreateViewer = (container: HTMLElement, design: SystemDesign, options?: ViewerOptions) => Promise<SystemViewer>;
