import { describe, expect, it } from 'vitest';
import { checkSave, LIMITS, type BattleReport, type Checked, type SaveItem, type Stored } from './check';
import { makeMonster } from '../rules';
import { AREAS, BADGE_ORDER } from '../world/areas';
import { addToBag, LOOT } from '../world/rewards';
import { refreshBook } from '../world/world';
import { Session } from './testKit';
import { findEgg } from '../quests/eggs';
import { emptyQuestSave, type QuestSave } from '../quests/types';
import type { WorldState } from '../world/types';
import { WORLD_MAPS } from '../maps';
import { podFlag } from '../quests/puzzles';
import { weekOf } from '../world/questWorld';

const ok = (c: Checked) => {
  if (!c.ok) throw new Error(`refused: ${c.problem}`);
  return c.save;
};
const stored = (item: SaveItem): Stored => ({ world: item.world, at: item.at });

/** A student who has started, played a wild battle in Kauri Bush and saved. */
function started() {
  const s = new Session();
  const first = s.save();
  const prev = stored(first);
  s.goto('kauri-bush', 'entrance');
  return { s, prev, first };
}

describe('honest play is accepted', () => {
  it('a new game', () => {
    const s = new Session();
    const first = ok(checkSave(null, s.save(), s.clock.now()));
    expect(first.summary.owned).toBe(2);
    expect(first.summary.catches).toBe(0);
  });

  it('a session of wild battles, a trainer, healing and saving, chained save after save', () => {
    const s = new Session(['leaf', 'ice']);
    // With quests on: wins give bits and keep the eggs warm.
    s.quest = { day: '2026-10-20', player: 'pupil-a', playDays: 0 };
    let prev: Stored | null = null;
    let first = true;
    const accept = () => {
      const item = s.save();
      const saved = ok(checkSave(prev, item, s.clock.now(), 'pupil-a'));
      prev = stored(item);
      first = false;
      return saved;
    };
    accept();
    s.goto('kauri-bush', 'entrance');
    let wins = 0;
    let answers = 0;
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 8; i++) s.wild();
      const saved = accept();
      wins += saved.summary.wildWins;
      answers += saved.summary.questions;
    }
    expect(first).toBe(false);
    expect(wins).toBeGreaterThan(10);
    expect(answers).toBeGreaterThan(40); // a wild battle asks once (its power up), plus any catches
    expect(Object.values(s.world.quest!.bits).reduce((a, b) => a + b!, 0)).toBeGreaterThan(10);
  });

  it('every wild monster of every area, and every trainer, through a whole route', () => {
    for (const picks of [['water', 'fire'], ['stone', 'stone']] as const) {
      const s = new Session([...picks]);
      let prev: Stored | null = null;
      const accept = () => {
        const item = s.save();
        ok(checkSave(prev, item, s.clock.now()));
        prev = stored(item);
      };
      accept();
      for (const [map, trainers] of [['kauri-bush', ['kauri-bush:ranger-kiri']]] as const) {
        s.goto(map, 'entrance');
        for (let i = 0; i < 12; i++) s.wild();
        accept();
        for (const t of trainers) {
          s.goto(map, 'trainer-approach');
          if (s.maps[map].things.some((x) => x.id === t)) {
            s.trainer(t);
            accept();
          }
        }
      }
    }
  });
});

