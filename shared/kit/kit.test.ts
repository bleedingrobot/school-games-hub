import { describe, expect, it } from 'vitest';
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
import { arcAfter, daysPerReward, finishDay } from './dayArc';
import { atMostShareTell, hasNearMiss, kindByUnits, NEW_GO, stepGo, tagWrongs, unitsOff } from './mistakes';
import { fadeAfter, helpForFact, helpWithSetting, placeAfter, ROUND_OF_TEN, type StepRules } from './help';
import { replayTaps, type ReplayGo, type Tap } from './replay';

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
    const rec = (box: number, correct: number, quick: number) => ({ box, correct, quickDays: Array(quick).fill('2026-11-04') });
    expect(helpForFact(undefined, rungs)).toBe('full');
    expect(helpForFact(rec(5, 20, 1), rungs)).toBe('full'); // right lots, but only quick on one day
    expect(helpForFact(rec(2, 2, 2), rungs)).toBe('faint');
    expect(helpForFact(rec(4, 6, 2), rungs)).toBe('none');
    expect(helpForFact(rec(1, 20, 3), rungs)).toBe('full'); // a wrong answer dropped it to box 1
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
    // The same as Tūī's own copy, in every place a child can be.
    for (const step of [1, 2, 3, 4, 5] as Step[]) for (const level of [0, 1, 2, 3, 4, 5] as HelpLevel[]) for (const goodInRow of [0, 1]) for (const goodAtStep of [0, 1]) for (let right = 0; right <= 10; right++) {
      const place = { step, level, goodInRow, goodAtStep };
      expect(placeAfter(place, right, TUI_RULES)).toEqual(tuiPlaceAfter(place, right));
    }
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
      const { goesDone, firstRight, ...kitSame } = replayTaps(goes, taps, { goesPerRound: HOPS_PER_ROUND, oncePerFact: false });
      expect(goesDone).toBe(hopsMade);
      expect(kitSame).toEqual(hopSame);

      const tui = tuiRound(seed, []);
      const tuiGoes = showTui(tui);
      const tuiTaps = tapsFor(tuiGoes, seed, slips);
      expect(replayTaps(tuiGoes, tuiTaps, { goesPerRound: TUI_GOES, oncePerFact: true })).toEqual(tuiReplay(tui, tuiTaps));
    }
    expect(() => replayTaps([{ key: 'k', answer: 1, choices: [1, 2] }], [{ pick: 3, ms: 1 }], { goesPerRound: 1, oncePerFact: true })).toThrow();

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
    expect(h.digest('hex')).toBe('0ed75da9c90d68506c236e53eba1f3160c8f971a');
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
