import { describe, expect, it } from 'vitest';
import { newHero, forestTrip } from './engine';
import { EVENTS, eventsOn } from './events';
import { ALL_TOPICS, MOMENT_TOPICS, momentTopics, topicsOn, type MomentId } from './maths';
import { markProof } from './proof';
import { makeExtraPack, makePack } from '../maths/skillPacks';
import { questionLevel } from './proof';

const MOMENTS = Object.keys(MOMENT_TOPICS) as MomentId[];
const withQuestions = MOMENTS.filter((m) => MOMENT_TOPICS[m].length > 0);
/** Every way of leaving at least one of the eight topics on (255). */
const SUBSETS = Array.from({ length: 255 }, (_, i) => ALL_TOPICS.filter((_t, bit) => ((i + 1) >> bit) & 1));

const proofFor = (pack: (typeof ALL_TOPICS)[number], level = 1) => {
  const p = pack === 'money' || pack === 'patterns' ? makeExtraPack(pack) : makePack(pack);
  const l = questionLevel(pack, level);
  const q = p.nextQuestion({ level: l })!;
  return { pack, key: q.factKey, kind: q.kind, params: q.params, level: l, given: q.answer, ms: 3000 };
};

describe('the topic list', () => {
  it('has the eight topics, and every pack a moment uses is one of them', () => {
    expect(ALL_TOPICS).toHaveLength(8);
    for (const m of MOMENTS) for (const t of MOMENT_TOPICS[m]) expect(ALL_TOPICS).toContain(t);
  });

  it('reads a settings list: known topics only, in the usual order, and never none', () => {
    expect(topicsOn(['patterns', 'add-sub'])).toEqual(['add-sub', 'patterns']);
    expect(topicsOn(['add-sub', 'spelling'])).toEqual(['add-sub']);
    expect(topicsOn([])).toEqual(ALL_TOPICS);
    expect(topicsOn(['spelling'])).toEqual(ALL_TOPICS);
    expect(topicsOn(undefined)).toEqual(ALL_TOPICS);
    expect(topicsOn(null)).toEqual(ALL_TOPICS);
    expect(topicsOn('add-sub')).toEqual(ALL_TOPICS);
  });
});

describe('with some topics off, for every possible list', () => {
  it('gives every moment with a question something to ask, only from topics that are on', () => {
    for (const on of SUBSETS) {
      for (const m of withQuestions) {
        const topics = momentTopics(m, on);
        expect(topics.length, `${m} with ${on.join(',')}`).toBeGreaterThan(0);
        for (const t of topics) expect(on).toContain(t);
      }
      expect(momentTopics('inn-guess', on)).toEqual([]);
    }
  });

  it('keeps a moment’s own topics when any of them is on, and falls back to the others only when none is', () => {
    expect(momentTopics('shop', ALL_TOPICS)).toEqual(['money', 'add-sub']);
    expect(momentTopics('shop', ['add-sub', 'fractions'])).toEqual(['add-sub']);
    expect(momentTopics('shop', ['fractions'])).toEqual(['fractions']);
    expect(momentTopics('healer', ['patterns', 'money'])).toEqual(['patterns', 'money']);
  });

  it('never leaves the forest without events, and never shows an event about a topic that is off', () => {
    for (const on of SUBSETS) {
      const pool = eventsOn(on);
      expect(pool.length).toBeGreaterThan(5);
      for (const e of pool) if (e.maths) expect(on).toContain(e.maths.topic);
      expect(pool.some((e) => !e.maths)).toBe(true);
    }
  });

  it('leaves the forest exactly as it was when every topic is on', () => {
    expect(eventsOn(ALL_TOPICS)).toEqual(EVENTS);
    const hero = newHero('knight', '2026-10-19');
    for (let seed = 1; seed < 400; seed++) expect(forestTrip(hero, seed, eventsOn(ALL_TOPICS))).toEqual(forestTrip(hero, seed));
  });

  it('finds only allowed events on the way through the forest, and still finds fights', () => {
    const hero = newHero('knight', '2026-10-19');
    for (const on of [['patterns'], ['fractions', 'decimals'], ['money', 'add-sub', 'times-tables']] as const) {
      const pool = eventsOn(on);
      let events = 0;
      let fights = 0;
      for (let seed = 1; seed < 600; seed++) {
        const trip = forestTrip(hero, seed, pool);
        if (trip.kind === 'event') {
          events++;
          if (trip.event.maths) expect(on).toContain(trip.event.maths.topic);
        } else fights++;
      }
      expect(events).toBeGreaterThan(0);
      expect(fights).toBeGreaterThan(300);
    }
  });
});

describe('marking when some topics are off', () => {
  it('believes a question from a topic that is on', () => {
    expect(markProof(proofFor('money'), 'shop', 1, 0, undefined, ['money'])).toMatchObject({ ok: true, correct: true });
  });

  it('refuses a question from a topic that is off', () => {
    expect(markProof(proofFor('money'), 'shop', 1, 0, undefined, ['add-sub'])).toEqual({ ok: false, problem: 'proof-pack' });
    expect(markProof(proofFor('fractions'), 'master-trial', 1, 0, undefined, ['add-sub'])).toEqual({ ok: false, problem: 'proof-pack' });
  });

  it('accepts a topic from the fallback when a moment’s own are all off', () => {
    expect(markProof(proofFor('fractions'), 'shop', 1, 0, undefined, ['fractions'])).toMatchObject({ ok: true, correct: true });
    expect(markProof(proofFor('money'), 'shop', 1, 0, undefined, ['fractions'])).toEqual({ ok: false, problem: 'proof-pack' });
  });

  it('refuses an event’s own question when its topic is off, even though the event asked for it', () => {
    expect(markProof(proofFor('patterns'), 'treasure', 1, 0, 'patterns', ['add-sub'])).toEqual({ ok: false, problem: 'proof-pack' });
    expect(markProof(proofFor('patterns'), 'treasure', 1, 0, 'patterns', ['patterns'])).toMatchObject({ ok: true });
  });

  it('marks as before when every topic is on', () => {
    for (const t of ALL_TOPICS) expect(markProof(proofFor(t), 'master-trial', 1, 0)).toMatchObject({ ok: true, correct: true });
  });
});
