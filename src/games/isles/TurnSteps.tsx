/**
 * A turn, one step at a time (docs/ISLES-COSY-PLAN.md, section 3): the same 4 steps in the same order every turn, one
 * choice on each screen. A choice that can't be made is still shown, greyed out, with the reason, so a pupil always
 * knows where they are. Every price and every "why not" comes from the rules (problemWith), worked out on the island
 * as it will be after the choices so far.
 */
import type { ReactNode, Ref } from 'react';
import { LIGHTHOUSE, type DecorationId } from '../../../shared/isles/config';
import { decoration, isGrandIsle, type Action, type Island } from '../../../shared/isles/engine';
import { Choice } from './Choice';
import { PlacePicker, Shelf } from './Decorations';
import { spotName } from './Island';
import { SpotChoices } from './Spot';
import { costOf, n, plural } from './words';

export const STEP_NAMES = ["The sky pilot's question", 'Collect', 'Build', 'Race or rest'] as const;
export const STEPS = STEP_NAMES.length;
/** Each step's number (1 to 4). */
export const Step = { Question: 1, Collect: 2, Build: 3, Rest: 4 } as const;
export type Step = (typeof Step)[keyof typeof Step];

/** What Pip says on each step (when his next step isn't about this step). */
export const STEP_PIP: Record<number, string> = {
  [Step.Question]: 'Get it right for a fair wind: more coins this turn!',
  [Step.Collect]: 'This is what your island made this turn.',
  [Step.Build]: 'Tap a spot to build, the drifting land to anchor it, or Decorate for something pretty.',
  [Step.Rest]: 'Race the Gull Riders if you like, then end your turn.',
};

/** The step that holds the button a `data-pip` name means (null: it's on My island, between turns). */
export function stepOf(target: string | undefined | null): Step | null {
  if (!target) return null;
  if (target.startsWith('spot-') || target.startsWith('decorate') || target.startsWith('place-') || target === 'drift' || target === 'lighthouse') return Step.Build;
  if (target === 'race' || target === 'end-turn') return Step.Rest;
  return null;
}

/** Steps 3 and 4 have a way out: back to My island without playing (the turn isn't used). */
export const canStop = (step: Step) => step >= Step.Build;

/** The strip at the top of a turn: "Step 3 of 4: Build", with a dot for each step. */
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

/** What the Build step is showing: the island, one spot, the decoration shelf, or where a decoration goes. */
export type BuildView =
  | { kind: 'island' }
  | { kind: 'spot'; spot: number }
  | { kind: 'shelf' }
  | { kind: 'place'; id: DecorationId }
  | { kind: 'move'; decoration: number };

export interface StepProps {
  step: Step;
  /** The island as it will be after the choices so far. */
  island: Island;
  /** Every choice this turn, in words. */
  lines: string[];
  /** A choice was just made: ask "another?". */
  again: boolean;
  build: BuildView;
  lit: string | null;
  busy: boolean;
  problem: string | null;
  headingRef: Ref<HTMLHeadingElement>;
  collectLines: string[];
  windy: boolean;
  question: { answered: { right: boolean } | null } | null;
  /** Why a Sky Race can't start now (null: it can). */
  raceWhy: string | null;
  onNext: () => void;
  onBack: () => void;
  onChoose: (a: Action) => void;
  onBuild: (view: BuildView) => void;
  onAnother: () => void;
  onUndo: () => void;
  onRace: () => void;
  onEnd: () => void;
}

/** This turn's choices so far, with Undo. */
function SoFar({ lines, onUndo }: { lines: string[]; onUndo: () => void }) {
  if (!lines.length) return null;
  return (
    <div className="si-sofar">
      <p className="si-note">This turn:</p>
      <ol className="si-step__check">{lines.map((line, i) => <li key={i}>{line}</li>)}</ol>
      <button type="button" className="button button--light" onClick={onUndo}>Undo last</button>
    </div>
  );
}

