/**
 * The Armory (docs/ARCHERY-PLAN.md, section 4): wooden shelves of arrows (by Armory level), helpers, shields and
 * More Bows. Everything is bought and sold through the server, at the shop's own prices. Items above your Armory
 * level show what level opens them. "More Bows" on the home screen opens straight at the bows.
 */
import { useEffect, useRef, useState } from 'react';
import {
  CARRY_MOST, TOP_LEVEL, armoryLevel, buyProblem, sellPrice, shopItems, toNextLevel, type ShopItem, type ShopKind,
} from '../../../shared/archery/shop';
import type { ItemId } from '../../../shared/archery/types';
import type { ArcheryApi, ArmoryState } from '../../data/archery';
import { CoinCount } from './CoinCount';
import { ItemIcon } from './ItemIcon';

export type Shelf = 'arrows' | 'helpers' | 'shields' | 'bows';

const SHELVES: { id: Shelf; name: string; note: string }[] = [
  { id: 'arrows', name: 'Arrows', note: 'Each one changes how a shot plays. Used up when you shoot them.' },
  { id: 'helpers', name: 'Helpers', note: 'Used up when they help.' },
  { id: 'shields', name: 'Shields', note: 'Keep them for good. Each lasts a whole fight, then breaks.' },
  { id: 'bows', name: 'More Bows', note: 'Keep them for good. A bow never helps you aim.' },
];

function shelfOf(item: ShopItem): Shelf {
  if (item.kind === 'shield') return 'shields';
  if (item.kind === 'bow') return 'bows';
  return item.id === 'apple' || item.id === 'umbrella' ? 'helpers' : 'arrows';
}

const PROBLEM_WORDS: Record<string, string> = {
  coins: "You haven't got enough coins for that yet. A speed round earns more!",
  level: 'Spend more in the Armory to open that one.',
  full: `You can carry ${CARRY_MOST} of each.`,
  owned: 'You already have that.',
  none: "You haven't got one to sell.",
};

export function ArmoryScreen({ api, state, onState, onExit, onEarn, startShelf = 'arrows' }: {
  api: ArcheryApi;
  state: ArmoryState;
  onState: (s: ArmoryState) => void;
  onExit: () => void;
  /** Go to a speed round to earn coins. */
  onEarn: () => void;
  startShelf?: Shelf;
}) {
  const [shelf, setShelf] = useState<Shelf>(startShelf);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const level = armoryLevel(state.spent);
  const next = toNextLevel(state.spent);
  const pct = next === null ? 100 : Math.round((100 * state.spent) / (state.spent + next));
  const items = shopItems().filter((i) => shelfOf(i) === shelf);
  const have = (i: ShopItem) =>
    i.kind === 'gear' ? state.gear[i.id as ItemId] ?? 0 : i.kind === 'shield' ? (state.shields.includes(i.id as never) ? 1 : 0) : state.bows.includes(i.id as never) ? 1 : 0;

  async function trade(action: 'buy' | 'sell', i: ShopItem) {
    setBusy(`${action}:${i.kind}:${i.id}`);
    setNote('');
    const r = await api.shop(action, i.kind as ShopKind, i.id);
    setBusy(null);
    if (!r.ok) {
      setNote(r.message);
      return;
    }
    onState(r.value.state);
    if (r.value.result === 'ok') {
      setNote(action === 'buy' ? `Bought ${i.qty > 1 ? `${i.qty} ` : ''}${i.name}${i.qty > 1 ? 's' : ''}!` : `Sold one ${i.name} for ${sellPrice(i)} coins.`);
    } else setNote(PROBLEM_WORDS[r.value.result] ?? "That couldn't be done.");
  }

  // Arrows in level groups (Level 1, Level 2 …), the other shelves as one row.
  const groups = shelf === 'arrows' ? Array.from({ length: TOP_LEVEL }, (_, k) => ({ level: k + 1, items: items.filter((i) => i.level === k + 1) })).filter((g) => g.items.length) : [{ level: 0, items }];

  return (
    <section className="ar-armory" aria-labelledby="ar-armory-title">
      <div className="ar-armory__head">
        <h2 id="ar-armory-title" ref={heading} tabIndex={-1} className="ar-plaque">Armory</h2>
        <div className="ar-armory__level">
          <b>Armory level {level}</b>
          <span className="ar-levelbar" role="meter" aria-label="Armory level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </span>
          <small>{next === null ? 'Top level: everything is open!' : `Spend ${next} more coins to reach level ${level + 1}.`}</small>
        </div>
        <CoinCount coins={state.coins} onEarn={onEarn} />
        <button type="button" className="button button--light ar-btn" onClick={onExit}>Back</button>
      </div>
      <div className="ar-tabs" role="tablist" aria-label="Shelves">
        {SHELVES.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={shelf === s.id} className="button button--light ar-btn ar-tab" onClick={() => setShelf(s.id)}>{s.name}</button>
        ))}
      </div>
      <p className="ar-armory__shelfnote">{SHELVES.find((s) => s.id === shelf)!.note}</p>
      <p className="ar-armory__note" role="status" aria-live="polite">{note}</p>
      <div className="ar-shelves" role="tabpanel" aria-label={SHELVES.find((s) => s.id === shelf)!.name}>
        {groups.map((g) => (
          <div key={g.level} className="ar-shelf">
            {g.level > 0 && <h3 className="ar-shelf__tier">Level {g.level}{g.level > level ? ' (locked)' : ''}</h3>}
            <ul className="ar-items">
              {g.items.map((i) => {
                const owned = have(i);
                const problem = buyProblem(state, i);
                const locked = problem === 'level';
                const kept = i.kind !== 'gear';
                return (
                  <li key={`${i.kind}:${i.id}`} className="ar-item" data-locked={locked || undefined}>
                    <ItemIcon kind={i.kind} id={i.id} />
                    <div className="ar-item__text">
                      <h4>{i.name}</h4>
                      <p>{i.does}</p>
                      <p className="ar-item__have">{kept ? (owned ? 'Yours' : '') : `You have ${owned}`}</p>
                    </div>
                    <div className="ar-item__buy">
                      <span className="ar-price">{i.price} coins{i.qty > 1 ? ` for ${i.qty}` : ''}</span>
                      {locked ? (
                        <span className="ar-item__lock">Opens at level {i.level}</span>
                      ) : kept && owned ? (
                        <button type="button" className="button button--light ar-btn ar-small" disabled={!!busy} onClick={() => void trade('sell', i)} aria-label={`Sell ${i.name} for ${sellPrice(i)} coins`}>Sell ({sellPrice(i)})</button>
                      ) : (
                        <button type="button" className="button button--play ar-btn ar-small" disabled={!!busy || problem === 'full'} aria-label={`Buy ${i.name} for ${i.price} coins`} onClick={() => void trade('buy', i)}>
                          {busy === `buy:${i.kind}:${i.id}` ? '…' : problem === 'full' ? 'Full' : 'Buy'}
                        </button>
                      )}
                      {!kept && owned > 0 && (
                        <button type="button" className="button button--light ar-btn ar-small" disabled={!!busy} aria-label={`Sell one ${i.name} for ${sellPrice(i)} coins`} onClick={() => void trade('sell', i)}>Sell 1 ({sellPrice(i)})</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
