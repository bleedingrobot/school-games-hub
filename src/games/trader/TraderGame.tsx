/**
 * The whole Star Trader game screen (docs/TRADER-PLAN.md): a full-screen picture of space with the cockpit panels over
 * it. The rules are the shared ones (`shared/trader/`); maths questions come from the pupil's focus through `api`.
 * In this stage (T.2) nothing is saved and nothing goes to a server: the preview runs it all in the browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ASK_EVERY, BIG_TRADE_CREDITS, DISCOUNT_BIG_BP, DISCOUNT_BP, GOVERNMENTS, JUMPS_PER_DAY, MOON_PRICE, PIRATE_TIERS, SHIPS } from '../../../shared/trader/config';
import { acceptDeal, encounterFor, settleCustoms, settleJunk, type Encounter } from '../../../shared/trader/encounter';
import { fightRound, laserPower, settleFight, startFight, type Fight, type FightAction } from '../../../shared/trader/fight';
import { coordText, makeGalaxy } from '../../../shared/trader/galaxy';
import { newTrader, refuel, startDay, travel, type Trader } from '../../../shared/trader/state';
import { useAsk } from './Ask';
import type { TraderApi } from './api';
import { DealPanel, FightPanel, JunkPanel, SummaryPanel } from './Encounter';
import { BankPanel, ShipPanel, TradePanel } from './Panels';
import { loadPrefs, savePrefs, wantsLessMotion } from './prefs';
import type { Scene, SpaceView } from './renderer';
import { SpaceCanvas } from './SpaceCanvas';
import { MapPanel } from './StarMap';
import { runPlan } from './tradePlan';
import './trader.css';

type Tab = 'trade' | 'ship' | 'bank' | 'map';
type Phase =
  | { k: 'title' }
  | { k: 'planet' }
  | { k: 'warp' }
  | { k: 'junk' }
  | { k: 'deal'; offer: Extract<Encounter, { kind: 'trader' }> }
  | { k: 'fight'; fight: Fight; tier: number; log: string[]; busy: boolean }
  | { k: 'after'; title: string; lines: string[] }
  | { k: 'moon' };

const cr = (n: number): string => `${n.toLocaleString('en-NZ')} cr`;
const nebulaOf = (planetId: number): number => (planetId * 5 + 2) % 6;

/** What the preview's test tools can do (never shown in the real game). */
export interface PreviewHelpers {
  t: Trader;
  give: (credits: number) => void;
  nextDay: () => void;
  setShip: (ship: number) => void;
  forcePirates: (tier: number) => void;
  restart: () => void;
}

