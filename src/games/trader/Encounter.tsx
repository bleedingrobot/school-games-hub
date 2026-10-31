/** The things that can happen on a jump: space junk, customs, a friendly trader, and the pirate fight. */
import { GOODS, PIRATE_TIERS, SHIPS } from '../../../shared/trader/config';
import type { Encounter } from '../../../shared/trader/encounter';
import type { Fight } from '../../../shared/trader/fight';
import { laserPower, shieldPower } from '../../../shared/trader/fight';
import type { Trader } from '../../../shared/trader/state';
import { PIRATE_NAMES, goodIcon } from './text';

const cr = (n: number): string => `${n.toLocaleString('en-NZ')} cr`;

export function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'hull' | 'shield' | 'pirate' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="st-meter" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <span className="st-meter__label">{label}</span>
      <span className="st-meter__track"><span className={`st-meter__fill st-meter__fill--${tone} ${pct < 30 ? 'st-meter__fill--low' : ''}`} style={{ width: `${pct}%` }} /></span>
      <span className="st-meter__num">{Math.round(value)}</span>
    </div>
  );
}

export function JunkPanel({ busy, onSteer }: { busy: boolean; onSteer: () => void }) {
  return (
    <section className="st-panel st-panel--small" aria-labelledby="st-junk-h">
      <h2 id="st-junk-h" className="st-h">Space junk ahead! 🪨</h2>
      <p className="st-sub">A field of rocks and old parts is drifting across your path. Steer round it with a quick maths check. If you bump it, you only lose a little hull.</p>
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary st-btn--big" disabled={busy} onClick={onSteer}>Steer through</button>
      </div>
    </section>
  );
}

export function SummaryPanel({ title, lines, button, onDone }: { title: string; lines: string[]; button: string; onDone: () => void }) {
  return (
    <section className="st-panel st-panel--small" aria-labelledby="st-sum-h">
      <h2 id="st-sum-h" className="st-h">{title}</h2>
      {lines.map((l) => (
        <p key={l} className="st-sub">{l}</p>
      ))}
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary st-btn--big" onClick={onDone}>{button}</button>
      </div>
    </section>
  );
}

export function DealPanel({ offer, here, busy, onAccept, onDecline }: {
  offer: Extract<Encounter, { kind: 'trader' }>;
  here: Trader;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = GOODS[offer.good];
  const total = offer.price * offer.qty;
  return (
    <section className="st-panel st-panel--small" aria-labelledby="st-deal-h">
      <h2 id="st-deal-h" className="st-h">A friendly trader! 👋</h2>
      <p className="st-sub">
        {offer.sells ? `They will sell you ${offer.qty} ${name}` : `They will buy ${offer.qty} of your ${name}`} at <strong>{offer.price} each</strong> ({cr(total)} in all).
      </p>
      <p className="st-sub">
        {goodIcon(offer.good)} On this planet {name} {offer.sells ? 'costs' : 'sells for'} {offer.fair}. Is that a good deal for you? You have {cr(here.credits)}.
      </p>
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary" disabled={busy} onClick={onAccept}>Take the deal</button>
        <button type="button" className="st-btn" disabled={busy} onClick={onDecline}>No thanks</button>
      </div>
    </section>
  );
}

export function FightPanel({ t, fight, tier, log, busy, onAct }: {
  t: Trader;
  fight: Fight;
  tier: number;
  log: string[];
  busy: boolean;
  onAct: (action: 'charge' | 'shield' | 'flee') => void;
}) {
  const pirate = PIRATE_TIERS[tier];
  const armed = laserPower(t) > 0;
  const ship = SHIPS[t.ship];
  const shieldMax = shieldPower(t);
  return (
    <section className="st-panel st-panel--fight" aria-labelledby="st-fight-h">
      <h2 id="st-fight-h" className="st-h">{PIRATE_NAMES[tier]} attack! ☠️</h2>
      <div className="st-meters">
        <Meter label="Your hull" value={fight.hull} max={ship.hull} tone="hull" />
        {shieldMax > 0 && <Meter label="Your shields" value={fight.shield} max={shieldMax} tone="shield" />}
        <Meter label={`${pirate.name} hull`} value={fight.pirateHull} max={pirate.hull} tone="pirate" />
      </div>
      <p className="st-soft st-fight-round">Round {Math.min(fight.round + 1, 6)} of 6</p>
      <div className="st-actions st-actions--fight">
        <button type="button" className="st-btn st-btn--primary st-btn--big" disabled={busy || !armed} onClick={() => onAct('charge')}>⚡ Charge the lasers</button>
        <button type="button" className="st-btn st-btn--big" disabled={busy} onClick={() => onAct('shield')}>🛡️ Raise shields</button>
        <button type="button" className="st-btn st-btn--big" disabled={busy} onClick={() => onAct('flee')}>💨 Flee ({ship.fleePct}%)</button>
      </div>
      {!armed && <p className="st-soft st-fight-hint">Your {ship.name} has no lasers yet, so all you can do is raise shields or run. Buy a laser at a shipyard!</p>}
      {armed && <p className="st-soft st-fight-hint">Charging asks a maths check: right is a full-power shot, wrong is a half-power shot.</p>}
      <ul className="st-log" aria-live="polite">
        {log.map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
