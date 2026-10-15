/**
 * Pieces of the Wormholes & Black Holes screen shared by the bot game and the classmates
 * game: the choice buttons, the item tiles, the rockets list, the mission log and the podium.
 */
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { FUEL_WARNING_ROUNDS, KEEP_ITEMS, missionRounds, type SpaceState } from '../../../shared/space/engine';
import { ITEMS, type ItemKind } from '../../../shared/space/items';
import { DieFace } from './Dice';
import { SeatShapeIcon, type Seat } from './SpaceBoard';
import type { LogLine } from './useEventPlayer';
import { choiceQuestion, GRAVITY_BADGE, ITEM_EMOJI, ITEM_HELP, ITEM_SHORT, itemName, ORDINAL, SHAPE_NAMES } from './text';

/** Arrow keys move between the buttons in a group. */
export function arrowKeys(event: ReactKeyboardEvent<HTMLElement>) {
  const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
  if (!back && !forward) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  if (buttons.length === 0) return;
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = i < 0 ? 0 : (i + (forward ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus();
  event.preventDefault();
}

export type Picking = { item: ItemKind; kind: 'target' | 'navigator' };

export function Choice({
  pending,
  items,
  onChoose,
  disabled = false,
}: {
  pending: NonNullable<SpaceState['pending']>;
  items: ItemKind[];
  onChoose: (option: number) => void;
  disabled?: boolean;
}) {
  const buttons: { option: number; label: ReactNode; aria?: string; className?: string }[] = [];
  switch (pending.kind) {
    case 'gate':
      buttons.push({ option: 1, label: `🌀 Jump to ${pending.twin}` }, { option: 0, label: `Stay on ${pending.square}` });
      break;
    case 'mystery':
      for (const option of [0, 1, 2]) buttons.push({ option, label: <span className="space-card">?</span>, aria: `Card ${option + 1}`, className: 'space-card-button' });
      break;
    case 'inventory':
      items.forEach((item, option) => buttons.push({ option, label: `Drop ${ITEM_EMOJI[item]} ${itemName(item)}` }));
      buttons.push({ option: KEEP_ITEMS, label: 'Keep my items' });
      break;
    case 'binary':
      pending.dice.forEach((value, option) => buttons.push({ option, label: <DieFace value={value} size={56} />, aria: `Use the ${value}`, className: 'space-die-button' }));
      break;
    case 'question':
      buttons.push({ option: 1, label: 'Answer' });
      break;
  }
  return (
    <div className={`space-choice space-choice--${pending.kind}`} role="group" aria-label={choiceQuestion(pending)} onKeyDown={arrowKeys}>
      {pending.kind === 'inventory' && (
        <p className="space-choice__new">
          New: {ITEM_EMOJI[pending.item]} <strong>{itemName(pending.item)}</strong>. {ITEM_HELP[pending.item]}
        </p>
      )}
      {buttons.map((b) => (
        <button
          key={b.option}
          type="button"
          className={b.className ?? 'button button--light space-choice__button'}
          onClick={() => onChoose(b.option)}
          aria-label={b.aria}
          disabled={disabled}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

/** "Who should it hit?" and "Pick your roll" for items that need one. */
export function ItemPicker({
  picking,
  targets,
  seats,
  positions,
  onTarget,
  onNumber,
  onCancel,
}: {
  picking: Picking;
  targets: number[];
  seats: readonly Seat[];
  positions: readonly number[];
  onTarget: (seat: number) => void;
  onNumber: (n: number) => void;
  onCancel: () => void;
}) {
  if (picking.kind === 'target') {
    return (
      <div className="space-choice" role="group" aria-label="Pick a rocket to aim at" onKeyDown={arrowKeys}>
        {targets.map((seat) => (
          <button key={seat} type="button" className="button button--light space-choice__button" onClick={() => onTarget(seat)}>
            <SeatShapeIcon shape={seats[seat].shape} colour={seats[seat].colour} />
            {seats[seat].name} (square {positions[seat]})
          </button>
        ))}
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className="space-choice space-choice--numbers" role="group" aria-label="Pick your roll" onKeyDown={arrowKeys}>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button key={n} type="button" className="space-die-button" onClick={() => onNumber(n)} aria-label={`Roll ${n}`}>
          <DieFace value={n} size={48} />
        </button>
      ))}
      <button type="button" className="link-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/** Your items, as big tiles. Keys 1–3 use them. */
export function ItemTiles({
  items,
  usable,
  onUse,
}: {
  items: ItemKind[];
  usable: (item: ItemKind) => boolean;
  onUse: (item: ItemKind) => void;
}) {
  return (
    <div className="space-items" role="group" aria-label={`Your items, ${items.length} of 3`}>
      {items.length === 0 ? (
        <p className="space-panel__empty">No items yet. Land on a star to get one!</p>
      ) : (
        <ul className="space-items__list" onKeyDown={arrowKeys}>
          {items.map((item, i) => (
            <li key={`${item}-${i}`}>
              <button
                type="button"
                className={`space-item${ITEMS[item].kind === 'hinder' ? ' is-hinder' : ''}${ITEMS[item].rare ? ' is-rare' : ''}`}
                disabled={!usable(item)}
                onClick={() => onUse(item)}
                aria-keyshortcuts={String(i + 1)}
                aria-label={`${itemName(item)}: ${ITEM_HELP[item]}`}
                title={ITEM_HELP[item]}
              >
                <span className="space-item__top" aria-hidden="true">
                  <span className="space-item__key">{i + 1}</span>
                  <span className="space-item__emoji">{ITEM_EMOJI[item]}</span>
                </span>
                <strong aria-hidden="true">{itemName(item)}</strong>
                <small aria-hidden="true">{ITEM_SHORT[item]}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every rocket: shape, avatar, name, effects, items (not yours: those are the tiles), square. */
export function RocketsPanel({
  view,
  seats,
  positions,
  turnSeat,
  over,
  note,
}: {
  view: SpaceState;
  seats: readonly Seat[];
  positions: readonly number[];
  turnSeat: number | null;
  over: boolean;
  /** Something extra to show after a rocket's name, e.g. "🤖 autopilot". */
  note?: (seat: number) => ReactNode;
}) {
  const cosmic = view.settings.mode === 'cosmic';
  const totalRounds = missionRounds(view);
  const roundsLeft = Math.max(0, totalRounds - view.round + 1);
  const places = view.places ?? [];
  return (
    <section className="space-panel space-players" aria-labelledby="space-players-title">
      <h2 id="space-players-title" className="space-panel__title">
        Rockets
        <span className={`space-fuel${roundsLeft <= FUEL_WARNING_ROUNDS ? ' is-low' : ''}`}>
          Round {view.round} · ⛽ {roundsLeft} left
          <span className="space-fuel__bar" aria-hidden="true">
            <span style={{ width: `${(roundsLeft / totalRounds) * 100}%` }} />
          </span>
        </span>
      </h2>
      <ol className="space-players__list">
        {seats.map((seat, i) => {
          const r = view.rockets[i];
          return (
            <li key={i} className={turnSeat === i && !over ? 'is-turn' : undefined}>
              <SeatShapeIcon shape={seat.shape} colour={seat.colour} size={20} />
              <AvatarImage avatar={seat.avatar} size={28} />
              <span className="space-players__name">
                {seat.name}
                {seat.isStudent && ' (you)'}
                {note?.(i)}
                <span className="sr-only">, {SHAPE_NAMES[seat.shape]} rocket</span>
              </span>
              <span className="space-players__badges">
                {r.gravity && <span title={`${r.gravity.kind} gravity`}>{GRAVITY_BADGE[r.gravity.kind]}</span>}
                {r.anchored && <span title="Next roll halved">⚓</span>}
                {r.shielded && <span title="Shielded until their next turn">✨</span>}
                {r.binary && <span title="Two dice next turn">🎲</span>}
                {cosmic &&
                  !seat.isStudent &&
                  r.items.map((item, k) => (
                    <span key={k} title={itemName(item)}>
                      {ITEM_EMOJI[item]}
                    </span>
                  ))}
              </span>
              <span className="space-players__square">
                <span className="sr-only">square </span>
                {positions[i]}
                {over && <span className="space-players__place"> {ORDINAL[places[i]]}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The mission log: newest at the bottom, kept scrolled down, read out by screen readers. */
export function MissionLog({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = ref.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines]);
  return (
    <ol className="space-log__list" ref={ref} role="log" aria-live="polite" aria-relevant="additions">
      {lines.map((line) => (
        <li key={line.id} className={line.mine ? 'is-mine' : line.text.startsWith('—') ? 'is-round' : undefined}>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

const MEDALS = ['', '🥇', '🥈', '🥉', '🚀'];

/** The places at the end, with every rocket on a podium step. `mine` is null for someone who left. */
export function Podium({
  seats,
  places,
  mine,
  ending,
  saveNote,
  children,
}: {
  seats: readonly Seat[];
  places: number[];
  mine: number | null;
  ending: SpaceState['ending'] | 'abandoned';
  saveNote: string | null;
  /** The buttons. */
  children: ReactNode;
}) {
  const title =
    ending === 'abandoned'
      ? 'Everyone left'
      : mine === null
        ? 'The game is over'
        : mine === 1
          ? ending === 'docked'
            ? 'You docked first!'
            : 'You got the furthest!'
          : `You came ${ORDINAL[mine]}!`;
  const about =
    ending === 'abandoned'
      ? 'Nobody was left flying, so the game stopped.'
      : ending === 'mission-clock'
        ? 'The fuel ran out, so places go by how far everyone got.'
        : mine === 1
          ? 'First to the space station. Brilliant flying!'
          : 'Dice are luck. Have another go!';
  const steps = [2, 1, 3].filter((p) => places.includes(p));
  const fourth = seats.map((_, i) => i).filter((i) => places[i] >= 4);
  return (
    <div className="chess-result space-podium" role="dialog" aria-modal="true" aria-labelledby="space-result-title">
      <div className={`chess-result__card chess-result__card--${mine === 1 ? 'won' : 'drawn'}`}>
        <div className="chess-result__emoji" aria-hidden="true">
          {mine === 1 ? '🏆' : mine ? MEDALS[mine] : '🚀'}
        </div>
        <h2 id="space-result-title">{title}</h2>
        <p>{about}</p>
        {places.length > 0 && (
          <ol className="space-podium__steps">
            {steps.map((place) => (
              <li key={place} className={`space-podium__step is-${place}`}>
                <span className="space-podium__rockets">
                  {seats.map((seat, i) =>
                    places[i] === place ? (
                      <span key={i} className="space-podium__who">
                        <AvatarImage avatar={seat.avatar} size={44} />
                        <SeatShapeIcon shape={seat.shape} colour={seat.colour} />
                        <span>{seat.isStudent ? 'You' : seat.name}</span>
                      </span>
                    ) : null,
                  )}
                </span>
                <span className="space-podium__block">
                  <span aria-hidden="true">{MEDALS[place]}</span> {ORDINAL[place]}
                </span>
              </li>
            ))}
          </ol>
        )}
        {fourth.length > 0 && (
          <p className="space-podium__fourth">
            {fourth.map((i) => `${ORDINAL[places[i]]}: ${seats[i].isStudent ? 'You' : seats[i].name}`).join(' · ')}
          </p>
        )}
        {saveNote && (
          <p className="space-podium__save" role="status">
            {saveNote}
          </p>
        )}
        <div className="chess-result__buttons">{children}</div>
      </div>
    </div>
  );
}
