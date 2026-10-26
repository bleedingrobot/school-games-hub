/**
 * Runs a Gem Keep game on a canvas: the fixed-step loop, drawing, taps and keys, pausing
 * and speed. It lives outside React. The page talks to it through a few methods and the
 * events below, and reads `engine.state` whenever `version` changes.
 */
import { GRID_COLUMNS, GRID_ROWS, MATHS, STEP, TILE } from '../../../../shared/gem-keep/config';
import { act, newGame, step, type Action, type ActResult, type GameEvent, type GameState } from '../../../../shared/gem-keep/engine';
import type { LevelData } from '../../../../shared/gem-keep/level';
import { hasBoard, onPictureLoaded, preloadLevel } from '../art';
import { clearSprites, drawFrame, drawGround, HEIGHT, newFx, WIDTH, type Fx, type Particle, type View } from '../render/draw';
import { GEM_COLOURS } from '../render/shapes';

export interface EngineEvents {
  /** Something the page shows changed (mana, health, wave, towers, gems, pause). */
  change: void;
  /** Something happened in the game. */
  game: GameEvent;
  /** The student tapped or clicked a tile (or pressed Enter on it). */
  tile: { x: number; y: number };
}

type Listener<T> = (value: T) => void;

/** Most particles alive at once; the oldest are reused. */
const MAX_PARTICLES = 240;
/** Never run more than this many steps for one frame (a slow device catches up slowly, not freezes). */
const MAX_STEPS_PER_FRAME = 8;

export class GameEngine {
  state: GameState;
  /** Goes up whenever the page should re-read the state. */
  version = 0;
  speed = 1;
  paused = false;
  /** A maths question is on screen: Calm mode pauses, Challenge mode slows down. */
  question: 'calm' | 'challenge' | null = null;
  /** What the map highlights (chosen tile, keyboard cursor and so on). */
  view: View = { selectedTile: null, hoverTile: null, cursor: null, glowTowers: [], ghost: false };
  /** Frames drawn in the last second, for the stress test. */
  fps = 0;
  /** Draw a painted night board lighter (projectors, bright rooms). */
  brighter = false;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ground: HTMLCanvasElement | null = null;
  private scale = 1;
  private frame = 0;
  private last = 0;
  private carry = 0;
  private particles: Particle[] = [];
  private nextParticle = 0;
  private listeners: { [K in keyof EngineEvents]: Set<Listener<EngineEvents[K]>> } = {
    change: new Set(),
    game: new Set(),
    tile: new Set(),
  };
  private cleanups: (() => void)[] = [];
  private framesThisSecond = 0;
  private secondStarted = 0;
  private lastChange = 0;
  private reducedMotion = false;
  private fx: Fx = newFx();

  constructor(
    private level: LevelData,
    private seed = 1,
  ) {
    this.state = newGame(level, seed);
  }

  on<K extends keyof EngineEvents>(event: K, listener: Listener<EngineEvents[K]>): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  private emit<K extends keyof EngineEvents>(event: K, value: EngineEvents[K]) {
    for (const listener of this.listeners[event]) listener(value);
  }

  private changed() {
    this.version++;
    this.emit('change', undefined);
  }

  /** Makes a move for the student. */
  act(action: Action): ActResult {
    const result = act(this.state, action);
    if (result.ok) this.drainEvents();
    this.changed();
    return result;
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.paused = false;
    this.changed();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.changed();
  }

  /** Starts the level again from the beginning. */
  restart() {
    this.state = newGame(this.level, ++this.seed);
    this.particles.length = 0;
    this.paused = false;
    this.renderGround();
    this.changed();
  }

  /** Lighter or normal painted board. */
  setBrighter(brighter: boolean) {
    this.brighter = brighter;
    this.renderGround();
    this.changed();
  }

  /** A question opened (in this mode) or closed (null). */
  setQuestion(mode: 'calm' | 'challenge' | null) {
    this.question = mode;
  }

