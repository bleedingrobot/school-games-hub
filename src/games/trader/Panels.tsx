/** The planet's three desks: Trade (the market), Ship (the shipyard) and Bank. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GOODS, LOAN_MAX, LOAN_WEEKLY_PCT, LOAN_WEEK_DAYS, LOAN_REPAY_SHARE_PCT, MAX_PODS, MOON_PRICE, POD_HOLDS, POD_PRICE, SHIELDS, SHIPS, WEAPONS,
} from '../../../shared/trader/config';
import type { Galaxy } from '../../../shared/trader/galaxy';
import { marketFor } from '../../../shared/trader/market';
import {
  borrow, buyMoon, buyPod, buyShield, buyShip, buyWeapon, fuelCost, hasShipyard, holdsOf, repair, refuel, repay, tradeInValue, usedHolds,
  type Result, type Trader,
} from '../../../shared/trader/state';
import { drawShip } from './art/ships';
import { goodIcon } from './text';
import { emptyPlan, runPlan } from './tradePlan';

const cr = (n: number): string => `${n.toLocaleString('en-NZ')} cr`;

/** What goods cost on average across the galaxy today, for "cheap here" and "dear here" tags. */
function averages(galaxy: Galaxy, day: number): number[] {
  const sums = GOODS.map(() => ({ total: 0, n: 0 }));
  for (const p of galaxy.planets) {
    for (const line of marketFor(galaxy, p.id, day)) {
      if (line.sell > 0) {
        sums[line.good].total += line.sell;
        sums[line.good].n += 1;
      }
    }
  }
  return sums.map((s) => (s.n ? s.total / s.n : 0));
}

