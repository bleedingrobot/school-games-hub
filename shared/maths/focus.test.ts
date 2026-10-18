import { solveClaim } from './claim';
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { afterAnswer, newStats, type FactStats } from './leitner';
import {
  AUTO_FOCUS,
  currentFocus,
  describeEnd,
  focusKey,
  focusNote,
  groupByPack,
  hasFocus,
  isFocusKey,
  keyForAnswer,
  makeFocusPack,
  nzLocalToIso,
  nzWallClock,
  parseFocus,
  skillList,
  solveParts,
  timeLeft,
  type MathsFocus,
} from './focus';
import { AutoPack, focusPools, FOCUS_PACKS, LADDER, packIdOfKey } from './ladder';
import { solveQuestion, TimesTables } from './skillPacks/timesTables';

const focus = (skills: string[], extra: Partial<MathsFocus> = {}): MathsFocus => ({
  source: 'teacher-class',
  skills,
  onlyThese: false,
  endsAt: null,
  canChoose: true,
  own: null,
  ...extra,
});
const tablesSix = LADDER.find((s) => s.id === 'tables-6-9')!;

describe('reading a focus from the server', () => {
  it('keeps a good one', () => {
    const f = parseFocus({ source: 'teacher-group', skills: ['tables-6-9'], onlyThese: true, endsAt: '2026-10-23T11:00:00Z', canChoose: false, own: null });
    expect(f).toMatchObject({ source: 'teacher-group', skills: ['tables-6-9'], onlyThese: true, canChoose: false });
    expect(f.endsAt).toBe('2026-10-23T11:00:00Z');
  });

  it('counts anything odd as auto', () => {
    expect(parseFocus(null)).toEqual(AUTO_FOCUS);
    expect(parseFocus('x')).toEqual(AUTO_FOCUS);
    expect(parseFocus({ source: 'nonsense', skills: ['a'] }).source).toBe('auto');
    expect(parseFocus({ source: 'teacher-class', skills: [] }).source).toBe('auto');
    expect(parseFocus({ source: 'teacher-class', skills: ['<script>'] }).source).toBe('auto');
    expect(parseFocus({ source: 'student', skills: [3, {}] }).source).toBe('auto');
  });

  it('only a teacher focus carries an end time', () => {
    expect(parseFocus({ source: 'student', skills: ['facts-10'], endsAt: '2026-10-23T11:00:00Z' }).endsAt).toBeNull();
    expect(parseFocus({ source: 'teacher-class', skills: ['facts-10'], endsAt: 'soon' }).endsAt).toBeNull();
  });

  it('hasFocus ignores skills the games can not ask yet', () => {
    expect(hasFocus(focus(['facts-10']))).toBe(true);
    expect(hasFocus(focus(['percent-of']))).toBe(true); // built in F.6
    expect(hasFocus(focus(['not-built-yet']))).toBe(false);
    expect(hasFocus(focus(['no-such-skill']))).toBe(false);
    expect(hasFocus(AUTO_FOCUS)).toBe(false);
    expect(hasFocus(null)).toBe(false);
  });

  it('tells two focuses apart', () => {
    expect(focusKey(focus(['facts-10', 'facts-20']))).toBe(focusKey(focus(['facts-20', 'facts-10'])));
    expect(focusKey(focus(['facts-10']))).not.toBe(focusKey(focus(['facts-10'], { onlyThese: true })));
    expect(focusKey(AUTO_FOCUS)).toBe('auto');
  });
});

