import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { inShop } from '../../../shared/clans/character';
import { betterBuy, examineCostQuestion, itemPoints, marketChange, marketTotal } from '../../../shared/clans/moments';
import { STATS, type ItemDef, type Member } from '../../../shared/clans/types';
import { Moment } from './Moment';
import { buyItem, examineCost, examineItem, hasExamined, shopPrice } from './places';
import type { Session } from './session';
import { ItemSprite, PlaceSprite, Portrait } from './Sprite';
import { ITEM_TEXT, KIND_WORD, STAT_WORD } from './text';

type Kind = ItemDef['kind'];
const TABS: [Kind, string][] = [['weapon', 'Weapons'], ['armor', 'Armour'], ['shield', 'Shields']];
const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

type Phase =
  | { t: 'idle' }
  | { t: 'buy' }
  | { t: 'examine' }
  | { t: 'bought'; item: ItemDef; price: number; who: string }
  | { t: 'change'; price: number }
  | { t: 'compare'; other: ItemDef };

/** What an item really gives, and whether this member can use it yet. Only shown after "Look closely". */
function RealStats({ member, item }: { member: Member; item: ItemDef }) {
  const gives = STATS.filter((s) => item.bonus[s]).map((s) => `${signed(item.bonus[s]!)} ${STAT_WORD[s]}`);
  const needs = STATS.filter((s) => item.needs[s]);
  const short = needs.filter((s) => (item.needs[s] ?? 0) > member.stats[s]);
  const works = short.length === 0;
  return (
    <div className="cq-real">
      <p><strong>Gives:</strong> {gives.join(', ') || 'nothing special'}</p>
      <p><strong>Needs:</strong> {needs.length ? needs.map((s) => `${STAT_WORD[s]} ${item.needs[s]}`).join(', ') : 'nothing'}</p>
      <p className={works ? 'cq-note' : 'cq-warn'}>
        {works ? `${member.name} can use it well.` : `${member.name} isn't ready for it yet: needs ${short.map((s) => `${STAT_WORD[s]} ${item.needs[s]} (has ${member.stats[s]})`).join(', ')}. It won't help until then.`}
      </p>
    </div>
  );
}

