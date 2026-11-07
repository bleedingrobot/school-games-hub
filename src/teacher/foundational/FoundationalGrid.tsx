/**
 * The Foundational skills grid (R7 plan, 3.1): one row for each pupil, one column for each idea, a mark and a colour in every
 * cell (the skill map's own four words, so the colour is never the only clue), and a Flags column that says in words what a
 * pupil is stuck on. It only draws the rows it is given; the page that loads them and mounts it is Stage 2 of R7.
 */
import { LEVELS } from '../../../shared/maths/skillMap';
import { IDEAS } from './ideas';
import type { PupilRow } from './flags';
import './foundational.css';

const LEVEL_KEYS = ['not-started', 'learning', 'secure', 'fluent'] as const;

export interface PickedCell {
  student: string;
  idea: string;
}

/** With `onPick`, every cell is a button that opens the facts behind it; without it the grid only shows. */
export function FoundationalGrid({
  rows,
  className,
  picked,
  onPick,
}: {
  rows: readonly PupilRow[];
  className: string;
  picked?: PickedCell | null;
  onPick?: (cell: PickedCell | null) => void;
}) {
  return (
    <div className="fg">
      <ul className="fg__legend" aria-label="Key">
        {LEVEL_KEYS.map((level) => (
          <li key={level}>
            <span className="fg__swatch" data-level={level} aria-hidden="true">
              {LEVELS[level].mark}
            </span>
            <span>{LEVELS[level].label}</span>
          </li>
        ))}
      </ul>
      <div className="fg__scroll" role="region" aria-label={`Foundational skills for ${className}`} tabIndex={0}>
        <table className="fg__table">
          <caption className="sr-only">Foundational skills for {className}: one row for each student, one column for each idea.</caption>
          <thead>
            <tr>
              <th scope="col" className="fg__who">
                Student
              </th>
              {IDEAS.map((idea) => (
                <th key={idea.id} scope="col" className="fg__idea">
                  {idea.label}
                </th>
              ))}
              <th scope="col" className="fg__flags">
                Flags
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="fg__who">
                  <span className="fg__name">{row.name}</span>
                  {row.realName && <span className="fg__real">{row.realName}</span>}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.idea.id} className="fg__cell">
                    {(() => {
                      const here = picked?.student === row.id && picked.idea === cell.idea.id;
                      const marks = cell.parts.map((part, i) => (
                        <span key={i} className="fg__mark" data-level={part.level}>
                          <span aria-hidden="true">{LEVELS[part.level].mark}</span>
                          <span className="sr-only">
                            {row.name}, {cell.idea.label}
                            {part.label ? ` to ${part.label}` : ''}: {LEVELS[part.level].label}
                          </span>
                          {part.label && cell.parts.length > 1 && (
                            <span className="fg__part" aria-hidden="true">
                              {part.label}
                            </span>
                          )}
                        </span>
                      ));
                      return onPick ? (
                        <button
                          type="button"
                          className="fg__open"
                          aria-pressed={here}
                          data-picked={here || undefined}
                          onClick={() => onPick(here ? null : { student: row.id, idea: cell.idea.id })}
                        >
                          {marks}
                          <span className="sr-only">. Press to see the facts</span>
                        </button>
                      ) : (
                        marks
                      );
                    })()}
                  </td>
                ))}
                <td className="fg__flags">
                  {row.flags.length === 0 ? (
                    <span className="sr-only">{row.name}: no flags</span>
                  ) : (
                    <ul className="fg__flaglist">
                      {row.flags.map((flag) => (
                        <li key={`${flag.kind}:${flag.track ?? ''}:${flag.reason}`} data-quiet={flag.quiet || undefined}>
                          <span className="fg__bang" aria-hidden="true">
                            !
                          </span>
                          <span>{flag.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
