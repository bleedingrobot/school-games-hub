// Smash Quest's rules (docs/BONKERS-PLAN.md): the fight replay, today's quests and adventures waiting, and the rewards.
// The pace across a season is the sim's job (npm run bonkers:sim), not a test.
import { describe, expect, it } from 'vitest';
import { HEARTS, MAX_SAVED_ADVENTURES, POINTS, STARS, TRAINER_HEARTS } from './config';
import { zoneById } from './content';
import {
  adventuresWaiting, chestPiece, emptyProgress, heroPower, makeAdventure, parseQuest, questOptions, replay, rewardsFor,
  starsToTrainer, type Mark, type Progress,
} from './engine';

const hero = (over: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), hero: { cls: 'knight', look: 'girl' }, ...over });
const rights = (n: number, special = false): Mark[] => Array.from({ length: n }, (_, i) => ({ right: true, special: special && i === 0 }));

describe('Smash Quest rules', () => {
  it('the hero smashes on their own, boosted right answers smash hard, wrong ones lose a heart, and a special move works once a fight', () => {
    const quest = parseQuest('laundry:wins:4:0')!;
    const adv = makeAdventure(123, quest, hero());
    expect(makeAdventure(123, quest, hero())).toEqual(adv); // the same seed, the same fights
    expect(adv.foes).toHaveLength(4);
    const power = heroPower(hero());
    const first = adv.foes[0];

    // Three wrong answers in a row: smashed, with only the hero's own smashes landing (never the last one), and on to the next fight.
    const bonked = replay(adv, [{ right: false, special: false }, { right: false, special: false }, { right: false, special: false }]);
    expect(bonked.results[0]).toMatchObject({ outcome: 'bonked', questions: 3, rights: 0 });
    expect(bonked.blows.every((b) => b.ouch && b.hit === 0 && b.auto >= 0)).toBe(true);
    expect(bonked.results[0].outcome).toBe('bonked');
    expect(bonked).toMatchObject({ fight: 1, hearts: HEARTS, stars: STARS.bonked });

    // Each question has a surprise boost (×2, ×3 or ×10), and the Kitchen Knight's special triples it, once a fight.
    expect(adv.moments?.every((m) => [2, 3, 10].includes(m.boost) && m.autos >= 4 && m.autos <= 8)).toBe(true);
    const whack = replay(adv, [{ right: true, special: true }, { right: true, special: true }]);
    expect(whack.blows[0]).toMatchObject({ special: true, hit: power * 3 * adv.moments![0].boost });
    // (A big boost can finish the monster at once: the special is then fresh for the next fight.)
    expect(whack.blows[0].ended !== null || !whack.blows[1].special).toBe(true);

    // One question a fight: the hero's own smashes set it up, so one right answer always wins.
    const one = replay(adv, [{ right: true, special: false }]);
    expect(one.results[0]).toMatchObject({ outcome: 'won', questions: 1 });
    expect(one.blows[0].auto).toBeGreaterThan(0);

    // Pirate Granny's Wool Whirlwind: the monster can't bonk back for 2 questions, even when wrong.
    const granny = makeAdventure(123, quest, hero({ hero: { cls: 'granny', look: 'animal' } }));
    const calm = replay(granny, [{ right: false, special: true }, { right: false, special: false }, { right: false, special: false }]);
    expect(calm.blows.map((b) => b.ouch)).toEqual([false, false, true]);
    // The monster swings twice before questions 1 and 3 (tied up for 2), and bonks back on the wrong third answer.
    expect(calm.blows.map((b) => b.swung)).toEqual([2, 0, 2]);
    expect(calm.hearts).toBe(HEARTS - 6);
    expect(first.hp).toBeGreaterThan(power); // never a one-hit fight without a special
  });

  it('two quests a day, the same all day; adventures wait for missed school days but never more than 3', () => {
    const a = questOptions('pupil-a', '2026-11-30', 1);
    expect(questOptions('pupil-a', '2026-11-30', 1)).toEqual(a);
    expect(a.every((q) => parseQuest(q.id)?.id === q.id)).toBe(true);
    expect(a[0].id).not.toBe(a[1].id);
    // Level 5: the newest zone is always one of the two, and both zones are open.
    const later = questOptions('pupil-a', '2026-11-30', 5);
    expect(later[0].zone).toBe('supermarket');
    expect(later.every((q) => (zoneById(q.zone)?.opens ?? 99) <= 5)).toBe(true);
    expect(parseQuest('moon:wins:4:0')).toBeNull();
    expect(parseQuest('laundry:wins:9:0')).toBeNull();

    // Used today's on Monday: none left Monday, one on Tuesday; a weekend adds nothing; a week off gives 3.
    const used = { credits: 0, creditDay: '2026-11-30' }; // a Monday
    expect(adventuresWaiting({ credits: 0, creditDay: null }, '2026-11-29')).toBe(1); // first visit, even on a Sunday
    expect(adventuresWaiting(used, '2026-11-30')).toBe(0);
    expect(adventuresWaiting(used, '2026-12-01')).toBe(1);
    expect(adventuresWaiting({ credits: 0, creditDay: '2026-12-04' }, '2026-12-06')).toBe(0); // Friday to Sunday
    expect(adventuresWaiting(used, '2026-12-08')).toBe(MAX_SAVED_ADVENTURES);
  });

  it('stars fill the bar, the trainer levels you up, chests give better gear, and points never come from maths results', () => {
    const p = hero({ stars: starsToTrainer(1) - 3 });
    const adv = makeAdventure(7, parseQuest('laundry:wins:4:1')!, p);
    let marks: Mark[] = [];
    let r = replay(adv, marks);
    while (r.phase !== 'done') {
      marks = [...marks, ...rights(1, true)];
      r = replay(adv, marks);
    }
    expect(r).toMatchObject({ trainerMet: true, trainerWon: true, questDone: true });
    expect(r.results.at(-1)).toMatchObject({ trainer: true, outcome: 'won' });
    const got = rewardsFor(p, r);
    expect(got.levelUp).toBe(2);
    expect(got.progress.level).toBe(2);
    expect(got.gear).toEqual(['weapon-1', 'shoes-1']); // two chests: the quest and the trainer
    expect(heroPower(got.progress)).toBeGreaterThan(heroPower(p));
    expect(got.points).toBe(4 * POINTS.fightWon + POINTS.quest + POINTS.trainer);
    expect(chestPiece(4 * 6)).toBeNull(); // every slot gold: chests give stickers instead

    // The trainer bonks you: no level, the bar stays full, so they're waiting next time.
    const adv2 = makeAdventure(7, parseQuest('laundry:wins:4:1')!, p);
    let m2: Mark[] = [];
    let r2 = replay(adv2, m2);
    while (r2.phase === 'fight') { m2 = [...m2, { right: true, special: false }]; r2 = replay(adv2, m2); }
    expect(r2.hearts).toBe(TRAINER_HEARTS);
    while (r2.phase !== 'done') { m2 = [...m2, { right: false, special: false }]; r2 = replay(adv2, m2); }
    const lost = rewardsFor(p, r2);
    expect(lost.levelUp).toBeNull();
    expect(lost.progress.stars).toBe(starsToTrainer(1));
  });
});

import { nextBossWords, seasonView } from './season';

describe('season timeline', () => {
  it('puts a boss on each Friday and the mega boss on the last, from the school clock', () => {
    // Douglas Park: season 1 began Sunday 18 Oct 2026, 35 days; season 2 began 22 Nov.
    const v = seasonView({ start: '2026-10-18', days: 35 }, '2026-11-28')!;
    expect(v.number).toBe(2);
    expect(v.day).toBe(7);
    expect(v.stops.map((s) => s.date)).toEqual(['2026-11-27', '2026-12-04', '2026-12-11', '2026-12-18', '2026-12-25']);
    expect(v.stops.map((s) => s.state)).toEqual(['beaten-time', 'next', 'later', 'later', 'later']);
    expect(v.stops[4].kind).toBe('mega');
    expect(nextBossWords(v)).toMatch(/^Friday boss in 6 days: /);
    expect(seasonView({ start: '2026-10-18', days: 35 }, '2026-10-01')).toBeNull();
    expect(seasonView(null, '2026-11-28')).toBeNull();
  });
});