describe('the whole game, honestly', () => {
  it('beating all six Towers in order is accepted, save after save, and earns the badges', () => {
    const s = new Session(['water', 'fire'], { right: 1, ms: 4000 });
    const strong = (id: string) => makeMonster(id, 50);
    s.world = refreshBook({
      ...s.world,
      team: ['digibud-3', 'plusplash-3', 'factorch-3', 'divvy-3', 'fractopus-3', 'pebblepoint-3'].map(strong),
      bag: { potion: 20, ball: 20, 'great-ball': 5 },
    });
    let prev: Stored | null = { world: structuredClone(s.world), at: s.clock.now() };
    s.seq = 0;
    let badges = 0;
    for (const area of AREAS) {
      s.world = { ...s.world, badges: BADGE_ORDER.slice(0, area.area - 1) as string[] };
      s.goto(area.map, 'entrance');
      const tower = Object.values(s.maps).flatMap((m) => m.things).find((t) => t.kind === 'trainer' && t.badge === area.badge)!;
      for (let i = 0; i < 3; i++) s.wild();
      s.goto(area.towerTop, 'trainer-approach');
      const report = s.trainer(tower.id);
      expect(report.outcome).toBe('won');
      s.world = { ...s.world, heal: { ...s.world.heal } };
      const item = s.save();
      // The test hands over earlier badges for free, so give the check a matching "before".
      const before = { world: { ...prev!.world, badges: BADGE_ORDER.slice(0, area.area - 1) as string[], map: s.world.map, x: s.world.x, y: s.world.y }, at: prev!.at };
      delete item.start;
      const saved = ok(checkSave(before, item, s.clock.now()));
      expect(saved.summary.newBadges).toEqual([area.badge]);
      expect(saved.summary.trainerWins).toBe(1);
      badges += 1;
      prev = stored(item);
    }
    expect(badges).toBe(6);
  });
});

const refused = (c: Checked, problem: string) => {
  expect(c.ok).toBe(false);
  if (!c.ok) expect(c.problem).toBe(problem);
};

