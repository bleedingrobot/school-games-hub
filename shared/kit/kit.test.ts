import { describe, expect, it } from 'vitest';
import { slipsOf, topSlip } from './slips';
import { replay as hopReplay } from '../hop/play';
import { DAYS_PER_JAR, finishChallenge as hopFinish, FRIENDS as HOP_FRIENDS, PADS, pondAfter } from '../hop/progress';
import { makeRound as hopRound, showRound as showHops, HOPS_PER_ROUND } from '../hop/round';
import { seeded } from '../seededRandom';
import { replay as tuiReplay } from '../tui/play';
import { GOES_PER_ROUND as TUI_GOES, makeRound as tuiRound, placeAfter as tuiPlaceAfter, showRound as showTui, type HelpLevel, type Step } from '../tui/round';
import { createHash } from 'node:crypto';
import { WORDS as BEANSTALK_WORDS } from '../../src/games/beanstalk/words';
import { makeRound as beanstalkRound, mistakeKind, replay as beanstalkReplay, TARGETS, type Tap as BeanstalkTap } from '../beanstalk/round';
import { kindsFromFacts, mergeSeen, readKinds } from './seen';
import { finishBand } from './finishBand';
import { sisterNumber } from './sister';
import { arcAfter, daysPerReward, finishDay } from './dayArc';
import { atMostShareTell, hasNearMiss, kindByUnits, NEW_GO, stepGo, tagWrongs, unitsOff } from './mistakes';
import { fadeAfter, fadeByKind, helpForFact, helpWithSetting, placeAfter, ROUND_OF_TEN, type StepRules } from './help';
import { replayTaps, type ReplayGo, type Tap } from './replay';
import { JUNIOR_MIN_THINK_MS } from '../juniorQuick';

const TUI_RULES: StepRules = { ...ROUND_OF_TEN, topLevel: 5, goodToPass: 2, topStep: 5, newStepHelp: 1, newStepLevel: 4 };

/** Taps for these goes: up to three wrong picks on a go (fewer right first time as `slips` rises), then the right one. */
function tapsFor(goes: readonly ReplayGo[], seed: number, slips: number): Tap[] {
  const r = seeded(seed);
  return goes.flatMap((g) => {
    const wrongs = g.choices.filter((c) => c !== g.answer);
    const n = r() < slips ? 1 + Math.floor(r() * Math.min(3, wrongs.length)) : 0;
    return [...wrongs.slice(0, n).map((pick) => ({ pick, ms: 4000 })), { pick: g.answer, ms: 1000 + Math.floor(r() * 5000) }];
  });
}

