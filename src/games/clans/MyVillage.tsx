import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_BLURBS, BUILDING_NAMES, TROOP_NAMES, VILLAGE_TOTAL, buildsLeft, capacity, empireOf, maxLevel, might, room, troopBillOf, upgradeCost, villageComplete, villageLevels } from '../../../shared/clans/empire';
import { TROOP_KINDS, VILLAGE_BUILDINGS, type Troops, type VillageBuilding } from '../../../shared/clans/types';
import { VillageScene, type Cheer } from './VillageScene';
import { buildingArt, troopArt } from './art';
import { buyTroopMix, canBuyMix, canUpgradeBuilding, upgradeBuilding } from './places';
import { nextVillageStep, strengthKey } from './nextStep';
import type { Session, Change } from './session';
import { shielded, shieldEnds } from './shield';

type Phase =
  | { t: 'idle' }
  | { t: 'done'; text: string };

const none = (): Troops => ({ footman: 0, axeman: 0, knight: 0 });
const nameOf = (kind: keyof Troops, n: number) => (n === 1 ? TROOP_NAMES[kind].one : TROOP_NAMES[kind].many);
const BUILDS = CONFIG.empire.buildsPerDay;
/** The building levels this pupil last saw, so a level a raid knocked off shows smoke (V2). Kept on this device only. */
const seenKey = (clanName: string) => `cq-village-seen:${clanName}`;
const readSeen = (clanName: string): Partial<Record<VillageBuilding, number>> => {
  try { return JSON.parse(localStorage.getItem(seenKey(clanName)) ?? '{}') ?? {}; } catch { return {}; }
};

/**
 * My Village: the living village fills the top (with the game's title and the purse on it, and the raid buttons in its
 * bottom corners); tap a building for its card and Upgrade button; the Barracks' card also shows the troops (James, 17 Nov 2026).
 * One purse pays for everything. The area and fence questions are asked when you upgrade, but they never stop it.
 */
