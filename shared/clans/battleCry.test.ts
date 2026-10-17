import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, TOPICS, markAnswer, type PracticalSettings } from '../maths/practical';
import { seeded } from '../seededRandom';
import { botOrders } from './bot';
import { cryQuestion, cryRecord, markCry, nextCryQuestion, playCryRound, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { churchCost, examineCost, itemByName, shopPrice, wakeCost } from './character';
import { CONFIG } from './config';
import { newFight, playRound } from './fight';
import { ITEMS } from './gamedata';
import {
  barracksNeeded, betterBuy, churchBill, draftJoin, energyLeft, examineCostQuestion, fameChange, itemPoints, landPlot, marketChange, marketTotal, noteFor,
  trainingBuy, troopBill,
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

describe('the Battle Cry question', () => {
  it('is the same for the same fight seed, round and settings', () => {
    for (let round = 1; round <= 8; round++) expect(cryQuestion(123, round, settings())).toEqual(cryQuestion(123, round, settings()));
  });

  it('changes from round to round and from fight to fight', () => {
    const texts = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) for (let round = 1; round <= 5; round++) texts.add(cryQuestion(seed, round, settings())!.text);
    expect(texts.size).toBeGreaterThan(30);
  });

  it('follows the teacher: topics, year band, and nothing at all when everything is off', () => {
    for (let round = 1; round <= 30; round++) {
      expect(['area', 'perimeter']).toContain(cryQuestion(9, round, settings({ enabledTopics: ['area'] }))!.kind);
      expect(cryQuestion(9, round, settings({ yearBand: 4 }))!.kind).not.toBe('negative');
    }
    expect(cryQuestion(9, 1, settings({ enabledTopics: [] }))).toBeNull();
  });

  it('does not change how the fight plays', () => {
    const clan = newClan('balanced', 3);
    const play = (peek: boolean) => {
      const state = newFight(clan.members, 3, 777);
      while (!state.result) {
        if (peek) nextCryQuestion(state, settings());
        playRound(state, botOrders(state), null);
      }
      return JSON.stringify(state);
    };
    expect(play(true)).toBe(play(false));
  });
});

describe('marking the Battle Cry', () => {
  const q = cryQuestion(5, 1, settings())!;

  it('a right answer plays the reward the player chose', () => {
    expect(markCry(q, { answer: q.answer, reward: 'damage' })).toMatchObject({ answered: true, correct: true, cry: 'damage' });
    expect(markCry(q, { answer: q.answer, reward: 'heal' }).cry).toBe('heal');
  });

  it('a wrong answer or "No thanks" is a normal round that still shows the working', () => {
    const wrong = markCry(q, { answer: q.answer + 1, reward: 'damage' });
    expect(wrong).toMatchObject({ answered: true, correct: false, cry: null });
    expect(wrong.question!.working.length).toBeGreaterThan(0);
    const skipped = markCry(q, null);
    expect(skipped).toMatchObject({ answered: false, correct: false, cry: null });
    expect(skipped.question!.answer).toBe(q.answer);
    expect(markCry(q, { answer: null, reward: 'damage' }).cry).toBeNull();
  });

  it('with no question there is nothing to mark', () => {
    expect(markCry(null, { answer: 4, reward: 'damage' })).toEqual({ answered: false, correct: false, cry: null, question: null });
  });

  it('a right answer for damage really adds damage', () => {
    const clan = newClan('fighters', 2);
    const damageDone = (right: boolean) => {
      let total = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const state = newFight(clan.members, 6, seed);
        const q = nextCryQuestion(state, settings())!;
        playCryRound(state, settings(), botOrders(state), right ? { answer: q.answer, reward: 'damage' } : null);
        total += state.enemies.reduce((t, e) => t + (e.maxHp - e.hp), 0);
      }
      return total;
    };
    expect(damageDone(true)).toBeGreaterThan(damageDone(false));
  });
});

describe('replaying a fight with its recorded Battle Cry answers', () => {
  it('gives exactly the result it did live', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = settings({ yearBand: ([4, 5, 6] as const)[seed % 3] });
      const live = playLive(seed * 31, seed % 8, s, seed);
      const replay = replayFight(newClan('balanced', 3).members, seed % 8, seed * 31, false, live.rounds, s);
      expect(JSON.stringify(replay.state)).toBe(JSON.stringify(live.state));
      expect(replay.cries.filter((c) => c.correct).length).toBe(live.state.log.filter((e) => e.type === 'cry').length);
    }
  });

  it('survives being saved halfway (plain JSON) and carried on', () => {
    const clan = newClan('balanced', 3);
    const s = settings();
    const state = newFight(clan.members, 4, 999);
    const half = JSON.parse(JSON.stringify(state));
    for (const st of [state, half]) {
      while (!st.result) {
        const q = nextCryQuestion(st, s)!;
        playCryRound(st, s, botOrders(st), { answer: q.answer, reward: 'damage' });
      }
    }
    expect(JSON.stringify(half)).toBe(JSON.stringify(state));
  });

  it('catches a made-up answer: a wrong number in the record is not marked right', () => {
    const live = playLive(8, 3, settings(), 8);
    const doctored = live.rounds.map((r) => (r.cry ? { ...r, cry: { ...r.cry, answer: r.cry.answer === null ? null : r.cry.answer + 1000 } } : r));
    const replay = replayFight(newClan('balanced', 3).members, 3, 8, false, doctored, settings());
    expect(replay.cries.every((c) => !c.correct)).toBe(true);
  });

  it('stops when the fight ends, ignoring extra rounds', () => {
    const live = playLive(2, 0, settings(), 2);
    const extra = [...live.rounds, ...live.rounds];
    const replay = replayFight(newClan('balanced', 3).members, 0, 2, false, extra, settings());
    expect(JSON.stringify(replay.state)).toBe(JSON.stringify(live.state));
  });
});

