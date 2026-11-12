/**
 * The teacher's skill map: one row for each pupil in a class, one column for each ladder skill the class is using (or every
 * skill, or one stage), each cell coloured (and lettered) from not started to fluent. Tapping a cell opens a side panel with the
 * facts or question types behind it (for the times tables, the 12 × 12 grid) and focus buttons. Every colour comes from the
 * shared maths the games use (shared/maths/skillMap.ts), and the database only hands over the records of classes this teacher
 * teaches.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { FriendlyError } from '../data/profile';
import { fetchClassMap, type ClassMap, type MapStudent } from '../data/skillMap';
import { mastery, wrongNote, type FactStats } from '../../shared/maths/leitner';
import { parseFactKey } from '../../shared/maths/facts';
import { packIdOfKey, type LadderSkill, type LadderStage } from '../../shared/maths/ladder';
import { skillTinyLabel } from '../../shared/maths/skillNames';
import {
  cellFor,
  classCounts,
  classMiddle,
  ladderPlace,
  LEVELS,
  LOOKS,
  mostAreOn,
  pupilLooks,
  skillsInUse,
  STAGES,
  stageSkills,
  studentMap,
  type CellLevel,
  type Look,
  type StageCell,
  type StudentMap,
} from '../../shared/maths/skillMap';
import { FactGrid } from './TeacherGemKeep';
import { keyLabel } from './TeacherMonsters';
import { useTeacherClass } from '../teacher/TeacherClass';
import './classes.css';
import '../teacher/progress/progress.css';
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

/** The Maths tab's Skill map page, for the class in the teacher header (src/teacher/TeacherShell.tsx). */
function SkillMapView() {
  const { current } = useTeacherClass();

  return (
    <div className="classes skill-map-page">
      <p className="teacher__classes-link">Where each pupil is on the maths ladder. Tap a cell to see the facts behind it.</p>
      {current && <ClassMapPanel key={current.id} classId={current.id} name={current.name} />}
    </div>
  );
}

const levelWords = (c: { level: CellLevel }) => LEVELS[c.level].label;

interface Picked {
  student: string;
  skill: string;
}

/** Which skills are columns: the ones the class is using (the default), every skill, or one stage. */
type Show = 'in-use' | 'all' | LadderStage;
const SHOW_KEY = 'skill-map-show';
const isShow = (v: unknown): v is Show => v === 'in-use' || v === 'all' || STAGES.some((s) => s.id === v);
function readShow(): Show {
  try {
    const v = localStorage.getItem(SHOW_KEY);
    return isShow(v) ? v : 'in-use';
  } catch {
    return 'in-use';
  }
}
function saveShow(show: Show) {
  try {
    localStorage.setItem(SHOW_KEY, show);
  } catch {
    // Remembering is only a convenience.
  }
}

const LOOK_WORDS: Record<Look, (n: number) => string> = {
  nearly: (n) => `${n} nearly ready to move up`,
  hard: (n) => `${n} finding it hard`,
  behind: (n) => `${n} behind the class`,
  quiet: (n) => `${n} gone quiet`,
};
const isLook = (v: unknown): v is Look => LOOKS.includes(v as Look);

/** How the rows are ordered: furthest behind first (the default), by name, or furthest along first. */
type Sort = 'place' | 'name' | 'furthest';
const SORT_KEY = 'skill-map-sort';
const isSort = (v: unknown): v is Sort => v === 'place' || v === 'name' || v === 'furthest';
function readSort(): Sort {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return isSort(v) ? v : 'place';
  } catch {
    return 'place';
  }
}

/** One stage band in the table: its visible skills, or folded into one summary column. */
interface Band {
  stage: LadderStage;
  label: string;
  skills: LadderSkill[];
  folded: boolean;
}

