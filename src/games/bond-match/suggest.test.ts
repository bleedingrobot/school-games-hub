import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findBondSet } from '../../../shared/bond-match/bonds';
import { LADDER } from '../../../shared/maths/ladder';
import { parseFocus } from '../../../shared/maths/focus';
import type { FactStats } from '../../../shared/maths/leitner';
import type { MyLadder } from '../../data/ladder';
import { SKILL_BONDS, suggestBond } from './suggest';

const NOW = new Date('2026-10-21T00:00:00Z');
const LATER = '2026-10-23T04:00:00Z';
const EARLIER = '2026-10-20T04:00:00Z';

const fact = (key: string, box: number): FactStats => ({ key, attempts: 5, correct: 5, avgMs: 2000, box, lastSeen: 0, quickDays: [] });

function ladder(focus: Record<string, unknown>, facts: FactStats[] = []): MyLadder {
  return { facts, settings: {}, focus: parseFocus({ onlyThese: false, canChoose: true, own: null, endsAt: null, ...focus }) };
}
const teacher = (skills: string[], extra: Record<string, unknown> = {}) => ladder({ source: 'teacher-class', skills, endsAt: LATER, ...extra });
const auto = (ladderInfo: Record<string, unknown>, facts: FactStats[] = []) => ladder({ source: 'auto', skills: [], ladder: ladderInfo }, facts);

describe('the map from ladder skills to bond sets', () => {
  it('names only real ladder skills and real bond sets', () => {
    for (const [skill, steps] of Object.entries(SKILL_BONDS)) {
      expect(LADDER.some((s) => s.id === skill && s.built), skill).toBe(true);
      for (const step of steps) expect(findBondSet(step.bond), step.bond).toBeDefined();
      // The record that moves a student on must be one of that skill's own keys.
      for (const step of steps) if (step.movesOnAt) expect(LADDER.find((s) => s.id === skill)!.keys).toContain(step.movesOnAt);
    }
  });

  it('covers bonds to 10, 20, 100 and 1000', () => {
    expect(SKILL_BONDS['facts-10'][0].bond).toBe('whole-10');
    expect(SKILL_BONDS['facts-20'][0].bond).toBe('whole-20');
    expect(SKILL_BONDS['bonds-100'].map((s) => s.bond)).toEqual(['whole-100-tens', 'whole-100-any']);
    expect(SKILL_BONDS['bonds-1000'].map((s) => s.bond)).toEqual(['whole-1000-hundreds', 'whole-1000-tens']);
  });
});

describe('the decimal and fraction bond skills', () => {
  const focus = (skill: string, facts: FactStats[] = []) => suggestBond(ladder({ source: 'teacher-class', skills: [skill], endsAt: LATER }, facts), NOW);

  it('opens a decimal bonds focus on hundredths to 1, then tenths to 10 once hundredths are secure', () => {
    expect(focus('decimal-bonds')).toEqual({ bondId: 'decimal-1-hundredths', why: 'teacher' });
    expect(focus('decimal-bonds', [fact('bondd1:hundredths', 1)])?.bondId).toBe('decimal-1-hundredths');
    expect(focus('decimal-bonds', [fact('bondd1:hundredths', 2)])?.bondId).toBe('decimal-10-tenths');
  });

  it('opens a fraction bonds focus on quarters, then eighths once the small fractions are secure', () => {
    expect(focus('fraction-bonds')).toEqual({ bondId: 'fraction-quarters', why: 'teacher' });
    expect(focus('fraction-bonds', [fact('bondf1:small', 1)])?.bondId).toBe('fraction-quarters');
    expect(focus('fraction-bonds', [fact('bondf1:small', 2)])?.bondId).toBe('fraction-eighths');
  });

  it.each(['decimal-bonds', 'fraction-bonds'])('marks %s for a student on Auto at that skill', (skill) => {
    const got = suggestBond(auto({ on: true, placed: 'done', placement: skill, furthest: null }), NOW);
    expect(got?.why).toBe('auto');
    expect(got?.bondId).toBe(SKILL_BONDS[skill][0].bond);
  });
});