describe('private records', () => {
  it('are in the shape the other games save, with no names in them', () => {
    const q = cryQuestion(1, 1, settings())!;
    const record = cryRecord(q, 5, true, 4200, 1_800_000_000_000);
    expect(Object.keys(record).sort()).toEqual(['at', 'correct', 'key', 'ms']);
    expect(record.key).toBe(`clan:y5:${q.kind}`);
  });
});

describe('shop and church moments use the real numbers', () => {
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

  it('the examine question matches what looking costs', () => {
    for (const item of ITEMS) expect(examineCostQuestion(s, item.price)!.answer).toBe(examineCost(item));
  });

  it('change comes from 1,000, or the next thousand up', () => {
    expect(noteFor(640)).toBe(1000);
    expect(noteFor(1000)).toBe(1000);
    expect(noteFor(1001)).toBe(2000);
    const q = marketChange(s, 640)!;
    expect(q.answer).toBe(360);
    expect(marketChange(s, 1450)!.answer).toBe(550);
    expect(marketChange(s, 350, 275)!.answer).toBe(375);
  });

  it('the Church bill matches what waking costs, with the free wake-up taken off', () => {
    const clan = newClan('balanced', 1);
    clan.members.forEach((m, i) => {
      m.level = 3 + i;
      m.knockedOut = true;
    });
    const paying = clan.members.slice(1); // the first wake-up is free
    expect(wakeCost(clan, clan.members[0])).toBe(0);
    const q = churchBill(s, paying.map((m) => m.level))!;
    expect(q.answer).toBe(paying.reduce((t, m) => t + churchCost(m), 0));
    expect(q.text).toContain(`× ${CONFIG.churchPerLevel}`);
    expect(churchBill(s, [])).toBeNull();
  });

  it('training: how many and what is left', () => {
    const q = trainingBuy(s, 47, 7)!;
    expect(q.howMany.answer).toBe(6);
    expect(q.leftOver.answer).toBe(5);
    expect(trainingBuy(s, 5, 7)).toBeNull();
  });

  it('land, barracks, troops, energy, the draft and fame', () => {
    const plot = landPlot(s, 4, 5)!;
    expect(plot.area.answer).toBe(20);
    expect(plot.fence.answer).toBe(18);
    expect(barracksNeeded(s, 85, 20)!.answer).toBe(5);
    expect(troopBill(s, 12, 4, 0)!.answer).toBe(300);
    expect(energyLeft(s, 30, 7, 12)!.answer).toBe(51);
    expect(draftJoin(s, 50, 20)!.answer).toBe(10);
    expect(fameChange(settings({ yearBand: 6 }), 4, -9)!.answer).toBe(-5);
  });

  it('a better buy compares what the items give for the price', () => {
    const axe = itemByName('Axe') ?? ITEMS.find((i) => i.kind === 'weapon')!;
    const other = ITEMS.filter((i) => i.kind === 'weapon' && i !== axe)[3];
    const m = newClan('fighters', 1).members[0];
    m.stats.strength = 60;
    m.stats.dexterity = 60;
    m.stats.agility = 60;
    const a = { name: axe.name, price: shopPrice(axe), points: itemPoints(m, axe) };
    const b = { name: other.name, price: shopPrice(other), points: itemPoints(m, other) };
    const q = betterBuy(s, a, b);
    if (q) expect(q.answer).toBe(a.price * b.points < b.price * a.points ? 1 : 2);
    expect(betterBuy(s, { name: 'A', price: 100, points: 5 }, { name: 'B', price: 200, points: 10 })).toBeNull();
    expect(betterBuy(s, { name: 'A', price: 500, points: 7 }, { name: 'B', price: 750, points: 8 })!.answer).toBe(1);
    expect(betterBuy(s, { name: 'A', price: 500, points: 0 }, { name: 'B', price: 750, points: 8 })).toBeNull();
  });

  it('gives nothing when the teacher has the topic off, or the band is too young', () => {
    expect(marketTotal(settings({ enabledTopics: ['area'] }), 240)).toBeNull();
    expect(churchBill(settings({ enabledTopics: ['percentages'] }), [3])).toBeNull();
    expect(landPlot(settings({ enabledTopics: ['percentages'] }), 4, 5)).toBeNull();
    expect(fameChange(settings({ yearBand: 5 }), 4, -9)).toBeNull();
    expect(fameChange(settings({ yearBand: 6, enabledTopics: ['area'] }), 4, -9)).toBeNull();
  });

  it('every item can be asked about at the real prices (no invalid questions)', () => {
    for (const item of ITEMS) {
      expect(marketTotal(s, item.price)).not.toBeNull();
      expect(marketChange(s, shopPrice(item))).not.toBeNull();
    }
  });
});