describe('help follows the child', () => {
  it('fades fact by fact and child by child, comes back after struggle, and a fade stands when a step is passed', () => {
    const rungs = [{ help: 'full', until: { box: 2, quickDays: 2 } }, { help: 'faint', until: { box: 4, correct: 6 } }, { help: 'none' }];
    const rec = (box: number, correct: number, quick: number, attempts = correct) => ({ box, correct, attempts, quickDays: Array(quick).fill('2026-11-04') });
    expect(helpForFact(undefined, rungs)).toBe('full');
    expect(helpForFact(rec(5, 20, 0), rungs)).toBe('full'); // right lots, but never quick
    expect(helpForFact(rec(2, 2, 2), rungs)).toBe('faint');
    expect(helpForFact(rec(4, 6, 2), rungs)).toBe('none');
    expect(helpForFact(rec(1, 20, 3, 21), rungs)).toBe('full'); // a wrong answer dropped it to box 1
    expect(helpWithSetting('faint', 'fade', { always: 'full', off: 'none' })).toBe('faint');
    expect(helpWithSetting('faint', 'always', { always: 'full', off: 'none' })).toBe('full');
    expect(helpWithSetting('faint', 'off', { always: 'full', off: 'none' })).toBe('none');

    const rules = { ...ROUND_OF_TEN, topLevel: 2 };
    expect(fadeAfter({ level: 2, goodInRow: 0 }, 8, rules)).toEqual({ level: 2, goodInRow: 1, faded: false });
    expect(fadeAfter({ level: 2, goodInRow: 1 }, 9, rules)).toEqual({ level: 1, goodInRow: 0, faded: true });
    expect(fadeAfter({ level: 1, goodInRow: 1 }, 4, rules)).toEqual({ level: 2, goodInRow: 0, faded: false });
    expect(fadeAfter({ level: 2, goodInRow: 0 }, 0, rules).level).toBe(2);

    // A strong child: the pass and the fade land together, and the help still comes down over the game.
    let p = { step: 1, level: 5, goodInRow: 0, goodAtStep: 0 };
    p = placeAfter(placeAfter(p, 10, TUI_RULES), 10, TUI_RULES);
    expect(p).toEqual({ step: 2, level: 4, goodInRow: 0, goodAtStep: 0 });
    // Tūī's own copy is the same in every place a child can be, except for two S25 changes: a 10 out of 10 round counts as two
    // good rounds, and a fade that lands with a step pass is not floored back up to the ten-frames.
    for (const step of [1, 2, 3, 4, 5] as Step[]) for (const level of [0, 1, 2, 3, 4, 5] as HelpLevel[]) for (const goodInRow of [0, 1]) for (const goodAtStep of [0, 1]) for (let right = 0; right <= 10; right++) {
      const place = { step, level, goodInRow, goodAtStep };
      const kit = placeAfter(place, right, TUI_RULES);
      const tui = tuiPlaceAfter(place, right);
      if (right === 10) continue;
      if (JSON.stringify(kit) === JSON.stringify(tui)) continue;
      expect(tui).toEqual({ ...kit, level: tui.level });
      expect(tui.step).toBe(place.step + 1);
      expect(tui.level).toBeLessThan(4);
      expect(kit.level).toBe(4);
    }
  });
});

describe('full help ends sooner (S25)', () => {
  const rungs = [{ help: 'full', until: { box: 2, quickDays: 1 } }, { help: 'faint', until: { box: 4, correct: 6 } }, { help: 'none' }];
  const rec = (box: number, correct: number, attempts: number, quick: number) => ({ box, correct, attempts, quickDays: Array(quick).fill('2026-11-04') });
  it('leaves full help after two quick rights on one day, or a clean right-and-quick first answer', () => {
    expect(helpForFact(rec(2, 2, 2, 1), rungs)).toBe('faint'); // two rights, one quick day
    expect(helpForFact(rec(1, 1, 1, 1), rungs)).toBe('faint'); // one clean quick right
    expect(helpForFact(rec(2, 2, 2, 0), rungs)).toBe('full'); // right twice but slow: no quick day
    expect(helpForFact(rec(0, 0, 0, 0), rungs)).toBe('full');
  });
  it('brings full help back after a wrong answer', () => {
    expect(helpForFact(rec(1, 2, 3, 1), rungs)).toBe('full'); // box 1 and a wrong answer on record
    expect(helpForFact(rec(1, 5, 6, 2), rungs)).toBe('full');
  });
  it('only the first rung has the early door', () => {
    const later = [{ help: 'a', until: { quickDays: 1 } }, { help: 'b', until: { quickDays: 3 } }, { help: 'c' }];
    expect(helpForFact(rec(2, 2, 2, 1), later)).toBe('b');
  });
});

