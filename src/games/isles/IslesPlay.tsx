/**
 * Sky Isles (docs/ISLES-PLAN.md, made cosy by docs/ISLES-COSY-PLAN.md): keep a floating island in the class's sky. My
 * island shows it with its buildings, decorations and islanders, what it has, today's turn pips, the road to Grand
 * Isle and Pip's next step. A turn is the same 4 steps every time, one choice on each screen (TurnSteps.tsx), and all
 * its choices are sent together with End turn. The server keeps the
 * island and plays every turn (shared/isles/server.ts); these screens only show it and collect the choices.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UNLIMITED_LABEL } from '../../../shared/unlimited';
import { BASES, COINS, GRAND_ISLE, LIGHTHOUSE, START, TURNS_PER_DAY } from '../../../shared/isles/config';
import { apply, beforeBuilding, boatsOf, islandWorth, problemWith, room, wholeCrystals, type Action, type Island, type TurnReport } from '../../../shared/isles/engine';
import { nextStep } from '../../../shared/isles/nextStep';
import { GULL_RIDERS, raceProblem } from '../../../shared/isles/race';
import { PROBLEM_TEXT } from '../../../shared/isles/server';
import { QuestionModal } from '../../maths/QuestionModal';
import { liveIsles } from '../../data/isles';
import { keeperArt, pipArt, sceneArt, weatherArt } from './art';
import { TrophyWonLine } from '../../trophies/TrophyWonLine';
import { IslesError, type IslandView, type IslesBackend, type PostShown, type PublicRace } from './backend';
import { Shelf, freePlaces } from './Decorations';
import { HowToPlayBody } from './HowToPlay';
import { ClassSky, VisitIsland } from './ClassSky';
import { HallOfSkies } from './Hall';
import { NamePicker } from './Names';
import { celebration, guideLine } from './guide';
import { HELP_NAMES, TIPS, helpFor, markTipSeen, saveHelp, seenTips, tipNow, type Help, type Tip } from './help';
import { Art, Card, IslandPicture, POP_GAP } from './Island';
import { Keepers } from './Keepers';
import { Race } from './Race';
import { QUESTION_WORDS, STEP_PIP, Step, StepStrip, TurnStep, canStop, stepOf, type BuildView } from './TurnSteps';
import { Say, cheerLine, nextTurnLine, useIslesVoice } from './voice';
import { actionText, collectLines, n, plural, postLine, reportLines } from './words';
import './isles.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'problem'; message: string }
  | { kind: 'keeper'; first: boolean }
  | { kind: 'home' }
  | { kind: 'turn'; step: Step }
  /** A Sky Race; `inTurn` when it was started from a turn's last step (the turn's choices wait for it). */
  | { kind: 'race'; open: PublicRace | null; inTurn?: boolean; rival?: { id: string; name: string; keeper: string | null }; back?: Screen }
  | { kind: 'sky' }
  | { kind: 'visit'; who: string }
  | { kind: 'hall' }
  | { kind: 'name' }
  | { kind: 'decorations'; back: Screen }
  | { kind: 'howto'; back: Screen };

const HEADINGS: Record<Exclude<Screen['kind'], 'race' | 'keeper' | 'sky' | 'visit' | 'hall' | 'name'>, string> = {
  loading: 'Sky Isles',
  problem: 'Sky Isles',
  home: 'My island',
  turn: 'Your turn',
  decorations: 'Decorations',
  howto: 'How to play',
};

function Resources({ island }: { island: Island }) {
  return (
    <ul className="si-res" aria-label="Your island now">
      <li><span>Coins</span><strong>{n(island.coins)}</strong></li>
      <li><span>Sky crystals</span><strong>{n(wholeCrystals(island))}</strong></li>
      <li><span>Islanders</span><strong>{n(island.islanders)}</strong><em className="si-res__room">room for {n(room(island))}</em></li>
      <li><span>Sky-boats</span><strong>{n(boatsOf(island))}</strong></li>
    </ul>
  );
}

