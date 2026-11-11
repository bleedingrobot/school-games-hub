/**
 * "Steps in each game" on a pupil's page: one row for each Foundational game that is on for the class (and Quick looks), with a step
 * track, where they are, and days on the step. Uses the same cached class call as the Progress tab. Games not played go last.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { nzDay } from '../../../shared/maths/leitner';
import { STAGES } from '../../../shared/subitising/config';
import { foundationalClass, GAME_IDS, type FoundationalClass, type FoundationalGameId } from '../../data/foundational';
import { enabledGames } from '../foundational/alerts';
import { GAMES, QUICK_LOOKS_ID, QUICK_LOOKS_NAME } from '../foundational/config';
import { cellState, quickCellState, type CellState } from './state';
import './progress.css';

export interface PupilStepRow {
  id: string;
  name: string;
  steps: number;
  cell: CellState;
}

/** The rows for one pupil: played ones in game order, then the ones not played yet. Exported for tests. */
export function buildPupilRows(data: FoundationalClass, pupilId: string, on: readonly FoundationalGameId[], today: string): PupilStepRow[] {
  const p = data.pupils.get(pupilId);
  const facts = data.map.students.find((s) => s.id === pupilId)?.facts;
  const rows: PupilStepRow[] = GAME_IDS.filter((g) => on.includes(g)).map((g) => ({
    id: g,
    name: GAMES[g].name,
    steps: GAMES[g].order.length,
    cell: cellState(g, p?.games[g], today, facts),
  }));
  if ([...data.pupils.values()].some((x) => x.quickLooks)) {
    rows.push({ id: QUICK_LOOKS_ID, name: QUICK_LOOKS_NAME, steps: STAGES.length, cell: quickCellState(p?.quickLooks, today) });
  }
  const played = rows.filter((r) => r.cell.state !== 'none');
  return [...played, ...rows.filter((r) => r.cell.state === 'none')];
}

const STATE_WORDS: Record<CellState['state'], string> = {
  moving: '',
  nearly: 'Nearly ready for the next step',
  stuck: 'Same step for a while',
  top: 'Top step done',
  quiet: 'Not played for 10 school days',
  none: '',
};

function where(row: PupilStepRow): string {
  const s = row.cell.step;
  if (!s) return 'Played';
  if (row.id === QUICK_LOOKS_ID) return `${s.n} of ${s.of} stages finished`;
  return `Step ${s.n} of ${s.of}${s.name ? `: ${s.name}` : ''}`;
}

function Track({ row }: { row: PupilStepRow }) {
  const n = row.cell.step?.n ?? 0;
  const quick = row.id === QUICK_LOOKS_ID;
  return (
    <span className="pupil-steps__track" aria-hidden="true">
      {Array.from({ length: row.steps }, (_, i) => {
        // Quick looks counts stages finished, so it has no 'current' box until they are all done.
        const current = quick ? false : i === n - 1;
        const cls = ['pupil-steps__box', i < n ? 'pupil-steps__box--on' : '', current ? 'pupil-steps__box--current' : ''].filter(Boolean).join(' ');
        return <span key={i} className={cls} />;
      })}
    </span>
  );
}

function RowBody({ row }: { row: PupilStepRow }) {
  const { cell } = row;
  const days = cell.daysOnStep > 0 ? `${cell.daysOnStep} day${cell.daysOnStep === 1 ? '' : 's'} on this step` : '';
  const note = STATE_WORDS[cell.state];
  return (
    <>
      <span className="pupil-steps__name">{row.name}</span>
      <Track row={row} />
      <span className="pupil-steps__where">
        {where(row)}
        {cell.state === 'top' && <span aria-hidden="true"> ★</span>}
      </span>
      <span className="pupil-steps__days">{[days, note].filter(Boolean).join(' · ')}</span>
      {/* P8 fills this in with "% right first try"; until then it stays an honest dash. */}
      <span className="pupil-steps__first-try" data-slot="first-try" title="% right first try: coming soon" />
    </>
  );
}

function PupilRow({ row, classId, pupilId }: { row: PupilStepRow; classId: string; pupilId: string }) {
  if (row.cell.state === 'none') {
    return (
      <li className="pupil-steps__row pupil-steps__row--none">
        <span className="pupil-steps__name">{row.name}</span>
        <span className="pupil-steps__where">Not played yet</span>
      </li>
    );
  }
  const label = `${row.name}: ${where(row)}`;
  if (row.id === QUICK_LOOKS_ID) {
    // Quick looks has its own panel further down the page, not a folded line.
    return (
      <li className="pupil-steps__row" data-state={row.cell.state}>
        <button
          type="button"
          className="pupil-steps__link"
          aria-label={`${label}. Go to Quick looks below`}
          onClick={() => document.getElementById('quick-title')?.scrollIntoView?.({ block: 'start' })}
        >
          <RowBody row={row} />
        </button>
      </li>
    );
  }
  return (
    <li className="pupil-steps__row" data-state={row.cell.state}>
      <Link className="pupil-steps__link" to={`/teacher/${classId}/students/${pupilId}?game=${row.id}`} aria-label={`${label}. Open the ${row.name} line below`}>
        <RowBody row={row} />
      </Link>
    </li>
  );
}

export function PupilSteps({ classId, studentId }: { classId: string; studentId: string }) {
  const [state, setState] = useState<{ data: FoundationalClass; on: FoundationalGameId[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    setState(null);
    setFailed(false);
    Promise.all([foundationalClass(classId), enabledGames(classId)]).then(
      ([data, on]) => current && setState({ data, on }),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [classId]);
  const today = useMemo(() => nzDay(Date.now()), []);
  const rows = useMemo(() => (state ? buildPupilRows(state.data, studentId, state.on, today) : []), [state, studentId, today]);

  return (
    <section className="panel pupil-steps" aria-labelledby="steps-title">
      <h2 id="steps-title" className="panel__title">
        Steps in each game
      </h2>
      {failed ? (
        <p className="panel__empty">Steps could not load. The game lines below still work.</p>
      ) : !state ? (
        <p className="panel__empty" role="status">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="panel__empty">No Foundational games are switched on for this class.</p>
      ) : (
        <ul className="pupil-steps__list">
          {rows.map((r) => (
            <PupilRow key={r.id} row={r} classId={classId} pupilId={studentId} />
          ))}
        </ul>
      )}
    </section>
  );
}