export function TraderGame({ api, onExit, galaxySeed = 'preview-season', extra, startAt = 'title' }: {
  api: TraderApi;
  onExit?: () => void;
  galaxySeed?: string;
  extra?: (h: PreviewHelpers) => ReactNode;
  startAt?: 'title' | 'planet';
}) {
  const galaxy = useMemo(() => makeGalaxy(galaxySeed), [galaxySeed]);
  const [t, setT] = useState<Trader>(() => newTrader(galaxy, 1));
  const [phase, setPhase] = useState<Phase>({ k: startAt === 'title' ? 'title' : 'planet' });
  const [tab, setTab] = useState<Tab>('trade');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const view = useRef<SpaceView | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const { ask, modal, asking } = useAsk(api);
  const lessMotion = wantsLessMotion(prefs);
  const here = galaxy.planets[t.location];
  const gov = GOVERNMENTS[here.government];

  const fightTier = phase.k === 'fight' ? phase.tier : -1;
  const scene: Scene = useMemo(
    () =>
      fightTier >= 0
        ? { kind: 'fight', planet: here.name, ship: t.ship, pirate: fightTier, nebula: nebulaOf(here.id), lights: 0, hull: 1 }
        : { kind: 'planet', planet: phase.k === 'moon' ? 'Your moon' : here.name, ship: t.ship, nebula: nebulaOf(here.id), lights: Math.min(1, here.tech / 7) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fightTier, here.name, here.id, t.ship, phase.k === 'moon'],
  );

  // Move keyboard focus to each new screen's heading.
  useEffect(() => {
    heading.current?.focus();
  }, [phase.k, tab]);

  const tell = useCallback((m: string) => setNote(m), []);

  async function doTrade(plan: number[]): Promise<string | null> {
    const base = runPlan(t, plan);
    if (!base.ok) return base.reason;
    const worth = base.out.spent + base.out.earned;
    // A maths check on about 1 trade in 3, and always on a big one. Right = a small discount. Wrong or skipped = nothing lost.
    const asked = worth >= BIG_TRADE_CREDITS || (t.jumpNo + worth) % ASK_EVERY === 0;
    let bp = 0;
    let line = '';
    if (asked) {
      const right = await ask('trade', 'Sharp trader check', 'Get it right for a small discount on this trade.');
      if (right === true) {
        bp = worth >= BIG_TRADE_CREDITS ? DISCOUNT_BIG_BP : DISCOUNT_BP;
        line = ' Sharp trader! ✨ Small discount earned.';
      }
    }
    const r = runPlan(t, plan, bp, bp);
    if (!r.ok) return r.reason;
    setT(r.out.state);
    return `Trade done.${r.out.spent ? ` Spent ${cr(r.out.spent)}.` : ''}${r.out.earned ? ` Earned ${cr(r.out.earned)}.` : ''}${line}`;
  }

  async function jump(dest: number) {
    if (busy) return;
    setBusy(true);
    setNote('');
    setPhase({ k: 'warp' });
    await (view.current?.warp(1500) ?? Promise.resolve());
    const r = travel(galaxy, t, dest);
    if (!r.ok) {
      setNote(r.reason);
      setPhase({ k: 'planet' });
      setBusy(false);
      return;
    }
    let next = r.state;
    setT(next);
    const e = encounterFor(galaxy, next, galaxySeed);
    if (e.kind === 'junk') setPhase({ k: 'junk' });
    else if (e.kind === 'customs') {
      const res = settleCustoms(next, e.banned);
      next = res.state;
      setT(next);
      setPhase(
        res.taken > 0
          ? { k: 'after', title: 'Customs patrol! 🛃', lines: [`They found banned goods and took ${res.taken}. Fine: ${cr(res.fine)}.`, 'Check what a planet bans on the star chart before you buy.'] }
          : { k: 'planet' },
      );
    } else if (e.kind === 'pirates') {
      setPhase({ k: 'fight', fight: startFight(next, e.tier, `${galaxySeed}:${next.jumpNo}`), tier: e.tier, log: ['They are coming right at you!'], busy: false });
    } else if (e.kind === 'trader') setPhase({ k: 'deal', offer: e });
    else setPhase({ k: 'planet' });
    setTab('trade');
    setBusy(false);
  }

  async function steer() {
    setBusy(true);
    const right = await ask('junk', 'Steering', 'A right answer gets you through safely.');
    const next = settleJunk(t, right === true);
    setT(next);
    setPhase({ k: 'after', title: right === true ? 'Smooth flying! 🚀' : 'Bump! 🪨', lines: [right === true ? 'You steered round all of it.' : 'A rock scraped the hull. A little damage, nothing serious.'] });
    setBusy(false);
  }

  async function fightAct(action: FightAction) {
    if (phase.k !== 'fight' || phase.busy) return;
    const { fight, tier } = phase;
    setPhase({ ...phase, busy: true });
    let right = false;
    if (action === 'charge') {
      const r = await ask('laser', 'Charge the lasers', 'A right answer is a full-power shot. Wrong is half power.');
      right = r === true;
    }
    const next = fightRound(t, fight, action, right);
    const v = view.current;
    if (v) {
      if (action === 'shield') v.raiseShields(true);
      if (action === 'charge' && laserPower(t) > 0) {
        await v.shoot('you', { weak: !right });
        v.setHull('pirate', next.pirateHull / PIRATE_TIERS[tier].hull);
      }
      if (next.outcome === 'won') await v.explode('pirate');
      else if (next.outcome === 'fled') await v.flee();
      else {
        await v.shoot('pirate', { shield: fight.shield > 0 || action === 'shield' });
        v.setHull('you', next.hull / SHIPS[t.ship].hull);
        if (next.outcome === 'destroyed') await v.explode('you');
        else if (next.outcome === 'robbed') await v.robbed();
      }
      v.raiseShields(false);
    }
    const log = next.log;
    if (next.outcome === 'going') {
      setPhase({ k: 'fight', fight: next, tier, log, busy: false });
      return;
    }
    const settled = settleFight(t, next);
    setT(settled);
    const lines = [...log];
    if (next.outcome === 'won') lines.push(`You earned a bounty of ${cr(PIRATE_TIERS[tier].bounty)}.`);
    if (next.outcome === 'robbed') lines.push('Some of your cargo is gone, but you still have your ship and your credits.');
    if (next.outcome === 'destroyed') lines.push('You lost your cargo and your ship, but you kept your credits. A free Flea is waiting for you.');
    setPhase({
      k: 'after',
      title: next.outcome === 'won' ? 'You beat the pirates! 🎉' : next.outcome === 'fled' ? 'You got away! 💨' : next.outcome === 'destroyed' ? 'Escape pod! 🛟' : 'The pirates took some cargo',
      lines,
    });
  }

  function deal(offer: Extract<Encounter, { kind: 'trader' }>, take: boolean) {
    if (take) {
      const res = acceptDeal(t, offer);
      if (res) {
        setT(res);
        setNote('Deal done!');
      } else setNote('You could not take that deal (not enough money or hold space).');
    }
    setPhase({ k: 'planet' });
  }

  function refuelFor(units: number) {
    const r = refuel(t, units);
    if (r.ok) setT(r.state);
    else setNote(r.reason);
  }

  const helpers: PreviewHelpers = {
    t,
    give: (n) => setT({ ...t, credits: t.credits + n }),
    nextDay: () => setT(startDay(galaxy, t, t.day + 1)),
    setShip: (ship) =>
      // A test ship comes fitted with the best gear that fits, so fights can be tried straight away.
      setT({
        ...t,
        ship,
        hull: SHIPS[ship].hull,
        fuel: SHIPS[ship].fuelTank,
        cargo: t.cargo.map(() => 0),
        pods: 0,
        weapons: Array.from({ length: SHIPS[ship].weaponSlots }, () => 1),
        shields: Array.from({ length: SHIPS[ship].shieldSlots }, () => 0),
      }),
    forcePirates: (tier) => {
      setTab('trade');
      setPhase({ k: 'fight', fight: startFight(t, tier, `${galaxySeed}:forced:${t.jumpNo}`), tier, log: ['They are coming right at you!'], busy: false });
    },
    restart: () => {
      setT(newTrader(galaxy, 1));
      setPhase({ k: 'planet' });
      setTab('trade');
    },
  };

  const playing = phase.k !== 'title';
  const panelBusy = busy || asking || phase.k === 'warp';
  const tabs: [Tab, string][] = [['trade', 'Trade'], ['ship', 'Ship'], ['bank', 'Bank'], ['map', 'Star chart']];

  return (
    <div className="st-root" data-phase={phase.k}>
      <SpaceCanvas
        ref={view}
        scene={scene}
        lessMotion={lessMotion}
        simple={prefs.simple}
        label={`${here.name}, a ${gov.name.toLowerCase()} world. Your ${SHIPS[t.ship].name} is in orbit.`}
      />
      {phase.k === 'title' ? (
        <Title
          heading={heading}
          prefs={prefs}
          lessMotion={lessMotion}
          onPrefs={(p) => {
            setPrefs(p);
            savePrefs(p);
          }}
          onStart={() => setPhase({ k: 'planet' })}
          onExit={onExit}
        />
      ) : (
        <>
          <Hud t={t} planet={`${here.name} ${coordText(here)}`} government={gov.name} onExit={onExit} />
          <div className={`st-main ${phase.k === 'planet' && tab === 'map' ? 'st-main--wide' : ''}`}>
            {phase.k === 'planet' && (
              <>
                <div role="tablist" aria-label="Where to go on the planet" className="st-tabs">
                  {tabs.map(([id, label]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} className={`st-tab ${tab === id ? 'st-tab--on' : ''}`} onClick={() => { setTab(id); setNote(''); }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="st-focus" ref={heading} tabIndex={-1} aria-label={`${tabs.find((x) => x[0] === tab)?.[1]} screen`} />
                {tab === 'trade' && <TradePanel galaxy={galaxy} t={t} busy={panelBusy} onTrade={doTrade} />}
                {tab === 'ship' && <ShipPanel galaxy={galaxy} t={t} busy={panelBusy} onChange={setT} onMoon={(next) => { setT(next); setPhase({ k: 'moon' }); }} tell={tell} />}
                {tab === 'bank' && <BankPanel t={t} busy={panelBusy} onChange={setT} tell={tell} />}
                {tab === 'map' && <MapPanel galaxy={galaxy} t={t} busy={panelBusy} onJump={jump} onRefuel={refuelFor} />}
                {note && <p className="st-note st-note--float" role="status">{note}</p>}
                {t.jumpsLeft < 1 && <p className="st-note st-note--float">That is all your jumps for today. You can still trade here. Come back tomorrow!</p>}
              </>
            )}
            {phase.k === 'warp' && <div className="st-warp" role="status">Jumping…</div>}
            {phase.k === 'junk' && <JunkPanel busy={panelBusy} onSteer={steer} />}
            {phase.k === 'deal' && <DealPanel offer={phase.offer} here={t} busy={panelBusy} onAccept={() => deal(phase.offer, true)} onDecline={() => deal(phase.offer, false)} />}
            {phase.k === 'fight' && <FightPanel t={t} fight={phase.fight} tier={phase.tier} log={phase.log} busy={phase.busy || asking} onAct={fightAct} />}
            {phase.k === 'after' && <SummaryPanel title={phase.title} lines={phase.lines} button="Carry on" onDone={() => { setTab('trade'); setPhase({ k: 'planet' }); }} />}
            {phase.k === 'moon' && (
              <SummaryPanel
                title="You own a moon! 🌙"
                lines={[`You saved up ${cr(MOON_PRICE)} and bought your very own moon. Congratulations, Star Trader!`, 'Your name will go on the Moon Owners list.']}
                button="Keep trading"
                onDone={() => setPhase({ k: 'planet' })}
              />
            )}
          </div>
          {extra && playing && <div className="st-tools">{extra(helpers)}</div>}
        </>
      )}
      {modal}
    </div>
  );
}

function Hud({ t, planet, government, onExit }: { t: Trader; planet: string; government: string; onExit?: () => void }) {
  const ship = SHIPS[t.ship];
  return (
    <header className="st-hud">
      {onExit && <button type="button" className="st-btn st-btn--small" onClick={onExit}>← Hub</button>}
      <div className="st-hud__place"><strong>{planet}</strong><span className="st-soft">{government}</span></div>
      <div className="st-hud__item" title="Your credits"><span aria-hidden="true">💰</span><strong>{t.credits.toLocaleString('en-NZ')}</strong><span className="st-sr">credits</span></div>
      <div className="st-hud__item" title="Fuel"><span aria-hidden="true">⛽</span><strong>{t.fuel}/{ship.fuelTank}</strong><span className="st-sr">fuel</span></div>
      <div className="st-hud__item" title="Hull"><span aria-hidden="true">🛠️</span><strong>{t.hull}/{ship.hull}</strong><span className="st-sr">hull</span></div>
      <div className="st-hud__item" title="Jumps left today">
        <span aria-hidden="true">🚀</span>
        <span className="st-dots" aria-label={`${t.jumpsLeft} of ${JUMPS_PER_DAY} jumps left today`}>
          {Array.from({ length: JUMPS_PER_DAY }, (_, i) => (
            <i key={i} className={i < t.jumpsLeft ? 'on' : ''} />
          ))}
        </span>
      </div>
      {t.loan.owed > 0 && <div className="st-hud__item" title="You owe the bank"><span aria-hidden="true">🏦</span><strong>−{t.loan.owed}</strong></div>}
    </header>
  );
}

function Title({ heading, prefs, lessMotion, onPrefs, onStart, onExit }: {
  heading: React.RefObject<HTMLDivElement | null>;
  prefs: ReturnType<typeof loadPrefs>;
  lessMotion: boolean;
  onPrefs: (p: ReturnType<typeof loadPrefs>) => void;
  onStart: () => void;
  onExit?: () => void;
}) {
  return (
    <div className="st-title">
      <div ref={heading} tabIndex={-1} className="st-title__box">
        <h1 className="st-title__h">Star Trader</h1>
        <p className="st-title__p">Fly a small ship between the planets. Buy cargo where it is cheap and sell it where it is dear. Upgrade your ship, outsmart the pirates, and save up to buy a moon of your very own.</p>
        <div className="st-actions st-actions--centre">
          <button type="button" className="st-btn st-btn--primary st-btn--big" onClick={onStart}>Start trading</button>
          {onExit && <button type="button" className="st-btn st-btn--big" onClick={onExit}>Back to the hub</button>}
        </div>
        <div className="st-title__opts">
          <label><input type="checkbox" checked={lessMotion} onChange={(e) => onPrefs({ ...prefs, lessMotion: e.target.checked })} /> Less movement</label>
          <label><input type="checkbox" checked={prefs.simple} onChange={(e) => onPrefs({ ...prefs, simple: e.target.checked })} /> Simpler graphics</label>
        </div>
        <p className="st-soft st-title__tiny">The planets and moons have real names and look like the real thing. Where they sit on our map is made up.</p>
      </div>
    </div>
  );
}

