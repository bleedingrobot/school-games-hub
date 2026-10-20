import { useState } from 'react';
import { BOND_SETS, type BondSet } from '../../../shared/bond-match/bonds';
import { BOARD_PAIRS, BOARD_SIZES, pairsOnBoard, type BoardSize } from '../../../shared/bond-match/deck';
import { sideText } from '../../../shared/bond-match/exact';
import { BOT_LEVEL_IDS } from '../../../shared/botGame';
import { BOT_LEVEL_NAMES, SHELVES, SIZE_NAMES, TEXT, type Players } from './strings';
import { Value } from './Value';

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

/** What a set's pairs add up to, as a card would show it: "10", "1", "1000". */
export const targetText = (set: BondSet): string => (set.target.d === 1 ? String(set.target.n) : `${set.target.n}/${set.target.d}`);

/** One pair from the middle of the set, as an example on its button: "3 + 7", "0.35 + 0.65". */
function examplePair(set: BondSet): [string, string] {
  const pair = set.pairs[Math.floor((set.pairs.length - 1) / 2)];
  return [sideText(pair[0]), sideText(pair[1])];
}

/** A tiny board: the shape of the grid for each size, so "Small" means something before you've played. */
function GridIcon({ size }: { size: BoardSize }) {
  const cards = BOARD_PAIRS[size] * 2;
  return (
    <span className={`bm-grid-icon bm-grid-icon--${size}`} aria-hidden="true">
      {Array.from({ length: cards }, (_, i) => <span key={i} />)}
    </span>
  );
}

const PLAYER_CHOICES = [
  { mode: 'solo', icon: '🙂', label: TEXT.playersSolo },
  { mode: 'pass', icon: '👫', label: TEXT.playersPass },
  { mode: 'bot', icon: '🤖', label: TEXT.playersBot },
] as const;

/** "What are you practising?": who's playing and the board size, then the bond sets on three shelves. Picking a bond starts the game. */
export function BondPicker({ onPick, initialSize = 'medium', stars, players, onPlayers }: Props) {
  const [size, setSize] = useState<BoardSize>(initialSize);
  return (
    <section className="bm-picker" aria-labelledby="bm-pick-title">
      <header className="bm-hero">
        <div className="bm-hero__text">
          <h2 id="bm-pick-title" className="bm-hero__title">{TEXT.pickTitle}</h2>
          <p className="bm-hero__help">{TEXT.pickHelp}</p>
        </div>
        <div className="bm-hero__cards" aria-hidden="true">
          <span className="bm-hero__card bm-hero__card--a">3</span>
          <span className="bm-hero__plus">+</span>
          <span className="bm-hero__card bm-hero__card--b">7</span>
          <span className="bm-hero__plus">=</span>
          <span className="bm-hero__card bm-hero__card--t">10</span>
        </div>
      </header>

      <div className="bm-setup">
        {players && onPlayers && (
          <div className="bm-setup__box">
            <h3 className="bm-setup__title" id="bm-players-title">{TEXT.playersTitle}</h3>
            <div role="group" aria-labelledby="bm-players-title" className="bm-seg bm-seg--3">
              {PLAYER_CHOICES.map((c) => (
                <button
                  key={c.mode}
                  type="button"
                  className="bm-seg__opt"
                  aria-pressed={players.mode === c.mode}
                  aria-label={c.label}
                  onClick={() => onPlayers(c.mode === 'bot' ? { mode: 'bot', level: players.mode === 'bot' ? players.level : 'easy' } : { mode: c.mode })}
                >
                  <span className="bm-seg__icon" aria-hidden="true">{c.icon}</span>
                  <span className="bm-seg__label">{c.label}</span>
                </button>
              ))}
            </div>
            {players.mode === 'bot' && (
              <div className="bm-level">
                <span className="bm-level__title" id="bm-level-title">{TEXT.levelTitle}</span>
                <div role="group" aria-labelledby="bm-level-title" className="bm-chips">
                  {BOT_LEVEL_IDS.map((level) => (
                    <button key={level} type="button" className="bm-chip" aria-pressed={players.level === level} onClick={() => onPlayers({ mode: 'bot', level })}>
                      {BOT_LEVEL_NAMES[level]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {players.mode !== 'solo' && (
              <p className="bm-setup__note">{players.mode === 'pass' ? TEXT.playersPassHelp : TEXT.playersBotHelp}</p>
            )}
          </div>
        )}

        <div className="bm-setup__box">
          <h3 className="bm-setup__title" id="bm-size-title">{TEXT.sizeTitle}</h3>
          <div role="group" aria-labelledby="bm-size-title" className="bm-seg bm-seg--3">
            {BOARD_SIZES.map((s) => (
              <button key={s} type="button" className="bm-seg__opt" aria-pressed={s === size} aria-label={SIZE_NAMES[s]} onClick={() => setSize(s)}>
                <GridIcon size={s} />
                <span className="bm-seg__label">{SIZE_NAMES[s]}</span>
                <span className="bm-seg__sub" aria-hidden="true">{TEXT.cards(BOARD_PAIRS[s] * 2)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {SHELVES.map((shelf) => {
        const sets = BOND_SETS.filter((b) => b.shelf === shelf.id);
        if (sets.length === 0) return null;
        return (
          <div key={shelf.id} className={`bm-shelf bm-shelf--${shelf.id}`} role="group" aria-label={shelf.name}>
            <h3 className="bm-shelf__name">{shelf.name}</h3>
            <div className="bm-shelf__sets">
              {sets.map((set) => {
                const mine = stars?.[set.id];
                const best = mine ? BOARD_SIZES.filter((s) => mine[s]).map((s) => TEXT.bestStarsLine(SIZE_NAMES[s], mine[s])).join(', ') : '';
                const here = mine?.[size] ?? 0;
                const [a, b] = examplePair(set);
                return (
                  <button
                    key={set.id}
                    type="button"
                    className="bm-bond"
                    aria-label={TEXT.bondButton(set.label, size, pairsOnBoard(set, size)) + (best ? `. ${TEXT.bestStarsLabel}: ${best}` : '')}
                    onClick={() => onPick(set, size)}
                  >
                    <span className={`bm-bond__target${targetText(set).length >= 4 ? ' bm-bond__target--long' : ''}`} aria-hidden="true">{targetText(set)}</span>
                    <span className="bm-bond__body" aria-hidden="true">
                      <span className="bm-bond__label">{set.label}</span>
                      <span className="bm-bond__example">
                        <Value text={a} /> + <Value text={b} />
                      </span>
                    </span>
                    {mine && Object.keys(mine).length > 0 && (
                      <span className="bm-bond__stars" aria-hidden="true" data-testid={`stars-${set.id}`} title={best}>
                        {[1, 2, 3].map((n) => <span key={n} className={n <= here ? 'bm-bond__star bm-bond__star--on' : 'bm-bond__star'}>★</span>)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