describe('help for each kind of go', () => {
  it('scales each kind to ten, leaves a kind with one go, fades after two good rounds, brings help back after a hard one and starts a new kind at the default', () => {
    const rules = { ...ROUND_OF_TEN, topLevel: 5 };
    const round = (...rs: [string, boolean][]) => rs.map(([kind, right]) => ({ kind, right }));
    // Two goes, both right: 10 of ten, a good round. One go: unchanged (not even added).
    const one = fadeByKind({}, round(['read', true], ['read', true], ['swap', false]), rules, 4);
    expect(one).toEqual({ read: { level: 4, goodInRow: 1 } });
    // A second good round fades that kind one level; the other kind is untouched.
    const two = fadeByKind({ ...one, swap: { level: 3, goodInRow: 0 } }, round(['read', true], ['read', true]), rules, 4);
    expect(two).toEqual({ read: { level: 3, goodInRow: 0 }, swap: { level: 3, goodInRow: 0 } });
    // A hard round (1 of 4 right is 3 of ten) brings one level back, while another kind fades on its own.
    const hard = fadeByKind({ read: { level: 3, goodInRow: 0 }, swap: { level: 2, goodInRow: 1 } }, round(['read', true], ['read', false], ['read', false], ['read', false], ['swap', true], ['swap', true]), rules, 4);
    expect(hard).toEqual({ read: { level: 4, goodInRow: 0 }, swap: { level: 1, goodInRow: 0 } });
    // Never past the top or below none.
    expect(fadeByKind({ read: { level: 5, goodInRow: 0 } }, round(['read', false], ['read', false]), rules, 5).read.level).toBe(5);
    expect(fadeByKind({ read: { level: 0, goodInRow: 1 } }, round(['read', true], ['read', true]), rules, 5).read.level).toBe(0);
  });
});

describe('the replay and the day arc', () => {
  it('give the same as the games’ own copies, so a game can move onto them with no change', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const slips = (seed % 5) / 4;
      const hops = hopRound(seed, []);
      const goes = showHops(hops);
      const taps = tapsFor(goes, seed, slips);
      const { hopsMade, ...hopSame } = hopReplay(hops, taps);
      const { goesDone, ...kitSame } = replayTaps(goes, taps, { goesPerRound: HOPS_PER_ROUND, oncePerFact: false, minThinkMs: JUNIOR_MIN_THINK_MS });
      expect(goesDone).toBe(hopsMade);
      expect(kitSame).toEqual(hopSame);

      const tui = tuiRound(seed, []);
      const tuiGoes = showTui(tui);
      const tuiTaps = tapsFor(tuiGoes, seed, slips);
      // Tūī's copy also lists which goes were right first time (for the help of each way); the kit's replay does not.
      const { rightFirst: _rightFirst, ...tuiSame } = tuiReplay(tui, tuiTaps);
      expect(replayTaps(tuiGoes, tuiTaps, { goesPerRound: TUI_GOES, oncePerFact: true, minThinkMs: JUNIOR_MIN_THINK_MS })).toEqual(tuiSame);
    }
    expect(() => replayTaps([{ key: 'k', answer: 1, choices: [1, 2] }], [{ pick: 3, ms: 1 }], { goesPerRound: 1, oncePerFact: true })).toThrow();

    // S14: a right first tap under the think floor is still an answer, but is not a first right.
    const one: ReplayGo[] = [{ key: 'k', answer: 1, choices: [1, 2] }, { key: 'j', answer: 2, choices: [1, 2] }];
    const floored = replayTaps(one, [{ pick: 1, ms: 80 }, { pick: 2, ms: 700 }], { goesPerRound: 2, oncePerFact: true, minThinkMs: 600 });
    expect(floored.firstRight).toBe(1);
    expect(floored.answers).toEqual([{ key: 'k', correct: true, ms: 80 }, { key: 'j', correct: true, ms: 700 }]);
    expect(replayTaps(one, [{ pick: 1, ms: 80 }, { pick: 2, ms: 700 }], { goesPerRound: 2, oncePerFact: true }).firstRight).toBe(2);

    expect(daysPerReward(PADS)).toBe(DAYS_PER_JAR);
    for (let d = 0; d < 200; d++) {
      const pond = pondAfter(d);
      expect(arcAfter(d, { items: PADS, base: 'green', friends: HOP_FRIENDS })).toEqual({ rewards: pond.jars, friend: pond.friend, day: pond.day, row: pond.pads, today: pond.today });
      for (const last of [null, '2026-11-05']) {
        const hop = hopFinish(d, last, '2026-11-05');
        expect(finishDay(d, last, '2026-11-05', PADS)).toEqual({ daysDone: hop.daysDone, lastDay: hop.lastPadDay, changed: hop.padChanged, reward: hop.jar });
      }
    }
  });
});