describe('saying it in words', () => {
  const nz = (iso: string) => new Date(iso);
  // 12:00 on Wednesday 21 Oct 2026, New Zealand time (UTC+13 in summer).
  const wednesday = nz('2026-10-20T23:00:00Z');

  it('lists skills in plain words', () => {
    expect(skillList(['tables-6-9'])).toBe('×6, ×9');
    expect(skillList(['facts-10', 'tables-3-4-8'])).toBe('Number facts to 10 and ×3, ×4, ×8');
    expect(skillList([])).toBe('your skills');
  });

  it('says "until Friday" for midnight at the end of Friday', () => {
    const friday = nz('2026-10-23T11:00:00Z'); // 00:00 Saturday 24 Oct NZ time
    expect(describeEnd(friday.toISOString(), wednesday)).toBe('until Friday');
  });

  it('says "until tonight" for midnight at the end of today', () => {
    expect(describeEnd(nz('2026-10-21T11:00:00Z').toISOString(), wednesday)).toBe('until tonight');
  });

  it('counts minutes for a lesson', () => {
    expect(describeEnd(nz('2026-10-21T00:00:00Z').toISOString(), wednesday)).toBe('for another 60 minutes');
    expect(describeEnd(nz('2026-10-20T23:01:00Z').toISOString(), wednesday)).toBe('for another 1 minute');
  });

  it('gives an exact time otherwise', () => {
    expect(describeEnd(nz('2026-10-21T02:30:00Z').toISOString(), wednesday)).toBe('until 3:30 pm');
    expect(describeEnd(nz('2026-10-22T02:30:00Z').toISOString(), wednesday)).toBe('until Thursday 3:30 pm');
  });

  it('writes the teacher list time left', () => {
    expect(timeLeft('2026-10-23T11:00:00Z', wednesday)).toBe('ends in 3 days');
    expect(timeLeft('2026-10-21T00:00:00Z', wednesday)).toBe('ends in 60 minutes');
    expect(timeLeft('2026-10-21T08:00:00Z', wednesday)).toBe('ends in 9 hours');
    expect(timeLeft('2026-10-20T00:00:00Z', wednesday)).toBe('ended');
  });

  it('writes the student note', () => {
    expect(focusNote(focus(['tables-6-9'], { endsAt: '2026-10-23T11:00:00Z' }), wednesday)).toBe('Your teacher picked ×6, ×9 until Friday');
    expect(focusNote(focus(['tables-6-9'], { source: 'student' }), wednesday)).toBe('You picked ×6, ×9');
    expect(focusNote(AUTO_FOCUS, wednesday)).toBeNull();
  });
});

describe('a focus that has run out', () => {
  const now = new Date('2026-10-21T00:00:00Z');
  const ended = focus(['tables-6-9'], { endsAt: '2026-10-20T11:00:00Z', own: { skills: ['facts-10'], onlyThese: true } });

  it('goes back to the student\'s own choice', () => {
    const f = currentFocus(ended, now);
    expect(f.source).toBe('student');
    expect(f.skills).toEqual(['facts-10']);
    expect(f.onlyThese).toBe(true);
  });

  it('goes back to auto with no choice, or when choosing is off', () => {
    expect(currentFocus({ ...ended, own: null }, now).source).toBe('auto');
    expect(currentFocus({ ...ended, canChoose: false }, now).source).toBe('auto');
  });

  it('leaves one that is still running, and anything that is not a teacher\'s', () => {
    const running = focus(['tables-6-9'], { endsAt: '2026-10-22T11:00:00Z' });
    expect(currentFocus(running, now)).toBe(running);
    expect(currentFocus(null, now)).toEqual(AUTO_FOCUS);
    const own = focus(['facts-10'], { source: 'student' });
    expect(currentFocus(own, now)).toBe(own);
  });
});

describe('times typed as New Zealand time', () => {
  it('turns a typed time into the real moment', () => {
    // Summer (UTC+13) and winter (UTC+12).
    expect(nzLocalToIso('2026-10-23T15:30')).toBe('2026-10-23T02:30:00.000Z');
    expect(nzLocalToIso('2026-07-23T15:30')).toBe('2026-07-23T03:30:00.000Z');
    expect(nzWallClock(new Date('2026-10-23T02:30:00.000Z'))).toBe('2026-10-23T15:30');
  });

  it('refuses what is not a time', () => {
    expect(nzLocalToIso('')).toBeNull();
    expect(nzLocalToIso('tomorrow')).toBeNull();
    expect(nzLocalToIso('2026-10-23')).toBeNull();
    // The hour the clocks skip (27 Sep 2026, 2:00 to 3:00 am).
    expect(nzLocalToIso('2026-09-27T02:30')).toBeNull();
  });
});