export function MyVillage({ session, onChange, onBack, onRaid, onClassRaid, top }: { session: Session; onChange: Change; onBack: () => void; onRaid: () => void; onClassRaid: () => void; top?: React.ReactNode }) {
  const { clan } = session;
  const e = empireOf(clan);
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const [mix, setMix] = useState<Troops>(none());
  const [picked, setPicked] = useState<VillageBuilding | undefined>();
  const [cheer, setCheer] = useState<Cheer | undefined>();
  const [note, setNote] = useState<string | undefined>();
  // The levels seen last time, read once: a building now below that level was knocked down by a raid.
  const [seenBefore] = useState(() => readSeen(clan.name));
  const smoky = new Set(VILLAGE_BUILDINGS.filter((b) => (seenBefore[b] ?? 0) > e.levels[b]));
  const levelsKey = VILLAGE_BUILDINGS.map((b) => e.levels[b]).join(',');
  useEffect(() => {
    try { localStorage.setItem(seenKey(clan.name), JSON.stringify(Object.fromEntries(VILLAGE_BUILDINGS.map((b, i) => [b, Number(levelsKey.split(',')[i])])))); } catch { /* smoke just won't show next time */ }
  }, [clan.name, levelsKey]);
  const idle = () => setPhase({ t: 'idle' });
  const step = nextVillageStep(clan);
  const left = buildsLeft(e);
  const saved = e.buildsSaved ?? 0;
  const today = Math.max(0, BUILDS - e.buildsToday);
  const levels = villageLevels(e);
  const complete = villageComplete(e);
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
    const text = `The ${BUILDING_NAMES[b]} is now level ${level}. That cost ${cost} gold. Builds left: ${buildsLeft(after)}.${joined > 0 ? ` ${joined} ${nameOf('footman', joined)} joined your army.` : ''}`;
    // In the village: back to the scene, where the scaffolding comes down on the new building.
    setPhase({ t: 'idle' });
    setPicked(b);
    setNote(text);
    setCheer((c) => ({ b, level, n: (c?.n ?? 0) + 1 }));
  };
  const buy = (m: Troops) => {
    const next = buyTroopMix(session, m);
    if ('fail' in next) return setPhase({ t: 'done', text: next.fail.say });
    onChange(next, { type: 'buyTroops', mix: m });
    setMix(none());
    setPhase({ t: 'done', text: `Your troops arrived. That cost ${troopBillOf(m)} gold.` });
  };
  const upgradeButton = (b: VillageBuilding) => {
    const level = e.levels[b];
    const max = maxLevel(b);
    const check = canUpgradeBuilding(session, b);
    const name = BUILDING_NAMES[b];
    const price = level < max ? upgradeCost(b, level + 1) : 0;
    return (
      <>
        <button
          type="button" className="cq-btn cq-btn--hot" disabled={!check.ok} aria-describedby={check.ok ? undefined : `why-${b}`}
          aria-label={level >= max ? `${name} is fully built` : `Upgrade ${name} to level ${level + 1} for ${price} gold`}
          onClick={() => upgradeNow(b)}
        >
          {level >= max ? 'Fully built' : `Upgrade · ${price} gold`}
        </button>
        {!check.ok && <small id={`why-${b}`} className={check.why === 'max' ? 'cq-soft' : 'cq-warn'}>{check.say}</small>}
      </>
    );
  };
  const troopsPanel = (
    <div className="cq-vtroops" role="group" aria-label="Troops">
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
        <button type="button" className="cq-btn cq-btn--hot" disabled={total < 1 || !mixCheck.ok} onClick={() => buy(mix)}>{total < 1 ? 'Pick some troops' : `Buy for ${bill} gold`}</button>
        {total > 0 && <span className="cq-soft">(about {bill} gold)</span>}
      </div>
    </div>
  );
  const states = Object.fromEntries(VILLAGE_BUILDINGS.map((x) => [x, { ok: canUpgradeBuilding(session, x).ok }])) as Record<VillageBuilding, { ok: boolean }>;
  const b = picked;
  const pick = (x: VillageBuilding | undefined) => { setNote(undefined); idle(); setPicked(x); };
  // The building's card is under the village: bring it into view when one is tapped.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => { if (picked) card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [picked]);

  return (
    <section className="cq-place" aria-label="My Village">
      <div className="cq-vstage2">
        {top}
        <VillageScene e={e} states={states} picked={b} total={levels} cheer={cheer} smoky={smoky} onPick={(x) => pick(x === picked ? undefined : x)} />
        <button type="button" className="cq-btn cq-btn--hot cq-vstage2__raid cq-vstage2__raid--left" onClick={onRaid}>Raid a kingdom / Practice battle</button>
        <button type="button" className="cq-btn cq-btn--hot cq-vstage2__raid cq-vstage2__raid--right" onClick={onClassRaid}>Raid a classmate</button>
      </div>
      <div className="cq-place__head">
        <h2>My Village</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <div className="cq-panel cq-vpanel" aria-live="polite" ref={card}>
        {phase.t === 'done' && (
          <div role="status"><p className="cq-note">{phase.text}</p><button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={idle}>Carry on</button></div>
        )}
        {note && <p className="cq-ok" role="status">{note}</p>}
        {b ? (
          <div className={`cq-vcard${b === 'barracks' ? ' cq-vcard--barracks' : ''}`}>
            <div className="cq-vcard__info">
              <div className="cq-vpanel__head">
                {buildingArt(b, e.levels[b]) && <img className={`cq-building-art${e.levels[b] === 0 ? ' cq-bcard__art--unbuilt' : ''}`} src={buildingArt(b, e.levels[b])} alt="" />}
                <h3>{BUILDING_NAMES[b]}</h3>
              </div>
              <p className="cq-bcard__level">Level {e.levels[b]} of {maxLevel(b)}{e.levels[b] === 0 && ' (not built yet)'}</p>
              <p className="cq-soft">{BUILDING_BLURBS[b]}</p>
              {upgradeButton(b)}
              <button type="button" className="cq-btn cq-vpanel__close" onClick={() => pick(undefined)}>Close</button>
            </div>
            {b === 'barracks' && troopsPanel}
          </div>
        ) : (
          <>
            {smoky.size > 0 && <p className="cq-warn">Raiders knocked down part of your {[...smoky].map((x) => BUILDING_NAMES[x]).join(', ')}. Upgrade {smoky.size === 1 ? 'it' : 'them'} to rebuild.</p>}
            <p className="cq-soft">Tap a building to see what it does and upgrade it. <span aria-hidden="true">⚒</span> means you can upgrade it now. Your troops live in the Barracks.</p>
          </>
        )}
      </div>
      <div className="cq-panel cq-nextstep">
        <p><strong>What to do next:</strong> {step.say}</p>
      </div>
      <div className={`cq-goal${complete ? ' cq-goal--done' : ''}`}>
        {complete && <p className="cq-ribbon" role="status">Village complete!</p>}
        <p><strong>Village {levels} / {VILLAGE_TOTAL}</strong> <span className="cq-soft">{complete ? 'Every building is at its top level!' : `${VILLAGE_TOTAL - levels} ${VILLAGE_TOTAL - levels === 1 ? 'level' : 'levels'} to go`}</span></p>
        <div className="cq-goal__bar" role="progressbar" aria-label="Village progress" aria-valuemin={0} aria-valuemax={VILLAGE_TOTAL} aria-valuenow={levels} aria-valuetext={`${levels} of ${VILLAGE_TOTAL} levels built`}>
          <span className="cq-goal__fill" style={{ width: `${(levels / VILLAGE_TOTAL) * 100}%` }} />
        </div>
      </div>
      <p>
        <strong>Builds left: {left}{saved > 0 && ` (${today} today + ${saved} saved)`}</strong> · Clan purse: <strong>{clan.gold} gold</strong>
      </p>
      <p className="cq-soft">Builds you don&apos;t use are saved for later, up to {CONFIG.empire.buildsSavedMax}.</p>
      {shielded(e.shieldUntil) && <p className="cq-ok" role="status">You are safe from raids until {shieldEnds(e.shieldUntil)}.</p>}
    </section>
  );
}
