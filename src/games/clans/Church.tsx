import { useState } from 'react';
import { freeWakes } from '../../../shared/clans/character';
import { CONFIG } from '../../../shared/clans/config';
import { churchBill } from '../../../shared/clans/moments';
import { Moment } from './Moment';
import { knockedOut, wakeAll, wakeAllCost, wakeAllPayers, wakeCost, wakeMember } from './places';
import type { Session, Change } from './session';
import { PlaceSprite, Portrait } from './Sprite';
import { lookOf } from '../../../shared/clans/looks';

type Phase = { t: 'idle' } | { t: 'one'; index: number } | { t: 'all' } | { t: 'done'; text: string };

/** The Church: wake knocked-out members. The first wake-up each day is free; the rest cost (level + 1) x 10. */
export function Church({ session, onChange, onBack }: { session: Session; onChange: Change; onBack: () => void }) {
  const { clan, settings } = session;
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const out = knockedOut(clan);
  const idle = () => setPhase({ t: 'idle' });
  const freeLeft = Math.max(0, freeWakes(clan) - (clan.wakesToday ?? 0));

  const wakeOne = (index: number) => {
    const m = clan.members[index];
    const cost = wakeCost(clan, m);
    const next = wakeMember(session, index);
    if (!next) return;
    onChange(next, { type: 'wake', member: index });
    setPhase({ t: 'done', text: `${m.name} is awake again. ${cost === 0 ? 'That one was free.' : `That cost ${cost} gold.`}` });
  };
  const startOne = (index: number) => {
    const m = clan.members[index];
    if (wakeCost(clan, m) === 0 || !churchBill(settings, [m.level])) wakeOne(index);
    else setPhase({ t: 'one', index });
  };
  const doAll = () => {
    const cost = wakeAllCost(clan);
    const next = wakeAll(session);
    if (!next) return;
    onChange(next, { type: 'wakeAll' });
    setPhase({ t: 'done', text: `Everyone is awake again. ${cost === 0 ? 'That was free.' : `That cost ${cost} gold.`}` });
  };
  const startAll = () => {
    if (churchBill(settings, wakeAllPayers(clan))) setPhase({ t: 'all' });
    else doAll();
  };

  const allCost = wakeAllCost(clan);
  let body: React.ReactNode;
  if (phase.t === 'one') {
    const m = clan.members[phase.index];
    body = <Moment key={`one-${m.name}`} question={churchBill(settings, [m.level])!} title={`Waking ${m.name}`} note="Check the bill before you pay." doneLabel={`Pay ${wakeCost(clan, m)} gold`} onDone={() => wakeOne(phase.index)} />;
  } else if (phase.t === 'all') {
    body = <Moment key="all" question={churchBill(settings, wakeAllPayers(clan))!} title="Waking everyone" note={freeLeft > 0 ? 'The first wake-up is free, so it is not in the bill.' : 'Check the bill before you pay.'} doneLabel={`Pay ${allCost} gold`} onDone={doAll} />;
  } else if (phase.t === 'done') {
    body = <div className="cq-panel" role="status"><p className="cq-note">{phase.text} {clan.gold} gold left.</p><button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={idle}>Carry on</button></div>;
  } else if (out.length === 0) {
    body = <p>Everyone is awake and well. Nobody needs the Church today.</p>;
  } else {
    body = (
      <>
        <p>{freeLeft > 0 ? `${freeLeft === 1 ? "The first wake-up today is free" : `The first ${freeLeft} wake-ups today are free`}. After that, each one costs (level + 1) × ${CONFIG.churchPerLevel} gold.` : `Waking someone costs (level + 1) × ${CONFIG.churchPerLevel} gold.`}</p>
        <ul className="cq-church">
          {out.map(({ m, i }) => {
            const cost = wakeCost(clan, m);
            return (
              <li key={m.name}>
                <Portrait race={m.race} cls={m.cls} look={lookOf(m)} scale={2} />
                <span><strong>{m.name}</strong> · level {m.level} · {cost === 0 ? 'free (first wake-up)' : `${cost} gold`}{cost > clan.gold && <span className="cq-warn"> You need {cost - clan.gold} more gold. Fights in the Mines earn more.</span>}</span>
                <button type="button" className="cq-btn" disabled={cost > clan.gold} onClick={() => startOne(i)}>Wake {m.name}</button>
              </li>
            );
          })}
        </ul>
        {out.length > 1 && (
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" disabled={allCost > clan.gold} onClick={startAll}>Wake everyone ({allCost === 0 ? 'free' : `${allCost} gold`})</button>
            {allCost > clan.gold && <span className="cq-warn">Waking everyone costs {allCost} gold and you have {clan.gold}. You can still wake them one at a time.</span>}
          </div>
        )}
      </>
    );
  }

  return (
    <section className="cq-place" aria-label="The Church">
      <div className="cq-place__head">
        <h2><PlaceSprite place="church" /> The Church</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <p className="cq-soft">You have <strong>{clan.gold} gold</strong>. {out.length > 0 && `${out.length} knocked out.`}</p>
      {body}
    </section>
  );
}