export function TradePanel({ galaxy, t, busy, onTrade }: {
  galaxy: Galaxy;
  t: Trader;
  busy: boolean;
  /** Carry out the plan (the game may ask a maths check first). Gives a message to show, or null. */
  onTrade: (plan: number[]) => Promise<string | null>;
}) {
  const [plan, setPlan] = useState<number[]>(emptyPlan);
  const [message, setMessage] = useState('');
  const avg = useMemo(() => averages(galaxy, t.day), [galaxy, t.day]);
  // A new planet (or a finished trade) starts a fresh plan.
  useEffect(() => setPlan(emptyPlan()), [t.location, t.day, t.jumpNo]);
  const here = runPlan(t, plan);
  const out = here.ok ? here.out : null;

  function bump(good: number, by: number) {
    const next = [...plan];
    next[good] += by;
    const r = runPlan(t, next);
    if (r.ok) {
      setPlan(next);
      setMessage('');
    } else {
      setMessage(r.reason);
    }
  }
  function setMax(good: number, direction: 1 | -1) {
    const next = [...plan];
    let guard = 0;
    for (;;) {
      const trial = [...next];
      trial[good] += direction;
      if (guard++ > 200 || !runPlan(t, trial).ok) break;
      next[good] = trial[good];
    }
    setPlan(next);
    setMessage('');
  }
  const any = plan.some((q) => q !== 0);

  return (
    <section className="st-panel" aria-labelledby="st-trade-h">
      <h2 id="st-trade-h" className="st-h">Market</h2>
      <p className="st-sub">Pick how many to buy (+) or sell (−), then press Trade. Holds: {usedHolds(t)} of {holdsOf(t)} full.</p>
      <div className="st-table" role="table" aria-label="Goods for sale and for sale to this planet">
        <div className="st-row st-row--head" role="row">
          <span role="columnheader">Good</span>
          <span role="columnheader">You buy at</span>
          <span role="columnheader">You sell at</span>
          <span role="columnheader">In stock</span>
          <span role="columnheader">In hold</span>
          <span role="columnheader">Buy / sell</span>
        </div>
        {t.market.map((line) => {
          const name = GOODS[line.good];
          const q = plan[line.good];
          const can = line.buy > 0 || line.sell > 0;
          const tag = line.sell > 0 && avg[line.good] > 0 ? (line.sell <= avg[line.good] * 0.88 ? 'cheap' : line.sell >= avg[line.good] * 1.12 ? 'dear' : '') : '';
          return (
            <div key={name} className={`st-row ${can ? '' : 'st-row--off'}`} role="row">
              <span role="cell" className="st-good"><span aria-hidden="true">{goodIcon(line.good)}</span> {name}{tag && <em className={`st-tag st-tag--${tag}`}>{tag}</em>}</span>
              <span role="cell" className="st-num" data-label="Buy at">{line.buy > 0 ? line.buy : '—'}</span>
              <span role="cell" className="st-num" data-label="Sell at">{line.sell > 0 ? line.sell : '—'}</span>
              <span role="cell" className="st-num" data-label="Stock">{line.buy > 0 ? line.stock : '—'}</span>
              <span role="cell" className="st-num" data-label="Hold">{t.cargo[line.good]}</span>
              <span role="cell" className="st-step">
                {can ? (
                  <>
                    <button type="button" className="st-btn st-btn--small" onClick={() => setMax(line.good, -1)} aria-label={`Sell all ${name}`} disabled={busy || line.sell <= 0 || t.cargo[line.good] === 0}>All</button>
                    <button type="button" className="st-btn st-btn--round" onClick={() => bump(line.good, -1)} aria-label={`Sell one ${name}`} disabled={busy}>−</button>
                    <output className={`st-qty ${q > 0 ? 'st-qty--buy' : q < 0 ? 'st-qty--sell' : ''}`} aria-label={`${name}: ${q > 0 ? `buying ${q}` : q < 0 ? `selling ${-q}` : 'none'}`}>{q > 0 ? `+${q}` : q}</output>
                    <button type="button" className="st-btn st-btn--round" onClick={() => bump(line.good, 1)} aria-label={`Buy one ${name}`} disabled={busy}>+</button>
                    <button type="button" className="st-btn st-btn--small" onClick={() => setMax(line.good, 1)} aria-label={`Buy as many ${name} as you can`} disabled={busy || line.buy <= 0}>Max</button>
                  </>
                ) : (
                  <span className="st-soft">Not traded here</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="st-total" aria-live="polite">
        {out ? (
          <>
            <span>Spend <strong>{cr(out.spent)}</strong></span>
            <span>Earn <strong>{cr(out.earned)}</strong></span>
            <span>You will have <strong>{cr(out.state.credits)}</strong></span>
          </>
        ) : null}
      </div>
      {message && <p className="st-warn" role="status">{message}</p>}
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary" disabled={busy || !any} onClick={async () => setMessage((await onTrade(plan)) ?? '')}>Trade</button>
        <button type="button" className="st-btn" disabled={busy || !any} onClick={() => setPlan(emptyPlan())}>Clear</button>
      </div>
    </section>
  );
}

export function ShipPicture({ ship, size = 150 }: { ship: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr;
    c.height = (size * 0.6) * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    drawShip(g, { side: 'trader', index: ship }, size * 0.5, size * 0.3, size / 190, { thrust: 0.35, t: 0.2 });
  }, [ship, size]);
  return <canvas ref={ref} className="st-shippic" style={{ width: size, height: size * 0.6 }} aria-hidden="true" />;
}

function stat(label: string, value: string | number) {
  return <li><span className="st-soft">{label}</span> <strong>{value}</strong></li>;
}

export function ShipPanel({ galaxy, t, busy, onChange, onMoon, tell }: {
  galaxy: Galaxy;
  t: Trader;
  busy: boolean;
  onChange: (next: Trader) => void;
  onMoon: (next: Trader) => void;
  tell: (message: string) => void;
}) {
  const yard = hasShipyard(galaxy, t);
  const planet = galaxy.planets[t.location];
  const rule = SHIPS[t.ship];
  function act(r: Result<Trader>, ok: string) {
    if (r.ok) {
      onChange(r.state);
      tell(ok);
    } else tell(r.reason);
  }
  const tank = rule.fuelTank - t.fuel;
  const mend = rule.hull - t.hull;
  return (
    <section className="st-panel" aria-labelledby="st-ship-h">
      <h2 id="st-ship-h" className="st-h">Your ship: {rule.name}</h2>
      <div className="st-shipcard">
        <ShipPicture ship={t.ship} />
        <ul className="st-stats">
          {stat('Holds', `${usedHolds(t)} / ${holdsOf(t)}`)}
          {stat('Fuel', `${t.fuel} / ${rule.fuelTank}`)}
          {stat('Hull', `${t.hull} / ${rule.hull}`)}
          {stat('Lasers', `${t.weapons.length} / ${rule.weaponSlots}`)}
          {stat('Shields', `${t.shields.length} / ${rule.shieldSlots}`)}
          {stat('Trade-in value', cr(tradeInValue(t)))}
        </ul>
      </div>
      <div className="st-actions">
        <button type="button" className="st-btn" disabled={busy || tank < 1} onClick={() => act(refuel(t, tank), 'Tank filled.')}>
          Fill the tank ({tank} fuel, {cr(fuelCost(t.ship, tank))})
        </button>
        <button type="button" className="st-btn" disabled={busy || mend < 1} onClick={() => act(repair(t, mend), 'Hull mended.')}>
          Mend the hull ({mend}, {cr(mend * rule.repairCost)})
        </button>
      </div>
      {!yard ? (
        <p className="st-sub">{planet.name} has no shipyard. Shipyards are on busier, more advanced planets (tech level 4 or more).</p>
      ) : (
        <>
          <h3 className="st-h3">Ships for sale</h3>
          <ul className="st-ships">
            {SHIPS.map((s, i) => {
              if (i === t.ship) return null;
              const cost = s.price - tradeInValue(t);
              const sold = planet.tech >= s.minTech;
              const fits = usedHolds(t) <= s.holds;
              const why = !sold ? `Needs a planet of tech level ${s.minTech}` : !fits ? 'Sell some cargo first' : cost > t.credits ? 'Not enough credits' : '';
              return (
                <li key={s.name} className="st-shipoffer">
                  <ShipPicture ship={i} size={120} />
                  <div>
                    <strong>{s.name}</strong>
                    <div className="st-soft">{s.holds} holds · {s.weaponSlots} laser · {s.shieldSlots} shields · fuel {s.fuelTank}</div>
                    <div>{cost > 0 ? `${cr(cost)} after trading in your ${rule.name}` : `You get ${cr(-cost)} back`}</div>
                  </div>
                  <button type="button" className="st-btn st-btn--primary" disabled={busy || !!why} onClick={() => act(buyShip(galaxy, t, i), `You now fly a ${s.name}!`)} aria-describedby={why ? `why-${i}` : undefined}>
                    Buy
                  </button>
                  {why && <span id={`why-${i}`} className="st-soft st-why">{why}</span>}
                </li>
              );
            })}
          </ul>
          <h3 className="st-h3">Gear</h3>
          <ul className="st-gear">
            {WEAPONS.map((w, i) => {
              const sold = planet.tech >= w.minTech;
              const room = t.weapons.length < rule.weaponSlots;
              const why = !sold ? `Tech level ${w.minTech} needed` : !room ? 'No laser slot free' : w.price > t.credits ? 'Not enough credits' : '';
              return (
                <li key={w.name}>
                  <span>🔫 <strong>{w.name}</strong> (power {w.power}) {cr(w.price)}</span>
                  <button type="button" className="st-btn" disabled={busy || !!why} onClick={() => act(buyWeapon(galaxy, t, i), `${w.name} fitted.`)}>Buy</button>
                  {why && <span className="st-soft st-why">{why}</span>}
                </li>
              );
            })}
            {SHIELDS.map((s, i) => {
              const sold = planet.tech >= s.minTech;
              const room = t.shields.length < rule.shieldSlots;
              const why = !sold ? `Tech level ${s.minTech} needed` : !room ? 'No shield slot free' : s.price > t.credits ? 'Not enough credits' : '';
              return (
                <li key={s.name}>
                  <span>🛡️ <strong>{s.name}</strong> (soaks {s.power}) {cr(s.price)}</span>
                  <button type="button" className="st-btn" disabled={busy || !!why} onClick={() => act(buyShield(galaxy, t, i), `${s.name} fitted.`)}>Buy</button>
                  {why && <span className="st-soft st-why">{why}</span>}
                </li>
              );
            })}
            <li>
              <span>📦 <strong>Cargo pod</strong> (+{POD_HOLDS} holds, up to {MAX_PODS}) {cr(POD_PRICE)}</span>
              <button type="button" className="st-btn" disabled={busy || t.pods >= MAX_PODS || POD_PRICE > t.credits} onClick={() => act(buyPod(galaxy, t), 'Cargo pod fitted.')}>Buy</button>
              {t.pods >= MAX_PODS && <span className="st-soft st-why">Full</span>}
            </li>
          </ul>
          <h3 className="st-h3">Your own moon</h3>
          <div className="st-moon">
            <span aria-hidden="true">🌙</span>
            <div>
              <strong>A moon of your very own: {cr(MOON_PRICE)}</strong>
              <div className="st-soft">{t.credits >= MOON_PRICE ? 'You can afford it!' : `You need ${cr(MOON_PRICE - t.credits)} more.`}</div>
            </div>
            <button type="button" className="st-btn st-btn--primary" disabled={busy || t.credits < MOON_PRICE} onClick={() => {
              const r = buyMoon(galaxy, t);
              if (r.ok) onMoon(r.state);
              else tell(r.reason);
            }}>Buy the moon</button>
          </div>
        </>
      )}
    </section>
  );
}

export function BankPanel({ t, busy, onChange, tell }: { t: Trader; busy: boolean; onChange: (next: Trader) => void; tell: (m: string) => void }) {
  const room = LOAN_MAX - t.loan.principal;
  const interest = Math.floor((t.loan.principal * LOAN_WEEKLY_PCT) / 100);
  const toNext = t.loan.principal > 0 ? LOAN_WEEK_DAYS - ((t.day - t.loan.since) % LOAN_WEEK_DAYS) : 0;
  function act(r: Result<Trader>, ok: string) {
    if (r.ok) {
      onChange(r.state);
      tell(ok);
    } else tell(r.reason);
  }
  return (
    <section className="st-panel" aria-labelledby="st-bank-h">
      <h2 id="st-bank-h" className="st-h">Bank</h2>
      <p className="st-sub">
        Borrow up to {cr(LOAN_MAX)}. Once a week the bank adds {LOAN_WEEKLY_PCT}% of what you borrowed. Part of each sale ({LOAN_REPAY_SHARE_PCT}%) pays it back automatically. Nothing bad happens if it takes a while.
      </p>
      <div className="st-bankcard">
        <div>You have <strong>{cr(t.credits)}</strong></div>
        <div>You owe <strong>{cr(t.loan.owed)}</strong>{t.loan.principal > 0 && <span className="st-soft"> (you borrowed {cr(t.loan.principal)}; {cr(interest)} more in {toNext} day{toNext === 1 ? '' : 's'})</span>}</div>
      </div>
      <div className="st-actions">
        {[100, 200, 300, 500].map((n) => (
          <button key={n} type="button" className="st-btn" disabled={busy || n > room} onClick={() => act(borrow(t, n), `You borrowed ${cr(n)}.`)}>Borrow {n}</button>
        ))}
      </div>
      <div className="st-actions">
        <button type="button" className="st-btn" disabled={busy || t.loan.owed < 1 || t.credits < 1} onClick={() => act(repay(t, 50), 'Paid back.')}>Pay back 50</button>
        <button type="button" className="st-btn" disabled={busy || t.loan.owed < 1 || t.credits < 1} onClick={() => act(repay(t, t.loan.owed), 'Paid back.')}>Pay back all I can</button>
      </div>
    </section>
  );
}
