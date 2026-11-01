/**
 * A turn, one step at a time (docs/ISLES-PLAN.md, section 2): the same 11 steps in the same order every turn, one choice
 * on each screen. A step that can't happen is still shown, greyed out, with the reason and a Next button, so a pupil
 * always knows where they are. Every price and every "why not" comes from the rules (problemWith), worked out on the
 * island as it will be after the earlier steps' choices.
 */
import type { ReactNode, Ref } from 'react';
import { BUILD_COINS, FESTIVAL_COINS, FESTIVAL_HAPPINESS, PLOT_KINDS, UPGRADES, type TaxLevel } from '../../../shared/isles/config';
import { count, has, problemWith, type Action, type Island, type Prices } from '../../../shared/isles/engine';
import { Choice } from './Choice';
import { spotName } from './Island';
import { SpotChoices, TAX_WORDS } from './Spot';
import { costOf, n, plural, whyNot } from './words';

export const STEP_NAMES = [
  'Island report', 'Question', 'Collect', 'Land', 'Build', 'Tax', 'Workshops', 'Festival', 'Big projects', 'Market', 'Check and end',
] as const;
export const STEPS = STEP_NAMES.length;
/** Each step's number (1 to 11). */
export const Step = { Report: 1, Question: 2, Collect: 3, Land: 4, Build: 5, Tax: 6, Workshops: 7, Festival: 8, Projects: 9, Market: 10, Check: 11 } as const;
export type Step = (typeof Step)[keyof typeof Step];

/** What Pip says on each step (when his next step isn't about this step). */
export const STEP_PIP: Record<number, string> = {
  [Step.Report]: "Here's what happened on your island.",
  [Step.Question]: 'Get it right for a fair wind: everything grows more this turn!',
  [Step.Collect]: 'This is what your island made, and what your people ate.',
  [Step.Land]: 'More land means more spots to build on.',
  [Step.Build]: 'Tap a spot to build, change or raise a building.',
  [Step.Tax]: 'Tax brings coins, but high tax makes people grumpy.',
  [Step.Workshops]: 'Choose what your Workshops make.',
  [Step.Festival]: 'A festival makes your people happier.',
  [Step.Projects]: 'Ideas unlock upgrades. A Grand Isle can build the Sky Lighthouse.',
  [Step.Market]: "Soon you'll trade food and goods with your class here.",
  [Step.Check]: 'Check your choices, then end your turn.',
};

/** The step that holds the button a `data-pip` name means (null: it's on My island, between turns). */
export function stepOf(target: string | undefined | null): Step | null {
  if (!target) return null;
  if (target.startsWith('spot-')) return Step.Build;
  if (target === 'drift') return Step.Land;
  if (target.startsWith('upgrade-') || target === 'lighthouse') return Step.Projects;
  if (target === 'market') return Step.Market;
  if (target === 'end-turn') return Step.Check;
  return null;
}

/** Steps 4 to 11 have a way out: back to My island without playing (the turn isn't used). */
export const canStop = (step: Step) => step > Step.Collect;

/** The strip at the top of a turn: "Step 5 of 11: Build", with a dot for each step. */
export function StepStrip({ step }: { step: number }) {
  const label = `Step ${step} of ${STEPS}: ${STEP_NAMES[step - 1]}`;
  return (
    <div className="si-steps" role="img" aria-label={label}>
      <span className="si-steps__dots" aria-hidden="true">
        {STEP_NAMES.map((name, i) => <span key={name} className={i + 1 < step ? 'si-steps__done' : i + 1 === step ? 'si-steps__now' : ''} />)}
      </span>
      <span className="si-steps__words" aria-hidden="true">{label}</span>
    </div>
  );
}

/** Can anything be built, changed or raised on this island now? */
function canBuild(island: Island, prices: Prices): boolean {
  return island.spots.some((_, spot) =>
    problemWith(island, { kind: 'raise', spot }, prices) === null ||
    PLOT_KINDS.some((plot) => problemWith(island, { kind: 'build', spot, plot }, prices) === null));
}

