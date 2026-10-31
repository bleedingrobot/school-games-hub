import { BOT_LEVELS, type BotLevel } from '../games/types';

export function BotLevelPicker({
  name,
  value,
  onChange,
  legend,
  joined = false,
}: {
  name: string;
  value: BotLevel;
  onChange: (level: BotLevel) => void;
  legend: string;
  /** The home page's game cards: one joined row of buttons, with the legend kept for screen readers only. */
  joined?: boolean;
}) {
  return (
    <fieldset className={`level-picker${joined ? ' level-picker--joined' : ''}`}>
      <legend className={joined ? 'sr-only' : undefined}>{legend}</legend>
      <div className="level-picker__options">
        {BOT_LEVELS.map((level) => (
          <label key={level.id} className="level-picker__option" title={level.hint}>
            <input
              type="radio"
              name={name}
              value={level.id}
              checked={value === level.id}
              onChange={() => onChange(level.id)}
            />
            <span>{level.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
