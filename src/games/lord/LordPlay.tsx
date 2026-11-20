/**
 * Dragon Maths (docs/LORD-PLAN.md, stage L.4): the screens, with the school's server keeping the hero.
 *
 * The server is the boss: the forest, a master, a dragon stage and every purchase wait for it, and it hands out
 * each fight's monster and seed. The fight itself is played here, and when it ends the actions are sent so the
 * server can replay them before paying anything. Opening the game (or reloading it, or opening it on another
 * Chromebook) offers a half-finished fight again from the start, with no extra fight used.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { masterFor } from '../../../shared/lord/data';
import { canChallengeMaster, canFaceDragon } from '../../../shared/lord/engine';
import { EVENT_BY_ID } from '../../../shared/lord/events';
import { SIZE_IT_UP_GOLD, sizeItUpBonus } from '../../../shared/lord/maths';
import type { LordAction, LordState } from '../../../shared/lord/server';
import type { FightAction, FightState, Hero, HeroClass } from '../../../shared/lord/types';
import { useAuth } from '../../auth/AuthContext';
import { createServerBackend, type LordBackend, type LordLoad, type SeasonSummary } from '../../data/lord';
import { BigStage, FightScreen, fightScene } from './Fight';
import { shortcutsOn } from './shortcuts';
import { HowToPlay, HowToPlayBody } from './HowToPlay';
import { Bank, ClassPick, Healer, HeroPage, Inn, LookPage, Shop, Training, type PlaceProps, type Reply } from './Places';
import { Arena, HallOfHeroes, NewsPage, Warriors } from './Social';
import { StoryBook, useGameKeys, useStoryOnce } from '../../kit';
import { OPENING } from './stories';
import { SeasonCeremony } from './SeasonCeremony';
import { HeroSprite, MonsterSprite } from './Sprite';
import { withArticle } from './text';
import { Stage } from './Stage';
import { HudContext, Purse } from './Purse';
import { forestScene } from './art';
import { KingdomMap, hasMap } from './KingdomMap';
import { SeasonRoad } from './SeasonRoad';
import { useAsk, type Answer } from './useAsk';
import { HubButtons } from './HubButtons';
import { useClashes } from './useClashes';
import { useAskFromHub, useOpenFromHub } from '../../multiplayer/useAskFromHub';
import { ClashAskBanner } from './LiveArena';
import { AchievementPop } from '../../achievements/AchievementPop';
import './lord.css';
import './big.css';

// The test tools are only ever loaded in the browser-only trial (preview/lord); the live game never opens them.
const Tools = lazy(() => import('./Tools').then((m) => ({ default: m.Tools })));

type FightContext =
  | { kind: 'forest'; sizeUp: Answer | null }
  | { kind: 'master' }
  | { kind: 'dragon'; stage: 1 | 2 | 3 };

type Screen =
  | { name: 'village' }
  | { name: 'shop' | 'healer' | 'bank' | 'inn' | 'training' | 'hero' | 'news' | 'tools' | 'class' | 'look' | 'dragon' | 'arena' | 'warriors' | 'hall' | 'howto' }
  | { name: 'event'; eventId: string }
  | { name: 'encounter' }
  | { name: 'fight'; fight: FightState; actions: FightAction[]; fightId: string; ctx: FightContext };

type Place = 'shop' | 'healer' | 'bank' | 'inn' | 'training' | 'arena' | 'news' | 'warriors' | 'hall' | 'hero';

const PLACES: { key: string; name: Place; label: string; blurb: string }[] = [
  { key: 's', name: 'shop', label: 'Shop', blurb: 'Weapons and armour' },
  { key: 'h', name: 'healer', label: 'Healer', blurb: 'Mend your wounds' },
  { key: 'b', name: 'bank', label: 'Bank', blurb: 'Keep your gold safe' },
  { key: 'i', name: 'inn', label: 'Inn', blurb: 'Songs, riddles and a game' },
  { key: 't', name: 'training', label: 'Training grounds', blurb: 'Challenge your master' },
  { key: 'a', name: 'arena', label: 'The Arena', blurb: 'Fight other heroes, lose nothing' },
  { key: 'n', name: 'news', label: 'Daily news', blurb: 'What happened' },
  { key: 'w', name: 'warriors', label: 'Warriors list', blurb: 'The best heroes this season' },
  { key: 'g', name: 'hall', label: 'Hall of Heroes', blurb: 'Who beat the dragon' },
  { key: 'y', name: 'hero', label: 'Your hero', blurb: 'Stats and gear' },
];

/** What the pupil is told when a request is turned down, in plain words. */
const WHY: Partial<Record<string, string>> = {
  stale: 'Your hero was changed somewhere else (another Chromebook?), so it has been refreshed. Have another look.',
  duplicate: 'That had already happened, so nothing was done twice.',
  'no-fight': 'That fight was already finished.',
  'fight-open': 'You are in the middle of a fight. Finish it first!',
  tampered: 'That fight could not be saved. Nothing is lost: you can play it again from the start.',
  'not-allowed': 'Only teachers can do that.',
  'no-hero': 'Pick a class to begin your adventure.',
  'bad-request': 'Something went wrong with that. Please try again.',
};