describe('a save the rules cannot have produced is refused', () => {

  it('a look that is not one of the 24 (a missing one is fine: games from before there were looks)', () => {
    const { s, prev } = started();
    const item = s.save();
    for (const look of ['dragon-01', '', 'BOY-01', 3]) {
      refused(checkSave(prev, { ...item, world: { ...item.world, look: look as string } }, s.clock.now()), 'look');
    }
    expect(item.world.look).toBeUndefined();
    ok(checkSave(prev, item, s.clock.now()));
    ok(checkSave(prev, { ...item, world: { ...item.world, look: 'girl-12' } }, s.clock.now()));
    // A new game can start with a look, and it can change later.
    const fresh = new Session();
    const first = fresh.save();
    first.world.look = 'boy-03';
    ok(checkSave(null, first, fresh.clock.now()));
    const later = fresh.save();
    ok(checkSave(stored(first), { ...later, world: { ...later.world, look: 'girl-07' } }, fresh.clock.now()));
  });

  it('a team of 7, or none', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.team = [...item.world.team, ...Array(5).fill(item.world.team[0])];
    refused(checkSave(prev, item, s.clock.now()), 'team');
    const none = s.save();
    none.world.team = [];
    refused(checkSave(prev, none, s.clock.now()), 'team');
  });

  it('a level that jumps (exp invented), with and without exp that fits the level', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.team[0] = { ...item.world.team[0], level: 30, exp: 100 };
    refused(checkSave(prev, item, s.clock.now()), 'team');
    const fits = s.save();
    fits.world.team[0] = { ...fits.world.team[0], level: 30, exp: Math.round(30 ** 2.5), hp: 10 };
    refused(checkSave(prev, fits, s.clock.now()), 'pool-mismatch');
  });

  it('a level that matches its exp but was never earned', () => {
    const { s, prev } = started();
    const item = s.save();
    // exp for level 20 is real exp, but no battle gave it.
    item.world.team[0] = { ...item.world.team[0], level: 6, exp: Math.round(6 ** 2.5) };
    refused(checkSave(prev, item, s.clock.now()), 'pool-mismatch');
  });

  it('a new monster that no battle caught', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.box = [{ species: 'digibud-1', level: 5, exp: Math.round(5 ** 2.5), hp: 30 }];
    refused(checkSave(prev, item, s.clock.now()), 'owned');
  });

  it('a monster missing from the pool', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.team = item.world.team.slice(0, 1);
    refused(checkSave(prev, item, s.clock.now()), 'pool-mismatch');
  });

  it('a catch with no maths question, and an answer that is not what was marked', () => {
    const { s, prev } = started();
    // Play wild battles until one catches (or give up) so the report has a catch step.
    let report;
    for (let i = 0; i < 200 && !report; i++) {
      const r = s.wild();
      if (r.outcome === 'caught') report = r;
    }
    expect(report).toBeTruthy();
    const good = s.save();
    ok(checkSave(prev, good, s.clock.now()));

    const noQuestion = structuredClone(good);
    const battle = noQuestion.battles.find((b) => b.outcome === 'caught')!;
    delete battle.steps[battle.steps.length - 1].q;
    refused(checkSave(prev, noQuestion, s.clock.now()), 'battle-answer');

    // A wrong typed answer reported as a right one.
    const lied = structuredClone(good);
    const step = lied.battles.find((b) => b.outcome === 'caught')!.steps.find((st) => st.action.kind === 'catch')!;
    step.q!.given = step.q!.given + 7;
    step.action = { ...step.action, answer: 'right' } as typeof step.action;
    refused(checkSave(prev, lied, s.clock.now()), 'battle-answer');
  });

  it('a wild battle with no power-up question, or a power up or question-less attack where they do not belong', () => {
    const { s, prev } = started();
    for (let i = 0; i < 3; i++) s.wild();
    const good = s.save();
    ok(checkSave(prev, good, s.clock.now()));
    const fights = (b: BattleReport) => b.steps.filter((st) => st.action.kind === 'fight');
    const powered = good.battles.find((b) => b.steps.some((st) => st.action.kind === 'power-up'))!;
    expect(powered).toBeTruthy();
    expect(fights(powered).every((st) => st.q === undefined && !('answer' in st.action))).toBe(true);

    // The power-up's question taken away.
    const noQuestion = structuredClone(good);
    delete noQuestion.battles.find((b) => b.id === powered.id)!.steps.find((st) => st.action.kind === 'power-up')!.q;
    refused(checkSave(prev, noQuestion, s.clock.now()), 'battle-answer');

    // The power up left out: the attacks then have nothing behind them.
    const skipped = structuredClone(good);
    const b = skipped.battles.find((x) => x.id === powered.id)!;
    b.steps = b.steps.filter((st) => st.action.kind !== 'power-up');
    refused(checkSave(prev, skipped, s.clock.now()), 'battle-replay');

    // A giant asks for every attack, like a trainer.
    const giant = structuredClone(good);
    giant.battles.find((x) => x.id === powered.id)!.giant = 'anything';
    expect(checkSave(prev, giant, s.clock.now()).ok).toBe(false);
  });

  it('a wild battle from an older page, with a question for every attack, is still accepted', () => {
    const { s, prev } = started();
    s.oldStyle = true;
    for (let i = 0; i < 3; i++) s.wild();
    const item = s.save();
    expect(item.battles.every((b) => !b.steps.some((st) => st.action.kind === 'power-up'))).toBe(true);
    ok(checkSave(prev, item, s.clock.now()));
  });

  it('a question made up (numbers that the family cannot make), or too easy for the area', () => {
    const { s, prev } = started();
    s.wild();
    const item = s.save();
    const bad = structuredClone(item);
    const q = bad.battles[0].steps.find((st) => st.q)!.q!;
    q.band = q.band + 1;
    refused(checkSave(prev, bad, s.clock.now()), 'question-band');
    const bad2 = structuredClone(item);
    bad2.battles[0].steps.find((st) => st.q)!.q!.key = 'nonsense:key';
    expect(checkSave(prev, bad2, s.clock.now()).ok).toBe(false);
  });

  it('a different random number from the one the rules drew (damage cannot be chosen)', () => {
    const { s, prev } = started();
    s.wild();
    const item = s.save();
    // The first step that drew numbers (a power up draws none).
    const at = item.battles[0].steps.findIndex((st) => st.randoms.length > 0);
    const bad = structuredClone(item);
    bad.battles[0].steps[at].randoms = [];
    refused(checkSave(prev, bad, s.clock.now()), 'battle-random');
    const extra = structuredClone(item);
    extra.battles[0].steps[at].randoms.push(0.5);
    refused(checkSave(prev, extra, s.clock.now()), 'battle-random');
  });

  it('a won battle that the actions do not reach', () => {
    const { s, prev } = started();
    s.wild();
    const item = s.save();
    const bad = structuredClone(item);
    bad.battles[0].outcome = bad.battles[0].outcome === 'won' ? 'lost' : 'won';
    refused(checkSave(prev, bad, s.clock.now()), 'battle-outcome');
  });

  it('a wild monster this map never gives, or at a level it never gives', () => {
    const { s, prev } = started();
    s.wild();
    const item = s.save();
    const wrongMonster = structuredClone(item);
    wrongMonster.battles[0].setup.foes[0] = { species: 'goldilith-3', level: 40, exp: 40 ** 2.5, hp: 100 };
    refused(checkSave(prev, wrongMonster, s.clock.now()), 'battle-foe');
  });

  it('a badge with no won Tower battle', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.badges = ['leaf'];
    refused(checkSave(prev, item, s.clock.now()), 'badge');
  });

  it('a badge for a Tower you have not opened, or standing in an area you have not opened', () => {
    const { s, prev } = started();
    s.goto('fire-mountain', 'entrance');
    const item = s.save();
    refused(checkSave(prev, item, s.clock.now()), 'area-locked');
    const skip = started();
    const jumped = skip.s.save();
    jumped.world.badges = ['fire'];
    refused(checkSave(skip.prev, jumped, skip.s.clock.now()), 'badge');
  });

  it('a chest opened twice, and items from nowhere', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.bag = { ...item.world.bag, potion: 50 };
    refused(checkSave(prev, item, s.clock.now()), 'bag');
    const chest = started();
    const withChest = chest.s.save();
    withChest.world.chests = ['no-such-chest'];
    refused(checkSave(chest.prev, withChest, chest.s.clock.now()), 'chests');
  });

  it('a chest that was already opened pays nothing a second time', () => {
    const { s, prev } = started();
    const chest = s.maps['kauri-bush'].things.find((t) => t.kind === 'chest')!;
    const loot = LOOT[chest.loot!];
    s.world = { ...s.world, chests: [chest.id], bag: addToBag(s.world.bag, loot) };
    s.goto('kauri-bush', 'entrance');
    const opened = s.save();
    const afterOpen = ok(checkSave(prev, opened, s.clock.now()));
    expect(afterOpen.summary.owned).toBeGreaterThan(0);
    // The same chest again, with the loot again: refused.
    const again = s.save();
    again.world.bag = addToBag(again.world.bag, loot);
    refused(checkSave(stored(opened), again, s.clock.now()), 'bag');
  });

  it('a trainer prize without the win', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.paid = ['kauri-bush:ranger-kiri'];
    refused(checkSave(prev, item, s.clock.now()), 'paid');
  });

  it('seen and owned that shrink, and badges that vanish', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.owned = [];
    refused(checkSave(prev, item, s.clock.now()), 'shrank');
    const seen = started();
    const noSeen = seen.s.save();
    noSeen.world.seen = [];
    refused(checkSave(seen.prev, noSeen, seen.s.clock.now()), 'shrank');
  });

  it('seen that has been padded with monsters, or that is not in order', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.seen = ['zzz-9', ...item.world.seen];
    refused(checkSave(prev, item, s.clock.now()), 'book');
  });

  it('answers faster than a person can give them', () => {
    const { s, prev } = started();
    s.oldStyle = true; // a question every attack: plenty of answers to squash
    for (let i = 0; i < 12; i++) s.wild();
    const item = s.save();
    // Squash every answer into a few seconds.
    const qs = item.battles.flatMap((b) => b.steps.flatMap((st) => (st.q ? [st.q] : [])));
    qs.forEach((q, i) => {
      q.ms = 300;
      q.at = item.at - 10_000 + i * 300;
    });
    expect(qs.length).toBeGreaterThan(LIMITS.answersPerMinute);
    refused(checkSave(prev, item, s.clock.now()), 'answer-pace');
    const single = structuredClone(item);
    single.battles[0].steps.find((st) => st.q)!.q!.ms = 20;
    refused(checkSave(prev, single, s.clock.now()), 'battle-answer');
  });

  it('far more steps than time allows, and more wild battles than steps allow', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.steps = 100_000;
    refused(checkSave(prev, item, s.clock.now()), 'speed');
    const farm = started();
    for (let i = 0; i < 10; i++) farm.s.wild();
    const f = farm.s.save();
    f.world.steps = farm.prev.world.steps + 30;
    f.at = farm.prev.at + 3_600_000;
    refused(checkSave(farm.prev, f, f.at + 1000), 'pace');
  });

  it('a save from the future, or older than the one before', () => {
    const { s, prev } = started();
    const item = s.save();
    refused(checkSave(prev, { ...item, at: s.clock.now() + 3_600_000 }, s.clock.now()), 'time');
    refused(checkSave(prev, { ...item, at: prev.at - 5 }, s.clock.now()), 'time');
  });

  it('a first save that does not say what the player started with', () => {
    const s = new Session();
    const item = s.save();
    delete item.start;
    refused(checkSave(null, item, s.clock.now()), 'start');
    const again = new Session();
    const a = again.save();
    refused(checkSave({ world: a.world, at: a.at }, a, again.clock.now()), 'start');
  });

  it('a monster that got in before the battle did (setup does not match what you held)', () => {
    const { s, prev } = started();
    s.wild();
    const item = s.save();
    const bad = structuredClone(item);
    bad.battles[0].setup.team[0] = { ...bad.battles[0].setup.team[0], level: 9, exp: Math.round(9 ** 2.5) };
    refused(checkSave(prev, bad, s.clock.now()), 'pool-mismatch');
  });

  it('a battle sent twice in one save', () => {
    const { s, prev } = started();
    s.wild();
    const item = s.save();
    item.battles = [item.battles[0], item.battles[0]];
    expect(checkSave(prev, item, s.clock.now()).ok).toBe(false);
  });

  it('a tile you cannot stand on, and a heal spot that is not next to a nurse', () => {
    const { s, prev } = started();
    const item = s.save();
    item.world.x = 0;
    item.world.y = 0;
    refused(checkSave(prev, item, s.clock.now()), 'tile');
    const heal = started();
    const h = heal.s.save();
    h.world.heal = { map: 'kauri-bush', x: 1, y: 1, facing: 'down' };
    refused(checkSave(heal.prev, h, heal.s.clock.now()), 'heal');
  });
});

