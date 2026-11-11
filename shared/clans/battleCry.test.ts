import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, TOPICS, markAnswer, type PracticalSettings } from '../maths/practical';
import { seeded } from '../seededRandom';
import { botOrders } from './bot';
import { nextCryQuestion, playCryRound, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { shopPrice } from './character';
import { CONFIG } from './config';
import { newFight } from './fight';
import { ITEMS } from './gamedata';
import {
  discountQuestion, earnedDiscount, 
  
} from './moments';
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

describe('shop and church moments use the real numbers', () => {
  const s = settings();

  it('the discount question asks for the 10% that buying takes off, for every item', () => {
    for (const item of ITEMS.filter((i) => i.price > 0)) {
      const q = discountQuestion(s, item.price, item.name)!;
      expect(q.text).toContain(`${CONFIG.shopDiscount}% of ${item.price}`);
      expect(item.price - q.answer).toBe(shopPrice(item, true));
      expect(markAnswer(q, q.answer)).toBe(true);
      expect(earnedDiscount(s, item.price, q.answer)).toBe(true);
      expect(earnedDiscount(s, item.price, q.answer + 1)).toBe(false);
      expect(earnedDiscount(s, item.price, null)).toBe(false);
    }
  });
});
