import { describe, expect, it } from 'vitest';
import { TRAINING_CONFIG } from './config';
import { FACTS } from './facts';
import { buildSession, currentStep, learningFacts, nextQuestionIndex } from './session';
import { emptyState, isFlying, isKnown, isResting, recordAnswer, type TrainingState } from './records';

const TODAY = '2026-10-20';

/** A student who knows (bright green, two days) every fact on the given steps, times and division (or only times). */
function knows(steps: number[], base: TrainingState = emptyState(), timesOnly = false): TrainingState {
  let s = base;
  for (const f of FACTS) {
    if (!steps.includes(f.step) || (timesOnly && f.kind !== 'mul')) continue;
    s = recordAnswer(s, f.key, f.answer, f.answer, 1200, '2026-10-17').state;
    s = recordAnswer(s, f.key, f.answer, f.answer, 1200, '2026-10-18').state;
  }
  return s;
}

function midway(): TrainingState {
  let s = knows([1]);
  // Some step 2 facts started: a few slow, a few wrong.
  const step2 = FACTS.filter((f) => f.kind === 'mul' && f.step === 2).slice(0, 5);
  step2.forEach((f, i) => {
    s = recordAnswer(s, f.key, i % 2 ? f.answer + 1 : f.answer, f.answer, 6000, '2026-10-19').state;
  });
  return s;
}

