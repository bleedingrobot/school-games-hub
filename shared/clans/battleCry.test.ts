import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, TOPICS, markAnswer, type PracticalSettings } from '../maths/practical';
import { shopPrice } from './character';
import { CONFIG } from './config';
import { ITEMS } from './gamedata';
import { marketTotal } from './moments';

const settings = (over: Partial<PracticalSettings> = {}): PracticalSettings => ({ ...DEFAULT_PRACTICAL_SETTINGS, enabledTopics: [...TOPICS], yearBand: 5, ...over });

describe('shop moments use the real numbers', () => {
  const s = settings();

  it('market total matches the shop price of every item, at any tax', () => {
    for (const item of ITEMS) {
      for (const tax of [CONFIG.shopTax, 0, 5, 20]) {
        const q = marketTotal(s, item.price, tax)!;
        expect(q.answer).toBe(shopPrice(item, tax));
        expect(markAnswer(q, shopPrice(item, tax))).toBe(true);
      }
    }
  });
});
