import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, TOPICS, type PracticalSettings } from '../maths/practical';
import { seeded } from '../seededRandom';
import { botOrders } from './bot';
import { cryAskRounds, nextCryQuestion, playCryRound, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { newFight } from './fight';
import { newClan } from './sim';

const settings = (over: Partial<PracticalSettings> = {}): PracticalSettings => ({ ...DEFAULT_PRACTICAL_SETTINGS, enabledTopics: [...TOPICS], yearBand: 5, ...over });

/** Play a whole fight live the way a child might: right, wrong and "No thanks" answers mixed. */
function playLive(seed: number, depth: number, s: PracticalSettings, mood: number) {
  const clan = newClan('balanced', 3);
  const state = newFight(clan.members, depth, seed);
  const random = seeded(mood);
  const rounds: RecordedRound[] = [];
  while (!state.result) {
    const q = nextCryQuestion(state, s);
    const pick = random();
    let cry: CryAnswer | null = null;
    if (q && pick < 0.5) cry = { answer: q.answer, reward: random() < 0.5 ? 'damage' : 'heal' };
    else if (q && pick < 0.8) cry = { answer: q.answer + 1, reward: 'damage' };
    const orders = botOrders(state);
    rounds.push({ orders, cry });
    playCryRound(state, s, orders, cry);
  }
  return { clan, state, rounds };
}

describe('replaying a fight with its recorded Battle Cry answers', () => {
  it('catches a made-up answer: a wrong number in the record is not marked right', () => {
    const live = playLive(8, 3, settings(), 8);
    const doctored = live.rounds.map((r) => (r.cry ? { ...r, cry: { ...r.cry, answer: r.cry.answer === null ? null : r.cry.answer + 1000 } } : r));
    const replay = replayFight(newClan('balanced', 3).members, 3, 8, false, doctored, settings());
    expect(replay.cries.every((c) => !c.correct)).toBe(true);
  });
});

describe('the maths comes in slowly near the top of the Mines', () => {
  it('asks once at depth 0-5, twice at 6-10, and every round from 11 (and in the monster fight)', () => {
    expect([0, 1, 5].map((depth) => cryAskRounds({ depth }))).toEqual([1, 1, 1]);
    expect([6, 10].map((depth) => cryAskRounds({ depth }))).toEqual([2, 2]);
    expect([11, 20].map((depth) => cryAskRounds({ depth }))).toEqual([Infinity, Infinity]);
    expect(cryAskRounds({ depth: 2, monster: {} })).toBe(Infinity);
  });

  /** Play rounds with the given answer for each asked round, and the cries the rounds were played with. */
  function cries(depth: number, answers: ('right' | 'wrong' | 'none')[], reward: 'damage' | 'heal' = 'heal') {
    const s = settings();
    const state = newFight(newClan('balanced', 3).members, depth, 77);
    const played: (string | null)[] = [];
    let n = 0;
    while (!state.result && played.length < 6) {
      const q = nextCryQuestion(state, s);
      const a = answers[n++] ?? 'none';
      // A round with no question sends a made-up right answer: it must make no difference.
      const cry: CryAnswer | null = q && a !== 'none' ? { answer: a === 'right' ? q.answer : q.answer + 1, reward } : null;
      played.push(playCryRound(state, s, botOrders(state), cry).cry);
    }
    return played;
  }

  it('at depth 3 a right first answer powers up every round, and nothing later changes it', () => {
    const got = cries(3, ['right', 'wrong', 'wrong', 'none']);
    expect(got.every((c) => c === 'heal')).toBe(true);
    expect(cries(3, ['wrong', 'right', 'right']).every((c) => c === null)).toBe(true);
  });

  it('at depth 8 the second answer decides the rest of the fight', () => {
    const got = cries(8, ['wrong', 'right', 'wrong'], 'damage');
    expect(got[0]).toBe(null);
    expect(got.slice(1).every((c) => c === 'damage')).toBe(true);
    const lost = cries(8, ['right', 'wrong', 'right'], 'damage');
    expect(lost[0]).toBe('damage');
    expect(lost.slice(1).every((c) => c === null)).toBe(true);
  });

  it('a replay gives the same result as the live fight', () => {
    for (const depth of [2, 7, 14]) {
      const live = playLive(31, depth, settings(), 5);
      const replay = replayFight(newClan('balanced', 3).members, depth, 31, false, live.rounds, settings());
      expect(replay.state).toEqual(live.state);
    }
  });
});
