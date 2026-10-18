/**
 * Marble Rush: the course picker, then a run. Finished runs are sent to the server, which replays
 * them and keeps the best times (src/data/marble.ts); a copy of the bests is kept on this device.
 * Maths (stage M.6): when the teacher allows it, a run starts by asking the server for its questions and which
 * shortcut doors are open; pit-stop answers are marked by the server. Runs with maths have their own best times and boards.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { courseById } from '../../../shared/marble/courses';
import { medalFor, type ClockMode } from '../../../shared/marble/engine';
import { encodeInputs } from '../../../shared/marble/inputs';
import { useAuth } from '../../auth/AuthContext';
import { answerQuestion, enqueueRun, fetchMarbleSwitches, flushRuns, loadBoard, loadGhost, loadServerBests, startRun, type Board, type Ghost, type GhostKind } from '../../data/marble';
import { fetchMyFocus } from '../../data/focus';
import { plainSetup, type RunSetup, type StartReply } from '../../../shared/marble/maths';
import type { MathsFocus } from '../../../shared/maths/focus';
import type { Question } from '../../../shared/maths/skillPack';
import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import { FocusNote } from '../../maths/FocusNote';
import { formatSteps, loadBests, mergeBests, saveBests, withFinish, type Bests } from './bests';
import { loadPrefs, savePrefs, type MarblePrefs } from './prefs';
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

/**
 * `localMaths` is for the stand-alone preview (nobody signed in, no server): the questions are made and marked in this
 * browser instead, so the gates and pit stops can be tried. It is never used in the real game.
 */
