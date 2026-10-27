/**
 * The shared setting controls for every teacher page (docs/TEACHER-VIEW-PLAN.md, section 5), so every switch looks and behaves the
 * same: it shows its state, saves the moment it changes, says "Saved ✓" for 2 seconds, and if the save fails it goes back and
 * says why. Only DangerAction is red, because red means "can't undo"; every other control here is reversible and never is.
 *
 * Each control is given the loaded value (null while loading) and a save function; useSetting() does the loading.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { FriendlyError } from '../data/profile';
import './settings.css';

// useSetting has its own file (no CSS), so a game's GameDefinition can load a class's value without bringing these controls along.
export { useSetting } from './useSetting';

const SAVED_MS = 2000;

export const settingErrorText = (error: unknown) =>
  error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.';

type Status = { kind: 'saving' | 'saved' | 'error'; text: string } | null;

/** The one-line status every control shows: Saving…, Saved ✓ (gone after 2 s), or what went wrong. */
function useStatus(loadFailed: boolean) {
  const [status, setStatus] = useState<Status>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const set = (next: Status) => {
    clearTimeout(timer.current);
    setStatus(next);
    if (next?.kind === 'saved') timer.current = setTimeout(() => setStatus(null), SAVED_MS);
  };
  return {
    status: status ?? (loadFailed ? ({ kind: 'error', text: 'We couldn’t load this setting.' } as const) : null),
    saving: () => set({ kind: 'saving', text: 'Saving…' }),
    saved: () => set({ kind: 'saved', text: 'Saved ✓' }),
    failed: (error: unknown) => set({ kind: 'error', text: settingErrorText(error) }),
    say: (text: string) => set({ kind: 'error', text }),
  };
}

/** A value shown at once (optimistic), put back if the save fails. Follows `value` when it is reloaded. */
function useSaving<T>(value: T | null, loadFailed: boolean) {
  const [shown, setShown] = useState<T | null>(value);
  const busy = useRef(false);
  const status = useStatus(loadFailed);
  useEffect(() => setShown(value), [value]);

  async function change(next: T, save: (next: T) => Promise<void>, onSaved?: (next: T) => void) {
    if (busy.current || shown === null) return;
    const before = shown;
    busy.current = true;
    setShown(next);
    status.saving();
    try {
      await save(next);
      status.saved();
      onSaved?.(next);
    } catch (error) {
      setShown(before);
      status.failed(error);
    } finally {
      busy.current = false;
    }
  }
  return { shown, change, ...status };
}

interface Common {
  label: string;
  /** One short line on what the setting does, behind a "?". */
  about?: ReactNode;
  /** The setting couldn't be loaded. */
  loadFailed?: boolean;
  /**
   * For a table cell (the Games table): the label is kept for screen readers but not shown, since the row and column already
   * say what it is, and the "?" and status sit beside or under the control.
   */
  compact?: boolean;
}

/** The label row: the name and, if there is one, the "?" that opens the about line. */
function Label({
  id,
  label,
  about,
  aboutId,
  open,
  onToggle,
  hidden = false,
}: {
  id: string;
  label: string;
  about?: ReactNode;
  aboutId: string;
  open: boolean;
  onToggle: () => void;
  /** Kept for screen readers only. */
  hidden?: boolean;
}) {
  return (
    <span className="setting__name">
      <span id={id} className={hidden ? 'setting__label sr-only' : 'setting__label'}>
        {label}
      </span>
      {about && (
        <button
          type="button"
          className="setting__about-button"
          aria-expanded={open}
          aria-controls={aboutId}
          aria-label={`About ${label}`}
          onClick={onToggle}
        >
          ?
        </button>
      )}
    </span>
  );
}

