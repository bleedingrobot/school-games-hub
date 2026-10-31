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
import { SKIP_CHOICES, SKIP_NOTE, share } from '../pages/TeacherQuestionSkips';
import { trainingOn } from '../training/switch';
import { TRAINING_CONFIG } from '../../shared/training/config';
import { describeEnd, nzLocalToIso, skillList, timeLeft } from '../../shared/maths/focus';
import { SettingChoice, SettingToggle, useSetting } from './Settings';
import { useTeacherClass } from './TeacherClass';
import { NeedsYou } from './WaitingToJoin';
import { percentRight, useHardest } from './Hardest';
import { classOverview, useClassAlerts } from './useClassAlerts';
import '../maths/focus.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function Today() {
  const { classId, current } = useTeacherClass();
  if (!classId || !current) return null;
  return (
    <div className="today">
      <ClassNeedsYou key={`needs-${classId}`} classId={classId} />
      <LessonControls key={`controls-${classId}`} classId={classId} name={current.name} />
      <ThisWeek key={`week-${classId}`} classId={classId} name={current.name} members={current.members} />
    </div>
  );
}

function ClassNeedsYou({ classId }: { classId: string }) {
  const alerts = useClassAlerts(classId);
  return <NeedsYou classId={classId} alerts={alerts} />;
}

function LessonControls({ classId, name }: { classId: string; name: string }) {
  const friends = useSetting(() => fetchMultiplayerEnabled(classId), [classId]);
  const reactions = useSetting(() => fetchReactionsEnabled(classId), [classId]);
  const training = useSetting(() => fetchTrainingFirst(classId), [classId], trainingOn());
  const skip = useSetting(() => fetchSkipMode(classId), [classId]);
  return (
    <section className="panel lesson-controls" aria-labelledby="lesson-title">
      <h2 id="lesson-title" className="panel__title">
        Lesson controls <span className="today__for">({name})</span>
      </h2>
      <div className="lesson-controls__grid">
        <SettingToggle
          label="Games against friends"
          about="Off stops new games between students. Bot games carry on."
          value={friends.value}
          loadFailed={friends.failed}
          save={(on) => setMultiplayer(on, classId)}
        />
        <SettingToggle
          label="Emoji reactions"
          about="In Wormholes & Black Holes games with classmates."
          value={reactions.value}
          loadFailed={reactions.failed}
          save={(on) => setSpaceReactions(on, classId)}
        />
        {trainingOn() && (
          <SettingToggle
            label="Training before games"
            about={`One Basic facts training session (a whole “Today’s session” or a whole round of Quick looks) before any game opens. The games then stay open for ${TRAINING_CONFIG.gate.gamesOpenHours} hours; a game already open carries on. Teachers are never asked.`}
            value={training.value}
            loadFailed={training.failed}
            save={(on) => saveTrainingFirst(on, classId)}
          />
        )}
        <SettingChoice
          label="Skip button"
          about={SKIP_NOTE}
          options={SKIP_CHOICES}
          value={skip.value}
          loadFailed={skip.failed}
          save={(mode) => saveSkipMode(mode, classId)}
        />
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

/** "Active now" means a finished game or a question shown in the last this many minutes. */
const ACTIVE_NOW_MINUTES = 15;

function ThisWeek({ classId, name, members }: { classId: string; name: string; members: number }) {
  const [batches, setBatches] = useState<FocusBatch[] | null>(null);
  const [counts, setCounts] = useState<{ played: number; shown: number; skipped: number } | null>(null);
  const [activity, setActivity] = useState<{ now: number; quiet: number } | null>(null);
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
    // Counts only, no names: this screen may be on a projector. Names are one click away on the Students tab.
    classOverview(classId).then(
      (students) => {
        if (!current) return;
        const since = (minutes: number) => Date.now() - minutes * 60_000;
        const at = (iso: string | null) => (iso ? Date.parse(iso) : 0);
        setActivity({
          now: students.filter((s) => at(s.lastActive) > since(ACTIVE_NOW_MINUTES)).length,
          quiet: students.filter((s) => at(s.lastActive) <= since(7 * 24 * 60)).length,
        });
      },
      () => current && setActivity(null),
    );
    return () => {
      current = false;
    };
  }, [classId, refresh]);

  const maths = `/teacher/${classId}/maths`;
  const hardest = useHardest(classId);
  const top = hardest?.rows.slice(0, 3) ?? [];
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
      {activity && (
        <p className="this-week__line">
          Right now: <strong>{activity.now}</strong> active in the last {ACTIVE_NOW_MINUTES} minutes ·{' '}
          {activity.quiet === 0 ? (
            'everyone has played this week'
          ) : (
            <>
              <strong>{activity.quiet}</strong> haven’t played for 7 days{' '}
              <Link to={`/teacher/${classId}/students?sort=quiet`}>Who ›</Link>
            </>
          )}
        </p>
      )}
      {top.length > 0 && (
        <p className="this-week__line">
          Hardest right now: {top.map((r) => `${r.question} (${percentRight(r)})`).join(', ')}{' '}
          <Link to={`${maths}/hardest`}>Maths ›</Link>
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