describe('the keys a focus draws from', () => {
  it('uses the chosen skills as focus and the earlier ones as review', () => {
    const pools = focusPools({ skills: ['tables-6-9'], onlyThese: false });
    expect(pools.focus).toContain('mul:6x7');
    expect(pools.focus).toContain('div:54/6');
    expect(pools.review).toContain('mul:2x5');
    expect(pools.review).toContain('bond10:3+7');
    expect(pools.focus.some((k) => pools.review.includes(k))).toBe(false);
    expect(pools.stretch).toEqual([]);
  });

  it('has no review when it is "only these"', () => {
    const pools = focusPools({ skills: ['tables-6-9'], onlyThese: true });
    expect(pools.review).toEqual([]);
    expect(pools.focus.length).toBeGreaterThan(10);
  });

  it('has no review for the first skill on the ladder', () => {
    expect(focusPools({ skills: ['facts-10'], onlyThese: false }).review).toEqual([]);
  });

  it('takes switched-off tables out, and division when it is off', () => {
    const pools = focusPools({ skills: ['tables-6-9'], onlyThese: true }, { enabledTables: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12], division: false });
    expect(pools.focus.some((k) => k.startsWith('div:'))).toBe(false);
    expect(pools.focus).toContain('mul:6x9');
  });

  it('ignores skills that are not built', () => {
    expect(focusPools({ skills: ['not-built-yet', 'nonsense'], onlyThese: false })).toEqual({ focus: [], review: [], stretch: [] });
  });

  it('puts chosen skills from different places on the ladder together', () => {
    const pools = focusPools({ skills: ['facts-20', 'tables-6-9'], onlyThese: false });
    expect(pools.focus).toContain('bond20:8+12');
    expect(pools.focus).toContain('mul:6x9');
    expect(pools.review).toContain('bond10:3+7'); // before the first chosen skill
    expect(pools.review).not.toContain('mul:2x5'); // between the two: not review, not focus
  });
});

