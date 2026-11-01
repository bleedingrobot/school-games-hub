/**
 * Sky Isles (docs/ISLES-PLAN.md): keep a floating island in the class's sky. My island shows it with its buildings, the
 * resources, today's turn pips, the road to Grand Isle and Pip's next step. A turn is the same 11 steps every time,
 * one choice on each screen (TurnSteps.tsx), and all its choices are sent together with End turn. The server keeps the
 * island and plays every turn (shared/isles/server.ts); these screens only show it and collect the choices.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASES, GRAND_ISLE, LIGHTHOUSE, START, TURNS_PER_DAY } from '../../../shared/isles/config';
import { apply, beforeSpending, problemWith, type Action, type Island, type TurnReport } from '../../../shared/isles/engine';
import { foodRunsOutIn, nextStep } from '../../../shared/isles/nextStep';
import { GULL_RIDERS, raceProblem } from '../../../shared/isles/race';
import { PROBLEM_TEXT } from '../../../shared/isles/server';
import { QuestionModal } from '../../maths/QuestionModal';
import { liveIsles } from '../../data/isles';
import { keeperArt, pipArt } from './art';
import { IslesError, type IslandView, type IslesBackend, type PublicRace } from './backend';
import { HowToPlayBody } from './HowToPlay';
import { Art, IslandPicture } from './Island';
import { Keepers } from './Keepers';
import { Race } from './Race';
import { SpotPanel } from './Spot';
import { STEP_PIP, Step, StepStrip, TurnStep, canStop, stepOf } from './TurnSteps';
import { Upgrades } from './Upgrades';
import { actionText, collectLines, n, plural, reportLines } from './words';
import './isles.css';

/** A choice in a turn, and the step it was made on. */
interface Pick { step: Step; action: Action }

type Screen =
  | { kind: 'loading' }
  | { kind: 'problem'; message: string }
  | { kind: 'keeper'; first: boolean }
  | { kind: 'home' }
  | { kind: 'turn'; step: Step }
  | { kind: 'race'; open: PublicRace | null }
  | { kind: 'upgrades'; back: Screen }
  | { kind: 'howto'; back: Screen };

const HEADINGS: Record<Exclude<Screen['kind'], 'race' | 'keeper'>, string> = {
  loading: 'Sky Isles',
  problem: 'Sky Isles',
  home: 'My island',
  turn: 'Your turn',
  upgrades: 'Upgrades',
  howto: 'How to play',
};

function Resources({ island }: { island: Island }) {
  const lasts = foodRunsOutIn(island);
  return (
    <ul className="si-res" aria-label="Your island now">
      <li><span>Coins</span><strong>{n(island.coins)}</strong></li>
      <li><span>Food</span><strong>{n(island.food)}</strong>{lasts !== null && <em className="si-res__warn">{lasts <= 1 ? 'runs out next turn' : `lasts ${lasts} turns`}</em>}</li>
      <li><span>People</span><strong>{n(island.people)}</strong></li>
      <li><span>Happiness</span><strong>{n(island.happiness)}</strong></li>
      <li><span>Ideas</span><strong>{n(Math.floor(island.ideas))}{island.ideas % 1 ? '½' : ''}</strong></li>
      <li><span>Sky-boats</span><strong>{n(island.boats)}</strong></li>
      <li><span>Goods</span><strong>{n(island.goods)}</strong></li>
    </ul>
  );
}

