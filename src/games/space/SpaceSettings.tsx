import type { ReactNode } from 'react';
import type { BotLevel } from '../../../shared/botGame';
import { BOT_NAMES } from '../../../shared/space/bot';
import { DESIGNED_BOARDS, DESIGNED_BOARD_IDS, type DesignedBoardId } from '../../../shared/space/boards';
import { parseGalaxyCode, randomGalaxyCode } from '../../../shared/space/galaxy';
import { diceFrom } from '../../../shared/space/random';
import type { GuideTab } from './Guide';
import { NAME_LENGTH, todaysGalaxy, type SpacePrefs, type Speed } from './prefs';

const BOARD_ABOUT: Record<DesignedBoardId, string> = {
  'inner-solar-system': 'Gentle: lots of wormholes, short black holes.',
  nebula: 'Medium: gates and the mystery station.',
  'deep-space': 'Wild: long black holes, a comet and a supernova.',
  'asteroid-belt': 'Quick game: 50 squares.',
};

const LEVEL_ABOUT: Record<BotLevel, string> = {
  'very-easy': 'Uses items at random.',
  easy: 'Uses items sensibly.',
  medium: 'Saves the best items and aims at the leader.',
};

const LEVEL_ORDER: BotLevel[] = ['very-easy', 'easy', 'medium'];

