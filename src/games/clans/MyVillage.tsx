import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_BLURBS, BUILDING_NAMES, TROOP_NAMES, buildsLeft, capacity, empireOf, maxLevel, might, room, troopBillOf, upgradeCost } from '../../../shared/clans/empire';
import { landPlot, troopBill } from '../../../shared/clans/moments';
import { TROOP_KINDS, VILLAGE_BUILDINGS, type Troops, type VillageBuilding } from '../../../shared/clans/types';
import { Moment } from './Moment';
import { buildingArt, troopArt } from './art';
import { buyTroopMix, canBuyMix, canUpgradeBuilding, upgradeBuilding } from './places';
import { nextVillageStep, strengthKey } from './nextStep';
import type { Session, Change } from './session';
import { shielded, shieldEnds } from './shield';

type Phase =
  | { t: 'idle' }
  | { t: 'area' | 'fence'; b: VillageBuilding; level: number }
  | { t: 'bill'; mix: Troops }
  | { t: 'done'; text: string };

const none = (): Troops => ({ footman: 0, axeman: 0, knight: 0 });
const nameOf = (kind: keyof Troops, n: number) => (n === 1 ? TROOP_NAMES[kind].one : TROOP_NAMES[kind].many);
const BUILDS = CONFIG.empire.buildsPerDay;

/**
 * My Village: the clan's own buildings (one card each, with an Upgrade button), the troops, and the way to raids.
 * One purse pays for everything. The area and fence questions are asked when you upgrade, but they never stop it.
 */
