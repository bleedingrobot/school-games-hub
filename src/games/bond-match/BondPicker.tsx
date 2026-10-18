import { useState } from 'react';
import { BOND_SETS, type BondSet } from '../../../shared/bond-match/bonds';
import { BOARD_SIZES, pairsOnBoard, type BoardSize } from '../../../shared/bond-match/deck';
import { SHELVES, SIZE_NAMES, TEXT } from './strings';

interface Props {
  onPick: (set: BondSet, size: BoardSize) => void;
  initialSize?: BoardSize;
}

/** "What are you practising?": a board size, then the bond sets on three shelves. Picking a bond starts the game. */
export function BondPicker({ onPick, initialSize = 'medium' }: Props) {
  const [size, setSize] = useState<BoardSize>(initialSize);
  return (
    <section className="bm-picker" aria-labelledby="bm-pick-title">
      <h2 id="bm-pick-title" className="bm-picker__title">{TEXT.pickTitle}</h2>
      <p className="bm-picker__help">{TEXT.pickHelp}</p>

      <div role="group" aria-label={TEXT.sizeTitle} className="bm-sizes">
        <span className="bm-sizes__title" aria-hidden="true">{TEXT.sizeTitle}</span>
        {BOARD_SIZES.map((s) => (
          <button key={s} type="button" className="bm-size" aria-pressed={s === size} onClick={() => setSize(s)}>
            {SIZE_NAMES[s]}
          </button>
        ))}
      </div>

      {SHELVES.map((shelf) => {
        const sets = BOND_SETS.filter((b) => b.shelf === shelf.id);
        if (sets.length === 0) return null;
        return (
          <div key={shelf.id} className="bm-shelf" role="group" aria-label={shelf.name}>
            <h3 className="bm-shelf__name">{shelf.name}</h3>
            <div className="bm-shelf__sets">
              {sets.map((set) => {
                const counts = BOARD_SIZES.map((s) => pairsOnBoard(set, s));
                return (
                  <button
                    key={set.id}
                    type="button"
                    className={`bm-bond bm-bond--${shelf.id}`}
                    aria-label={TEXT.bondButton(set.label, size, pairsOnBoard(set, size))}
                    onClick={() => onPick(set, size)}
                  >
                    <span className="bm-bond__label">{set.label}</span>
                    <span className="bm-bond__pairs" aria-hidden="true">
                      {counts.map((n, i) => (
                        <span key={BOARD_SIZES[i]} className={BOARD_SIZES[i] === size ? 'bm-bond__count bm-bond__count--now' : 'bm-bond__count'}>
                          {SIZE_NAMES[BOARD_SIZES[i]][0]} {n}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="bm-picker__note">{TEXT.pairsEachHelp}</p>
    </section>
  );
}
