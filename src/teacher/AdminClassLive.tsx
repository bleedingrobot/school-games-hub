/** /teacher/admin/classlive: the times Class Live games start by themselves (docs/plans/classlive-auto/PLAN.md). */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CLASH_MAPS } from '../../shared/classlive/clash';
import { MAPS } from '../../shared/classlive/corners';
import { MAPS as GHOST_MAPS } from '../../shared/classlive/ghost';
import { LAVA_MAPS } from '../../shared/classlive/lava';
import { BAYS } from '../../shared/classlive/shark';
import { HALLS } from '../../shared/classlive/thrones';
import { SERPENT_LEVELS } from '../../shared/classlive/serpent';
import {
  fetchClassLiveTimes,
  removeClassLiveTime,
  saveClassLiveTime,
  type ClassLiveActivity,
  type ClassLiveTime,
} from '../data/classliveTimes';
import { FriendlyError } from '../data/profile';
import './admin-classlive.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GAMES: Record<ClassLiveActivity, string> = {
  serpent: 'Serpent Chain', mural: 'Mystery Mural', corners: 'Four Corners', shark: 'Shark Bay', ghost: 'Ghost Tag',
  clash: 'Colour Clash', thrones: 'Musical Thrones', lava: 'Floor is Lava',
};
/** Each game's maps (or Serpent Chain's levels); Mystery Mural has none. */
const LEVELS: Record<ClassLiveActivity, readonly string[]> = {
  serpent: SERPENT_LEVELS, mural: [], corners: MAPS, shark: BAYS, ghost: GHOST_MAPS, clash: CLASH_MAPS, thrones: HALLS, lava: LAVA_MAPS,
};
const LENGTHS = [2, 3, 5, 10, 15] as const;

/** "Mon–Fri", "Mon, Wed, Fri", "Every day". */
function daysText(days: number[]): string {
  if (days.length === 7) return 'Every day';
  const runs: string[] = [];
  for (let i = 0; i < days.length; ) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
    runs.push(j - i >= 2 ? `${DAY_NAMES[days[i] - 1]}–${DAY_NAMES[days[j] - 1]}` : days.slice(i, j + 1).map((d) => DAY_NAMES[d - 1]).join(', '));
    i = j + 1;
  }
  return runs.join(', ');
}

function summary(t: ClassLiveTime): string {
  const level = t.level ? ` · ${cap(t.level)}` : '';
  return `${daysText(t.days)} ${t.at} · ${GAMES[t.activity]}${level} · ${t.length} min · needs ${t.min} players · pop-up ${t.open} min before · ${t.on ? 'On' : 'Off'}`;
}

const blank = (): ClassLiveTime => ({
  id: null, days: [1, 2, 3, 4, 5], at: '12:40', activity: 'serpent', length: 5, min: 6, open: 3, host: 'Games Hub', level: 'gold', on: true,
});

const levelsFor = (a: ClassLiveActivity): readonly string[] => LEVELS[a];