describe('the pack a game asks from', () => {
  const random = (seed: number) => randomFromSeed(String(seed));

  it('is the times-table pack with no focus, as before', () => {
    expect(makeFocusPack([], null).id).toBe('times-tables');
    expect(makeFocusPack([], AUTO_FOCUS).id).toBe('times-tables');
    expect(makeFocusPack([], focus(['not-built-yet'])).id).toBe('times-tables');
  });

  it('keeps only times-table records in the times-table pack', () => {
    const stats = [newStats('mul:6x7'), newStats('bond10:3+7')];
    expect(makeFocusPack(stats, null).stats().map((s) => s.key)).toEqual(['mul:6x7']);
  });

  it('asks the chosen skill about 60% of the time and earlier skills about 30%', () => {
    const pack = makeFocusPack([], focus(['tables-6-9']), {}, random(7));
    const pools = focusPools({ skills: ['tables-6-9'], onlyThese: false });
    let inFocus = 0;
    let inReview = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      const q = pack.nextQuestion({})!;
      if (pools.focus.includes(q.factKey)) inFocus++;
      else if (pools.review.includes(q.factKey)) inReview++;
      else throw new Error(`asked ${q.factKey}, which is not in the focus or the review`);
      pack.recordAnswer(q, q.answer, 2000);
    }
    expect(inFocus / N).toBeGreaterThan(0.6);
    expect(inReview / N).toBeGreaterThan(0.1);
  });

  it('asks only the focus when it is "only these"', () => {
    const pack = makeFocusPack([], focus(['dbl-half-10'], { onlyThese: true }), {}, random(3));
    const keys = new Set(focusPools({ skills: ['dbl-half-10'], onlyThese: true }).focus);
    for (let i = 0; i < 100; i++) {
      const q = pack.nextQuestion({})!;
      expect(keys.has(q.factKey)).toBe(true);
      pack.recordAnswer(q, q.answer, 2000);
    }
  });

  it('does not ask division when it is off', () => {
    const pack = makeFocusPack([], focus(['tables-6-9'], { onlyThese: true }), { division: false }, random(5));
    for (let i = 0; i < 200; i++) {
      const q = pack.nextQuestion({ division: false })!;
      expect(q.parts).not.toContain('÷');
      pack.recordAnswer(q, q.answer, 2000);
    }
  });

  it('answers to a focus count in the records of the right pack', () => {
    const pack = makeFocusPack([], focus(['facts-10', 'tables-2-5-10'], { onlyThese: true }), {}, random(11));
    const heard: string[] = [];
    pack.onAnswer((a) => heard.push(a.key));
    for (let i = 0; i < 40; i++) {
      const q = pack.nextQuestion({})!;
      pack.recordAnswer(q, q.answer, 2000);
    }
    const packs = new Set(heard.map((k) => packIdOfKey(k)));
    expect(packs.has('times-tables')).toBe(true);
    expect([...packs].every((p) => p && FOCUS_PACKS.includes(p))).toBe(true);
    expect(pack.stats().length).toBeGreaterThan(5);
  });

  it('carries the records of a pack over to the next pack when the focus changes', () => {
    const first = makeFocusPack([], focus(['facts-10'], { onlyThese: true }), {}, random(2));
    const q = first.nextQuestion({})!;
    first.recordAnswer(q, q.answer, 2000);
    const second = makeFocusPack(first.stats(), focus(['tables-6-9']), {}, random(2));
    expect(second.stats().map((s) => s.key)).toContain(q.factKey);
  });

  it('gives a missing-factor question only when the teacher allows it', () => {
    const pack = makeFocusPack([], focus(['tables-6-9'], { onlyThese: true }), { division: false }, random(9));
    for (let i = 0; i < 100; i++) {
      const q = pack.nextQuestion({ division: false, missingFactor: false })!;
      expect(q.parts[4]).toBe('?');
      pack.recordAnswer(q, q.answer, 2000);
    }
  });

  it('returns nothing when every table in the focus is switched off', () => {
    const pack = makeFocusPack([], focus(['tables-6-9'], { onlyThese: true }), { enabledTables: [2, 3] }, random(1));
    expect(pack.nextQuestion({})).toBeNull();
  });

  it('is an AutoPack under a focus', () => {
    expect(makeFocusPack([], focus(['facts-10']))).toBeInstanceOf(AutoPack);
    expect(makeFocusPack([], null)).toBeInstanceOf(TimesTables);
  });
});

describe('sorting answers into packs', () => {
  it('knows the pack of every ladder key', () => {
    for (const skill of LADDER.filter((s) => s.built)) {
      for (const key of skill.keys) expect(packIdOfKey(key), key).not.toBeNull();
    }
    expect(packIdOfKey('mul:7x8')).toBe('times-tables');
    expect(packIdOfKey('bond10:3+7')).toBe('early-facts');
    expect(packIdOfKey('dbl:7')).toBe('early-facts');
    expect(packIdOfKey('half:14')).toBe('early-facts');
    expect(packIdOfKey('add:3+4')).toBe('add-sub');
    expect(packIdOfKey('div:56/8')).toBe('division');
    expect(packIdOfKey('pat:add')).toBeNull();
    expect(packIdOfKey('mul:junk')).toBeNull();
  });

  it('groups a mixed batch', () => {
    const groups = groupByPack([{ key: 'mul:7x8' }, { key: 'bond10:3+7' }, { key: 'mul:2x5' }, { key: 'who:knows' }]);
    expect(groups.get('times-tables')).toHaveLength(2);
    expect(groups.get('early-facts')).toHaveLength(1);
    expect(groups.size).toBe(2);
  });
});

