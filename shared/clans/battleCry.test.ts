import { expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, TOPICS, type PracticalSettings } from '../maths/practical';
import { seeded } from '../seededRandom';
import { botOrders } from './bot';
import { nextCryQuestion, playCryRound, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
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

it('Battle Cry asks once at every mine depth, and a replay matches the live fight but catches a made-up answer', () => {
  // Shallow or deep: a right first answer powers up every round, and nothing later changes it.
  for (const depth of [3, 8, 14]) {
    expect(cries(depth, ['right', 'wrong', 'wrong', 'none']).every((c) => c === 'heal')).toBe(true);
    expect(cries(depth, ['wrong', 'right', 'right']).every((c) => c === null)).toBe(true);
    expect(cries(depth, ['right', 'wrong', 'right'], 'damage').every((c) => c === 'damage')).toBe(true);
  }
  // A replay gives the same result as the live fight, at every pace.
  for (const depth of [2, 7, 14]) {
    const live = playLive(31, depth, settings(), 5);
    expect(replayFight(newClan('balanced', 3).members, depth, 31, false, live.rounds, settings()).state).toEqual(live.state);
  }
  // A wrong number in the record is not marked right.
  const live = playLive(8, 3, settings(), 8);
  const doctored = live.rounds.map((r) => (r.cry ? { ...r, cry: { ...r.cry, answer: r.cry.answer === null ? null : r.cry.answer + 1000 } } : r));
  expect(replayFight(newClan('balanced', 3).members, 3, 8, false, doctored, settings()).cries.every((c) => !c.correct)).toBe(true);
});
