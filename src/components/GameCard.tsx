import { Link } from 'react-router';
import type { CSSProperties } from 'react';
import type { BotLevel, GameDefinition } from '../games/types';
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
  nextPartDone,
}: {
  game: GameDefinition;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  /** Today's daily allowance in this game, for games that have one. */
  moves?: CardMoves;
  /** A line of news for today under the tagline (Maths Monsters' spotted monster). */
  note?: string;
  /** For a daily game (`nextPart`): true once today's part is done, false while it is ready, undefined for no chip. */
  nextPartDone?: boolean;
}) {
  const { Icon } = game;
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
          {!game.noBots && (
            <BotLevelPicker name={`level-${game.id}`} legend="Bot level" value={level} onChange={onLevelChange} joined />
          )}
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
}: {
  id: string;
  name: string;
  tagline: string;
  to: string;
  colours: [string, string];
}) {
  const art = gameCardArt(id);
  const style = art ? artStyle(art, colours) : ({ '--card-a': colours[0], '--card-b': colours[1] } as CSSProperties);
  return (
    <article className={art ? 'game-card game-card--art' : 'game-card'} style={style} aria-labelledby={`game-${id}-title`}>
      {art ? <CardPic art={art} /> : <div className="game-card__pic game-card__pic--none" aria-hidden="true" />}
      <div className="game-card__body">
        <div className="game-card__text">
          <h3 id={`game-${id}-title`}>{name}</h3>
          <p>{tagline}</p>
        </div>
        <div className="game-card__do">
          <Link className="game-card__go" to={to}>
            Play {name}
          </Link>
        </div>
      </div>
    </article>
  );
}
