/**
 * The Progress tab: every pupil's step in every Foundational game that is on for the class, and Quick looks. Loads the same cached
 * class data as the Foundational grid; the cell rules are in ./state.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { nzDay } from '../../../shared/maths/leitner';
import { STAGES } from '../../../shared/subitising/config';
import { foundationalClass, GAME_IDS, type FoundationalClass, type FoundationalGameId } from '../../data/foundational';
import { FriendlyError } from '../../data/profile';
import { useTeacherClass } from '../TeacherClass';
import { GAMES, QUICK_LOOKS_ID, QUICK_LOOKS_NAME } from '../foundational/config';
import { enabledGames } from '../foundational/alerts';
import { ProgressTable, type ProgressColumn, type ProgressRow } from './ProgressTable';
import { cellState, quickCellState } from './state';
import './progress.css';

export default function Progress() {
  const { current } = useTeacherClass();
  return <div className="classes progress">{current && <Panel key={current.id} classId={current.id} name={current.name} />}</div>;
}

/** Rows and columns from the class data and the games that are on. Exported for tests. */
export function buildTable(data: FoundationalClass, on: readonly FoundationalGameId[], today: string): { columns: ProgressColumn[]; rows: ProgressRow[] } {
  const columns: ProgressColumn[] = GAME_IDS.filter((g) => on.includes(g)).map((g) => ({ id: g, name: GAMES[g].name, steps: GAMES[g].order.length }));
  const hasQuick = [...data.pupils.values()].some((p) => p.quickLooks);
  if (hasQuick) columns.push({ id: QUICK_LOOKS_ID, name: QUICK_LOOKS_NAME, steps: STAGES.length });
  const rows = data.map.students.map((s) => {
    const p = data.pupils.get(s.id);
    const cells: ProgressRow['cells'] = {};
    for (const c of columns) cells[c.id] = c.id === QUICK_LOOKS_ID ? quickCellState(p?.quickLooks, today) : cellState(c.id as FoundationalGameId, p?.games[c.id as FoundationalGameId], today);
    return { id: s.id, name: s.name, realName: s.realName, cells };
  });
  return { columns, rows };
}

function Panel({ classId, name }: { classId: string; name: string }) {
  const [data, setData] = useState<{ data: FoundationalClass; on: FoundationalGameId[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([foundationalClass(classId), enabledGames(classId)]).then(
      ([d, on]) => current && setData({ data: d, on }),
      (error) => current && setFailed(error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.'),
    );
    return () => {
      current = false;
    };
  }, [classId]);

  const table = useMemo(() => (data ? buildTable(data.data, data.on, nzDay(Date.now())) : null), [data]);

  if (failed) {
    return (
      <section className="panel">
        <p role="alert" className="panel__empty">{failed}</p>
      </section>
    );
  }
  if (!table) {
    return (
      <section className="panel">
        <p className="panel__empty" role="status">Loading…</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-labelledby="progress-title">
      <h2 id="progress-title" className="panel__title">
        Every game’s steps
        <span className="panel__count">{table.rows.length} student{table.rows.length === 1 ? '' : 's'}</span>
      </h2>
      {table.rows.length === 0 ? (
        <p className="panel__empty">
          No students in this class yet. <Link to={`/teacher/${classId}/setup`}>Add some on Class set-up.</Link>
        </p>
      ) : table.columns.length === 0 ? (
        <p className="panel__empty">
          No Foundational games are switched on for {name}. <Link to={`/teacher/${classId}/games`}>Turn some on in Games.</Link>
        </p>
      ) : (
        <ProgressTable classId={classId} columns={table.columns} rows={table.rows} />
      )}
    </section>
  );
}
