import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { TROOP_NAMES, barracksFor, capacity, countBuildings, draftMax, draftWanted, empireOf, might, room, troopBillOf } from '../../../shared/clans/empire';
import { barracksNeeded, draftJoin, troopBill } from '../../../shared/clans/moments';
import { TROOP_KINDS, type Troops } from '../../../shared/clans/types';
import { Moment } from './Moment';
import { buyTroopMix, canBuyMix, draftFollowers, setDraftTo } from './places';
import type { Session, Change } from './session';

type Phase =
  | { t: 'idle' }
  | { t: 'needed' }
  | { t: 'bill'; mix: Troops }
  | { t: 'draft'; percent: number }
  | { t: 'done'; text: string };

const none = (): Troops => ({ footman: 0, axeman: 0, knight: 0 });
const nameOf = (kind: keyof Troops, n: number) => (n === 1 ? TROOP_NAMES[kind].one : TROOP_NAMES[kind].many);

/** Barracks and troops: room, buying, and the draft. */
export function Barracks({ session, onChange, onBack }: { session: Session; onChange: Change; onBack: () => void }) {
  const { clan, settings } = session;
  const e = empireOf(clan);
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const [mix, setMix] = useState<Troops>(none());
  const idle = () => setPhase({ t: 'idle' });
  const barracks = countBuildings(e, 'barracks');
  const need = barracksFor(e.troops);
  const total = TROOP_KINDS.reduce((t, k) => t + mix[k], 0);
  const mixCheck = canBuyMix(session, mix);
  const bill = troopBillOf(mix);
  const draftPercents = Array.from({ length: draftMax(e) / CONFIG.empire.draftStep + 1 }, (_, i) => i * CONFIG.empire.draftStep);

  const buy = (m: Troops) => {
    const next = buyTroopMix(session, m);
    if ('fail' in next) return setPhase({ t: 'done', text: next.fail.say });
    onChange(next, { type: 'buyTroops', mix: m });
    setMix(none());
    setPhase({ t: 'done', text: `Your troops arrived. That cost ${troopBillOf(m)} gold.` });
  };
  const startBuy = () => {
    if (troopBill(settings, mix.footman, mix.axeman, mix.knight)) setPhase({ t: 'bill', mix });
    else buy(mix);
  };
  const runDraft = () => {
    const r = draftFollowers(session);
    onChange(r.session, { type: 'draft' });
    const used = `All ${r.followers} ${r.followers === 1 ? 'follower is' : 'followers are'} used up: `;
    const text = r.joined === r.wanted
      ? `${used}${r.joined} joined as ${nameOf('footman', r.joined)}, and the rest went home.`
      : `${used}${r.joined} joined as ${nameOf('footman', r.joined)}. The barracks had no room for the other ${r.wanted - r.joined}, so they went home with the rest.`;
    setPhase({ t: 'done', text });
  };
  const startDraft = () => {
    if (clan.followers < 1) return setPhase({ t: 'done', text: 'You have no followers to draft.' });
    if (e.draftPercent > 0 && draftJoin(settings, clan.followers, e.draftPercent)) setPhase({ t: 'draft', percent: e.draftPercent });
    else runDraft();
  };

  let body: React.ReactNode;
  if (phase.t === 'needed') {
    const q = barracksNeeded(settings, need.count, need.cap)!;
    body = <Moment key="needed" question={q} title="How many barracks?" note={`You have ${need.count} ${nameOf(need.kind, need.count)}. One barracks holds ${need.cap}.`} doneLabel="Carry on" onDone={idle} />;
  } else if (phase.t === 'bill') {
    const q = troopBill(settings, phase.mix.footman, phase.mix.axeman, phase.mix.knight)!;
    body = <Moment key="bill" question={q} title="What do these troops cost?" doneLabel={`Buy them for ${troopBillOf(phase.mix)} gold`} onDone={() => buy(phase.mix)} />;
  } else if (phase.t === 'draft') {
    const q = draftJoin(settings, clan.followers, phase.percent)!;
    body = <Moment key="draft" question={q} title="How many will join?" doneLabel="Draft my followers" onDone={runDraft} />;
  } else if (phase.t === 'done') {
    body = <div className="cq-panel" role="status"><p className="cq-note">{phase.text}</p><button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={idle}>Carry on</button></div>;
  } else {
    body = (
      <div className="cq-land">
        <div className="cq-panel">
          <h3>The barracks</h3>
          <p>You have <strong>{barracks}</strong> barracks. Each holds {CONFIG.empire.troopCap.footman} footmen, {CONFIG.empire.troopCap.axeman} axemen and {CONFIG.empire.troopCap.knight} knights.</p>
          <ul className="cq-troops">
            {TROOP_KINDS.map((k) => <li key={k}>{e.troops[k]} {nameOf(k, e.troops[k])} · room for {room(e, k)} more (holds {capacity(e, k)})</li>)}
          </ul>
          <p>Army strength: <strong>{might(e.troops)}</strong></p>
          <div className="cq-actions">
            <button type="button" className="cq-btn" disabled={need.count < 1} onClick={() => setPhase({ t: 'needed' })}>How many barracks do my troops need?</button>
          </div>
          {need.count < 1 && <p className="cq-soft">Buy some troops first. Build barracks in Land and buildings.</p>}
        </div>
        <div className="cq-panel">
          <h3>Buy troops</h3>
          <p className="cq-soft">The vault has <strong>{e.vault} gold</strong>.</p>
          {TROOP_KINDS.map((k) => (
            <p key={k}>
              <label>
                {TROOP_NAMES[k].many[0].toUpperCase() + TROOP_NAMES[k].many.slice(1)} ({CONFIG.empire.troopCost[k]} gold each, room for {room(e, k)})
                {' '}<input type="number" min={0} value={mix[k]} aria-label={`How many ${TROOP_NAMES[k].many}`} onChange={(ev) => setMix({ ...mix, [k]: Math.max(0, Math.floor(Number(ev.target.value) || 0)) })} />
              </label>
            </p>
          ))}
          {total > 0 && !mixCheck.ok && <p className="cq-warn">{mixCheck.say}</p>}
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" disabled={total < 1 || !mixCheck.ok} onClick={startBuy}>{total < 1 ? 'Pick some troops' : troopBill(settings, mix.footman, mix.axeman, mix.knight) ? 'Work out the cost' : `Buy for ${bill} gold`}</button>
            {total > 0 && <span className="cq-soft">(about {bill} gold)</span>}
          </div>
        </div>
        <div className="cq-panel">
          <h3>The draft</h3>
          <p>You have <strong>{clan.followers}</strong> followers. The draft asks a share of them to join as footmen (up to {draftMax(e)}%).</p>
          <div className="cq-sides" role="group" aria-label="Draft share">
            {draftPercents.map((p) => (
              <button key={p} type="button" className="cq-btn" aria-pressed={e.draftPercent === p} aria-label={`Draft ${p} percent`} onClick={() => { const next = setDraftTo(session, p); if (next) onChange(next, { type: 'setDraft', percent: p }); }}>{p}%</button>
            ))}
          </div>
          <p className="cq-soft">At {e.draftPercent}%, {draftWanted(clan.followers, e.draftPercent)} of {clan.followers} would join. Followers are used up when you draft: the ones who don't join go home.</p>
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" disabled={clan.followers < 1} onClick={startDraft}>Draft my followers</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="cq-place" aria-label="Barracks and troops">
      <div className="cq-place__head">
        <h2>Barracks and troops</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the empire</button>
      </div>
      {body}
    </section>
  );
}
