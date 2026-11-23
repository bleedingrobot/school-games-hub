// Class Showdown's rules (docs/SHOWDOWN-PLAN.md): scoring and pace, the seeded big events, teams, and the recap shout-outs.
// Rounds are plain JSON, so tests set up a round by hand (empty schedule, a fixed boss) and move time with advance().
import { describe, expect, it } from 'vitest';
import { recap } from './awards';
import { advance, answer, behind, chooseRole, enrage, goldenNext, join, moveToTeam, newRound, start } from './engine';
import { chooseSeam, GOLDRUSH, openSeamsOf } from './goldrush';
import { makeSchedule } from './schedule';
import { playRound } from './sim';
import { SKYCLIMB } from './skyclimb';
import { ISLAND, shoreAt } from './island';
import { HILL } from './hill';
import { balanceTeams } from './teams';
import type { Mode, Round, ShowdownEvent } from './types';

const ids = (n: number, ladder = (i: number) => i) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ladder: ladder(i) }));
function live(mode: Mode, n: number, opts: { bossHealth?: number; lengthMin?: number; seed?: number; quiet?: boolean; ladder?: (i: number) => number } = {}): Round {
  const r = newRound({ seed: opts.seed ?? 7, mode, lengthMin: opts.lengthMin ?? 10, bossHealth: opts.bossHealth ?? 100000 });
  for (const p of ids(n, opts.ladder)) join(r, p);
  start(r);
  if (opts.quiet !== false) r.schedule = [];
  return r;
}
const hit = (evs: ShowdownEvent[]) => evs.find((e): e is Extract<ShowdownEvent, { type: 'hit' }> => e.type === 'hit')!;
const of = <T extends ShowdownEvent['type']>(evs: ShowdownEvent[], type: T) => evs.filter((e): e is Extract<ShowdownEvent, { type: T }> => e.type === type);

