/**
 * Marble Rush: the course picker, then a run. For now best times are kept on this device only
 * (saving to the server is stage M.4) and no maths is asked (stages M.6 and M.7).
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { courseById } from '../../../shared/marble/courses';
import { medalFor, type ClockMode } from '../../../shared/marble/engine';
import { formatSteps, loadBests, saveBests, withFinish, type Bests } from './bests';
import { COURSE_INFO } from './courseInfo';
import type { FinishedRun } from './RunScreen';
import './marble.css';

// The picture (three.js) and the run screen load only when someone starts a run.
const RunScreen = lazy(() => import('./RunScreen').then((m) => ({ default: m.RunScreen })));

const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const;

export function MarblePlay() {
  const [bests, setBests] = useState<Bests>(loadBests);
  const [pick, setPick] = useState<{ id: string; mode: ClockMode; round: number } | null>(null);

  const course = pick ? courseById(pick.id) : undefined;
  const hasFinished = (id: string) => bests[id]?.up !== undefined;

  if (pick && course) {
    return (
      <Suspense fallback={<p className="loading" role="status">Setting up the course…</p>}>
        <RunScreen
          key={`${pick.id}-${pick.mode}-${pick.round}`}
          course={course}
          mode={pick.mode}
          best={bests[pick.id]?.[pick.mode]}
          canTryHard={true}
          onDone={(run: FinishedRun) => {
            if (run.outcome !== 'finished') return { isBest: false };
            const next = withFinish(bests, run.courseId, run.mode, run.steps);
            setBests(next.bests);
            saveBests(next.bests);
            return { isBest: next.isBest };
          }}
          onAgain={() => setPick({ ...pick, round: pick.round + 1 })}
          onHard={() => setPick({ id: pick.id, mode: 'down', round: pick.round + 1 })}
          onExit={() => setPick(null)}
        />
      </Suspense>
    );
  }

  return <CoursePicker bests={bests} onPlay={(id, mode) => setPick({ id, mode, round: 0 })} hasFinished={hasFinished} />;
}

function CoursePicker({ bests, onPlay, hasFinished }: { bests: Bests; onPlay: (id: string, mode: ClockMode) => void; hasFinished: (id: string) => boolean }) {
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
              <button type="button" className="button button--play" onClick={() => onPlay(course.def.id, 'up')}>Play {c.name}</button>
              {hasFinished(course.def.id) && (
                <button type="button" className="button button--light" onClick={() => onPlay(course.def.id, 'down')}>Hard mode 🔥</button>
              )}
            </div>
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
      <h3 className="marble-picker__heading">Courses</h3>
      <ul className="marble-courses">{real.map(card)}</ul>
      <h3 className="marble-picker__heading">Practice courses</h3>
      <ul className="marble-courses">{practice.map(card)}</ul>
    </section>
  );
}