export function MyVillage({ session, onChange, onBack, onRaid, onClassRaid }: { session: Session; onChange: Change; onBack: () => void; onRaid: () => void; onClassRaid: () => void }) {
  const { clan, settings } = session;
  const e = empireOf(clan);
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const [mix, setMix] = useState<Troops>(none());
  const idle = () => setPhase({ t: 'idle' });
  const step = nextVillageStep(clan);
  const left = buildsLeft(e);
  const army = might(e.troops);
  const total = TROOP_KINDS.reduce((t, k) => t + mix[k], 0);
  const mixCheck = canBuyMix(session, mix);
  const bill = troopBillOf(mix);

  const upgradeNow = (b: VillageBuilding) => {
    const before = empireOf(clan);
    const level = before.levels[b] + 1;
    const cost = upgradeCost(b, level);
    const next = upgradeBuilding(session, b);
    if (!next) {
      const why = canUpgradeBuilding(session, b);
      return setPhase({ t: 'done', text: why.ok ? 'That could not be done right now.' : why.say });
    }
    onChange(next, { type: 'upgrade', building: b });
    const after = empireOf(next.clan);
    const joined = after.troops.footman - before.troops.footman;
    setPhase({
      t: 'done',
      text: `The ${BUILDING_NAMES[b]} is now level ${level}. That cost ${cost} gold. Builds left today: ${buildsLeft(after)} of ${BUILDS}.${joined > 0 ? ` ${joined} ${nameOf('footman', joined)} joined your army.` : ''}`,
    });
  };
  const startUpgrade = (b: VillageBuilding) => {
    const level = e.levels[b] + 1;
    if (landPlot(settings, b, level)) setPhase({ t: 'area', b, level });
    else upgradeNow(b);
  };
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

  let body: React.ReactNode;
  if (phase.t === 'area' || phase.t === 'fence') {
    const q = landPlot(settings, phase.b, phase.level)!;
    const name = BUILDING_NAMES[phase.b];
    body = phase.t === 'area'
      ? <Moment key="area" question={q.area} title={`How big is the ${name} plan?`} note={`Level ${phase.level} needs a space ${q.width} squares by ${q.length} squares.`} doneLabel="Next question" onDone={() => setPhase({ t: 'fence', b: phase.b, level: phase.level })} />
      : <Moment key="fence" question={q.fence} title="How much fence?" note={`The same space, ${q.width} by ${q.length}.`} doneLabel={`Upgrade for ${upgradeCost(phase.b, phase.level)} gold`} onDone={() => upgradeNow(phase.b)} />;
  } else if (phase.t === 'bill') {
    const q = troopBill(settings, phase.mix.footman, phase.mix.axeman, phase.mix.knight)!;
    body = <Moment key="bill" question={q} title="What do these troops cost?" doneLabel={`Buy them for ${troopBillOf(phase.mix)} gold`} onDone={() => buy(phase.mix)} />;
  } else if (phase.t === 'done') {
    body = <div className="cq-panel" role="status"><p className="cq-note">{phase.text}</p><button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={idle}>Carry on</button></div>;
  } else {
    body = (
      <>
        <ul className="cq-village" aria-label="Your buildings">
          {VILLAGE_BUILDINGS.map((b) => {
            const level = e.levels[b];
            const max = maxLevel(b);
            const check = canUpgradeBuilding(session, b);
            const name = BUILDING_NAMES[b];
            const art = buildingArt(b, level);
            const price = level < max ? upgradeCost(b, level + 1) : 0;
            return (
              <li key={b} className="cq-panel cq-bcard">
                {art && <img className={`cq-building-art cq-bcard__art${level === 0 ? ' cq-bcard__art--unbuilt' : ''}`} src={art} alt="" />}
                <div className="cq-bcard__text">
                  <h3>{name}</h3>
                  <p className="cq-bcard__level">Level {level} of {max}{level === 0 && ' (not built yet)'}</p>
                  <p className="cq-soft">{BUILDING_BLURBS[b]}</p>
                  <button
                    type="button" className="cq-btn cq-btn--hot" disabled={!check.ok} aria-describedby={check.ok ? undefined : `why-${b}`}
                    aria-label={level >= max ? `${name} is fully built` : `Upgrade ${name} to level ${level + 1} for ${price} gold`}
                    onClick={() => startUpgrade(b)}
                  >
                    {level >= max ? 'Fully built' : `Upgrade · ${price} gold`}
                  </button>
                  {!check.ok && <small id={`why-${b}`} className={check.why === 'max' ? 'cq-soft' : 'cq-warn'}>{check.say}</small>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="cq-panel" role="group" aria-label="Troops">
          <h3>Troops</h3>
          <p className="cq-soft">Your Barracks (level {e.levels.barracks}) decide how many troops you can have.</p>
          <ul className="cq-troops">
            {TROOP_KINDS.map((k) => (
              <li key={k}>{troopArt(k) && <img className="cq-troop-art" src={troopArt(k)} alt="" />}{e.troops[k]} {nameOf(k, e.troops[k])} <span className="cq-soft">(room for {room(e, k)} more, holds {capacity(e, k)}, costs {CONFIG.empire.troopCost[k]} each)</span></li>
            ))}
          </ul>
          <p>Army strength: <strong>{army}</strong> <span className="cq-soft">{strengthKey()}</span></p>
          <p>You have <strong>{clan.followers}</strong> {clan.followers === 1 ? 'follower' : 'followers'}. New followers join as footmen while there is room.</p>
          <h4>Buy troops</h4>
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
        <div className="cq-actions">
          <button type="button" className="cq-btn cq-btn--hot" onClick={onRaid}>Raid a kingdom / Practice battle</button>
          <button type="button" className="cq-btn cq-btn--hot" onClick={onClassRaid}>Raid a classmate</button>
        </div>
      </>
    );
  }

  return (
    <section className="cq-place" aria-label="My Village">
      <div className="cq-place__head">
        <h2>My Village</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <div className="cq-panel cq-nextstep">
        <p><strong>What to do next:</strong> {step.say}</p>
      </div>
      <p>
        <strong>Builds left today: {left} of {BUILDS}</strong> · Clan purse: <strong>{clan.gold} gold</strong>
      </p>
      {shielded(e.shieldUntil) && <p className="cq-ok" role="status">You are safe from raids until {shieldEnds(e.shieldUntil)}.</p>}
      {body}
    </section>
  );
}
