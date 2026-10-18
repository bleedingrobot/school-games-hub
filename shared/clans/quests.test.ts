import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, YEAR_BANDS, markAnswer, type PracticalSettings, type YearBand } from '../maths/practical';
import { CONFIG } from './config';
import { ITEMS } from './gamedata';
import {
  PUZZLE_KINDS, QUESTS, bestCharm, buildPuzzle, choiceOpen, finishQuest, isValidPuzzle, makePuzzle, mostPrize, puzzleFor, questById, questDoneToday, questsFor, todaysQuest, type QuestDef,
} from './quests';
import { newClan } from './sim';
import type { Clan } from './types';

const settings = (yearBand: YearBand, integers = false): PracticalSettings => ({ ...DEFAULT_PRACTICAL_SETTINGS, yearBand, enabledTopics: integers ? [...DEFAULT_PRACTICAL_SETTINGS.enabledTopics, 'integers'] : DEFAULT_PRACTICAL_SETTINGS.enabledTopics });
const charming = (clan: Clan, value: number) => ((clan.members[0].stats.charisma = value), clan);
const clan = () => newClan('balanced', 5);

describe('the quests as written', () => {
  it('has ten quests with different numbers, titles and at least two paragraphs of story', () => {
    expect(QUESTS).toHaveLength(10);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(10);
    expect(new Set(QUESTS.map((q) => q.title)).size).toBe(10);
    for (const q of QUESTS) {
      expect(q.story.length, q.title).toBeGreaterThanOrEqual(2);
      expect(q.choices.length, q.title).toBeGreaterThanOrEqual(1);
      expect(q.choices.length, q.title).toBeLessThanOrEqual(3);
      // Short enough for a Year 4 to read in a minute.
      const words = [...q.story, ...q.choices.flatMap((c) => [c.label, c.win.text, c.lose?.text ?? ''])].join(' ').split(/\s+/).length;
      expect(words, q.title).toBeLessThan(260);
    }
  });

  it('has every kind of thing the plan asked for', () => {
    const kinds = new Set(QUESTS.flatMap((q) => q.choices.map((c) => c.puzzle).filter(Boolean)));
    expect([...kinds].sort()).toEqual([...PUZZLE_KINDS].sort());
    expect(QUESTS.some((q) => q.choices.every((c) => !c.puzzle))).toBe(true);
    expect(QUESTS.some((q) => q.choices.some((c) => c.charm))).toBe(true);
  });

  it('only uses real items, and no item is dearer than the limit', () => {
    for (const q of QUESTS) for (const c of q.choices) for (const o of [c.win, c.lose]) {
      if (o?.item) {
        const item = ITEMS.find((i) => i.name === o.item);
        expect(item, o.item).toBeDefined();
        expect(item!.price).toBeLessThanOrEqual(CONFIG.quests.itemMaxPrice);
      }
    }
  });

  it('gives a puzzle choice a smaller prize for a wrong answer, and never nothing at all to carry on with', () => {
    for (const q of QUESTS) for (const c of q.choices) {
      if (!c.puzzle) continue;
      expect(c.lose, q.title).toBeDefined();
      const worth = (o: typeof c.win) => (o.gold ? CONFIG.quests.reward.gold[o.gold] : 0) + (o.followers ? CONFIG.quests.reward.followers[o.followers] * 3 : 0) + (o.points ? CONFIG.quests.reward.points[o.points] * 10 : 0);
      expect(worth(c.lose!), q.title).toBeLessThan(worth(c.win));
    }
  });

  it('keeps every prize small next to the Mines (a fight earns about 50 gold and 4-13 followers)', () => {
    const r = CONFIG.quests.reward;
    expect(r.gold.big).toBeLessThanOrEqual(60);
    expect(r.followers.big).toBeLessThanOrEqual(15);
    expect(r.points.big).toBeLessThanOrEqual(3);
    for (const q of QUESTS) {
      const most = mostPrize(q);
      expect(most.gold, q.title).toBeLessThanOrEqual(r.gold.big + 40);
      expect(most.followers, q.title).toBeLessThanOrEqual(r.followers.big);
      expect(most.points, q.title).toBeLessThanOrEqual(r.points.big);
    }
  });

  it('has no people or brands to worry about and no violence words', () => {
    const all = QUESTS.flatMap((q) => [q.title, ...q.story, ...q.choices.flatMap((c) => [c.label, c.win.text, c.lose?.text ?? ''])]).join(' ').toLowerCase();
    for (const bad of ['kill', 'blood', 'dead', 'die ', 'stab', 'murder', 'coca', 'mcdonald', 'lego', 'disney']) expect(all).not.toContain(bad);
  });
});

