/**
 * The "One game" board on the Progress tab: a column for each step of one game (plus Not started), each pupil a chip in their
 * step's column. Under 900px the columns become rungs of a ladder with the top step first. Marks come from cellState, so they
 * match the table.
 */
import { Link } from 'react-router';
import { GAME_IDS, type FoundationalClass, type FoundationalGameId } from '../../data/foundational';
import { STAGES } from '../../../shared/subitising/config';
import { GAMES, QUICK_LOOKS_ID, QUICK_LOOKS_NAME } from '../foundational/config';
import { cellState, firstTryWords, quickCellState, type CellState } from './state';

export interface BoardPupil {
  id: string;
  name: string;
  cell: CellState;
}

export interface BoardColumn {
  key: string;
  /** "Step 3", "Not started", "Other". */
  label: string;
  /** The step's name, if it has one. */
  sub: string;
  pupils: BoardPupil[];
}

export interface BoardGame {
  id: string;
  name: string;
}

/** The pills: games that are on, then Quick looks when any pupil has played it. */
export function boardGames(data: FoundationalClass, on: readonly FoundationalGameId[]): BoardGame[] {
  const list: BoardGame[] = GAME_IDS.filter((g) => on.includes(g)).map((g) => ({ id: g, name: GAMES[g].name }));
  if ([...data.pupils.values()].some((p) => p.quickLooks)) list.push({ id: QUICK_LOOKS_ID, name: QUICK_LOOKS_NAME });
  return list;
}

/** Columns for one game: Not started first, then a column for each step from the lowest, then Other if any pupil needs it. Exported for tests. */
export function buildBoard(data: FoundationalClass, game: string, today: string): BoardColumn[] {
  const quick = game === QUICK_LOOKS_ID;
  const steps = quick ? STAGES.length : GAMES[game as FoundationalGameId].order.length;
  const cols: BoardColumn[] = [{ key: 'none', label: 'Not started', sub: '', pupils: [] }];
  for (let i = 1; i <= steps; i++) {
    const saved = quick ? null : GAMES[game as FoundationalGameId].order[i - 1];
    cols.push({
      key: String(i),
      label: quick ? `Stage ${i}` : `Step ${i}`,
      sub: saved === null ? '' : GAMES[game as FoundationalGameId].levels[saved] ?? '',
      pupils: [],
    });
  }
  const other: BoardColumn = { key: 'other', label: 'Other', sub: '', pupils: [] };
  for (const s of data.map.students) {
    const p = data.pupils.get(s.id);
    const cell = quick ? quickCellState(p?.quickLooks, today) : cellState(game as FoundationalGameId, p?.games[game as FoundationalGameId], today, s.facts);
    const pupil = { id: s.id, name: s.name, cell };
    if (cell.state === 'none') cols[0].pupils.push(pupil);
    else if (!cell.step) other.pupils.push(pupil);
    // Quick looks with no stage finished yet has played but is still at the start.
    else if (cell.step.n < 1) cols[0].pupils.push(pupil);
    else cols[cell.step.n]?.pupils.push(pupil);
  }
  if (other.pupils.length > 0) cols.push(other);
  return cols;
}

function note(cell: CellState): string {
  if (cell.state === 'stuck') return `· ${cell.daysOnStep} days`;
  if (cell.state === 'nearly') return '· nearly ↑';
  if (cell.state === 'top') return '· ★ done';
  if (cell.state === 'quiet') return '· zz';
  if (cell.state === 'moving' && cell.daysOnStep > 0) return `· ${cell.daysOnStep}d`;
  return '';
}

const STATE_WORDS: Record<CellState['state'], string> = { moving: '', nearly: 'nearly ready to move up', stuck: 'stuck', top: 'top step done', quiet: 'not played for 10 school days', none: '' };

export function LadderBoard({
  classId,
  data,
  games,
  game,
  today,
  onPick,
}: {
  classId: string;
  data: FoundationalClass;
  games: BoardGame[];
  game: string;
  today: string;
  onPick: (id: string) => void;
}) {
  const current = games.find((g) => g.id === game) ?? games[0];
  if (!current) return null;
  const cols = buildBoard(data, current.id, today);
  return (
    <div className="ladder">
      <div className="ladder__pills" role="group" aria-label="Game">
        {games.map((g) => (
          <button key={g.id} type="button" className="ladder__pill" aria-pressed={g.id === current.id} onClick={() => onPick(g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <h3 className="ladder__title">{current.name}</h3>
      <p className="ladder__hint">Tap a pupil to see their page.</p>
      <div className="ladder__grid" style={{ ['--ladder-cols' as string]: cols.length }}>
        {cols.map((c) => (
          <section key={c.key} className="ladder__col" data-col={c.key} aria-label={c.sub ? `${c.label}: ${c.sub}` : c.label}>
            <h4 className="ladder__head">
              <span className="ladder__step">{c.label}</span>
              {c.sub && <span className="ladder__sub">{c.sub}</span>}
            </h4>
            <ul className="ladder__chips">
              {c.pupils.map((p) => (
                <li key={p.id}>
                  <Link
                    className="ladder__chip"
                    data-state={p.cell.state}
                    to={`/teacher/${classId}/students/${p.id}?game=${current.id}`}
                    title={[p.name, STATE_WORDS[p.cell.state], firstTryWords(p.cell.firstTry)].filter(Boolean).join(', ')}
                  >
                    <span className="ladder__name">{p.name}</span>
                    <span className="ladder__note">{note(p.cell)}</span>
                  </Link>
                </li>
              ))}
              {c.pupils.length === 0 && <li className="ladder__nobody">nobody</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
