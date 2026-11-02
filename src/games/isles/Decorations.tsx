/**
 * The decoration shelf (docs/ISLES-COSY-PLAN.md, section 8): every decoration, its price and what it does, and the
 * ones the island has. In a turn's Build step one can be bought and put on a free decoration place, or one moved
 * (free); between turns the shelf just shows where things stand. Every "why not" comes from the rules.
 */
import { useId } from 'react';
import { DECORATIONS, type DecorationId } from '../../../shared/isles/config';
import { decoration, owns, placeCount, problemWith, type Island } from '../../../shared/isles/engine';
import { decorArt } from './art';
import { Art } from './Island';
import { DECOR_EMOJI, n, priceWords, whyNot } from './words';

/** The decoration places with nothing on them, in order. */
export function freePlaces(island: Island): number[] {
  const taken = new Set(island.decorations.map((d) => d.place));
  return Array.from({ length: placeCount(island) }, (_, i) => i).filter((i) => !taken.has(i));
}

function Picture({ id }: { id: DecorationId }) {
  return (
    <span className="si-shelf__pic">
      <Art src={decorArt(id)} fallback={<span aria-hidden="true">{DECOR_EMOJI[id]}</span>} />
    </span>
  );
}

/** Why a decoration can't be bought now, or null if it can. */
function whyNotBuy(island: Island, id: DecorationId): string | null {
  const free = freePlaces(island);
  const action = { kind: 'decorate' as const, id, place: free[0] ?? 0 };
  const problem = problemWith(island, action);
  if (problem === 'already-have') return 'You have this one. One is all you need.';
  if (!free.length) return 'All your decoration places are full. Grow your island for more.';
  return problem ? whyNot(island, action, problem) : null;
}

function BuyButton({ island, id, lit, onBuy }: { island: Island; id: DecorationId; lit?: string | null; onBuy: (id: DecorationId) => void }) {
  const why = useId();
  const problem = whyNotBuy(island, id);
  return (
    <div className="si-choice">
      <button
        type="button"
        className={`button button--light si-choice__button${lit === `decorate-${id}` ? ' si-lit' : ''}`}
        data-pip={`decorate-${id}`}
        disabled={problem !== null}
        aria-describedby={problem ? why : undefined}
        onClick={() => onBuy(id)}
      >
        Put one up
      </button>
      {problem && <span id={why} className="si-choice__why">{problem}</span>}
    </div>
  );
}

export function Shelf({
  island,
  onBuy,
  onMove,
  lit,
}: {
  island: Island;
  /** In a turn: buy one (then choose its place). Left out between turns. */
  onBuy?: (id: DecorationId) => void;
  /** In a turn: move one of the island's decorations (by its number in `decorations`). */
  onMove?: (decoration: number) => void;
  lit?: string | null;
}) {
  const free = freePlaces(island).length;
  return (
    <div className="si-shelf">
      <p className="si-note">
        {free ? `You have ${free === 1 ? '1 free decoration place' : `${n(free)} free decoration places`}.` : 'All your decoration places are full.'} Decorations
        make your island prettier, and a few help a little.
      </p>
      <ul className="si-shelf__list">
        {DECORATIONS.map((d) => {
          const have = island.decorations.filter((x) => x.id === d.id).length;
          const help = 'help' in d;
          return (
            <li key={d.id} className="si-shelf__item">
              <Picture id={d.id} />
              <div className="si-shelf__words">
                <strong>{d.name}</strong>
                <span>{priceWords(d.coins, d.crystals)}</span>
                <span className="si-shelf__does">{help ? `Helps: ${d.does}. One per island.` : 'Just pretty.'}</span>
                {have > 0 && <span className="si-shelf__have">{help || have === 1 ? 'You have this' : `You have ${have}`}</span>}
              </div>
              {onBuy && !(help && owns(island, d.id)) && <BuyButton island={island} id={d.id} lit={lit} onBuy={onBuy} />}
            </li>
          );
        })}
      </ul>
      {onMove && island.decorations.length > 0 && (
        <>
          <h4 className="si-shelf__mine">Your decorations</h4>
          <ul className="si-shelf__list">
            {island.decorations.map((d, i) => (
              <li key={i} className="si-shelf__item">
                <Picture id={d.id} />
                <div className="si-shelf__words">
                  <strong>{decoration(d.id)?.name}</strong>
                  <span>{d.place === null ? 'On the shelf' : `On place ${d.place + 1}`}</span>
                </div>
                <button type="button" className="button button--light" onClick={() => onMove(i)}>Move</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Choosing where a decoration goes: a numbered place on the island (or, for one being moved, back on the shelf). */
export function PlacePicker({
  island,
  name,
  moving,
  onPlace,
  onCancel,
}: {
  island: Island;
  name: string;
  moving: boolean;
  onPlace: (place: number | null) => void;
  onCancel: () => void;
}) {
  const free = freePlaces(island);
  return (
    <>
      <p>Where should the {name} go? Tap a numbered place on your island, or choose one here.</p>
      <div className="si-places" role="group" aria-label="Free decoration places">
        {free.map((p) => (
          <button key={p} type="button" className="button button--light" onClick={() => onPlace(p)}>Place {p + 1}</button>
        ))}
        {moving && <button type="button" className="button button--light" onClick={() => onPlace(null)}>Back on the shelf</button>}
      </div>
      {!free.length && !moving && <p className="si-step__why">All your decoration places are full.</p>}
      <button type="button" className="button button--light" onClick={onCancel}>Cancel</button>
    </>
  );
}
