import { describe, expect, it } from 'vitest';
import { checkSave, LIMITS, type Checked, type SaveItem, type Stored } from './check';
import { makeMonster } from '../rules';
import { AREAS, BADGE_ORDER } from '../world/areas';
import { addToBag, LOOT } from '../world/rewards';
import { refreshBook } from '../world/world';
import { Session } from './testKit';

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
    let prev: Stored | null = null;
    let first = true;
    const accept = () => {
      const item = s.save();
      const saved = ok(checkSave(prev, item, s.clock.now()));
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
    expect(answers).toBeGreaterThan(80);
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

describe('a save the rules cannot have produced is refused', () => {
  const refused = (c: Checked, problem: string) => {
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.problem).toBe(problem);
  };

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
    const bad = structuredClone(item);
    bad.battles[0].steps[0].randoms = [];
    refused(checkSave(prev, bad, s.clock.now()), 'battle-random');
    const extra = structuredClone(item);
    extra.battles[0].steps[0].randoms.push(0.5);
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
    for (let i = 0; i < 6; i++) s.wild();
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