function Chips<T extends string | number | boolean>({
  legend,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="choice-group" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="choice-group__chips">
        {options.map((o) => (
          <label key={String(o.value)} className="chip">
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SpaceSettings({
  prefs,
  onChange,
  level,
  onLevelChange,
  lessMotion,
  onLessMotion,
  problem,
  onStart,
  starting = false,
  saving = false,
  onHelp,
  playerName,
}: {
  prefs: SpacePrefs;
  onChange: (prefs: SpacePrefs) => void;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  lessMotion: boolean;
  onLessMotion: (on: boolean) => void;
  problem: string;
  onStart: () => void;
  /** Waiting for the server's dice seed. */
  starting?: boolean;
  /** Finished games are saved (false in the stand-alone preview). */
  saving?: boolean;
  /** Opens How to play or the Star chart. */
  onHelp: (tab: GuideTab) => void;
  /** The student's own name: the first pass-and-play player unless they type another. */
  playerName: string;
}) {
  const set = <K extends keyof SpacePrefs>(key: K, value: SpacePrefs[K]) => onChange({ ...prefs, [key]: value });
  const galaxyOk = prefs.board !== 'galaxy' || parseGalaxyCode(prefs.galaxy) !== null;
  const pass = prefs.who === 'pass';
  const setName = (i: number, name: string) => set('names', prefs.names.map((n, k) => (k === i ? name : n)));

  return (
    <section className="chess-setup space-setup" aria-labelledby="space-setup-title">
      <h1 id="space-setup-title" className="page-title">
        🚀 Wormholes &amp; Black Holes
      </h1>
      <form
        className="chess-setup__card"
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <p className="space-setup__intro">
          Race your rocket from Earth to the space station. Wormholes zoom you up, black holes pull you down, and stars give you
          items to help you (or slow the others down).
        </p>

        <fieldset className="choice-group">
          <legend>Board</legend>
          <div className="space-setup__boards">
            {[...DESIGNED_BOARD_IDS, 'galaxy' as const].map((id) => (
              <label key={id} className="space-board-choice">
                <input
                  type="radio"
                  name="space-board"
                  checked={prefs.board === id}
                  onChange={() =>
                    onChange({
                      ...prefs,
                      board: id,
                      cosmicEvents: id === 'galaxy' ? prefs.cosmicEvents : DESIGNED_BOARDS[id].cosmicEvents,
                      galaxy: id === 'galaxy' && !prefs.galaxy ? todaysGalaxy() : prefs.galaxy,
                    })
                  }
                />
                <span>
                  <strong>{id === 'galaxy' ? 'Random Galaxy' : DESIGNED_BOARDS[id].name}</strong>
                  <small>{id === 'galaxy' ? 'Type a galaxy code, so your class can all play the same one.' : BOARD_ABOUT[id]}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {prefs.board === 'galaxy' && (
          <div className="space-setup__galaxy">
            <label htmlFor="galaxy-code">Galaxy code</label>
            <div className="space-setup__galaxy-row">
              <input
                id="galaxy-code"
                className="code-form__input"
                value={prefs.galaxy}
                onChange={(e) => set('galaxy', e.target.value)}
                placeholder="Comet-Kiwi-48"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!galaxyOk}
                aria-describedby="galaxy-help"
              />
              <button type="button" className="button button--light-outline" onClick={() => set('galaxy', todaysGalaxy())}>
                Galaxy of the day
              </button>
              <button
                type="button"
                className="button button--light-outline"
                onClick={() => set('galaxy', randomGalaxyCode(diceFrom(Math.random)))}
              >
                New code
              </button>
            </div>
            <p id="galaxy-help" className={`space-setup__hint${galaxyOk ? '' : ' is-bad'}`}>
              {galaxyOk ? `Galaxy of the day is ${todaysGalaxy()}.` : 'Three parts, like Comet-Kiwi-48.'}
            </p>
            <Chips
              legend="Galaxy size"
              name="space-galaxy-size"
              value={prefs.galaxySize}
              onChange={(v) => set('galaxySize', v)}
              options={[
                { value: 100, label: '100 squares' },
                { value: 50, label: '50 squares (quick)' },
              ]}
            />
          </div>
        )}

        <Chips
          legend="Who’s playing"
          name="space-who"
          value={prefs.who}
          onChange={(v) => set('who', v)}
          options={[
            { value: 'bots', label: '🤖 Me vs bots' },
            { value: 'pass', label: '👫 Pass-and-play' },
          ]}
        />
        {pass && (
          <p className="space-setup__hint">
            2 to 4 of you take turns on this device. Pass-and-play games aren’t saved and don’t earn points.
          </p>
        )}

        <div className="space-setup__grid">
          <Chips
            legend="Mode"
            name="space-mode"
            value={prefs.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'cosmic', label: '✨ Cosmic' },
              { value: 'classic', label: 'Classic' },
            ]}
          />
          {pass ? (
            <Chips
              legend="Players"
              name="space-players"
              value={prefs.players}
              onChange={(v) => set('players', v)}
              options={[
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
              ]}
            />
          ) : (
            <Chips
              legend="Bots"
              name="space-bots"
              value={prefs.bots}
              onChange={(v) => set('bots', v)}
              options={[
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
              ]}
            />
          )}
        </div>
        <p className="space-setup__hint">
          {prefs.mode === 'cosmic'
            ? 'Cosmic: stars, items, gravity, gates and everything else.'
            : 'Classic: just wormholes and black holes. No items.'}
        </p>

        {pass ? (
          <fieldset className="choice-group space-setup__names">
            <legend>Names (first one goes first)</legend>
            {Array.from({ length: prefs.players }, (_, i) => (
              <label key={i} className="space-setup__name">
                <span aria-hidden="true">{i + 1}.</span>
                <input
                  aria-label={`Player ${i + 1}`}
                  className="code-form__input"
                  value={prefs.names[i] ?? ''}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder={i === 0 ? playerName : `Player ${i + 1}`}
                  maxLength={NAME_LENGTH}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            ))}
          </fieldset>
        ) : (
        <>
        <Chips
          legend="Bot level"
          name="space-level"
          value={level}
          onChange={onLevelChange}
          options={LEVEL_ORDER.map((l) => ({ value: l, label: BOT_NAMES[l] }))}
        />
        <p className="space-setup__hint">
          <strong>{BOT_NAMES[level]}:</strong> {LEVEL_ABOUT[level]} Dice are luck, so any bot can win!
        </p>
        </>
        )}

        <details className="space-setup__more">
          <summary>More settings</summary>
          <div className="space-setup__more-body">
            <Chips
              legend="Finishing"
              name="space-finish"
              value={prefs.finish}
              onChange={(v) => set('finish', v)}
              options={[
                { value: 'any', label: 'Any roll wins' },
                { value: 'exact', label: 'Exact roll' },
              ]}
            />
            <Chips
              legend="Roll a 6, roll again"
              name="space-six"
              value={prefs.rollAgainOnSix}
              onChange={(v) => set('rollAgainOnSix', v)}
              options={[
                { value: false, label: 'Off' },
                { value: true, label: 'On' },
              ]}
            />
            <Chips
              legend="Cosmic events (every 5 rounds)"
              name="space-cosmic"
              value={prefs.mode === 'cosmic' && prefs.cosmicEvents}
              onChange={(v) => set('cosmicEvents', v)}
              disabled={prefs.mode === 'classic'}
              options={[
                { value: false, label: 'Off' },
                { value: true, label: 'On' },
              ]}
            />
            <Chips<Speed>
              legend="Speed"
              name="space-speed"
              value={prefs.speed}
              onChange={(v) => set('speed', v)}
              options={[
                { value: 'relaxed', label: 'Relaxed' },
                { value: 'normal', label: 'Normal' },
                { value: 'zippy', label: 'Zippy' },
              ]}
            />
            <Chips
              legend="Less motion"
              name="space-calm"
              value={lessMotion}
              onChange={onLessMotion}
              options={[
                { value: false, label: 'Off' },
                { value: true, label: 'On' },
              ]}
            />
          </div>
        </details>

        {problem && (
          <p className="space-setup__hint is-bad" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className="button button--play chess-setup__start" disabled={starting}>
          <span aria-hidden="true">🚀</span> {starting ? 'Getting ready…' : 'Launch!'}
        </button>
        <div className="chess-setup__help">
          <p>
            <strong>How to play:</strong> press <strong>Roll</strong> (or Space) to move. Land on a wormhole’s mouth to zoom up
            it, or a black hole to fall down. Stars give you items: use one before you roll (keys 1, 2 and 3). First to the
            space station wins, and everyone gets a place.
          </p>
          <p>
            Tap any square on the board to see what it does.{' '}
            {pass
              ? 'Pass-and-play games are just for fun: they aren’t saved.'
              : saving
              ? 'Every game you finish earns points for taking part, whether you win or not.'
              : 'This is a practice copy: games aren’t saved.'}
          </p>
          <div className="space-setup__help-buttons">
            <button type="button" className="button button--light-outline" onClick={() => onHelp('how')}>
              <span aria-hidden="true">📖</span> How to play
            </button>
            <button type="button" className="button button--light-outline" onClick={() => onHelp('chart')}>
              <span aria-hidden="true">⭐</span> Star chart
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
