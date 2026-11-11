/**
 * The Progress tab: every pupil's step in every Foundational game that is on for the class, and Quick looks. Loads the same cached
 * class data as the Foundational grid; the cell rules are in ./state.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { nzDay } from '../../../shared/maths/leitner';
import { STAGES } from '../../../shared/subitising/config';
import { foundationalClass, GAME_IDS, type FoundationalClass, type FoundationalGameId } from '../../data/foundational';
import { FriendlyError } from '../../data/profile';
import { useTeacherClass } from '../TeacherClass';
import { GAMES, QUICK_LOOKS_ID, QUICK_LOOKS_NAME } from '../foundational/config';
import { enabledGames } from '../foundational/alerts';
import { ProgressTable, type ProgressColumn, type ProgressRow } from './ProgressTable';
import { boardGames, LadderBoard } from './LadderBoard';
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
    for (const c of columns) cells[c.id] = c.id === QUICK_LOOKS_ID ? quickCellState(p?.quickLooks, today) : cellState(c.id as FoundationalGameId, p?.games[c.id as FoundationalGameId], today, s.facts);
    return { id: s.id, name: s.name, realName: s.realName, cells };
  });
  return { columns, rows };
}

export const SHOWS = ['stuck', 'nearly', 'top', 'quiet'] as const;
export type Show = (typeof SHOWS)[number];

const PILL_WORDS: Record<Show, (n: number) => string> = {
  stuck: (n) => `${n} stuck`,
  nearly: (n) => `${n} nearly ready to move up`,
  top: (n) => `${n} finished a game`,
  quiet: (n) => `${n} gone quiet`,
};

const hasState = (row: ProgressRow, show: Show, game: string | null) =>
  game ? row.cells[game]?.state === show : Object.values(row.cells).some((c) => c.state === show);

/** Pupils (not cells) with each state, over all games or just `game`. Exported for tests. */
export function showCounts(rows: readonly ProgressRow[], game: string | null): Record<Show, number> {
  return Object.fromEntries(SHOWS.map((s) => [s, rows.filter((r) => hasState(r, s, game)).length])) as Record<Show, number>;
}

/** Only the pupils with that state (in `game`, if given). No `show` keeps everyone. Exported for tests. */
export function filterRows(rows: ProgressRow[], show: Show | null, game: string | null): ProgressRow[] {
  return show ? rows.filter((r) => hasState(r, show, game)) : rows;
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

  const [params, setParams] = useSearchParams();
  const today = useMemo(() => nzDay(Date.now()), []);
  const table = useMemo(() => (data ? buildTable(data.data, data.on, today) : null), [data, today]);
  const games = useMemo(() => (data ? boardGames(data.data, data.on) : []), [data]);
  const view = params.get('view') === 'board' ? 'board' : 'table';
  const game = games.find((g) => g.id === params.get('game'))?.id ?? games[0]?.id ?? '';
  const showParam = params.get('show');
  const show = SHOWS.find((s) => s === showParam) ?? null;
  const narrowedTo = show ? table?.columns.find((c) => c.id === params.get('game')) ?? null : null;
  const narrow = narrowedTo?.id ?? null;
  const counts = useMemo(() => (table ? showCounts(table.rows, narrow) : null), [table, narrow]);
  const rows = useMemo(() => (table ? filterRows(table.rows, show, narrow) : []), [table, show, narrow]);
  const boardData = useMemo(() => {
    if (!data || !show) return data?.data ?? null;
    const keep = new Set(rows.map((r) => r.id));
    return { ...data.data, map: { ...data.data.map, students: data.data.map.students.filter((s) => keep.has(s.id)) } };
  }, [data, show, rows]);
  const setShow = (next: Show | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (next === null || next === show) {
        n.delete('show');
        if (view === 'table') n.delete('game');
      } else n.set('show', next);
      return n;
    }, { replace: true });
  const setView = (v: 'table' | 'board') =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v === 'board') n.set('view', 'board');
      else {
        n.delete('view');
        n.delete('game');
      }
      return n;
    }, { replace: true });
  const pick = (id: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('view', 'board');
      n.set('game', id);
      return n;
    }, { replace: true });

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
        {view === 'board' ? 'One game’s steps' : 'Every game’s steps'}
        <span className="panel__count">{show ? `${rows.length} of ${table.rows.length}` : table.rows.length} student{table.rows.length === 1 ? '' : 's'}</span>
      </h2>
      {counts && table.rows.length > 0 && table.columns.length > 0 && (
        <div className="progress__looks" role="group" aria-label="Who needs a look">
          {SHOWS.map((s) => (
            <button key={s} type="button" className="progress__look" data-show={s} aria-pressed={show === s} onClick={() => setShow(s)}>
              {PILL_WORDS[s](counts[s])}
            </button>
          ))}
          {narrowedTo && (
            <span className="progress__only">
              {narrowedTo.name} only.{' '}
              <button type="button" className="progress__sort" onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('game'); return n; }, { replace: true })}>
                All games
              </button>
            </span>
          )}
        </div>
      )}
      <div className="progress__views" role="group" aria-label="View">
        <button type="button" className="progress__sort" aria-pressed={view === 'table'} onClick={() => setView('table')}>Every game</button>
        <button type="button" className="progress__sort" aria-pressed={view === 'board'} onClick={() => setView('board')}>One game</button>
      </div>
      {table.rows.length === 0 ? (
        <p className="panel__empty">
          No students in this class yet. <Link to={`/teacher/${classId}/setup`}>Add some on Class set-up.</Link>
        </p>
      ) : table.columns.length === 0 ? (
        <p className="panel__empty">
          No Foundational games are switched on for {name}. <Link to={`/teacher/${classId}/games`}>Turn some on in Games.</Link>
        </p>
      ) : show && rows.length === 0 ? (
        <p className="panel__empty">Nobody in this class is like that right now.</p>
      ) : view === 'board' && data && boardData ? (
        <LadderBoard classId={classId} data={boardData} games={games} game={game} today={today} onPick={pick} />
      ) : (
        <ProgressTable classId={classId} columns={table.columns} rows={rows} />
      )}
    </section>
  );
}
