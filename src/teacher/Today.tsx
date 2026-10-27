/**
 * Today (/teacher/:classId), the teacher's landing screen (docs/TEACHER-VIEW-PLAN.md, section 4.2): what needs the teacher, the
 * four class switches flipped mid-lesson, and this week's focus and counts. "This week" shows counts only, never names, so it is
 * safe on a projector.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchMultiplayerEnabled } from '../data/multiplayer';
import { FriendlyError } from '../data/profile';
import { fetchQuestionSkips } from '../data/questionLog';
import { fetchSkipMode, saveSkipMode } from '../data/questionSkips';
import { fetchReactionsEnabled } from '../data/spaceGames';
import { setMultiplayer, setSpaceReactions } from '../data/teacher';
import { fetchTrainingFirst, saveTrainingFirst } from '../data/trainingGate';
import { endFocus, extendFocus, fetchFocuses, type FocusBatch, type FocusLength } from '../data/focus';
import { LengthPicker } from '../maths/LengthPicker';
import type { SkipMode } from '../maths/questionLog';
import { SKIP_CHOICES, share } from '../pages/TeacherQuestionSkips';
import { trainingOn } from '../training/switch';
import { describeEnd, nzLocalToIso, skillList, timeLeft } from '../../shared/maths/focus';
import { useTeacherClass } from './TeacherClass';
import { NeedsYou } from './WaitingToJoin';
import '../maths/focus.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function Today() {
  const { classId, current } = useTeacherClass();
  if (!classId || !current) return null;
  return (
    <div className="today">
      <NeedsYou classId={classId} />
      <LessonControls key={`controls-${classId}`} classId={classId} name={current.name} />
      <ThisWeek key={`week-${classId}`} classId={classId} name={current.name} members={current.members} />
    </div>
  );
}

/** One on/off switch: shows its state, saves at once, and goes back (with the reason) if the save fails. */
function LessonSwitch({
  label,
  about,
  load,
  save,
}: {
  label: string;
  about: string;
  load: () => Promise<boolean>;
  save: (on: boolean) => Promise<void>;
}) {
  const [on, setOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    load().then(
      (v) => current && setOn(v),
      () => current && setStatus('We couldn’t load this setting.'),
    );
    return () => {
      current = false;
    };
    // load is made fresh on each render; the class is in the key of the whole panel, so this runs once per class.
  }, []);

  async function flip() {
    if (on === null) return;
    const next = !on;
    setOn(next);
    setStatus('Saving…');
    try {
      await save(next);
      setStatus('Saved ✓');
    } catch (error) {
      setOn(!next);
      setStatus(errorText(error));
    }
  }

  const id = `lesson-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <div className="lesson-control">
      <span className="lesson-control__label" id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        className="lesson-switch"
        aria-checked={on ?? false}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-about`}
        disabled={on === null}
        onClick={() => void flip()}
      >
        <span className="lesson-switch__track" aria-hidden="true">
          <span className="lesson-switch__knob" />
        </span>
        <span className="lesson-switch__state">{on === null ? '…' : on ? 'On' : 'Off'}</span>
      </button>
      <span className="lesson-control__about" id={`${id}-about`}>
        {about}
      </span>
      <span className="lesson-control__status" role="status">
        {status}
      </span>
    </div>
  );
}

