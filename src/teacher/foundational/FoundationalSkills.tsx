/**
 * The Maths tab's "Foundational skills" page (R7 plan, 3.1): the class grid, and under it the facts behind whichever cell a
 * teacher presses (the same kind of table the skill map opens), with a link on to that pupil's own page. The grid and its rules
 * are in ./FoundationalGrid.tsx and ./flags.ts; this only loads them and holds the picked cell.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { mastery } from '../../../shared/maths/leitner';
import { LEVELS, type CellLevel } from '../../../shared/maths/skillMap';
import { STAGES } from '../../../shared/subitising/config';
import { foundationalClass, type FoundationalClass } from '../../data/foundational';
import { FriendlyError } from '../../data/profile';
import { useTeacherClass } from '../TeacherClass';
import { QUICK_LOOKS_ID } from './config';
import { FoundationalGrid, type PickedCell } from './FoundationalGrid';
import { classRows } from './flags';
import { IDEAS, keyWords } from './ideas';

export default function FoundationalSkills() {
  const { current } = useTeacherClass();
  return (
    <div className="classes fg-page">
      <p className="teacher__classes-link">
        How each student is getting on in the Foundational games and Quick looks. A “!” says in words what a student is stuck on.
        Press a cell to see the facts behind it.
      </p>
      {current && <Panel key={current.id} classId={current.id} name={current.name} />}
    </div>
  );
}

function Panel({ classId, name }: { classId: string; name: string }) {
  const [data, setData] = useState<FoundationalClass | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedCell | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let current = true;
    foundationalClass(classId).then(
      (d) => current && setData(d),
      (error) => current && setFailed(error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.'),
    );
    return () => {
      current = false;
    };
  }, [classId]);

  const rows = useMemo(() => (data ? classRows(data) : []), [data]);
  useEffect(() => {
    if (picked) heading.current?.focus();
  }, [picked]);

  if (failed) {
    return (
      <section className="panel">
        <p role="alert" className="panel__empty">
          {failed}
        </p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="panel">
        <p className="panel__empty" role="status">
          Loading…
        </p>
      </section>
    );
  }
  const pupil = picked ? data.map.students.find((s) => s.id === picked.student) : undefined;
  const idea = picked ? IDEAS.find((i) => i.id === picked.idea) : undefined;
  return (
    <>
      <section className="panel" aria-labelledby="fg-title">
        <h2 id="fg-title" className="panel__title">
          {name}
          <span className="panel__count">
            {rows.length} student{rows.length === 1 ? '' : 's'}
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="panel__empty">
            No students in this class yet. <Link to={`/teacher/${classId}/setup`}>Add some on Class set-up.</Link>
          </p>
        ) : (
          <FoundationalGrid rows={rows} className={name} picked={picked} onPick={setPicked} />
        )}
      </section>
      {picked && pupil && idea && (
        <Detail key={`${picked.student}-${picked.idea}`} data={data} studentId={pupil.id} ideaId={idea.id} classId={classId} heading={heading} onClose={() => setPicked(null)} />
      )}
    </>
  );
}

function Detail({
  data,
  studentId,
  ideaId,
  classId,
  heading,
  onClose,
}: {
  data: FoundationalClass;
  studentId: string;
  ideaId: string;
  classId: string;
  heading: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
}) {
  const student = data.map.students.find((s) => s.id === studentId)!;
  const idea = IDEAS.find((i) => i.id === ideaId)!;
  const byKey = new Map(student.facts.map((f) => [f.key, f]));
  const quick = data.pupils.get(studentId)?.quickLooks ?? null;
  return (
    <section className="panel fg-page__detail" aria-labelledby="fg-detail-title">
      <h2 id="fg-detail-title" className="panel__title" tabIndex={-1} ref={heading}>
        {student.name}: {idea.label}
      </h2>
      {idea.game === QUICK_LOOKS_ID ? (
        <p>
          {quick
            ? `${quick.finished} of ${STAGES.length} stages finished. ${quick.answered > 0 ? `${quick.correct} of the last ${quick.answered} pictures right.` : 'No pictures counted yet.'}`
            : 'Has not used Quick looks yet.'}
        </p>
      ) : (
        idea.parts.map((part) => (
          <table key={part.label ?? 'all'} className="stats-table skill-map__keys">
            <caption>{part.label ? `Pairs that make ${part.label}` : 'Facts'}</caption>
            <thead>
              <tr>
                <th scope="col">Fact</th>
                <th scope="col">How well</th>
                <th scope="col">Right</th>
                <th scope="col">Asked</th>
              </tr>
            </thead>
            <tbody>
              {part.keys.map((key) => {
                const stats = byKey.get(key);
                const m = mastery(stats);
                const level: CellLevel = m === 'not-tried' ? 'not-started' : m;
                return (
                  <tr key={key}>
                    <th scope="row">{keyWords(key)}</th>
                    <td>
                      <span className="fg__swatch" data-level={level} aria-hidden="true">
                        {LEVELS[level].mark}
                      </span>{' '}
                      {LEVELS[level].label}
                    </td>
                    <td>{stats?.correct ?? 0}</td>
                    <td>{stats?.attempts ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))
      )}
      <div className="fg-page__actions">
        <Link className="button button--light-outline" to={`/teacher/${classId}/students/${student.id}`}>
          Open {student.name}’s page
        </Link>
        <button type="button" className="button button--light-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
