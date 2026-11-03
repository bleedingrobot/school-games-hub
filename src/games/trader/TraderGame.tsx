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
import { emptyDesign, type SystemDesign } from '../../../shared/trader/system';
import { type ApiResult, type Loaded, type MoveReply, type TraderApi } from '../../data/trader';
import { useAsk } from './Ask';
import { DealPanel, FightPanel, JunkPanel, SummaryPanel } from './Encounter';
import { laserPower } from '../../../shared/trader/fight';
import { hasShipyard } from '../../../shared/trader/state';
import { allPrices, borrowSure, fightAdvice, loanNotNeeded, nextUpgrade, starterTrade, tradeIdeas, tripSummary, upgradeGain } from './coach/advice';
import { BoltFace, CoachBar, lightUp } from './coach/CoachBar';
import { flightStep } from './coach/flight';
import { FlightBubble, holdLight } from './coach/FlightBubble';
import { HelpPanel } from './coach/HelpPanel';
import { HELP_LEVELS, helpLevel, type HelpLevel } from './coach/level';
import { forSeason, loadCoach, noteHold, saveCoach, type CoachMemory } from './coach/memory';
import { TipCard } from './coach/TipCard';
import { MATHS_TIP, nextTip, TIP_IDS, tipsFor, tipStops, type TipId, type TipMoment } from './coach/tips';
import { nextStep, type CoachTab } from './coach/nextStep';
import { Forge } from './forge/Forge';
import { forgeStep, goalOf, type Goal } from './forge/parts';
import { SeasonChoice } from './forge/SeasonChoice';
import { BankPanel, ShipPanel, TradePanel } from './Panels';
import { loadPrefs, savePrefs, wantsLessMotion } from './prefs';
import type { Scene, SpaceView } from './renderer';
import { SpaceCanvas } from './SpaceCanvas';
import { MapPanel } from './StarMap';
import { COACH_NAME } from './text';
import './trader.css';