export function TurnStep(p: StepProps) {
  const { step, island } = p;
  let title: string = STEP_NAMES[step - 1];
  let body: ReactNode = null;
  /** The main buttons, right of Back. */
  let main: ReactNode = null;
  const next = (label = 'Next') => <button type="button" className="button button--primary si-step__main" onClick={p.onNext}>{label}</button>;
  const doneBuilding = next('Done building');
  const toIsland = <button type="button" className="button button--light" onClick={() => p.onBuild({ kind: 'island' })}>Back to the island</button>;

  switch (step) {
    case Step.Question: {
      const a = p.question?.answered;
      body = !p.question ? <p>There's no question this turn.</p>
        : !a ? <p>The sky pilot is asking…</p>
        : a.right ? <p className="si-wind">You got it right: a fair wind is blowing this turn!</p>
        : <p>Not this time. You haven't lost anything.</p>;
      if (!p.question || a) main = next();
      break;
    }

    case Step.Collect:
      title = `Collect${p.windy ? ': fair wind!' : ''}`;
      body = (
        <>
          {p.windy && <p className="si-wind">The fair wind is blowing: your coins grow this turn.</p>}
          <ul className="si-sums">{p.collectLines.map((line) => <li key={line}>{line}</li>)}</ul>
          <p><strong>Coins to spend: {n(island.coins)}</strong></p>
        </>
      );
      main = next();
      break;

    case Step.Build: {
      const b = p.build;
      if (p.again) {
        title = 'Build more?';
        body = (
          <>
            <p>Done: {p.lines[p.lines.length - 1]}.</p>
            <p>You have {plural(island.coins, 'coin')} left.</p>
          </>
        );
        main = (
          <>
            <button type="button" className="button button--light si-step__main" onClick={p.onAnother}>Yes, build more</button>
            {doneBuilding}
          </>
        );
      } else if (b.kind === 'spot' && island.spots[b.spot]) {
        const here = island.spots[b.spot];
        title = `Spot ${b.spot + 1}: ${spotName(here.kind, here.level)}`;
        body = <SpotChoices island={island} spot={b.spot} onChoose={p.onChoose} />;
        main = toIsland;
      } else if (b.kind === 'shelf') {
        title = 'Decorate';
        body = <Shelf island={island} lit={p.lit} onBuy={(id) => p.onBuild({ kind: 'place', id })} onMove={(i) => p.onBuild({ kind: 'move', decoration: i })} />;
        main = toIsland;
      } else if (b.kind === 'place' || b.kind === 'move') {
        const id = b.kind === 'place' ? b.id : island.decorations[b.decoration]?.id;
        const name = (id && decoration(id)?.name.toLowerCase()) || 'decoration';
        title = b.kind === 'place' ? `Where should it go?` : `Move the ${name}`;
        body = (
          <PlacePicker
            island={island}
            name={name}
            moving={b.kind === 'move'}
            onPlace={(place) => {
              if (b.kind === 'place' && place !== null) p.onChoose({ kind: 'decorate', id: b.id, place });
              else if (b.kind === 'move') p.onChoose({ kind: 'move', decoration: b.decoration, place });
            }}
            onCancel={() => p.onBuild({ kind: 'shelf' })}
          />
        );
      } else {
        const anchor: Action = { kind: 'anchor' };
        const light: Action = { kind: 'lighthouse' };
        const lightReady = isGrandIsle(island) && island.lighthouse < LIGHTHOUSE.length;
        body = (
          <>
            <p>Tap a spot on your island to build, change or raise a building. Or:</p>
            <div className="si-actions">
              {island.driftLeft > 0 ? (
                <Choice island={island} action={anchor} onChoose={p.onChoose} pip="drift" lit={p.lit} kind="button--light">
                  <span className="si-build__name">Anchor a chunk of land: {costOf(island, anchor)}</span>
                  <span className="si-build__job">{plural(island.driftLeft, 'chunk')} drifting by. Each one is a new building spot.</span>
                </Choice>
              ) : (
                <p className="si-step__why" data-pip="drift">No land in the drift today. More drifts by tomorrow.</p>
              )}
              <button type="button" className={`button button--light si-choice__button${p.lit === 'decorate' ? ' si-lit' : ''}`} data-pip="decorate" onClick={() => p.onBuild({ kind: 'shelf' })}>
                <span className="si-build__name">Decorate</span>
                <span className="si-build__job">Pretty things for your island</span>
              </button>
              {lightReady && (
                <Choice island={island} action={light} onChoose={p.onChoose} pip="lighthouse" lit={p.lit} kind="button--light">
                  <span className="si-build__name">Sky Lighthouse stage {island.lighthouse + 1}</span>
                  <span className="si-build__job">{costOf(island, light)}</span>
                </Choice>
              )}
            </div>
            <SoFar lines={p.lines} onUndo={p.onUndo} />
          </>
        );
        main = doneBuilding;
      }
      break;
    }

    case Step.Rest:
      body = (
        <>
          {p.lines.length ? <ol className="si-step__check">{p.lines.map((line, i) => <li key={i}>{line}</li>)}</ol> : <p>No building this turn. Your coins are saved.</p>}
          <p><strong>Coins left: {n(island.coins)}</strong></p>
          <div className="si-choice">
            <button
              type="button"
              className={`button button--light si-step__main${p.lit === 'race' ? ' si-lit' : ''}`}
              data-pip="race"
              disabled={p.raceWhy !== null || p.busy}
              aria-describedby={p.raceWhy ? 'si-rest-race-why' : undefined}
              onClick={p.onRace}
            >
              Sky Race
            </button>
            {p.raceWhy && <span id="si-rest-race-why" className="si-choice__why">{p.raceWhy}</span>}
          </div>
          {p.problem && <p className="si-problem" role="alert">{p.problem}</p>}
        </>
      );
      main = (
        <button type="button" className={`button button--primary si-step__main si-end${p.lit === 'end-turn' ? ' si-lit' : ''}`} data-pip="end-turn" onClick={p.onEnd} disabled={p.busy}>
          {p.busy ? 'Ending the turn…' : 'End turn'}
        </button>
      );
      break;
  }

  return (
    <section className="si-panel si-step" aria-label={STEP_NAMES[step - 1]}>
      <h3 ref={p.headingRef} tabIndex={-1}>{title}</h3>
      {body}
      <div className="si-row si-step__nav">
        {canStop(step) && <button type="button" className="button button--light" onClick={p.onBack}>Back</button>}
        {main}
      </div>
    </section>
  );
}
