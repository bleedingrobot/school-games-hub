/**
 * Maths Monsters, the world: walk around, talk, find wild monsters in the long grass, meet
 * trainers, heal. The map is a canvas (pixel art); everything you read or press (the talk box,
 * the settings, the team strip, the arrows) is normal HTML so screen readers work. Battles are
 * the N.3 `BattleScreen`, shown in place of the map and handing the new team back.
 *
 * Nothing is saved: the game lives in memory (stage N.6 saves it).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SkillPack } from '../../../../shared/maths/skillPack';
import type { TopicId } from '../../../../shared/maths/skillPacks';
import type { BattleSetup } from '../../../../shared/monsters/engine';
import { maxHpOf } from '../../../../shared/monsters/rules';
import { RAW_MAPS, WORLD_MAPS } from '../../../../shared/monsters/maps';
import type { TiledMap } from '../../../../shared/monsters/world/mapLoader';
import type { Dir, GameMap, Thing, WorldState } from '../../../../shared/monsters/world/types';
import { afterBattle, placeAt, trainerBattle, wildBattle, type InteractOutcome, type Maps, type WorldOptions } from '../../../../shared/monsters/world/world';
import { BattleScreen, type BattleResult } from '../BattleScreen';
import { MonsterArt } from '../art/MonsterArt';
import { nameOf } from '../text';
import { WalkController, type ControllerEvents } from './controller';
import { drawFrame, scaleFor, tileAt, type Scene } from './render';
import type { WorldSettings } from './settings';
import { loadSheets, paintMap, TileCache } from './tiles';
import './world.css';

export interface WorldGameProps {
  initial: WorldState;
  settings: WorldSettings;
  onSettingsChange: (s: WorldSettings) => void;
  maps?: Maps;
  rawMaps?: Record<string, TiledMap>;
  /** The test page's "More battles" switch. */
  fast?: boolean;
  /** Change `nonce` to move the player: the test page's "Teleport to". */
  teleport?: { nonce: number; map: string; x: number; y: number; facing?: Dir };
  /** True while a battle has the screen (so the test page can hide its own chrome). */
  onBattling?: (on: boolean) => void;
  onState?: (s: WorldState) => void;
  /** Tests pass a fixed random source and fake questions. */
  random?: () => number;
  packFor?: (topic: TopicId) => SkillPack;
  /** Tests set 0 to skip every pause. */
  timeScale?: number;
}

interface TalkState {
  speaker?: string;
  pages: string[];
  at: number;
  after?: () => void;
}

type Scene2 = { kind: 'walk' } | { kind: 'flash'; setup: BattleSetup; trainer?: Thing } | { kind: 'battle'; setup: BattleSetup; trainer?: Thing; key: number };

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};
const TALK_KEYS = new Set([' ', 'Enter', 'e', 'E']);