type Tab = CoachTab;
type Phase = { k: 'title' } | { k: 'planet' } | { k: 'warp' } | { k: 'after'; title: string; lines: string[]; tip?: 'customs' | 'wrecked' | 'robbed' } | { k: 'moon' };

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
  /** The pupil's working copy of their solar system in the Forge (null: just what the game has saved). */
  const [draft, setDraft] = useState<SystemDesign | null>(null);
  const planOnly = useRef(new WeakSet<Action>());
  const [fightLog, setFightLog] = useState<string[]>([]);
  const [fightBusy, setFightBusy] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [prices, setPrices] = useState<[number, number, number][]>([]);
  const pushes = useMemo(() => schoolPushes(prices), [prices]);
  const view = useRef<SpaceView | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [aimed, setAimed] = useState<number | null>(null);
  const [marketPlan, setMarketPlan] = useState<number[] | null>(null);
  const [coach, setCoach] = useState<CoachMemory>(loadCoach);
  const [bubbleTop, setBubbleTop] = useState(false);
  /** The first-time tip showing (section 4), and which of its stops. */
  const [tip, setTip] = useState<{ id: TipId; stop: number } | null>(null);
  /** A new day's welcome is due (worked out once when the game loads). */
  const [welcome, setWelcome] = useState(false);
  /** Bolt's help panel is open. */
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
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
  const forgeOn = loaded?.settings.forge === true;
  const settings: Settings | null = loaded ? { jumpsPerDay: loaded.settings.jumpsPerDay, loans: loaded.settings.loans, maths: loaded.settings.maths, forge: forgeOn, forgeTyping: loaded.settings.forgeTyping !== false } : null;

  /** The game as the screen shows it: the server's game with the queued quiet moves applied on top. */
  const game: Game | null = useMemo(() => {
    if (!loaded || !galaxy || !settings || !loaded.game) return null;
    if (!queue.length) return loaded.game;
    const r = applyBatch(galaxy, loaded.galaxySeed, loaded.game, queue, settings, noMark);
    return r.ok ? r.game : loaded.game;
  }, [loaded, galaxy, queue]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = game?.t;
  const savedSystem = useMemo(() => game?.system ?? emptyDesign(), [game?.system]);
  const design = draft ?? savedSystem;
  // Bolt's next step, worked out fresh from the game each time it changes.
  const step = useMemo(
    () => (galaxy && t ? (tab === 'forge' ? forgeStep(design, t.credits, t.moon) : nextStep({ galaxy, t, pushes, tab, aimed: tab === 'map' ? aimed : null, loans: loaded?.settings.loans, forge: forgeOn })) : null),
    [galaxy, t, pushes, tab, aimed, loaded?.settings.loans, forgeOn, design],
  );
  const here = galaxy && t ? galaxy.planets[t.location] : null;
  const pending = game?.pending ?? null;
  const jumpsMade = game?.stats.jumps ?? 0;
  // How much Bolt helps (section 6): the pupil's pick, or Lots for the first 30 jumps and Some after.
  const level = helpLevel(coach.level, jumpsMade);
  const bolt = level !== 'off';

  const remember = useCallback((change: (m: CoachMemory) => CoachMemory) => {
    setCoach((m) => {
      const next = change(m);
      saveCoach(next);
      return next;
    });
  }, []);
  // Bolt's memory belongs to this season; and the first load of a new day (after the first) gets a welcome back.
  useEffect(() => {
    if (!loaded) return;
    const m = forSeason(coach, loaded.season);
    if (m.day !== null && loaded.day > m.day) setWelcome(true);
    if (m !== coach || m.day !== loaded.day) remember(() => ({ ...m, day: loaded.day }));
  }, [loaded?.season, loaded?.day]); // eslint-disable-line react-hooks/exhaustive-deps
  // Forget what goods cost once they've all gone (sold, taken by pirates or customs, or lost in a wreck).
  const holdKey = t?.cargo.join(',') ?? '';
  useEffect(() => {
    if (!t || !Object.keys(coach.boughtAt).some((g) => (t.cargo[Number(g)] ?? 0) < 1)) return;
    remember((m) => ({ ...m, boughtAt: noteHold(m.boughtAt, t.cargo, t.cargo, {}, t.location) }));
  }, [holdKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Bolt's sums for the screens' helpers (section 5): the trips from here.
  const allLines = useMemo(() => (galaxy && t ? allPrices(galaxy, t.day, pushes) : []), [galaxy, t?.day, pushes]); // eslint-disable-line react-hooks/exhaustive-deps
  const trips = useMemo(() => (galaxy && t ? tradeIdeas(galaxy, t, allLines) : []), [galaxy, t, allLines]);

  // First Flight: for a pupil who has never jumped (the server's count, so it follows them to any device), unless it was
  // done or skipped on this device or help is Off; or when it is replayed. It begins on the planet, with Bolt's trade
  // picked once so the numbers he quotes stay the same all the way through.
  const flightWanted = coach.flight === null && (coach.run !== null || (jumpsMade === 0 && bolt));
  useEffect(() => {
    if (!flightWanted || coach.run || !galaxy || !t || phase.k !== 'planet') return;
    const trip = starterTrade(galaxy, t, pushes);
    if (trip) remember((m) => ({ ...m, run: { good: trip.good, planet: trip.planet, credits: t.credits, jumps: jumpsMade, acks: [] } }));
  }, [flightWanted, coach.run, galaxy, t, pushes, jumpsMade, phase.k, remember]);
  const flight = useMemo(
    () => (flightWanted && coach.run && galaxy && t
      ? flightStep({ galaxy, t, pushes, tab, aimed: tab === 'map' ? aimed : null, jumps: jumpsMade, plan: tab === 'trade' ? marketPlan : null, run: coach.run })
      : null),
    [flightWanted, coach.run, galaxy, t, pushes, tab, aimed, jumpsMade, marketPlan],
  );
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

  /** A free change to the pupil's system plan: checked now, shown at once and sent with the next request (a newer plan replaces an older one waiting). */
  function planForge(d: SystemDesign) {
    if (!loaded || !galaxy || !settings || !loaded.game) return;
    const action: Action = { type: 'forge', design: d };
    planOnly.current.add(action);
    const last = queue[queue.length - 1];
    const next = [...(last && planOnly.current.has(last) ? queue.slice(0, -1) : queue), action];
    const r = applyBatch(galaxy, loaded.galaxySeed, loaded.game, next, settings, noMark);
    if (!r.ok) return setNote(r.reason);
    setQueue(next);
  }

  /** Pay for a change to the system now. Null when it worked, else the reason it didn't. */
  async function applyForge(target: SystemDesign): Promise<string | null> {
    if (lock.current || !loaded) return 'One moment…';
    lock.current = true;
    setBusy(true);
    const r = await flush([{ type: 'forge', design: target }]);
    setBusy(false);
    lock.current = false;
    if (!r.ok) return r.message;
    setDraft(null);
    return null;
  }

  /** The New Season choice: keep the system, or save a picture and start a new one. */
  async function chooseSeason(pick: 'keep' | 'fresh'): Promise<string | null> {
    // TODO: for 'fresh', take a photo with the viewer (needs last season's design, which the reply does not carry yet) and send it as the picture.
    const r = await api.chooseSeason(pick, undefined);
    if (!r.ok) return r.message;
    setLoaded(r.value);
    setNews(r.value.news ?? []);
    setPrices(r.value.prices ?? []);
    setQueue([]);
    setDraft(null);
    setProblem(null);
    return null;
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
    // What the trade does to the hold, for Bolt's trip summary and the buy prices he keeps (5.6).
    const sold = plan.map((q) => (q < 0 ? -q : 0));
    const boughtGoods = plan.map((q, good) => (q > 0 ? good : -1)).filter((g) => g >= 0);
    const after = (cargo: readonly number[], spent: number, earned: number): string => {
      const summary = galaxy && bolt ? tripSummary(galaxy, t, sold, earned, coach.boughtAt) : null;
      const prices: Record<number, number> = {};
      for (const g of boughtGoods) prices[g] = boughtGoods.length === 1 ? spent / plan[g] : t.market[g].buy;
      remember((m) => ({ ...m, boughtAt: noteHold(m.boughtAt, t.cargo, cargo, prices, t.location) }));
      return summary ? ` ${summary}` : '';
    };
    if (checked && question) {
      let reply: MoveReply | null = null;
      // The first time, Bolt's tip goes in the box's own note line.
      const firstCheck = bolt && !coach.tips.includes('maths');
      if (firstCheck) remember((m) => ({ ...m, tips: [...m.tips, 'maths'] }));
      const note = firstCheck ? `${COACH_NAME}: ${MATHS_TIP}` : 'Get it right for a small discount on this trade.';
      const outcome = await ask(question, 'Sharp trader check', note, async (value, ms) => {
        const r = await flush([{ type: 'trade', plan, ask: { slot: question.slot, value, ms } }]);
        if (!r.ok) throw new Error(r.message);
        reply = r.value;
        const a = r.value.answers[0];
        return { right: a?.right === true, answer: a?.answer ?? 0 };
      });
      if (outcome === 'answered' && reply) {
        const done = reply as MoveReply;
        const summary = after(done.game.t.cargo, done.trade?.spent ?? base.out.spent, done.trade?.earned ?? base.out.earned);
        return `Trade done.${done.trade?.spent ? ` Spent ${cr(done.trade.spent)}.` : ''}${done.trade?.earned ? ` Earned ${cr(done.trade.earned)}.` : ''}${done.trade?.sharp ? ' Sharp trader! ✨ Small discount earned.' : ''}${summary}`;
      }
    }
    const summary = after(base.out.state.cargo, base.out.spent, base.out.earned);
    act({ type: 'trade', plan }, `Trade done.${base.out.spent ? ` Spent ${cr(base.out.spent)}.` : ''}${base.out.earned ? ` Earned ${cr(base.out.earned)}.` : ''}${summary}`);
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
      setPhase({ k: 'after', tip: 'customs', title: 'Customs patrol! 🛃', lines: [`They found banned goods and took ${r.value.customs.taken}. Fine: ${cr(r.value.customs.fine)}.`, 'Check what a planet bans on the star chart before you buy.'] });
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
        ...(next.outcome === 'destroyed' ? { tip: 'wrecked' as const } : next.outcome === 'robbed' ? { tip: 'robbed' as const } : {}),
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
    const offer = game?.pending?.kind === 'deal' ? game.pending.offer : null;
    const before = t?.cargo ?? [];
    const r = settle(await api.deal(loaded.version, take));
    // Count the deal (after 3, Bolt's verdict waits behind "Help me decide"), and keep the price of goods bought from it.
    remember((m) => ({
      ...m,
      deals: m.deals + 1,
      boughtAt: r.ok && offer?.sells && t ? noteHold(m.boughtAt, before, r.value.game.t.cargo, { [offer.good]: offer.price }, t.location) : m.boughtAt,
    }));
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

  const showFlight = !!flight && bolt && phase.k === 'planet' && !pending && !asking;

  /**
   * Start First Flight again (title screen or Bolt's help panel), with Bolt's trade picked now, so it works for a pupil
   * who has jumped before too. Help that was Off goes back to Bolt's pick, so Bolt can fly with them.
   */
  const replayTrip = useMemo(() => (galaxy && t && (coach.flight !== null || jumpsMade > 0) ? starterTrade(galaxy, t, pushes) : null), [galaxy, t, pushes, coach.flight, jumpsMade]);
  const replay = replayTrip && t ? () => {
    remember((m) => ({ ...m, flight: null, level: m.level === 'off' ? null : m.level, run: { good: replayTrip.good, planet: replayTrip.planet, credits: t.credits, jumps: jumpsMade, acks: [] } }));
    setHelpOpen(false);
    helpButton.current?.focus();
    setTab('trade');
    setPhase({ k: 'planet' });
  } : undefined;

  // First-time tips (section 4): the first one that fits now and hasn't been seen shows, and is remembered at once, so it
  // shows only once. It stays until closed or until the moment passes. On the planet they wait for First Flight's bubble.
  const moment: TipMoment = {
    pending: phase.k === 'planet' && pending ? (pending.kind === 'deal' ? 'deal' : pending.kind) : null,
    armed: t ? laserPower(t) > 0 : false,
    after: phase.k === 'after' ? phase.tip ?? null : null,
    planet: phase.k === 'planet' && !pending && !flight,
    tab,
    shipyard: galaxy && t ? hasShipyard(galaxy, t) : false,
    loans: loaded?.settings.loans ?? false,
    hasNews: news.length > 0,
    jumpsLeft: t?.jumpsLeft ?? 1,
    welcome,
  };
  const fitting = tipsFor(moment);
  const fitKey = fitting.join(',');
  const candidate = bolt ? nextTip(moment, coach.tips) : null;
  useEffect(() => {
    if (tip) {
      if (!fitting.includes(tip.id) || !bolt) setTip(null);
      return;
    }
    if (!candidate) return;
    setTip({ id: candidate, stop: 0 });
    if (candidate === 'newday') setWelcome(false);
    else remember((m) => (m.tips.includes(candidate) ? m : { ...m, tips: [...m.tips, candidate] }));
  }, [fitKey, candidate, tip, bolt]); // eslint-disable-line react-hooks/exhaustive-deps
  const stops = tip && galaxy && t && loaded ? tipStops(tip.id, { galaxy, t, jumpsPerDay: loaded.settings.jumpsPerDay, news, forge: forgeOn }) : [];
  const tipStop = tip ? stops[tip.stop] ?? null : null;
  const closeTip = useCallback(() => setTip(null), []);
  const tipCard = tip && tipStop && !asking
    ? <TipCard stop={tipStop} n={tip.stop} of={stops.length} inline={phase.k !== 'planet' || !!pending} onNext={() => setTip({ ...tip, stop: tip.stop + 1 })} onClose={closeTip} />
    : null;

  // Keep First Flight's thing (or the tip's) lit while its step lasts, and move Bolt's bubble to the top if it would cover it.
  const flightTarget = showFlight ? flight?.target : undefined;
  const litTarget = flightTarget ?? (tipCard ? tipStop?.target : undefined);
  useEffect(() => {
    const el = holdLight(root.current, litTarget);
    if (!el || !flightTarget) return setBubbleTop(false);
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const box = el.getBoundingClientRect();
    setBubbleTop(box.bottom > window.innerHeight * 0.62 && box.top > 160);
  }, [litTarget, flightTarget, tab, flight?.id, pending?.kind]);
  useEffect(() => {
    if (tipCard && !flightTarget && litTarget) root.current?.querySelector(`[data-coach="${litTarget}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [litTarget]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Show me": the market first opens the step that has the button (Sell all is on 1, Buy max on 2), then it lights up.
  const [shown, setShown] = useState<{ target: string; n: number } | null>(null);
  const showMe = useCallback((target: string) => setShown((s) => ({ target, n: (s?.n ?? 0) + 1 })), []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    helpButton.current?.focus();
  }, []);
  // The first-time tips already shown, to read again in the help panel ("borrow" is only a "Sure?").
  const tipsAgain = galaxy && t && loaded && helpOpen
    ? coach.tips.filter((id): id is TipId => id !== 'borrow' && TIP_IDS.includes(id as TipId)).map((id) => tipStops(id, { galaxy, t, jumpsPerDay: loaded.settings.jumpsPerDay, news, forge: forgeOn }).map((s) => s.say).join(' '))
    : [];
  useEffect(() => {
    if (shown) lightUp(root.current, shown.target, lessMotion);
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const marketWant = litTarget ?? (shown ? `${shown.target}#${shown.n}` : undefined);

  // Bolt's suggestions on the Ship tab and in the bank (5.2, 5.7).
  const upgrade = galaxy && t ? nextUpgrade(galaxy, t, trips) : null;
  const gain = upgrade && galaxy && t ? upgradeGain(galaxy, t, upgrade, allLines) : null;
  const suggest = upgrade && bolt ? { target: upgrade.target, why: upgrade.kind === 'pod' ? `${gain ?? upgrade.why}` : `${upgrade.why}${gain ? ` ${gain}.` : ''}` } : null;

  const playing = phase.k !== 'title';
  const panelBusy = busy || asking || phase.k === 'warp';
  const tabs: [Tab, string][] = [['trade', 'Trade'], ['ship', 'Ship'], ['bank', 'Bank'], ['map', 'Star chart'], ...(forgeOn ? [['forge', '🌟 Forge'] as [Tab, string]] : [])];
  const label = here && t && galaxy ? `${here.name}, a ${GOVERNMENTS[here.government].name.toLowerCase()} world. Your ${SHIPS[t.ship].name} is in orbit.` : 'Star Trader';

  return (
    <div ref={root} className={`st-root ${lessMotion ? 'st-root--still' : ''}`} data-phase={pending?.kind === 'fight' ? 'fight' : phase.k}>
      <SpaceCanvas ref={view} scene={scene as Scene} lessMotion={lessMotion} simple={prefs.simple} label={label} />
      {problem ? (
        <Problem problem={problem} onRetry={() => void reload()} onExit={onExit} />
      ) : loaded?.seasonChoice ? (
        <SeasonChoice choice={loaded.seasonChoice} bolt={level !== 'off'} onPick={chooseSeason} onExit={onExit} />
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
          firstTime={coach.flight === null && jumpsMade === 0 && bolt}
          onReplay={replay}
          level={level}
          onLevel={(l) => remember((m) => ({ ...m, level: l }))}
          onExit={onExit}
        />
      ) : (
        <>
          <Hud goal={forgeOn ? goalOf(design, t.credits, t.moon) : null} t={t} jumpsPerDay={loaded.settings.jumpsPerDay} planet={`${here.name} ${coordText(here)}`} government={GOVERNMENTS[here.government].name} onExit={onExit} help={helpButton} helpOpen={helpOpen} onHelp={() => (helpOpen ? closeHelp() : setHelpOpen(true))} />
          <div className={`st-main ${phase.k === 'planet' && !pending && (tab === 'map' || tab === 'forge') ? 'st-main--wide' : ''}`}>
            {phase.k === 'planet' && !pending && (
              <>
                <div role="tablist" aria-label="Where to go on the planet" className="st-tabs">
                  {tabs.map(([id, text]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} className={`st-tab ${tab === id ? 'st-tab--on' : ''}`} data-coach={`tab-${id}`} onClick={() => setTab(id)}>
                      {text}
                    </button>
                  ))}
                </div>
                {tipCard ?? (step && !flight && bolt && <CoachBar step={step} onShow={showMe} />)}
                <div className="st-focus" ref={heading} tabIndex={-1} aria-label={`${tabs.find((x) => x[0] === tab)?.[1]} screen`} />
                {tab === 'trade' && <TradePanel galaxy={galaxy} t={t} busy={panelBusy} news={news} pushes={pushes} want={marketWant} level={level} onTrade={doTrade} onPlan={setMarketPlan} />}
                {tab === 'ship' && <ShipPanel galaxy={galaxy} t={t} busy={panelBusy} suggest={suggest} askFirst={level === 'some'} forge={forgeOn} onForge={() => setTab('forge')} onAct={act} onMoon={() => void buyMoon()} />}
                {tab === 'forge' && forgeOn && <Forge saved={savedSystem} draft={design} credits={t.credits} ownsMoon={t.moon} busy={panelBusy} lessMotion={lessMotion} level={level} typing={loaded.settings.forgeTyping !== false} onDraft={setDraft} onPlan={planForge} onApply={applyForge} />}
                {tab === 'bank' && (
                  <BankPanel
                    t={t}
                    busy={panelBusy}
                    loans={settings.loans}
                    onAct={act}
                    sure={!bolt || coach.tips.includes('borrow') ? undefined : (n) => borrowSure(t, n)}
                    onSure={() => remember((m) => (m.tips.includes('borrow') ? m : { ...m, tips: [...m.tips, 'borrow'] }))}
                    askFirst={level === 'some'}
                    bolt={bolt && loanNotNeeded(t, trips) ? "You can already fill your hold with the best buy here. You don't need a loan right now." : null}
                  />
                )}
                {tab === 'map' && <MapPanel galaxy={galaxy} t={t} busy={panelBusy} news={news} pushes={pushes} guide={showFlight ? flight?.guide ?? null : null} level={level} onAim={setAimed} onJump={(d) => void jump(d)} onRefuel={(units) => act({ type: 'refuel', units }, 'Fuel bought.')} />}
                {note && <p className="st-note st-note--float" role="status">{note}</p>}
                {t.jumpsLeft < 1 && <p className="st-note st-note--float">That is all your jumps for today. You can still trade here. Come back tomorrow!</p>}
              </>
            )}
            {phase.k === 'warp' && <div className="st-warp" role="status">Jumping…</div>}
            {(phase.k === 'after' || (phase.k === 'planet' && pending)) && tipCard}
            {phase.k === 'planet' && pending?.kind === 'junk' && <JunkPanel busy={panelBusy} onSteer={() => void steer()} />}
            {phase.k === 'planet' && pending?.kind === 'deal' && <DealPanel key={`${t.jumpNo}`} offer={pending.offer} here={t} busy={panelBusy} level={level} hideVerdict={coach.deals >= 3 || level === 'some'} onAccept={() => void deal(true)} onDecline={() => void deal(false)} />}
            {phase.k === 'planet' && pending?.kind === 'fight' && <FightPanel t={t} fight={pending.fight} tier={pending.tier} advice={bolt ? fightAdvice(t, pending.fight) : null} askFirst={level === 'some'} log={fightLog.length ? fightLog : ['They are coming right at you!']} busy={fightBusy || asking} onAct={(m) => void fightAct(m)} />}
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
          {helpOpen && (
            <HelpPanel
              step={showFlight && flight ? { say: `First Flight, step ${flight.n}: ${flight.say}`, target: flight.target } : phase.k === 'planet' && !pending ? step : null}
              screen={phase.k === 'planet' ? (pending ? (pending.kind === 'deal' ? 'deal' : pending.kind) : tab) : 'other'}
              jumpsPerDay={loaded.settings.jumpsPerDay}
              tips={tipsAgain}
              level={level}
              picked={coach.level}
              onLevel={(l: HelpLevel | null) => remember((m) => ({ ...m, level: l }))}
              onShow={(target) => {
                setHelpOpen(false);
                showMe(target);
              }}
              onReplay={replay}
              onClose={closeHelp}
            />
          )}
          {extra && playing && <div className="st-tools">{extra({ reload: () => void reload() })}</div>}
        </>
      )}
      {showFlight && flight && !helpOpen && (
        <FlightBubble
          step={flight}
          top={bubbleTop}
          onAck={(id) => remember((m) => (id === 'profit' ? { ...m, flight: 'done', run: null } : m.run ? { ...m, run: { ...m.run, acks: [...m.run.acks, id] } } : m))}
          onShow={showMe}
          onSkip={() => remember((m) => ({ ...m, flight: 'skipped', run: null }))}
        />
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

function Hud({ goal, t, jumpsPerDay, planet, government, onExit, help, helpOpen, onHelp }: {
  /** The Forge goal (replaces the moon bar when the Forge is open). */
  goal: Goal | null;
  t: Game['t'];
  jumpsPerDay: number;
  planet: string;
  government: string;
  onExit?: () => void;
  help: React.RefObject<HTMLButtonElement | null>;
  helpOpen: boolean;
  onHelp: () => void;
}) {
  const ship = SHIPS[t.ship];
  return (
    <header className="st-hud" data-coach="hud">
      {onExit && <button type="button" className="st-btn st-btn--small" onClick={onExit}>← Hub</button>}
      <div className="st-hud__place"><strong>{planet}</strong><span className="st-soft">{government}</span></div>
      <div className="st-hud__item" title="Your credits" data-coach="hud-credits"><span aria-hidden="true">💰</span><strong>{t.credits.toLocaleString('en-NZ')}</strong><span className="st-sr">credits</span></div>
      <div className="st-hud__item" title="Fuel: each square you fly uses 1"><span aria-hidden="true">⛽</span><strong>{t.fuel}/{ship.fuelTank}</strong><span className="st-sr">fuel</span></div>
      <div className="st-hud__item" title="Hull: your ship's health"><span aria-hidden="true">🛠️</span><strong>{t.hull}/{ship.hull}</strong><span className="st-sr">hull</span></div>
      <div className="st-hud__item" title="Jumps left today" data-coach="hud-jumps">
        <span aria-hidden="true">🚀</span>
        <span className="st-dots" aria-label={`${t.jumpsLeft} of ${jumpsPerDay} jumps left today`}>
          {Array.from({ length: jumpsPerDay }, (_, i) => (
            <i key={i} className={i < t.jumpsLeft ? 'on' : ''} />
          ))}
        </span>
      </div>
      {goal ? <ForgeGoal goal={goal} /> : <MoonProgress t={t} />}
      {t.loan.owed > 0 && <div className="st-hud__item" title="You owe the bank"><span aria-hidden="true">🏦</span><strong>−{t.loan.owed}</strong></div>}
      {/* Bolt's help button never goes away, whatever the help level. */}
      <button ref={help} type="button" className="st-btn st-btn--small st-hud__help" aria-expanded={helpOpen} aria-label={`${COACH_NAME}'s help`} onClick={onHelp} data-coach="help">
        <BoltFace size={22} /> Help
      </button>
    </header>
  );
}

/** How close the pupil is to the goal: the next piece of their solar system. */
function ForgeGoal({ goal }: { goal: Goal }) {
  return (
    <div className="st-hud__item st-hud__moon stf-goal" title={goal.text}>
      <span aria-hidden="true">🌟</span>
      <span className="stf-goal__text" aria-hidden="true">{goal.text}</span>
      {goal.need > 0 && <span className="st-moonbar" aria-hidden="true"><i style={{ width: `${goal.pct}%` }} /></span>}
      <span className="st-sr">{goal.text}</span>
    </div>
  );
}

/** How close the pupil is to the goal: the moon. */
function MoonProgress({ t }: { t: Game['t'] }) {
  const pct = Math.min(100, Math.floor((t.credits * 100) / MOON_PRICE));
  const say = t.moon ? 'You own a moon!' : `${t.credits.toLocaleString('en-NZ')} of ${MOON_PRICE.toLocaleString('en-NZ')} credits saved for your moon`;
  return (
    <div className="st-hud__item st-hud__moon" title={say}>
      <span aria-hidden="true">🌙</span>
      {t.moon ? <strong>Yours!</strong> : (
        <>
          <span className="st-moonbar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
          <strong>{pct}%</strong>
        </>
      )}
      <span className="st-sr">{say}</span>
    </div>
  );
}

function Title({ heading, prefs, lessMotion, onPrefs, onStart, firstTime, onReplay, level, onLevel, onExit }: {
  heading: React.RefObject<HTMLDivElement | null>;
  prefs: ReturnType<typeof loadPrefs>;
  lessMotion: boolean;
  onPrefs: (p: ReturnType<typeof loadPrefs>) => void;
  onStart: () => void;
  /** A new pupil: Bolt will fly with them. */
  firstTime: boolean;
  onReplay?: () => void;
  level: HelpLevel;
  onLevel: (level: HelpLevel) => void;
  onExit?: () => void;
}) {
  return (
    <div className="st-title">
      <div ref={heading} tabIndex={-1} className="st-title__box">
        <h1 className="st-title__h">Star Trader</h1>
        <p className="st-title__p">Fly a small ship between the planets. Buy cargo where it is cheap and sell it where it is dear. Upgrade your ship, outsmart the pirates, and save up to buy a moon of your very own.</p>
        <div className="st-actions st-actions--centre">
          <button type="button" className="st-btn st-btn--primary st-btn--big" onClick={onStart}>Start trading</button>
          {onReplay && <button type="button" className="st-btn st-btn--big" onClick={onReplay}>Replay First Flight</button>}
          {onExit && <button type="button" className="st-btn st-btn--big" onClick={onExit}>Back to the hub</button>}
        </div>
        {firstTime && <p className="st-soft">New here? {COACH_NAME}, your ship's robot, will fly with you on your first trip.</p>}
        <div className="st-title__opts">
          <label><input type="checkbox" checked={lessMotion} onChange={(e) => onPrefs({ ...prefs, lessMotion: e.target.checked })} /> Less movement</label>
          <label><input type="checkbox" checked={prefs.simple} onChange={(e) => onPrefs({ ...prefs, simple: e.target.checked })} /> Simpler graphics</label>
        </div>
        <fieldset className="st-title__level">
          <legend>{COACH_NAME}'s help</legend>
          {HELP_LEVELS.map((l) => (
            <label key={l.id}><input type="radio" name="st-title-level" value={l.id} checked={level === l.id} onChange={() => onLevel(l.id)} /> {l.name}</label>
          ))}
        </fieldset>
        <p className="st-soft st-title__tiny">The planets and moons have real names and look like the real thing. Where they sit on our map is made up.</p>
      </div>
    </div>
  );
}
