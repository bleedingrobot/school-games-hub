import { useEffect, useRef, useState } from 'react';
import { suppliesOnSale } from '../../../shared/clans/actions';
import { MONSTER_LOOKS, SUPPLY_KINDS, SUPPLY_NAMES, monsterOf, monsterSave, supplyPrice, type SupplyKind } from '../../../shared/clans/monster';
import { CONFIG } from '../../../shared/clans/config';
import { GEAR_KINDS, cannotBuy, wornItem, wornTier } from '../../../shared/clans/character';
import { levelOf } from '../../../shared/clans/empire';
import { CLASS_FOCUS, itemLine, offhandWord, smithyFor, unlockedTier } from '../../../shared/clans/items';
import { discountQuestion, marketTotal } from '../../../shared/clans/moments';
import type { GearKind, GearStat, ItemDef, Member } from '../../../shared/clans/types';
import { Moment } from './Moment';
import { buyItem, buySupplies, shopPrice } from './places';
import type { Session, Change } from './session';
import { ItemSprite, PlaceSprite, Portrait } from './Sprite';
import { GEAR_WORD } from './text';
import { lookOf } from '../../../shared/clans/looks';

const GEAR_STATS: GearStat[] = ['strength', 'dexterity', 'agility', 'wisdom', 'armor', 'charisma', 'hp', 'sp'];
const slotWord = (m: Member, kind: GearKind) => (kind === 'weapon' ? 'Weapon' : kind === 'armor' ? 'Armour' : offhandWord(m.cls));

/** "Strength +4 → +7 (R)": what the item gives next to what the member has in that slot now. (R) marks the class's recommended stats. */
function Gains({ member, item }: { member: Member; item: ItemDef }) {
  const now = wornTier(member, item.kind) ? wornItem(member, item.kind)!.bonus : {};
  const focus = CLASS_FOCUS[member.cls] ?? [];
  const lines = GEAR_STATS.filter((s) => item.bonus[s] || now[s]).map((s) => {
    const was = now[s] ?? 0;
    const will = item.bonus[s] ?? 0;
    return (
      <li key={s}>
        {GEAR_WORD[s]} {was === will || was === 0 ? `+${will}` : `+${was} → +${will}`}
        {focus.includes(s) && <span className="cq-rec" title={`Good for a ${member.cls}`}> (R)<span className="sr-only"> recommended for a {member.cls}</span></span>}
      </li>
    );
  });
  return <ul className="cq-gains">{lines}</ul>;
}

/**
 * Monster supplies, on sale from day 22 of the season: what each does, how many you hold, and a Buy button (with the same
 * "check the bill" moment as an item). One at a time, so the bill is the price of one.
 */
function Supplies({ session, onChange }: { session: Session; onChange: Change }) {
  const { clan, settings } = session;
  const season = session.clock!.number;
  const save = monsterSave(clan, season);
  const [asking, setAsking] = useState<SupplyKind | null>(null);
  const [said, setSaid] = useState('');
  const most = (k: SupplyKind) => CONFIG.monster.supplies[k].max;
  const buy = (k: SupplyKind) => {
    const next = buySupplies(session, season, k, 1);
    if (!next) return;
    onChange(next, { type: 'buySupply', kind: k, count: 1 });
    setAsking(null);
    setSaid(`You bought a ${SUPPLY_NAMES[k].one} for ${supplyPrice(k)} gold.`);
  };
  const start = (k: SupplyKind) => {
    setSaid('');
    if (marketTotal(settings, CONFIG.monster.supplies[k].price, CONFIG.shopTax, SUPPLY_NAMES[k].one)) setAsking(k);
    else buy(k);
  };
  return (
    <section className="cq-panel cq-supplies" aria-label="Monster supplies">
      <h3>Monster supplies</h3>
      <p className="cq-soft">For the fight with {MONSTER_LOOKS[monsterOf(season)].name} in the last week of the season. You can only hold so many.</p>
      <ul>
        {SUPPLY_KINDS.map((k) => {
          const have = save.supplies[k];
          const full = have >= most(k);
          return (
            <li key={k}>
              <strong>{SUPPLY_NAMES[k].many[0].toUpperCase() + SUPPLY_NAMES[k].many.slice(1)}</strong>: {SUPPLY_NAMES[k].help}
              <br />
              <span className="cq-soft">You have {have} of {most(k)}. Price: {supplyPrice(k)} gold (with {CONFIG.shopTax}% village tax).</span>{' '}
              <button type="button" className="cq-btn" disabled={full || clan.gold < supplyPrice(k)} aria-label={`Buy a ${SUPPLY_NAMES[k].one} for ${supplyPrice(k)} gold`} onClick={() => start(k)}>
                {full ? 'You have the most' : 'Buy 1'}
              </button>
            </li>
          );
        })}
      </ul>
      {asking && (
        <Moment key={`supply-${asking}`} question={marketTotal(settings, CONFIG.monster.supplies[asking].price, CONFIG.shopTax, SUPPLY_NAMES[asking].one)!} title={`Paying for the ${SUPPLY_NAMES[asking].one}`} note="Check the bill before you pay." doneLabel={`Pay ${supplyPrice(asking)} gold`} onDone={() => buy(asking)} />
      )}
    </section>
  );
}

/**
 * The Market: a card for each member with their three slots. Each slot shows what they wear now and the next item up their
 * class's line, with what it adds and one button to buy and wear it. "See all" opens the whole line, where any tier the
 * Smithy sells can be bought (skip ahead if you have saved up). Buying asks one maths question: right, and it is 10% off.
 */
