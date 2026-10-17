/** Helpers for tests: play a whole bot match with a bot standing in for the student. */
import type { BotLevel } from '../botGame';
import { randomFromSeed } from '../space/random';
import { chooseAction } from './bot';
import {
  applyStudent, encodeStudentAction, isStudentTurn, matchIsOver, playOneBot, roundIsOver, startSolo,
  type SoloGame, type SoloSetup,
} from './solo';

/**
 * Plays a match from the setup, with a bot of `studentLevel` making the student's choices.
 * Stops after `leaveAfter` actions (a student who walks away). Returns what the browser would send.
 */
export function playWholeMatch(setup: SoloSetup, studentLevel: BotLevel = 'easy', leaveAfter = Infinity) {
  const solo: SoloGame = startSolo(setup);
  const random = randomFromSeed(`${setup.seed}:student`);
  const actions: string[] = [];
  const runBot = () => {
    while (playOneBot(solo));
  };
  runBot();
  for (let guard = 0; guard < 2000 && !matchIsOver(solo) && actions.length < leaveAfter; guard++) {
    let text: string;
    if (roundIsOver(solo)) text = 'next';
    else if (isStudentTurn(solo)) text = encodeStudentAction(chooseAction(solo.match.state, studentLevel, random));
    else break;
    applyStudent(solo, text);
    actions.push(text);
    runBot();
  }
  return { solo, actions };
}