  setView(view: Partial<View>) {
    this.view = { ...this.view, ...view };
  }

  /** Starts drawing on this canvas. Returns a function that stops it. */
  attach(canvas: HTMLCanvasElement): () => void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.fx.reducedMotion = this.reducedMotion;
    this.fx.night = hasBoard(this.level.id);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth || WIDTH;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round((width * HEIGHT * dpr) / WIDTH);
      this.scale = canvas.width / WIDTH;
      this.renderGround();
    };
    resize();
    preloadLevel(this.level.id, this.smallBoard());
    // A painted picture arrived: redraw the kept ground and forget sprites drawn without it.
    const stopPictures = onPictureLoaded(() => {
      clearSprites();
      this.renderGround();
    });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);

    const tileAt = (event: PointerEvent): [number, number] | null => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * GRID_COLUMNS);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * GRID_ROWS);
      return x >= 0 && x < GRID_COLUMNS && y >= 0 && y < GRID_ROWS ? [x, y] : null;
    };
    const down = (event: PointerEvent) => {
      const tile = tileAt(event);
      if (!tile) return;
      this.view.cursor = null;
      this.emit('tile', { x: tile[0], y: tile[1] });
    };
    const move = (event: PointerEvent) => {
      this.view.hoverTile = event.pointerType === 'mouse' ? tileAt(event) : null;
    };
    const leave = () => (this.view.hoverTile = null);
    const key = (event: KeyboardEvent) => {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const cursor = this.view.cursor ?? this.view.selectedTile ?? [0, 0];
      if (moves[event.key]) {
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        this.view.cursor = [
          Math.max(0, Math.min(GRID_COLUMNS - 1, cursor[0] + dx)),
          Math.max(0, Math.min(GRID_ROWS - 1, cursor[1] + dy)),
        ];
        this.changed();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.view.cursor = cursor;
        this.emit('tile', { x: cursor[0], y: cursor[1] });
      }
    };
    const focus = () => {
      this.view.cursor ??= this.view.selectedTile ?? [0, 0];
      this.changed();
    };
    const blur = () => {
      this.view.cursor = null;
      this.changed();
    };
    const visibility = () => {
      if (document.hidden && this.state.phase === 'wave') this.setPaused(true);
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('keydown', key);
    canvas.addEventListener('focus', focus);
    canvas.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);

    this.last = performance.now();
    const loop = (now: number) => {
      this.tick(now);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);

    this.cleanups = [
      stopPictures,
      () => cancelAnimationFrame(this.frame),
      () => observer?.disconnect(),
      () => canvas.removeEventListener('pointerdown', down),
      () => canvas.removeEventListener('pointermove', move),
      () => canvas.removeEventListener('pointerleave', leave),
      () => canvas.removeEventListener('keydown', key),
      () => canvas.removeEventListener('focus', focus),
      () => canvas.removeEventListener('blur', blur),
      () => document.removeEventListener('visibilitychange', visibility),
    ];
    return () => this.detach();
  }

  detach() {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.canvas = null;
    this.ctx = null;
  }

  private renderGround() {
    if (!this.canvas) return;
    const ground = this.ground ?? document.createElement('canvas');
    ground.width = this.canvas.width;
    ground.height = this.canvas.height;
    const ctx = ground.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    drawGround(ctx, this.state, this.smallBoard(), this.brighter);
    this.ground = ground;
  }

  /** Small screens use the 800-wide board. */
  private smallBoard() {
    return (this.canvas?.width ?? WIDTH * 2) <= 900;
  }

  /** One animation frame: run the steps that are due, then draw. */
  private tick(now: number) {
    const elapsed = Math.min(now - this.last, 250) / 1000;
    this.last = now;
    if (now - this.secondStarted >= 1000) {
      this.fps = this.framesThisSecond;
      this.framesThisSecond = 0;
      this.secondStarted = now;
    }
    this.framesThisSecond++;

    const running = !this.paused && this.question !== 'calm' && this.state.phase === 'wave';
    if (running) {
      const speed = this.question === 'challenge' ? this.speed * MATHS.challengeSpeed : this.speed;
      this.carry += elapsed * speed;
      let steps = 0;
      const most = Math.ceil(MAX_STEPS_PER_FRAME * speed);
      while (this.carry >= STEP && steps < most) {
        step(this.state);
        this.carry -= STEP;
        steps++;
      }
      if (steps === most) this.carry = 0;
      const important = this.drainEvents();
      // The page's numbers update at most 5 times a second during a wave, or straight away when it matters.
      if (important || now - this.lastChange > 200) {
        this.lastChange = now;
        this.changed();
      }
    } else {
      this.carry = 0;
    }
    if (!this.paused && this.question !== 'calm') this.moveParticles(elapsed);
    this.draw();
  }

  /** Turns the game's events into particles, and passes them on. True if the page should update now. */
  private drainEvents(): boolean {
    let important = false;
    for (const event of this.state.events) {
      switch (event.type) {
        case 'hit': {
          // Sparks in every colour of the gem, a white flash on the enemy hit, and a gold ring for a critical hit.
          const sparks = event.colours.map((c) => GEM_COLOURS[c].light);
          this.burst(event.x * TILE, event.y * TILE, sparks, event.crit ? 10 : 4, event.crit ? 3.5 : 2.5);
          const target = this.state.enemies.find((e) => e.x === event.x && e.y === event.y);
          if (target) this.fx.flashes.set(target.id, this.fx.now + 0.1);
          if (event.crit) {
            this.ring(event.x * TILE, event.y * TILE, '#ffd23f', 26);
            this.floatText(event.x * TILE, event.y * TILE - 14, '!', '#ffd23f', 22);
          }
          break;
        }
        case 'kill':
          this.burst(event.x * TILE, event.y * TILE, '#ffffff', event.kind === 'boss' ? 24 : 8, 3);
          this.floatText(event.x * TILE, event.y * TILE - 10, `+${event.mana}`, '#c8b6ff', 16);
          important = true;
          break;
        case 'shot':
          break;
        case 'leak':
          if (!this.reducedMotion) this.fx.shakeUntil = this.fx.now + 0.35;
          important = true;
          break;
        default:
          important = true;
      }
      this.emit('game', event);
    }
    this.state.events.length = 0;
    return important;
  }

  private particle(): Particle {
    if (this.particles.length < MAX_PARTICLES) {
      const p: Particle = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, colour: '', size: 1 };
      this.particles.push(p);
      return p;
    }
    const p = this.particles[this.nextParticle];
    this.nextParticle = (this.nextParticle + 1) % MAX_PARTICLES;
    p.text = undefined;
    p.ring = undefined;
    return p;
  }

  private burst(x: number, y: number, colour: string | string[], count: number, size: number) {
    if (this.reducedMotion) count = Math.min(count, 2);
    const colours = typeof colour === 'string' ? [colour] : colour;
    for (let i = 0; i < count; i++) {
      const p = this.particle();
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      Object.assign(p, { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.45, max: 0.45, colour: colours[i % colours.length], size });
    }
  }

  private ring(x: number, y: number, colour: string, size: number) {
    const p = this.particle();
    Object.assign(p, { x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, colour, size, ring: true });
  }

  private floatText(x: number, y: number, text: string, colour: string, size: number) {
    const p = this.particle();
    Object.assign(p, { x, y, vx: 0, vy: this.reducedMotion ? 0 : -40, life: 0.9, max: 0.9, colour, size, text });
  }

  private moveParticles(seconds: number) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= seconds;
      p.x += p.vx * seconds;
      p.y += p.vy * seconds;
      p.vx *= 0.9;
      if (!p.text) p.vy *= 0.9;
    }
  }

  private draw() {
    const { ctx, ground } = this;
    if (!ctx || !ground) return;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.fx.now = performance.now() / 1000;
    drawFrame(ctx, this.state, ground, this.view, this.particles, this.scale, this.fx);
  }
}