function TurnPips({ left }: { left: number }) {
  const today = Math.min(left, TURNS_PER_DAY);
  return (
    <div className="si-pips" role="img" aria-label={`${plural(left, 'turn')} left today`}>
      {Array.from({ length: TURNS_PER_DAY }, (_, i) => <span key={i} className={i < today ? 'si-pips__on' : ''} />)}
      <span className="si-pips__words">{left > TURNS_PER_DAY ? `${left} turns (some saved)` : `${plural(left, 'turn')} left today`}</span>
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
  const [windy, setWindy] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [spot, setSpot] = useState<number | null>(null);
  /** A choice was just made on this step: ask "another?". */
  const [again, setAgain] = useState(false);
  /** The sky pilot's question is open (step 2). */
  const [asking, setAsking] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const show = useCallback((v: IslandView) => {
    setView(v);
    if (v.report) setReport(v.report);
  }, []);

  const load = useCallback(async () => {
    setScreen({ kind: 'loading' });
    try {
      const v = (await backend.send({ action: 'load' })) as unknown as IslandView;
      show(v);
      setPicks([]);
      setSpot(null);
      setScreen(v.openRace ? { kind: 'race', open: v.openRace } : v.keeper ? { kind: 'home' } : { kind: 'keeper', first: true });
    } catch (e) {
      setScreen({ kind: 'problem', message: e instanceof Error ? e.message : 'Sky Isles could not be opened.' });
    }
  }, [backend, show]);

  useEffect(() => {
    void load();
  }, [load]);

  // Each new screen (and each step of a turn, and each change within a step) moves focus to its heading.
  const landOrBuild = screen.kind === 'turn' && (screen.step === Step.Land || screen.step === Step.Build);
  const focusKey = screen.kind === 'turn'
    ? `turn-${screen.step}-${again}-${spot}-${landOrBuild ? picks.filter((x) => x.step === screen.step).length : 0}`
    : screen.kind;
  useEffect(() => {
    heading.current?.focus();
  }, [focusKey]);

  const island = view?.island ?? null;
  const prices = view?.prices ?? { food: 2, goods: 6 };

  const actions = useMemo(() => picks.map((x) => x.action), [picks]);
  /** The island after collecting and feeding, then after each choice so far (each one checked as it was made). */
  const steps = useMemo(() => {
    if (!island) return [];
    const out = [beforeSpending(island, windy).island];
    for (const a of actions) out.push(apply(out[out.length - 1], a, prices));
    return out;
  }, [island, windy, actions, prices]);
  const planned = steps[steps.length - 1] ?? island;
  const turnStep = screen.kind === 'turn' ? screen.step : null;
  // From the collect onwards the resource bar shows what the island has to spend.
  const shownIsland = turnStep !== null && turnStep >= Step.Collect ? planned : island;

  const goTo = (step: Step) => {
    setAsking(step === Step.Question && !!view?.question && !view.question.answered);
    setAgain(false);
    setSpot(null);
    setScreen({ kind: 'turn', step });
  };

  const choose = (a: Action) => {
    if (turnStep === null || !planned || problemWith(planned, a, prices)) return;
    setLit(null);
    setPicks((list) => [...list, { step: turnStep, action: a }]);
    setSpot(null);
    // Land and building ask "another?"; every other step has one choice, so it moves on.
    if (a.kind === 'anchor' || a.kind === 'build' || a.kind === 'raise') setAgain(true);
    else if (turnStep < Step.Check) goTo((turnStep + 1) as Step);
  };

  /** Tax and the workshops are settings: the step's one choice is replaced (null keeps last turn's). */
  const setting = (a: Action | null) => {
    if (turnStep === null || (a && planned && problemWith(planned, a, prices))) return;
    setPicks((list) => [...list.filter((x) => x.step !== turnStep), ...(a ? [{ step: turnStep, action: a }] : [])]);
  };

  /** Back one step: that step's choices (and this one's) are taken away, so it can be chosen again. */
  const stepBack = () => {
    if (turnStep === null || turnStep <= Step.Collect) return;
    const to = (turnStep - 1) as Step;
    setPicks((list) => list.filter((x) => x.step < to));
    goTo(to);
  };

  /** Back to My island without playing: the choices are dropped and the turn isn't used. */
  const leave = () => {
    setPicks([]);
    setSpot(null);
    setAgain(false);
    setScreen({ kind: 'home' });
  };

  const fail = (e: unknown) => {
    if (e instanceof IslesError && e.code === 'stale') return void load();
    setProblem(e instanceof Error ? e.message : 'Something went wrong. Try again.');
  };

  const startTurn = () => {
    if (!view || !island) return;
    setPicks([]);
    setProblem(null);
    setWindy(view.question?.answered?.right === true);
    goTo(Step.Report);
  };

  const endTurn = async () => {
    if (!island) return;
    setBusy(true);
    setProblem(null);
    try {
      const v = (await backend.send({ action: 'turn', turn: island.turn, actions })) as unknown as IslandView;
      show(v);
      setLit(null);
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

  const showMe = (target: string | undefined) => {
    if (!target) return;
    // Between turns, a button that lives on a step of the turn lights up "Play a turn"; it stays lit for when that
    // step comes.
    setLit(target);
    const el = document.querySelector<HTMLElement>(`[data-pip="${screen.kind === 'home' && stepOf(target) !== null ? 'play' : target}"]`);
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

  if (screen.kind === 'race') {
    return (
      <div className="si">
        <Race
          backend={backend}
          open={screen.open}
          keeper={view.keeper}
          onProblem={(message) => {
            setProblem(message);
            setScreen({ kind: 'home' });
          }}
          onDone={(after) => {
            if (after) setView((v) => (v ? { ...v, island: after, openRace: null } : v));
            setScreen({ kind: 'home' });
          }}
        />
      </div>
    );
  }

  const step = nextStep(shownIsland);
  // In a turn Pip talks about this step only: his next step if it's about this step, or the step's own line.
  const pipHere = turnStep === null || stepOf(step.target) === turnStep;
  const pipSays = island.turnsLeft < 1 && screen.kind === 'home' ? 'Your island is resting. See you tomorrow!' : pipHere ? step.say : STEP_PIP[turnStep!];
  const pipLine = (
    <div className="si-pipsays si-next" aria-live="polite">
      <Art src={pipArt('point')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
      <p>{pipSays}</p>
      {step.target && pipHere && island.turnsLeft > 0 && <button type="button" className="button button--light si-showme" onClick={() => showMe(step.target)}>Show me</button>}
    </div>
  );
  const raceWhy = raceProblem(island, GULL_RIDERS, 'me');
    const back = () => setScreen(screen.kind === 'upgrades' || screen.kind === 'howto' ? screen.back : { kind: 'home' });

  return (
    <div className="si">
      <header className={`si-top${turnStep !== null ? ' si-top--turn' : ''}`}>
        {screen.kind === 'turn' ? <h2>Your turn</h2> : <h2 ref={heading} tabIndex={-1}>{HEADINGS[screen.kind]}</h2>}
        {turnStep !== null && <StepStrip step={turnStep} />}
        <div className="si-top__right">
          {turnStep !== null && canStop(turnStep) && <button type="button" className="button button--light si-stop" onClick={leave}>Stop, back to my island</button>}
          <TurnPips left={island.turnsLeft} />
          {view.keeper && (
            <button type="button" className="si-keeperbtn" onClick={() => setScreen({ kind: 'keeper', first: false })} aria-label="Change your Sky Keeper">
              <Art src={keeperArt(view.keeper, true)} fallback={<span className="si-keeper__drawn">?</span>} />
            </button>
          )}
        </div>
      </header>

      <Resources island={shownIsland} />

      {screen.kind === 'howto' ? (
        <section className="si-panel">
          <HowToPlayBody />
          <button type="button" className="button button--primary" onClick={back}>Back</button>
        </section>
      ) : screen.kind === 'upgrades' ? (
        <section className="si-panel">
          <Upgrades island={shownIsland} prices={prices} lit={lit} />
          <button type="button" className="button button--primary" onClick={back}>Back</button>
        </section>
      ) : (
        <div className="si-main">
          <div className="si-left">
            <IslandPicture
              island={shownIsland}
              keeper={view.keeper}
              selected={spot}
              lit={lit}
              onSpot={screen.kind === 'home' || (turnStep === Step.Build && !again) ? (i) => setSpot((s) => (s === i ? null : i)) : undefined}
              onDrift={turnStep === Step.Land ? () => choose({ kind: 'anchor' }) : undefined}
            />
            {turnStep === null ? <Road island={shownIsland} /> : pipLine}
          </div>

          <div className="si-right">
            {turnStep === null && pipLine}

            {spot !== null && screen.kind === 'home' && <SpotPanel island={shownIsland} spot={spot} onClose={() => setSpot(null)} />}

            {screen.kind === 'home' && (
              <section className="si-panel si-home">
                {island.turnsLeft < 1 ? (
                  <div className="si-resting">
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
                      disabled={!view.races || raceWhy !== null}
                      aria-describedby={!view.races || raceWhy ? 'si-race-why' : undefined}
                      onClick={() => setScreen({ kind: 'race', open: null })}
                    >
                      Sky Race
                    </button>
                    {(!view.races || raceWhy) && <span id="si-race-why" className="si-choice__why">{!view.races ? 'Sky Races are switched off for your class.' : PROBLEM_TEXT[raceWhy!]}</span>}
                  </div>
                  <button type="button" className="button button--light" onClick={() => setScreen({ kind: 'upgrades', back: { kind: 'home' } })}>Upgrades</button>
                  <button type="button" className="button button--light" onClick={() => setScreen({ kind: 'howto', back: { kind: 'home' } })}>How to play</button>
                </div>
                <div className="si-soon">
                  <button type="button" className={`button button--light${lit === 'market' ? ' si-lit' : ''}`} data-pip="market" disabled aria-describedby="si-soon-words">Class sky</button>
                  <button type="button" className="button button--light" disabled aria-describedby="si-soon-words">Market</button>
                  <span id="si-soon-words" className="si-choice__why">The class sky, the market and the news are coming soon.</span>
                </div>
                {problem && <p className="si-problem" role="alert">{problem}</p>}
              </section>
            )}

            {turnStep !== null && planned && (
              <TurnStep
                step={turnStep}
                island={planned}
                before={steps[picks.filter((x) => x.step < turnStep).length] ?? planned}
                prices={prices}
                done={picks.flatMap((x, i) => (x.step === turnStep ? [actionText(steps[i], x.action)] : []))}
                allLines={picks.map((x, i) => actionText(steps[i], x.action))}
                again={again}
                spot={spot}
                lit={lit}
                busy={busy}
                problem={problem}
                headingRef={heading}
                reportLines={island.turn === 0 ? ['Welcome to your island! The wind is calm and the sky is clear.'] : reportLines(report)}
                collectLines={collectLines(island, windy)}
                windy={windy}
                question={view.question ? { answered: view.question.answered ?? null } : null}
                onNext={() => goTo(Math.min(turnStep + 1, Step.Check) as Step)}
                onBack={stepBack}
                onChoose={choose}
                onSetting={setting}
                onAnother={() => setAgain(false)}
                onUndo={() => setPicks((list) => list.slice(0, -1))}
                onEnd={() => void endTurn()}
                onHome={leave}
              />
            )}
          </div>
        </div>
      )}

      {turnStep === Step.Question && asking && view.question && (
        <QuestionModal
          question={{ ...view.question, id: island.turn * 10 + view.question.slot }}
          title="The sky pilot's question"
          note="Get it right for a fair wind: everything grows more this turn!"
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