describe('Class Showdown rules', () => {
  it('scoring: same hit for everyone, 4-second pace, capped streaks, roles', () => {
    const r = newRound({ seed: 11, mode: 'class', lengthMin: 10, bossHealth: 100000 });
    for (const p of [{ id: 'low', name: 'Low', ladder: 1 }, { id: 'high', name: 'High', ladder: 99 }, { id: 'g', name: 'G', ladder: 5 }]) join(r, p);
    start(r);
    expect(r.schedule[0].at).toBeGreaterThanOrEqual(40000);
    expect(chooseRole(r, 'g', 'guard', 0).ok).toBe(true);

    // Right answers 4 s apart: 10, 10, 15 (3 in a row), 15, 20 (5 in a row), 20 (capped).
    const points: Record<string, number[]> = { low: [], high: [] };
    for (let k = 0; k < 6; k++) {
      for (const id of ['low', 'high']) {
        if (k > 0 && id === 'low') expect(answer(r, id, true, k * 4000 - 1)).toMatchObject({ ok: false, reason: 'too_soon' });
        const out = answer(r, id, true, k * 4000);
        expect(out.ok).toBe(true);
        points[id].push(hit(out.events).points);
      }
    }
    expect(points.low).toEqual([10, 10, 15, 15, 20, 20]);
    expect(points.high).toEqual(points.low);
    expect(r.players.low.score).toBe(r.players.high.score);
    expect(r.players.low.bestStreak).toBe(6);

    // A wrong answer: no points, streak back to 0, and the next answer waits 4 s + 2 s.
    const scoreBefore = r.players.low.score;
    const wrong = answer(r, 'low', false, 24000);
    expect(wrong.ok).toBe(true);
    expect(of(wrong.events, 'wrong')[0].waitUntil).toBe(30000);
    expect(r.players.low.score).toBe(scoreBefore);
    expect(r.players.low.streak).toBe(0);
    expect(answer(r, 'low', true, 29999)).toMatchObject({ ok: false, reason: 'too_soon' });
    const after = answer(r, 'low', true, 30000);
    expect(hit(after.events)).toMatchObject({ points: 10, streak: 1, times: 1, t: 30000, pupil: 'low', damage: 1, role: 'striker', weakSpot: false, golden: false });
    expect(30000).toBeLessThan(r.schedule[0].at);

    // Damage: Striker 1, Guard 0.5 (the same hit points).
    expect(hit(answer(r, 'g', true, 31000).events)).toMatchObject({ damage: 0.5, points: 10, role: 'guard' });
    expect(hit(answer(r, 'g', true, 35000).events).damage).toBe(0.5);
    expect(r.players.high.damage).toBe(1 + 1 + 1.5 + 1.5 + 2 + 2);
    // Roles can't be swapped once the first seconds are over.
    expect(chooseRole(r, 'high', 'guard', 36000)).toMatchObject({ ok: false, reason: 'not_now' });
    expect(answer(r, 'nobody', true, 37000)).toMatchObject({ ok: false, reason: 'not_playing' });

    // Solo has no roles.
    const solo = newRound({ seed: 1, mode: 'solo', bossHealth: 100 });
    join(solo, { id: 'a', name: 'A', ladder: 1 });
    expect(chooseRole(solo, 'a', 'guard')).toMatchObject({ ok: false, reason: 'not_now' });
    start(solo);
    expect(chooseRole(solo, 'a', 'healer', 0)).toMatchObject({ ok: false, reason: 'not_now' });
  });

  it('big events from the seed: schedule, wind-up shield, daze, healer, weak spot, golden, phases, final, enrage', () => {
    // The schedule is the same for the same seed and always keeps its shape.
    for (const len of [5, 10, 15]) {
      for (let seed = 1; seed <= 50; seed++) {
        const s = makeSchedule(seed, len);
        expect(makeSchedule(seed, len)).toEqual(s);
        expect(s.length).toBeGreaterThan(0);
        expect(s[0].at).toBeGreaterThanOrEqual(40000);
        expect(s[0].at).toBeLessThanOrEqual(60000);
        for (let i = 1; i < s.length; i++) {
          expect(s[i].at - s[i - 1].at).toBeGreaterThanOrEqual(60000);
          expect(s[i].at - s[i - 1].at).toBeLessThanOrEqual(90000);
        }
        expect(s[s.length - 1].at).toBeLessThanOrEqual(len * 60000 - 40000 - 20000);
        expect(s.filter((e) => e.kind === 'golden')).toHaveLength(1);
        // Never three wind-ups or three weak spots in a row, the golden question aside.
        const k = s.filter((e) => e.kind !== 'golden').map((e) => e.kind);
        for (let i = 2; i < k.length; i++) expect(k[i] === k[i - 1] && k[i] === k[i - 2], `seed ${seed} len ${len}`).toBe(false);
      }
    }
    expect(makeSchedule(1, 10)).not.toEqual(makeSchedule(2, 10));

    // A scheduled wind-up: 5 pupils need 10 right answers in 15 s (2 per pupil); only 2 pupils answer, so the shield breaks.
    const a = live('class', 5, { bossHealth: 1000, quiet: false });
    const wu = a.schedule.find((e) => e.kind === 'wind_up')!;
    for (const p of ids(5)) answer(a, p.id, true, wu.at - 20000);
    expect(a.schedule.filter((e) => e.at < wu.at).every((e) => e.kind === 'golden')).toBe(true);
    a.boss.hp = 800;
    const started = advance(a, wu.at);
    expect(of(started, 'wind_up')[0]).toMatchObject({ endsAt: wu.at + 15000, enraged: false, groups: [{ group: 'all', needed: 10 }] });
    for (const k of [1000, 5000, 9000, 13000]) for (const id of ['p1', 'p2']) expect(answer(a, id, true, wu.at + k).ok).toBe(true);
    const hpBefore = a.boss.hp;
    const broke = advance(a, wu.at + 15000);
    const b = of(broke, 'shield_broke')[0];
    expect(b.dazedUntil - b.t).toBe(5000);
    expect(b.dazed).toHaveLength(5);
    expect(of(broke, 'boss_heals')[0]).toMatchObject({ amount: 100, hp: hpBefore + 100 });
    expect(a.players.p3.dazedUntil - a.t).toBe(5000);
    expect(answer(a, 'p3', true, wu.at + 16000)).toMatchObject({ ok: false, reason: 'dazed' });
    expect(answer(a, 'p3', true, wu.at + 20000).ok).toBe(true);

    // Held shield: every right answer counts (a Guard's twice), so Guard + Striker + one more reach 10 inside the 10 s enrage wind-up.
    const c = live('class', 5);
    chooseRole(c, 'p1', 'guard', 0);
    const e1 = enrage(c, 20000);
    expect(e1.ok).toBe(true);
    expect(of(e1.events, 'wind_up')[0]).toMatchObject({ enraged: true, endsAt: 30000, groups: [{ group: 'all', needed: 10 }] });
    expect(of(answer(c, 'p1', true, 20000).events, 'shield_progress')[0]).toMatchObject({ got: 2, needed: 10 });
    for (const t of [20000, 24000, 28000]) {
      if (t > 20000) answer(c, 'p1', true, t);
      expect(of(answer(c, 'p2', true, t).events, 'shield_held')).toHaveLength(0);
    }
    expect(c.windUp!.groups.all.got).toBe(9);
    const held = answer(c, 'p3', true, 28000);
    expect(of(held.events, 'shield_held')[0]).toMatchObject({ group: 'all', guards: ['p1'] });
    expect(c.windUp).toBeNull();
    expect(c.players.p1.shields).toBe(1);
    expect(of(advance(c, 40000), 'shield_broke')).toHaveLength(0);
    // The enrage weak spot (15 s from 28000) doubles points and damage, then ends.
    expect(c.weakSpotUntil).toBe(43000);
    expect(hit(answer(c, 'p4', true, 33000).events)).toMatchObject({ points: 20, damage: 2, times: 2, weakSpot: true });
    expect(hit(answer(c, 'p4', true, 44000).events)).toMatchObject({ points: 10, damage: 1, weakSpot: false });
    // A second enrage within a minute is refused; after a minute it works; none in the final 30 s.
    expect(enrage(c, 79999)).toMatchObject({ ok: false, reason: 'cooldown' });
    expect(enrage(c, 80000).ok).toBe(true);
    expect(enrage(live('class', 3, { lengthMin: 5 }), 270000)).toMatchObject({ ok: false, reason: 'not_now' });

    // Healer: a broken shield dazes everyone but Healers; the Healer's right answer wakes a classmate at once (no damage).
    const d = live('class', 4);
    chooseRole(d, 'p4', 'healer', 0);
    enrage(d, 20000);
    const dz = of(advance(d, 30000), 'shield_broke')[0];
    expect(dz.dazed).toEqual(['p1', 'p2', 'p3']);
    expect(d.players.p1.dazedUntil).toBe(35000);
    expect(d.players.p4.dazedUntil).toBe(0);
    expect(answer(d, 'p1', true, 31000)).toMatchObject({ ok: false, reason: 'dazed' });
    const woke = answer(d, 'p4', true, 31000);
    expect(of(woke.events, 'revive')[0]).toMatchObject({ pupil: 'p4', woke: 'p1' });
    expect(hit(woke.events).damage).toBe(0);
    expect(answer(d, 'p1', true, 31000).ok).toBe(true);
    expect(answer(d, 'p2', true, 31000)).toMatchObject({ ok: false, reason: 'dazed' });

    // Golden window: every pupil's next question is golden, 3 hits, once each.
    const g = live('class', 2);
    g.schedule = [{ at: 45000, kind: 'golden' }];
    expect(goldenNext(g, 'p1', 45000)).toBe(false);
    advance(g, 45000);
    expect(goldenNext(g, 'p1', 45000)).toBe(true);
    expect(goldenNext(g, 'p1', 65000)).toBe(false);
    expect(hit(answer(g, 'p1', true, 45000, { golden: true }).events)).toMatchObject({ points: 30, times: 3, golden: true, damage: 3 });
    expect(goldenNext(g, 'p1', 49000)).toBe(false);
    expect(goldenNext(g, 'p2', 49000)).toBe(true);
    expect(hit(answer(g, 'p1', true, 49000, { golden: true }).events)).toMatchObject({ points: 10, golden: false });
    expect(g.players.p1.goldenRightAt).toBe(45000);

    // Phases at 66% and 33% of health, then beaten at 0 with the last hit named.
    const ph = live('class', 10, { bossHealth: 100 });
    const all: ShowdownEvent[] = [];
    let lastId = '';
    for (let k = 0; k < 8 && ph.state === 'live'; k++) {
      for (const p of ids(10)) {
        if (ph.state !== 'live') break;
        const out = answer(ph, p.id, true, k * 4000);
        all.push(...out.events);
        lastId = p.id;
        for (const e of of(out.events, 'phase')) expect(ph.boss.hp / ph.boss.max).toBeLessThanOrEqual(e.phase === 2 ? 0.66 : 0.33);
      }
    }
    expect(of(all, 'phase').map((e) => e.phase)).toEqual([2, 3]);
    expect(of(all, 'phase')[0].roleSwapUntil).toBe(of(all, 'phase')[0].t + 15000);
    expect(of(all, 'boss_beaten')).toHaveLength(1);
    expect(all[all.length - 1].type === 'boss_beaten' || all[all.length - 2].type === 'boss_beaten').toBe(true);
    expect(ph).toMatchObject({ state: 'over', result: 'beaten', lastHit: lastId });
    expect(ph.boss.hp).toBe(0);
    expect(answer(ph, 'p1', true, 99999)).toMatchObject({ ok: false, reason: 'not_live' });

    // The final 30 seconds start at length - 30 s; time up ends it.
    const f = live('class', 2, { lengthMin: 5 });
    expect(of(advance(f, 269999), 'final')).toHaveLength(0);
    expect(of(advance(f, 270000), 'final')[0]).toMatchObject({ t: 270000, endsAt: 300000 });
    expect(of(advance(f, 300000), 'time_up')).toHaveLength(1);
    expect(f).toMatchObject({ state: 'over', result: 'time' });
  });

  it('teams: balanced by ladder, late joiners, tug of war, boss chases the leader, catch-up', () => {
    const eight = ids(8);
    const two = balanceTeams(eight, ['red', 'blue'], 1);
    const sums = { red: 0, blue: 0 };
    const sizes = { red: 0, blue: 0 };
    for (const p of eight) { sums[two[p.id] as 'red' | 'blue'] += p.ladder; sizes[two[p.id] as 'red' | 'blue']++; }
    expect(sizes).toEqual({ red: 4, blue: 4 });
    expect(Math.abs(sums.red - sums.blue)).toBeLessThanOrEqual(2);
    const four = balanceTeams(eight, ['red', 'blue', 'gold', 'green'], 1);
    for (const t of ['red', 'blue', 'gold', 'green']) expect(Object.values(four).filter((x) => x === t)).toHaveLength(2);
    const tied = eight.map((p) => ({ ...p, ladder: 5 }));
    const variants = new Set(Array.from({ length: 12 }, (_, s) => JSON.stringify(balanceTeams(tied, ['red', 'blue'], s))));
    expect(variants.size).toBeGreaterThan(1);

    // A teams2 lobby mixes itself as pupils join, until the teacher moves someone.
    const lobby = newRound({ seed: 3, mode: 'teams2', lengthMin: 10 });
    for (const p of ids(4, (i) => i * 10)) join(lobby, p);
    const count = (r: Round, t: string) => r.order.filter((k) => r.players[k].team === t).length;
    expect([count(lobby, 'red'), count(lobby, 'blue')]).toEqual([2, 2]);
    expect(moveToTeam(lobby, 'p1', 'gold')).toMatchObject({ ok: false, reason: 'no_such_team' });
    const was = lobby.players.p1.team;
    expect(moveToTeam(lobby, 'p1', was === 'red' ? 'blue' : 'red').ok).toBe(true);
    expect(lobby.teamsByHand).toBe(true);
    const before = Object.fromEntries(lobby.order.map((k) => [k, lobby.players[k].team]));
    join(lobby, { id: 'p5', name: 'P5', ladder: 1 });
    for (const k of Object.keys(before)) expect(lobby.players[k].team).toBe(before[k]);
    expect(lobby.players.p5.team).toBe(count(lobby, 'red') - (lobby.players.p5.team === 'red' ? 1 : 0) < count(lobby, 'blue') - (lobby.players.p5.team === 'blue' ? 1 : 0) ? 'red' : 'blue');

    // Late joiners (live) go to the smallest team and make the boss bigger.
    const lj = newRound({ seed: 5, mode: 'teams2', lengthMin: 10 });
    for (const p of ids(5)) join(lj, p);
    start(lj);
    const small = (['red', 'blue'] as const).find((t) => count(lj, t) === 2)!;
    const max0 = lj.boss.max;
    const late = join(lj, { id: 'late', name: 'Late', ladder: 0 }, 30000);
    expect(lj.players.late.team).toBe(small);
    expect(of(late.events, 'boss_grows')[0].bossMax).toBeGreaterThan(max0);
    expect(lj.boss.hp).toBe(lj.boss.max);
    expect(count(lj, 'red')).toBe(count(lj, 'blue'));

    // Tug of war: red hitting more pushes the boss towards blue's side (tug > 0, 'tug' events leading 'red'); blue then takes over.
    const tw = live('teams2', 4);
    const red = tw.order.find((k) => tw.players[k].team === 'red')!;
    const blue = tw.order.find((k) => tw.players[k].team === 'blue')!;
    const tugs: ShowdownEvent[] = [];
    for (const t of [0, 4000]) tugs.push(...answer(tw, red, true, t).events);
    expect(tw.tug).toBeGreaterThan(0);
    expect(of(tugs, 'tug')[0]).toMatchObject({ leading: 'red', position: 0.1 });
    expect(behind(tw, blue)).toBe(true);
    expect(behind(tw, red)).toBe(false);
    for (const t of [8000, 12000, 16000, 20000, 24000, 28000]) tugs.push(...answer(tw, blue, true, t).events);
    expect(tw.tug).toBeLessThan(0);
    expect(of(tugs, 'tug').pop()!.leading).toBe('blue');

    // Four teams: the boss turns to a leader 20+ points ahead (not more than every 15 s), and a wind-up then goes only to that team.
    const f4 = live('teams4', 8);
    const [a, b] = [f4.order.find((k) => f4.players[k].team === 'red')!, f4.order.find((k) => f4.players[k].team === 'green')!];
    expect(of(answer(f4, a, true, 0).events, 'boss_turns')).toHaveLength(0);
    expect(of(answer(f4, a, true, 4000).events, 'boss_turns')[0]).toMatchObject({ team: 'red', t: 4000 });
    for (const t of [4000, 8000, 12000, 16000]) expect(of(answer(f4, b, true, t).events, 'boss_turns')).toHaveLength(0);
    expect(f4.teamPoints.green! - f4.teamPoints.red!).toBeGreaterThanOrEqual(20);
    expect(f4.facing).toBe('red');
    expect(of(answer(f4, b, true, 20000).events, 'boss_turns')[0]).toMatchObject({ team: 'green', t: 20000 });
    const wu = of(enrage(f4, 21000).events, 'wind_up')[0];
    expect(wu.groups).toEqual([{ group: 'green', needed: 4 }]);
    expect(Object.keys(f4.windUp!.groups)).toEqual(['green']);

    // Solo: the bottom quarter (of pupils who have answered) is behind.
    const solo = live('solo', 8);
    for (const id of ['p1', 'p2']) answer(solo, id, false, 0);
    for (const id of ['p3', 'p4', 'p5', 'p6', 'p7', 'p8']) answer(solo, id, true, 0);
    expect(['p1', 'p2'].map((k) => behind(solo, k))).toEqual([true, true]);
    expect(['p3', 'p5', 'p8'].map((k) => behind(solo, k))).toEqual([false, false, false]);
    expect(behind(solo, 'ghost')).toBe(false);
  });

  it('recap: 6 to 8 shout-outs to different pupils when possible', () => {
    const cases: [Mode, number][] = [['class', 1], ['teams2', 2], ['teams4', 3], ['solo', 4]];
    for (const [mode, seed] of cases) {
      const { round } = playRound({ seed, size: 30, lengthMin: 5, mode, bossHealth: 800 });
      const rc = recap(round);
      const who = rc.awards.map((x) => x.pupil);
      expect(rc.awards.length, mode).toBeGreaterThanOrEqual(6);
      expect(rc.awards.length, mode).toBeLessThanOrEqual(8);
      expect(new Set(who).size, mode).toBe(who.length);
      expect(new Set(rc.awards.map((x) => x.kind)).size, mode).toBe(who.length);
      expect(rc.result).toBe(round.result);
      if (mode === 'class') expect(rc.winner).toBeNull();
      else if (mode === 'solo') expect(rc.winner).toEqual({ pupil: rc.top[0].pupil });
      else expect(rc.winner).toEqual({ team: rc.teams[0].team });
      if (mode === 'solo') expect(rc.top).toHaveLength(10);
    }

    // A tiny class still gets shout-outs (repeats allowed), but no award twice.
    const small = recap(playRound({ seed: 9, size: 3, lengthMin: 5, mode: 'class', bossHealth: 200 }).round);
    expect(small.awards.length).toBeGreaterThanOrEqual(6);
    expect(small.awards.length).toBeLessThanOrEqual(8);
    expect(new Set(small.awards.map((x) => x.kind)).size).toBe(small.awards.length);
    expect(new Set(small.awards.map((x) => x.pupil)).size).toBeLessThanOrEqual(3);
  });
  it('gold rush: seams pay by how rich they are, a crowded seam splits, dry seams reopen, and it plays to about 80% won', () => {
    const r = newRound({ seed: 9, mode: 'solo', lengthMin: 10, bossHealth: 100000 });
    r.arena = 'goldrush';
    for (const p of ids(12)) join(r, p);
    start(r);
    r.schedule = [];
    expect(openSeamsOf(r)).toHaveLength(GOLDRUSH.open);
    const gold = openSeamsOf(r).find((x) => x.kind === 'gold')!;
    const rich = openSeamsOf(r).find((x) => x.kind === 'rich') ?? openSeamsOf(r).find((x) => x.kind === 'gem')!;
    // One pupil alone on each: the richer seam pays more.
    chooseSeam(r, 'p1', gold.id);
    chooseSeam(r, 'p2', rich.id);
    const a = hit(answer(r, 'p1', true, 1000).events);
    const b = hit(answer(r, 'p2', true, 1000).events);
    expect(b.damage).toBeGreaterThan(a.damage);
    expect(b.points).toBeGreaterThan(a.points);
    expect(a.seam).toBe(gold.id);
    // Everyone piles onto the rich seam: past its room, each dig there is worth less.
    for (let i = 3; i <= 12; i++) { chooseSeam(r, `p${i}`, rich.id); answer(r, `p${i}`, true, 1500); }
    expect(hit(answer(r, 'p2', true, 6000).events).damage).toBeLessThan(b.damage);
    // Dig a seam dry: it closes and a new one opens, and its diggers move on by themselves.
    const target = openSeamsOf(r).find((x) => x.id === gold.id)!;
    target.left = 1;
    const evs = answer(r, 'p1', true, 9000).events;
    expect(of(evs, 'seam_dry')[0].seam).toBe(gold.id);
    expect(of(evs, 'seam_new')).toHaveLength(1);
    expect(openSeamsOf(r)).toHaveLength(GOLDRUSH.open);
    expect(chooseSeam(r, 'p1', gold.id)).toBe(false);
    expect(hit(answer(r, 'p1', true, 14000).events).seam).not.toBe(gold.id);
    // Tuned with the simulator like the bosses: typical classes win most rounds but not all.
    const won = Array.from({ length: 24 }, (_, i) => playRound({ seed: 500 + i, size: 24, lengthMin: 10, mode: 'class', arena: 'goldrush' }).beaten).filter(Boolean).length;
    expect(won).toBeGreaterThanOrEqual(14);
    expect(won).toBeLessThanOrEqual(23);
  });
  it('sky climb: the summit is higher, every 3rd right answer in a row jumps, a storm blows idle climbers back, about 80% won', () => {
    const r = newRound({ seed: 9, mode: 'class', lengthMin: 10, bossHealth: 1000 });
    r.arena = 'skyclimb';
    for (const p of ids(4)) join(r, p);
    start(r);
    r.schedule = [{ at: 30000, kind: 'wind_up' }];
    expect(r.boss.max).toBe(Math.round(1000 * SKYCLIMB.summit.class));
    const steps = [0, 4000, 8000].map((t) => answer(r, 'p1', true, t).events);
    expect(of(steps[0], 'jump')).toHaveLength(0);
    expect(of(steps[2], 'jump')[0].pupil).toBe('p1');
    expect(hit(steps[2]).damage).toBeGreaterThan(hit(steps[1]).damage * 1.5);
    // p2 climbs, then stops answering; p1 keeps answering through the storm. When it passes, only p2 slips back down.
    answer(r, 'p2', true, 9000);
    for (let t = 12000; t < 30000; t += 4000) answer(r, 'p1', true, t);
    const before = r.players.p2.damage;
    const evs: ShowdownEvent[] = [];
    for (let t = 30000; t < 60000; t += 4000) evs.push(...answer(r, 'p1', true, t).events);
    evs.push(...advance(r, 60000));
    const blown = of(evs, 'blown_back')[0];
    expect(blown.pupils).toContain('p2');
    expect(blown.pupils).not.toContain('p1');
    expect(r.players.p2.damage).toBe(0);
    expect(blown.amount).toBeGreaterThanOrEqual(before);
    const won = Array.from({ length: 24 }, (_, i) => playRound({ seed: 500 + i, size: 24, lengthMin: 10, mode: 'class', arena: 'skyclimb' }).beaten).filter(Boolean).length;
    expect(won).toBeGreaterThanOrEqual(14);
    expect(won).toBeLessThanOrEqual(23);
  });
  it('shrinking island: answers step inwards, the water puts you on a rock at half pace until you swim back, a broken wave sweeps the beach, about 80% won', () => {
    const r = newRound({ seed: 9, mode: 'class', lengthMin: 10, bossHealth: 1000 });
    r.arena = 'island';
    for (const p of ids(4)) join(r, p);
    start(r);
    r.schedule = [];
    expect(r.boss.max).toBe(Math.round(1000 * ISLAND.raft.class));
    const p1 = r.players.p1;
    const d0 = p1.isle!.d;
    const full = hit(answer(r, 'p1', true, 1000).events).damage;
    expect(p1.isle!.d).toBeCloseTo(Math.max(ISLAND.middle, d0 - ISLAND.step));
    // The water reaches p2 (out on the edge): a rock, half planks, and 2 right answers swim back.
    r.players.p2.isle!.d = 0.99;
    const washed = of(advance(r, 300000), 'washed_up')[0];
    expect(washed.pupils).toContain('p2');
    expect(shoreAt(r)).toBeLessThan(0.99);
    const half = answer(r, 'p2', true, 300000).events;
    expect(hit(half).damage).toBeCloseTo(full * ISLAND.rockTimes);
    expect(of(answer(r, 'p2', true, 304000).events, 'swam_back')[0].pupil).toBe('p2');
    expect(r.players.p2.isle!.rock).toBe(false);
    expect(r.players.p2.isle!.d).toBeLessThan(shoreAt(r));
    // A broken shield's wave sweeps everyone on the beach back towards the water.
    r.players.p3.isle = { ...r.players.p3.isle!, rock: false, d: shoreAt(r) * 0.9 };
    r.players.p3.lastActive = 320000;
    r.schedule = [{ at: 310000, kind: 'wind_up' }];
    const evs = [...advance(r, 330000)];
    expect(of(evs, 'shield_broke')).toHaveLength(1);
    expect(of(evs, 'wave')[0].pupils).toContain('p3');
    expect(r.players.p3.isle!.rock).toBe(true);
    const won = Array.from({ length: 24 }, (_, i) => playRound({ seed: 500 + i, size: 24, lengthMin: 10, mode: 'class', arena: 'island' }).beaten).filter(Boolean).length;
    expect(won).toBeGreaterThanOrEqual(14);
    expect(won).toBeLessThanOrEqual(23);
  });
  it('king of the hill: the crown goes to the most points in the last 30 seconds, pays its holder, swings, is knocked off by a broken charge, about 80% won', () => {
    const r = newRound({ seed: 9, mode: 'solo', lengthMin: 10, bossHealth: 100000 });
    r.arena = 'hill';
    for (const p of ids(3)) join(r, p);
    start(r);
    r.schedule = [];
    for (const t of [0, 4000]) answer(r, 'p1', true, t);
    expect(of(advance(r, HILL.everyMs), 'crown')[0]).toMatchObject({ holder: 'p1', from: null });
    const before = r.players.p1.score;
    expect(of(advance(r, HILL.everyMs * 2), 'crown_paid')[0]).toMatchObject({ holder: 'p1', points: HILL.crownPoints });
    expect(r.players.p1.score).toBe(before + HILL.crownPoints);
    // p2 has a burst while p1 stops: after p1's points fall out of the 30 seconds, p2 takes it.
    const evs: ShowdownEvent[] = [];
    for (let t = 12000; t <= 40000; t += 4000) evs.push(...answer(r, 'p2', true, t).events);
    const swing = of([...evs, ...advance(r, 45000)], 'crown');
    expect(swing[swing.length - 1]).toMatchObject({ holder: 'p2', from: 'p1' });
    // A charge nobody holds back knocks the crown off.
    r.schedule = [{ at: 50000, kind: 'wind_up' }];
    const knocked = of(advance(r, 80000), 'crown').find((e) => e.holder === null);
    expect(knocked?.from).toBe('p2');
    const won = Array.from({ length: 24 }, (_, i) => playRound({ seed: 500 + i, size: 24, lengthMin: 10, mode: 'class', arena: 'hill' }).beaten).filter(Boolean).length;
    expect(won).toBeGreaterThanOrEqual(14);
    expect(won).toBeLessThanOrEqual(23);
  });
});
