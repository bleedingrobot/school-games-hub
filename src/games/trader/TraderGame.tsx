/**
 * The whole Star Trader game screen (docs/TRADER-PLAN.md): a full-screen picture of space with the cockpit panels over
 * it. The server keeps the game and works out every move (`api`); the screens run the very same shared rules
 * (`shared/trader/`) to show what is about to happen, queue the quiet moves (fuel, the shipyard, the bank, trades with no
 * maths check), and send them together with the next trade that has a check, the next jump, or when the pupil leaves.
 * Maths questions come from the pupil's own focus, in order, and the server marks each answer.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ASK_EVERY, BIG_TRADE_CREDITS, GOVERNMENTS, MOON_PRICE, PIRATE_TIERS, SHIPS } from '../../../shared/trader/config';
import type { FightAction } from '../../../shared/trader/fight';
import { coordText, makeGalaxy, type Galaxy } from '../../../shared/trader/galaxy';
import type { NewsItem } from '../../../shared/trader/news';
import { schoolPushes } from '../../../shared/trader/priceGuide';
import { runPlan } from '../../../shared/trader/plan';
import { applyBatch, type Action, type Game, type Mark, type Settings } from '../../../shared/trader/server';
import { type ApiResult, type Loaded, type MoveReply, type TraderApi } from '../../data/trader';
import { useAsk } from './Ask';
import { DealPanel, FightPanel, JunkPanel, SummaryPanel } from './Encounter';
import { BankPanel, ShipPanel, TradePanel } from './Panels';
import { loadPrefs, savePrefs, wantsLessMotion } from './prefs';
import type { Scene, SpaceView } from './renderer';
import { SpaceCanvas } from './SpaceCanvas';
import { MapPanel } from './StarMap';
import './trader.css';

type Tab = 'trade' | 'ship' | 'bank' | 'map';
type Phase = { k: 'title' } | { k: 'planet' } | { k: 'warp' } | { k: 'after'; title: string; lines: string[] } | { k: 'moon' };

const cr = (n: number): string => `${n.toLocaleString('en-NZ')} cr`;
const nebulaOf = (planetId: number): number => (planetId * 5 + 2) % 6;
const noMark: Mark = () => null;

/** What the preview's test tools can do (never shown in the real game). */
export interface PreviewHelpers {
  /** Read the game again from the server (after a tool changed it). */
  reload: () => void;
}

