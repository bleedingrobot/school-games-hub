/**
 * Goblin Storm's sounds, from the hub's own set (src/games/sounds.ts), played only with the game's sound button on. A
 * busy screen asks for dozens a second, so each frame plays at most two, the most important first, and each sound
 * waits a little before it can play again.
 */
import { playSound, type GameSound } from '../sounds';
import type { Cue } from './renderer';

export type StormSound = Cue | 'warn' | 'evolve' | 'win' | 'fall' | 'pick';

const SOUND: Record<StormSound, GameSound> = {
  hit: 'hop',
  gem: 'flick',
  levelup: 'item',
  wipe: 'chaos',
  hurt: 'tap',
  boss: 'flash',
  'kill-big': 'boom',
  warn: 'alert',
  evolve: 'heal',
  win: 'win',
  fall: 'end',
  pick: 'move',
};

/** The shortest wait (ms) before the same sound plays again. */
const GAP: Record<StormSound, number> = {
  hit: 110, gem: 130, levelup: 500, wipe: 900, hurt: 350, boss: 1500, 'kill-big': 600, warn: 1000, evolve: 800, win: 0, fall: 0, pick: 100,
};

/** Most important first: the first two waiting in this order are the ones played. */
const ORDER: StormSound[] = ['win', 'fall', 'boss', 'warn', 'wipe', 'evolve', 'kill-big', 'levelup', 'hurt', 'pick', 'gem', 'hit'];

export const MAX_SOUNDS_A_FRAME = 2;

const last = new Map<StormSound, number>();

/** Plays up to two of the asked-for sounds and forgets the rest. */
export function playSounds(asked: Set<StormSound>, on: boolean, now = performance.now()): void {
  if (!asked.size) return;
  if (on) {
    let n = 0;
    for (const id of ORDER) {
      if (n >= MAX_SOUNDS_A_FRAME) break;
      if (!asked.has(id) || now - (last.get(id) ?? -1e9) < GAP[id]) continue;
      last.set(id, now);
      playSound(SOUND[id]);
      n++;
    }
  }
  asked.clear();
}
