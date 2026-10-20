import { describe, expect, it } from 'vitest';
import { seeded } from '../seededRandom';
import { findBondSet } from './bonds';
import { BOT_MEMORY, botView, chooseFlip, remember, rememberFlip, type BotLevel, type Memory } from './bot';
import { buildDeck, partnersOf } from './deck';
import { flip, newGame, type GameState } from './engine';
import { replay } from './save';

const LEVELS: BotLevel[] = ['very-easy', 'easy', 'medium'];
const game = (id = 'whole-10', seed = 7, size: 'small' | 'medium' | 'large' = 'medium') => newGame(buildDeck(findBondSet(id)!, size, seed));

/** The computer plays a whole game alone, remembering what it sees. Returns the finished state. */
function botPlays(start: GameState, level: BotLevel, random: () => number): GameState {
  let state = start;
  let memory: Memory = [];
  for (let n = 0; !state.finished; n++) {
    if (n > 2000) throw new Error('the computer never finished');
    const r = flip(state, chooseFlip(botView(state, memory), level, random));
    if (r.refused) throw new Error(`the computer made an illegal flip (${r.refused})`);
    state = r.state;
    memory = rememberFlip(memory, state, r.events, level);
  }
  return state;
}

describe('the computer player', () => {
  it('is never given the deck: its view holds only the target, the matched cards, the waiting card and its memory', () => {
    const view = botView(flip(game(), 0).state, []);
    expect(Object.keys(view).sort()).toEqual(['matched', 'memory', 'target', 'waiting']);
    expect(view.waiting).toBe(0);
  });

  it.each(LEVELS)('finishes every game on %s with only legal flips, and the game replays on the server', (level) => {
    for (const [id, size] of [['whole-10', 'small'], ['fraction-quarters', 'medium'], ['decimal-1-tenths', 'large']] as const) {
      const set = findBondSet(id)!;
      const start = newGame(buildDeck(set, size, 11));
      const done = botPlays(start, level, seeded(5));
      expect(done.finished).toBe(true);
      const check = replay({ seed: 11, bondId: set.id, size, flips: [...done.log], seconds: 600 });
      expect(check.ok).toBe(true);
    }
  });

  it('picks the partner of the waiting card when it remembers it', () => {
    const s = game();
    const p = partnersOf(s.deck)[0][0];
    let memory: Memory = remember([], p, s.deck.cards[p], 'medium');
    const after = flip(s, 0);
    memory = rememberFlip(memory, after.state, after.events, 'medium');
    expect(chooseFlip(botView(after.state, memory), 'medium', () => 0.99)).toBe(p);
  });

  it('starts a turn with a pair it remembers', () => {
    const s = game();
    const p = partnersOf(s.deck)[3][0];
    const memory = remember(remember([], 3, s.deck.cards[3], 'easy'), p, s.deck.cards[p], 'easy');
    expect(chooseFlip(botView(s, memory), 'easy', () => 0.99)).toBe(3);
  });

  it('forgets the oldest card when its memory is full, by level', () => {
    const s = game();
    for (const level of LEVELS) {
      let memory: Memory = [];
      for (let i = 0; i < 12; i++) memory = remember(memory, i, s.deck.cards[i], level);
      expect(memory.map((m) => m.index)).toEqual(Array.from({ length: BOT_MEMORY[level].cards }, (_, k) => 12 - BOT_MEMORY[level].cards + k));
    }
  });

  it('never picks a matched card or the card already waiting', () => {
    let s = game();
    const p = partnersOf(s.deck)[0][0];
    s = flip(flip(s, 0).state, p).state;
    s = flip(s, 1 === p ? 2 : 1).state;
    const random = seeded(3);
    for (let n = 0; n < 200; n++) {
      const pick = chooseFlip(botView(s, []), 'very-easy', random);
      expect(s.matched[pick]).toBe(false);
      expect(s.shown).not.toContain(pick);
    }
  });

  it('gets better with level: more memory means fewer flips on average', () => {
    const average = (level: BotLevel) => {
      let total = 0;
      for (let seed = 0; seed < 30; seed++) total += botPlays(game('whole-20', seed, 'large'), level, seeded(seed + 100)).flips;
      return total / 30;
    };
    const [veryEasy, easy, medium] = LEVELS.map(average);
    expect(veryEasy).toBeGreaterThan(easy);
    expect(easy).toBeGreaterThan(medium);
  });
});
