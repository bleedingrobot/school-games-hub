/**
 * One level of Gem Keep: the map (a canvas run by GameEngine) and everything around it,
 * as ordinary React: the Keep's health, mana, wave controls, the gem forge, the gem bag and
 * the panel for the chosen tile, tower or gem.
 *
 * Everything works by tapping (no dragging), with a mouse, and with the keyboard: every
 * control is a real button, and the map takes arrow keys and Enter.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { GEM, KEEP_HEALTH, MATHS, SPEEDS, TOWER } from '../../../../shared/gem-keep/config';
import { canBuildOn, isBossWave, towerAt, type Action, type GemPlace, type GameState } from '../../../../shared/gem-keep/engine';
import { combineCost, combineProblem, COLOURS, shotStats, type Colour, type Gem } from '../../../../shared/gem-keep/gems';
import type { LevelData } from '../../../../shared/gem-keep/level';
import type { QuestionContext, SkillPack } from '../../../../shared/maths/skillPack';
import { TimesTables } from '../../../../shared/maths/skillPacks/timesTables';
import { hasBoard } from '../art';
import { GameEngine } from '../engine/GameEngine';
import { DEFAULT_SETTINGS, type GemKeepSettings } from '../settings';
import { COLOUR_INFO, COLOUR_NAMES, REFUSALS, TEXT } from '../strings';
import { GemIcon } from './GemIcon';
import { MathsRound, type RoundResult } from './MathsRound';
import '../gem-keep.css';

/** How a level ended, for saving. */
export interface LevelEnd {
  result: 'won' | 'lost';
  stars: number;
  /** Waves started. */
  waves: number;
  /** Seconds of play (game time). */
  gameSeconds: number;
}

/** Remembers "Brighter map" on this device. */
const BRIGHTER_KEY = 'gem-keep-brighter';

type Selection = { kind: 'tile'; x: number; y: number } | { kind: 'tower'; x: number; y: number } | { kind: 'gem'; slot: number } | null;

/** The maths question round on screen, if any. */
type Quiz =
  | { kind: 'well'; count: number }
  | { kind: 'forge'; colour: Colour; into: { x: number; y: number } | null }
  | { kind: 'combine'; from: GemPlace; onto: GemPlace; grade: number }
  | { kind: 'gate' }
  | { kind: 'shield' }
  | { kind: 'key' }
  | null;

function gemAt(state: GameState, place: GemPlace): Gem | null {
  if ('slot' in place) return state.inventory[place.slot];
  return towerAt(state, place.x, place.y)?.gem ?? null;
}

function groundName(state: GameState, x: number, y: number): string {
  const tower = towerAt(state, x, y);
  if (tower) return tower.gem ? `tower with a ${TEXT.gemName(tower.gem.grade, tower.gem.colours).toLowerCase()}` : 'empty tower';
  return { grass: 'grass', rock: 'rocks', water: 'water', path: 'path', keep: 'the Keep' }[state.ground[y][x]];
}

