import { useEffect, useState } from 'react';
import { STAR_CONFIG, type Score, type Stars } from '../../../shared/bond-match/score';
import type { RecordedGame } from './bests';
import type { Player } from '../../../shared/bond-match/versus';
import { clock, playerName, STAR_NAMES, TEXT, type Players } from './strings';
import { bucket, fx, starfish, type Medal } from './art';
import { useReducedMotion } from './useReducedMotion';
import { Pip } from './Pip';
import { useBella } from './voice';
import { finishLines, versusFinishLines } from './voiceLines';

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
  const still = useReducedMotion();
  const say = useBella();
  // Bella reads the title and the stars once; the buttons are not read.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the finish shows
  useEffect(() => say(finishLines(score.stars)), []);
  return (
    <section className={`bm-finish bm-finish--${score.stars}${still ? ' bm-finish--still' : ''}`} aria-labelledby="bm-finish-title">
      <div className="bm-finish__top">
        <h2 id="bm-finish-title" className="bm-finish__title">{TEXT.finishTitle}</h2>
        <p className="bm-finish__set">{setLabel}</p>
        <div className={`bm-stars bm-stars--${score.stars}`} role="img" aria-label={TEXT.starsLine(score.stars)}>
          {(recorded.newFlips || recorded.newTime) && <Burst />}
          <span className="bm-stars__row" aria-hidden="true">
            {[1, 2, 3].map((n) => <Starfish key={n} on={n <= score.stars} medal={MEDALS[score.stars]} />)}
            {/* Pip holds the finish: cheering beside the starfish. */}
            <Pip pose="cheer" className="bm-finish__pip" still={still} />
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
        <button type="button" className="button button--primary" data-key="enter" onClick={onAgain}>{TEXT.again}</button>
        <button type="button" className="button button--light" data-key="esc" onClick={onAnother}>{TEXT.another}</button>
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
  const still = useReducedMotion();
  const say = useBella();
  // Bella reads who won, once.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the finish shows
  useEffect(() => say(versusFinishLines(players, winner)), []);
  return (
    <section className={`bm-finish bm-finish--versus${winner === 'tie' ? ' bm-finish--tie' : ` bm-finish--won${winner}`}${still ? ' bm-finish--still' : ''}`} aria-labelledby="bm-finish-title">
      <div className="bm-finish__top">
        <h2 id="bm-finish-title" className="bm-finish__title" data-testid="winner">{TEXT.winner(players, winner)}</h2>
        <p className="bm-finish__set">{setLabel}</p>
        {/* Each player's shell bucket with their pairs. The sentence below says the same for screen readers. */}
        <div className={`bm-buckets bm-buckets--${winner === 'tie' ? 'tie' : `won${winner}`}`} aria-hidden="true">
          {([0, 1] as const).map((p) => (
            <Bucket key={p} name={playerName(players, p)} pairs={pairs[p]} won={winner === p} player={p} />
          ))}
          {/* Pip cheers beside the winner's bucket (between the two for a tie). */}
          <Pip pose="cheer" className="bm-finish__pip bm-buckets__pip" still={still} />
        </div>
      </div>
      <p className="bm-finish__pairs bm-sr" data-testid="pairs-score">{TEXT.pairsScore(players, pairs)}</p>
      {save && (
        <p className={`bm-finish__save bm-finish__save--${save.status}`} role="status" data-testid="save-line">
          {save.status === 'saving' && TEXT.saving}
          {save.status === 'later' && TEXT.saveLater}
          {save.status === 'saved' && (save.points ? TEXT.savedPoints(save.points) : save.points === 0 ? TEXT.savedNoPointsVersus : TEXT.savedLine)}
        </p>
      )}
      <div className="bm-finish__buttons">
        <button type="button" className="button button--primary" data-key="enter" onClick={onAgain}>{TEXT.again}</button>
        <button type="button" className="button button--light" data-key="esc" onClick={onAnother}>{TEXT.another}</button>
      </div>
      <p className="bm-finish__soft">{TEXT.versusNote}</p>
    </section>
  );
}

const MEDALS: Record<Stars, Medal> = { 3: 'gold', 2: 'silver', 1: 'bronze' };

/** One star: a painted starfish in the medal's colour (a faded one for a star not won), or the CSS star until it's painted. */
function Starfish({ on, medal }: { on: boolean; medal: Medal }) {
  const src = starfish(on ? medal : 'silver');
  const [failed, setFailed] = useState(false);
  const cls = `bm-star${on ? ' bm-star--on' : ''}`;
  if (!src || failed) return <span className={cls}>★</span>;
  return (
    <span className={`${cls} bm-star--painted`}>
      <img className="bm-star__img" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
    </span>
  );
}

/** A little burst of sparkles behind the starfish for a new best (the match sparkle, or CSS specks until it's painted). */
function Burst() {
  const src = fx('sparkle');
  const [failed, setFailed] = useState(false);
  return (
    <span className={`bm-burst${src && !failed ? ' bm-burst--painted' : ''}`} aria-hidden="true" data-testid="bm-burst">
      {src && !failed && [0, 1, 2].map((n) => <img key={n} className={`bm-burst__img bm-burst__img--${n}`} src={src} alt="" onError={() => setFailed(true)} />)}
    </span>
  );
}

/** A player's shell bucket, their name and pairs drawn on top in code. The winner's bucket is bigger and has a ribbon. */
function Bucket({ name, pairs, won, player }: { name: string; pairs: number; won: boolean; player: 0 | 1 }) {
  const src = bucket();
  const [failed, setFailed] = useState(false);
  const painted = src && !failed;
  return (
    <div className={`bm-bucket bm-bucket--p${player}${won ? ' bm-bucket--won' : ''}`}>
      {won && <span className="bm-bucket__ribbon">{TEXT.winnerRibbon}</span>}
      <span className={`bm-bucket__pic${painted ? ' bm-bucket__pic--painted' : ''}`}>
        {painted && <img className="bm-bucket__img" src={src} alt="" draggable={false} onError={() => setFailed(true)} />}
        <span className="bm-bucket__pairs">{pairs}</span>
      </span>
      <span className="bm-bucket__name">{name}</span>
      <span className="bm-bucket__word">{pairs === 1 ? TEXT.pairWord : TEXT.pairsWord}</span>
    </div>
  );
}
