/**
 * Bella in Goblin Storm. Fixed lines go through the hub's `speak()` with the game's clip folder. A level-up question is
 * read as a row of clips (word pieces and numbers, voiceLines.ts) played one after another; if any clip is missing or
 * won't play, the browser's own voice reads the whole question instead. `onEnd` runs once when she has finished (or
 * at once when there is nothing to say), so the answer clock can start then, and never if she was stopped.
 */
import { speak, stopSpeaking, voiceSlug } from '../../speech';
import { questionPieces, VOICE_FOLDER } from './voiceLines';

let chain = 0;
let playing: HTMLAudioElement | null = null;

/** Stops Bella, whatever she is saying. */
export function hush(): void {
  chain++;
  if (playing) {
    try {
      playing.pause();
    } catch {
      // Already stopped.
    }
    playing = null;
  }
  stopSpeaking();
}

/** Says one of the fixed lines (GUIDE, TIPS). */
export function say(line: string, onEnd?: () => void): void {
  hush();
  speak(line, VOICE_FOLDER, onEnd);
}

/** Reads a level-up question: Bella's clips if she has them all, else the browser's voice. */
export function sayQuestion(spoken: string, onEnd?: () => void): void {
  hush();
  const pieces = questionPieces(spoken);
  if (!pieces || typeof Audio === 'undefined') {
    speak(spoken, undefined, onEnd);
    return;
  }
  const mine = chain;
  // Made up front so the next clip is already loading while one plays.
  const clips = pieces.map((p) => new Audio(`${VOICE_FOLDER}${voiceSlug(p)}.mp3`));
  let i = 0;
  let failed = false;
  const fail = () => {
    if (failed || mine !== chain) return;
    failed = true;
    playing = null;
    speak(spoken, undefined, onEnd);
  };
  const next = () => {
    if (failed || mine !== chain) return;
    if (i >= clips.length) {
      playing = null;
      onEnd?.();
      return;
    }
    const a = clips[i++];
    playing = a;
    a.addEventListener('ended', next, { once: true });
    a.addEventListener('error', fail, { once: true });
    try {
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(fail);
    } catch {
      fail();
    }
  };
  next();
}