describe('which quest comes today', () => {
  it('picks the same quest for the same clan and day, and cycles through all the suitable ones without repeats', () => {
    const s = settings(5);
    const list = questsFor(s);
    expect(list).toHaveLength(9);
    const days = Array.from({ length: list.length }, (_, i) => todaysQuest(77, i + 1, s)!.id);
    expect(new Set(days).size).toBe(list.length);
    expect(todaysQuest(77, 3, s)!.id).toBe(todaysQuest(77, 3, s)!.id);
    expect(todaysQuest(77, 1 + list.length, s)!.id).toBe(todaysQuest(77, 1, s)!.id);
  });

  it('gives different clans a different order', () => {
    const s = settings(5);
    const orders = new Set([1, 2, 3, 4, 5, 6].map((seed) => Array.from({ length: 9 }, (_, i) => todaysQuest(seed, i + 1, s)!.id).join()));
    expect(orders.size).toBeGreaterThan(2);
  });

  it('keeps the below-zero quest for Year 6 with the topic switched on, and nobody else', () => {
    const frozen = (s: PracticalSettings) => questsFor(s).some((q) => q.id === 5);
    expect(frozen(settings(6, true))).toBe(true);
    expect(frozen(settings(6, false))).toBe(false);
    expect(frozen(settings(5, true))).toBe(false);
    expect(frozen(settings(4, true))).toBe(false);
    for (const band of [4, 5] as YearBand[]) for (let day = 1; day <= 30; day++) expect(todaysQuest(9, day, settings(band, true))!.id).not.toBe(5);
    expect(Array.from({ length: 10 }, (_, d) => todaysQuest(9, d + 1, settings(6, true))!.id)).toContain(5);
  });
});

