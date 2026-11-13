import { Link } from 'react-router';
import { useSyncExternalStore, type CSSProperties } from 'react';
import { BOT_LEVELS, type BotLevel, type GameDefinition } from '../games/types';
import type { CardMoves } from '../data/movesLeft';
import { BotLevelPicker } from './BotLevelPicker';
import { gameCardArt, type GameCardArt } from './gameCardArt';
import { NextPartChip } from './NextPartChip';

function artStyle(art: GameCardArt, colours: [string, string]): CSSProperties {
  return {
    '--card-a': colours[0],
    '--card-b': colours[1],
    '--card-art': `url("${art.small}")`,
    '--card-focus': art.focus ?? 'center 65%',
  } as CSSProperties;
}

/** Phones and iPads in portrait get two smaller cards per row (dashboard plan D6, the same width as the CSS). */
const NARROW = '(max-width: 700px)';
const narrowNow = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;
function onNarrowChange(change: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(NARROW);
  query.addEventListener?.('change', change);
  return () => query.removeEventListener?.('change', change);
}
const useNarrow = () => useSyncExternalStore(onNarrowChange, narrowNow, () => false);

/** The "Pin to top" tick box in a card's top corner. Not shown where nothing can be pinned (no onPinChange). */
export function PinBox({ id, name, pinned, onPinChange }: { id: string; name: string; pinned: boolean; onPinChange: (pinned: boolean) => void }) {
  return (
    <label className={pinned ? 'game-card__pin is-pinned' : 'game-card__pin'} title={pinned ? 'Unpin' : 'Pin to top'}>
      <input
        type="checkbox"
        checked={pinned}
        onChange={(e) => onPinChange(e.target.checked)}
        aria-label={`Pin ${name} to top`}
        data-pin={id}
      />
      <span aria-hidden="true">📌</span>
      <span className="game-card__pin-text" aria-hidden="true">
        {pinned ? 'Pinned' : 'Pin to top'}
      </span>
    </label>
  );
}

function CardPic({ art }: { art: GameCardArt }) {
  return (
    <img
      className="game-card__pic"
      src={art.small}
      srcSet={`${art.small} 800w, ${art.card} 1600w`}
      sizes="(max-width: 700px) 100vw, 400px"
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * A game on the home page, in the Marble Rush course-card look: its painted scene across the top, a panel over the bottom
 * of the picture with the name, tagline and moves left, then bot levels and a Play button that carries the same picture.
 * A game with no picture yet shows a band of its own colours with its icon.
 */
export function GameCard({
  game,
  level,
  onLevelChange,
  moves,
  note,
  pinned = false,
  onPinChange,
  nextPartDone,
}: {
  game: GameDefinition;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  /** Today's daily allowance in this game, for games that have one. */
  moves?: CardMoves;
  /** A line of news for today under the tagline (Maths Monsters' spotted monster). */
  note?: string;
  /** Pinned to the top of the home page, and how to change it (no tick box without it). */
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
  /** For a daily game (`nextPart`): true once today's part is done, false while it is ready, undefined for no chip. */
  nextPartDone?: boolean;
}) {
  const { Icon } = game;
  const narrow = useNarrow();
  const levelLabel = BOT_LEVELS.find((l) => l.id === level)?.label ?? 'Easy';
  const art = gameCardArt(game.id);
  const style = art
    ? artStyle(art, game.colours)
    : ({ '--card-a': game.colours[0], '--card-b': game.colours[1] } as CSSProperties);
  return (
    <article className={art ? 'game-card game-card--art' : 'game-card'} style={style} aria-labelledby={`game-${game.id}-title`}>
      {art ? (
        <CardPic art={art} />
      ) : (
        <div className="game-card__pic game-card__pic--none" aria-hidden="true">
          <Icon size={44} />
        </div>
      )}
      {game.inDevelopment && <span className="game-card__dev">In development</span>}
      {onPinChange && <PinBox id={game.id} name={game.name} pinned={pinned} onPinChange={onPinChange} />}
      <div className="game-card__body">
        <div className="game-card__text">
          <h3 id={`game-${game.id}-title`}>{game.name}</h3>
          <p>{game.tagline}</p>
          {note && <p className="game-card__note">{note}</p>}
          {game.nextPart && nextPartDone !== undefined && <NextPartChip noun={game.nextPart.noun} done={nextPartDone} />}
        </div>
        {moves && (
          <div className="game-card__moves" aria-label="Moves left today">
            {moves.allDone ? (
              <p className="game-card__moves-done">All done for today. See you tomorrow!</p>
            ) : (
              <>
                <p className="game-card__moves-title">Left today</p>
                <ul>
                  {moves.chips.map((chip) => (
                    <li key={chip.text} className={chip.empty ? 'is-empty' : undefined}>
                      <span aria-hidden="true">{chip.emoji}</span> {chip.text}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="game-card__do">
          {!game.noBots &&
            (narrow ? (
              // On a small card the three levels fold into one chip that says the level (D6).
              <details className="game-card__level">
                <summary aria-label={`Bot level: ${levelLabel}`}>
                  {levelLabel} <span aria-hidden="true">▾</span>
                </summary>
                <BotLevelPicker name={`level-${game.id}`} legend="Bot level" value={level} onChange={onLevelChange} joined />
              </details>
            ) : (
              <BotLevelPicker name={`level-${game.id}`} legend="Bot level" value={level} onChange={onLevelChange} joined />
            ))}
          <Link
            className="game-card__go"
            to={game.noBots ? `/${game.id}` : `/${game.id}?bot=${level}`}
            aria-label={game.noBots ? undefined : `Play ${game.name} vs bot`}
          >
            Play {game.name}
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * A home page card for something that is not a game in the registry (Quick looks, a Training activity), in the same
 * look as GameCard: picture, panel with name and tagline, and a Play button carrying the picture.
 */
export function ActivityCard({
  id,
  name,
  tagline,
  to,
  colours,
  pinned = false,
  onPinChange,
  verb = 'Play',
}: {
  id: string;
  name: string;
  tagline: string;
  to: string;
  colours: [string, string];
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
  /** The button's first word ("Play", or "Start" on the Activities page). */
  verb?: string;
}) {
  const art = gameCardArt(id);
  const style = art ? artStyle(art, colours) : ({ '--card-a': colours[0], '--card-b': colours[1] } as CSSProperties);
  return (
    <article className={art ? 'game-card game-card--art' : 'game-card'} style={style} aria-labelledby={`game-${id}-title`}>
      {art ? <CardPic art={art} /> : <div className="game-card__pic game-card__pic--none" aria-hidden="true" />}
      {onPinChange && <PinBox id={id} name={name} pinned={pinned} onPinChange={onPinChange} />}
      <div className="game-card__body">
        <div className="game-card__text">
          <h3 id={`game-${id}-title`}>{name}</h3>
          <p>{tagline}</p>
        </div>
        <div className="game-card__do">
          <Link className="game-card__go" to={to}>
            {verb} {name}
          </Link>
        </div>
      </div>
    </article>
  );
}