/** A fight left alone for a whole day counts as a loss (the soft kind). */
const ABANDONED: Record<'forest' | 'master' | 'dragon', string> = {
  forest: 'The fight you left unfinished counted as a loss after a day, so you dropped the gold you were carrying. Your experience and your bank are safe.',
  master: 'The master fight you left unfinished counted as a loss after a day. Nothing is lost: you are healed.',
  dragon: 'The dragon fight you left unfinished counted as a loss after a day. You woke at the healer, with nothing lost.',
};

const OFFLINE = 'Can’t connect to the school’s server right now. Check the Wi-Fi and try again.';

/** `backend` is for the browser-only trial and the tests; the hub passes `level`, which this game does not use. */
export function LordPlay({ backend: given }: { backend?: LordBackend; level?: unknown }) {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const heroName = profile?.display_name ?? 'You';
  const backend = useMemo(() => given ?? createServerBackend(player), [given, player]);

  const [load, setLoad] = useState<LordLoad | { kind: 'loading' }>({ kind: 'loading' });
  const [state, setState] = useState<LordState | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'village' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [deeds, setDeeds] = useState<string[]>([]);
  // The end-of-season ceremony: my last finished season, and whether it is showing (by itself, or again from the Hall).
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [ceremony, setCeremony] = useState<'first' | 'again' | null>(null);
  const hero = state?.hero ?? null;
  // The game's own request function, for the question boxes (set once `act` is made, below).
  const sendRef = useRef<Parameters<typeof useAsk>[0]['current']>(null);
  const { ask, modal } = useAsk(sendRef);
  // The opening story, once per pupil, as soon as the village has loaded (docs/plans/stories/PLAN.md, ST.2). Skippable.
  const opening = useStoryOnce(OPENING.id, !!state);
  const clashes = useClashes(hero ? backend.clashes : undefined, player);

  // "Yes" on the hub's challenge banner: say yes here as the banner's Fight! would, and go to the arena.
  useAskFromHub(clashes.asks.map((a) => a.clash), (id) => {
    void clashes.send({ action: 'clash-answer', clash: id, accept: true }).then((r) => { if (r.ok) setScreen({ name: 'arena' }); else setNote(r.message); });
  });

  // The Lobby sent a challenge (or "Carry on"): straight to the arena, where the wait or the clash shows.
  useOpenFromHub(!!hero, (what) => what === 'live' && setScreen({ name: 'arena' }));

  const stateRef = useRef<LordState | null>(null);
  stateRef.current = state;
  const busyRef = useRef(false);
  // A clash that paid gold changed the hero on the server: fetch it again, so the next action isn't "out of date".
  const paidClash = clashes.clash && clashes.clash.status === 'done' && (clashes.clash.gold[0] > 0 || clashes.clash.gold[1] > 0) ? clashes.clash.id : null;
  useEffect(() => {
    if (paidClash === null) return;
    void backend.send({ action: 'load', requestId: crypto.randomUUID() }).then((sent) => {
      if (sent.kind === 'reply' && sent.reply.ok) {
        stateRef.current = sent.reply.state;
        setState(sent.reply.state);
      }
    });
  }, [paidClash, backend]);

  const say = (text: string) => setNote(text);
  const addDeed = (line: string) => setDeeds((d) => [line, ...d].slice(0, 12));

  const open = useCallback(async () => {
    setLoad({ kind: 'loading' });
    const result = await backend.load();
    setLoad(result);
    setWaiting(backend.waiting());
    if (result.kind === 'ready') {
      setState(result.state);
      const pouchNote = result.pouch ? `💰 Quest pouch: +${result.pouch.amount.toLocaleString()} gold!` : '';
      if (result.abandoned || pouchNote) setNote([result.abandoned ? ABANDONED[result.abandoned] : '', pouchNote].filter(Boolean).join(' '));
      // A season has ended since I last played: the ceremony opens once. (The hero was saved when the season turned.)
      const ended = await backend.fetchSeasonSummary?.();
      if (ended) {
        setSummary(ended);
        if (!ended.seen) setCeremony('first');
      }
    }
  }, [backend]);

  useEffect(() => {
    void open();
  }, [open]);

  // Back online with a finished fight waiting: send it.
  const retry = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await backend.flush();
      setWaiting(backend.waiting());
      const result = await backend.load();
      if (result.kind === 'ready') {
        setState(result.state);
        setLoad(result);
        if (backend.waiting() === 0) setNote('Your fight has been saved.');
      } else setNote(OFFLINE);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [backend]);
  useEffect(() => {
    const onOnline = () => {
      if (backend.waiting() > 0) void retry();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [backend, retry]);

  /**
   * One request to the server. Returns its reply if it worked; null if it was turned down or could not be sent
   * (the pupil has been told, and the screen carries on from whatever the server says is true now).
   */
  const act = useCallback(
    async (action: LordAction): Promise<Reply | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        const sent = await backend.send({ ...action, requestId: crypto.randomUUID(), version: stateRef.current?.version });
        setWaiting(backend.waiting());
        if (sent.kind === 'offline') {
          setNote(OFFLINE);
          return null;
        }
        if (sent.kind === 'queued') {
          setNote('Can’t connect right now. Your fight is saved on this Chromebook and will be sent as soon as you are back online.');
          return null;
        }
        const reply = sent.reply;
        if (reply.ok) {
          stateRef.current = reply.state;
          setState(reply.state);
          return reply;
        }
        if (reply.state) {
          stateRef.current = reply.state;
          setState(reply.state);
        }
        if (reply.reason === 'closed') {
          setLoad({ kind: 'closed' });
          return null;
        }
        if (reply.reason === 'not-started') {
          setLoad({ kind: 'not-started', message: reply.message ?? '' });
          return null;
        }
        setNote(reply.reason === 'rule' || reply.reason === 'no-turns' ? (reply.message ?? '') : (WHY[reply.reason] ?? 'That did not work. Please try again.'));
        // A fight the server still has open comes back as a fight to carry on with.
        if (reply.state?.openFight && ['fight-open', 'stale', 'duplicate'].includes(reply.reason)) setScreen({ name: 'village' });
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [backend],
  );
  sendRef.current = act;

  // A new day: the server has already given the turns back; just say so.
  const today = state?.today ?? '';
  const lastDay = useRef('');
  useEffect(() => {
    if (!state?.hero) return;
    if (lastDay.current && lastDay.current !== state.today) setNote('A new day dawns. Your health and your turns are back!');
    lastDay.current = state.today;
  }, [state?.today, state?.hero]);

  // A new screen: if the button just pressed has gone, put the keyboard on the new screen's heading, not back at the top of the page.
  useEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body && document.body.contains(active)) return;
    const heading = document.querySelector<HTMLElement>('.lord section h2, .lord-village h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [screen.name, !!hero]);

  // Escape goes back to the village from any place.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !['village', 'fight'].includes(screen.name) && !document.querySelector('.question')) setScreen({ name: 'village' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen.name]);

  if (load.kind === 'loading') {
    return <Frame backend={backend}><p className="lord-lead" role="status">Opening the village gates…</p></Frame>;
  }
  if (load.kind === 'closed') {
    return (
      <Frame backend={backend}>
        <section className="lord-place lord-panel" aria-label="Closed">
          <h2>The village gates are closed</h2>
          <p className="lord-lead">Dragon Maths is switched off for now. Ask your teacher when it will open. Your hero is safe.</p>
        </section>
      </Frame>
    );
  }
  if (load.kind === 'not-started') {
    return (
      <Frame backend={backend}>
        <section className="lord-place lord-panel" aria-label="Not open yet">
          <h2>The season has not started yet</h2>
          <p className="lord-lead">{load.message}</p>
        </section>
      </Frame>
    );
  }
  if (load.kind === 'offline' || !state) {
    return (
      <Frame backend={backend}>
        <section className="lord-place lord-panel" aria-label="Cannot connect">
          <h2>Can’t connect</h2>
          <p className="lord-lead">{OFFLINE}</p>
          {waiting > 0 && <p className="lord-note">Your last fight is saved on this Chromebook and will be sent as soon as you are back online.</p>}
          <button type="button" className="lord-btn lord-btn--hot" data-key="enter" autoFocus onClick={() => void open()}>Try again</button>
        </section>
      </Frame>
    );
  }

  if (ceremony && summary) {
    const first = ceremony === 'first';
    return (
      <Frame backend={backend} state={state} hero={hero ?? undefined} bare>
        <SeasonCeremony
          summary={summary} look={hero?.look} canPick={first && state.classOpen}
          onDone={(next) => {
            if (first) void backend.markSeasonSeen?.(summary.season);
            setSummary({ ...summary, seen: true });
            setCeremony(null);
            setScreen(first && next === 'class' ? { name: 'class' } : first ? { name: 'village' } : { name: 'hall' });
          }}
        />
      </Frame>
    );
  }

  if (!hero || screen.name === 'class') {
    const choosing = !hero;
    return (
      <Frame backend={backend} state={state}>
        <ClassPick
          onPick={async (c: HeroClass, look: string) => {
            const reply = await act({ action: 'start-hero', heroClass: c, look });
            if (reply) {
              setScreen({ name: 'village' });
              if (choosing) addDeed('Your adventure begins!');
            }
          }}
        />
        <details className="lord-fold">
          <summary>How to play</summary>
          <HowToPlayBody />
        </details>
        {!choosing && <button type="button" className="lord-btn" onClick={() => setScreen({ name: 'village' })}>Keep my class</button>}
        {busy && <p className="lord-soft" role="status">One moment…</p>}
      </Frame>
    );
  }

  const toVillage = () => setScreen({ name: 'village' });
  const placeProps: PlaceProps = { state, hero, act, ask, say, note, back: toVillage, busy };

  // ---------------------------------------------------------------- forest

  /** Plays the fight the server handed out, from its start. */
  function playFight(fight: NonNullable<LordState['openFight']>, sizeUp: Answer | null = null) {
    const ctx: FightContext = fight.kind === 'forest' ? { kind: 'forest', sizeUp } : fight.kind === 'master' ? { kind: 'master' } : { kind: 'dragon', stage: fight.stage ?? 1 };
    const bonus = sizeUp ? (sizeUp.correct ? 1.5 : 1) : 1;
    const start = fight.kind === 'forest' && bonus !== 1 ? { ...fight.start, firstHitBonus: bonus } : fight.start;
    setScreen({ name: 'fight', fight: start, actions: [], fightId: fight.id, ctx });
  }

  async function goForest() {
    const s = stateRef.current!;
    if (s.openFight) {
      // Carry on with the fight the server is holding (a reload, or another Chromebook).
      setNote('');
      return s.openFight.kind === 'forest' ? setScreen({ name: 'encounter' }) : playFight(s.openFight);
    }
    if (s.pendingEvent) return setScreen({ name: 'event', eventId: s.pendingEvent });
    if (s.hero!.forestLeft <= 0 && !s.unlimited) return say('You have used all your forest fights today. Come back tomorrow, or visit the village.');
    const reply = await act({ action: 'forest' });
    if (!reply) return;
    const r = reply.result as { kind: 'fight' | 'event'; eventId?: string };
    setNote('');
    setScreen(r.kind === 'event' ? { name: 'event', eventId: r.eventId! } : { name: 'encounter' });
  }

  async function beginFight(sizeUp: boolean) {
    const fight = stateRef.current?.openFight;
    if (!fight) return toVillage();
    let answer: Answer | null = null;
    if (sizeUp) {
      answer = await ask('size-it-up', { title: `Size up the ${fight.start.monster.name}`, note: `A right answer finds its weak spot: your first hit is ×${sizeItUpBonus('right')}, and you get ${Math.round(SIZE_IT_UP_GOLD * 100)}% more gold if you win.`, closeLabel: 'Skip, just fight' });
    }
    playFight(fight, answer);
  }

  async function resolveEvent(eventId: string) {
    const event = EVENT_BY_ID[eventId];
    if (!event) return toVillage();
    let proof: Answer | null = null;
    let walkOn = false;
    if (event.maths) {
      proof = await ask('treasure', { title: event.title, note: event.text, closeLabel: 'Walk on' });
      walkOn = proof === null;
    }
    const reply = await act({ action: 'event', proof: proof?.proof ?? null, walkOn });
    if (!reply) return;
    const right = (reply.result as { right: boolean }).right;
    addDeed(`${event.title}: ${event.text.split('.')[0]}.`);
    if (event.maths) say(walkOn ? 'You walk on. Maybe next time!' : right ? 'You solved it!' : 'Not this time, but you know the answer now.');
    else say(eventSummary(event));
    toVillage();
  }

  // ---------------------------------------------------------------- masters and the dragon

  async function challengeMaster() {
    const check = canChallengeMaster(hero!);
    if (!check.ok) return say(check.reason ?? '');
    const master = masterFor(hero!.level)!;
    const trial: (Answer['proof'] | null)[] = [];
    for (let i = 1; i <= 3; i++) {
      const asked = await ask('master-trial', {
        title: `${master.name}’s trial`,
        note: `Question ${i} of 3. Each right answer adds a little strength if you win.`,
        closeLabel: 'Skip this one',
        slot: i - 1,
      });
      trial.push(asked?.proof ?? null);
    }
    const reply = await act({ action: 'master-start', trial });
    if (!reply) return;
    setNote('');
    playFight(reply.state.openFight!);
  }

  async function beginDragonStage(stage: 1 | 2 | 3) {
    const asked = await ask('dragon-trial', {
      title: `The dragon’s riddle ${stage} of 3`,
      note: 'Right answers give you a shield and a heavy first hit. Wrong answers cost you nothing, and the fight still goes on.',
      closeLabel: 'Skip',
    });
    const reply = await act({ action: 'dragon-stage', stage, riddle: asked?.proof ?? null });
    if (!reply) return toVillage();
    setNote('');
    playFight(reply.state.openFight!);
  }

  async function finishFight(fight: FightState, actions: FightAction[], fightId: string, ctx: FightContext) {
    const name = fight.monster.name;
    if (ctx.kind === 'forest') {
      const reply = await act({ action: 'fight-finish', fightId, actions, sizeUp: ctx.sizeUp?.proof ?? null });
      if (!reply) return finishFailed();
      const r = reply.result as { outcome: string; readyForMaster: boolean };
      if (r.outcome === 'won') {
        addDeed(`You beat the ${name}.`);
        say(r.readyForMaster ? `You beat the ${name}! You have enough experience to challenge your master.` : `You beat the ${name}!`);
      } else if (r.outcome === 'lost') {
        addDeed(`${withArticle(name).replace(/^a/, 'A')} flattened you.`);
        say('You wake up at the healer’s hut. You dropped the gold you were carrying, but your experience and your bank are safe.');
      } else say('You got away safely.');
      return toVillage();
    }
    if (ctx.kind === 'master') {
      const master = masterFor(hero!.level)!;
      const reply = await act({ action: 'master-finish', fightId, actions });
      if (!reply) return finishFailed();
      const r = reply.result as { outcome: string; level: number; bonusStrength: number; trial: string[] };
      if (r.outcome === 'won') {
        addDeed(`You beat ${master.name} and reached level ${r.level}!`);
        say(`You beat ${master.name}! You are level ${r.level} and you feel stronger.${r.trial.includes('right') ? ' Your right answers added extra strength.' : ''}`);
      } else say(`${master.name} won this time. Nothing is lost: you are healed and can try again tomorrow.`);
      return toVillage();
    }
    const reply = await act({ action: 'dragon-finish', fightId, actions });
    if (!reply) return finishFailed();
    const r = reply.result as { outcome: string; stage: number; finished: boolean; stars: number };
    if (r.outcome !== 'won') {
      addDeed('The Red Dragon sent you home.');
      say('The dragon was too strong today. You wake at the healer’s hut. Nothing is lost. Try again tomorrow!');
      return toVillage();
    }
    if (!r.finished) return void beginDragonStage((r.stage + 1) as 2 | 3);
    addDeed(`You beat the Red Dragon! That is star number ${r.stars}.`);
    say('You beat the Red Dragon! The village treasure, food and light are back. Your hero starts again at level 1, with a gold star.');
    toVillage();
  }

  /** The finish could not be saved. If it is waiting to be sent the village says so; otherwise the fight is offered again. */
  function finishFailed() {
    toVillage();
  }

  function onFightChange(next: FightState, action: FightAction) {
    setScreen((s) => (s.name === 'fight' ? { ...s, fight: next, actions: [...s.actions, action] } : s));
  }

  // ---------------------------------------------------------------- screens

  let body: ReactNode;
  switch (screen.name) {
    case 'shop': body = <Shop {...placeProps} />; break;
    case 'healer': body = <Healer {...placeProps} />; break;
    case 'bank': body = <Bank {...placeProps} />; break;
    case 'inn': body = <Inn {...placeProps} today={today} />; break;
    case 'training': body = <Training hero={hero} back={toVillage} onChallenge={() => void challengeMaster()} onDragon={() => setScreen({ name: 'dragon' })} />; break;
    case 'hero': body = <HeroPage hero={hero} stats={state.stats} back={toVillage} onLook={() => setScreen({ name: 'look' })} />; break;
    case 'look': body = <LookPage hero={hero} act={act} back={toVillage} busy={busy} />; break;
    case 'arena': body = <Arena unlimited={!!state.unlimited} hero={hero} act={act} say={say} back={toVillage} busy={busy} ask={ask} clashes={clashes} me={player} />; break;
    case 'news': body = <NewsPage backend={backend} deeds={deeds} today={today} back={toVillage} />; break;
    case 'warriors': body = <Warriors backend={backend} back={toVillage} />; break;
    case 'howto': body = <HowToPlay back={toVillage} />; break;
    case 'hall': body = <HallOfHeroes backend={backend} back={toVillage} ceremony={summary ? { season: summary.season, watch: () => setCeremony('again') } : undefined} />; break;
    case 'tools':
      body = backend.trial ? (
        <Suspense fallback={<p className="lord-soft">Loading…</p>}>
          <Tools
            state={state} act={act} busy={busy} close={toVillage}
            showEvent={(eventId) => setScreen({ name: 'event', eventId })}
            resetAll={() => void act({ action: 'tools', tool: 'reset' }).then((r) => r && setScreen({ name: 'class' }))}
          />
        </Suspense>
      ) : null;
      break;
    case 'event': {
      const event = EVENT_BY_ID[screen.eventId];
      body = event ? (
        <BigStage scene={forestScene(hero.level)} label={event.title} className="lord-encounter lord-event">
          <div className="lord-big__title">
            <h2>{event.title}</h2>
            <p>{event.text}</p>
          </div>
          <div className="lord-big__floor">
            <div className="lord-big__fig lord-big__fig--me"><div className="lord-big__body"><HeroSprite heroClass={hero.heroClass} look={hero.look} scale={8} label="" /></div></div>
          </div>
          <div className="lord-big__bar">
            <button type="button" className="lord-btn lord-btn--hot lord-btn--big" data-key="enter" autoFocus disabled={busy} onClick={() => void resolveEvent(event.id)}>
              {event.maths ? 'Have a go' : 'Continue'}
            </button>
          </div>
        </BigStage>
      ) : null;
      break;
    }
    case 'encounter': {
      const fight = state.openFight;
      if (!fight) {
        body = null;
        break;
      }
      const sizeUp = fight.sizeUp && fight.kind === 'forest';
      const name = withArticle(fight.start.monster.name).replace(/^a/, 'A');
      body = (
        <BigStage scene={fightScene(fight.start, forestScene)} label="A monster appears" className="lord-encounter">
          <div className="lord-big__title">
            <h2>{name} appears!</h2>
            <p>{fight.start.monster.intro}</p>
          </div>
          <div className="lord-big__floor">
            <div className="lord-big__fig lord-big__fig--me"><div className="lord-big__body"><HeroSprite heroClass={hero.heroClass} look={hero.look} scale={8} label="" /></div></div>
            <div className="lord-big__fig lord-big__fig--foe"><div className="lord-big__body lord-enter"><MonsterSprite monster={fight.start.monster} scale={10} /></div></div>
          </div>
          <div className="lord-big__bar" role="group" aria-label="What will you do?">
            {sizeUp && (
              <button type="button" className="lord-btn lord-btn--hot lord-btn--big" data-key="enter" autoFocus onClick={() => void beginFight(true)}>
                Size it up <small>first hit ×{sizeItUpBonus('right')}, +{Math.round(SIZE_IT_UP_GOLD * 100)}% gold</small>
              </button>
            )}
            <button type="button" className={`lord-btn lord-btn--big ${sizeUp ? 'lord-btn--glass' : 'lord-btn--hot'}`} data-key={sizeUp ? undefined : 'enter'} autoFocus={!sizeUp} onClick={() => void beginFight(false)}>Fight!</button>
          </div>
        </BigStage>
      );
      break;
    }
    case 'fight': {
      const { fight, actions, fightId, ctx } = screen;
      body = (
        <FightScreen
          look={hero.look} scene={fightScene(fight, forestScene)} dragonStage={ctx.kind === 'dragon' ? ctx.stage : undefined}
          key={fightId + (ctx.kind === 'dragon' ? ctx.stage : '')} fight={fight} heroName={heroName}
          onChange={onFightChange} onContinue={() => void finishFight(fight, actions, fightId, ctx)}
        />
      );
      break;
    }
    case 'dragon': {
      const next = state.dragon?.next ?? 1;
      const triedToday = state.dragonTried && next === 1;
      body = (
        <BigStage scene="lair" label="The Red Dragon" className="lord-encounter lord-lair">
          <div className="lord-big__title">
            <h2>The Red Dragon’s lair</h2>
            <p>{triedToday ? 'You have already faced the dragon today. Come back tomorrow!' : 'Three fights, with a riddle before each. You can’t run. If it goes badly, you lose nothing but today’s try.'}</p>
          </div>
          <div className="lord-big__floor">
            <div className="lord-big__fig lord-big__fig--me"><div className="lord-big__body"><HeroSprite heroClass={hero.heroClass} look={hero.look} scale={8} label="" /></div></div>
            <div className="lord-big__fig lord-big__fig--foe lord-big__fig--dragon"><div className="lord-big__body lord-breathe"><MonsterSprite monster={{ id: 'dragon-1', name: 'Scorchtail, the Red Dragon', level: 13 }} scale={13} /></div></div>
          </div>
          <div className="lord-big__bar">
            <button type="button" className="lord-btn lord-btn--hot lord-btn--big" data-key="enter" autoFocus={!triedToday} disabled={busy || triedToday} onClick={() => void beginDragonStage(next)}>
              {next === 1 ? 'Go in' : `Carry on: fight ${next} of 3`}
            </button>
            <button type="button" className="lord-btn lord-btn--glass lord-btn--big" autoFocus={triedToday} onClick={toVillage}>Not yet</button>
          </div>
        </BigStage>
      );
      break;
    }
    default:
      body = (
        <Village
          state={state} hero={hero} note={note} waiting={waiting} busy={busy} onRetry={() => void retry()}
          onPlace={(n) => { setNote(''); setScreen({ name: n } as Screen); }} onForest={() => void goForest()}
          onDragon={() => setScreen({ name: 'dragon' })} onClass={() => setScreen({ name: 'class' })} onLook={() => setScreen({ name: 'look' })} tools={backend.trial} trial={backend.trial} road={!backend.trial || !!backend.seasonDated} fetchFirstFive={backend.fetchFirstFive}
        />
      );
  }

  const keysOn = screen.name === 'village' && !opening.open;
  return (
    <Frame backend={backend} state={state} hero={hero} bare={['fight', 'encounter', 'event', 'dragon', 'arena', 'news', 'warriors', 'hall', 'bank', 'shop', 'healer', 'inn', 'training', 'hero', 'look', 'howto'].includes(screen.name) || (screen.name === 'village' && hasMap())}>
      {/* A finished fight adds a deed: then any new Dragon Maths achievement pops up. */}
      <AchievementPop games={['dragon-maths']} watch={deeds.length ? deeds : null} off={backend.trial} />
      {keysOn && <VillageKeys onKey={(k) => {
        if (busyRef.current) return;
        if (k === 'f') void goForest();
        else if (k === 'd' && (canFaceDragon(hero) || state.dragon)) setScreen({ name: 'dragon' });
        else if (k === '?' || k === '/') setScreen({ name: 'howto' });
        else if (k === 'x' && backend.trial) setScreen({ name: 'tools' });
        else { const p = PLACES.find((x) => x.key === k); if (p) { setNote(''); setScreen({ name: p.name } as Screen); } }
      }} />}
      {body}
      {!['fight', 'encounter', 'event', 'dragon'].includes(screen.name) && (
        <ClashAskBanner clashes={clashes} onYes={(id) => {
          void clashes.send({ action: 'clash-answer', clash: id, accept: true }).then((r) => { if (r.ok) setScreen({ name: 'arena' }); else say(r.message); });
        }} />
      )}
      {modal}
      {opening.open && <StoryBook story={OPENING} onClose={opening.close} endLabel="Let's go!" className="lord-storybook" />}
    </Frame>
  );
}

function eventSummary(e: { gold?: number; exp?: number; gems?: number; heal?: 'full' | number; kindness?: number }) {
  const bits = [e.gold && `${e.gold} gold`, e.exp && `${e.exp} experience`, e.gems && `${e.gems} gem`, e.heal === 'full' && 'full health', e.kindness && 'kindness'].filter(Boolean);
  return bits.length ? `You gained: ${bits.join(', ')}. (Rewards grow with your level.)` : '';
}

function VillageKeys({ onKey }: { onKey: (key: string) => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest('input,select,textarea')) return;
      if (document.querySelector('.question') || !shortcutsOn()) return;
      onKey(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  return null;
}

/**
 * Before there is a hero the frame has the game's name on top. After that every screen is a painting with what it
 * needs on it (the purse, the place's name): no title, season or stats rows above the art (James, 17 Nov 2026).
 * `bare`: the painting fills the frame (fights and the map). The frame itself fills the whole window, over the hub's
 * bar, like Star Trader (James, 18 Nov 2026); the map carries the way back to the hub and the sound switch.
 */
function Frame({ children, hero, bare, backend, state }: { children: ReactNode; hero?: Hero; bare?: boolean; backend: LordBackend; state?: LordState }) {
  const hud = useMemo(() => (hero ? { hero, unlimited: !!state?.unlimited } : null), [hero, state?.unlimited]);
  const root = useRef<HTMLDivElement>(null);
  // Dragon Maths has its own letter keys, Esc and Enter-on-the-focused-button; this only adds Enter for a few go-on buttons.
  useGameKeys(root);
  return (
    <div ref={root} className={`lord${bare ? ' lord--bare' : ''}`} data-testid="lord">
      {!hero && (
        <header className="lord-top">
          <h1>Dragon Maths</h1>
          <HubButtons />
          {backend.trial && <span className="lord-trial">Trial: saved on this browser only, no points yet</span>}
        </header>
      )}
      <HudContext.Provider value={hud}>{children}</HudContext.Provider>
    </div>
  );
}

function Village({ state, hero, note, waiting, busy, onRetry, onPlace, onForest, onDragon, onClass, onLook, tools, road, fetchFirstFive, trial }: {
  state: LordState; hero: Hero; note: string; waiting: number; busy: boolean; onRetry: () => void;
  onPlace: (n: Place | 'tools' | 'howto') => void; onForest: () => void; onDragon: () => void; onClass: () => void; onLook: () => void; tools: boolean; road: boolean; fetchFirstFive?: LordBackend['fetchFirstFive']; trial: boolean;
}) {
  const check = canChallengeMaster(hero);
  const dragonReady = canFaceDragon(hero) || !!state.dragon;
  const fight = state.openFight;
  // Only what a pupil needs right now, one line each, on the map (James, 17 Nov 2026).
  const notes: ReactNode[] = [];
  if (note) notes.push(<span role="status">{note}</span>);
  if (waiting > 0) notes.push(<>Your last fight is saved on this Chromebook and will be sent when you are back online. <button type="button" className="lord-btn lord-btn--glass" disabled={busy} onClick={onRetry}>Try again now</button></>);
  if (fight) notes.push(<>You were in the middle of a fight! Tap the Forest to carry on from its start. It won’t use another fight.</>);
  if (check.ok) notes.push(<>Your master is ready to fight you. Go to Training!</>);
  if (hero.forestLeft > state.forestPerDay) notes.push(<>You were away, so you have saved-up forest fights: {hero.forestLeft} today!</>);
  if (state.classOpen && hero.forestWins === 0 && hero.exp === 0) notes.push(<>A new season has begun, and everyone starts again. <button type="button" className="lord-btn lord-btn--glass" onClick={onClass}>Pick a class</button></>);
  if (!hero.look) notes.push(<>New: you can choose how your hero looks! <button type="button" className="lord-btn lord-btn--glass" onClick={onLook}>Choose my look</button></>);
  if (!road && state.season.daysLeft <= 4) notes.push(<>{state.season.daysLeft === 0 ? 'Last day of the season!' : `${state.season.daysLeft} days left in this season.`}</>);
  const below = notes.length > 0 && <div className="lord-map__notes">{notes.map((n, i) => <p key={i}>{n}</p>)}</div>;
  const over = (
    <>
      <div className="lord-map__top">
        <div className="lord-map__title"><HubButtons /><h1>Dragon Maths{trial && <small> (trial)</small>}</h1></div>
        <Purse />
      </div>
      <div className="lord-map__corner">
        {tools && <button type="button" className="lord-btn lord-btn--glass" onClick={() => onPlace('tools')}><kbd>X</kbd> Test tools</button>}
        <button type="button" className="lord-btn lord-btn--glass lord-map__help" onClick={() => onPlace('howto')} aria-label="How to play" aria-keyshortcuts="?">?</button>
      </div>
    </>
  );
  return (
    <section className="lord-village" aria-label="The village">
      {hasMap() ? (
        <KingdomMap
          heroClass={hero.heroClass} look={hero.look} busy={busy} dragonReady={dragonReady} forestOpen={!!fight || !!state.pendingEvent || hero.forestLeft > 0 || !!state.unlimited}
          onGo={(spot) => (spot === 'forest' ? onForest() : spot === 'dragon' ? onDragon() : onPlace(spot))}
          below={below}
        >{over}</KingdomMap>
      ) : (
        <Stage scene="village" size="normal">
          <div className="lord-stage__hero"><HeroSprite heroClass={hero.heroClass} look={hero.look} scale={9} /></div>
          <header className="lord-place__head"><h2 className="lord-sign">The village of Hollowbrook</h2></header>
        </Stage>
      )}
      {road && <div className="lord-panel"><SeasonRoad season={state.season} hero={hero} fetchFirstFive={fetchFirstFive} /></div>}
    </section>
  );
}
