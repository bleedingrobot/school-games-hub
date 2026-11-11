/** The Progress table: a row for each pupil, a column for each game that is on (and Quick looks), each cell a step bar. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { QUICK_LOOKS_ID, QUICK_LOOKS_NAME } from '../foundational/config';
import { firstTryWords, type CellState } from './state';

export interface ProgressColumn {
  id: string;
  name: string;
  /** How many steps the game has. */
  steps: number;
}

export interface ProgressRow {
  id: string;
  name: string;
  realName: string | null;
  /** By column id. */
  cells: Record<string, CellState>;
}

const SORTS = [
  { id: 'all', label: 'All pupils' },
  { id: 'stuck', label: 'Stuck first' },
  { id: 'slowest', label: 'Slowest first' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

const STATE_WORDS: Record<CellState['state'], string> = {
  moving: 'moving up',
  nearly: 'nearly ready to move up',
  stuck: 'stuck',
  top: 'top step done',
  quiet: 'not played for 10 school days',
  none: 'not played yet',
};

const stuckCount = (r: ProgressRow) => Object.values(r.cells).filter((c) => c.state === 'stuck').length;

/** The longest usual time to a first tap in any of the pupil's games, or null when no game says. */
export const slowestMs = (r: ProgressRow): number | null => {
  const times = Object.values(r.cells).flatMap((c) => (c.firstTry?.ms != null ? [c.firstTry.ms] : []));
  return times.length > 0 ? Math.max(...times) : null;
};

/** Slowest usual first tap first; pupils with no time saved go last. Exported for tests. */
export const bySlowest = (a: ProgressRow, b: ProgressRow): number => {
  const x = slowestMs(a);
  const y = slowestMs(b);
  if (x === null || y === null) return x === y ? a.name.localeCompare(b.name) : x === null ? 1 : -1;
  return y - x || a.name.localeCompare(b.name);
};

/** "Robin: Step 3 of 6: Give 6 to 10, 7 days on this step, stuck" */
export function cellWords(col: ProgressColumn, cell: CellState): string {
  if (cell.state === 'none') return `${col.name}: not played yet`;
  if (!cell.step) return `${col.name}: played`;
  const s = cell.step;
  const where = col.id === QUICK_LOOKS_ID ? `${s.n} of ${s.of} stages finished` : `Step ${s.n} of ${s.of}${s.name ? `: ${s.name}` : ''}`;
  const days = cell.daysOnStep > 0 ? `, ${cell.daysOnStep} day${cell.daysOnStep === 1 ? '' : 's'} on this step` : '';
  return `${col.name}: ${where}${days}, ${STATE_WORDS[cell.state]}`;
}

function Tag({ cell }: { cell: CellState }) {
  if (cell.state === 'stuck') return <span className="progress__tag progress__tag--stuck">{cell.daysOnStep}d</span>;
  if (cell.state === 'nearly') return <span className="progress__tag progress__tag--nearly">↑</span>;
  if (cell.state === 'top') return <span className="progress__tag progress__tag--top">★</span>;
  if (cell.state === 'quiet') return <span className="progress__tag progress__tag--quiet">zz</span>;
  return null;
}

function Cell({ col, cell, pupil, classId }: { col: ProgressColumn; cell: CellState; pupil: ProgressRow; classId: string }) {
  if (cell.state === 'none') return <span className="progress__not-yet">not yet</span>;
  // Played, but the saved step isn't one this page knows: say so rather than "not yet".
  if (!cell.step) return <span className="progress__not-yet">played</span>;
  const n = cell.step.n;
  const words = [`${pupil.name}, ${cellWords(col, cell)}`, firstTryWords(cell.firstTry)].filter(Boolean).join(', ');
  return (
    <Link className="progress__cell" data-state={cell.state} to={`/teacher/${classId}/students/${pupil.id}?game=${col.id}`} title={words} aria-label={words}>
      <span className="progress__bar" aria-hidden="true">
        {Array.from({ length: col.steps }, (_, i) => (
          <span key={i} className={i < n ? 'progress__box progress__box--on' : 'progress__box'} />
        ))}
      </span>
      <span className="progress__n" aria-hidden="true">
        {n}
      </span>
      <span aria-hidden="true">
        <Tag cell={cell} />
      </span>
    </Link>
  );
}

export function ProgressTable({ classId, columns, rows }: { classId: string; columns: ProgressColumn[]; rows: ProgressRow[] }) {
  const [sort, setSort] = useState<SortId>('all');
  const shown = useMemo(
    () =>
      sort === 'stuck'
        ? [...rows].sort((a, b) => stuckCount(b) - stuckCount(a) || a.name.localeCompare(b.name))
        : sort === 'slowest'
          ? [...rows].sort(bySlowest)
          : rows,
    [rows, sort],
  );
  return (
    <>
      <div className="progress__tools">
        <ul className="progress__legend" aria-label="What the colours and marks mean">
          <li><span className="progress__key progress__key--moving" aria-hidden="true" /> Moving up</li>
          <li><span className="progress__key progress__key--nearly" aria-hidden="true" /> <b>↑</b> nearly ready for the next step</li>
          <li><span className="progress__key progress__key--stuck" aria-hidden="true" /> <b>7d</b> same step 5 or more days</li>
          <li><span className="progress__key progress__key--top" aria-hidden="true" /> <b>★</b> top step done</li>
          <li><span className="progress__key progress__key--quiet" aria-hidden="true" /> <b>zz</b> not played for 10 school days</li>
          <li><span className="progress__key progress__key--rest" aria-hidden="true" /> step still to come</li>
        </ul>
        <div className="progress__sorts" role="group" aria-label="Order">
          {SORTS.map((s) => (
            <button key={s.id} type="button" className="progress__sort" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="progress__scroll">
        <table className="progress__table">
          <thead>
            <tr>
              <th scope="col" className="progress__who">Student</th>
              {columns.map((c) => (
                <th key={c.id} scope="col">
                  {c.name}
                  <span className="progress__steps">{c.id === QUICK_LOOKS_ID ? `${c.steps} stages` : `${c.steps} steps`}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="progress__who">
                  <span className="progress__name">{r.name}</span>
                  {r.realName && <span className="progress__real">{r.realName}</span>}
                </th>
                {columns.map((c) => (
                  <td key={c.id} data-label={c.name} data-none={r.cells[c.id].state === 'none' ? 'true' : undefined}>
                    <Cell col={c} cell={r.cells[c.id]} pupil={r} classId={classId} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export { QUICK_LOOKS_NAME };