function MarbleRoot({ localMaths }: { localMaths: boolean }) {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const [plainBests, setPlainBests] = useState<Bests>(() => loadBests(player));
  const [mathsBests, setMathsBests] = useState<Bests>(() => loadBests(player, true));
  const [prefs, setPrefs] = useState<MarblePrefs>(() => loadPrefs(player));
  // What the teacher allows. Until it is known (or if it can't be read) there is no maths.
  const [mathsSwitch, setMathsSwitch] = useState<MathsSwitch>(localMaths ? 'choose' : 'off');
  const localQuestions = useRef<Question[]>([]);
  const [focus, setFocus] = useState<MathsFocus | null>(null);
  const [pick, setPick] = useState<{ id: string; mode: ClockMode; round: number; ghost: Ghost | null; two: boolean; setup: RunSetup; started: StartReply | null } | null>(null);
  const [ghostChoice, setGhostChoice] = useState<GhostKind | 'none'>('none');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const runKey = pick ? `${pick.id}-${pick.mode}-${pick.round}` : '';
  const wantMaths = mathsSwitch === 'on' || (mathsSwitch === 'choose' && prefs.maths);
  const bests = wantMaths ? mathsBests : plainBests;

  // The teacher's switch, and the student's focus (to say why the questions are what they are).
  useEffect(() => {
    let current = true;
    if (!localMaths) void fetchMarbleSwitches().then((s) => current && setMathsSwitch(s.maths), () => undefined);
    void fetchMyFocus().then((f) => current && setFocus(f), () => undefined);
    return () => {
      current = false;
    };
  }, []);

  // Send anything still waiting from an earlier visit, then bring in the server's bests (with and without maths).
  useEffect(() => {
    if (!player) return;
    let current = true;
    void flushRuns(player).then(async () => {
      const [plain, withMaths] = await Promise.all([loadServerBests(false), loadServerBests(true)]);
      if (!current) return;
      if (plain) {
        setPlainBests((have) => {
          const merged = mergeBests(have, plain);
          saveBests(merged, player);
          return merged;
        });
      }
      if (withMaths) {
        setMathsBests((have) => {
          const merged = mergeBests(have, withMaths);
          saveBests(merged, player, true);
          return merged;
        });
      }
    });
    return () => {
      current = false;
    };
  }, [player]);

  const changePrefs = (next: MarblePrefs) => {
    setPrefs(next);
    savePrefs(next, player);
  };

  // Starts a run. The server hands out the seed, and (with maths) the questions and the open doors; a ghost is fetched alongside.
  // Without the server (offline) or for two players the run is plain: arrows at the gates, and it only counts on this device.
  const begin = async (id: string, mode: ClockMode, round: number, two = false) => {
    setNote('');
    setBusy(true);
    const course = courseById(id);
    // The preview makes its own questions (nothing to ask a server).
    if (localMaths && !player && !two && wantMaths && course?.gates.length) {
      const { makeRunQuestions } = await import('../../../shared/marble/questions');
      const { runSetup, slotPlan } = await import('../../../shared/marble/maths');
      const list = makeRunQuestions({ facts: [], settings: {} }, slotPlan(course).total, Math.random);
      localQuestions.current = list;
      setBusy(false);
      setPick({ id, mode, round, ghost: null, two, started: null, setup: runSetup(course, `local-${Math.floor(Math.random() * 1e9)}`, list, true) });
      return;
    }
    const [started, ghost] = await Promise.all([
      player && !two ? startRun(id, mode, wantMaths) : Promise.resolve(null),
      !two && ghostChoice !== 'none' ? loadGhost(id, mode, ghostChoice, wantMaths) : Promise.resolve(null),
    ]);
    setBusy(false);
    if (!two && ghostChoice !== 'none' && !ghost) setNote('No ghost to race on that course yet, so this one is just you.');
    if (player && !two && !started) setNote('We couldn’t reach the server, so this run is just for fun: it won’t be saved and has no maths questions.');
    if (!course) return;
    setPick({ id, mode, round, ghost, two, started, setup: started ?? plainSetup(course) });
  };

  const course = pick ? courseById(pick.id) : undefined;
  const hasFinished = (id: string) => bests[id]?.up !== undefined || plainBests[id]?.up !== undefined || mathsBests[id]?.up !== undefined;

  if (pick && course) {
    return (
      <Suspense fallback={<p className="loading" role="status">Setting up the course…</p>}>
        <RunScreen
          key={runKey}
          course={course}
          mode={pick.mode}
          best={(pick.setup.maths ? mathsBests : plainBests)[pick.id]?.[pick.mode]}
          canTryHard={true}
          ghost={pick.ghost}
          twoPlayer={pick.two}
          setup={pick.setup}
          readTime={prefs.readTime}
          onAnswer={(slot, answer, ms) =>
            pick.started
              ? answerQuestion(pick.started, pick.id, pick.mode, slot, answer, ms)
              : localMaths
                ? markHere(localQuestions.current[slot], answer)
                : Promise.resolve(null)
          }
          onDone={(run: FinishedRun) => {
            if (run.outcome !== 'finished' || pick.two) return { isBest: false };
            const withMaths = run.maths;
            const next = withFinish(withMaths ? mathsBests : plainBests, run.courseId, run.mode, run.steps);
            (withMaths ? setMathsBests : setPlainBests)(next.bests);
            saveBests(next.bests, player, withMaths);
            // The server replays the run and keeps its own time. Without a seed (offline) the run only counts on this device.
            const inputs = encodeInputs(run.inputs);
            const started = pick.started;
            if (started && player) {
              enqueueRun(player, { seed: started.seed, stamp: started.stamp, course: run.courseId, mode: run.mode, inputs });
              void flushRuns(player);
            }
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
      mathsSwitch={mathsSwitch}
      prefs={prefs}
      onPrefs={changePrefs}
      focus={wantMaths ? focus : null}
      wantMaths={wantMaths}
      onPlay={(id, mode, two) => void begin(id, mode, 0, two)}
      hasFinished={hasFinished}
      ghostChoice={ghostChoice}
      onGhostChoice={setGhostChoice}
      busy={busy}
      note={note}
    />
  );
}

export const MarblePlay = () => <MarbleRoot localMaths={false} />;
/** The stand-alone preview: questions made and marked in the browser. */
export const MarblePreview = () => <MarbleRoot localMaths />;

/** The preview marks its own questions. */
async function markHere(question: Question | undefined, answer: number): Promise<{ right: boolean; answer: number } | null> {
  const { markQuestion, sameAnswer } = await import('../../../shared/marble/questions');
  const marked = markQuestion(question);
  return marked ? { right: sameAnswer(answer, marked.answer), answer: marked.answer } : null;
}

function CoursePicker({
  bests, mathsSwitch, prefs, onPrefs, focus, wantMaths, onPlay, hasFinished, ghostChoice, onGhostChoice, busy, note,
}: {
  bests: Bests;
  mathsSwitch: MathsSwitch;
  prefs: MarblePrefs;
  onPrefs: (p: MarblePrefs) => void;
  focus: MathsFocus | null;
  wantMaths: boolean;
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
    const medal = course && best !== undefined ? medalFor(course, best, wantMaths) : null;
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
            {!c.practice && <BoardPanel course={course.def.id} name={c.name} defaultMaths={wantMaths} showMaths={mathsSwitch !== 'off'} />}
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
      {mathsSwitch !== 'off' && (
        <div className="marble-picker__maths">
          {mathsSwitch === 'choose' ? (
            <label>
              <input type="checkbox" checked={prefs.maths} onChange={(e) => onPrefs({ ...prefs, maths: e.target.checked })} />
              <span>Maths: {prefs.maths ? 'on' : 'off'}</span>
            </label>
          ) : (
            <p><strong>Maths is on</strong> for everyone in your class.</p>
          )}
          {wantMaths && (
            <label>
              <input type="checkbox" checked={prefs.readTime} onChange={(e) => onPrefs({ ...prefs, readTime: e.target.checked })} />
              <span>Read time: wait for me to read each gate</span>
            </label>
          )}
          <p className="marble-picker__hint">
            {wantMaths
              ? 'With maths, each gate asks a question and the right tunnel is the shortcut. Pit stops at checkpoints take 2 seconds off for a right answer. A wrong answer only means a longer way round. Your times with maths have their own board.'
              : 'Without maths, an arrow shows you the shortcut. Your times without maths have their own board.'}
          </p>
          <FocusNote focus={focus} />
        </div>
      )}
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
function BoardPanel({ course, name, defaultMaths, showMaths }: { course: string; name: string; defaultMaths: boolean; showMaths: boolean }) {
  const [mode, setMode] = useState<ClockMode>('up');
  const [maths, setMaths] = useState(defaultMaths);
  // The student's maths choice (or the teacher's switch) can arrive after the panel is drawn.
  useEffect(() => setMaths(defaultMaths), [defaultMaths]);
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<Board | null | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setBoard(undefined);
    void loadBoard(course, mode, maths).then((b) => current && setBoard(b));
    return () => {
      current = false;
    };
  }, [open, course, mode, maths]);

  return (
    <details className="marble-board" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Class board</summary>
      <div className="marble-board__modes" role="group" aria-label={`Board for ${name}`}>
        <button type="button" className="button button--light" aria-pressed={mode === 'up'} onClick={() => setMode('up')}>Medal runs</button>
        <button type="button" className="button button--light" aria-pressed={mode === 'down'} onClick={() => setMode('down')}>Hard mode 🔥</button>
      </div>
      {showMaths && (
        <div className="marble-board__modes" role="group" aria-label="With or without maths">
          <button type="button" className="button button--light" aria-pressed={!maths} onClick={() => setMaths(false)}>Without maths</button>
          <button type="button" className="button button--light" aria-pressed={maths} onClick={() => setMaths(true)}>With maths</button>
        </div>
      )}
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
