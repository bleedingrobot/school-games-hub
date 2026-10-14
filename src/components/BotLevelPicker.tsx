import { BOT_LEVELS, type BotLevel } from '../games/types';

export function BotLevelPicker({
  name,
  value,
  onChange,
  legend,
}: {
  name: string;
  value: BotLevel;
  onChange: (level: BotLevel) => void;
  legend: string;
}) {
  return (
    <fieldset className="level-picker">
      <legend>{legend}</legend>
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