function Shell({
  className,
  label,
  about,
  detail,
  status,
  compact = false,
  children,
}: {
  className: string;
  label: string;
  about?: ReactNode;
  detail?: ReactNode;
  status: Status;
  compact?: boolean;
  children: (ids: { label: string; about: string | undefined }) => ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const labelId = `${id}-label`;
  const aboutId = `${id}-about`;
  return (
    <div className={`setting ${className}${compact ? ' setting--compact' : ''}`}>
      <Label id={labelId} label={label} about={about} aboutId={aboutId} open={open} onToggle={() => setOpen((o) => !o)} hidden={compact} />
      {children({ label: labelId, about: about && open ? aboutId : undefined })}
      {detail && !compact && <span className="setting__detail">{detail}</span>}
      {about && (
        <span id={aboutId} className="setting__about" hidden={!open}>
          {about}
        </span>
      )}
      <span className={`setting__status${status?.kind === 'error' ? ' setting__status--error' : ''}`} role="status">
        {status?.text}
      </span>
    </div>
  );
}

/** A real on/off switch. */
export function SettingToggle({
  label,
  about,
  value,
  loadFailed = false,
  compact,
  save,
  onSaved,
}: Common & {
  value: boolean | null;
  save: (on: boolean) => Promise<void>;
  onSaved?: (on: boolean) => void;
}) {
  const s = useSaving(value, loadFailed);
  return (
    <Shell className="setting--toggle" label={label} about={about} status={s.status} compact={compact}>
      {(ids) => (
        <button
          type="button"
          role="switch"
          className="setting-switch"
          aria-checked={s.shown ?? false}
          aria-labelledby={ids.label}
          aria-describedby={ids.about}
          disabled={s.shown === null}
          onClick={() => s.shown !== null && void s.change(!s.shown, save, onSaved)}
        >
          <span className="setting-switch__track" aria-hidden="true">
            <span className="setting-switch__knob" />
          </span>
          <span className="setting-switch__state" aria-hidden="true">
            {s.shown === null ? '…' : s.shown ? 'On' : 'Off'}
          </span>
        </button>
      )}
    </Shell>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** What this choice means, shown under the control while it is picked. */
  detail?: string;
}

/**
 * A segmented control of 2–4 choices. Arrow keys move between them and Space or Enter picks one, so moving along never saves
 * a choice the teacher didn't mean.
 */
export function SettingChoice<T extends string>({
  label,
  about,
  options,
  value,
  loadFailed = false,
  compact,
  save,
  onSaved,
}: Common & {
  options: readonly Choice<T>[];
  value: T | null;
  save: (next: T) => Promise<void>;
  onSaved?: (next: T) => void;
}) {
  const s = useSaving(value, loadFailed);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusAt, setFocusAt] = useState<number | null>(null);
  const picked = options.findIndex((o) => o.value === s.shown);
  const tabStop = focusAt ?? Math.max(picked, 0);

  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : step ? (i + step + options.length) % options.length : null;
    if (to === null) return;
    e.preventDefault();
    setFocusAt(to);
    buttons.current[to]?.focus();
  }

  return (
    <Shell
      className="setting--choice"
      label={label}
      about={about}
      status={s.status}
      compact={compact}
      detail={picked >= 0 ? options[picked].detail : undefined}
    >
      {(ids) =>
        // Until it has loaded, no choice is drawn: a row with nothing picked would look like a real state.
        s.shown === null ? (
          <span className="setting__loading" aria-hidden="true">
            …
          </span>
        ) : (
          <div className="setting-choice" role="radiogroup" aria-labelledby={ids.label} aria-describedby={ids.about}>
            {options.map((o, i) => (
              <button
                key={o.value}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={s.shown === o.value}
                tabIndex={i === tabStop ? 0 : -1}
                className="setting-choice__option"
                onKeyDown={(e) => onKeyDown(e, i)}
                onFocus={() => setFocusAt(i)}
                onClick={() => o.value !== s.shown && void s.change(o.value, save, onSaved)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )
      }
    </Shell>
  );
}

/** Multi-select chips (topics, tables). At least `min` (1) must stay ticked: unticking the last one is refused, with a word. */
export function SettingChips<T extends string | number>({
  label,
  about,
  options,
  value,
  min = 1,
  loadFailed = false,
  save,
  onSaved,
}: Common & {
  options: readonly { value: T; label: string }[];
  value: readonly T[] | null;
  min?: number;
  save: (next: T[]) => Promise<void>;
  onSaved?: (next: T[]) => void;
}) {
  const s = useSaving<readonly T[]>(value, loadFailed);
  const id = useId();
  const [open, setOpen] = useState(false);

  function flip(v: T) {
    if (!s.shown) return;
    const on = s.shown.includes(v);
    if (on && s.shown.length <= min) return s.say(min === 1 ? 'Leave at least one ticked.' : `Leave at least ${min} ticked.`);
    // Keep the options' order, whatever order they were ticked in.
    const next = options.map((o) => o.value).filter((x) => (x === v ? !on : s.shown!.includes(x)));
    void s.change(next, (n) => save([...n]), onSaved && ((n) => onSaved([...n])));
  }

  return (
    <fieldset
      className="setting setting--chips"
      aria-labelledby={`${id}-label`}
      aria-describedby={about && open ? `${id}-about` : undefined}
    >
      <legend>
        <Label id={`${id}-label`} label={label} about={about} aboutId={`${id}-about`} open={open} onToggle={() => setOpen((o) => !o)} />
      </legend>
      <div className="choice-group__chips">
        {options.map((o) => (
          <label key={String(o.value)} className="chip">
            <input type="checkbox" checked={s.shown?.includes(o.value) ?? false} disabled={!s.shown} onChange={() => flip(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {about && (
        <span id={`${id}-about`} className="setting__about" hidden={!open}>
          {about}
        </span>
      )}
      <span className={`setting__status${s.status?.kind === 'error' ? ' setting__status--error' : ''}`} role="status">
        {s.status?.text}
      </span>
    </fieldset>
  );
}

/**
 * A typed field that saves on Enter or when the teacher moves away (no Save button). Escape puts back the saved value. `check`
 * turns the typed text into a value, or returns a sentence saying what's wrong.
 */
function SettingField<T extends string | number>({
  label,
  about,
  value,
  loadFailed = false,
  save,
  onSaved,
  check,
  show,
  input,
  suffix,
}: Common & {
  value: T | null;
  save: (next: T) => Promise<void>;
  onSaved?: (next: T) => void;
  check: (typed: string) => { ok: T } | { wrong: string };
  show: (v: T) => string;
  input: Record<string, string | number | undefined>;
  suffix?: string;
}) {
  const [saved, setSaved] = useState<T | null>(value);
  const [typed, setTyped] = useState(value === null ? '' : show(value));
  const busy = useRef(false);
  const status = useStatus(loadFailed);
  useEffect(() => {
    setSaved(value);
    setTyped(value === null ? '' : show(value));
    // `show` is a plain formatter; only a new value matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function commit() {
    if (busy.current || saved === null) return;
    const checked = check(typed.trim());
    if ('wrong' in checked) {
      setTyped(show(saved));
      return status.say(checked.wrong);
    }
    const next = checked.ok;
    if (next === saved) return setTyped(show(saved));
    busy.current = true;
    status.saving();
    try {
      await save(next);
      setSaved(next);
      setTyped(show(next));
      status.saved();
      onSaved?.(next);
    } catch (error) {
      setTyped(show(saved));
      status.failed(error);
    } finally {
      busy.current = false;
    }
  }

  return (
    <Shell className="setting--field" label={label} about={about} status={status.status}>
      {(ids) => (
        <span className="setting-field">
          <input
            {...input}
            className="setting-field__input"
            aria-labelledby={ids.label}
            aria-describedby={ids.about}
            value={typed}
            disabled={saved === null}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape' && saved !== null) {
                setTyped(show(saved));
              }
            }}
          />
          {suffix && <span className="setting-field__suffix">{suffix}</span>}
        </span>
      )}
    </Shell>
  );
}

/** A whole number, saved on Enter or blur. Out of range is refused with a word and the old number comes back. */
export function SettingNumber({
  min,
  max,
  suffix,
  ...rest
}: Common & {
  value: number | null;
  min: number;
  max: number;
  suffix?: string;
  save: (n: number) => Promise<void>;
  onSaved?: (n: number) => void;
}) {
  return (
    <SettingField<number>
      {...rest}
      suffix={suffix}
      input={{ type: 'number', inputMode: 'numeric', min, max, step: 1 }}
      show={String}
      check={(t) => {
        const n = Number(t);
        return t !== '' && Number.isInteger(n) && n >= min && n <= max
          ? { ok: n }
          : { wrong: `Pick a whole number from ${min} to ${max}.` };
      }}
    />
  );
}

/** A date (YYYY-MM-DD), saved on Enter or blur. */
export function SettingDate({
  min,
  max,
  ...rest
}: Common & {
  value: string | null;
  min?: string;
  max?: string;
  save: (date: string) => Promise<void>;
  onSaved?: (date: string) => void;
}) {
  return (
    <SettingField<string>
      {...rest}
      input={{ type: 'date', min, max }}
      show={(d) => d}
      check={(t) => (/^\d{4}-\d{2}-\d{2}$/.test(t) && (!min || t >= min) && (!max || t <= max) ? { ok: t } : { wrong: 'Pick a date.' })}
    />
  );
}

/**
 * The only red control, for things that can't be undone: the teacher types `words` before the button wakes up. `onConfirm` gets
 * what they typed (the server may check it too) and reports its own result. The box empties once it succeeds; if `onConfirm`
 * throws, the words stay.
 */
export function DangerAction({
  label,
  words,
  prompt = `Type ${words}`,
  ignoreCase = false,
  onConfirm,
  onCancel,
}: {
  label: string;
  words: string;
  prompt?: string;
  ignoreCase?: boolean;
  onConfirm: (typed: string) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const fold = (t: string) => (ignoreCase ? t.toLowerCase() : t);
  const ready = fold(typed.trim()) === fold(words) && !running;

  async function go() {
    if (!ready) return;
    setRunning(true);
    try {
      await onConfirm(typed.trim());
      setTyped('');
    } catch {
      // The caller has said what went wrong; the words stay so the teacher can try again.
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="danger-action">
      <label className="teacher__type">
        <span>{prompt}</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      <div className="danger-action__buttons">
        <button type="button" className="button button--danger" disabled={!ready} onClick={() => void go()}>
          {label}
        </button>
        {onCancel && (
          <button type="button" className="button button--light-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
