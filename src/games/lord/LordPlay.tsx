/**
 * Dragon Maths (docs/LORD-PLAN.md, stage L.4): the screens, with the school's server keeping the hero.
 *
 * The server is the boss: the forest, a master, a dragon stage and every purchase wait for it, and it hands out
 * each fight's monster and seed. The fight itself is played here, and when it ends the actions are sent so the
 * server can replay them before paying anything. Opening the game (or reloading it, or opening it on another
 * Chromebook) offers a half-finished fight again from the start, with no extra fight used.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SKILL_USES_PER_DAY, WEAPONS, expNeeded, masterFor } from '../../../shared/lord/data';
import { canChallengeMaster, canFaceDragon } from '../../../shared/lord/engine';
import { EVENT_BY_ID } from '../../../shared/lord/events';
import type { LordAction, LordState } from '../../../shared/lord/server';
import type { FightAction, FightState, Hero, HeroClass } from '../../../shared/lord/types';
import { useAuth } from '../../auth/AuthContext';
import { createServerBackend, type LordBackend, type LordLoad, type PackFact } from '../../data/lord';
import { FightScreen } from './Fight';
import { Bank, ClassPick, Healer, HeroPage, Inn, Shop, Training, type PlaceProps, type Reply } from './Places';
import { Arena, HallOfHeroes, NewsPage, Warriors } from './Social';
import { HeroSprite, Icon, MonsterSprite } from './Sprite';
import { withArticle } from './text';
import { useAsk, type Answer } from './useAsk';
import './lord.css';

// The test tools are only ever loaded in the browser-only trial (preview/lord); the live game never opens them.
const Tools = lazy(() => import('./Tools').then((m) => ({ default: m.Tools })));

type FightContext =
  | { kind: 'forest'; sizeUp: Answer | null }
  | { kind: 'master' }
  | { kind: 'dragon'; stage: 1 | 2 | 3 };

type Screen =
  | { name: 'village' }
  | { name: 'shop' | 'healer' | 'bank' | 'inn' | 'training' | 'hero' | 'news' | 'tools' | 'class' | 'dragon' | 'arena' | 'warriors' | 'hall' }
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
  const [facts, setFacts] = useState<PackFact[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: 'village' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [deeds, setDeeds] = useState<string[]>([]);
  const hero = state?.hero ?? null;
  const { ask, modal } = useAsk(hero?.level ?? 1, facts);

  const stateRef = useRef<LordState | null>(null);
  stateRef.current = state;
  const busyRef = useRef(false);
  const say = (text: string) => setNote(text);
  const addDeed = (line: string) => setDeeds((d) => [line, ...d].slice(0, 12));

  const open = useCallback(async () => {
    setLoad({ kind: 'loading' });
    const result = await backend.load();
    setLoad(result);
    setWaiting(backend.waiting());
    if (result.kind === 'ready') {
      setState(result.state);
      setFacts(result.facts);
      if (result.abandoned) setNote(ABANDONED[result.abandoned]);
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

  // A new day: the server has already given the turns back; just say so.
  const today = state?.today ?? '';
  const lastDay = useRef('');
  useEffect(() => {
    if (!state?.hero) return;
    if (lastDay.current && lastDay.current !== state.today) setNote('A new day dawns. Your health and your turns are back!');
    lastDay.current = state.today;
  }, [state?.today, state?.hero]);

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
        <section className="lord-place" aria-label="Closed">
          <h2>The village gates are closed</h2>
          <p className="lord-lead">Dragon Maths is switched off for now. Ask your teacher when it will open. Your hero is safe.</p>
        </section>
      </Frame>
    );
  }
  if (load.kind === 'not-started') {
    return (
      <Frame backend={backend}>
        <section className="lord-place" aria-label="Not open yet">
          <h2>The season has not started yet</h2>
          <p className="lord-lead">{load.message}</p>
        </section>
      </Frame>
    );
  }
  if (load.kind === 'offline' || !state) {
    return (
      <Frame backend={backend}>
        <section className="lord-place" aria-label="Cannot connect">
          <h2>Can’t connect</h2>
          <p className="lord-lead">{OFFLINE}</p>
          {waiting > 0 && <p className="lord-note">Your last fight is saved on this Chromebook and will be sent as soon as you are back online.</p>}
          <button type="button" className="lord-btn lord-btn--hot" autoFocus onClick={() => void open()}>Try again</button>
        </section>
      </Frame>
    );
  }

  if (!hero || screen.name === 'class') {
    const choosing = !hero;
    return (
      <Frame backend={backend} state={state}>
        <ClassPick
          onPick={async (c: HeroClass) => {
            const reply = await act({ action: 'start-hero', heroClass: c });
            if (reply) {
              setScreen({ name: 'village' });
              if (choosing) addDeed('Your adventure begins!');
            }
          }}
        />
        {!choosing && <button type="button" className="lord-btn" onClick={() => setScreen({ name: 'village' })}>Keep my class</button>}
        {busy && <p className="lord-soft" role="status">One moment…</p>}
      </Frame>
    );
  }

  const toVillage = () => setScreen({ name: 'village' });
  const placeProps: PlaceProps = { state, hero, act, ask, say, back: toVillage, busy };

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
    if (s.hero!.forestLeft <= 0) return say('You have used all your forest fights today. Come back tomorrow, or visit the village.');
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
      answer = await ask('size-it-up', { title: `Size up the ${fight.start.monster.name}`, note: 'A right answer finds its weak spot: your first hit is bigger.', closeLabel: 'Skip, just fight' });
    }
    playFight(fight, answer);
  }

  async function resolveEvent(eventId: string) {
    const event = EVENT_BY_ID[eventId];
    if (!event) return toVillage();
    let proof: Answer | null = null;
    let walkOn = false;
    if (event.maths) {
      proof = await ask('treasure', { title: event.title, note: event.text, pack: event.maths.topic, closeLabel: 'Walk on' });
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
    case 'hero': body = <HeroPage hero={hero} stats={state.stats} back={toVillage} />; break;
    case 'arena': body = <Arena hero={hero} act={act} say={say} back={toVillage} busy={busy} />; break;
    case 'news': body = <NewsPage backend={backend} deeds={deeds} today={today} back={toVillage} />; break;
    case 'warriors': body = <Warriors backend={backend} back={toVillage} />; break;
    case 'hall': body = <HallOfHeroes backend={backend} back={toVillage} />; break;
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
        <section className="lord-place" aria-label={event.title}>
          <h2>{event.title}</h2>
          <p className="lord-lead">{event.text}</p>
          <p className="lord-soft">Events do not use up a forest fight.</p>
          <button type="button" className="lord-btn lord-btn--hot" autoFocus disabled={busy} onClick={() => void resolveEvent(event.id)}>
            {event.maths ? 'Have a go' : 'Continue'}
          </button>
        </section>
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
      body = (
        <section className="lord-place lord-encounter" aria-label="A monster appears">
          <MonsterSprite monster={fight.start.monster} scale={9} />
          <h2>{withArticle(fight.start.monster.name).replace(/^a/, 'A')} appears!</h2>
          <p className="lord-lead">{fight.start.monster.intro}</p>
          <div className="lord-actions">
            {sizeUp && <button type="button" className="lord-btn lord-btn--hot" onClick={() => void beginFight(true)}>Size it up (a maths question)</button>}
            <button type="button" className={`lord-btn${sizeUp ? '' : ' lord-btn--hot'}`} autoFocus={!sizeUp} onClick={() => void beginFight(false)}>Fight!</button>
          </div>
        </section>
      );
      break;
    }
    case 'fight': {
      const { fight, actions, fightId, ctx } = screen;
      body = (
        <FightScreen
          key={fightId + (ctx.kind === 'dragon' ? ctx.stage : '')} fight={fight} heroName={heroName}
          onChange={onFightChange} onContinue={() => void finishFight(fight, actions, fightId, ctx)}
        />
      );
      break;
    }
    case 'dragon': {
      const next = state.dragon?.next ?? 1;
      body = (
        <section className="lord-place lord-encounter" aria-label="The Red Dragon">
          <MonsterSprite monster={{ id: 'dragon-1', name: 'Scorchtail, the Red Dragon', level: 13 }} scale={10} />
          <h2>The Red Dragon’s lair</h2>
          <p className="lord-lead">
            The dragon has the village’s treasure, food and light. There are three fights, with a riddle before each one and a short rest between. You can’t run. If it goes badly, you wake at the healer and lose nothing but today’s try.
          </p>
          {state.dragonTried && next === 1 && <p className="lord-note">You have already faced the dragon today. Come back tomorrow!</p>}
          <div className="lord-actions">
            <button type="button" className="lord-btn lord-btn--hot" disabled={busy || (state.dragonTried && next === 1)} onClick={() => void beginDragonStage(next)}>
              {next === 1 ? 'Go in' : `Carry on: fight ${next} of 3`}
            </button>
            <button type="button" className="lord-btn" onClick={toVillage}>Not yet</button>
          </div>
        </section>
      );
      break;
    }
    default:
      body = (
        <Village
          state={state} hero={hero} note={note} waiting={waiting} busy={busy} onRetry={() => void retry()}
          onPlace={(n) => { setNote(''); setScreen({ name: n } as Screen); }} onForest={() => void goForest()}
          onDragon={() => setScreen({ name: 'dragon' })} onClass={() => setScreen({ name: 'class' })} today={today} tools={backend.trial}
        />
      );
  }

  const keysOn = screen.name === 'village';
  return (
    <Frame backend={backend} state={state} hero={hero} hideStatus={screen.name === 'fight'}>
      {keysOn && <VillageKeys onKey={(k) => {
        if (busyRef.current) return;
        if (k === 'f') void goForest();
        else if (k === 'd' && (canFaceDragon(hero) || state.dragon)) setScreen({ name: 'dragon' });
        else if (k === 'x' && backend.trial) setScreen({ name: 'tools' });
        else { const p = PLACES.find((x) => x.key === k); if (p) { setNote(''); setScreen({ name: p.name } as Screen); } }
      }} />}
      {body}
      {modal}
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
      if (document.querySelector('.question')) return;
      onKey(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  return null;
}

function Frame({ children, hero, hideStatus, backend, state }: { children: ReactNode; hero?: Hero; hideStatus?: boolean; backend: LordBackend; state?: LordState }) {
  return (
    <div className="lord" data-testid="lord">
      <header className="lord-top">
        <h1>Dragon Maths</h1>
        {backend.trial ? (
          <span className="lord-trial">Trial: saved on this browser only, no points yet</span>
        ) : (
          state?.hero && <span className="lord-trial">Season {state.season.number}, day {state.season.dayOfSeason} of 35{state.season.daysLeft <= 4 ? `: ${state.season.daysLeft} days left!` : ''}</span>
        )}
      </header>
      {hero && !hideStatus && <StatusBar hero={hero} />}
      {children}
      <footer className="lord-credits">Based on the rules of Legend of the Red Dragon. Pictures: Kenney 1-Bit Pack (CC0).</footer>
    </div>
  );
}

function StatusBar({ hero }: { hero: Hero }) {
  const need = expNeeded(hero.level);
  return (
    <ul className="lord-status" aria-label="Your hero at a glance">
      <li>Level <strong>{hero.level}</strong></li>
      <li><Icon name="heart" scale={1} colour="#ff5555" /> <strong>{hero.hp}</strong> / {hero.maxHp}</li>
      <li><Icon name="gold" scale={1} /> <strong>{hero.gold}</strong> <span className="lord-soft">(bank {hero.bank})</span></li>
      <li>Exp <strong>{hero.exp}</strong>{Number.isFinite(need) ? ` / ${need}` : ''}</li>
      <li>Forest fights <strong>{hero.forestLeft}</strong></li>
      <li>Arena <strong>{hero.arenaLeft}</strong></li>
      <li>Skills <strong>{hero.skillLeft}</strong> / {SKILL_USES_PER_DAY}</li>
      {hero.dragonKills > 0 && <li>{'★'.repeat(Math.min(hero.dragonKills, 5))}</li>}
    </ul>
  );
}

function Village({ state, hero, note, waiting, busy, onRetry, onPlace, onForest, onDragon, onClass, today, tools }: {
  state: LordState; hero: Hero; note: string; waiting: number; busy: boolean; onRetry: () => void;
  onPlace: (n: Place | 'tools') => void; onForest: () => void; onDragon: () => void; onClass: () => void; today: string; tools: boolean;
}) {
  const check = canChallengeMaster(hero);
  const dragonReady = canFaceDragon(hero) || !!state.dragon;
  const fight = state.openFight;
  return (
    <section className="lord-village" aria-label="The village">
      <div className="lord-village__intro">
        <HeroSprite heroClass={hero.heroClass} scale={6} />
        <div>
          <h2>The village of Hollowbrook</h2>
          <p className="lord-soft">{today}. {hero.forestLeft > 0 ? `You have ${hero.forestLeft} forest fights left today.` : 'No forest fights left today. The village is still open!'}</p>
          {note && <p className="lord-note" role="status">{note}</p>}
          {waiting > 0 && (
            <p className="lord-note" role="status">
              Your last fight is saved on this Chromebook and will be sent when you are back online.{' '}
              <button type="button" className="lord-btn" disabled={busy} onClick={onRetry}>Try again now</button>
            </p>
          )}
          {fight && <p className="lord-note">You were in the middle of a fight! Press F to carry on from the start of it. It won’t use another fight.</p>}
          {check.ok && <p className="lord-note">Your master is ready to fight you. Visit the Training grounds!</p>}
          {hero.forestLeft > state.forestPerDay && <p className="lord-note">You were away, so you have saved-up forest fights: {hero.forestLeft} today!</p>}
          {state.classOpen && hero.forestWins === 0 && hero.exp === 0 && (
            <p className="lord-note">
              A new season has begun, and everyone starts again.{' '}
              <button type="button" className="lord-btn" onClick={onClass}>Pick a class</button>
            </p>
          )}
          {state.season.daysLeft <= 4 && <p className="lord-soft">{state.season.daysLeft === 0 ? 'Last day of the season!' : `${state.season.daysLeft} days left in this season.`}</p>}
        </div>
      </div>
      <div className="lord-menu">
        <button type="button" className="lord-place-btn lord-place-btn--forest" onClick={onForest} disabled={busy || (!fight && !state.pendingEvent && hero.forestLeft <= 0)}>
          <kbd>F</kbd> <strong>{fight ? 'Carry on with your fight' : 'The Forest'}</strong> <span>{fight ? 'From the start of it' : 'Fight monsters, find gold'}</span>
        </button>
        {dragonReady && (
          <button type="button" className="lord-place-btn lord-place-btn--dragon" onClick={onDragon}>
            <kbd>D</kbd> <strong>The Red Dragon</strong> <span>{state.dragon ? 'The fight goes on' : 'You are ready'}</span>
          </button>
        )}
        {PLACES.map((p) => (
          <button key={p.name} type="button" className="lord-place-btn" onClick={() => onPlace(p.name)}>
            <kbd>{p.key.toUpperCase()}</kbd> <strong>{p.label}</strong> <span>{p.blurb}</span>
          </button>
        ))}
        {tools && (
          <button type="button" className="lord-place-btn lord-place-btn--tools" onClick={() => onPlace('tools')}>
            <kbd>X</kbd> <strong>Test tools</strong> <span>For trying things out</span>
          </button>
        )}
      </div>
      <p className="lord-soft">Your weapon: {WEAPONS[hero.weapon].name}.</p>
    </section>
  );
}
