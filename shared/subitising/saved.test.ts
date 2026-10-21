import { describe, expect, it } from 'vitest';
import { STAGES } from './config';
import { progressFrom, type SubAnswer } from './engine';
import { gapKey, helpedKey, isQuickKey, parseKey, plainKey, subKey } from './keys';
import { defaultSettings, finishedInARow, packSettings, quickAnswersFrom, splitTyping, typingWithSettings, unpackSettings } from './saved';

describe('keys for answers given with help', () => {
  it('are the same picture, marked helped, and mark the same answer', () => {
    expect(helpedKey('sub:ten-8')).toBe('subh:ten-8');
    expect(helpedKey('gap:five-4')).toBe('gaph:five-4');
    expect(plainKey('subh:ten-8')).toBe('sub:ten-8');
    expect(parseKey('subh:ten-8')).toMatchObject({ helped: true, answer: 8, stage: 4 });
    expect(parseKey('gaph:five-4')).toMatchObject({ helped: true, answer: 1 });
    expect(parseKey('sub:ten-8')?.helped).toBe(false);
  });
  it('fit the saved-answer key pattern', () => {
    expect(helpedKey(gapKey('tenpair', 9))).toMatch(/^[a-z0-9]{1,12}:[0-9a-z/+-]{1,20}$/);
  });
  it('turn away silly numbers and made-up pictures', () => {
    for (const k of ['sub:line-99', 'sub:line-0', 'sub:line-4', 'sub:ten-4', 'sub:ten-11', 'sub:cube-3', 'gap:five-5', 'gap:five-0', 'gaph:dice-3', 'subhh:ten-8', 'sub:ten-08x']) {
      expect(parseKey(k), k).toBeNull();
    }
    expect(isQuickKey('mul:6x7')).toBe(false);
    expect(isQuickKey('subh:ten-8')).toBe(true);
  });
});

describe('Quick looks settings saved with the student', () => {
  const full = { placed: true, startStage: 3 as const, finished: 2 as const, guided: true };
  it('pack small and read back the same', () => {
    expect(unpackSettings(packSettings(full))).toEqual(full);
    expect(unpackSettings(packSettings(defaultSettings()))).toEqual(defaultSettings());
    expect(JSON.stringify(packSettings(full)).length).toBeLessThan(40);
  });
  it('are never trusted when they are not the short form', () => {
    for (const bad of [null, [], 'x', {}, { p: 2, s: 1, f: 0, g: 0 }, { p: 1, s: 5, f: 0, g: 0 }, { p: 1, s: 1, f: 5, g: 0 }, { p: 1, s: 1, f: 0, g: 0, extra: 1 }, { p: 1, s: 1.5, f: 0, g: 0 }]) {
      expect(unpackSettings(bad), JSON.stringify(bad)).toBeNull();
    }
  });
  it('ride in the typing column without disturbing the typing times', () => {
    const typing = { 1: [600, 650], 2: [900] };
    const stored = typingWithSettings(typing, full);
    expect(stored.q).toEqual(packSettings(full));
    expect(splitTyping(stored)).toEqual({ typing, quick: full });
    // A student who never used Quick looks has nothing added, and old rows read as "no settings".
    expect(typingWithSettings(typing, null)).toEqual(typing);
    expect(splitTyping(typing)).toEqual({ typing, quick: null });
    expect(splitTyping({ 1: [5], q: 'junk' }).quick).toBeNull();
  });
});

describe('Quick looks answers inside a student’s saved answers', () => {
  it('are picked out, oldest first, with helped ones marked and times-table ones left alone', () => {
    const saved = [
      { key: 'mul:6x7', correct: true, at: 5 },
      { key: 'sub:line-2', correct: true, at: 4 },
      { key: 'subh:line-3', correct: false, at: 2 },
      { key: 'gap:five-4', correct: false, at: 3 },
    ];
    const out = quickAnswersFrom(saved);
    expect(out.map((a) => a.key)).toEqual(['subh:line-3', 'gap:five-4', 'sub:line-2']);
    expect(out.map((a) => a.helped)).toEqual([true, undefined, undefined]);
  });
  it('give the same stage progress as the full list, and helped ones count for nothing', () => {
    const types = STAGES[0].types;
    const rights = Array.from({ length: 8 }, (_, i): SubAnswer => ({ key: subKey(types[i % 3], 2), correct: i !== 2, at: i }));
    const helped = Array.from({ length: 8 }, (_, i) => ({ key: helpedKey(subKey(types[0], 1)), correct: false, at: 100 + i }));
    const saved = [...rights, ...helped];
    const p = progressFrom(quickAnswersFrom(saved));
    expect(p.stages[0].finished).toBe(true);
    expect(p.stages[0].answers).toHaveLength(8);
  });
});

/** The newest `keep` answers of each key, as record_training_answers leaves them. */
function trim(all: SubAnswer[], keep: number): SubAnswer[] {
  const seen = new Map<string, number>();
  const kept: SubAnswer[] = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const n = (seen.get(all[i].key) ?? 0) + 1;
    seen.set(all[i].key, n);
    if (n <= keep) kept.unshift(all[i]);
  }
  return kept;
}

describe('a finished stage and the database keeping only the newest 30 answers per picture', () => {
  // Stage 1 has 3 pictures types x 3 numbers = 9 keys, so 270 answers are kept for it. A student who finished it
  // long ago and has since only met it as review (or, on the last stage, got everything wrong for months) can have
  // every answer that finished it trimmed away. Worked out with the real numbers: it needs a lot of wrong answers.
  const stage1 = STAGES[0];
  const early: SubAnswer[] = Array.from({ length: 8 }, (_, i) => ({ key: subKey(stage1.types[i % 3], 1 + (i % 3)), correct: true, at: i }));
  const later: SubAnswer[] = Array.from({ length: 9 * 35 }, (_, i) => ({ key: subKey(stage1.types[i % 3], 1 + (Math.floor(i / 3) % 3)), correct: false, at: 1000 + i }));

  it('can be forgotten when it is worked out from the trimmed answers alone', () => {
    expect(progressFrom([...early, ...later]).stages[0].finished).toBe(true);
    expect(progressFrom(trim([...early, ...later], 30)).stages[0].finished).toBe(false);
  });
  it('is not forgotten once the furthest stage is saved with the student', () => {
    const p = progressFrom(trim([...early, ...later], 30), 1, undefined, 1);
    expect(p.stages[0].finished).toBe(true);
    expect(p.current).toBe(2);
    expect(finishedInARow(p)).toBe(1);
  });
  it('counts stages in a row from the first', () => {
    expect(finishedInARow(progressFrom([], 3))).toBe(2);
    expect(finishedInARow(progressFrom([]))).toBe(0);
    expect(finishedInARow(progressFrom([], 1, undefined, 4))).toBe(4);
  });
});