describe('a maths focus', () => {
  it('opens on the bond for a teacher focus, saying the teacher picked it', () => {
    expect(suggestBond(teacher(['bonds-100']), NOW)).toEqual({ bondId: 'whole-100-tens', why: 'teacher' });
    expect(suggestBond(teacher(['facts-10'], { source: 'teacher-group' }), NOW)).toEqual({ bondId: 'whole-10', why: 'teacher' });
    expect(suggestBond(teacher(['bonds-1000'], { source: 'teacher-student' }), NOW)).toEqual({ bondId: 'whole-1000-hundreds', why: 'teacher' });
  });

  it('moves on to the harder set once the easier type is secure (box 2 or more)', () => {
    expect(suggestBond(ladder({ source: 'teacher-class', skills: ['bonds-100'], endsAt: LATER }, [fact('bond100:tens', 1)]), NOW)?.bondId).toBe('whole-100-tens');
    expect(suggestBond(ladder({ source: 'teacher-class', skills: ['bonds-100'], endsAt: LATER }, [fact('bond100:tens', 2)]), NOW)?.bondId).toBe('whole-100-any');
  });

  it('takes the first focus skill with a bond set, in ladder order, and skips the rest', () => {
    const tables = LADDER.find((s) => s.stage === 'times-tables')!.id;
    expect(suggestBond(teacher([tables, 'bonds-1000', 'facts-20']), NOW)?.bondId).toBe('whole-20');
  });

  it("says a student's own focus is theirs", () => {
    expect(suggestBond(ladder({ source: 'student', skills: ['add-tenths'] }), NOW)).toEqual({ bondId: 'decimal-1-tenths', why: 'own' });
  });

  it('suggests nothing for a focus with no bond set, even with auto on (a focus switches auto off)', () => {
    const tables = LADDER.find((s) => s.stage === 'times-tables')!.id;
    expect(suggestBond(teacher([tables], { ladder: { on: true, placed: null, placement: null, furthest: null } }), NOW)).toBeNull();
  });

  it('forgets a teacher focus that has ended', () => {
    expect(suggestBond(teacher(['bonds-100'], { endsAt: EARLIER }), NOW)).toBeNull();
    expect(suggestBond(teacher(['bonds-100'], { endsAt: EARLIER, ladder: { on: true, placed: null, placement: null, furthest: null } }), NOW)).toEqual({ bondId: 'whole-10', why: 'auto' });
  });
});

describe('auto (no focus)', () => {
  it("marks the bond for the student's place on the ladder", () => {
    expect(suggestBond(auto({ on: true, placed: null, placement: null, furthest: null }), NOW)).toEqual({ bondId: 'whole-10', why: 'auto' });
    expect(suggestBond(auto({ on: true, placed: 'done', placement: 'bonds-1000', furthest: null }), NOW)).toEqual({ bondId: 'whole-1000-hundreds', why: 'auto' });
  });

  it('on a skill with no bond set, takes the last bond skill below it', () => {
    // The first times-table step comes straight after Doubles and halves to 20, so the bonds are to 20.
    const firstTables = LADDER.find((s) => s.stage === 'times-tables')!.id;
    expect(suggestBond(auto({ on: true, placed: 'done', placement: firstTables, furthest: null }), NOW)?.bondId).toBe('whole-20');
    expect(suggestBond(auto({ on: true, placed: 'done', placement: 'bedmas', furthest: null }), NOW)?.bondId).toBe('decimal-1-hundredths');
  });

  it('suggests nothing when auto is off and there is no focus: the picker is as before', () => {
    expect(suggestBond(auto({ on: false, placed: null, placement: null, furthest: null }), NOW)).toBeNull();
    expect(suggestBond(null, NOW)).toBeNull();
  });
});

describe('Bond Match is never evidence for the ladder (James, 19 and 20 Oct 2026)', () => {
  it('has no way to write a maths record, a ladder place or a focus result: no file of the game names one', () => {
    const writers = /record_fact_answers|recordMathsAnswers|recordAnswers|add_maths_focus_results|countForFocuses|record_ladder_place|record_placement|syncPlace|sendPlacement|set_my_maths_focus|saveMyFocus|clearMyFocus/;
    const dirs = ['src/games/bond-match', 'shared/bond-match', 'supabase/functions/bond-match'];
    for (const dir of dirs) {
      for (const name of readdirSync(resolve(dir))) {
        if (!/\.tsx?$/.test(name) || name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
        expect(readFileSync(join(resolve(dir), name), 'utf8'), `${dir}/${name}`).not.toMatch(writers);
      }
    }
    expect(readFileSync(resolve('src/data/bondMatch.ts'), 'utf8')).not.toMatch(writers);
  });
});