function TimeForm({ start, busy, onSave, onCancel }: { start: ClassLiveTime; busy: boolean; onSave: (t: ClassLiveTime) => void; onCancel: () => void }) {
  const [t, setT] = useState(start);
  const [problem, setProblem] = useState('');
  // Typed as text and only tidied on leaving the box or saving, so a number can be cleared and retyped (James, 25 Nov 2026 NZ).
  const [minText, setMinText] = useState(String(start.min));
  const [openText, setOpenText] = useState(String(start.open));
  const levels = levelsFor(t.activity);
  const set = (change: Partial<ClassLiveTime>) => setT((old) => ({ ...old, ...change }));
  const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));

  function pickGame(activity: ClassLiveActivity) {
    set({ activity, level: activity === 'serpent' ? 'gold' : null });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (t.days.length === 0) return setProblem('Pick at least one day.');
    if (!/^\d\d:\d\d$/.test(t.at)) return setProblem('Pick a time.');
    setProblem('');
    onSave({ ...t, min: num(minText, 2, 40), open: num(openText, 1, 15), host: t.host.trim() || 'Games Hub' });
  }

  return (
    <form className="acl-form" onSubmit={submit} aria-label={t.id === null ? 'Add a time' : 'Edit this time'}>
      <fieldset className="acl-days">
        <legend>Days</legend>
        {DAY_NAMES.map((name, i) => (
          <label key={name} className="acl-day">
            <input
              type="checkbox"
              checked={t.days.includes(i + 1)}
              onChange={(e) => set({ days: e.target.checked ? [...t.days, i + 1].sort() : t.days.filter((d) => d !== i + 1) })}
            />
            {name}
          </label>
        ))}
      </fieldset>
      <label>
        Time
        <input type="time" value={t.at} onChange={(e) => set({ at: e.target.value })} required />
      </label>
      <label>
        Game
        <select value={t.activity} onChange={(e) => pickGame(e.target.value as ClassLiveActivity)}>
          {(Object.keys(GAMES) as ClassLiveActivity[]).map((a) => (
            <option key={a} value={a}>{GAMES[a]}</option>
          ))}
        </select>
      </label>
      <label>
        Minutes
        <select value={t.length} onChange={(e) => set({ length: Number(e.target.value) as ClassLiveTime['length'] })}>
          {LENGTHS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Fewest players
        <input type="number" inputMode="numeric" min={2} max={40} value={minText} onChange={(e) => setMinText(e.target.value)} onBlur={() => setMinText(String(num(minText, 2, 40)))} />
      </label>
      <label>
        Pop-up minutes before
        <input type="number" inputMode="numeric" min={1} max={15} value={openText} onChange={(e) => setOpenText(e.target.value)} onBlur={() => setOpenText(String(num(openText, 1, 15)))} />
      </label>
      <label>
        Name on the pop-up
        <input type="text" maxLength={30} value={t.host} onChange={(e) => set({ host: e.target.value })} />
      </label>
      {levels.length > 0 && (
        <label>
          {t.activity === 'serpent' ? 'Level' : t.activity === 'thrones' ? 'Hall' : 'Map'}
          <select value={t.level ?? ''} onChange={(e) => set({ level: e.target.value || null })}>
            {t.activity !== 'serpent' && <option value="">Surprise me</option>}
            {levels.map((l) => (
              <option key={l} value={l}>{cap(l)}</option>
            ))}
          </select>
        </label>
      )}
      <div className="acl-row__actions">
        <button type="submit" className="button button--primary" disabled={busy}>Save</button>
        <button type="button" className="button button--light-outline" onClick={onCancel}>Cancel</button>
        <span role="status" className="teacher__status">{problem}</span>
      </div>
    </form>
  );
}

export function AdminClassLive() {
  const [times, setTimes] = useState<ClassLiveTime[] | null>(null);
  const [editing, setEditing] = useState<ClassLiveTime | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setTimes(await fetchClassLiveTimes());
    } catch (error) {
      setTimes((old) => old ?? []);
      setMessage(errorText(error));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage('');
    try {
      await work();
      await load();
      setMessage(done);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const save = (t: ClassLiveTime) =>
    run(async () => {
      await saveClassLiveTime(t);
      setEditing(null);
    }, 'Saved.');

  return (
    <section className="panel" aria-labelledby="classlive-times-title">
      <h2 id="classlive-times-title" className="panel__title">Class Live times</h2>
      <p className="this-week__line">
        Class Live games can start by themselves at set times. Every pupil at the school gets a “Join now?” pop-up a few minutes before. At the
        time, the game starts if enough have joined, or is called off. They run on pupils’ iPads only.
      </p>
      {times === null ? (
        <p className="panel__empty" role="status">Loading…</p>
      ) : times.length === 0 ? (
        <p className="panel__empty">No times yet.</p>
      ) : (
        <ul className="acl-list">
          {times.map((t) => (
            <li key={t.id} className="acl-row">
              <span>{summary(t)}</span>
              <span className="acl-row__actions">
                {removing === t.id ? (
                  <span role="alertdialog" aria-label="Remove this time">
                    Remove this time?{' '}
                    <button
                      type="button"
                      className="button button--primary"
                      autoFocus
                      onClick={() => {
                        setRemoving(null);
                        void run(() => removeClassLiveTime(t.id as number), 'Removed.');
                      }}
                    >
                      Remove
                    </button>{' '}
                    <button type="button" className="button button--light-outline" onClick={() => setRemoving(null)}>Cancel</button>
                  </span>
                ) : (
                  <>
                    <button type="button" className="button button--light-outline" disabled={busy} onClick={() => setEditing(t)}>Edit</button>
                    <button type="button" className="button button--light-outline" disabled={busy} aria-pressed={t.on} onClick={() => void save({ ...t, on: !t.on })}>
                      {t.on ? 'Turn off' : 'Turn on'}
                    </button>
                    <button type="button" className="button button--light-outline" disabled={busy} onClick={() => setRemoving(t.id)}>Remove</button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <TimeForm key={editing.id ?? 'new'} start={editing} busy={busy} onSave={(t) => void save(t)} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" className="button button--primary" disabled={busy} onClick={() => setEditing(blank())}>Add a time</button>
      )}
      <span role="status" className="teacher__status">{message}</span>
    </section>
  );
}
