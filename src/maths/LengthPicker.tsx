/**
 * How long a teacher's focus lasts: a lesson, the rest of today, until Friday (the default), a week, or an exact time.
 * "Rest of today" and "Until Friday" end at midnight, so practice at home after school still follows the focus.
 * All times are New Zealand time, worked out by the server.
 */
import { useId } from 'react';
import type { FocusLength } from '../data/focus';

export const LENGTHS: { value: FocusLength; label: string; detail: string }[] = [
  { value: 'lesson', label: 'This lesson', detail: '1 hour from now' },
  { value: 'today', label: 'Rest of today', detail: 'until midnight tonight' },
  { value: 'friday', label: 'Until Friday', detail: 'until midnight at the end of Friday' },
  { value: 'week', label: '1 week', detail: '7 days from now' },
  { value: 'custom', label: 'Pick a time', detail: 'a date and time you choose' },
];

export function LengthPicker({
  value,
  custom,
  onChange,
  onCustom,
  legend = 'How long should it last?',
}: {
  value: FocusLength;
  custom: string;
  onChange: (length: FocusLength) => void;
  onCustom: (local: string) => void;
  legend?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="set-focus__options">
        {LENGTHS.map((l) => (
          <label key={l.value}>
            <input type="radio" name={name} checked={value === l.value} onChange={() => onChange(l.value)} />
            <span>
              <strong>{l.label}</strong> ({l.detail})
            </span>
          </label>
        ))}
      </div>
      {value === 'custom' && (
        <label className="teacher__type">
          <span>Ends at (New Zealand time)</span>
          <input type="datetime-local" value={custom} onChange={(e) => onCustom(e.target.value)} />
        </label>
      )}
      <p className="class-panel__hint">All times are New Zealand time. It ends by itself; students then go back to their own choice, or to auto.</p>
    </fieldset>
  );
}
