import { STAR_CONFIG, type Score } from '../../../shared/bond-match/score';
import type { RecordedGame } from './bests';
import type { Player } from '../../../shared/bond-match/versus';
import { clock, STAR_NAMES, TEXT, type Players } from './strings';

/** Where the save to the server is up to. Undefined when nothing is saved (the preview with no server). */
export type SaveState = { status: 'saving' } | { status: 'saved'; points: number | null } | { status: 'later' };

interface Props {
  save?: SaveState;
  setLabel: string;
  score: Score;
  recorded: RecordedGame;
  onAgain: () => void;
  onAnother: () => void;
}

/** Stars as words as well as shapes: gold, silver or bronze is said, never just coloured. */
export function Finish({ save, setLabel, score, recorded, onAgain, onAnother }: Props) {
  const { best } = recorded;
  return (
    <section className={`bm-finish bm-finish--${score.stars}`} aria-labelledby="bm-finish-title">
      <div className="bm-finish__top">
        <h2 id="bm-finish-title" className="bm-finish__title">{TEXT.finishTitle}</h2>
        <p className="bm-finish__set">{setLabel}</p>
        <div className={`bm-stars bm-stars--${score.stars}`} role="img" aria-label={TEXT.starsLine(score.stars)}>
          <span className="bm-stars__row" aria-hidden="true">
            {[1, 2, 3].map((n) => <span key={n} className={n <= score.stars ? 'bm-star bm-star--on' : 'bm-star'}>★</span>)}
          </span>
          <span className="bm-stars__name" aria-hidden="true">{STAR_NAMES[score.stars]}</span>
        </div>
      </div>
      <dl className="bm-finish__facts">
        <div><dt>{TEXT.flips}</dt><dd data-testid="finish-flips">{score.flips}</dd></div>
        <div><dt>{TEXT.time}</dt><dd data-testid="finish-time">{clock(score.seconds)}</dd></div>
        <div><dt>{TEXT.fewest}</dt><dd>{score.minFlips}</dd></div>
      </dl>
      <div className="bm-finish__best" data-testid="best-line">
        {recorded.newFlips && <p className="bm-finish__new">🎉 {TEXT.newBestFlips}</p>}
        {recorded.newTime && <p className="bm-finish__new">🎉 {TEXT.newBestTime}</p>}
        <p>{TEXT.bestLine(best.flips, best.seconds)}</p>
        {!recorded.before && <p className="bm-finish__soft">{TEXT.firstGame}</p>}
      </div>
      {save && (
        <p className={`bm-finish__save bm-finish__save--${save.status}`} role="status" data-testid="save-line">
          {save.status === 'saving' && TEXT.saving}
          {save.status === 'later' && TEXT.saveLater}
          {save.status === 'saved' && (save.points ? TEXT.savedPoints(save.points) : save.points === 0 ? TEXT.savedNoPoints : TEXT.savedLine)}
        </p>
      )}
      <div className="bm-finish__buttons">
        <button type="button" className="button button--primary" onClick={onAgain}>{TEXT.again}</button>
        <button type="button" className="button button--light" onClick={onAnother}>{TEXT.another}</button>
      </div>
      <details className="bm-finish__how">
        <summary>{TEXT.howStars}</summary>
        <p className="bm-finish__rule" data-testid="stars-rule">{TEXT.starsRule(STAR_CONFIG.goldWithin, STAR_CONFIG.silverWithin)}</p>
        <p className="bm-finish__min">{TEXT.minHint(score.minFlips)}</p>
      </details>
    </section>
  );
}

interface VersusProps {
  save?: SaveState;
  setLabel: string;
  players: Players;
  pairs: readonly [number, number];
  winner: Player | 'tie';
  onAgain: () => void;
  onAnother: () => void;
}

/** The end of a two-player or computer game: who won and the pairs each found. No stars: those are for solo games. */
export function VersusFinish({ save, setLabel, players, pairs, winner, onAgain, onAnother }: VersusProps) {
  return (
    <section className={`bm-finish bm-finish--versus${winner === 'tie' ? '' : ` bm-finish--won${winner}`}`} aria-labelledby="bm-finish-title">
      <div className="bm-finish__top">
        <p className="bm-finish__trophy" aria-hidden="true">{winner === 'tie' ? '🤝' : players.mode === 'bot' && winner === 1 ? '🤖' : '🏆'}</p>
        <h2 id="bm-finish-title" className="bm-finish__title" data-testid="winner">{TEXT.winner(players, winner)}</h2>
        <p className="bm-finish__set">{setLabel}</p>
      </div>
      <p className="bm-finish__pairs" data-testid="pairs-score">{TEXT.pairsScore(players, pairs)}</p>
      {save && (
        <p className={`bm-finish__save bm-finish__save--${save.status}`} role="status" data-testid="save-line">
          {save.status === 'saving' && TEXT.saving}
          {save.status === 'later' && TEXT.saveLater}
          {save.status === 'saved' && (save.points ? TEXT.savedPoints(save.points) : save.points === 0 ? TEXT.savedNoPointsVersus : TEXT.savedLine)}
        </p>
      )}
      <div className="bm-finish__buttons">
        <button type="button" className="button button--primary" onClick={onAgain}>{TEXT.again}</button>
        <button type="button" className="button button--light" onClick={onAnother}>{TEXT.another}</button>
      </div>
      <p className="bm-finish__soft">{TEXT.versusNote}</p>
    </section>
  );
}