/** The Market: pick a member, pick an item, check the bill with a maths moment, pay. */
export function Market({ session, onChange, onBack }: { session: Session; onChange: (s: Session) => void; onBack: () => void }) {
  const { clan, settings } = session;
  const [mi, setMi] = useState(0);
  const [tab, setTab] = useState<Kind>('weapon');
  const [picked, setPicked] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const member = clan.members[mi];
  const shelf = inShop(clan.village.smithy);
  const item = picked ? shelf.find((i) => i.name === picked) ?? null : null;
  const price = item ? shopPrice(item) : 0;
  const idle = () => setPhase({ t: 'idle' });

  const wearing = (m: Member, kind: Kind) => m.gear[kind];
  const lookedAt = shelf.filter((i) => hasExamined(session, member, i));
  const startBuy = () => {
    if (!item || clan.gold < price) return;
    if (marketTotal(settings, item.price)) setPhase({ t: 'buy' });
    else pay(item);
  };
  const pay = (it: ItemDef) => {
    const next = buyItem(session, mi, it);
    if (!next) return;
    onChange(next);
    setPhase({ t: 'bought', item: it, price: shopPrice(it), who: member.name });
  };
  const startExamine = () => {
    if (!item || clan.gold < examineCost(item)) return;
    if (examineCostQuestion(settings, item.price)) setPhase({ t: 'examine' });
    else look(item);
  };
  const look = (it: ItemDef) => {
    const next = examineItem(session, mi, it);
    if (next) onChange(next);
    idle();
  };

  let detail: React.ReactNode;
  if (!item) {
    detail = <p className="cq-soft">Pick something from the shelf to see more.</p>;
  } else if (phase.t === 'buy') {
    detail = <Moment key={`buy-${item.name}`} question={marketTotal(settings, item.price)!} title={`Paying for the ${item.name}`} note="Check the bill before you pay." doneLabel={`Pay ${price} gold`} onDone={() => pay(item)} />;
  } else if (phase.t === 'examine') {
    detail = <Moment key={`look-${item.name}`} question={examineCostQuestion(settings, item.price)!} title={`Looking closely at the ${item.name}`} note="Looking costs a share of the price." doneLabel={`Pay ${examineCost(item)} gold and look`} onDone={() => look(item)} />;
  } else if (phase.t === 'bought') {
    const q = marketChange(settings, phase.price);
    detail = (
      <div className="cq-panel" role="status">
        <p className="cq-note">{phase.who} now has the {phase.item.name}. You paid {phase.price} gold, and have {clan.gold} left.</p>
        <div className="cq-actions">
          {q && <button type="button" className="cq-btn" onClick={() => setPhase({ t: 'change', price: phase.price })}>Check my change</button>}
          <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={idle}>Keep shopping</button>
        </div>
      </div>
    );
  } else if (phase.t === 'change') {
    detail = <Moment key={`change-${phase.price}`} question={marketChange(settings, phase.price)!} title="Your change" note="Pretend you paid with a big note." doneLabel="Done" onDone={idle} />;
  } else if (phase.t === 'compare') {
    const q = betterBuy(settings, { name: item.name, price: item.price, points: itemPoints(member, item) }, { name: phase.other.name, price: phase.other.price, points: itemPoints(member, phase.other) });
    detail = q ? (
      <Moment key={`cmp-${item.name}-${phase.other.name}`} question={q} title="Which is the better buy?" note={`Think about what ${member.name} would really get.`} doneLabel="Carry on" onDone={idle} />
    ) : (
      <div className="cq-panel"><p>These two are too hard to tell apart for {member.name}, so there is nothing to compare.</p><button type="button" className="cq-btn" autoFocus onClick={idle}>Back</button></div>
    );
  } else {
    const seen = hasExamined(session, member, item);
    const old = wearing(member, item.kind);
    const taxed = !marketTotal(settings, item.price);
    detail = (
      <div className="cq-detail">
        <h3><ItemSprite name={item.name} kind={item.kind} scale={3} /> {item.name}</h3>
        <p className="cq-soft">{KIND_WORD[item.kind]} · {ITEM_TEXT[item.name]}</p>
        <p>{taxed ? <>Price: <strong>{price} gold</strong> (with {CONFIG.shopTax}% village tax)</> : <>Price: <strong>{item.price} gold</strong>, plus {CONFIG.shopTax}% village tax</>}</p>
        <p className="cq-soft">{old ? `${member.name} has: ${old}. Buying this swaps it.` : `${member.name} has no ${KIND_WORD[item.kind].toLowerCase()} yet.`}</p>
        {seen ? <RealStats member={member} item={item} /> : <p className="cq-soft">What it really does is a secret until you look closely.</p>}
        <div className="cq-actions">
          <button type="button" className="cq-btn cq-btn--hot" disabled={clan.gold < price} onClick={startBuy}>Buy for {member.name}</button>
          {!seen && <button type="button" className="cq-btn" disabled={clan.gold < examineCost(item)} onClick={startExamine}>Look closely ({examineCost(item)} gold)</button>}
        </div>
        {clan.gold < price && <p className="cq-warn">You need {taxed ? price : `${item.price} gold plus tax`} to buy this, and have {clan.gold}. Win some fights in the Mines to earn more.</p>}
        {seen && lookedAt.filter((o) => o.name !== item.name).length > 0 && (
          <div>
            <p className="cq-soft">Which is the better buy? Compare with:</p>
            <div className="cq-actions">
              {lookedAt.filter((o) => o.name !== item.name).map((o) => <button key={o.name} type="button" className="cq-btn" onClick={() => setPhase({ t: 'compare', other: o })}>{o.name}</button>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="cq-place" aria-label="The Market">
      <div className="cq-place__head">
        <h2><PlaceSprite place="market" /> The Market</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <p className="cq-soft">You have <strong>{clan.gold} gold</strong>. Who is shopping?</p>
      <div className="cq-pick" role="group" aria-label="Who is shopping?">
        {clan.members.map((m, i) => (
          <button key={m.name} type="button" className="cq-btn cq-pick__btn" aria-pressed={i === mi} onClick={() => { setMi(i); idle(); }}>
            <Portrait race={m.race} cls={m.cls} scale={2} />
            <span><strong>{m.name}</strong><br /><small>{[m.gear.weapon, m.gear.armor, m.gear.shield].filter(Boolean).join(', ') || 'no gear yet'}</small></span>
          </button>
        ))}
      </div>
      <div className="cq-tabs" role="group" aria-label="Shelves">
        {TABS.map(([k, label]) => <button key={k} type="button" className="cq-btn" aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      <div className="cq-shop">
        <ul className="cq-shelf" aria-label="On the shelf">
          {shelf.filter((i) => i.kind === tab).map((i) => (
            <li key={i.name}>
              <button type="button" className="cq-btn cq-shelf__item" aria-pressed={i.name === picked} onClick={() => { setPicked(i.name); idle(); }}>
                <ItemSprite name={i.name} kind={i.kind} scale={2} />
                <span>{i.name}{wearing(member, i.kind) === i.name && <small> (worn)</small>}{hasExamined(session, member, i) && <small> ✓</small>}<br /><small>{i.price} gold</small></span>
              </button>
            </li>
          ))}
        </ul>
        <div className="cq-panel cq-shop__detail">{detail}</div>
      </div>
    </section>
  );
}
