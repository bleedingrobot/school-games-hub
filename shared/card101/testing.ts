/**
 * Test helpers: plays whole bot games with a bot standing in for the student, the way a
 * real student's browser would, and returns the student's actions for replaying.
 */
import type { BotLevel } from '../botGame';
import { decide, newMemory, observe, type BotMemory } from './bot';
import type { Action } from './engine';
import { randomFromSeed } from './random';
import { applySolo, playBots, startSolo, STUDENT_SEAT, type SoloSetup, type StudentAction } from './solo';
import { viewFor } from './view';

export const toText = (action: Action): StudentAction => {
  switch (action.type) {
    case 'peek-done': return 'peek';
    case 'draw': return `draw:${action.from}`;
    case 'swap': return `swap:${action.slot}`;
    case 'throw': return 'throw';
    case 'knock': return 'knock';
    default: throw new Error(`not a student action: ${action.type}`);
  }
};

/** Plays a whole bot game, with an Easy bot playing the student's seat from the student's view. */
export function playWholeGame(setup: SoloSetup, studentLevel: BotLevel = 'easy', leaveAfter = Infinity) {
  const { solo, events: first } = startSolo(setup);
  let memory: BotMemory = observe(newMemory(STUDENT_SEAT, solo.game.players), viewFor(solo.game, STUDENT_SEAT), first);
  const actions: StudentAction[] = [];
  playBots(solo, (events) => (memory = observe(memory, viewFor(solo.game, STUDENT_SEAT), events)));
  for (let n = 0; solo.game.phase !== 'over'; n++) {
    if (n > 5000) throw new Error('never ended');
    if (actions.length >= leaveAfter) {
      actions.push('leave');
      applySolo(solo, STUDENT_SEAT, { type: 'leave' });
      break;
    }
    if (solo.game.phase === 'round-over') {
      actions.push('next');
      memory = observe(memory, viewFor(solo.game, STUDENT_SEAT), applySolo(solo, 'system', { type: 'next-round' }));
    } else {
      const action = decide(viewFor(solo.game, STUDENT_SEAT), memory, studentLevel, randomFromSeed(`student:${n}`));
      actions.push(toText(action));
      memory = observe(memory, viewFor(solo.game, STUDENT_SEAT), applySolo(solo, STUDENT_SEAT, action));
    }
    playBots(solo, (events) => (memory = observe(memory, viewFor(solo.game, STUDENT_SEAT), events)));
  }
  return { solo, actions };
}

