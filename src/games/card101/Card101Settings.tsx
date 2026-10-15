import type { ReactNode } from 'react';
import type { BotLevel } from '../../../shared/botGame';
import { BOT_LEVEL_NAMES } from './text';
import type { Card101Prefs } from './prefs';

const LEVEL_ABOUT: Record<BotLevel, string> = {
  'very-easy': 'Forgets its cards and knocks at random.',
  easy: 'Remembers its own cards.',
  medium: 'Watches everyone and knocks at the right time.',
};

const LEVEL_ORDER: BotLevel[] = ['very-easy', 'easy', 'medium'];

function Chips<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="choice-group">
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

/** The card values, shown on the settings screen and beside the table. */
export function CardValues() {
  const rows: [string, string][] = [
    ['K', '0'],
    ['3', '0 + cancels your highest'],
    ['A', '1'],
    ['2–10', 'the number'],
    ['J Q', '10'],
  ];
  return (
    <dl className="c101-values">
      {rows.map(([card, value]) => (
        <div key={card}>
          <dt>{card}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Card101Settings({
  prefs,
  onChange,
  level,
  onLevelChange,
  onStart,
  starting = false,
}: {
  prefs: Card101Prefs;
  onChange: (prefs: Card101Prefs) => void;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  onStart: () => void;
  starting?: boolean;
}) {
  return (
    <section className="chess-setup c101-setup" aria-labelledby="c101-setup-title">
      <h1 id="c101-setup-title" className="page-title">
        🃏 101
      </h1>
      <form
        className="chess-setup__card"
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <p className="c101-setup__intro">
          Get the <strong>lowest</strong> hand. Peek at your bottom two cards once, then swap cards in to bring your hand down.
          Cards you swap in go face up for everyone to see. Pairs cancel out and a 3 cancels your highest card. When someone
          reaches {prefs.target}, the lowest total wins.
        </p>
        <CardValues />

        <Chips
          legend="Bots"
          name="c101-level"
          value={level}
          onChange={onLevelChange}
          options={LEVEL_ORDER.map((id) => ({ value: id, label: BOT_LEVEL_NAMES[id] }))}
        />
        <p className="c101-setup__hint">{LEVEL_ABOUT[level]}</p>

        <Chips
          legend="How many bots"
          name="c101-bots"
          value={prefs.bots}
          onChange={(bots) => onChange({ ...prefs, bots })}
          options={[1, 2, 3].map((n) => ({ value: n as 1 | 2 | 3, label: String(n) }))}
        />

        <Chips
          legend="Game length"
          name="c101-target"
          value={prefs.target}
          onChange={(target) => onChange({ ...prefs, target })}
          options={[
            { value: 101, label: 'Normal: to 101' },
            { value: 50, label: 'Quick: to 50' },
          ]}
        />

        <button type="submit" className="button button--play c101-setup__start" disabled={starting}>
          {starting ? 'Shuffling…' : '▶ Deal the cards'}
        </button>
      </form>
    </section>
  );
}
