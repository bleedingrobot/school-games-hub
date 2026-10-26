import { describe, expect, it } from 'vitest';
import { checkSave, LIMITS, type Checked, type SaveItem, type Stored } from './check';
import { makeMonster } from '../rules';
import { AREAS, BADGE_ORDER } from '../world/areas';
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
  it('invented exp, a monster no battle caught, a chosen random number, a flipped outcome, a free badge, answers too fast', () => {
    const refused = (c: Checked, problem: string) => {
      expect(c.ok).toBe(false);
      if (!c.ok) expect(c.problem).toBe(problem);
    };
    const { s, prev } = started();
    for (let i = 0; i < 6; i++) s.wild();
    const item = s.save();
    ok(checkSave(prev, item, s.clock.now()));
    const now = s.clock.now();

    const levelled = structuredClone(item);
    levelled.world.team[0] = { ...levelled.world.team[0], level: 30, exp: Math.round(30 ** 2.5), hp: 10 };
    refused(checkSave(prev, levelled, now), 'pool-mismatch');

    const boxed = structuredClone(item);
    boxed.world.box = [...boxed.world.box, { species: 'digibud-1', level: 5, exp: Math.round(5 ** 2.5), hp: 30 }];
    expect(checkSave(prev, boxed, now).ok).toBe(false);

    const random = structuredClone(item);
    random.battles[0].steps[0].randoms = [];
    refused(checkSave(prev, random, now), 'battle-random');

    const flipped = structuredClone(item);
    flipped.battles[0].outcome = flipped.battles[0].outcome === 'won' ? 'lost' : 'won';
    refused(checkSave(prev, flipped, now), 'battle-outcome');

    const badge = structuredClone(item);
    badge.world.badges = ['leaf'];
    refused(checkSave(prev, badge, now), 'badge');

    const fast = structuredClone(item);
    const qs = fast.battles.flatMap((b) => b.steps.flatMap((st) => (st.q ? [st.q] : [])));
    qs.forEach((q, i) => {
      q.ms = 300;
      q.at = fast.at - 10_000 + i * 300;
    });
    expect(qs.length).toBeGreaterThan(LIMITS.answersPerMinute);
    refused(checkSave(prev, fast, now), 'answer-pace');
  });
});
