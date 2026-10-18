/**
 * Marble Rush: the course picker, then a run. Finished runs are sent to the server, which replays
 * them and keeps the best times (src/data/marble.ts); a copy of the bests is kept on this device.
 * No maths is asked yet (stages M.6 and M.7).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { courseById } from '../../../shared/marble/courses';
import { medalFor, type ClockMode } from '../../../shared/marble/engine';
import { encodeInputs } from '../../../shared/marble/inputs';
import { useAuth } from '../../auth/AuthContext';
import { enqueueRun, flushRuns, loadBoard, loadGhost, loadServerBests, startRun, type Board, type Ghost, type GhostKind } from '../../data/marble';
import { formatSteps, loadBests, mergeBests, saveBests, withFinish, type Bests } from './bests';
import { COURSE_INFO } from './courseInfo';
import type { FinishedRun } from './RunScreen';
import './marble.css';

// The picture (three.js) and the run screen load only when someone starts a run.
const RunScreen = lazy(() => import('./RunScreen').then((m) => ({ default: m.RunScreen })));

const GHOST_CHOICES: { value: GhostKind | 'none'; label: string }[] = [
  { value: 'none', label: 'No ghost' },
  { value: 'mine', label: 'My best run' },
  { value: 'next', label: 'The classmate just ahead of me' },
  { value: 'top', label: 'The fastest in the class' },
];

const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const;

export function MarblePlay() {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const [bests, setBests] = useState<Bests>(() => loadBests(player));
  const [pick, setPick] = useState<{ id: string; mode: ClockMode; round: number; ghost: Ghost | null; two: boolean } | null>(null);
  const [ghostChoice, setGhostChoice] = useState<GhostKind | 'none'>('none');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // The stamped seed for the run that is on screen (asked for as the run opens).
  const seedRef = useRef<Promise<{ seed: string; stamp: string } | null>>(Promise.resolve(null));
  const runKey = pick ? `${pick.id}-${pick.mode}-${pick.round}` : '';

  // Send anything still waiting from an earlier visit, then bring in the server's bests.
  useEffect(() => {
    if (!player) return;
    let current = true;
    void flushRuns(player).then(() => loadServerBests()).then((server) => {
      if (!current || !server) return;
      setBests((have) => {
        const merged = mergeBests(have, server);
        saveBests(merged, player);
        return merged;
      });
    });
    return () => {
      current = false;
    };
  }, [player]);

  useEffect(() => {
    if (pick) seedRef.current = player && !pick.two ? startRun(pick.id, pick.mode) : Promise.resolve(null);
    // A new seed for each run (the key changes for each).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, player]);

  // Starts a run. A ghost has to be fetched first; if there isn't one yet the run starts without it.
  const begin = async (id: string, mode: ClockMode, round: number, two = false) => {
    setNote('');
    let ghost: Ghost | null = null;
    if (!two && ghostChoice !== 'none') {
      setBusy(true);
      ghost = await loadGhost(id, mode, ghostChoice);
      setBusy(false);
      if (!ghost) setNote('No ghost to race on that course yet, so this one is just you.');
    }
    setPick({ id, mode, round, ghost, two });
  };

  const course = pick ? courseById(pick.id) : undefined;
  const hasFinished = (id: string) => bests[id]?.up !== undefined;

  if (pick && course) {
    return (
      <Suspense fallback={<p className="loading" role="status">Setting up the course…</p>}>
        <RunScreen
          key={runKey}
          course={course}
          mode={pick.mode}
          best={bests[pick.id]?.[pick.mode]}
          canTryHard={true}
          ghost={pick.ghost}
          twoPlayer={pick.two}
          onDone={(run: FinishedRun) => {
            if (run.outcome !== 'finished' || pick.two) return { isBest: false };
            const next = withFinish(bests, run.courseId, run.mode, run.steps);
            setBests(next.bests);
            saveBests(next.bests, player);
            // The server replays the run and keeps its own time. Without a seed (offline) the run only counts on this device.
            const inputs = encodeInputs(run.inputs);
            void seedRef.current.then((started) => {
              if (!started || !player) return;
              enqueueRun(player, { ...started, course: run.courseId, mode: run.mode, inputs });
              return flushRuns(player);
            });
            return { isBest: next.isBest };
          }}
          onAgain={() => void begin(pick.id, pick.mode, pick.round + 1, pick.two)}
          onHard={() => void begin(pick.id, 'down', pick.round + 1)}
          onExit={() => setPick(null)}
        />
      </Suspense>
    );
  }

  return (
    <CoursePicker
      bests={bests}
      onPlay={(id, mode, two) => void begin(id, mode, 0, two)}
      hasFinished={hasFinished}
      ghostChoice={ghostChoice}
      onGhostChoice={setGhostChoice}
      busy={busy}
      note={note}
    />
  );
}

function CoursePicker({
  bests, onPlay, hasFinished, ghostChoice, onGhostChoice, busy, note,
}: {
  bests: Bests;
  onPlay: (id: string, mode: ClockMode, two?: boolean) => void;
  hasFinished: (id: string) => boolean;
  ghostChoice: GhostKind | 'none';
  onGhostChoice: (c: GhostKind | 'none') => void;
  busy: boolean;
  note: string;
}) {
  const real = useMemo(() => COURSE_INFO.filter((c) => !c.practice), []);
  const practice = useMemo(() => COURSE_INFO.filter((c) => c.practice), []);
  const card = (c: (typeof COURSE_INFO)[number]) => {
    const course = c.playable ? courseById(c.playable) : undefined;
    const best = bests[c.id]?.up ?? (c.playable ? bests[c.playable]?.up : undefined);
    const bestHard = c.playable ? bests[c.playable]?.down : undefined;
    const medal = course && best !== undefined ? medalFor(course, best) : null;
    return (
      <li key={c.id} className="marble-course">
        <div className="marble-course__head">
          <h3>{c.name}</h3>
          <span className="marble-course__level" aria-label={`Difficulty ${c.difficulty} out of 6`}>
            {'●'.repeat(c.difficulty)}
            <span aria-hidden="true">{'○'.repeat(6 - c.difficulty)}</span>
          </span>
        </div>
        <p className="marble-course__place">{c.place}</p>
        <p>{c.blurb}</p>
        {c.didYouKnow && (
          <details className="marble-course__know">
            <summary>Did you know?</summary>
            <p>{c.didYouKnow}</p>
          </details>
        )}
        {course ? (
          <>
            <div className="marble-course__best">
              {best !== undefined ? (
                <span>Best: {formatSteps(best)} {medal && <span aria-label={`${medal} medal`}>{MEDAL_ICON[medal]}</span>}</span>
              ) : (
                <span>No time yet</span>
              )}
              {bestHard !== undefined && <span> · 🔥 {formatSteps(bestHard)}</span>}
            </div>
            <div className="marble-course__buttons">
              <button type="button" className="button button--play" disabled={busy} onClick={() => onPlay(course.def.id, 'up')}>Play {c.name}</button>
              {hasFinished(course.def.id) && (
                <button type="button" className="button button--light" disabled={busy} onClick={() => onPlay(course.def.id, 'down')}>Hard mode 🔥</button>
              )}
              <button type="button" className="button button--light" disabled={busy} onClick={() => onPlay(course.def.id, 'up', true)} aria-label={`Two players on ${c.name}`}>2 players 👥</button>
            </div>
            {!c.practice && <BoardPanel course={course.def.id} name={c.name} />}
          </>
        ) : (
          <p className="marble-course__soon">Coming soon</p>
        )}
      </li>
    );
  };

  return (
    <section className="marble-picker">
      <h2>Marble Rush</h2>
      <p className="marble-picker__intro">Steer your marble down the track as fast as you can. Falling off costs a few seconds, never the whole run. Win a bronze, silver or gold medal for your time.</p>
      <div className="marble-picker__ghost">
        <label htmlFor="marble-ghost">Race a ghost: </label>
        <select id="marble-ghost" value={ghostChoice} onChange={(e) => onGhostChoice(e.target.value as GhostKind | 'none')}>
          {GHOST_CHOICES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <p className="marble-picker__hint">A ghost is a see-through marble that plays back a recorded run. Nobody has to be online.</p>
        {busy && <p role="status">Finding your ghost…</p>}
        {note && <p role="status">{note}</p>}
      </div>
      <h3 className="marble-picker__heading">Courses</h3>
      <ul className="marble-courses">{real.map(card)}</ul>
      <h3 className="marble-picker__heading">Practice courses</h3>
      <ul className="marble-courses">{practice.map(card)}</ul>
    </section>
  );
}

/** The class's fastest times on one course, loaded when the panel is opened. */
function BoardPanel({ course, name }: { course: string; name: string }) {
  const [mode, setMode] = useState<ClockMode>('up');
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<Board | null | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setBoard(undefined);
    void loadBoard(course, mode).then((b) => current && setBoard(b));
    return () => {
      current = false;
    };
  }, [open, course, mode]);

  return (
    <details className="marble-board" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Class board</summary>
      <div className="marble-board__modes" role="group" aria-label={`Board for ${name}`}>
        <button type="button" className="button button--light" aria-pressed={mode === 'up'} onClick={() => setMode('up')}>Medal runs</button>
        <button type="button" className="button button--light" aria-pressed={mode === 'down'} onClick={() => setMode('down')}>Hard mode 🔥</button>
      </div>
      {board === undefined && <p role="status">Loading…</p>}
      {board === null && <p>The board can’t be reached right now.</p>}
      {board && board.top.length === 0 && <p>No times yet. Be the first!</p>}
      {board && board.top.length > 0 && (
        <ol className="marble-board__list">
          {board.top.map((row) => (
            <li key={row.rank} className={row.me ? 'marble-board__me' : undefined} value={row.rank}>
              <AvatarImage avatar={row.avatar} size={24} />
              <span>{row.name}{row.me ? ' (you)' : ''}</span>
              <span>{formatSteps(row.steps)}</span>
            </li>
          ))}
        </ol>
      )}
      {board?.me && board.me.rank > 10 && <p>You are number {board.me.rank} of {board.total}: {formatSteps(board.me.steps)}.</p>}
      {board && !board.me && board.total > 0 && <p>Finish this course to get on the board.</p>}
    </details>
  );
}