describe('marking a question from the screen', () => {
  it('agrees with every question the focus pack can make', () => {
    // Every built skill, many seeds, every shape, with and without multiple choice and division.
    for (const skill of LADDER.filter((s) => s.built)) {
      const pack = makeFocusPack([], focus([skill.id], { onlyThese: true }), { division: true }, randomFromSeed(`solve-${skill.id}`));
      for (let i = 0; i < 400; i++) {
        const q = pack.nextQuestion({ division: true, missingFactor: true })!;
        // A browser sends the record and the numbers with the answer; the server makes the question again from them.
        const solved = solveClaim({ parts: q.parts, key: q.factKey, params: q.params });
        expect(solved, `${skill.id}: ${q.parts.join(' ')}`).not.toBeNull();
        expect(solved!.answer, `${skill.id}: ${q.parts.join(' ')}`).toBe(q.answer);
        expect(solved!.keys, `${skill.id}: ${q.parts.join(' ')} should count towards ${q.factKey}`).toContain(q.factKey);
        pack.recordAnswer(q, q.answer, 3000);
      }
    }
  });

  it('agrees with the old times-table marking on its questions', () => {
    const pack = new TimesTables([], randomFromSeed('old'));
    for (let i = 0; i < 300; i++) {
      const q = pack.nextQuestion({ level: 9, division: true, missingFactor: true })!;
      const old = solveQuestion(q.parts)!;
      const solved = solveParts(q.parts)!;
      expect(solved.answer).toBe(old.answer);
      expect(solved.keys[0]).toBe(old.key); // the times-table record comes first, where it has always counted
    }
  });

  it('turns down shapes no skill asks, and impossible numbers', () => {
    expect(solveParts(null)).toBeNull();
    expect(solveParts('7 + 3 = ?')).toBeNull();
    expect(solveParts(['7', '+', '?', '=', '?'])).toBeNull();
    expect(solveParts(['7', '+', '3', '=', '10'])).toBeNull();
    expect(solveParts(['? ', '−', '3', '=', '4'])).toBeNull();
    expect(solveParts(['3', '−', '7', '=', '?'])).toBeNull(); // negative
    expect(solveParts(['7', '÷', '2', '=', '?'])).toBeNull(); // not whole
    expect(solveParts(['7', '÷', '0', '=', '?'])).toBeNull();
    expect(solveParts(['13', '×', '2', '=', '?'])).toBeNull(); // not a times-table fact
    expect(solveParts(['999', '+', '999', '=', '?'])).toBeNull(); // no ladder key
    expect(solveParts(['7', 1 as unknown as string, '3', '=', '?'])).toBeNull();
    expect(solveParts(['Double', '7', '=', '?'])!.answer).toBe(14);
  });

  it('lets a question count towards the fact the browser says, if it fits', () => {
    const solved = solveParts(['7', '+', '?', '=', '10'])!;
    expect(solved.keys).toContain('bond10:3+7');
    expect(solved.keys).toContain('add:3+7');
    expect(keyForAnswer(solved, 'bond10:3+7')).toBe('bond10:3+7');
    expect(keyForAnswer(solved, 'add:3+7')).toBe('add:3+7');
    expect(keyForAnswer(solved, 'mul:9x9')).toBe(solved.keys[0]); // a fact it does not fit
    expect(keyForAnswer(solved, undefined)).toBe(solved.keys[0]);
    expect(keyForAnswer(solved, 42)).toBe(solved.keys[0]);
  });

  it('knows which keys the games record', () => {
    expect(isFocusKey('mul:12x12')).toBe(true);
    expect(isFocusKey('bond20:8+12')).toBe(true);
    expect(isFocusKey('mul:13x2')).toBe(false);
    expect(isFocusKey('add:2d+2d:carry')).toBe(false);
    expect(isFocusKey('')).toBe(false);
  });
});

describe('records', () => {
  it('a focus pack loads and returns every pack`s records', () => {
    const saved: FactStats[] = [afterAnswer(newStats('mul:6x7'), true, 2000, 1), afterAnswer(newStats('bond10:3+7'), true, 2000, 1), afterAnswer(newStats('add:3+4'), true, 2000, 1), afterAnswer(newStats('div:56/8'), true, 2000, 1)];
    const pack = makeFocusPack(saved, focus([tablesSix.id]));
    expect(pack.stats().map((s) => s.key).sort()).toEqual(saved.map((s) => s.key).sort());
  });
});