describe('mistakes that teach', () => {
  it('tags wrong choices, limits the shared tell, finds near misses and runs the two-tap flow', () => {
    expect(tagWrongs([14, 41, 41, 20, 14], (n) => (n === 14 ? null : n === 41 ? 'reverse' : 'tens'))).toEqual([{ n: 41, kind: 'reverse' }, { n: 20, kind: 'tens' }]);
    const endsInZero = (n: number) => n % 10 === 0;
    expect(atMostShareTell(40, [30, 50, 39], endsInZero)).toBe(false); // three end in 0
    expect(atMostShareTell(40, [30, 39, 41], endsInZero)).toBe(true);
    expect(kindByUnits(unitsOff(12, 10), { one: 'c', over: 'o', under: 'u' })).toBe('o');
    expect(kindByUnits(unitsOff(60, 100, 10), { one: 'c', over: 'o', under: 'u' })).toBe('u');
    expect(kindByUnits(unitsOff(90, 100, 10), { one: 'c', over: 'o', under: 'u' })).toBe('c');
    expect(kindByUnits(0, { one: 'c', over: 'o', under: 'u' })).toBeNull();
    expect(hasNearMiss([3, 6, 8], 10)).toBe(true); // 3 + 6 = 9
    expect(hasNearMiss([3, 7, 5], 10)).toBe(false);
    // wrong, wrong: look together; the redo's wrong taps show why but never look again; a right tap ends the go
    let go = NEW_GO;
    go = stepGo(go, 'wrong');
    expect(go.phase).toBe('why');
    go = stepGo(go, 'wrong');
    expect(go.phase).toBe('look');
    expect(stepGo(go, 'wrong')).toBe(go); // taps are off while looking
    go = stepGo(go, 'lookDone');
    expect(go.phase).toBe('redo');
    expect(stepGo(go, 'wrong').phase).toBe('redo');
    expect(stepGo(go, 'right')).toEqual(NEW_GO);
    expect(stepGo(stepGo(NEW_GO, 'wrong'), 'right')).toEqual(NEW_GO);
  });

  it('Beanstalk still makes the same rounds, kinds, lines and scoring as before the move', () => {
    // Digest of the old Beanstalk code (7 Nov 2026): 1,500 seeds on each sum, played clean and with wrong pairs first, every tray, kind, line and answer.
    const h = createHash('sha1');
    for (const t of TARGETS.filter((x) => x !== 20)) { // 20 is new (R8); the other three must not change
      for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) h.update(`${t}:${a}:${b}:${BEANSTALK_WORDS.why((a * t) / 10, (b * t) / 10, t)}|`);
      for (let seed = 0; seed < 1500; seed++) {
        const round = beanstalkRound(seed, t);
        h.update(JSON.stringify(round.leaves));
        for (const mode of [0, 1]) {
          const taps: BeanstalkTap[] = [];
          let r = beanstalkReplay(round, taps);
          for (let guard = 0; !r.done && guard < 100; guard++) {
            const s = r.onScreen;
            h.update(JSON.stringify(s));
            const a = s[0];
            if (mode === 1 && guard % 3 !== 2) {
              const wrong = s.flatMap((x) => s.filter((y) => y > x && round.leaves[x] + round.leaves[y] !== t).map((y) => [x, y]))[0];
              if (wrong) {
                taps.push({ a: wrong[0], b: wrong[1], ms: 500 });
                h.update(String(mistakeKind(round.leaves[wrong[0]] + round.leaves[wrong[1]], t)));
                r = beanstalkReplay(round, taps);
                h.update(JSON.stringify([r.wrongInGo, r.tried, r.answers]));
                continue;
              }
            }
            taps.push({ a, b: s.find((j) => j !== a && round.leaves[a] + round.leaves[j] === t)!, ms: 900 });
            r = beanstalkReplay(round, taps);
          }
          h.update(JSON.stringify([r.answers, r.mistakes, r.shown]));
        }
      }
    }
    // The saved answers' keys changed on purpose (S34: one key per pair on the 100s and 1000s), so the fingerprint was renewed.
    expect(h.digest('hex')).toBe('52c868272cfa9130a8d0d7be1b4258fb2166f8d2');
  });

  it('the seen kinds: a body must name known kinds once each, lists merge sorted, and only answered keys count', () => {
    const allowed = ['zoom', 'swap', 'pairs'];
    expect(readKinds(['zoom', 'swap'], allowed)).toEqual(['zoom', 'swap']);
    expect(readKinds([], allowed)).toEqual([]);
    expect(readKinds(['zoom', 'nope'], allowed)).toBeNull();
    expect(readKinds(['zoom', 'zoom'], allowed)).toBeNull();
    expect(readKinds(['zoom', 'swap', 'pairs'], allowed, 2)).toBeNull();
    expect(readKinds('zoom', allowed)).toBeNull();
    expect(mergeSeen(['zoom', 'swap'], ['swap', 'pairs'], [])).toEqual(['pairs', 'swap', 'zoom']);
    const facts = [{ key: 'a', attempts: 3 }, { key: 'b', attempts: 0 }, { key: 'c', attempts: 1 }, { key: 'd', attempts: 2 }];
    expect(kindsFromFacts(facts, (k) => (k === 'd' ? null : k === 'a' || k === 'b' ? 'zoom' : 'swap'))).toEqual(['swap', 'zoom']);
  });
});

