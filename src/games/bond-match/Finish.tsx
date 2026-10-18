import type { Score } from '../../../shared/bond-match/score';
import type { RecordedGame } from './bests';
import { clock, STAR_NAMES, TEXT } from './strings';

interface Props {
  setLabel: string;
  score: Score;
  recorded: RecordedGame;
  onAgain: () => void;
  onAnother: () => void;
}

/** Stars as words as well as shapes: gold, silver or bronze is said, never just coloured. */
export function Finish({ setLabel, score, recorded, onAgain, onAnother }: Props) {
  const { best } = recorded;
  return (
    <section className="bm-finish" aria-labelledby="bm-finish-title">
      <h2 id="bm-finish-title" className="bm-finish__title">{TEXT.finishTitle}</h2>
      <p className="bm-finish__set">{setLabel}</p>
      <div className={`bm-stars bm-stars--${score.stars}`} role="img" aria-label={TEXT.starsLine(score.stars)}>
        <span className="bm-stars__row" aria-hidden="true">
          {[1, 2, 3].map((n) => <span key={n} className={n <= score.stars ? 'bm-star bm-star--on' : 'bm-star'}>{n <= score.stars ? '★' : '☆'}</span>)}
        </span>
        <span className="bm-stars__name" aria-hidden="true">{STAR_NAMES[score.stars]}</span>
      </div>
      <dl className="bm-finish__facts">
        <div><dt>{TEXT.flips}</dt><dd data-testid="finish-flips">{score.flips}</dd></div>
        <div><dt>{TEXT.time}</dt><dd data-testid="finish-time">{clock(score.seconds)}</dd></div>
      </dl>
      <p className="bm-finish__min">{TEXT.minHint(score.minFlips)}</p>
      <div className="bm-finish__best" data-testid="best-line">
        <p>{TEXT.bestLine(best.flips, best.seconds)}</p>
        {!recorded.before && <p>{TEXT.firstGame}</p>}
        {recorded.newFlips && <p className="bm-finish__new">{TEXT.newBestFlips}</p>}
        {recorded.newTime && <p className="bm-finish__new">{TEXT.newBestTime}</p>}
      </div>
      <div className="bm-finish__buttons">
        <button type="button" className="button button--primary" onClick={onAgain}>{TEXT.again}</button>
        <button type="button" className="button button--light" onClick={onAnother}>{TEXT.another}</button>
      </div>
    </section>
  );
}