/** Why nothing can be built: the cheapest building, said with the numbers. */
function whyNoBuild(island: Island, prices: Prices): string {
  const plot = [...PLOT_KINDS].sort((a, b) => BUILD_COINS[a] - BUILD_COINS[b])[0];
  const spot = Math.max(0, island.spots.findIndex((s) => s.kind !== plot));
  const action: Action = { kind: 'build', spot, plot };
  const problem = problemWith(island, action, prices);
  return problem ? whyNot(island, action, problem) : '';
}

export interface StepProps {
  step: Step;
  /** The island as it will be after the choices so far. */
  island: Island;
  /** The island before this step's own choices (for the settings already picked last turn). */
  before: Island;
  prices: Prices;
  /** This step's choices so far, in words. */
  done: string[];
  /** Every choice this turn, in words (for the check). */
  allLines: string[];
  /** A choice was just made: ask "another?". */
  again: boolean;
  spot: number | null;
  lit: string | null;
  busy: boolean;
  problem: string | null;
  headingRef: Ref<HTMLHeadingElement>;
  /** Steps 1 to 3. */
  reportLines: string[];
  collectLines: string[];
  windy: boolean;
  question: { answered: { right: boolean } | null } | null;
  onNext: () => void;
  onBack: () => void;
  onChoose: (a: Action) => void;
  /** Tax or workshops: the new setting, or null to keep last turn's. */
  onSetting: (a: Action | null) => void;
  onAnother: () => void;
  onUndo: () => void;
  onEnd: () => void;
  onHome: () => void;
}