describe('puzzles', () => {
  it('are always valid, rebuild the same, and have exactly one right answer among the choices', () => {
    for (const band of YEAR_BANDS) for (const kind of PUZZLE_KINDS) {
      if (kind === 'cold' && band !== 6) continue;
      for (let seed = 1; seed <= 200; seed++) {
        const spec = makePuzzle(kind, band, seed * 7919);
        expect(isValidPuzzle(spec), `${kind} ${band} ${seed}`).toBe(true);
        const q = buildPuzzle(spec);
        expect(buildPuzzle({ kind: spec.kind, nums: [...spec.nums] })).toEqual(q);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(markAnswer(q, q.answer)).toBe(true);
        expect(markAnswer(q, q.answer + 1)).toBe(false);
        expect(q.working.length).toBeGreaterThanOrEqual(2);
        if (q.choices) expect(q.choices.filter((c) => c.value === q.answer)).toHaveLength(1);
      }
    }
  });

  it('are checked: nonsense numbers are refused', () => {
    expect(() => buildPuzzle({ kind: 'riddle', nums: [3, 1, 2, 0] })).toThrow();
    expect(() => buildPuzzle({ kind: 'order', nums: [0, 3, 0, 0, 0, 1, 2] })).toThrow();
    expect(() => buildPuzzle({ kind: 'cold', nums: [4, 0] })).toThrow();
    expect(() => buildPuzzle({ kind: 'pattern', nums: [0, 3, 2, 4] })).toThrow();
  });

  it('work out the right answers', () => {
    expect(buildPuzzle({ kind: 'pattern', nums: [0, 4, 5, 5] }).answer).toBe(29);
    expect(buildPuzzle({ kind: 'pattern', nums: [1, 1, 1, 5] }).answer).toBe(16);
    expect(buildPuzzle({ kind: 'pattern', nums: [2, 3, 2, 5] }).answer).toBe(96);
    expect(buildPuzzle({ kind: 'riddle', nums: [7, 3, 4, 0] }).answer).toBe(7);
    expect(buildPuzzle({ kind: 'riddle', nums: [7, 3, 4, 0] }).text).toContain('25');
    expect(buildPuzzle({ kind: 'riddle', nums: [7, 3, 4, 1] }).text).toContain('17');
    expect(buildPuzzle({ kind: 'cold', nums: [5, -8] }).answer).toBe(-3);
    // Ash, Bree, Cob in that order; who sits in the middle?
    const mid = buildPuzzle({ kind: 'order', nums: [0, 3, 2, 0, 1, 2] });
    expect(mid.choices!.find((c) => c.value === mid.answer)!.label).toBe('Bree');
    const right = buildPuzzle({ kind: 'order', nums: [0, 3, 1, 2, 0, 1] });
    expect(right.choices!.find((c) => c.value === right.answer)!.label).toBe('Bree');
  });

  it('give the same puzzle for the same clan, day and choice, and a new one on a new day', () => {
    const q = questById(2)!;
    const a = puzzleFor(q, 0, 11, 4, settings(5));
    expect(puzzleFor(q, 0, 11, 4, settings(5))).toEqual(a);
    expect(puzzleFor(q, 1, 11, 4, settings(5))).toBeNull();
    const many = new Set(Array.from({ length: 12 }, (_, d) => JSON.stringify(puzzleFor(q, 0, 11, d + 1, settings(5)))));
    expect(many.size).toBeGreaterThan(5);
  });

  it('only ask the below-zero puzzle with a negative answer when Year 6 has it on', () => {
    for (let seed = 1; seed < 50; seed++) expect(buildPuzzle(makePuzzle('cold', 6, seed)).answer).toBeLessThan(0);
  });
});

/** Every route through a quest: each choice, with a puzzle right, wrong or skipped. */
function routes(q: QuestDef) {
  return q.choices.flatMap((c, i) => (c.puzzle ? [{ i, right: true }, { i, right: false }] : [{ i, right: null as boolean | null }]));
}

describe('finishing a quest', () => {
  it('can be finished by every route, and the prize lands on the clan', () => {
    for (const q of QUESTS) for (const r of routes(q)) {
      const c = charming(clan(), 20);
      const before = { gold: c.gold, followers: c.followers, points: c.members.map((m) => m.points) };
      const done = finishQuest(c, 1, q, r.i, r.right);
      expect(done.ok, `${q.title} ${JSON.stringify(r)}`).toBe(true);
      if (!done.ok) continue;
      expect(done.text.length).toBeGreaterThan(20);
      expect(c.gold).toBe(before.gold + done.prize.gold);
      expect(c.followers).toBe(before.followers + done.prize.followers);
      c.members.forEach((m, k) => expect(m.points).toBe(before.points[k] + done.prize.points));
      expect(done.prize.gold + done.prize.followers + done.prize.points + (done.prize.item ? 1 : 0)).toBeGreaterThan(0);
      expect(done.prize.gold).toBeLessThanOrEqual(mostPrize(q).gold);
      expect(c.questDay).toBe(1);
    }
  });

  it('gives the bigger prize for a right answer and the smaller one for a wrong answer, both carrying on', () => {
    const q = questById(2)!;
    const right = finishQuest(clan(), 1, q, 0, true);
    const wrong = finishQuest(clan(), 1, q, 0, false);
    expect(right.ok && wrong.ok).toBe(true);
    if (right.ok && wrong.ok) {
      expect(right.prize.gold).toBeGreaterThan(wrong.prize.gold);
      expect(wrong.prize.gold).toBeGreaterThan(0);
      expect(right.right).toBe(true);
      expect(wrong.right).toBe(false);
    }
  });

  it('allows one a day, then a new day starts again', () => {
    const c = clan();
    const q = questById(6)!;
    expect(questDoneToday(c, 1)).toBe(false);
    expect(finishQuest(c, 1, q, 0, null).ok).toBe(true);
    expect(questDoneToday(c, 1)).toBe(true);
    const gold = c.gold;
    const again = finishQuest(c, 1, q, 1, null);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.say).toMatch(/tomorrow/);
    expect(c.gold).toBe(gold);
    expect(questDoneToday(c, 2)).toBe(false);
    expect(finishQuest(c, 2, q, 1, null).ok).toBe(true);
  });

  it('refuses a choice that is not in the story', () => {
    const c = clan();
    expect(finishQuest(c, 1, questById(1)!, 9, null).ok).toBe(false);
    expect(c.questDay).toBeUndefined();
  });
});

