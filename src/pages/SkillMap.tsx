/**
 * The teacher's skill map: one row for each student in a class, one column for each stage of the maths ladder, each cell coloured
 * (and lettered) from not started to fluent. A stage opens into its skills; a skill opens into the facts or question types
 * behind it, or for the times tables the 12 × 12 grid. Every colour comes from the shared maths the games use
 * (shared/maths/skillMap.ts), and the database only hands over the records of classes this teacher teaches.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { fetchClasses, type ClassSummary } from '../data/classes';
import { FriendlyError } from '../data/profile';
import { fetchClassMap, type ClassMap, type MapStudent } from '../data/skillMap';
import { mastery, type FactStats } from '../../shared/maths/leitner';
import { parseFactKey } from '../../shared/maths/facts';
import { packIdOfKey, type LadderStage } from '../../shared/maths/ladder';
import { skillShortLabel } from '../../shared/maths/focus';
import {
  cellFor,
  LEVELS,
  STAGES,
  stageOfSkill,
  stageSkills,
  studentMap,
  type CellLevel,
  type StageCell,
  type StudentMap,
} from '../../shared/maths/skillMap';
import { FactGrid } from './TeacherGemKeep';
import { keyLabel } from './TeacherMonsters';
import './classes.css';
import './skill-map.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export default function SkillMap() {
  const { profile } = useAuth();
  if (profile?.role !== 'teacher') {
    return (
      <section className="coming-soon">
        <div className="coming-soon__emoji" aria-hidden="true">
          🔒
        </div>
        <h1>Teachers only</h1>
        <p className="coming-soon__text">This page is for teachers.</p>
      </section>
    );
  }
  return <SkillMapView />;
}

function SkillMapView() {
  const [params, setParams] = useSearchParams();
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses()
      .then(setClasses)
      .catch((error) => {
        setFailed(errorText(error));
        setClasses([]);
      });
  }, []);

  const mine = (classes ?? []).filter((c) => !c.archived);
  const wanted = params.get('class');
  const chosen = mine.find((c) => c.id === wanted) ?? mine.find((c) => c.teaching) ?? mine[0] ?? null;

  return (
    <div className="teacher classes skill-map-page">
      <h1 className="page-title">Skill map</h1>
      <p className="classes__back">
        <Link to="/teacher">← Back to the teacher view</Link>
      </p>
      <p className="teacher__classes-link">
        How each student is getting on across the maths ladder. Open a stage to see its skills, and a cell to see the facts behind it.
      </p>

      {classes === null ? (
        <p className="teacher__classes-link">Loading…</p>
      ) : mine.length === 0 ? (
        <section className="panel">
          <p className="panel__empty">
            {failed ?? 'You don’t teach a class yet.'} <Link to="/classes">Make one on the My classes page</Link> first.
          </p>
        </section>
      ) : (
        <>
          {mine.length > 1 && (
            <div className="teacher__picker">
              <label>
                <span>Class</span>{' '}
                <select value={chosen?.id ?? ''} onChange={(e) => setParams({ class: e.target.value }, { replace: true })}>
                  {mine.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.teaching ? '' : ' (not mine)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {chosen && <ClassMapPanel key={chosen.id} classId={chosen.id} name={chosen.name} />}
        </>
      )}
    </div>
  );
}

const levelWords = (c: { level: CellLevel }) => LEVELS[c.level].label;

interface Picked {
  student: string;
  skill: string;
}

function ClassMapPanel({ classId, name }: { classId: string; name: string }) {
  const [data, setData] = useState<ClassMap | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<LadderStage>>(new Set());
  const [picked, setPicked] = useState<Picked | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let current = true;
    fetchClassMap(classId)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [classId]);

  const maps = useMemo(
    () =>
      new Map(
        (data?.students ?? []).map((s) => [
          s.id,
          studentMap(s.facts, s.ladder, {
            enabledTables: s.enabledTables,
            division: s.division,
          }),
        ]),
      ),
    [data],
  );

  useEffect(() => {
    if (picked) detailHeading.current?.focus();
  }, [picked]);

  function toggle(stage: LadderStage) {
    setOpen((now) => {
      const next = new Set(now);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
    // A skill that is no longer on screen can't stay picked.
    setPicked((p) => (p && stageOfSkill(p.skill) === stage ? null : p));
  }

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

  const students = data.students;
  const allOpen = open.size === STAGES.length;
  const pickedStudent = picked ? students.find((s) => s.id === picked.student) : undefined;

  return (
    <>
      <section className="panel" aria-labelledby="map-title">
        <h2 id="map-title" className="panel__title">
          {name}
          <span className="panel__count">
            {students.length} student{students.length === 1 ? '' : 's'}
          </span>
        </h2>
        {!data.auto && (
          <p className="class-panel__hint" role="note">
            Auto is off for this class, so the games ask the times tables and don’t follow the ladder. The map still shows what each student
            has practised. Turn auto on from <Link to={`/focus?class=${classId}`}>Maths focus</Link>.
          </p>
        )}
        {students.length === 0 ? (
          <p className="panel__empty">
            No students in this class yet. <Link to="/classes">Add some on the My classes page.</Link>
          </p>
        ) : (
          <>
            <div className="skill-map__tools">
              <button
                type="button"
                className="button button--light-outline"
                onClick={() => setOpen(allOpen ? new Set() : new Set(STAGES.map((s) => s.id)))}
              >
                {allOpen ? 'Close every stage' : 'Open every stage'}
              </button>
              <ul className="skill-map__legend" aria-label="Key">
                {(['not-started', 'learning', 'secure', 'fluent'] as CellLevel[]).map((level) => (
                  <li key={level}>
                    <span className="skill-map__swatch" data-level={level} aria-hidden="true">
                      {LEVELS[level].mark}
                    </span>
                    <span>
                      <strong>{LEVELS[level].label}</strong>: {LEVELS[level].about}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="skill-map__scroll" role="region" aria-label={`Skill map for ${name}`} tabIndex={0}>
              <table className="skill-map">
                <caption className="sr-only">
                  Each row is a student. Each column is a stage of the maths ladder; open a stage to see its skills.
                </caption>
                <MapHead open={open} onToggle={toggle} classId={classId} />
                <tbody>
                  {students.map((s) => (
                    <MapRow key={s.id} student={s} map={maps.get(s.id)!} open={open} picked={picked} onPick={setPicked} classId={classId} />
                  ))}
                </tbody>
                <MapFoot maps={students.map((s) => maps.get(s.id)!)} open={open} />
              </table>
            </div>
          </>
        )}
      </section>

      {picked && pickedStudent && (
        <CellDetail
          key={`${picked.student}-${picked.skill}`}
          student={pickedStudent}
          map={maps.get(pickedStudent.id)!}
          skillId={picked.skill}
          classId={classId}
          heading={detailHeading}
          onClose={() => setPicked(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- the table

function MapHead({ open, onToggle, classId }: { open: Set<LadderStage>; onToggle: (stage: LadderStage) => void; classId: string }) {
  return (
    <thead>
      <tr>
        <th scope="col" rowSpan={2} className="skill-map__who">
          Student
        </th>
        <th scope="col" rowSpan={2} className="skill-map__place">
          On the ladder
        </th>
        {STAGES.map((stage) => {
          const isOpen = open.has(stage.id);
          return (
            <th
              key={stage.id}
              scope="col"
              className="skill-map__stage"
              rowSpan={isOpen ? 1 : 2}
              colSpan={isOpen ? stageSkills(stage.id).length : 1}
              data-open={isOpen || undefined}
            >
              <button type="button" aria-expanded={isOpen} onClick={() => onToggle(stage.id)}>
                <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span> {stage.label}
                <span className="sr-only">{isOpen ? ', open. Press to close' : ', closed. Press to open its skills'}</span>
              </button>
            </th>
          );
        })}
      </tr>
      <tr>
        {STAGES.filter((stage) => open.has(stage.id)).flatMap((stage) =>
          stageSkills(stage.id).map((skill) => (
            <th key={skill.id} scope="col" className="skill-map__skill">
              <span className="skill-map__skill-name">{skillShortLabel(skill.id)}</span>
              <Link className="skill-map__focus" to={`/focus?class=${classId}&skill=${skill.id}`}>
                Set focus <span className="sr-only">on {skill.label}</span>
              </Link>
            </th>
          )),
        )}
      </tr>
    </thead>
  );
}

function MapRow({
  student,
  map,
  open,
  picked,
  onPick,
  classId,
}: {
  student: MapStudent;
  map: StudentMap;
  open: Set<LadderStage>;
  picked: Picked | null;
  onPick: (p: Picked | null) => void;
  classId: string;
}) {
  const started = map.stages.some((s) => s.cells.some((c) => c.level !== 'not-started' && c.level !== 'off'));
  return (
    <tr>
      <th scope="row" className="skill-map__who">
        <span className="skill-map__name">{student.name}</span>
        {student.realName && <span className="skill-map__real">{student.realName}</span>}
        <Link className="skill-map__focus" to={`/focus?class=${classId}&student=${student.id}`}>
          Set focus <span className="sr-only">for {student.name}</span>
        </Link>
      </th>
      <td className="skill-map__place">
        <Place student={student} map={map} started={started} />
      </td>
      {map.stages.flatMap((stage) =>
        open.has(stage.stage)
          ? stage.cells.map((cell) => (
              <td
                key={cell.skill.id}
                className="skill-map__cell"
                data-level={cell.level}
                data-picked={picked?.student === student.id && picked.skill === cell.skill.id ? true : undefined}
              >
                <button
                  type="button"
                  aria-pressed={picked?.student === student.id && picked.skill === cell.skill.id}
                  onClick={() =>
                    onPick(
                      picked?.student === student.id && picked.skill === cell.skill.id
                        ? null
                        : { student: student.id, skill: cell.skill.id },
                    )
                  }
                  title={`${student.name}: ${cell.skill.label}: ${levelWords(cell)}`}
                >
                  <span aria-hidden="true">{LEVELS[cell.level].mark}</span>
                  <span className="sr-only">
                    {student.name}, {cell.skill.label}: {levelWords(cell)}
                    {cell.level !== 'off' && cell.keys > 0 ? `, ${Math.round(cell.share * 100)}% secure` : ''}
                    {cell.status === 'current' ? ', where they are now' : ''}
                  </span>
                </button>
              </td>
            ))
          : [<StageTd key={stage.stage} student={student} stage={stage} />],
      )}
    </tr>
  );
}

function StageTd({ student, stage }: { student: MapStudent; stage: StageCell }) {
  return (
    <td className="skill-map__cell skill-map__cell--stage" data-level={stage.level} data-here={stage.hasCurrent || undefined}>
      <span aria-hidden="true" className="skill-map__mark">
        {LEVELS[stage.level].mark}
      </span>
      <span className="skill-map__count">{stage.level === 'off' ? '' : `${stage.secure} of ${stage.counted}`}</span>
      <span className="sr-only">
        {student.name}, {stage.label}: {LEVELS[stage.level].label}
        {stage.level === 'off' ? '' : `, ${stage.secure} of ${stage.counted} skills secure`}
        {stage.hasCurrent ? ', where they are now' : ''}
      </span>
    </td>
  );
}

function Place({ student, map, started }: { student: MapStudent; map: StudentMap; started: boolean }) {
  const info = student.ladder;
  const here = map.current ? skillShortLabel(map.current.id) : started ? 'Every skill secure' : 'Not started';
  const furthest = map.furthest ? skillShortLabel(map.furthest.id) : null;
  return (
    <>
      <span className="skill-map__here">
        <span className="skill-map__tag">Now</span> {here}
      </span>
      {furthest && (
        <span className="skill-map__far">
          <span className="skill-map__tag">Furthest</span> {furthest}
        </span>
      )}
      {info.on && (
        <span className="skill-map__far">
          <span className="skill-map__tag">Warm-up</span>{' '}
          {info.placed === 'done' ? 'done' : info.placed === 'skipped' ? 'skipped' : 'not done'}
        </span>
      )}
    </>
  );
}

const isSecure = (level: CellLevel | undefined) => level === 'secure' || level === 'fluent';

function MapFoot({ maps, open }: { maps: StudentMap[]; open: Set<LadderStage> }) {
  return (
    <tfoot>
      <tr>
        <th scope="row" className="skill-map__who">
          Secure or fluent
        </th>
        <td className="skill-map__place" />
        {STAGES.flatMap((stage) =>
          open.has(stage.id)
            ? stageSkills(stage.id).map((skill) => (
                <td key={skill.id} className="skill-map__total">
                  {maps.filter((m) => isSecure(cellFor(m, skill.id)?.level)).length} of {maps.length}{' '}
                  <span className="sr-only">students are secure on {skill.label}</span>
                </td>
              ))
            : [
                <td key={stage.id} className="skill-map__total">
                  {maps.filter((m) => isSecure(m.stages.find((s) => s.stage === stage.id)?.level)).length} of {maps.length}{' '}
                  <span className="sr-only">students are secure on every skill in {stage.label}</span>
                </td>,
              ],
        )}
      </tr>
    </tfoot>
  );
}

// ---------------------------------------------------------------- one cell, opened

function CellDetail({
  student,
  map,
  skillId,
  classId,
  heading,
  onClose,
}: {
  student: MapStudent;
  map: StudentMap;
  skillId: string;
  classId: string;
  heading: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
}) {
  const cell = cellFor(map, skillId);
  const byKey = useMemo(() => new Map(student.facts.map((f) => [f.key, f])), [student.facts]);
  if (!cell) return null;
  const tables = cell.skill.stage === 'times-tables';
  const times = cell.skill.keys.filter((k) => parseFactKey(k));
  const others = cell.skill.keys.filter((k) => !parseFactKey(k));
  return (
    <section className="panel skill-map__detail" aria-labelledby="cell-title">
      <h2 id="cell-title" className="panel__title" tabIndex={-1} ref={heading}>
        {student.name}: {cell.skill.label}
      </h2>
      <p>
        <strong>{LEVELS[cell.level].label}.</strong>{' '}
        {cell.level === 'off'
          ? 'All of this skill’s tables are switched off for the class.'
          : `${Math.round(cell.share * 100)}% of its ${tables ? 'facts' : 'question types'} are secure (${cell.asked} of ${cell.keys} asked).`}{' '}
        {cell.status === 'current' && 'This is where they are now.'}
        {cell.passedOver && ' It is behind their starting point, so the games don’t ask it unless they come back to it.'}
      </p>
      {tables && times.length > 0 && <FactGrid facts={student.facts.filter((f) => f.key.startsWith('mul:'))} />}
      {(!tables ? cell.skill.keys : others).length > 0 && (
        <KeyTable keys={tables ? others : cell.skill.keys} byKey={byKey} tables={tables} />
      )}
      <div className="skill-map__detail-actions">
        <Link className="button button--light-outline" to={`/focus?class=${classId}&student=${student.id}&skill=${cell.skill.id}`}>
          🎯 Set a focus on this for {student.name}
        </Link>
        <button type="button" className="button button--light-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}

/** A key in words: "56 ÷ 8" for a division fact, otherwise what kind of question it is. */
const factName = (key: string) => {
  const div = /^div:(\d+)\/(\d+)$/.exec(key);
  return div ? `${div[1]} ÷ ${div[2]}` : keyLabel(packIdOfKey(key) ?? '', key);
};

function KeyTable({ keys, byKey, tables }: { keys: string[]; byKey: Map<string, FactStats>; tables: boolean }) {
  return (
    <table className="stats-table skill-map__keys">
      <caption>{tables ? 'Division facts' : 'Question types'}</caption>
      <thead>
        <tr>
          <th scope="col">{tables ? 'Fact' : 'Type'}</th>
          <th scope="col">How well</th>
          <th scope="col">Right</th>
          <th scope="col">Asked</th>
          <th scope="col">Average time</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const stats = byKey.get(key);
          const m = mastery(stats);
          const level: CellLevel = m === 'not-tried' ? 'not-started' : m;
          return (
            <tr key={key}>
              <th scope="row">{factName(key)}</th>
              <td>
                <span className="skill-map__swatch" data-level={level} aria-hidden="true">
                  {LEVELS[level].mark}
                </span>{' '}
                {LEVELS[level].label}
              </td>
              <td>{stats?.attempts ? `${Math.round((stats.correct / stats.attempts) * 100)}%` : '–'}</td>
              <td>{stats?.attempts ?? 0}</td>
              <td>{stats?.attempts ? `${(stats.avgMs / 1000).toFixed(1)} s` : '–'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