export function TraderGame({ api, onExit, extra, startAt = 'title' }: {
  api: TraderApi;
  onExit?: () => void;
  extra?: (h: PreviewHelpers) => ReactNode;
  startAt?: 'title' | 'planet';
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<{ kind: string; message: string } | null>(null);
  const [queue, setQueue] = useState<Action[]>([]);
  const [phase, setPhase] = useState<Phase>({ k: startAt === 'title' ? 'title' : 'planet' });
  const [tab, setTab] = useState<Tab>('trade');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fightLog, setFightLog] = useState<string[]>([]);
  const [fightBusy, setFightBusy] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [prices, setPrices] = useState<[number, number, number][]>([]);
  const pushes = useMemo(() => schoolPushes(prices), [prices]);
  const view = useRef<SpaceView | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const latest = useRef({ loaded, queue });
  latest.current = { loaded, queue };
  const { ask, modal, asking } = useAsk();
  const lessMotion = wantsLessMotion(prefs);

  const reload = useCallback(async () => {
    const r = await api.load();
    if (r.ok) {
      setLoaded(r.value);
      setNews(r.value.news ?? []);
      setPrices(r.value.prices ?? []);
      setQueue([]);
      setProblem(null);
    } else setProblem({ kind: r.kind, message: r.message });
  }, [api]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const galaxy: Galaxy | null = useMemo(() => (loaded ? makeGalaxy(loaded.galaxySeed) : null), [loaded?.galaxySeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const settings: Settings | null = loaded ? { jumpsPerDay: loaded.settings.jumpsPerDay, loans: loaded.settings.loans, maths: loaded.settings.maths } : null;

  /** The game as the screen shows it: the server's game with the queued quiet moves applied on top. */
  const game: Game | null = useMemo(() => {
    if (!loaded || !galaxy || !settings) return null;
    if (!queue.length) return loaded.game;
    const r = applyBatch(galaxy, loaded.galaxySeed, loaded.game, queue, settings, noMark);
    return r.ok ? r.game : loaded.game;
  }, [loaded, galaxy, queue]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = game?.t;
  const here = galaxy && t ? galaxy.planets[t.location] : null;
  const pending = game?.pending ?? null;
  const fightTier = pending?.kind === 'fight' ? pending.tier : -1;
  const scene: Scene | null = useMemo(
    () =>
      here && t
        ? fightTier >= 0
          ? { kind: 'fight', planet: here.name, ship: t.ship, pirate: fightTier, nebula: nebulaOf(here.id), lights: 0, hull: 1 }
          : { kind: 'planet', planet: phase.k === 'moon' ? 'Your moon' : here.name, ship: t.ship, nebula: nebulaOf(here.id), lights: Math.min(1, here.tech / 7) }
        : { kind: 'planet', planet: 'Saturn', ship: 0, nebula: 0, lights: 0.3 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fightTier, here?.name, here?.id, t?.ship, phase.k === 'moon'],
  );

  // Move keyboard focus to each new screen's heading.
  useEffect(() => {
    heading.current?.focus();
  }, [phase.k, tab, pending?.kind]);

  /** Send the queued moves, then `extra` moves after them, as one request. */
  async function flush(extraActions: Action[] = [], options?: { keepalive?: boolean }): Promise<ApiResult<MoveReply>> {
    const { loaded: L, queue: Q } = latest.current;
    if (!L) return { ok: false, kind: 'busy', message: 'The game is still loading.' };
    const r = await api.act(L.version, [...Q, ...extraActions], options);
    return settle(r);
  }

  /** Take the server's answer into the game: its game replaces ours; a stale or refused request puts us right. */
  function settle(r: ApiResult<MoveReply>): ApiResult<MoveReply> {
    if (r.ok) {
      setLoaded((L) => (L ? { ...L, game: r.value.game, version: r.value.version } : L));
      if (r.value.news) setNews(r.value.news);
      if (r.value.prices) setPrices(r.value.prices);
      setQueue([]);
      return r;
    }
    if (r.kind === 'stale') {
      setNote('Your game was changed on another screen, so it has been reloaded.');
      void reload();
    } else if (r.kind === 'refused' && r.game && r.version !== undefined) {
      const { game: g, version } = r;
      setLoaded((L) => (L ? { ...L, game: g, version } : L));
      setQueue([]);
      setNote(r.message);
    } else if (r.kind === 'off') {
      setProblem({ kind: r.kind, message: r.message });
    }
    return r;
  }

  // Quiet moves wait in the queue; send them after a pause, and when the page is hidden or closed.
  useEffect(() => {
    if (!queue.length) return;
    const timer = window.setTimeout(() => void flush(), 30_000);
    return () => window.clearTimeout(timer);
  }, [queue]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === 'hidden' && latest.current.queue.length && !lock.current) void flush([], { keepalive: true });
    };
    document.addEventListener('visibilitychange', away);
    window.addEventListener('pagehide', away);
    return () => {
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('pagehide', away);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** A quiet move: checked now with the shared rules, shown at once, and sent with the next request. */
  function act(action: Action, done: string) {
    if (!loaded || !galaxy || !settings || !game) return;
    const r = applyBatch(galaxy, loaded.galaxySeed, game, [action], settings, noMark);
    if (!r.ok) {
      setNote(r.reason);
      return;
    }
    setQueue((q) => [...q, action]);
    setNote(done);
  }

  /** The next question to ask, if there is one (maths is on and today's list is not used up). */
  const nextQuestion = () => (loaded && loaded.settings.maths ? loaded.questions[loaded.game.asked] ?? null : null);

  async function doTrade(plan: number[]): Promise<string | null> {
    if (!t) return null;
    const base = runPlan(t, plan);
    if (!base.ok) return base.reason;
    const worth = base.out.spent + base.out.earned;
    const question = nextQuestion();
    // A maths check on about 1 trade in 3, and always on a big one. Right = a small discount. Wrong or skipped = nothing lost.
    const checked = question && (worth >= BIG_TRADE_CREDITS || (t.jumpNo + worth) % ASK_EVERY === 0);
    if (checked && question) {
      let reply: MoveReply | null = null;
      const outcome = await ask(question, 'Sharp trader check', 'Get it right for a small discount on this trade.', async (value, ms) => {
        const r = await flush([{ type: 'trade', plan, ask: { slot: question.slot, value, ms } }]);
        if (!r.ok) throw new Error(r.message);
        reply = r.value;
        const a = r.value.answers[0];
        return { right: a?.right === true, answer: a?.answer ?? 0 };
      });
      if (outcome === 'answered' && reply) {
        const done = reply as MoveReply;
        return `Trade done.${done.trade?.spent ? ` Spent ${cr(done.trade.spent)}.` : ''}${done.trade?.earned ? ` Earned ${cr(done.trade.earned)}.` : ''}${done.trade?.sharp ? ' Sharp trader! ✨ Small discount earned.' : ''}`;
      }
    }
    act({ type: 'trade', plan }, `Trade done.${base.out.spent ? ` Spent ${cr(base.out.spent)}.` : ''}${base.out.earned ? ` Earned ${cr(base.out.earned)}.` : ''}`);
    return null;
  }

  async function jump(dest: number) {
    if (lock.current || !loaded) return;
    lock.current = true;
    setBusy(true);
    setNote('');
    setPhase({ k: 'warp' });
    const [r] = await Promise.all([flush([{ type: 'jump', dest }]), view.current?.warp(1500) ?? Promise.resolve()]);
    setTab('trade');
    if (!r.ok) {
      setNote(r.message);
      setPhase({ k: 'planet' });
    } else if (r.value.customs && r.value.customs.taken > 0) {
      setPhase({ k: 'after', title: 'Customs patrol! 🛃', lines: [`They found banned goods and took ${r.value.customs.taken}. Fine: ${cr(r.value.customs.fine)}.`, 'Check what a planet bans on the star chart before you buy.'] });
    } else {
      setPhase({ k: 'planet' });
      if (r.value.fight) setFightLog(['They are coming right at you!']);
    }
    setBusy(false);
    lock.current = false;
  }

  async function steer() {
    if (!loaded || lock.current) return;
    lock.current = true;
    setBusy(true);
    const question = nextQuestion();
    let reply: MoveReply | null = null;
    const finish = (r: ApiResult<MoveReply>) => {
      settle(r);
      return r.ok ? r.value : null;
    };
    if (question) {
      const outcome = await ask(question, 'Steering', 'A right answer gets you through safely.', async (value, ms) => {
        const r = await api.junk(loaded.version, { slot: question.slot, value, ms });
        const v = finish(r);
        if (!v) throw new Error(r.ok ? 'Something went wrong.' : r.message);
        reply = v;
        const a = v.answers[0];
        return { right: a?.right === true, answer: a?.answer ?? 0 };
      });
      if (outcome === 'skipped') reply = finish(await api.junk(loaded.version));
    } else reply = finish(await api.junk(loaded.version));
    const done = reply as MoveReply | null;
    if (done?.junk) {
      setPhase({ k: 'after', title: done.junk.steeredWell ? 'Smooth flying! 🚀' : 'Bump! 🪨', lines: [done.junk.steeredWell ? 'You steered round all of it.' : 'A rock scraped the hull. A little damage, nothing serious.'] });
    }
    setBusy(false);
    lock.current = false;
  }

  async function fightAct(move: FightAction) {
    if (!loaded || !game || game.pending?.kind !== 'fight' || lock.current) return;
    lock.current = true;
    setFightBusy(true);
    const before = game.pending;
    const version = loaded.version;
    let result: ApiResult<MoveReply> | null = null;
    const question = move === 'charge' ? nextQuestion() : null;
    if (question) {
      const outcome = await ask(question, 'Charge the lasers', 'A right answer is a full-power shot. Wrong is half power.', async (value, ms) => {
        const r = await api.fight(version, 'charge', { slot: question.slot, value, ms });
        if (!r.ok) throw new Error(r.message);
        result = r;
        const a = r.value.answers[0];
        return { right: a?.right === true, answer: a?.answer ?? 0 };
      });
      if (outcome === 'skipped') result = await api.fight(version, 'charge');
    } else result = await api.fight(version, move);
    const r = result as ApiResult<MoveReply> | null;
    if (!r || !r.ok || !r.value.fight) {
      if (r && !r.ok) {
        setNote(r.message);
        settle(r);
      }
      setFightBusy(false);
      lock.current = false;
      return;
    }
    const next = r.value.fight.fight;
    const tier = r.value.fight.tier;
    const v = view.current;
    const cur = game.t;
    if (v) {
      if (move === 'shield') v.raiseShields(true);
      const answered = r.value.answers[0];
      const weak = move === 'charge' && question !== null && answered?.right !== true;
      if (move === 'charge') {
        await v.shoot('you', { weak });
        v.setHull('pirate', next.pirateHull / PIRATE_TIERS[tier].hull);
      }
      if (next.outcome === 'won') await v.explode('pirate');
      else if (next.outcome === 'fled') await v.flee();
      else {
        await v.shoot('pirate', { shield: before.fight.shield > 0 || move === 'shield' });
        v.setHull('you', next.hull / SHIPS[cur.ship].hull);
        if (next.outcome === 'destroyed') await v.explode('you');
        else if (next.outcome === 'robbed') await v.robbed();
      }
      v.raiseShields(false);
    }
    settle(r);
    if (!r.value.fight.over) {
      setFightLog(next.log);
    } else {
      const lines = [...next.log];
      if (next.outcome === 'won') lines.push(`You earned a bounty of ${cr(PIRATE_TIERS[tier].bounty)}.`);
      if (next.outcome === 'robbed') lines.push('Some of your cargo is gone, but you still have your ship and your credits.');
      if (next.outcome === 'destroyed') lines.push('You lost your cargo and your ship, but you kept your credits. A free Flea is waiting for you.');
      setPhase({
        k: 'after',
        title: next.outcome === 'won' ? 'You beat the pirates! 🎉' : next.outcome === 'fled' ? 'You got away! 💨' : next.outcome === 'destroyed' ? 'Escape pod! 🛟' : 'The pirates took some cargo',
        lines,
      });
    }
    setFightBusy(false);
    lock.current = false;
  }

  async function deal(take: boolean) {
    if (!loaded || lock.current) return;
    lock.current = true;
    setBusy(true);
    const r = settle(await api.deal(loaded.version, take));
    setNote(r.ok ? (take ? 'Deal done!' : '') : r.message);
    setBusy(false);
    lock.current = false;
  }

  async function buyMoon() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const r = await flush([{ type: 'moon' }]);
    if (r.ok) setPhase({ k: 'moon' });
    else setNote(r.message);
    setBusy(false);
    lock.current = false;
  }

  const playing = phase.k !== 'title';
  const panelBusy = busy || asking || phase.k === 'warp';
  const tabs: [Tab, string][] = [['trade', 'Trade'], ['ship', 'Ship'], ['bank', 'Bank'], ['map', 'Star chart']];
  const label = here && t && galaxy ? `${here.name}, a ${GOVERNMENTS[here.government].name.toLowerCase()} world. Your ${SHIPS[t.ship].name} is in orbit.` : 'Star Trader';

  return (
    <div className="st-root" data-phase={pending?.kind === 'fight' ? 'fight' : phase.k}>
      <SpaceCanvas ref={view} scene={scene as Scene} lessMotion={lessMotion} simple={prefs.simple} label={label} />
      {problem ? (
        <Problem problem={problem} onRetry={() => void reload()} onExit={onExit} />
      ) : !loaded || !game || !t || !here || !galaxy || !settings ? (
        <div className="st-title"><div className="st-title__box" role="status"><h1 className="st-title__h">Star Trader</h1><p className="st-title__p">Getting your ship ready…</p></div></div>
      ) : phase.k === 'title' ? (
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
          <Hud t={t} jumpsPerDay={loaded.settings.jumpsPerDay} planet={`${here.name} ${coordText(here)}`} government={GOVERNMENTS[here.government].name} onExit={onExit} />
          <div className={`st-main ${phase.k === 'planet' && !pending && tab === 'map' ? 'st-main--wide' : ''}`}>
            {phase.k === 'planet' && !pending && (
              <>
                <div role="tablist" aria-label="Where to go on the planet" className="st-tabs">
                  {tabs.map(([id, text]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} className={`st-tab ${tab === id ? 'st-tab--on' : ''}`} onClick={() => { setTab(id); setNote(''); }}>
                      {text}
                    </button>
                  ))}
                </div>
                <div className="st-focus" ref={heading} tabIndex={-1} aria-label={`${tabs.find((x) => x[0] === tab)?.[1]} screen`} />
                {tab === 'trade' && <TradePanel galaxy={galaxy} t={t} busy={panelBusy} news={news} pushes={pushes} onTrade={doTrade} />}
                {tab === 'ship' && <ShipPanel galaxy={galaxy} t={t} busy={panelBusy} onAct={act} onMoon={() => void buyMoon()} />}
                {tab === 'bank' && <BankPanel t={t} busy={panelBusy} loans={settings.loans} onAct={act} />}
                {tab === 'map' && <MapPanel galaxy={galaxy} t={t} busy={panelBusy} news={news} pushes={pushes} onJump={(d) => void jump(d)} onRefuel={(units) => act({ type: 'refuel', units }, 'Fuel bought.')} />}
                {note && <p className="st-note st-note--float" role="status">{note}</p>}
                {t.jumpsLeft < 1 && <p className="st-note st-note--float">That is all your jumps for today. You can still trade here. Come back tomorrow!</p>}
              </>
            )}
            {phase.k === 'warp' && <div className="st-warp" role="status">Jumping…</div>}
            {phase.k === 'planet' && pending?.kind === 'junk' && <JunkPanel busy={panelBusy} onSteer={() => void steer()} />}
            {phase.k === 'planet' && pending?.kind === 'deal' && <DealPanel offer={pending.offer} here={t} busy={panelBusy} onAccept={() => void deal(true)} onDecline={() => void deal(false)} />}
            {phase.k === 'planet' && pending?.kind === 'fight' && <FightPanel t={t} fight={pending.fight} tier={pending.tier} log={fightLog.length ? fightLog : ['They are coming right at you!']} busy={fightBusy || asking} onAct={(m) => void fightAct(m)} />}
            {phase.k === 'after' && <SummaryPanel title={phase.title} lines={phase.lines} button="Carry on" onDone={() => { setTab('trade'); setPhase({ k: 'planet' }); }} />}
            {phase.k === 'moon' && (
              <SummaryPanel
                title="You own a moon! 🌙"
                lines={[`You saved up ${cr(MOON_PRICE)} and bought your very own moon. Congratulations, Star Trader!`, 'Your name goes on the Moon Owners list.']}
                button="Keep trading"
                onDone={() => setPhase({ k: 'planet' })}
              />
            )}
          </div>
          {extra && playing && <div className="st-tools">{extra({ reload: () => void reload() })}</div>}
        </>
      )}
      {modal}
    </div>
  );
}

function Problem({ problem, onRetry, onExit }: { problem: { kind: string; message: string }; onRetry: () => void; onExit?: () => void }) {
  return (
    <div className="st-title">
      <div className="st-title__box" role="alert">
        <h1 className="st-title__h">Star Trader</h1>
        <p className="st-title__p">{problem.message}</p>
        <div className="st-actions st-actions--centre">
          {problem.kind !== 'off' && <button type="button" className="st-btn st-btn--primary st-btn--big" onClick={onRetry}>Try again</button>}
          {onExit && <button type="button" className="st-btn st-btn--big" onClick={onExit}>Back to the hub</button>}
        </div>
      </div>
    </div>
  );
}

function Hud({ t, jumpsPerDay, planet, government, onExit }: { t: Game['t']; jumpsPerDay: number; planet: string; government: string; onExit?: () => void }) {
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
        <span className="st-dots" aria-label={`${t.jumpsLeft} of ${jumpsPerDay} jumps left today`}>
          {Array.from({ length: jumpsPerDay }, (_, i) => (
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