export function WorldGame({
  initial, settings, onSettingsChange, maps = WORLD_MAPS, rawMaps = RAW_MAPS, fast = false, teleport, onBattling, onState, random, packFor, timeScale = 1,
}: WorldGameProps) {
  const [world, setWorld] = useState<WorldState>(initial);
  const [scene, setScene] = useState<Scene2>({ kind: 'walk' });
  const [talk, setTalk] = useState<TalkState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sheets, setSheets] = useState<TileCache | null>(null);
  const [loadError, setLoadError] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1, scale: 2 });
  const scenes = useRef(new Map<string, Scene>());
  const fade = useRef({ at: -1e9 });
  const battleKey = useRef(0);
  const opts = useMemo<WorldOptions>(() => ({ maps, fast }), [maps, fast]);

  // Always-current copies, so the controller's callbacks never use an old one.
  const live = useRef({ scene, talk, showSettings, settings, onState, timeScale });
  live.current = { scene, talk, showSettings, settings, onState, timeScale };

  const ctrl = useRef<WalkController | null>(null);

  const startBattle = useCallback((setup: BattleSetup, trainer?: Thing) => {
    const ts = live.current.timeScale;
    const go = () => setScene({ kind: 'battle', setup, trainer, key: ++battleKey.current });
    if (ts === 0) go();
    else {
      setScene({ kind: 'flash', setup, trainer });
      window.setTimeout(go, 520 * ts);
    }
  }, []);

  const showTalk = useCallback((t: { speaker?: string; pages: string[]; after?: () => void }) => {
    ctrl.current!.lock();
    setTalk({ ...t, at: 0 });
  }, []);

  if (!ctrl.current) {
    const events: ControllerEvents = {
      onState: (s) => {
        setWorld(s);
        live.current.onState?.(s);
      },
      onWild: (t) => startBattle(wildBattle(ctrl.current!.state, t)),
      onTrainer: (trainer) => {
        const state = ctrl.current!.state;
        showTalk({ speaker: trainer.name, pages: trainer.pages, after: () => startBattle(trainerBattle(state, opts, trainer), trainer) });
      },
      onTalk: (out: InteractOutcome) => {
        showTalk({
          speaker: out.talk!.speaker,
          pages: out.talk!.pages,
          after: out.challenge ? () => startBattle(trainerBattle(ctrl.current!.state, opts, out.challenge!), out.challenge) : undefined,
        });
      },
      onEnter: () => {
        fade.current.at = performance.now();
      },
    };
    ctrl.current = new WalkController(initial, opts, events, timeScale);
  }
  useEffect(() => ctrl.current!.setOptions(opts), [opts]);

  // Load the pictures.
  useEffect(() => {
    let live = true;
    loadSheets().then(
      (s) => live && setSheets(new TileCache(s, Object.values(rawMaps)[0].tilesets)),
      () => live && setLoadError(true),
    );
    return () => {
      live = false;
    };
  }, [rawMaps]);

  const sceneFor = (cache: TileCache, map: GameMap): Scene => {
    let s = scenes.current.get(map.id);
    if (!s) {
      s = { map, frames: paintMap(map, rawMaps[map.id], cache), cache };
      scenes.current.set(map.id, s);
    }
    return s;
  };

  // Teleport (test page).
  const lastNonce = useRef(teleport?.nonce);
  useEffect(() => {
    if (!teleport || teleport.nonce === lastNonce.current) return;
    lastNonce.current = teleport.nonce;
    setTalk(null);
    setShowSettings(false);
    setScene({ kind: 'walk' });
    ctrl.current!.unlock();
    ctrl.current!.jump({ ...placeAt(ctrl.current!.state, teleport.map, teleport.x, teleport.y, teleport.facing), beaten: [] });
  }, [teleport]);

  const walking = scene.kind === 'walk' && !talk && !showSettings;
  useEffect(() => {
    onBattling?.(scene.kind === 'battle');
  }, [scene.kind, onBattling]);

  // Walking is locked whenever something else has the screen.
  useEffect(() => {
    if (walking) ctrl.current!.unlock();
    else ctrl.current!.lock();
  }, [walking]);

  // The clock for walking: about 60 times a second, on a timer so it also runs in tests.
  useEffect(() => {
    const id = window.setInterval(() => ctrl.current!.tick(performance.now()), 16);
    return () => window.clearInterval(id);
  }, []);

  // Drawing.
  useEffect(() => {
    const el = canvas.current;
    const holder = stage.current;
    if (!el || !holder || !sheets || scene.kind !== 'walk') return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const r = holder.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { w: Math.max(1, Math.round(r.width * dpr)), h: Math.max(1, Math.round(r.height * dpr)), dpr, scale: scaleFor(r.height, dpr) };
      el.width = size.current.w;
      el.height = size.current.h;
      lastKey = '';
    };
    let lastKey = '';
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const c = ctrl.current!;
      const view = c.view(now);
      const sc = sceneFor(sheets, maps[view.state.map]);
      const f = Math.max(0, 1 - (now - fade.current.at) / 280);
      const water = sc.frames.length > 1 ? Math.floor(now / 700) % 2 : 0;
      const actors = [...view.actors].map(([id, a]) => `${id}${a.x.toFixed(2)}${a.y.toFixed(2)}${a.facing}`).join();
      const key = `${view.x.toFixed(3)},${view.y.toFixed(3)},${view.state.facing},${view.state.map},${water},${f.toFixed(2)},${view.noticed},${actors},${view.walking}`;
      if (key === lastKey) return;
      lastKey = key;
      const t0 = performance.now();
      drawFrame(ctx, { width: size.current.w, height: size.current.h, scale: size.current.scale, scene: sc, view, now, fade: f });
      perf.draws += 1;
      perf.drawMs += performance.now() - t0;
      perf.worst = Math.max(perf.worst, performance.now() - t0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(holder);
    resize();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, scene.kind, maps, rawMaps]);

  const advance = useCallback(() => {
    const t = live.current.talk;
    if (!t) return;
    if (t.at + 1 < t.pages.length) setTalk({ ...t, at: t.at + 1 });
    else {
      setTalk(null);
      t.after?.();
      stage.current?.focus();
    }
  }, []);

  // The keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, select, textarea, [role="dialog"], .mb')) return;
      const L = live.current;
      if (L.scene.kind !== 'walk') return;
      if (L.showSettings) {
        if (e.key === 'Escape') setShowSettings(false);
        return;
      }
      if (L.talk) {
        if (TALK_KEYS.has(e.key) || e.key === 'Escape') {
          if (target?.closest('.mw-talk__next')) return; // the button handles its own press
          e.preventDefault();
          advance();
        }
        return;
      }
      const dir = KEYS[e.key];
      if (dir) {
        e.preventDefault();
        if (!e.repeat) ctrl.current!.press(dir, performance.now());
      } else if (TALK_KEYS.has(e.key) && !target?.closest('button')) {
        e.preventDefault();
        if (!e.repeat) ctrl.current!.talk();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const dir = KEYS[e.key];
      if (dir) ctrl.current!.release(dir);
    };
    const onBlur = () => (['up', 'down', 'left', 'right'] as Dir[]).forEach((d) => ctrl.current!.release(d));
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [advance]);

  // Focus the Next button when someone starts talking, so Space / Enter work and screen readers land there.
  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (talk) nextButton.current?.focus({ preventScroll: true });
  }, [talk?.at, !!talk]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCanvasTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (live.current.talk) {
      advance();
      return;
    }
    if (!walking) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * size.current.w;
    const py = ((e.clientY - r.top) / r.height) * size.current.h;
    const view = ctrl.current!.view(performance.now());
    const [tx, ty] = tileAt(px, py, { width: size.current.w, height: size.current.h, scale: size.current.scale, scene: scenes.current.get(view.state.map)!, view });
    ctrl.current!.tap(tx, ty);
  };

  const finishBattle = (result: BattleResult) => {
    const c = ctrl.current!;
    const trainer = scene.kind === 'battle' ? scene.trainer : undefined;
    const next = afterBattle(c.state, result, trainer);
    c.jump(next);
    setScene({ kind: 'walk' });
    if (result.outcome === 'lost') {
      showTalk({ speaker: undefined, pages: ['Your team is tired, so you hurried back to the Healing Centre. Everyone is rested and nothing was lost!'] });
    }
  };

  const map = maps[world.map];
  const dpadButton = (dir: Dir, label: string, glyph: string) => (
    <button
      key={dir}
      type="button"
      className={`mw-dpad__${dir}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        ctrl.current!.press(dir, performance.now());
      }}
      onPointerUp={() => ctrl.current!.release(dir)}
      onPointerCancel={() => ctrl.current!.release(dir)}
      onClick={(e) => {
        if (e.detail === 0) {
          ctrl.current!.press(dir, performance.now());
          ctrl.current!.release(dir);
        }
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );

  if (scene.kind === 'battle') {
    return (
      <div className="mw-battle">
        <h1 className="sr-only">Maths Monsters battle</h1>
        <BattleScreen
          key={scene.key}
          setup={scene.setup}
          settings={settings}
          onSettingsChange={(s) => onSettingsChange({ ...settings, ...s })}
          onFinish={finishBattle}
          random={random}
          packFor={packFor}
          timeScale={timeScale}
        />
      </div>
    );
  }

  return (
    <div className="mw">
      <h1 className="sr-only">Maths Monsters</h1>
      <p className="sr-only" role="status">{`You are in ${map.name}.`}</p>
      <div className={`mw-stage${scene.kind === 'flash' ? ' is-flash' : ''}`} ref={stage} tabIndex={-1}>
        <canvas
          ref={canvas}
          className="mw-canvas"
          role="img"
          aria-label={`The map of ${map.name}. Walk with the arrow keys or W A S D, or tap a spot. Press Space to talk.`}
          onPointerDown={onCanvasTap}
        />
        {!sheets && <p className="mw-loading">{loadError ? 'The map pictures did not load. Try reloading.' : 'Loading the map…'}</p>}
        <div className="mw-hud">
          <span className="mw-place">{map.name}</span>
          <ul className="mw-team" aria-label="Your team">
            {world.team.map((m, i) => {
              const hp = m.hp / maxHpOf(m);
              return (
                <li key={i} aria-label={`${nameOf(m.species)}, level ${m.level}, ${hp >= 1 ? 'full health' : hp <= 0 ? 'tired' : `${Math.round(hp * 100)} percent health`}`}>
                  <MonsterArt species={m.species} shiny={m.shiny} size={30} still />
                  <span className="mw-team__bar" aria-hidden="true"><span style={{ width: `${Math.round(hp * 100)}%` }} className={hp < 0.3 ? 'is-low' : ''} /></span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="mw-gear" onClick={() => setShowSettings(true)} aria-haspopup="dialog">Settings</button>
        </div>
        {settings.dpad && (
          <div className="mw-controls">
            <div className="mw-dpad">
              {dpadButton('up', 'Walk up', '▲')}
              {dpadButton('left', 'Walk left', '◀')}
              {dpadButton('right', 'Walk right', '▶')}
              {dpadButton('down', 'Walk down', '▼')}
            </div>
            <button type="button" className="mw-talkbtn" onClick={() => ctrl.current!.talk()}>Talk</button>
          </div>
        )}
        {showSettings && (
          <div className="mw-settings" role="dialog" aria-label="Settings" aria-modal="true">
            <h2>Settings</h2>
            <label><input type="checkbox" checked={settings.calm} onChange={(e) => onSettingsChange({ ...settings, calm: e.target.checked })} /> Calm (no quick-answer bonus, nothing timed)</label>
            <label><input type="checkbox" checked={settings.multipleChoice} onChange={(e) => onSettingsChange({ ...settings, multipleChoice: e.target.checked })} /> Choose answers (instead of the number pad)</label>
            <label><input type="checkbox" checked={settings.dpad} onChange={(e) => onSettingsChange({ ...settings, dpad: e.target.checked })} /> On-screen arrows (for touch screens)</label>
            <button type="button" className="mw-btn" onClick={() => setShowSettings(false)} autoFocus>Done</button>
          </div>
        )}
      </div>
      <div className="mw-talk" onClick={talk ? advance : undefined}>
        <div className="mw-talk__text" role="status" aria-live="polite" aria-atomic="true">
          {talk && (
            <>
              {talk.speaker && <strong className="mw-talk__who">{talk.speaker}: </strong>}
              {talk.pages[talk.at]}
            </>
          )}
        </div>
        {talk ? (
          <button type="button" className="mw-talk__next mw-btn" ref={nextButton} onClick={(e) => { e.stopPropagation(); advance(); }}>
            {talk.at + 1 < talk.pages.length ? 'Next' : 'Done'}
          </button>
        ) : (
          <p className="mw-talk__hint">Arrow keys or W A S D to walk · Space to talk · or tap the map</p>
        )}
      </div>
    </div>
  );
}

/** Drawing cost, kept for the test page's smoothness check (read from the browser console: `__mmPerf`). */
const perf = { draws: 0, drawMs: 0, worst: 0 };
(globalThis as { __mmPerf?: typeof perf }).__mmPerf = perf;
