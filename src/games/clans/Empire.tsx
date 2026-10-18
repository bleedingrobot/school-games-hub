import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_NAMES, deposit, withdraw, TROOP_NAMES, capacity, countBuildings, draftMax, empireOf, energyLeft as energyPercentLeft, might } from '../../../shared/clans/empire';
import { BUILDING_KINDS, TROOP_KINDS } from '../../../shared/clans/types';
import { putInVault, takeFromVault, whyNot } from './places';
import type { Session, Change } from './session';

/** The Empire home: the vault, the land, the buildings, the troops, today's energy and the draft. */
export function EmpireHome({ session, onChange, onBack, onLand, onBarracks, onRaid }: { session: Session; onChange: Change; onBack: () => void; onLand: () => void; onBarracks: () => void; onRaid: () => void }) {
  const { clan } = session;
  const e = empireOf(clan);
  const [amount, setAmount] = useState(100);
  const [said, setSaid] = useState('');
  const move = (dir: 'in' | 'out') => {
    const next = dir === 'in' ? putInVault(session, amount) : takeFromVault(session, amount);
    if (next) {
      onChange(next, dir === 'in' ? { type: 'deposit', gold: amount } : { type: 'withdraw', gold: amount });
      setSaid(dir === 'in' ? `${amount} gold went into the vault.` : `${amount} gold came out of the vault.`);
    } else {
      const probe = structuredClone(clan);
      setSaid(whyNot(dir === 'in' ? deposit(probe, amount) : withdraw(probe, amount)));
    }
  };
  const built = BUILDING_KINDS.filter((k) => countBuildings(e, k) > 0);
  const army = might(e.troops);
  return (
    <section className="cq-place" aria-label="The Empire">
      <div className="cq-place__head">
        <h2>The Empire</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <div className="cq-empire">
        <div className="cq-panel">
          <h3>Gold</h3>
          <p>Vault: <strong>{e.vault} gold</strong> (this pays for land, buildings and troops, and it is all a raider could take).</p>
          <p>Clan purse: <strong>{clan.gold} gold</strong> (safe from raiders).</p>
          <div className="cq-actions">
            <label>Move <input type="number" min={1} value={amount} aria-label="Gold to move" onChange={(ev) => setAmount(Math.max(0, Math.floor(Number(ev.target.value) || 0)))} /> gold</label>
            <button type="button" className="cq-btn" onClick={() => move('in')}>Put in</button>
            <button type="button" className="cq-btn" onClick={() => move('out')}>Take out</button>
          </div>
          <p role="status" className="cq-soft">{said}</p>
        </div>
        <div className="cq-panel">
          <h3>Land and buildings</h3>
          <p>Wild land: <strong>{e.wild}</strong> {e.wild === 1 ? 'plot' : 'plots'} · Developed plots: <strong>{e.plots.length}</strong> · Empty ones: <strong>{e.plots.filter((p) => !p.building).length}</strong></p>
          <p>{built.length === 0 ? 'No buildings yet.' : built.map((k) => `${BUILDING_NAMES[k]} ${countBuildings(e, k)}`).join(' · ')}</p>
          <p>Workers: <strong>{energyPercentLeft(e)}%</strong> of today's work left.</p>
          <div className="cq-actions"><button type="button" className="cq-btn cq-btn--hot" onClick={onLand}>Land and buildings</button></div>
        </div>
        <div className="cq-panel">
          <h3>Troops</h3>
          <ul className="cq-troops">
            {TROOP_KINDS.map((k) => (
              <li key={k}>{e.troops[k]} {e.troops[k] === 1 ? TROOP_NAMES[k].one : TROOP_NAMES[k].many} <span className="cq-soft">(room for {capacity(e, k)}, costs {CONFIG.empire.troopCost[k]} each)</span></li>
            ))}
          </ul>
          <p>Army strength: <strong>{army}</strong></p>
          <p>The draft: <strong>{e.draftPercent}%</strong> of new followers join (up to {draftMax(e)}%). You have {clan.followers} followers.</p>
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" onClick={onBarracks}>Barracks and troops</button>
            <button type="button" className="cq-btn cq-btn--hot" onClick={onRaid}>Raid and Friendly War</button>
          </div>
        </div>
      </div>
    </section>
  );
}