describe('session builder', () => {
  it('is the same for the same seed and different for another', () => {
    const s = midway();
    expect(buildSession(s, TODAY, 42)).toEqual(buildSession(s, TODAY, 42));
    expect(buildSession(s, TODAY, 42)).not.toEqual(buildSession(s, TODAY, 43));
  });

  it('has the configured number of questions, with correct answers', () => {
    const q = buildSession(midway(), TODAY, 7).questions;
    expect(q).toHaveLength(TRAINING_CONFIG.session.questions);
    expect(TRAINING_CONFIG.session.questions).toBeGreaterThanOrEqual(20);
    expect(TRAINING_CONFIG.session.questions).toBeLessThanOrEqual(30);
    for (const x of q) {
      const f = FACTS.find((f) => f.key === x.factKey)!;
      expect(x.answer).toBe(f.answer);
      expect(x.digits).toBe(String(f.answer).length);
    }
  });

  it('follows the mix over many sessions: mostly learning, some review, a few known', () => {
    const state = midway();
    const roles = { learning: 0, review: 0, known: 0 };
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of buildSession(state, TODAY, seed).questions) {
        roles[q.role]++;
        total++;
      }
    }
    expect(roles.learning / total).toBeGreaterThan(0.5);
    expect(roles.learning / total).toBeLessThan(0.75);
    expect(roles.review / total).toBeGreaterThan(0.15);
    expect(roles.review / total).toBeLessThan(0.35);
    expect(roles.known / total).toBeGreaterThan(0.08);
    expect(roles.known / total).toBeLessThan(0.25);
  });

  it('learning questions come from the current step', () => {
    const state = midway();
    expect(currentStep(state)).toBe(2);
    for (let seed = 1; seed <= 50; seed++) {
      for (const q of buildSession(state, TODAY, seed).questions.filter((q) => q.role === 'learning')) {
        expect(FACTS.find((f) => f.key === q.factKey)!.step).toBe(2);
      }
    }
  });

  it('always finishes on a known fact', () => {
    const state = midway();
    for (let seed = 1; seed <= 200; seed++) {
      const q = buildSession(state, TODAY, seed).questions;
      const last = q[q.length - 1];
      expect(last.role).toBe('known');
      expect(isKnown(state.records[last.factKey])).toBe(true);
    }
  });

  it('never asks the same fact twice in a row', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = buildSession(midway(), TODAY, seed).questions;
      for (let i = 1; i < q.length; i++) expect(q[i].factKey).not.toBe(q[i - 1].factKey);
    }
  });

  it('works for a brand new student: starts on step 1, no known facts, still ends on their easiest fact', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = buildSession(emptyState(), TODAY, seed);
      expect(s.step).toBe(1);
      expect(s.questions).toHaveLength(24);
      expect(new Set(s.questions.map((q) => q.factKey)).size).toBeLessThanOrEqual(TRAINING_CONFIG.session.learningFacts);
      for (let i = 1; i < s.questions.length; i++) expect(s.questions[i].factKey).not.toBe(s.questions[i - 1].factKey);
    }
  });

  it('introduces times facts in ladder order (x2 first) and division only after its times fact is secure', () => {
    const first = learningFacts(emptyState(), 6);
    expect(first.map((f) => f.key)).toEqual(['mul:1x2', 'mul:2x2', 'mul:2x3', 'mul:2x4', 'mul:2x5', 'mul:2x6']);
    // Knows the times facts of step 1 only: next up is their division.
    const timesOnly = knows([1], emptyState(), true);
    expect(currentStep(timesOnly)).toBe(1);
    const learning = learningFacts(timesOnly, 6);
    expect(learning.length).toBeGreaterThan(0);
    expect(learning.every((f) => f.kind === 'div' && f.step === 1)).toBe(true);
    expect(learningFacts(emptyState(), 200).some((f) => f.kind === 'div')).toBe(false);
  });

  it('moves up the ladder when every times and division fact on a step is secure', () => {
    expect(currentStep(emptyState())).toBe(1);
    expect(currentStep(knows([1]))).toBe(2);
    expect(currentStep(knows([1], emptyState(), true))).toBe(1);
    expect(currentStep(knows([1, 2, 3]))).toBe(4);
    expect(currentStep(knows([1, 2, 3, 4, 5]))).toBe(5);
  });

  it('a student who starts struggling gets a practice fortnight: no new facts, best known first', () => {
    let s = midway();
    for (let i = 0; i < 10; i++) s = recordAnswer(s, 'mul:3x4', 5, 12, 5000, '2026-10-19').state;
    expect(s.restUntil).toBe('2026-11-02');
    expect(isResting(s, TODAY)).toBe(true);
    const session = buildSession(s, TODAY, 3);
    expect(session.resting).toBe(true);
    expect(session.flying).toBe(false);
    expect(session.questions.filter((q) => q.role === 'learning')).toHaveLength(0);
    // Only facts already met.
    for (const q of session.questions) expect(s.records[q.factKey]).toBeDefined();
    // Mostly facts they know well (bright green), not the ones they are getting wrong.
    const strong = session.questions.filter((q) => isKnown(s.records[q.factKey])).length;
    expect(strong / session.questions.length).toBeGreaterThan(0.6);
    expect(session.questions.some((q) => q.factKey === 'mul:3x4')).toBe(false);
  });

  it('the practice fortnight is not stretched while it runs, and ends after 14 days', () => {
    let s = midway();
    for (let i = 0; i < 10; i++) s = recordAnswer(s, 'mul:3x4', 5, 12, 5000, '2026-10-19').state;
    // More wrong answers a few days later don't move the end.
    for (let i = 0; i < 5; i++) s = recordAnswer(s, 'mul:3x4', 5, 12, 5000, '2026-10-25').state;
    expect(s.restUntil).toBe('2026-11-02');
    expect(isResting(s, '2026-11-01')).toBe(true);
    expect(isResting(s, '2026-11-02')).toBe(false);
    // Over, but still struggling: the gentle mix of 2 new facts among known ones until the next answer.
    const after = buildSession(s, '2026-11-02', 3);
    expect(after.resting).toBe(false);
    expect(after.struggling).toBe(true);
    expect(new Set(after.questions.filter((q) => q.role === 'learning').map((q) => q.factKey)).size).toBe(2);
    // Still getting lots wrong after it: another fortnight starts.
    s = recordAnswer(s, 'mul:3x4', 5, 12, 5000, '2026-11-02').state;
    expect(s.restUntil).toBe('2026-11-16');
  });

  it('a brand-new student who struggles straight away still gets facts to learn (there is nothing to practise yet)', () => {
    const s: TrainingState = { ...emptyState(), restUntil: '2026-11-02' };
    expect(buildSession(s, TODAY, 1).questions.filter((q) => q.role === 'learning').length).toBeGreaterThan(0);
  });

  it('a student who is flying learns 12 new facts at once instead of 6', () => {
    let s = knows([1], emptyState(), true);
    expect(isFlying(s)).toBe(true);
    const flying = buildSession(s, TODAY, 5);
    expect(flying.flying).toBe(true);
    expect(new Set(flying.questions.filter((q) => q.role === 'learning').map((q) => q.factKey)).size).toBe(12);
    // Slow answers lately: back to 6.
    for (const f of FACTS.filter((f) => f.step === 1 && f.kind === 'mul').slice(0, 24)) s = recordAnswer(s, f.key, f.answer, f.answer, 7000, '2026-10-19').state;
    expect(isFlying(s)).toBe(false);
    expect(new Set(buildSession(s, TODAY, 5).questions.filter((q) => q.role === 'learning').map((q) => q.factKey)).size).toBe(6);
  });

  it('needs a full run of answers before it calls anyone flying', () => {
    let s = emptyState();
    for (const f of FACTS.filter((f) => f.kind === 'mul').slice(0, 20)) s = recordAnswer(s, f.key, f.answer, f.answer, 900, '2026-10-19').state;
    expect(isFlying(s)).toBe(false);
  });

  it('skips the steps a starting place has already put behind the student', () => {
    const s: TrainingState = { ...emptyState(), passedSteps: 2 };
    expect(currentStep(s)).toBe(3);
    const learning = learningFacts(s, 6);
    expect(learning.every((f) => f.step === 3)).toBe(true);
    // Never past the last step.
    expect(currentStep({ ...emptyState(), passedSteps: 9 })).toBe(TRAINING_CONFIG.tableFamilies.length);
    // Moving on from the start step works as before.
    expect(currentStep(knows([3], { ...emptyState(), passedSteps: 2 }))).toBe(4);
  });

  it('puts weak and overdue facts into review first', () => {
    let s = knows([1]);
    // A weak old fact and a strong old fact, both from step 1, 10 days ago.
    s = recordAnswer(s, 'mul:2x7', 1, 14, 5000, '2026-10-10').state;
    const reviewed = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const q of buildSession(s, TODAY, seed).questions.filter((q) => q.role === 'review')) reviewed.add(q.factKey);
    }
    expect(reviewed.has('mul:2x7')).toBe(true);
  });
});

describe('three-minute limit', () => {
  it('goes to the next question normally', () => {
    expect(nextQuestionIndex(0, 24, 10_000)).toBe(1);
    expect(nextQuestionIndex(21, 24, 100_000)).toBe(22);
  });
  it('skips to the last (known) question when time is up, then ends', () => {
    expect(nextQuestionIndex(10, 24, 181_000)).toBe(23);
    expect(nextQuestionIndex(22, 24, 181_000)).toBe(23);
    expect(nextQuestionIndex(23, 24, 181_000)).toBeNull();
    expect(nextQuestionIndex(23, 24, 5_000)).toBeNull();
  });
});