export function GemKeepGame({
  level,
  levelNumber = 1,
  settings = DEFAULT_SETTINGS,
  pack: givenPack,
  onEngine,
  timeScale,
  keyDone = false,
  onWin,
  onEnd,
  onKeyPassed,
  onKeyResult,
  onNext,
  onMap,
}: {
  level: LevelData;
  /** Which campaign level this is: decides the times tables asked. */
  levelNumber?: number;
  settings?: GemKeepSettings;
  /** The student's maths records (Phase 5 loads saved ones). */
  pack?: SkillPack;
  onEngine?: (engine: GameEngine) => void;
  /** Tests set 0 to skip the pauses after answers. */
  timeScale?: number;
  /** This level's Level Key was passed before, so a win goes straight on. */
  keyDone?: boolean;
  onWin?: (stars: number) => void;
  /** Every finish, won or lost. */
  onEnd?: (end: LevelEnd) => void;
  onKeyPassed?: () => void;
  /** Every Level Key round, passed or not: right answers out of 10. */
  onKeyResult?: (right: number) => void;
  /** Go to the next level (only given when there is one). */
  onNext?: () => void;
  /** Back to the campaign map. */
  onMap?: () => void;
}) {
  const [engine] = useState(() => new GameEngine(level, Math.floor(Math.random() * 1e9)));
  const [pack] = useState<SkillPack>(() => givenPack ?? new TimesTables());
  const [quiz, setQuiz] = useState<Quiz>(null);
  // Every round gets a new number, so a new round never carries over the last one's answers.
  const [quizNumber, setQuizNumber] = useState(0);
  const openQuiz = useCallback((next: Quiz) => {
    setQuizNumber((n) => n + 1);
    setQuiz(next);
  }, []);
  const [keyResult, setKeyResult] = useState<RoundResult | null>(null);
  const ctx: QuestionContext = useMemo(
    () => ({
      level: levelNumber,
      enabledTables: settings.enabledTables,
      division: settings.division,
      missingFactor: settings.missingFactor,
      multipleChoice: settings.multipleChoice,
    }),
    [levelNumber, settings],
  );
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

  // A painted board means the Crystal Night look; "Brighter map" is remembered on this device.
  const night = hasBoard(level.id);
  useEffect(() => {
    if (!night) return;
    let saved = false;
    try {
      saved = localStorage.getItem(BRIGHTER_KEY) === '1';
    } catch {
      // Storage blocked: start normal.
    }
    if (saved) engine.setBrighter(true);
  }, [engine, night]);
  const toggleBrighter = () => {
    const next = !engine.brighter;
    engine.setBrighter(next);
    try {
      localStorage.setItem(BRIGHTER_KEY, next ? '1' : '0');
    } catch {
      // Storage blocked: it still works until the page closes.
    }
  };

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

  // Combining asks a question first (harder facts for bigger gems). Problems are caught
  // before asking, so nobody answers a question for nothing.
  const combineInto = useCallback(
    (onto: GemPlace) => {
      if (!combining) return false;
      const a = gemAt(engine.state, combining);
      const b = gemAt(engine.state, onto);
      if (!a || !b) return false;
      const problem = combineProblem(a, b);
      if (problem) say(REFUSALS[problem]);
      else if (engine.state.mana < combineCost(a.grade)) say(REFUSALS['no-mana']);
      else openQuiz({ kind: 'combine', from: combining, onto, grade: a.grade });
      return true;
    },
    [combining, engine, say, openQuiz],
  );

  // Calm mode pauses the game while a question is up; Challenge mode slows it down.
  useEffect(() => engine.setQuestion(quiz ? settings.mode : null), [engine, quiz, settings.mode]);

  // Report each finish once, so the map can keep the stars and the level can be saved.
  const reported = useRef(false);
  useEffect(() => {
    const over = state.phase === 'won' || state.phase === 'lost';
    if (over && !reported.current) {
      reported.current = true;
      const won = state.phase === 'won';
      if (won) onWin?.(state.stars);
      onEnd?.({ result: won ? 'won' : 'lost', stars: won ? state.stars : 0, waves: state.wave, gameSeconds: Math.round(state.time) });
    }
    if (!over) reported.current = false;
  });

  // The Keep Shield: offered once, when the Keep first drops low.
  useEffect(() => {
    if (!quiz && state.shield === 'offered' && state.phase === 'wave') openQuiz({ kind: 'shield' });
  });

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
    if (!state.inventory.includes(null)) return say(REFUSALS['inventory-full']);
    if (state.mana < GEM.createCost) return say(REFUSALS['no-mana']);
    // Forging with an empty tower chosen puts the new gem straight in.
    const into = selection?.kind === 'tower' && !towerAt(state, selection.x, selection.y)?.gem ? { x: selection.x, y: selection.y } : null;
    openQuiz({ kind: 'forge', colour, into });
  }

  function forgeNow(colour: Colour, into: { x: number; y: number } | null) {
    if (!run({ type: 'create', colour })) return;
    const newest = engine.state.inventory.reduce(
      (best, g, i) => (g && (best < 0 || g.id > engine.state.inventory[best]!.id) ? i : best),
      -1,
    );
    if (into) run({ type: 'place', slot: newest, x: into.x, y: into.y });
  }

  function startWave() {
    if (isBossWave(level, state.wave + 1)) openQuiz({ kind: 'gate' });
    else run({ type: 'start-wave' });
  }

  function restart() {
    setSelection(null);
    setCombining(null);
    setQuiz(null);
    setKeyResult(null);
    engine.restart();
  }

  const closeQuiz = useCallback(() => setQuiz(null), []);

  function quizRound() {
    if (!quiz) return null;
    const common = { pack, timeScale };
    switch (quiz.kind) {
      case 'well':
        return (
          <MathsRound
            key={quizNumber}
            {...common}
            ctx={ctx}
            count={quiz.count}
            title={TEXT.well}
            note={(_, right) => TEXT.wellNote(right)}
            onMarked={(result) => {
              const before = engine.state.mana;
              run({ type: 'well-answer', correct: result.correct });
              return result.correct ? TEXT.wellReward(engine.state.mana - before, engine.state.wellStreak) : undefined;
            }}
            onFinish={closeQuiz}
            onClose={closeQuiz}
            closeLabel={TEXT.wellDone}
          />
        );
      case 'forge':
      case 'combine':
        return (
          <MathsRound
            key={quizNumber}
            {...common}
            ctx={quiz.kind === 'combine' && MATHS.combineBoxes[quiz.grade]?.length ? { ...ctx, boxes: MATHS.combineBoxes[quiz.grade] } : ctx}
            count={1}
            title={quiz.kind === 'forge' ? TEXT.forgeTitle(quiz.colour) : TEXT.combineTitle}
            note={() => TEXT.forgeNote}
            onFinish={({ right }) => {
              setQuiz(null);
              if (!right) return say(TEXT.forgeMissed);
              if (quiz.kind === 'forge') return forgeNow(quiz.colour, quiz.into);
              if (run({ type: 'combine', from: quiz.from, onto: quiz.onto })) {
                setCombining(null);
                const onto = quiz.onto;
                setSelection('slot' in onto ? { kind: 'gem', slot: onto.slot } : { kind: 'tower', x: onto.x, y: onto.y });
              }
            }}
            onClose={closeQuiz}
            closeLabel={TEXT.cancel}
          />
        );
      case 'gate':
        return (
          <MathsRound
            key={quizNumber}
            {...common}
            ctx={ctx}
            count={MATHS.gate.questions}
            title={TEXT.gateTitle}
            note={TEXT.gateNote}
            onFinish={({ right }) => {
              setQuiz(null);
              if (run({ type: 'start-wave', gateRight: right })) say(TEXT.surge(engine.state.surge));
            }}
          />
        );
      case 'shield':
        return (
          <MathsRound
            key={quizNumber}
            {...common}
            ctx={ctx}
            count={MATHS.shield.questions}
            title={TEXT.shieldTitle}
            note={TEXT.shieldNote}
            onFinish={({ right }) => {
              setQuiz(null);
              const before = engine.state.keep;
              if (run({ type: 'shield', right })) say(TEXT.shielded(engine.state.keep - before));
            }}
          />
        );
      case 'key':
        return (
          <MathsRound
            key={quizNumber}
            {...common}
            ctx={{ ...ctx, onlyFocus: true }}
            count={MATHS.key.questions}
            title={TEXT.keyTitle}
            note={TEXT.keyNote}
            onFinish={(result) => {
              setQuiz(null);
              setKeyResult(result);
              onKeyResult?.(result.right);
              if (result.right >= settings.keyPassMark) onKeyPassed?.();
            }}
          />
        );
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
    <div className="gk" data-night={night || undefined} onKeyDown={keys}>
      <div className="gk-title">
        {onMap && (
          <button type="button" className="gk-map-button" aria-label={TEXT.backToMapLong} onClick={onMap}>
            <span aria-hidden="true">←</span> {TEXT.backToMap}
          </button>
        )}
        <h1 className="gk-title__name">{TEXT.levelHeading(levelNumber, level.name)}</h1>
      </div>
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
          <button
            type="button"
            className="gk-well"
            disabled={over || state.wellLeft === 0}
            aria-label={TEXT.wellLabel(state.wellLeft)}
            onClick={() => openQuiz({ kind: 'well', count: state.wellLeft })}
          >
            <span aria-hidden="true">💧</span> {TEXT.well}{' '}
            <span className="gk-well__left">{state.wellLeft ? state.wellLeft : TEXT.wellResting}</span>
          </button>
        </div>
        <div className="gk-stat">
          <span className="gk-stat__value">{TEXT.wave(Math.max(1, state.wave), waves)}</span>
        </div>
        <div className="gk-controls">
          {over ? null : state.phase === 'wave' ? (
            <span className="gk-wave-running">{TEXT.waveRunning}</span>
          ) : (
            <button
              type="button"
              className="button button--play gk-start"
              onClick={startWave}
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
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                {engine.paused ? <path d="M4 2 L16 9 L4 16 Z" fill="currentColor" /> : <path d="M3 2 h4 v14 h-4 Z M11 2 h4 v14 h-4 Z" fill="currentColor" />}
              </svg>
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
          {night && (
            <button type="button" className="gk-bright" aria-pressed={engine.brighter} aria-label={TEXT.brighter} title={TEXT.brighter} onClick={toggleBrighter}>
              <span aria-hidden="true">☀</span>
            </button>
          )}
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
          {over && (
            <EndCard
              state={state}
              keyResult={keyResult}
              keyDone={keyDone}
              passMark={settings.keyPassMark}
              onKey={() => openQuiz({ kind: 'key' })}
              onAgain={restart}
              onNext={onNext}
              onMap={onMap}
            />
          )}
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
                  <GemIcon colours={[colour]} size={36} />
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
      {quizRound()}
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
    <section className="gk-chosen" aria-label={TEXT.tower(tower.level)}>
      <h2 className="gk-section__title">{TEXT.tower(tower.level)}</h2>
      {tower.gem ? <GemLine gem={tower.gem} /> : <p>{TEXT.towerEmpty}</p>}
      {stats && <p className="gk-stats">{TEXT.stats(stats.damage, stats.rate, stats.range)}</p>}
      <div className="gk-actions">
        {tower.level < TOWER.maxLevel ? (
          <button
            type="button"
            className="button button--primary gk-small"
            disabled={state.mana < upgradeCost}
            aria-label={TEXT.upgrade(upgradeCost)}
            onClick={() => run({ type: 'upgrade', x, y })}
          >
            {TEXT.upgradeShort} <span className="gk-price">◆{upgradeCost}</span>
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
          <button type="button" className="button gk-small" aria-label={TEXT.takeOut} onClick={() => run({ type: 'take-out', x, y })}>
            {TEXT.takeOutShort}
          </button>
        )}
      </div>
      <div className="gk-targeting" role="radiogroup" aria-label={TEXT.targeting}>
        <span className="gk-targeting__label" aria-hidden="true">
          {TEXT.targeting}
        </span>
        {(['first', 'strongest'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={tower.targeting === mode}
            className="gk-toggle"
            onClick={() => run({ type: 'targeting', x, y, mode })}
          >
            {TEXT.targetingNames[mode]}
          </button>
        ))}
      </div>
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

function EndCard({
  state,
  keyResult,
  keyDone,
  passMark,
  onKey,
  onAgain,
  onNext,
  onMap,
}: {
  state: GameState;
  keyResult: RoundResult | null;
  keyDone: boolean;
  passMark: number;
  onKey: () => void;
  onAgain: () => void;
  onNext?: () => void;
  onMap?: () => void;
}) {
  const won = state.phase === 'won';
  const passed = !!keyResult && keyResult.right >= passMark;
  const open = keyDone || passed;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [keyResult]);
  // The main button: the Level Key until it's passed, then the next level, else play again.
  const main = !won
    ? { label: TEXT.tryAgain, run: onAgain }
    : !open
      ? { label: keyResult ? TEXT.keyAgain : TEXT.keyStart, run: onKey }
      : onNext
        ? { label: TEXT.nextLevel, run: onNext }
        : { label: TEXT.playAgain, run: onAgain };
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
        {won && !open && !keyResult && <p className="gk-key">{TEXT.keyIntro(passMark)}</p>}
        {keyResult && (
          <div className="gk-key" role="status" data-passed={passed || undefined}>
            <p>{passed ? TEXT.keyPassed(keyResult.right) : TEXT.keyFailed(keyResult.right, passMark)}</p>
            {!passed && keyResult.missed.length > 0 && (
              <>
                <p className="gk-key__label">{TEXT.keyPractise}</p>
                <ul className="gk-key__missed">
                  {keyResult.missed.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="gk-end__actions">
          <button ref={first} type="button" className="button button--play" onClick={main.run}>
            {main.label}
          </button>
          {main.run !== onAgain && (
            <button type="button" className="button gk-small" onClick={onAgain}>
              {won ? TEXT.playAgain : TEXT.tryAgain}
            </button>
          )}
          {onMap && (
            <button type="button" className="button gk-small" onClick={onMap}>
              {TEXT.backToMapLong}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
