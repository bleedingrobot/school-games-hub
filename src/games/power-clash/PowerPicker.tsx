import { LOADOUT_SIZE } from '../../../shared/power-clash/engine';
import type { PowerId } from '../../../shared/power-clash/types';
import { POWERS } from './text';
import './power-clash.css';

/** Pick exactly three different powers. Used in the classmates waiting room (the bot and pass-and-play setup has its own copy). */
export function PowerPicker({
  value,
  onChange,
  disabled = false,
  title = 'Pick your powers',
  side,
}: {
  value: PowerId[];
  onChange: (next: PowerId[]) => void;
  disabled?: boolean;
  title?: string;
  side?: 'X' | 'O';
}) {
  const toggle = (id: PowerId) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((p) => p !== id) : value.length < LOADOUT_SIZE ? [...value, id] : value);
  };
  return (
    <section className={`pc__panel ${side ? `pc__panel--${side}` : ''} pcl__picker`} aria-label={title}>
      <h2>
        {title} ({value.length}/{LOADOUT_SIZE})
      </h2>
      <ul>
        {POWERS.map((info) => {
          const on = value.includes(info.id);
          return (
            <li key={info.id}>
              <button type="button" className={`pc__power ${on ? 'pc__power--on' : ''}`} aria-pressed={on} disabled={disabled} onClick={() => toggle(info.id)}>
                <span className="pc__power-icon" aria-hidden="true">{info.icon}</span>
                <span className="pc__power-name">{info.name}</span>
                <span className="pc__power-blurb">{info.blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