describe('quests in a save (docs/MONSTERS-QUESTS-PLAN.md, Q.5)', () => {
  it('prizes count once, crafting is paid for, and eggs hatch only after their days and never once cold', () => {
    const { s, prev } = started();
    const now = s.clock.now();
    const today = '2026-10-20';
    const quest = (q: Partial<QuestSave>): QuestSave => ({ ...emptyQuestSave(), ...q });
    const save = (q: QuestSave, change: (w: WorldState) => WorldState = (w) => w) => {
      const item = s.save();
      item.world = change({ ...item.world, quest: q });
      return item;
    };
    // A puzzle's prize: once, and not a bit more.
    const solved = save(quest({ flags: ['solved:shell-stones'], bits: { water: 3 } }));
    ok(checkSave(prev, solved, now));
    refused(checkSave(prev, save(quest({ flags: ['solved:shell-stones'], bits: { water: 4 } })), now), 'quest-bits');
    refused(checkSave(stored(solved), save(quest({ flags: ['solved:shell-stones'], bits: { water: 6 } })), now), 'quest-bits');
    refused(checkSave(prev, save(quest({ flags: ['no-such-flag'] })), now), 'quest-flags');
    // Crafting: 3 bits make one ball, not two; a wake-up item needs its part and its bits.
    const ball = (n: number) => save(quest({ flags: ['solved:shell-stones'] }), (w) => ({ ...w, bag: addToBag(w.bag, { ball: n }) }));
    ok(checkSave(stored(solved), ball(1), now));
    refused(checkSave(stored(solved), ball(2), now), 'bag');
    refused(checkSave(stored(solved), save(quest({ flags: ['solved:shell-stones', 'made:warm-whistle'] })), now), 'made');
    // An egg: hatched (the monster in the box) only once the database has counted its days, and only while warm.
    const egg = findEgg('puzzle:lagoon-stones:water', 'water', 2, () => 0);
    const hasEgg: Stored = { ...stored(solved), world: { ...stored(solved).world, quest: quest({ flags: ['solved:lagoon-stones', `egg:${egg.id}`], eggs: [egg], lastDay: '2026-10-18' }) } };
    const hatchedSave = (lastDay = '2026-10-18') => save(quest({ flags: ['solved:lagoon-stones', `egg:${egg.id}`, 'hatched:water'], lastDay }), (w) => ({ ...w, box: [...w.box, { ...makeMonster(egg.species, 5), ...(egg.shiny ? { shiny: true as const } : {}) }] }));
    const hatchedWorld = hatchedSave();
    hatchedWorld.world = refreshBook(hatchedWorld.world);
    refused(checkSave({ ...hasEgg, playDays: 4 }, hatchedWorld, now), 'hatched');
    expect(ok(checkSave({ ...hasEgg, playDays: 5 }, hatchedWorld, now)).summary.hatched).toBe(1);
    const coldWorld = { ...hasEgg.world, quest: { ...hasEgg.world.quest!, lastDay: '2026-10-14' } };
    const hatchedCold = hatchedSave('2026-10-14');
    hatchedCold.world = refreshBook(hatchedCold.world);
    refused(checkSave({ ...hasEgg, world: coldWorld, playDays: 5 }, hatchedCold, now), 'hatched');
    const kept = save(quest({ flags: ['solved:lagoon-stones', `egg:${egg.id}`], eggs: [egg], lastDay: '2026-10-14' }));
    refused(checkSave({ ...hasEgg, world: coldWorld }, kept, now), 'egg-cold');
    // A new egg needs its puzzle solved, and a day the database has counted.
    refused(checkSave(stored(solved), save(quest({ flags: ['solved:shell-stones', `egg:${egg.id}`], eggs: [egg] })), now), 'egg-source');
    refused(checkSave({ ...stored(solved), playDays: 1 }, save(quest({ flags: ['solved:shell-stones', 'solved:lagoon-stones', `egg:${egg.id}`], eggs: [egg] })), now), 'egg-day');
    expect(today).toBe(new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date(now)));
  });
  it('seed pods and egg nests, with the real map thing ids (they have a colon in them: "kauri-bush:Seed pod 1")', () => {
    const { s, prev } = started();
    const now = s.clock.now();
    const save = (q: Partial<QuestSave>) => {
      const item = s.save();
      item.world = { ...item.world, quest: { ...emptyQuestSave(), ...q } };
      return item;
    };
    // The flags the game really sets when a pod bush is searched (searchPod).
    const pods = WORLD_MAPS['kauri-bush'].things.filter((t) => t.kind === 'puzzle' && t.puzzle === 'kauri-seeds').map((t) => podFlag('kauri-seeds', t.id));
    expect(pods).toHaveLength(3);
    expect(pods[0]).toMatch(/^pod:kauri-seeds:kauri-bush:/);
    ok(checkSave(prev, save({ flags: [pods[0]] }), now));
    ok(checkSave(prev, save({ flags: [...pods, 'solved:kauri-seeds'], bits: { leaf: 3 } }), now));
    refused(checkSave(prev, save({ flags: ['pod:kauri-seeds:kauri-bush:No such bush'] }), now), 'quest-flags');
    refused(checkSave(prev, save({ flags: ['pod:kauri-seeds'] }), now), 'quest-flags');
    // A nest: the flag and the egg the game really make (searchNest), on a day the database has counted.
    const nest = Object.values(WORLD_MAPS).flatMap((m) => m.things).find((t) => t.kind === 'nest')!;
    const week = weekOf(new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date(now)));
    const egg = findEgg(`nest:${nest.id}:${week}:${nest.egg}`, nest.egg!, 1, () => 0);
    ok(checkSave({ ...prev, playDays: 1 }, save({ flags: [`nest:${nest.id}:${week}`, `egg:${egg.id}`], eggs: [egg] }), now));
    refused(checkSave(prev, save({ flags: [`nest:${nest.id}:x`] }), now), 'quest-flags');
  });
});