describe('the usual slip', () => {
  const kinds = (n: number) => (n > 10 ? 'over' : n < 3 ? 'under' : 'near') as 'over' | 'under' | 'near';
  const goes = [5, 6, 7].map((answer) => ({ answer, kindOf: kinds }));

  it('names the first wrong tap of each go, null for a go right first time, and counts the commonest kind only with enough evidence', () => {
    // Go 1: wrong 12 (over) then wrong 1 (not counted), then right. Go 2: right first time. Go 3: wrong 2 (under), never right.
    const slips = slipsOf(goes, [{ pick: 12 }, { pick: 1 }, { pick: 5 }, { pick: 6 }, { pick: 2 }]);
    expect(slips).toEqual(['over', null, 'under']);
    expect(topSlip(['over', 'over', null, 'over', 'under'], 3)).toBe('over');
    expect(topSlip(['over', 'over', null, 'under'], 3)).toBeNull();
    expect(topSlip(['over', 'over', 'under', 'under', 'over', 'under'], 3)).toBeNull();
    expect(topSlip([null, null])).toBeNull();
  });
});

describe('the finish band', () => {
  it('says most, some or tricky from the goes right at the first tap, with the help ladder’s cut-offs', () => {
    expect([10, 8].map((n) => finishBand(n))).toEqual(['most', 'most']);
    expect([7, 5].map((n) => finishBand(n))).toEqual(['some', 'some']);
    expect([4, 0].map((n) => finishBand(n))).toEqual(['tricky', 'tricky']);
    expect(finishBand(4, 5)).toBe('most');
  });
});

describe('the sister number', () => {
  it('is within 1 or 2 of the number, in range, not avoided, stable for a seed, and null when nothing fits', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = sisterNumber(7, seed, { min: 1, max: 10, avoid: [8, 5] });
      expect(s).not.toBeNull();
      expect([6, 9]).toContain(s);
      expect(Math.abs(s! - 7)).toBeLessThanOrEqual(2);
      expect(s).not.toBe(7);
      expect(sisterNumber(7, seed, { min: 1, max: 10, avoid: [8, 5] })).toBe(s);
    }
    expect(sisterNumber(1, 3, { min: 1, max: 3 })).toBe(sisterNumber(1, 3, { min: 1, max: 3 }));
    expect([2, 3]).toContain(sisterNumber(1, 3, { min: 1, max: 3 }));
    expect(sisterNumber(5, 1, { min: 5, max: 5 })).toBeNull();
    expect(sisterNumber(5, 1, { min: 3, max: 7, avoid: [3, 4, 6, 7] })).toBeNull();
  });
});