/** The class's skip button: On, a few per game, or Off. */
function SkipChoice({ classId }: { classId: string }) {
  const [mode, setMode] = useState<SkipMode | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchSkipMode(classId).then(
      (m) => current && setMode(m),
      () => current && setStatus('We couldn’t load this setting.'),
    );
    return () => {
      current = false;
    };
  }, [classId]);

  async function change(next: SkipMode) {
    const before = mode;
    setMode(next);
    setStatus('Saving…');
    try {
      await saveSkipMode(next, classId);
      setStatus('Saved ✓');
    } catch (error) {
      setMode(before);
      setStatus(errorText(error));
    }
  }

  return (
    <div className="lesson-control">
      <span className="lesson-control__label" id="lesson-skip-label">
        Skip button
      </span>
      <div className="lesson-choice" role="radiogroup" aria-labelledby="lesson-skip-label">
        {SKIP_CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={mode === c.value}
            className="lesson-choice__option"
            disabled={mode === null}
            onClick={() => void change(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <span className="lesson-control__about">{mode ? SKIP_CHOICES.find((c) => c.value === mode)?.detail : ''}</span>
      <span className="lesson-control__status" role="status">
        {status}
      </span>
    </div>
  );
}

function LessonControls({ classId, name }: { classId: string; name: string }) {
  return (
    <section className="panel lesson-controls" aria-labelledby="lesson-title">
      <h2 id="lesson-title" className="panel__title">
        Lesson controls <span className="today__for">({name})</span>
      </h2>
      <div className="lesson-controls__grid">
        <LessonSwitch
          label="Games against friends"
          about="Off stops new games between students. Bot games carry on."
          load={() => fetchMultiplayerEnabled(classId)}
          save={(on) => setMultiplayer(on, classId)}
        />
        <LessonSwitch
          label="Emoji reactions"
          about="In Wormholes & Black Holes games with classmates."
          load={() => fetchReactionsEnabled(classId)}
          save={(on) => setSpaceReactions(on, classId)}
        />
        {trainingOn() && (
          <LessonSwitch
            label="Training before games"
            about="One Training session before any game opens."
            load={() => fetchTrainingFirst(classId)}
            save={(on) => saveTrainingFirst(on, classId)}
          />
        )}
        <SkipChoice classId={classId} />
      </div>
    </section>
  );
}

/** Who a focus is for, as a count: this screen may be on a projector. */
function whoCount(b: FocusBatch): string {
  if (b.scope === 'class') return 'Whole class';
  const n = b.targets.length;
  if (b.scope === 'group') return n === 1 ? `Group ${b.targets[0].name}` : `${n} groups`;
  return `${n} student${n === 1 ? '' : 's'}`;
}

function ThisWeek({ classId, name, members }: { classId: string; name: string; members: number }) {
  const [batches, setBatches] = useState<FocusBatch[] | null>(null);
  const [counts, setCounts] = useState<{ played: number; shown: number; skipped: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBatches(await fetchFocuses(classId));
    } catch (error) {
      setStatus(errorText(error));
      setBatches([]);
    }
  }, [classId]);

  useEffect(() => {
    void refresh();
    let current = true;
    fetchQuestionSkips(classId, 7).then(
      (d) =>
        current &&
        setCounts({
          played: d.students.filter((s) => s.shown > 0).length,
          shown: d.students.reduce((n, s) => n + s.shown, 0),
          skipped: d.students.reduce((n, s) => n + s.skipped, 0),
        }),
      () => current && setCounts(null),
    );
    return () => {
      current = false;
    };
  }, [classId, refresh]);

  const maths = `/teacher/${classId}/maths`;
  return (
    <section className="panel this-week" aria-labelledby="week-title">
      <h2 id="week-title" className="panel__title">
        This week in {name}
      </h2>
      {!batches ? (
        <p className="panel__empty">Loading…</p>
      ) : batches.length === 0 ? (
        <p className="this-week__line">
          No focus running: students follow their own choice, or auto. <Link to={maths}>Set a focus</Link>
        </p>
      ) : (
        <ul className="this-week__focuses">
          {batches.map((b) => (
            <RunningLine
              key={b.batch}
              batch={b}
              onDone={(message) => {
                setStatus(message);
                void refresh();
              }}
              onError={(e) => setStatus(errorText(e))}
            />
          ))}
        </ul>
      )}
      {counts && (
        <p className="this-week__line">
          Last 7 days: <strong>{counts.played}</strong> of {members} student{members === 1 ? '' : 's'} answered maths questions ·{' '}
          <strong>{counts.shown.toLocaleString('en-NZ')}</strong> question{counts.shown === 1 ? '' : 's'} ·{' '}
          <strong>{share(counts.skipped, counts.shown)}</strong> skipped
        </p>
      )}
      <p className="this-week__links">
        {batches && batches.length > 0 && <Link to={maths}>Set a new focus</Link>}
        <Link to={`/teacher/${classId}/maths/skills`}>Skill map ›</Link>
      </p>
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}

function RunningLine({ batch, onDone, onError }: { batch: FocusBatch; onDone: (message: string) => void; onError: (error: unknown) => void }) {
  const [extending, setExtending] = useState(false);
  const [length, setLength] = useState<FocusLength>('week');
  const [custom, setCustom] = useState('');
  const who = whoCount(batch);

  async function extend() {
    const iso = length === 'custom' ? nzLocalToIso(custom) : undefined;
    if (length === 'custom' && !iso) return onError(new FriendlyError('Pick a date and time first.'));
    try {
      const ends = await extendFocus(batch.batch, length, iso ?? undefined);
      setExtending(false);
      onDone(`It now runs ${describeEnd(ends)}.`);
    } catch (error) {
      onError(error);
    }
  }

  async function end() {
    try {
      await endFocus(batch.batch);
      onDone('Ended. Those students go back to their own choice, or auto.');
    } catch (error) {
      onError(error);
    }
  }

  return (
    <li className="running-focus">
      <span className="running-focus__what">
        Focus ({who}): {skillList(batch.skills)}
      </span>
      <span className="running-focus__meta">
        {timeLeft(batch.endsAt)} ({describeEnd(batch.endsAt)}){batch.status === 'later' && ' · starts later'}
      </span>
      <span className="running-focus__actions">
        {!extending && (
          <button type="button" className="button button--light-outline" aria-label={`Extend: ${who}`} onClick={() => setExtending(true)}>
            Extend
          </button>
        )}
        <button type="button" className="button button--light-outline" aria-label={`End: ${who}`} onClick={() => void end()}>
          End
        </button>
      </span>
      {extending && (
        <div className="set-focus__form">
          <LengthPicker value={length} custom={custom} onChange={setLength} onCustom={setCustom} legend="Run it until…" />
          <span className="running-focus__actions">
            <button type="button" className="button button--primary" onClick={() => void extend()}>
              Extend it
            </button>
            <button type="button" className="button button--light-outline" onClick={() => setExtending(false)}>
              Cancel
            </button>
          </span>
        </div>
      )}
    </li>
  );
}