export function Market({ session, onChange, onBack }: { session: Session; onChange: Change; onBack: () => void }) {
  const { clan, settings } = session;
  const [asking, setAsking] = useState<{ mi: number; item: ItemDef } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  /** What was just bought, said in the buyer's card (which takes the focus, as the Buy button has gone). */
  const [bought, setBought] = useState<{ mi: number; text: string } | null>(null);
  const boughtRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => boughtRef.current?.focus(), [bought]);
  const smithy = levelOf(clan, 'smithy');
  const top = unlockedTier(smithy);

  const pay = (mi: number, item: ItemDef, answer: number | null, right: boolean) => {
    const next = buyItem(session, mi, item, right);
    setAsking(null);
    if (!next) return;
    onChange(next, { type: 'buy', member: mi, item: item.name, answer });
    const paid = shopPrice(item, right);
    setBought({ mi, text: `${clan.members[mi].name} is wearing the ${item.name}. You paid ${paid} gold${right ? ` (${CONFIG.shopDiscount}% off!)` : ''}.` });
  };
  const start = (mi: number, item: ItemDef) => {
    setBought(null);
    if (discountQuestion(settings, item.price, item.name)) setAsking({ mi, item });
    else pay(mi, item, null, false);
  };

  /** The buy button for one item, or why it can't be bought yet. */
  const buyButton = (mi: number, m: Member, item: ItemDef) => {
    const why = cannotBuy(clan, m, item);
    if (why && item.tier > top) return <span className="cq-soft">Needs the Smithy at level {smithyFor(item.tier)}. Upgrade it in My Village.</span>;
    if (why) return null;
    const short = clan.gold < item.price;
    return (
      <span>
        <button type="button" className="cq-btn cq-btn--hot" disabled={short} aria-label={`Buy the ${item.name} for ${m.name}, ${item.price} gold`} onClick={() => start(mi, item)}>
          Buy · {item.price} gold
        </button>
        {short && <small className="cq-soft"> You have {clan.gold}.</small>}
      </span>
    );
  };

  return (
    <section className="cq-place" aria-label="The Market">
      <div className="cq-place__head">
        <h2><PlaceSprite place="market" /> The Market</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <p className="cq-soft">
        You have <strong>{clan.gold} gold</strong>. The Smithy (level {smithy}) sells up to tier {top}. Answer the maths question when you buy for {CONFIG.shopDiscount}% off.
      </p>
      <div className="cq-gearcards">
        {clan.members.map((m, mi) => (
          <article key={m.name} className="cq-panel cq-gearcard" aria-label={`${m.name}'s gear`}>
            <header className="cq-gearcard__head">
              <Portrait race={m.race} cls={m.cls} look={lookOf(m)} scale={2} />
              <h3>{m.name} <small className="cq-soft">{m.race} {m.cls}</small></h3>
            </header>
            {bought?.mi === mi && <p className="cq-note" role="status" tabIndex={-1} ref={boughtRef}>{bought.text}</p>}
            {GEAR_KINDS.map((kind) => {
              const line = itemLine(m.cls, kind);
              const tier = wornTier(m, kind);
              const worn = wornItem(m, kind);
              const next = line.find((i) => i.tier === tier + 1);
              const key = `${mi}-${kind}`;
              const isAsking = asking && asking.mi === mi && asking.item.kind === kind;
              return (
                <div key={kind} className="cq-slot">
                  <div className="cq-slot__row">
                    <span className="cq-slot__name">{slotWord(m, kind)}</span>
                    <span className="cq-slot__item">
                      {worn ? <><ItemSprite name={worn.name} kind={kind} scale={2} /> {worn.name}</> : 'Nothing'}
                    </span>
                    <span className="cq-dots" aria-label={`Tier ${tier} of ${line.length}`}>
                      {line.map((i) => <span key={i.name} className={i.tier <= tier ? 'cq-dot cq-dot--on' : 'cq-dot'} />)}
                    </span>
                  </div>
                  {next ? (
                    <div className="cq-slot__next">
                      <span className="cq-slot__item"><span aria-hidden="true">→ </span><ItemSprite name={next.name} kind={kind} scale={2} /> <strong>{next.name}</strong></span>
                      <Gains member={m} item={next} />
                      {buyButton(mi, m, next)}
                    </div>
                  ) : (
                    <p className="cq-note cq-slot__next">The best there is!</p>
                  )}
                  {isAsking && (
                    <Moment
                      key={`buy-${asking.item.name}`}
                      question={discountQuestion(settings, asking.item.price, asking.item.name)!}
                      title={`${CONFIG.shopDiscount}% off the ${asking.item.name}`}
                      note={`Get it right and you pay ${shopPrice(asking.item, true)} gold instead of ${asking.item.price}.`}
                      doneLabel="Pay and wear it"
                      onDone={(right, answer) => pay(mi, asking.item, answer, right)}
                    />
                  )}
                  <button type="button" className="cq-link" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                    {open === key ? 'Hide the line' : `See all ${line.length}`}
                  </button>
                  {open === key && (
                    <ol className="cq-line" aria-label={`${m.name}'s ${slotWord(m, kind).toLowerCase()} line`}>
                      {line.map((i) => (
                        <li key={i.name} className={i.tier === tier ? 'cq-line__worn' : undefined}>
                          <ItemSprite name={i.name} kind={kind} scale={2} />
                          <span>
                            <strong>{i.name}</strong> <small className="cq-soft">tier {i.tier}{i.tier === tier ? ', wearing' : ''}</small>
                            <Gains member={m} item={i} />
                          </span>
                          {i.tier > tier && i.tier !== tier + 1 && buyButton(mi, m, i)}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </article>
        ))}
      </div>
      {suppliesOnSale(session.clock) && <Supplies session={session} onChange={onChange} />}
    </section>
  );
}
