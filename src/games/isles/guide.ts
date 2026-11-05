/**
 * Pip's guided first go (docs/ISLES-PLAN.md, section 6.7, fitted to the cosy 4-step turn): one short line for where
 * the pupil is now, and the real button it means, lit up. It's worked out fresh from what's on screen each time, so
 * the guide follows the pupil: if they skip ahead, it catches up. It never helps with the maths question.
 *
 * Words are kept plain, for a 9-year-old reading on their own.
 */
import { BUILD_COINS, TURNS_PER_DAY, type PlotKind } from '../../../shared/isles/config';
import type { Island } from '../../../shared/isles/engine';
import { KIND_NAME, wantedKind } from '../../../shared/isles/nextStep';
import { Step, type BuildView } from './TurnSteps';
import { KIND_JOB } from './words';

export interface GuideLine {
  say: string;
  /** The `data-pip` name of the button to light up. */
  target?: string;
}

export interface GuideAt {
  /** The turn step on screen (null: My island, between turns). */
  step: Step | null;
  /** The island as it will be after the choices so far. */
  island: Island;
  build: BuildView;
  /** A choice was just made on the Build step ("Build more?"). */
  again: boolean;
  /** Choices made this turn. */
  picks: number;
}

/** Pip's guide lines that never change, so each can have a recording in Bella's voice. */
export const GUIDE = {
  welcome: `Welcome to your island! You get ${TURNS_PER_DAY} turns a day. Press Play a turn to start your first one.`,
  question: 'Each turn starts with a question from the sky pilot. When you\'ve answered, press Next.',
  collect: 'Every building makes coins each turn. Watch them pop, then press Next to build.',
  rest: 'Last step! Press End turn and your island grows. Sky Races can wait until you\'ve had a look around.',
  wellDone: 'Well done! That will be built when the turn ends. Press Done building.',
  taken: 'This spot has a building already. Go back to the island and tap your empty spot.',
  chooseHere: 'Choose what to do here, or go back to the island.',
  decoration: 'Choose a decoration, or go back to the island to build.',
} as const;

/** "Choose Farm: crops for coins." */
export const chooseLine = (kind: PlotKind) => `Choose ${KIND_NAME[kind]}: ${KIND_JOB[kind]}.`;

export function guideLine(at: GuideAt): GuideLine {
  const { island } = at;
  switch (at.step) {
    case null:
      return { say: GUIDE.welcome, target: 'play' };
    case Step.Question:
      return { say: GUIDE.question, target: 'next' };
    case Step.Collect:
      return { say: GUIDE.collect, target: 'next' };
    case Step.Rest:
      return { say: GUIDE.rest, target: 'end-turn' };
  }

  // The Build step.
  const empty = island.spots.findIndex((s) => s.kind === 'empty');
  const kind = wantedKind(island);
  const canBuild = empty >= 0 && island.coins >= BUILD_COINS[kind];
  if (at.again || (at.build.kind === 'island' && (at.picks > 0 || !canBuild))) {
    return { say: GUIDE.wellDone, target: 'next' };
  }
  if (at.build.kind === 'spot') {
    const here = island.spots[at.build.spot];
    if (here?.kind === 'empty' && island.coins >= BUILD_COINS[kind]) {
      return { say: chooseLine(kind), target: `build-${kind}` };
    }
    return { say: canBuild ? GUIDE.taken : GUIDE.chooseHere, target: canBuild ? 'back-to-island' : undefined };
  }
  if (at.build.kind !== 'island') return { say: GUIDE.decoration, target: 'back-to-island' };
  return { say: `Build time! You have ${island.coins} coins. Tap your empty spot (it's glowing) to build on it.`, target: `spot-${empty}` };
}

/** What Pip says once the guided first turn is played. */
export function celebration(turnsLeft: number): string[] {
  return [
    'Your island grew!',
    `You have ${turnsLeft} turn${turnsLeft === 1 ? '' : 's'} left today. Each turn: a question, collect, build, then race or rest.`,
    "I'll keep a tip for you next to your island. Tap Show me any time and I'll point to the button.",
  ];
}