function TurnPips({ left, unlimited = false }: { left: number; unlimited?: boolean }) {
  const today = Math.min(left, TURNS_PER_DAY);
  return (
    <div className="si-pips" role="img" aria-label={unlimited && left < 1 ? UNLIMITED_LABEL : `${plural(left, 'turn')} left today`}>
      {Array.from({ length: TURNS_PER_DAY }, (_, i) => <span key={i} className={i < today ? 'si-pips__on' : ''} />)}
      <span className="si-pips__words">{unlimited && left < 1 ? UNLIMITED_LABEL : left > TURNS_PER_DAY ? `${left} turns (some saved)` : `${plural(left, 'turn')} left today`}</span>
    </div>
  );
}

/** The road to Grand Isle: spots from START up to GRAND_ISLE, then the Lighthouse's stages. */
function Road({ island }: { island: Island }) {
  const spots = island.spots.length;
  const stops = Array.from({ length: GRAND_ISLE - START.spots.length + 1 }, (_, i) => START.spots.length + i);
  const label = spots < GRAND_ISLE
    ? `Road to Grand Isle: ${spots} of ${GRAND_ISLE} building spots`
    : `Grand Isle! Sky Lighthouse: ${island.lighthouse} of ${LIGHTHOUSE.length} stages`;
  return (
    <div className="si-road" role="img" aria-label={label}>
      <span className="si-road__label" aria-hidden="true">{label}</span>
      <div className="si-road__track" aria-hidden="true">
        {stops.map((s) => <span key={s} className={`si-road__stop${s <= spots ? ' si-road__stop--on' : ''}${(BASES as readonly number[]).includes(s) ? ' si-road__stop--big' : ''}`} />)}
        {LIGHTHOUSE.map((_, i) => <span key={`l${i}`} className={`si-road__light${i < island.lighthouse ? ' si-road__light--on' : ''}`} />)}
      </div>
    </div>
  );
}

