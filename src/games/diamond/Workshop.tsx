/**
 * The Claw Workshop (docs/DIAMOND-PLAN.md, section 3.5): looks-only upgrades in 6 slots, the special of the week first,
 * earned ones showing how to win them, "try it on" on a swinging claw, then buy and wear.
 */
import { useEffect, useRef, useState } from 'react';
import { SLOTS, type Slot, type WorkshopItem } from '../../../shared/diamond/config';
import type { Player } from '../../../shared/diamond/progress';
import { canBuy, priceOf, weekNumber, weeklySpecial } from '../../../shared/diamond/workshop';
import { WORKSHOP_ITEMS } from '../../../shared/diamond/workshopItems';
import { nzDate } from '../../../shared/diamond/progress';
import { drawItem, drawRig } from './art/items';
import { Sprite } from './Sprite';

const SLOT_NAME: Record<Slot, string> = { head: 'Claw heads', rope: 'Ropes', trail: 'Trails', catch: 'Catch effects', winch: 'Winches', hat: 'Hats for Nugget' };
const RARITY_NAME = { common: 'Common', cool: 'Cool', epic: 'Epic', legendary: 'Legendary' } as const;
const HOW_TO_WIN: Record<string, string> = {
  diamond_found: 'Win it by catching the Heart Diamond.',
  diamond_stars: 'Win it with 3 stars on every level.',
  diamond_kinds: 'Win it by catching every kind of gem.',
  diamond_grips: 'Win it by holding on to 10 slipping gems.',
};

export function Workshop({
  player,
  now,
  still,
  onBuy,
  onWear,
  onBack,
}: {
  player: Player;
  now: Date;
  still: boolean;
  onBuy: (id: string) => void;
  onWear: (slot: Slot, id: string | null) => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const week = weekNumber(nzDate(now));
  const special = weeklySpecial(week);
  const [slot, setSlot] = useState<Slot>(special.slot);
  const [trying, setTrying] = useState<WorkshopItem | null>(null);
  const trail = useRef<[number, number][]>([]);
  const worn = trying ? { ...player.worn, [trying.slot]: trying.id } : player.worn;
  const items = WORKSHOP_ITEMS.filter((it) => it.slot === slot).sort((a, b) => (a.id === special.id ? -1 : b.id === special.id ? 1 : 0));

  const card = (it: WorkshopItem, isSpecial: boolean) => {
    const owned = player.owned.includes(it.id);
    const wearing = player.worn[it.slot] === it.id;
    const price = priceOf(it, week);
    const check = canBuy(player, it.id, now);
    return (
      <li key={`${isSpecial ? 's-' : ''}${it.id}`} className={`dd-item dd-item--${it.rarity}${isSpecial ? ' dd-item--special' : ''}`}>
        <Sprite size={64} className="dd-item__icon" draw={(c, t) => drawItem(c, it, t)} />
        <div className="dd-item__body">
          <h3 className="dd-item__name">{it.name}</h3>
          <p className="dd-item__meta">
            <span className={`dd-rarity dd-rarity--${it.rarity}`}>{RARITY_NAME[it.rarity]}</span>
            {isSpecial && <span className="dd-chip dd-chip--gold">Special this week</span>}
          </p>
          {it.earnedBy && !owned ? (
            <p className="dd-item__how">{HOW_TO_WIN[it.earnedBy]}</p>
          ) : owned ? (
            <p className="dd-item__how">{wearing ? 'You’re wearing it.' : 'Yours.'}</p>
          ) : (
            <p className="dd-item__how">
              You have {player.coins}. {it.name} {price}.{' '}
              {check.ok ? `You’ll have ${player.coins - price} left.` : `You need ${price - player.coins} more.`}
            </p>
          )}
          <div className="dd-row">
            <button type="button" className="button button--light-outline dd-btn dd-btn--small" onClick={() => setTrying(trying?.id === it.id ? null : it)} aria-pressed={trying?.id === it.id}>
              {trying?.id === it.id ? 'Take it off' : 'Try it on'}
            </button>
            {!owned && !it.earnedBy && (
              <button type="button" className="button button--primary dd-btn dd-btn--small" disabled={!check.ok} onClick={() => { onBuy(it.id); setTrying(null); }}>
                Buy for {price}
              </button>
            )}
            {owned && !wearing && <button type="button" className="button button--primary dd-btn dd-btn--small" onClick={() => onWear(it.slot, it.id)}>Wear it</button>}
            {owned && wearing && <button type="button" className="button button--light dd-btn dd-btn--small" onClick={() => onWear(it.slot, null)}>Take off</button>}
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="dd-page" aria-labelledby="dd-ws-title">
      <div className="dd-page__top">
        <button type="button" className="button button--light-outline dd-btn" onClick={onBack}>Back to the map</button>
        <h2 id="dd-ws-title" ref={heading} tabIndex={-1} className="dd-title">The Claw Workshop</h2>
        <span className="dd-chip"><span aria-hidden="true">🪙</span> {player.coins} coins</span>
      </div>
      <p className="dd-soft">Silly upgrades for your claw. They only change how it looks, never how it digs. Kept for good, even after New Season.</p>
      <div className="dd-ws">
        <div className="dd-ws__try">
          <Sprite size={190} box={200} draw={(c, t) => drawRig(c, worn, t, still, trail.current)} animate label={trying ? `Trying on ${trying.name}` : 'Your claw as it is now'} />
          <p className="dd-soft dd-small" aria-live="polite">{trying ? `Trying on: ${trying.name}` : 'Tap “Try it on” to see an upgrade here.'}</p>
          <ul className="dd-list dd-list--special" aria-label="Special of the week">{card(special, true)}</ul>
        </div>
        <div className="dd-ws__shop">
          <div className="dd-tabs" role="group" aria-label="Kinds of upgrade">
            {SLOTS.map((sl) => (
              <button key={sl} type="button" className={`dd-tab${slot === sl ? ' is-on' : ''}`} aria-pressed={slot === sl} onClick={() => setSlot(sl)}>
                {SLOT_NAME[sl]}
              </button>
            ))}
          </div>
          <ul className="dd-list" aria-label={SLOT_NAME[slot]}>{items.filter((it) => it.id !== special.id).map((it) => card(it, false))}</ul>
        </div>
      </div>
    </section>
  );
}