describe('charisma', () => {
  const talk = questById(6)!.choices[2];
  const high = questById(9)!.choices[1];

  it('locks a charm choice until the best charisma in the clan reaches the number, and then unlocks it', () => {
    const c = clan();
    for (const m of c.members) m.stats.charisma = CONFIG.quests.charm.open - 1;
    const locked = choiceOpen(c, talk);
    expect(locked.open).toBe(false);
    if (!locked.open) expect(locked.say).toContain(String(CONFIG.quests.charm.open));
    c.members[2].stats.charisma = CONFIG.quests.charm.open;
    expect(choiceOpen(c, talk).open).toBe(true);
    expect(bestCharm(c).member).toBe(c.members[2]);
  });

  it('has a higher bar for the very charming choice', () => {
    const c = charming(clan(), CONFIG.quests.charm.open);
    expect(choiceOpen(c, talk).open).toBe(true);
    expect(choiceOpen(c, high).open).toBe(false);
    charming(c, CONFIG.quests.charm.high);
    expect(choiceOpen(c, high).open).toBe(true);
  });

  it('refuses to finish a locked choice and keeps the day free', () => {
    const c = clan();
    for (const m of c.members) m.stats.charisma = 0;
    const done = finishQuest(c, 1, questById(6)!, 2, null);
    expect(done.ok).toBe(false);
    expect(c.questDay).toBeUndefined();
    expect(finishQuest(c, 1, questById(6)!, 0, null).ok).toBe(true);
  });

  it('can be unlocked by training: the first charm choice is reachable', () => {
    expect(CONFIG.quests.charm.open).toBeLessThanOrEqual(CONFIG.trainCost.charisma * 2 + 6);
    expect(CONFIG.quests.charm.high).toBeLessThanOrEqual(CONFIG.statCap);
  });
});

describe('found items', () => {
  const stick = questById(7)!;
  it('go to a member who can use them', () => {
    const c = clan();
    for (const m of c.members) m.stats.dexterity = 20;
    const done = finishQuest(c, 1, stick, 0, null);
    expect(done.ok && done.prize.item?.name).toBe('Cloth Tunic');
    if (done.ok) expect(c.members.find((m) => m.name === done.prize.item!.member)!.gear.armor).toBe('Cloth Tunic');
  });

  it('are sold for half the price if nobody can use them, never lost', () => {
    const c = clan();
    for (const m of c.members) { m.stats.dexterity = 0; m.gear.armor = 'Rags'; }
    const gold = c.gold;
    const done = finishQuest(c, 1, stick, 0, null);
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.prize.item).toBeUndefined();
      expect(done.prize.gold).toBe(Math.ceil(25 / 2));
      expect(c.gold).toBe(gold + done.prize.gold);
      expect(done.text).toMatch(/sold it/);
    }
  });

  it('never replace gear someone already wears', () => {
    const c = clan();
    for (const m of c.members) { m.stats.dexterity = 20; m.gear.armor = 'Rags'; }
    finishQuest(c, 1, stick, 0, null);
    expect(c.members.every((m) => m.gear.armor === 'Rags')).toBe(true);
  });
});