export function IslesPlay({ backend = liveIsles }: { backend?: IslesBackend; level?: unknown }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [view, setView] = useState<IslandView | null>(null);
  const [report, setReport] = useState<TurnReport | undefined>(undefined);
  /** Post opened on load, shown on My island until a turn starts (kept if a second load comes back without it). */
  const [post, setPost] = useState<PostShown[]>([]);
  const [windy, setWindy] = useState(false);
  const [picks, setPicks] = useState<Action[]>([]);
  /** What the Build step shows. */
  const [build, setBuild] = useState<BuildView>({ kind: 'island' });
  /** A choice was just made on this step: ask "another?". */
  const [again, setAgain] = useState(false);
  /** The sky pilot's question is open (step 2). */
  const [asking, setAsking] = useState(false);
  /** The button "Show me" lit up (the guide lights its own). */
  const [picked, setLit] = useState<string | null>(null);
  /** Pip's guided first go is running: for a new island (the server says), or replayed from How to play. */
  const [guiding, setGuiding] = useState(false);
  /** Pip's words once the guided turn is played (null: not showing). */
  const [cheer, setCheer] = useState<string[] | null>(null);
  const [help, setHelp] = useState<Help | null>(null);
  const [seen, setSeen] = useState<Tip[]>(() => seenTips());
  /** Land anchored last turn (spot numbers from…to), sparkling on My island until the next turn starts. */
  const [grew, setGrew] = useState<{ from: number; to: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const voice = useIslesVoice();
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const show = useCallback((v: IslandView) => {
    setView(v);
    if (v.report) setReport(v.report);
    if (v.post?.length) setPost(v.post);
  }, []);

  const load = useCallback(async () => {
    setScreen({ kind: 'loading' });
    try {
      const v = (await backend.send({ action: 'load' })) as unknown as IslandView;
      show(v);
      setPicks([]);
      setGuiding(v.guide.show);
      setScreen(v.openRace ? { kind: 'race', open: v.openRace } : v.keeper ? { kind: 'home' } : { kind: 'keeper', first: true });
    } catch (e) {
      setScreen({ kind: 'problem', message: e instanceof Error ? e.message : 'Sky Isles could not be opened.' });
    }
  }, [backend, show]);

  useEffect(() => {
    void load();
  }, [load]);

  // Each new screen (and each step of a turn, and each change within a step) moves focus to its heading.
  const focusKey = screen.kind === 'turn' ? `turn-${screen.step}-${again}-${JSON.stringify(build)}-${picks.length}` : screen.kind;
  useEffect(() => {
    heading.current?.focus();
  }, [focusKey]);

  const island = view?.island ?? null;

  /** The island after collecting, then after each choice so far (each one checked as it was made). */
  const steps = useMemo(() => {
    if (!island) return [];
    const out = [beforeBuilding(island, windy).island];
    for (const a of picks) out.push(apply(out[out.length - 1], a));
    return out;
  }, [island, windy, picks]);
  const planned = steps[steps.length - 1] ?? island;
  const turnStep = screen.kind === 'turn' ? screen.step : null;
  // From the collect onwards the resource bar shows what the island has to spend.
  const shownIsland = turnStep !== null && turnStep >= Step.Collect ? planned : island;
  // The guide says where the pupil is now and lights the button it means (it follows whatever they press).
  const guideNow = guiding && shownIsland && (screen.kind === 'home' || screen.kind === 'turn')
    ? guideLine({ step: turnStep, island: shownIsland, build, again, picks: picks.length })
    : null;
  const lit = guideNow ? guideNow.target ?? null : picked;
  const helpNow = help ?? helpFor(island);

  const goTo = (step: Step) => {
    setAsking(step === Step.Question && !!view?.question && !view.question.answered);
    setAgain(false);
    setBuild({ kind: 'island' });
    setScreen({ kind: 'turn', step });
  };

  /** A choice on the Build step: kept, then "another?". */
  const choose = (a: Action) => {
    if (turnStep !== Step.Build || !planned || problemWith(planned, a)) return;
    setLit(null);
    setPicks((list) => [...list, a]);
    setBuild({ kind: 'island' });
    setAgain(true);
  };

  /** Back one step. Back to the Collect step takes the building choices away, so they can be made again. */
  const stepBack = () => {
    if (turnStep === null || !canStop(turnStep)) return;
    const to = (turnStep - 1) as Step;
    if (to < Step.Build) setPicks([]);
    goTo(to);
  };

  /** Back to My island without playing: the choices are dropped and the turn isn't used. */
  const leave = () => {
    setPicks([]);
    setAgain(false);
    setBuild({ kind: 'island' });
    setScreen({ kind: 'home' });
  };

  const fail = (e: unknown) => {
    if (e instanceof IslesError && e.code === 'stale') return void load();
    setProblem(e instanceof Error ? e.message : 'Something went wrong. Try again.');
  };

  const startTurn = () => {
    setPost([]);
    setGrew(null);
    if (!view || !island) return;
    setPicks([]);
    setProblem(null);
    setWindy(view.question?.answered?.right === true);
    goTo(Step.Question);
  };

  const endTurn = async () => {
    if (!island) return;
    setBusy(true);
    setProblem(null);
    try {
      const v = (await backend.send({ action: 'turn', turn: island.turn, actions: picks })) as unknown as IslandView;
      setGrew(v.island.spots.length > island.spots.length ? { from: island.spots.length, to: v.island.spots.length } : null);
      show(v);
      setLit(null);
      if (guiding) {
        setGuiding(false);
        setCheer(celebration(v.island.turnsLeft));
        finishGuide();
      }
      leave();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const saveKeeper = async (id: string) => {
    setBusy(true);
    try {
      await backend.send({ action: 'keeper', keeper: id });
      setView((v) => (v ? { ...v, keeper: id } : v));
      setScreen({ kind: 'home' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (name: string) => {
    setBusy(true);
    try {
      await backend.send({ action: 'name', name });
      setView((v) => (v ? { ...v, name } : v));
      setScreen({ kind: 'home' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** The guide is finished or skipped: the server remembers, so it doesn't come back on another Chromebook. */
  const finishGuide = () => {
    void backend.send({ action: 'guideDone' }).catch(() => undefined);
  };
  const skipGuide = () => {
    setGuiding(false);
    finishGuide();
  };

  const showMe = (target: string | undefined) => {
    if (!target) return;
    // Between turns, a button that lives on a step of the turn lights up "Play a turn"; it stays lit for when that
    // step comes.
    setLit(target);
    const el = document.querySelector<HTMLElement>(`[data-pip="${screen.kind === 'home' && stepOf(target) !== null && target !== 'race' ? 'play' : target}"]`);
    el?.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el?.focus();
  };

  if (screen.kind === 'loading' || screen.kind === 'problem' || !view || !island || !shownIsland) {
    return (
      <div className="si">
        <h2 ref={heading} tabIndex={-1}>Sky Isles</h2>
        {screen.kind === 'problem' ? (
          <div className="si-panel" role="alert">
            <p>{screen.message}</p>
            <button type="button" className="button button--primary" onClick={() => void load()}>Try again</button>
          </div>
        ) : (
          <p className="si-note" role="status">Flying to your island…</p>
        )}
      </div>
    );
  }

  if (screen.kind === 'keeper') {
    return (
      <div className="si">
        <Keepers current={view.keeper} busy={busy} onChoose={(id) => void saveKeeper(id)} onBack={screen.first ? undefined : () => setScreen({ kind: 'home' })} />
        {problem && <p className="si-problem" role="alert">{problem}</p>}
      </div>
    );
  }

  if (screen.kind === 'sky') {
    return (
      <div className="si">
        <ClassSky
          backend={backend}
          today={view.day}
          onVisit={(who) => setScreen({ kind: 'visit', who })}
          onRace={(c) => setScreen({ kind: 'race', open: null, rival: { id: c.id, name: c.name, keeper: c.keeper }, back: { kind: 'sky' } })}
          onHall={() => setScreen({ kind: 'hall' })}
          onBack={() => setScreen({ kind: 'home' })}
        />
      </div>
    );
  }

  if (screen.kind === 'hall') {
    return (
      <div className="si">
        <HallOfSkies
          backend={backend}
          mine={{ islandName: view.name, keeper: view.keeper, worth: islandWorth(island), lighthouse: island.lighthouse }}
          onBack={() => setScreen({ kind: 'sky' })}
        />
      </div>
    );
  }

  if (screen.kind === 'name') {
    return (
      <div className="si">
        <NamePicker current={view.name} busy={busy} onChoose={(name) => void saveName(name)} onBack={() => setScreen({ kind: 'home' })} />
        {problem && <p className="si-problem" role="alert">{problem}</p>}
      </div>
    );
  }

  if (screen.kind === 'visit') {
    return (
      <div className="si">
        <VisitIsland
          backend={backend}
          who={screen.who}
          onRace={(c) => setScreen({ kind: 'race', open: null, rival: { id: c.id, name: c.name, keeper: c.keeper }, back: { kind: 'sky' } })}
          onBack={() => setScreen({ kind: 'sky' })}
        />
      </div>
    );
  }

  if (screen.kind === 'race') {
    return (
      <div className="si">
        <Race
          backend={backend}
          open={screen.open}
          keeper={view.keeper}
          rival={screen.rival}
          say={voice.say}
          backLabel={screen.inTurn ? 'Back to my turn' : screen.back ? 'Back to the class sky' : undefined}
          onProblem={(message) => {
            setProblem(message);
            if (screen.inTurn) setScreen({ kind: 'turn', step: Step.Rest });
            else leave();
          }}
          onDone={(after) => {
            if (after) setView((v) => (v ? { ...v, island: after, openRace: null } : v));
            // A race from a turn's last step goes back there, with the turn's choices still waiting.
            setScreen(screen.inTurn ? { kind: 'turn', step: Step.Rest } : screen.back ?? { kind: 'home' });
          }}
        />
      </div>
    );
  }

  const step = nextStep(shownIsland);
  // In a turn Pip talks about this step only: his next step if it's about this step, or the step's own line.
  const pipHere = turnStep === null || stepOf(step.target) === turnStep;
  // Building only happens in a turn, so between turns Pip says it's for the next turn.
  const nextTurn = screen.kind === 'home' && stepOf(step.target) === Step.Build;
  const unlimited = view.unlimited === true;
  const resting = island.turnsLeft < 1 && !unlimited && screen.kind === 'home';
  const pipSays = guideNow ? guideNow.say
    : resting ? 'Your island is resting. See you tomorrow!'
    : !pipHere ? STEP_PIP[turnStep!]
    : nextTurn ? nextTurnLine(step.say)
    : step.say;
  const lastTurn = screen.kind === 'home' && island.turn > 0
    ? [...(grew ? [`✨ Your island grew! ${plural(grew.to - grew.from, 'new building spot')}: ${grew.to} spots now.`] : []), ...reportLines(report)]
    : [];
  // New land sparkles: anchored this turn (while the turn goes on), or last turn (on My island).
  const fresh = turnStep !== null && shownIsland.spots.length > island.spots.length
    ? Array.from({ length: shownIsland.spots.length - island.spots.length }, (_, i) => island.spots.length + i)
    : screen.kind === 'home' && grew ? Array.from({ length: grew.to - grew.from }, (_, i) => grew.from + i) : [];
  // Help Off keeps only the guide and the resting line; Some leaves out "Show me".
  const pipLine = helpNow === 'off' && !guideNow && !resting ? null : (
    <div className={`si-pipsays si-next${guideNow ? ' si-guide' : ''}`} aria-live="polite">
      <Art src={pipArt('point')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
      <p>{pipSays}</p>
      {guideNow ? (
        <button type="button" className="button button--light si-showme" onClick={skipGuide}>Skip the guide</button>
      ) : (
        // Between turns the island is only a picture, so a building step has nothing to show.
        helpNow === 'lots' && step.target && pipHere && !nextTurn && island.turnsLeft > 0 && (
          <button type="button" className="button button--light si-showme" onClick={() => showMe(step.target)}>Show me</button>
        )
      )}
    </div>
  );
  const tip = screen.kind === 'home' && helpNow === 'lots' && !guideNow && !cheer ? tipNow(island, report, post.length > 0, seen) : null;
  // What Bella reads now (only recorded lines are read): the cheer, a tip, the question's result, or Pip's line.
  const answered = turnStep === Step.Question ? view.question?.answered : null;
  const voiceLine = screen.kind === 'home' && cheer ? cheerLine(cheer)
    : tip ? TIPS[tip]
    : turnStep === Step.Question && !view.question ? QUESTION_WORDS.none
    : answered ? (answered.right ? QUESTION_WORDS.right : QUESTION_WORDS.wrong)
    : pipLine ? pipSays
    : null;
  const raceWhy = raceProblem(island, GULL_RIDERS, 'me');
  const raceWords = !view.races ? 'Sky Races are switched off for your class.' : raceWhy ? PROBLEM_TEXT[raceWhy] : null;
  const back = () => setScreen(screen.kind === 'decorations' || screen.kind === 'howto' ? screen.back : { kind: 'home' });
  // The collect step: coins pop off each building (what it makes, before the fair wind).
  const pops = turnStep === Step.Collect
    ? Object.fromEntries(island.spots.flatMap((s, i) => (s.kind === 'empty' ? [] : [[i, COINS[s.kind] * s.level]])))
    : undefined;
  const placing = turnStep === Step.Build && (build.kind === 'place' || build.kind === 'move');

  return (
    <div className="si">
      <Say text={voiceLine} say={voice.say} />
      <TrophyWonLine games={['isles']} watch={view?.island.turn} off={backend.trial} />
      <header className={`si-top${turnStep !== null ? ' si-top--turn' : ''}`}>
        {screen.kind === 'turn' ? <h2>Your turn</h2> : (
          // A named island is called by its name at the top (James, 4 Nov 2026); until then it's "My island".
          <h2 ref={heading} tabIndex={-1}>
            {screen.kind === 'home' && view.name ? <><span aria-hidden="true">🏝️ </span>{view.name}</> : HEADINGS[screen.kind]}
          </h2>
        )}
        {turnStep !== null && <StepStrip step={turnStep} />}
        <div className="si-top__right">
          {turnStep !== null && canStop(turnStep) && <button type="button" className="button button--light si-stop" onClick={leave}>Stop, back to my island</button>}
          <TurnPips left={island.turnsLeft} unlimited={unlimited} />
          {voice.available && (
            <button type="button" className="button button--light si-voice" aria-label="Read aloud" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
              <span aria-hidden="true">{voice.on ? '🔊' : '🔇'}</span><span className="si-voice__words" aria-hidden="true"> {voice.on ? 'Voice on' : 'Voice off'}</span>
            </button>
          )}
          {view.keeper && (
            <button type="button" className="si-keeperbtn" onClick={() => setScreen({ kind: 'keeper', first: false })} aria-label="Change your Sky Keeper">
              <Art src={keeperArt(view.keeper, true)} fallback={<span className="si-keeper__drawn">?</span>} />
            </button>
          )}
        </div>
      </header>

      <Resources island={shownIsland} />
      {screen.kind === 'home' && (
        <p className="si-isle-name">
          <button type="button" className="button button--light si-isle-name__btn" onClick={() => setScreen({ kind: 'name' })}>
            {view.name ? 'Rename' : 'Name your island'}
          </button>
        </p>
      )}

      {screen.kind === 'howto' ? (
        <section className="si-panel">
          <fieldset className="si-help">
            <legend>How much should Pip help?</legend>
            <div className="si-row" role="radiogroup" aria-label="Pip's help">
              {(Object.keys(HELP_NAMES) as Help[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={helpNow === h}
                  className={`button ${helpNow === h ? 'button--primary' : 'button--light'}`}
                  onClick={() => {
                    setHelp(h);
                    saveHelp(h);
                  }}
                >
                  {HELP_NAMES[h]}
                </button>
              ))}
            </div>
            <p className="si-note">Lots: Pip's tip with Show me, and a tip the first time something new happens. Some: just Pip's tip. Off: Pip stays quiet.</p>
            <button
              type="button"
              className="button button--light"
              onClick={() => {
                setGuiding(true);
                setCheer(null);
                setScreen({ kind: 'home' });
              }}
            >
              Replay the guide
            </button>
          </fieldset>
          <HowToPlayBody />
          <button type="button" className="button button--primary" onClick={back}>Back</button>
        </section>
      ) : screen.kind === 'decorations' ? (
        <section className="si-panel">
          <Shelf island={shownIsland} lit={lit} />
          <button type="button" className="button button--primary" onClick={back}>Back</button>
        </section>
      ) : (
        <div className="si-main">
          <div className="si-left">
            <IslandPicture
              island={shownIsland}
              keeper={view.keeper}
              lit={lit}
              selected={turnStep === Step.Build && build.kind === 'spot' ? build.spot : null}
              // Spots are buttons only on the Build step: on My island they're just the picture.
              onSpot={turnStep === Step.Build && !again && !placing ? (i) => setBuild({ kind: 'spot', spot: i }) : undefined}
              onDrift={turnStep === Step.Build && !again && !placing ? () => choose({ kind: 'anchor' }) : undefined}
              free={placing ? freePlaces(shownIsland) : undefined}
              onPlace={(place) => {
                if (build.kind === 'place') choose({ kind: 'decorate', id: build.id, place });
                else if (build.kind === 'move') choose({ kind: 'move', decoration: build.decoration, place });
              }}
              pops={pops}
              fresh={fresh}
            />
            {turnStep === null ? <Road island={shownIsland} /> : pipLine}
          </div>

          <div className="si-right">
            {turnStep === null && pipLine}


            {screen.kind === 'home' && cheer && (
              <section className="si-panel si-cheer" aria-label="Pip says well done">
                <h3>{cheer[0]}</h3>
                {cheer.slice(1).map((line) => <p key={line}>{line}</p>)}
                <button type="button" className="button button--primary si-close" onClick={() => setCheer(null)}>Thanks, Pip!</button>
              </section>
            )}

            {tip && (
              <section className="si-panel si-tip" aria-label="Pip's tip">
                <p><strong>Pip's tip:</strong> {TIPS[tip]}</p>
                <button
                  type="button"
                  className="button button--light si-close"
                  onClick={() => {
                    markTipSeen(tip);
                    setSeen((list) => [...list, tip]);
                  }}
                >
                  Got it
                </button>
              </section>
            )}

            {screen.kind === 'home' && post.length > 0 && (
              <section className="si-panel si-post" aria-label="Sky post">
                <h3>Sky post</h3>
                <ul className="si-sums">{post.map((p, i) => <li key={i}>{postLine(p)}</li>)}</ul>
              </section>
            )}

            {lastTurn.length > 0 && (
              <section className="si-panel si-report" aria-label="Last turn">
                <h3>Last turn</h3>
                {report?.weather && <Card art={weatherArt(report.weather)} />}
                <ul className="si-sums">{lastTurn.map((line) => <li key={line}>{line}</li>)}</ul>
              </section>
            )}

            {screen.kind === 'home' && (
              <section className="si-panel si-home">
                {island.turnsLeft < 1 && !unlimited ? (
                  <div className="si-resting">
                    <Card art={sceneArt('night')} />
                    <p><strong>Your island is resting. See you tomorrow!</strong></p>
                    <p className="si-note">Tomorrow brings {TURNS_PER_DAY} new turns and more land on the wind.</p>
                  </div>
                ) : (
                  <button type="button" className={`button button--play si-big${lit === 'play' || stepOf(lit) !== null ? ' si-lit' : ''}`} data-pip="play" onClick={startTurn}>
                    Play a turn
                  </button>
                )}
                <div className="si-row">
                  <div className="si-choice">
                    <button
                      type="button"
                      className={`button button--primary${lit === 'race' ? ' si-lit' : ''}`}
                      data-pip="race"
                      disabled={raceWords !== null}
                      aria-describedby={raceWords ? 'si-race-why' : undefined}
                      onClick={() => setScreen({ kind: 'race', open: null })}
                    >
                      Sky Race
                    </button>
                    {raceWords && <span id="si-race-why" className="si-choice__why">{raceWords}</span>}
                  </div>
                  <button type="button" className="button button--light" onClick={() => setScreen({ kind: 'decorations', back: { kind: 'home' } })}>Decorations</button>
                  <button type="button" className="button button--light" onClick={() => setScreen({ kind: 'howto', back: { kind: 'home' } })}>How to play</button>
                </div>
                <button type="button" className="button button--light" onClick={() => setScreen({ kind: 'sky' })}>Class sky</button>
                {problem && <p className="si-problem" role="alert">{problem}</p>}
              </section>
            )}

            {turnStep !== null && planned && (
              <TurnStep
                step={turnStep}
                island={planned}
                lines={picks.map((a, i) => actionText(steps[i], a))}
                newLand={planned.spots.length - island.spots.length}
                again={again}
                build={build}
                lit={lit}
                busy={busy}
                problem={problem}
                headingRef={heading}
                collectLines={collectLines(island, windy)}
                countFor={pops ? Object.keys(pops).length * POP_GAP + 0.6 : 0}
                windy={windy}
                question={view.question ? { answered: view.question.answered ?? null } : null}
                raceWhy={raceWords}
                onNext={() => goTo(Math.min(turnStep + 1, Step.Rest) as Step)}
                onBack={stepBack}
                onChoose={choose}
                onBuild={(b) => {
                  setAgain(false);
                  setBuild(b);
                }}
                onAnother={() => setAgain(false)}
                onUndo={() => setPicks((list) => list.slice(0, -1))}
                onRace={() => setScreen({ kind: 'race', open: null, inTurn: true })}
                onEnd={() => void endTurn()}
              />
            )}
          </div>
        </div>
      )}

      {turnStep === Step.Question && asking && view.question && (
        <QuestionModal
          question={{ ...view.question, id: island.turn * 10 + view.question.slot }}
          title="The sky pilot's question"
          note="Get it right for a fair wind: more coins this turn!"
          spot="isles-turn"
          closeLabel="Skip"
          onClose={() => goTo(Step.Collect)}
          onSubmit={async (value, ms) => {
            const q = view.question!;
            try {
              const r = await backend.send({ action: 'answer', set: q.set, slot: q.slot, value, ms });
              const right = r.right === true;
              setWindy(right);
              setView((v) => (v && v.question ? { ...v, question: { ...v.question, answered: { value, right } } } : v));
              return { correct: right, fact: q.spoken, boxBefore: 0, boxAfter: 0, answer: r.answer as number, reward: right ? 'A fair wind for this turn!' : undefined };
            } catch {
              return { correct: false, fact: q.spoken, boxBefore: 0, boxAfter: 0 };
            }
          }}
          onDone={() => goTo(Step.Collect)}
        />
      )}
    </div>
  );
}
