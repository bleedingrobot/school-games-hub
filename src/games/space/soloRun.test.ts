import { describe, expect, it } from 'vitest';
import type { BotLevel } from '../../../shared/botGame';
import { botAction } from '../../../shared/space/bot';
import type { BoardChoice } from '../../../shared/space/boards';
import { DEFAULT_SETTINGS, type SpaceEvent } from '../../../shared/space/engine';
import { randomFromSeed } from '../../../shared/space/random';
import { replaySolo, type SoloSetup } from '../../../shared/space/replay';
import { botPlay, botQuestion, decideBot, isStudentsTurn, newSeed, startPassRun, startRun, studentPlay } from './soloRun';
import { describe as describeEvent } from './text';

/** Plays a whole game the way the page does, with a "student" that plays like a bot. */
function playWholeGame(setup: SoloSetup) {
  const { run, events } = startRun(setup);
  const all: SpaceEvent[] = [...events];
  const student = randomFromSeed(`student:${setup.seed}`);
  for (let guard = 0; run.state.phase !== 'over'; guard++) {
    if (guard > 5000) throw new Error('game never ended');
    if (isStudentsTurn(run)) all.push(...studentPlay(run, botAction(run.state, 'easy', student)));
    // Round-trip through JSON, like a message to the worker does.
    else all.push(...botPlay(run, decideBot(JSON.parse(JSON.stringify(botQuestion(run))))));
  }
  return { run, events: all };
}

const setups: { board: BoardChoice; bots: number; level: BotLevel; mode: 'cosmic' | 'classic' }[] = [
  { board: { id: 'nebula' }, bots: 3, level: 'medium', mode: 'cosmic' },
  { board: { id: 'deep-space' }, bots: 2, level: 'very-easy', mode: 'cosmic' },
  { board: { id: 'asteroid-belt' }, bots: 1, level: 'easy', mode: 'classic' },
  { board: { galaxy: 'Comet-Kiwi-48', size: 100 }, bots: 3, level: 'easy', mode: 'cosmic' },
];

describe('a bot game played on the page', () => {
  it.each(setups)('replays exactly the way the server will check it ($board, $bots bots, $level)', (s) => {
    for (let i = 0; i < 5; i++) {
      const setup: SoloSetup = {
        seed: `test-${i}`,
        board: s.board,
        settings: { ...DEFAULT_SETTINGS, mode: s.mode, cosmicEvents: true, rollAgainOnSix: i % 2 === 0 },
        bots: s.bots,
        level: s.level,
      };
      const { run } = playWholeGame(setup);
      const replay = replaySolo(setup, run.studentActions);
      expect(replay.ok).toBe(true);
      if (!replay.ok) return;
      expect(replay.finished).toBe(true);
      expect(replay.studentSeat).toBe(run.studentSeat);
      expect(replay.state).toEqual(run.state);
    }
  });

  it('has a mission log line or a screen for every event', () => {
    const names = ['You', 'Pilot Kea', 'Pilot Tui', 'Pilot Weka'];
    for (const s of setups) {
      const { events } = playWholeGame({
        seed: 'log', board: s.board, settings: { ...DEFAULT_SETTINGS, mode: s.mode, cosmicEvents: true }, bots: s.bots, level: s.level,
      });
      for (const event of events) {
        const line = describeEvent(event, names);
        if (line !== null) {
          expect(line).not.toMatch(/undefined|NaN/);
          expect(line.length).toBeGreaterThan(3);
        }
      }
    }
  });

  it('makes a different seed every time', () => {
    const seeds = new Set(Array.from({ length: 50 }, newSeed));
    expect(seeds.size).toBe(50);
    for (const seed of seeds) expect(seed).toMatch(/^local-[0-9a-f]{24}$/);
  });
});

describe('pass-and-play', () => {
  it('lets every seat move, with no bots, until the game ends', () => {
    const { run } = startPassRun({ seed: 'pass-1', board: { id: 'asteroid-belt' }, settings: DEFAULT_SETTINGS }, 4);
    const people = randomFromSeed('people');
    const movers = new Set<number>();
    for (let guard = 0; run.state.phase !== 'over'; guard++) {
      if (guard > 5000) throw new Error('game never ended');
      expect(isStudentsTurn(run)).toBe(true);
      movers.add(run.state.turn);
      studentPlay(run, botAction(run.state, 'easy', people));
    }
    expect(movers).toEqual(new Set([0, 1, 2, 3]));
    expect(isStudentsTurn(run)).toBe(false);
    expect(run.state.places).toHaveLength(4);
    expect(() => botPlay(run, { action: { kind: 'roll' }, draws: 0 })).toThrow();
  });
});
