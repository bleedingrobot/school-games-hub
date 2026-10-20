import { useState } from 'react';
import { BOND_SETS, type BondSet } from '../../../shared/bond-match/bonds';
import { BOARD_SIZES, pairsOnBoard, type BoardSize } from '../../../shared/bond-match/deck';
import { BOT_LEVEL_IDS } from '../../../shared/botGame';
import { BOT_LEVEL_NAMES, SHELVES, SIZE_NAMES, TEXT, type Players } from './strings';

/** Best stars the student has on each bond set and board size: { 'whole-10': { small: 3 } }. */
export type StarsBySet = Record<string, Partial<Record<BoardSize, number>>>;

interface Props {
  /** Shown on each bond when the student's saved stars are known. */
  stars?: StarsBySet;
  onPick: (set: BondSet, size: BoardSize) => void;
  initialSize?: BoardSize;
  /** Who is playing, kept by the caller so it stays the same for the next game. Left out: solo only, no choice shown. */
  players?: Players;
  onPlayers?: (players: Players) => void;
}

/** "What are you practising?": a board size, then the bond sets on three shelves. Picking a bond starts the game. */
export function BondPicker({ onPick, initialSize = 'medium', stars, players, onPlayers }: Props) {
  const [size, setSize] = useState<BoardSize>(initialSize);
  return (
    <section className="bm-picker" aria-labelledby="bm-pick-title">
      <h2 id="bm-pick-title" className="bm-picker__title">{TEXT.pickTitle}</h2>
      <p className="bm-picker__help">{TEXT.pickHelp}</p>

      {players && onPlayers && (
        <>
          <div role="group" aria-label={TEXT.playersTitle} className="bm-sizes">
            <span className="bm-sizes__title" aria-hidden="true">{TEXT.playersTitle}</span>
            <button type="button" className="bm-size" aria-pressed={players.mode === 'solo'} onClick={() => onPlayers({ mode: 'solo' })}>
              {TEXT.playersSolo}
            </button>
            <button type="button" className="bm-size" aria-pressed={players.mode === 'pass'} onClick={() => onPlayers({ mode: 'pass' })}>
              {TEXT.playersPass}
            </button>
            <button
              type="button"
              className="bm-size"
              aria-pressed={players.mode === 'bot'}
              onClick={() => onPlayers({ mode: 'bot', level: players.mode === 'bot' ? players.level : 'easy' })}
            >
              {TEXT.playersBot}
            </button>
          </div>
          {players.mode === 'bot' && (
            <div role="group" aria-label={TEXT.levelTitle} className="bm-sizes">
              <span className="bm-sizes__title" aria-hidden="true">{TEXT.levelTitle}</span>
              {BOT_LEVEL_IDS.map((level) => (
                <button key={level} type="button" className="bm-size" aria-pressed={players.level === level} onClick={() => onPlayers({ mode: 'bot', level })}>
                  {BOT_LEVEL_NAMES[level]}
                </button>
              ))}
            </div>
          )}
          {players.mode !== 'solo' && (
            <p className="bm-picker__help">{players.mode === 'pass' ? TEXT.playersPassHelp : TEXT.playersBotHelp}</p>
          )}
        </>
      )}

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
                const mine = stars?.[set.id];
                const best = mine ? BOARD_SIZES.filter((s) => mine[s]).map((s) => TEXT.bestStarsLine(SIZE_NAMES[s], mine[s])).join(', ') : '';
                return (
                  <button
                    key={set.id}
                    type="button"
                    className={`bm-bond bm-bond--${shelf.id}`}
                    aria-label={TEXT.bondButton(set.label, size, pairsOnBoard(set, size)) + (best ? `. ${TEXT.bestStarsLabel}: ${best}` : '')}
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
                    {mine && Object.keys(mine).length > 0 && (
                      <span className="bm-bond__stars" aria-hidden="true" data-testid={`stars-${set.id}`}>
                        {BOARD_SIZES.map((s) => (
                          <span key={s} className={mine[s] ? 'bm-bond__star bm-bond__star--on' : 'bm-bond__star'}>
                            {SIZE_NAMES[s][0]} {mine[s] ? '★'.repeat(mine[s]!) : '–'}
                          </span>
                        ))}
                      </span>
                    )}
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