export function TurnStep(p: StepProps) {
  const { step, island, prices } = p;
  const later = canStop(step);
  let title: string = STEP_NAMES[step - 1];
  let off = false;
  let body: ReactNode = null;
  /** The main buttons, right of Back. */
  let main: ReactNode = null;
  const next = (label = 'Next') => <button type="button" className="button button--primary si-step__main" onClick={p.onNext}>{label}</button>;
  const notNow = <button type="button" className="button button--light" onClick={p.onNext}>Not this turn</button>;

  switch (step) {
    case Step.Report:
      body = <ul className="si-sums">{p.reportLines.map((line) => <li key={line}>{line}</li>)}</ul>;
      main = (
        <>
          <button type="button" className="button button--primary si-step__main" onClick={p.onNext}>Start my turn</button>
          <button type="button" className="button button--light" onClick={p.onHome}>Back to my island</button>
        </>
      );
      break;

    case Step.Question: {
      title = "The sky pilot's question";
      const a = p.question?.answered;
      body = !p.question ? <p>There's no question this turn.</p>
        : !a ? <p>The sky pilot is asking…</p>
        : a.right ? <p className="si-wind">You got it right: a fair wind is blowing this turn!</p>
        : <p>Not this time. You haven't lost anything.</p>;
      if (!p.question || a) main = next();
      break;
    }

    case Step.Collect:
      title = `Collect and feed${p.windy ? ': fair wind!' : ''}`;
      body = (
        <>
          {p.windy && <p className="si-wind">The fair wind is blowing: everything grows more this turn.</p>}
          <ul className="si-sums">{p.collectLines.map((line) => <li key={line}>{line}</li>)}</ul>
        </>
      );
      main = next();
      break;

    case Step.Land: {
      const anchor: Action = { kind: 'anchor' };
      const problem = problemWith(island, anchor, prices);
      if (p.again) {
        title = problem ? 'Land anchored' : 'Anchor another?';
        body = (
          <>
            <p>{p.done.length === 1 ? 'You anchored a chunk: ' : `You anchored ${p.done.length} chunks: `}spot {island.spots.length} is waiting for a building.</p>
            {problem ? <p className="si-step__why">No more this turn. {whyNot(island, anchor, problem)}</p> : <p>Anchor another chunk for {costOf(island, anchor)}?</p>}
          </>
        );
        main = problem ? next() : (
          <>
            <button type="button" className={`button button--primary si-step__main${p.lit === 'drift' ? ' si-lit' : ''}`} data-pip="drift" onClick={() => p.onChoose(anchor)}>Yes</button>
            <button type="button" className="button button--light" onClick={p.onNext}>No, thanks</button>
          </>
        );
      } else {
        off = problem !== null;
        body = problem === 'no-drift' ? (
          <p className="si-step__why" data-pip="drift">{whyNot(island, anchor, problem)} More land drifts by tomorrow.</p>
        ) : (
          <>
            <p>Anchor a chunk of land from the drift for {costOf(island, anchor)}?</p>
            <p className="si-note">{plural(island.driftLeft, 'chunk')} drifting by. Each one is a new building spot.</p>
            {off && <Choice island={island} prices={prices} action={anchor} onChoose={p.onChoose} pip="drift" lit={p.lit} kind="button--light">Anchor it</Choice>}
          </>
        );
        main = off ? next() : (
          <>
            <button type="button" className={`button button--primary si-step__main${p.lit === 'drift' ? ' si-lit' : ''}`} data-pip="drift" onClick={() => p.onChoose(anchor)}>Anchor it</button>
            {notNow}
          </>
        );
      }
      break;
    }

    case Step.Build: {
      const can = canBuild(island, prices);
      if (p.again) {
        title = can ? 'Build another?' : 'Building done';
        body = (
          <>
            <p>Done: {p.done[p.done.length - 1]}.</p>
            {!can && <p className="si-step__why">No more this turn. {whyNoBuild(island, prices)}</p>}
          </>
        );
        main = can ? (
          <>
            <button type="button" className="button button--primary si-step__main" onClick={p.onAnother}>Yes</button>
            <button type="button" className="button button--light" onClick={p.onNext}>No, thanks</button>
          </>
        ) : next();
      } else if (p.spot !== null && island.spots[p.spot] && can) {
        const here = island.spots[p.spot];
        title = `Spot ${p.spot + 1}: ${spotName(here.kind, here.level)}`;
        body = <SpotChoices island={island} spot={p.spot} prices={prices} onChoose={p.onChoose} />;
        main = notNow;
      } else {
        off = !can;
        body = off
          ? <p className="si-step__why">{whyNoBuild(island, prices)}</p>
          : <p>Tap a spot on your island. You can build on an empty spot, or change or raise a building.</p>;
        main = off ? next() : notNow;
      }
      break;
    }

    case Step.Tax:
      body = (
        <>
          <p>Pick the tax. Last turn's is already picked.</p>
          <div className="si-tax" role="radiogroup" aria-label="Tax">
            {(['low', 'fair', 'high'] as TaxLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={island.tax === level}
                className={`si-tax__option${island.tax === level ? ' si-tax__option--on' : ''}`}
                onClick={() => p.onSetting(level === p.before.tax ? null : { kind: 'tax', level })}
              >
                <strong>{level[0].toUpperCase() + level.slice(1)}{island.tax === level ? ' ✓' : ''}</strong>
                <span>{TAX_WORDS[level]}</span>
              </button>
            ))}
          </div>
        </>
      );
      main = next();
      break;

    case Step.Workshops: {
      const workshops = count(island, 'workshop');
      off = workshops === 0;
      body = off ? (
        <p className="si-step__why">You have no Workshop yet. Build one to make sky-boats and goods.</p>
      ) : (
        <>
          <p>What should your {workshops === 1 ? 'Workshop' : 'Workshops'} make? Last turn's choice is set.</p>
          <label className="si-slider">
            <span>Sky-boats {island.boatShare}% · goods {100 - island.boatShare}%</span>
            <input
              type="range" min={0} max={100} step={25} value={island.boatShare}
              onChange={(e) => {
                const boatShare = Number(e.target.value);
                p.onSetting(boatShare === p.before.boatShare ? null : { kind: 'workshop', boatShare });
              }}
            />
          </label>
          <p className="si-note">Sky-boats make you faster in races. Goods raise buildings to level 3 and build the Lighthouse.</p>
        </>
      );
      main = next();
      break;
    }

    case Step.Festival: {
      const festival: Action = { kind: 'festival' };
      off = problemWith(island, festival, prices) !== null;
      body = (
        <>
          <p>Hold a festival this turn? Your people get happier.</p>
          {off && <Choice island={island} prices={prices} action={festival} onChoose={p.onChoose} kind="button--light">Hold a festival ({n(FESTIVAL_COINS)} coins, +{FESTIVAL_HAPPINESS} happy)</Choice>}
        </>
      );
      main = off ? next() : (
        <>
          <button type="button" className="button button--primary si-step__main" onClick={() => p.onChoose(festival)}>Hold a festival ({n(FESTIVAL_COINS)} coins, +{FESTIVAL_HAPPINESS} happy)</button>
          {notNow}
        </>
      );
      break;
    }

    case Step.Projects: {
      const wanted = UPGRADES.filter((u) => !has(island, u.id));
      const ready = wanted.filter((u) => problemWith(island, { kind: 'upgrade', id: u.id }, prices) === null);
      const notYet = wanted.filter((u) => !ready.includes(u));
      const light: Action = { kind: 'lighthouse' };
      const lightProblem = problemWith(island, light, prices);
      const lightDone = lightProblem === 'lighthouse-done';
      off = ready.length === 0 && lightProblem !== null;
      const first = notYet[0];
      const firstProblem = first ? problemWith(island, { kind: 'upgrade', id: first.id }, prices) : null;
      body = (
        <>
          <p>Unlock an upgrade or build the Sky Lighthouse? You have {plural(Math.floor(island.ideas), 'idea')}.</p>
          {(ready.length > 0 || !lightProblem) && (
            <div className="si-buildgrid">
              {!lightProblem && (
                <Choice island={island} prices={prices} action={light} onChoose={p.onChoose} pip="lighthouse" lit={p.lit} kind="button--light">
                  <span className="si-build__name">Sky Lighthouse stage {island.lighthouse + 1}</span>
                  <span className="si-build__job">{costOf(island, light)}</span>
                </Choice>
              )}
              {ready.map((u) => (
                <Choice key={u.id} island={island} prices={prices} action={{ kind: 'upgrade', id: u.id }} onChoose={p.onChoose} pip={`upgrade-${u.id}`} lit={p.lit} kind="button--light">
                  <span className="si-build__name">{u.name}: {plural(u.ideas, 'idea')}</span>
                  <span className="si-build__job">{u.does[0].toUpperCase() + u.does.slice(1)}</span>
                </Choice>
              ))}
            </div>
          )}
          <ul className="si-step__greyed">
            {first && firstProblem && (
              <li data-pip={`upgrade-${first.id}`}>
                {first.name}: {whyNot(island, { kind: 'upgrade', id: first.id }, firstProblem)}
                {notYet.length > 1 ? ` ${plural(notYet.length - 1, 'more upgrade')} ${notYet.length === 2 ? 'needs' : 'need'} more ideas.` : ''}
              </li>
            )}
            {lightProblem && !lightDone && <li data-pip="lighthouse">Sky Lighthouse: {whyNot(island, light, lightProblem)}</li>}
            {lightDone && <li>Your Sky Lighthouse is lit!</li>}
          </ul>
        </>
      );
      main = off ? next() : notNow;
      break;
    }

    case Step.Market:
      off = true;
      body = (
        <div className="si-choice">
          <button type="button" className={`button button--light${p.lit === 'market' ? ' si-lit' : ''}`} data-pip="market" disabled aria-describedby="si-market-soon">Market</button>
          <span id="si-market-soon" className="si-choice__why">The market opens soon. Then you can trade food and goods with your class here.</span>
        </div>
      );
      main = next();
      break;

    case Step.Check:
      body = (
        <>
          {p.allLines.length ? <ol className="si-step__check">{p.allLines.map((line, i) => <li key={i}>{line}</li>)}</ol> : <p>No choices this turn. Your coins are saved.</p>}
          <p><strong>Coins left: {n(island.coins)}</strong></p>
          {p.problem && <p className="si-problem" role="alert">{p.problem}</p>}
        </>
      );
      main = (
        <>
          {p.allLines.length > 0 && <button type="button" className="button button--light" onClick={p.onUndo}>Undo last</button>}
          <button type="button" className={`button button--primary si-step__main si-end${p.lit === 'end-turn' ? ' si-lit' : ''}`} data-pip="end-turn" onClick={p.onEnd} disabled={p.busy}>
            {p.busy ? 'Ending the turn…' : 'End turn'}
          </button>
        </>
      );
      break;
  }

  return (
    <section className={`si-panel si-step${off ? ' si-step--off' : ''}`} aria-label={STEP_NAMES[step - 1]}>
      <h3 ref={p.headingRef} tabIndex={-1}>{title}</h3>
      {body}
      <div className="si-row si-step__nav">
        {later && <button type="button" className="button button--light" onClick={p.onBack}>Back</button>}
        {main}
      </div>
    </section>
  );
}
