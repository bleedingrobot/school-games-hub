/**
 * One level of Gem Keep: the map (a canvas run by GameEngine) and everything around it,
 * as ordinary React: the Keep's health, mana, wave controls, the gem forge, the gem bag and
 * the panel for the chosen tile, tower or gem.
 *
 * Everything works by tapping (no dragging), with a mouse, and with the keyboard: every
 * control is a real button, and the map takes arrow keys and Enter.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GEM, KEEP_HEALTH, SPEEDS, TOWER } from '../../../../shared/gem-keep/config';
import { canBuildOn, isBossWave, towerAt, type Action, type GemPlace, type GameState } from '../../../../shared/gem-keep/engine';
import { combineCost, COLOURS, shotStats, type Colour, type Gem } from '../../../../shared/gem-keep/gems';
import type { LevelData } from '../../../../shared/gem-keep/level';
import { GameEngine } from '../engine/GameEngine';
import { COLOUR_INFO, COLOUR_NAMES, REFUSALS, TEXT } from '../strings';
import { GemIcon } from './GemIcon';
import '../gem-keep.css';

type Selection = { kind: 'tile'; x: number; y: number } | { kind: 'tower'; x: number; y: number } | { kind: 'gem'; slot: number } | null;

function gemAt(state: GameState, place: GemPlace): Gem | null {
  if ('slot' in place) return state.inventory[place.slot];
  return towerAt(state, place.x, place.y)?.gem ?? null;
}

function groundName(state: GameState, x: number, y: number): string {
  const tower = towerAt(state, x, y);
  if (tower) return tower.gem ? `tower with a ${TEXT.gemName(tower.gem.grade, tower.gem.colours).toLowerCase()}` : 'empty tower';
  return { grass: 'grass', rock: 'rocks', water: 'water', path: 'path', keep: 'the Keep' }[state.ground[y][x]];
}

export function GemKeepGame({ level, onEngine }: { level: LevelData; onEngine?: (engine: GameEngine) => void }) {
  const [engine] = useState(() => new GameEngine(level, Math.floor(Math.random() * 1e9)));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useSyncExternalStore(
    useCallback((notify: () => void) => engine.on('change', notify), [engine]),
    () => engine.version,
  );
  const state = engine.state;
  const [selection, setSelection] = useState<Selection>(null);
  const [combining, setCombining] = useState<GemPlace | null>(null);
  const [message, setMessage] = useState('');
  const messageTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    onEngine?.(engine);
    return engine.attach(canvasRef.current!);
  }, [engine, onEngine]);

  const say = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 3000);
  }, []);

  const run = useCallback(
    (action: Action) => {
      const result = engine.act(action);
      if (!result.ok) say(REFUSALS[result.reason]);
      return result.ok;
    },
    [engine, say],
  );

  const combineInto = useCallback(
    (onto: GemPlace) => {
      if (!combining) return false;
      if (run({ type: 'combine', from: combining, onto })) {
        setCombining(null);
        setSelection('slot' in onto ? { kind: 'gem', slot: onto.slot } : { kind: 'tower', x: onto.x, y: onto.y });
      }
      return true;
    },
    [combining, run],
  );

  // Taps on the map.
  useEffect(
    () =>
      engine.on('tile', ({ x, y }) => {
        const s = engine.state;
        const tower = towerAt(s, x, y);
        if (combining && tower?.gem) {
          combineInto({ x, y });
          return;
        }
        setCombining(null);
        if (selection?.kind === 'gem' && tower) {
          if (run({ type: 'place', slot: selection.slot, x, y })) setSelection({ kind: 'tower', x, y });
          return;
        }
        const same = selection && selection.kind !== 'gem' && selection.x === x && selection.y === y;
        if (same) setSelection(null);
        else if (tower) setSelection({ kind: 'tower', x, y });
        else if (canBuildOn(s, [x, y])) setSelection({ kind: 'tile', x, y });
        else {
          setSelection(null);
          say(TEXT.cantBuild);
        }
      }),
    [engine, selection, combining, combineInto, run, say],
  );

  // What the map highlights.
  useEffect(() => {
    const from = combining ? gemAt(state, combining) : null;
    const glowTowers: [number, number][] = state.towers
      .filter((t) =>
        from ? t.gem && t.gem.id !== from.id && t.gem.grade === from.grade : selection?.kind === 'gem',
      )
      .map((t) => [t.x, t.y]);
    engine.setView({
      selectedTile: selection && selection.kind !== 'gem' ? [selection.x, selection.y] : null,
      ghost: selection?.kind === 'tile' && canBuildOn(state, [selection.x, selection.y]),
      glowTowers,
    });
  });

  // A selected tile that now has a tower is a selected tower.
  useEffect(() => {
    if (selection?.kind === 'tile' && towerAt(state, selection.x, selection.y)) {
      setSelection({ kind: 'tower', x: selection.x, y: selection.y });
    }
  });

  function clickSlot(slot: number) {
    const gem = state.inventory[slot];
    if (combining) {
      if (gem) combineInto({ slot });
      else setCombining(null);
      return;
    }
    if (selection?.kind === 'tower' && gem) {
      run({ type: 'place', slot, x: selection.x, y: selection.y });
      return;
    }
    if (!gem || (selection?.kind === 'gem' && selection.slot === slot)) setSelection(null);
    else setSelection({ kind: 'gem', slot });
  }

  function forge(colour: Colour) {
    if (!run({ type: 'create', colour })) return;
    // Forging with an empty tower chosen puts the new gem straight in.
    const newest = state.inventory.reduce((best, g, i) => (g && (best < 0 || g.id > state.inventory[best]!.id) ? i : best), -1);
    if (selection?.kind === 'tower' && !towerAt(state, selection.x, selection.y)?.gem) {
      run({ type: 'place', slot: newest, x: selection.x, y: selection.y });
    }
  }

  const keys = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setCombining(null);
      setSelection(null);
    }
  };

  const waves = level.waves.length;
  const over = state.phase === 'won' || state.phase === 'lost';
  const nextWave = state.wave + 1;
  const keepShare = Math.round((state.keep / KEEP_HEALTH) * 100);

  return (
    <div className="gk" onKeyDown={keys}>
      <p className="gk-note">{TEXT.prototype}</p>
      <div className="gk-hud" role="group" aria-label="Game status">
        <div className="gk-stat gk-stat--keep">
          <span className="gk-stat__label">{TEXT.keep}</span>
          <span className="gk-bar" role="meter" aria-label={TEXT.keep} aria-valuemin={0} aria-valuemax={KEEP_HEALTH} aria-valuenow={state.keep}>
            <span className="gk-bar__fill" style={{ width: `${keepShare}%` }} data-low={keepShare < 25 || undefined} />
          </span>
          <span className="gk-stat__value">{state.keep}</span>
        </div>
        <div className="gk-stat">
          <span className="gk-stat__label">{TEXT.mana}</span>
          <span className="gk-stat__value gk-mana">◆ {state.mana}</span>
        </div>
        <div className="gk-stat">
          <span className="gk-stat__value">{TEXT.wave(Math.max(1, state.wave), waves)}</span>
        </div>
        <div className="gk-controls">
          {state.phase === 'wave' ? (
            <span className="gk-wave-running">{TEXT.waveRunning}</span>
          ) : (
            <button
              type="button"
              className="button button--play gk-start"
              disabled={over}
              onClick={() => run({ type: 'start-wave' })}
            >
              {isBossWave(level, nextWave) ? TEXT.bossWave(Math.min(nextWave, waves)) : TEXT.nextWave(Math.min(nextWave, waves))}
            </button>
          )}
          <div className="gk-speed" role="group" aria-label="Speed">
            <button
              type="button"
              className="gk-speed__button"
              aria-pressed={engine.paused}
              aria-label={engine.paused ? TEXT.resume : TEXT.pause}
              onClick={() => engine.setPaused(!engine.paused)}
            >
              {engine.paused ? '▶' : '⏸'}
            </button>
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className="gk-speed__button"
                aria-pressed={!engine.paused && engine.speed === speed}
                aria-label={TEXT.speed(speed)}
                onClick={() => engine.setSpeed(speed)}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="gk-main">
        <div className="gk-board">
          <canvas ref={canvasRef} className="gk-canvas" tabIndex={0} aria-label={TEXT.boardLabel} />
          <p className="sr-only" aria-live="polite">
            {engine.view.cursor ? TEXT.tileLabel(engine.view.cursor[0], engine.view.cursor[1], groundName(state, ...engine.view.cursor)) : ''}
          </p>
          {engine.paused && !over && (
            <div className="gk-paused" role="status">
              <strong>{TEXT.paused}</strong> {TEXT.pausedHint}
            </div>
          )}
          {over && <EndCard state={state} onAgain={() => { setSelection(null); setCombining(null); engine.restart(); }} />}
          <div className="gk-rotate" aria-hidden="true">
            <span className="gk-rotate__icon">📱↻</span>
            {TEXT.rotate}
          </div>
        </div>

        <aside className="gk-panel" aria-label="Gems and towers">
          <p className="gk-message" aria-live="polite">
            {message}
          </p>
          <ChosenPanel
            state={state}
            selection={selection}
            combining={combining}
            run={run}
            onCombine={(from) => setCombining(from)}
            onCancel={() => {
              setCombining(null);
              setSelection(null);
            }}
          />

          <section className="gk-section" aria-labelledby="gk-bag-title">
            <h2 id="gk-bag-title" className="gk-section__title">
              {TEXT.bag}
            </h2>
            <div className="gk-bag">
              {state.inventory.map((gem, slot) => {
                const chosen = selection?.kind === 'gem' && selection.slot === slot;
                const from = combining ? gemAt(state, combining) : null;
                const match = !!(from && gem && gem.id !== from.id && gem.grade === from.grade);
                return (
                  <button
                    key={slot}
                    type="button"
                    className="gk-slot"
                    data-chosen={chosen || undefined}
                    data-match={match || undefined}
                    aria-pressed={chosen}
                    aria-label={gem ? TEXT.gemName(gem.grade, gem.colours) : TEXT.emptySlot(slot + 1)}
                    onClick={() => clickSlot(slot)}
                  >
                    {gem && <GemIcon colours={gem.colours} grade={gem.grade} size={34} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="gk-section" aria-labelledby="gk-forge-title">
            <h2 id="gk-forge-title" className="gk-section__title">
              {TEXT.forge} <span className="gk-cost">{TEXT.cost(GEM.createCost)}</span>
            </h2>
            <div className="gk-forge">
              {COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  className="gk-forge__button"
                  disabled={over || state.mana < GEM.createCost}
                  onClick={() => forge(colour)}
                >
                  <GemIcon colours={[colour]} size={30} />
                  <span>
                    <strong>{COLOUR_NAMES[colour]}</strong>
                    <small>{COLOUR_INFO[colour].power}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ChosenPanel({
  state,
  selection,
  combining,
  run,
  onCombine,
  onCancel,
}: {
  state: GameState;
  selection: Selection;
  combining: GemPlace | null;
  run: (action: Action) => boolean;
  onCombine: (from: GemPlace) => void;
  onCancel: () => void;
}) {
  if (combining) {
    const gem = gemAt(state, combining);
    return (
      <section className="gk-chosen" aria-label="Combining">
        {gem && <GemLine gem={gem} />}
        <p>{TEXT.combineHint}</p>
        {gem && <p className="gk-cost">{TEXT.combineCost(combineCost(gem.grade))}</p>}
        <button type="button" className="button gk-small" onClick={onCancel}>
          {TEXT.cancel}
        </button>
      </section>
    );
  }
  if (!selection) return null;

  if (selection.kind === 'gem') {
    const gem = state.inventory[selection.slot];
    if (!gem) return null;
    return (
      <section className="gk-chosen" aria-label="Chosen gem">
        <GemLine gem={gem} />
        <p>{TEXT.placeHint}</p>
        <div className="gk-actions">
          {gem.grade < GEM.maxGrade && (
            <button type="button" className="button gk-small" onClick={() => onCombine({ slot: selection.slot })}>
              {TEXT.combine}
            </button>
          )}
          <button type="button" className="button gk-small" onClick={onCancel}>
            {TEXT.cancel}
          </button>
        </div>
      </section>
    );
  }

  const { x, y } = selection;
  const tower = towerAt(state, x, y);
  if (!tower) {
    return (
      <section className="gk-chosen" aria-label="Chosen tile">
        <p>{TEXT.buildHint}</p>
        <div className="gk-actions">
          <button
            type="button"
            className="button button--primary gk-small"
            disabled={state.mana < TOWER.buildCost}
            onClick={() => run({ type: 'build', x, y })}
          >
            {TEXT.build(TOWER.buildCost)}
          </button>
          <button type="button" className="button gk-small" onClick={onCancel}>
            {TEXT.cancel}
          </button>
        </div>
      </section>
    );
  }

  const stats = tower.gem ? shotStats(tower.gem, tower.level) : null;
  const upgradeCost = TOWER.upgradeCost[tower.level - 1];
  return (
    <section className="gk-chosen" aria-label="Chosen tower">
      <h2 className="gk-section__title">{TEXT.tower(tower.level)}</h2>
      {tower.gem ? <GemLine gem={tower.gem} /> : <p>{TEXT.towerEmpty}</p>}
      {stats && <p className="gk-stats">{TEXT.stats(stats.damage, stats.rate, stats.range)}</p>}
      {!tower.gem ? null : <p className="gk-hint">{TEXT.pickGemHint}</p>}
      <div className="gk-actions">
        {tower.level < TOWER.maxLevel ? (
          <button
            type="button"
            className="button button--primary gk-small"
            disabled={state.mana < upgradeCost}
            onClick={() => run({ type: 'upgrade', x, y })}
          >
            {TEXT.upgrade(upgradeCost)}
          </button>
        ) : (
          <span className="gk-max">{TEXT.maxLevel}</span>
        )}
        {tower.gem && tower.gem.grade < GEM.maxGrade && (
          <button type="button" className="button gk-small" onClick={() => onCombine({ x, y })}>
            {TEXT.combine}
          </button>
        )}
        {tower.gem && (
          <button type="button" className="button gk-small" onClick={() => run({ type: 'take-out', x, y })}>
            {TEXT.takeOut}
          </button>
        )}
      </div>
      <fieldset className="gk-targeting">
        <legend>{TEXT.targeting}</legend>
        {(['first', 'strongest'] as const).map((mode) => (
          <label key={mode} className="gk-radio">
            <input
              type="radio"
              name="gk-targeting"
              checked={tower.targeting === mode}
              onChange={() => run({ type: 'targeting', x, y, mode })}
            />
            {TEXT.targetingNames[mode]}
          </label>
        ))}
      </fieldset>
    </section>
  );
}

function GemLine({ gem }: { gem: Gem }) {
  return (
    <p className="gk-gem-line">
      <GemIcon colours={gem.colours} grade={gem.grade} size={40} />
      <span>
        <strong>{TEXT.gemName(gem.grade, gem.colours)}</strong>
        <small>{gem.colours.map((c) => COLOUR_INFO[c].power).join(' + ')}</small>
      </span>
    </p>
  );
}

function EndCard({ state, onAgain }: { state: GameState; onAgain: () => void }) {
  const won = state.phase === 'won';
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
  return (
    <div className="gk-end" role="dialog" aria-modal="false" aria-labelledby="gk-end-title">
      <div className="gk-end__card">
        <h2 id="gk-end-title">{won ? TEXT.wonTitle : TEXT.lostTitle}</h2>
        {won && (
          <p className="gk-stars" aria-label={TEXT.stars(state.stars)}>
            {[1, 2, 3].map((n) => (
              <span key={n} data-on={n <= state.stars || undefined} aria-hidden="true">
                ★
              </span>
            ))}
          </p>
        )}
        <p>{won ? TEXT.wonBody(Math.round((state.keep / KEEP_HEALTH) * 100)) : TEXT.lostBody}</p>
        <button ref={button} type="button" className="button button--play" onClick={onAgain}>
          {won ? TEXT.playAgain : TEXT.tryAgain}
        </button>
      </div>
    </div>
  );
}