/** The bands for what is shown, and the stages left out because nobody has started them (one hatched column). */
function bandsFor(show: Show, inUse: ReadonlySet<string>, folded: ReadonlySet<LadderStage>): { bands: Band[]; rest: string[] } {
  const bands: Band[] = [];
  const rest: string[] = [];
  for (const stage of STAGES) {
    if (show !== 'in-use' && show !== 'all' && show !== stage.id) continue;
    const skills = stageSkills(stage.id).filter((s) => show !== 'in-use' || inUse.has(s.id));
    if (skills.length === 0) rest.push(stage.label);
    else bands.push({ stage: stage.id, label: stage.label, skills, folded: folded.has(stage.id) });
  }
  return { bands, rest };
}

const cellKey = (student: string, skill: string) => `${student}:${skill}`;

function ClassMapPanel({ classId, name }: { classId: string; name: string }) {
  const [data, setData] = useState<ClassMap | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [show, setShowState] = useState<Show>(readShow);
  const [folded, setFolded] = useState<Set<LadderStage>>(new Set());
  const [picked, setPicked] = useState<Picked | null>(null);
  const [sort, setSortState] = useState<Sort>(readSort);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const lookParam = params.get('show');
  const look = isLook(lookParam) ? lookParam : null;
  const scroller = useRef<HTMLDivElement>(null);

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
  const allMaps = useMemo(() => [...maps.values()], [maps]);
  const inUse = useMemo(() => skillsInUse(allMaps), [allMaps]);
  const looks = useMemo(() => {
    const middle = classMiddle(allMaps);
    const now = Date.now();
    return new Map((data?.students ?? []).map((s) => [s.id, pupilLooks(maps.get(s.id)!, s.facts, middle, now)]));
  }, [data, maps, allMaps]);
  const most = useMemo(() => mostAreOn(allMaps), [allMaps]);

  function setSort(next: Sort) {
    setSortState(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Remembering is only a convenience.
    }
  }

  function setLook(next: Look | null) {
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (next) n.set('show', next);
        else n.delete('show');
        return n;
      },
      { replace: true },
    );
  }

  /** "Most are on" lights up that skill's column and scrolls it into view. */
  function showMost() {
    if (!most) return;
    const id = most.skill.id;
    setHighlight((h) => (h === id ? null : id));
    if (show !== 'in-use' && show !== 'all' && show !== most.skill.stage) setShow('in-use');
    setFolded((f) => {
      const n = new Set(f);
      n.delete(most.skill.stage);
      return n;
    });
    requestAnimationFrame(() =>
      scroller.current?.querySelector(`th[data-skill="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }),
    );
  }

  function setShow(next: Show) {
    setShowState(next);
    saveShow(next);
    setPicked(null);
  }

  function toggle(stage: LadderStage) {
    setFolded((now) => {
      const next = new Set(now);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
    setPicked(null);
  }

  /** Closing the panel puts the keyboard back on the cell it came from. */
  function closeDetail() {
    const from = picked;
    setPicked(null);
    if (from) requestAnimationFrame(() => scroller.current?.querySelector<HTMLButtonElement>(`[data-cell="${cellKey(from.student, from.skill)}"] button`)?.focus());
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

  const everyone = data.students;
  const name0 = (s: MapStudent) => s.name.toLowerCase();
  const sorted = [...everyone].sort((a, b) =>
    sort === 'name'
      ? name0(a).localeCompare(name0(b))
      : (sort === 'place' ? 1 : -1) * (ladderPlace(maps.get(a.id)!) - ladderPlace(maps.get(b.id)!)) || name0(a).localeCompare(name0(b)),
  );
  const students = look ? sorted.filter((s) => looks.get(s.id)?.has(look)) : sorted;
  const lookCounts = Object.fromEntries(LOOKS.map((l) => [l, everyone.filter((s) => looks.get(s.id)?.has(l)).length])) as Record<Look, number>;
  const pickedStudent = picked ? students.find((s) => s.id === picked.student) : undefined;
  const { bands, rest } = bandsFor(show, inUse, folded);
  const nothingYet = show === 'in-use' && inUse.size === 0;

  return (
    <section className="panel" aria-labelledby="map-title">
      <h2 id="map-title" className="panel__title">
        {name}
        <span className="panel__count">
          {look ? `${students.length} of ${everyone.length}` : everyone.length} student{everyone.length === 1 ? '' : 's'}
        </span>
      </h2>
      {!data.auto && (
        <p className="class-panel__hint" role="note">
          Auto is off for this class, so the games ask the times tables and don’t follow the ladder. The map still shows what each student has
          practised. Turn auto on from <Link to={`/teacher/${classId}/maths`}>Maths focus</Link>.
        </p>
      )}
      {everyone.length === 0 ? (
        <p className="panel__empty">
          No students in this class yet. <Link to={`/teacher/${classId}/setup`}>Add some on Class set-up.</Link>
        </p>
      ) : (
        <>
          <div className="skill-map__tools">
            <label className="skill-map__show">
              Show{' '}
              <select id="skill-map-show" value={show} onChange={(e) => isShow(e.target.value) && setShow(e.target.value)}>
                <option value="in-use">Skills in use</option>
                <option value="all">Every skill</option>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="skill-map__show">
              Sort{' '}
              <select id="skill-map-sort" value={sort} onChange={(e) => isSort(e.target.value) && setSort(e.target.value)}>
                <option value="place">Furthest behind first</option>
                <option value="name">Name</option>
                <option value="furthest">Furthest along first</option>
              </select>
            </label>
            <Legend />
          </div>
          {!nothingYet && (
            <div className="progress__looks skill-map__looks" role="group" aria-label="Who needs a look">
              {most && (
                <button type="button" className="progress__look skill-map__most" aria-pressed={highlight === most.skill.id} onClick={showMost}>
                  Most are on: {skillTinyLabel(most.skill.id)} · {most.pupils} pupil{most.pupils === 1 ? '' : 's'}
                </button>
              )}
              {LOOKS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="progress__look"
                  data-look={l}
                  aria-pressed={look === l}
                  onClick={() => setLook(look === l ? null : l)}
                >
                  {LOOK_WORDS[l](lookCounts[l])}
                </button>
              ))}
              {look && (
                <span className="progress__only">
                  Showing {students.length} of {everyone.length}.{' '}
                  <button type="button" className="progress__sort" onClick={() => setLook(null)}>
                    Show all
                  </button>
                </span>
              )}
            </div>
          )}
          {nothingYet ? (
            <p className="panel__empty skill-map__nothing">Nobody in {name} has answered ladder maths yet.</p>
          ) : (
            <div className={`skill-map__body${picked ? ' skill-map__body--detail' : ''}`}>
              <div className="skill-map__scroll" role="region" aria-label={`Skill map for ${name}`} tabIndex={0} ref={scroller}>
                <table className="skill-map">
                  <caption className="sr-only">Each row is a pupil. Each column is a ladder skill, grouped by stage.</caption>
                  <MapHead bands={bands} rest={rest} onToggle={toggle} onShowAll={() => setShow('all')} maps={allMaps} highlight={highlight} />
                  <tbody>
                    {students.map((s) => (
                      <MapRow
                        key={s.id}
                        student={s}
                        map={maps.get(s.id)!}
                        bands={bands}
                        rest={rest.length > 0}
                        looks={looks.get(s.id)!}
                        highlight={highlight}
                        picked={picked}
                        onPick={setPicked}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {picked && pickedStudent && (
                <CellDetail
                  key={cellKey(picked.student, picked.skill)}
                  student={pickedStudent}
                  map={maps.get(pickedStudent.id)!}
                  skillId={picked.skill}
                  classId={classId}
                  students={everyone}
                  maps={maps}
                  onClose={closeDetail}
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Legend() {
  return (
    <ul className="skill-map__legend" aria-label="Key">
      {(['not-started', 'learning', 'secure', 'fluent'] as CellLevel[]).map((level) => (
        <li key={level}>
          <span className="skill-map__swatch" data-level={level} aria-hidden="true">
            {LEVELS[level].mark}
          </span>
          <span title={LEVELS[level].about}>
            {LEVELS[level].label}
            <span className="sr-only">: {LEVELS[level].about}</span>
          </span>
        </li>
      ))}
      <li>
        <span className="skill-map__swatch skill-map__swatch--now" aria-hidden="true" />
        <span>Now (where auto is)</span>
      </li>
    </ul>
  );
}

// ---------------------------------------------------------------- the table

const isSecure = (level: CellLevel | undefined) => level === 'secure' || level === 'fluent';

/** A small bar of the class on one column: fluent, secure and learning, out of every pupil. */
function ClassBar({ fluent, secure, learning, total }: { fluent: number; secure: number; learning: number; total: number }) {
  const w = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <span className="skill-map__bar" aria-hidden="true">
      <i data-level="fluent" style={{ width: w(fluent) }} />
      <i data-level="secure" style={{ width: w(secure) }} />
      <i data-level="learning" style={{ width: w(learning) }} />
    </span>
  );
}

function MapHead({
  bands,
  rest,
  onToggle,
  onShowAll,
  maps,
  highlight,
}: {
  bands: Band[];
  rest: string[];
  onToggle: (stage: LadderStage) => void;
  onShowAll: () => void;
  maps: StudentMap[];
  highlight: string | null;
}) {
  const total = maps.length;
  return (
    <thead>
      <tr className="skill-map__bands">
        <th scope="col" rowSpan={2} className="skill-map__who">
          Pupil
        </th>
        <th scope="col" rowSpan={2} className="skill-map__place">
          Now on
        </th>
        {bands.map((band) => {
          const isOpen = !band.folded;
          const levels = maps.map((m) => m.stages.find((s) => s.stage === band.stage)?.level);
          return (
            <th
              key={band.stage}
              scope="col"
              className="skill-map__stage"
              data-stage={band.stage}
              rowSpan={isOpen ? 1 : 2}
              colSpan={isOpen ? band.skills.length : 1}
              data-open={isOpen || undefined}
            >
              <button type="button" aria-expanded={isOpen} onClick={() => onToggle(band.stage)}>
                <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span> {band.label}
                <span className="sr-only">{isOpen ? ', open. Press to fold it into one column' : ', folded. Press to open its skills'}</span>
              </button>
              {!isOpen && (
                <>
                  <ClassBar
                    fluent={levels.filter((l) => l === 'fluent').length}
                    secure={levels.filter((l) => l === 'secure').length}
                    learning={levels.filter((l) => l === 'learning').length}
                    total={total}
                  />
                  <span className="skill-map__secure">
                    {levels.filter(isSecure).length} of {total}
                    <span className="sr-only"> students are secure on every skill in {band.label}</span>
                  </span>
                </>
              )}
            </th>
          );
        })}
        {rest.length > 0 && (
          <th scope="col" rowSpan={2} className="skill-map__rest">
            <button type="button" onClick={onShowAll}>
              {rest.join(', ')}: nobody yet
              <span className="sr-only">. Press to show every skill</span>
            </button>
          </th>
        )}
      </tr>
      <tr className="skill-map__names">
        {bands
          .filter((band) => !band.folded)
          .flatMap((band) =>
            band.skills.map((skill) => {
              const counts = classCounts(maps, skill.id);
              return (
                <th
                  key={skill.id}
                  scope="col"
                  className="skill-map__skill"
                  data-stage={band.stage}
                  data-skill={skill.id}
                  data-highlight={highlight === skill.id || undefined}
                  title={skill.label}
                >
                  <span className="skill-map__skill-name" aria-hidden="true">
                    {skillTinyLabel(skill.id)}
                  </span>
                  <span className="sr-only">{skill.label}</span>
                  <ClassBar fluent={counts.fluent} secure={counts.secure} learning={counts.learning} total={total} />
                  <span className="skill-map__secure">
                    {counts.secure + counts.fluent} of {total}
                    <span className="sr-only"> students are secure on {skill.label}</span>
                  </span>
                </th>
              );
            }),
          )}
      </tr>
    </thead>
  );
}

function MapRow({
  student,
  map,
  bands,
  rest,
  looks,
  highlight,
  picked,
  onPick,
}: {
  student: MapStudent;
  map: StudentMap;
  bands: Band[];
  rest: boolean;
  looks: Set<Look>;
  highlight: string | null;
  picked: Picked | null;
  onPick: (p: Picked | null) => void;
}) {
  const started = map.stages.some((s) => s.cells.some((c) => c.level !== 'not-started' && c.level !== 'off'));
  const isPicked = (skill: string) => picked?.student === student.id && picked.skill === skill;
  return (
    <tr data-picked={picked?.student === student.id || undefined}>
      <th scope="row" className="skill-map__who" title={student.realName ? `${student.name} (${student.realName})` : student.name}>
        <span className="skill-map__name">{student.name}</span>
        {student.realName && <span className="skill-map__real">{student.realName}</span>}
      </th>
      <td className="skill-map__place">
        <Place student={student} map={map} started={started} looks={looks} />
      </td>
      {bands.flatMap((band) => {
        const stage = map.stages.find((s) => s.stage === band.stage)!;
        if (band.folded) return [<StageTd key={band.stage} student={student} stage={stage} />];
        return band.skills.map((skill) => {
          const cell = cellFor(map, skill.id)!;
          return (
            <td
              key={skill.id}
              className="skill-map__cell"
              data-cell={cellKey(student.id, skill.id)}
              data-level={cell.level}
              data-here={cell.status === 'current' || undefined}
              data-picked={isPicked(skill.id) || undefined}
              data-highlight={highlight === skill.id || undefined}
            >
              <button
                type="button"
                aria-pressed={isPicked(skill.id)}
                onClick={() => onPick(isPicked(skill.id) ? null : { student: student.id, skill: skill.id })}
                title={`${student.name}: ${skill.label}: ${levelWords(cell)}`}
              >
                <span aria-hidden="true">{cell.level === 'not-started' ? '·' : LEVELS[cell.level].mark}</span>
                <span className="sr-only">
                  {student.name}, {skill.label}: {levelWords(cell)}
                  {cell.level !== 'off' && cell.keys > 0 ? `, ${Math.round(cell.share * 100)}% secure` : ''}
                  {cell.status === 'current' ? ', where they are now' : ''}
                </span>
              </button>
            </td>
          );
        });
      })}
      {rest && <td className="skill-map__rest" aria-hidden="true" />}
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

/** "Now", "Furthest" and "Warm-up" in words, for the chip's tooltip and the side panel. */
function placeNotes(student: MapStudent, map: StudentMap, started: boolean) {
  const info = student.ladder;
  const now = map.current ? map.current.label : started ? 'Every skill secure' : 'Not started';
  const notes = [
    map.furthest ? `Furthest: ${map.furthest.label}` : '',
    info.on ? `Warm-up: ${info.placed === 'done' ? 'done' : info.placed === 'skipped' ? 'skipped' : 'not done'}` : '',
  ].filter(Boolean);
  return { now, notes };
}

/** Where the pupil is now, as a chip. Furthest and warm-up are in its tooltip (and in the side panel). */
function Place({ student, map, started, looks }: { student: MapStudent; map: StudentMap; started: boolean; looks: Set<Look> }) {
  const here = map.current ? skillTinyLabel(map.current.id) : started ? 'Every skill secure' : 'Not started';
  const { now, notes } = placeNotes(student, map, started);
  const state = looks.has('hard') ? 'hard' : looks.has('nearly') ? 'nearly' : undefined;
  const words = [...looks].map((l) => LOOK_WORDS[l](1).replace(/^1 /, ''));
  return (
    <span className="skill-map__now" data-none={!map.current || undefined} data-look={state} title={[`Now: ${now}`, ...notes, ...words].join('\n')}>
      <span aria-hidden="true">
        {here}
        {state === 'nearly' ? ' ↑' : ''}
      </span>
      <span className="sr-only">
        Now: {now}
        {notes.length ? `. ${notes.join('. ')}` : ''}
        {words.length ? `. ${words.join(', ')}` : ''}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- one cell, opened: the side panel

function CellDetail({
  student,
  map,
  skillId,
  classId,
  students,
  maps,
  onClose,
}: {
  student: MapStudent;
  map: StudentMap;
  skillId: string;
  classId: string;
  students: MapStudent[];
  maps: Map<string, StudentMap>;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const cell = cellFor(map, skillId);
  const byKey = useMemo(() => new Map(student.facts.map((f) => [f.key, f])), [student.facts]);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!cell) return null;
  const tables = cell.skill.stage === 'times-tables';
  const times = cell.skill.keys.filter((k) => parseFactKey(k));
  const others = cell.skill.keys.filter((k) => !parseFactKey(k));
  const started = map.stages.some((s) => s.cells.some((c) => c.level !== 'not-started' && c.level !== 'off'));
  const { now, notes } = placeNotes(student, map, started);
  const onIt = students.filter((s) => maps.get(s.id)?.current?.id === skillId);
  const counts = classCounts([...maps.values()], skillId);
  const first = student.name.split(' ')[0];
  return (
    <aside className="skill-map__detail" role="dialog" aria-modal="false" aria-labelledby="cell-title">
      <div className="skill-map__detail-top">
        <h3 id="cell-title" tabIndex={-1} ref={heading}>
          {student.name}: {cell.skill.label}
        </h3>
        <button type="button" className="skill-map__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <p>
        <span className="skill-map__swatch" data-level={cell.level} aria-hidden="true">
          {LEVELS[cell.level].mark}
        </span>{' '}
        <strong>{LEVELS[cell.level].label}.</strong>{' '}
        {cell.level === 'off'
          ? 'All of this skill’s tables are switched off for the class.'
          : `${Math.round(cell.share * 100)}% of its ${tables ? 'facts' : 'question types'} are secure (${cell.asked} of ${cell.keys} asked).`}{' '}
        {cell.status === 'current' && 'This is where they are now.'}
        {cell.passedOver && ' It is behind their starting point, so the games don’t ask it unless they come back to it.'}
      </p>
      <p className="skill-map__detail-place">
        Now: {now}
        {notes.map((n) => (
          <span key={n}>
            <br />
            {n}
          </span>
        ))}
      </p>
      <div className="skill-map__detail-facts">
        {tables && times.length > 0 && <FactGrid facts={student.facts.filter((f) => f.key.startsWith('mul:'))} />}
        {(!tables ? cell.skill.keys : others).length > 0 && <KeyTable keys={tables ? others : cell.skill.keys} byKey={byKey} tables={tables} />}
      </div>
      <p className="skill-map__detail-class">
        Class: {onIt.length} pupil{onIt.length === 1 ? ' is' : 's are'} on this skill now. {counts.secure + counts.fluent} of {students.length} are
        secure on it.
      </p>
      <div className="skill-map__detail-actions">
        <Link className="button button--light-outline" to={`/teacher/${classId}/maths?student=${student.id}&skill=${cell.skill.id}`}>
          🎯 Set a focus for {first}
        </Link>
        {onIt.length > 1 && (
          <Link
            className="button button--light-outline"
            to={`/teacher/${classId}/maths?students=${onIt.map((s) => s.id).join(',')}&skill=${cell.skill.id}`}
          >
            🎯 Focus for all {onIt.length} on this skill
          </Link>
        )}
        <Link className="button button--light-outline" to={`/teacher/${classId}/students/${student.id}`}>
          Open pupil page
        </Link>
      </div>
    </aside>
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
          <th scope="col">Wrong answers</th>
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
              <td>{wrongNote(stats?.wrong) || '–'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
