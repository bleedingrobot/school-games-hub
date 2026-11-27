// Goblin Storm's rules (docs/GOBLINSTORM-PLAN.md): the 3 rule tests the plan allows. Balance is the sim's job.
import { describe, expect, it } from 'vitest';
import { botRun } from './bot';
import { HEROES, MAPS, RUN_STEPS, SHOP_IDS, STEPS_PER_SECOND, STORM_FIRST, WEAPONS, healthGrowth, type ShopLevels } from './config';
import { applyPick, makeOffer, maxWeapons, newRun, stepRun, waiting, type RunSetup, type RunState } from './engine';
import { decodeSteering, encodeSteering, replayRun } from './replay';
import { freshSave, mapOpen } from './server';
import { shopTop } from './shop';
import { afterRun, bonusBetween, nextRound } from './rounds';
import { STILL } from './trig';

const knight: RunSetup = { seed: 12345, hero: HEROES[0], map: MAPS[0], shop: {} };

describe('Goblin Storm rules', () => {
  it('the same seed and steering give the same run, and steering survives being sent', () => {
    const a = botRun(knight, () => 3, 3600);
    const b = botRun(knight, () => 3, 3600);
    expect(b.state.hero).toEqual(a.state.hero);
    expect(b.state.kills).toBe(a.state.kills);
    expect(b.state.level).toBe(a.state.level);
    expect(a.state.kills).toBeGreaterThan(20);
    expect(a.state.levelUps).toBeGreaterThan(2);
    // A different seed is a different run.
    expect(botRun({ ...knight, seed: 999 }, () => 3, 3600).state.hero).not.toEqual(a.state.hero);
    expect(decodeSteering(encodeSteering(a.steering))).toEqual(a.steering);
    expect(decodeSteering('3x10,17x2')).toBeNull();
    expect(decodeSteering('3x0')).toBeNull();
    expect(decodeSteering(`4x${RUN_STEPS},4x1`)).toBeNull();
    // Monsters get tougher through a run, more so in the last minute and more again in the last 30 seconds.
    const at = (sec: number) => healthGrowth(sec * STEPS_PER_SECOND);
    expect(at(0)).toBe(1);
    expect(at(119.9)).toBeCloseTo(1 + 119.9 / 90);
    expect(at(120)).toBeCloseTo((1 + 120 / 90) * 1.5);
    expect(at(150)).toBeCloseTo((1 + 150 / 90) * 2);
  });

  it('a sent run replays exactly, a made-up one is refused, and a whole run replays quickly', () => {
    const live = botRun(knight);
    expect(live.state.outcome).not.toBe('running');
    const started = performance.now();
    const replay = replayRun({ setup: knight, steering: decodeSteering(encodeSteering(live.steering)) ?? [], picks: live.picks, choices: live.choices });
    const ms = performance.now() - started;
    expect(replay.valid).toBe(true);
    expect(replay.summary).toEqual(replayRun({ setup: knight, steering: live.steering, picks: live.picks, choices: live.choices }).summary);
    expect(replay.state.kills).toBe(live.state.kills);
    expect(replay.state.outcome).toBe(live.state.outcome);
    // The server has well under 2 s of CPU; a whole run must replay in a fraction of that. Under vitest the engine's
    // imports go through getters, so it runs about 3.5x slower than the bundled function (469 ms here vs 133 ms bundled
    // on the Mac, 19 Nov 2026), and CI shards are slower again. 4 s here is about 1 s on the server: this catches a
    // runaway (say, every monster checking every other), not a few percent.
    expect(ms).toBeLessThan(4000);
    // Extra steering after the run ended, a missing pick, or a card that wasn't offered can't have come from playing.
    expect(replayRun({ setup: knight, steering: [...live.steering, 0], picks: live.picks, choices: live.choices }).valid).toBe(live.state.outcome === 'running');
    expect(replayRun({ setup: knight, steering: live.steering, picks: live.picks.slice(1), choices: live.choices }).valid).toBe(false);
    expect(replayRun({ setup: knight, steering: live.steering, picks: [9, ...live.picks.slice(1)], choices: live.choices }).valid).toBe(false);
    // Stopping part way is a quit, not a win.
    const half = Math.floor(live.steering.length / 2);
    const quit = replayRun({ setup: knight, steering: live.steering.slice(0, half), picks: live.picks.slice(0, replayRun({ setup: knight, steering: live.steering.slice(0, half), picks: live.picks, choices: live.choices }).state.levelUps), choices: live.choices });
    expect(quit.summary.outcome).toBe('quit');
  });

  it('the Storm Lands: the gate, each twist, Legendary upgrades that work there and nowhere else, and round bonuses', () => {
    {
      // Round bonuses: every boss in a group again pays 10, 20, 30 … gold, the Kingdom and Storm Lands apart.
      let save = { beats: [] as number[], roundsPaid: {} };
      const win = (map: number, boss = true) => { const r = afterRun(save, map, boss); save = r; return r.bonus; };
      expect([0, 1, 2, 3].map((m) => win(m))).toEqual([0, 0, 0, 0]);
      expect(win(0)).toBe(0);
      expect(nextRound(save.beats, 'kingdom')).toMatchObject({ round: 1, gold: 10, toBeat: [4], done: 4 });
      expect(win(4)).toBe(10);
      expect(win(4, false)).toBe(0);
      expect(nextRound(save.beats, 'kingdom')).toMatchObject({ round: 2, gold: 20, toBeat: [1, 2, 3, 4] });
      expect([1, 2, 3].map((m) => win(m))).toEqual([0, 0, 0]);
      const before = save;
      expect(win(4)).toBe(20);
      expect(bonusBetween(before, save)).toBe(20);
      // The Storm Lands keep their own rounds.
      expect(win(STORM_FIRST)).toBe(0);
      // Rounds finished before bonuses began are all paid on the next run in that group.
      expect(afterRun({ beats: [5, 3, 4, 6, 3], roundsPaid: {} }, 0, false)).toMatchObject({ bonus: 60, roundsPaid: { kingdom: 3 } });
    }
    const map = (id: string) => MAPS.find((m) => m.id === id)!;
    const legend: ShopLevels = { fifth: 1, secondwind: 1, stormmight: 3, surge: 3, anchor: 2, lantern: 2 };
    // Legendary upgrades change nothing on the first five maps.
    const lava: RunSetup = { seed: 77, hero: HEROES[0], map: MAPS[STORM_FIRST - 1], shop: {} };
    expect(botRun({ ...lava, shop: legend }, () => 3, 2400).state.hero).toEqual(botRun(lava, () => 3, 2400).state.hero);
    expect(maxWeapons({ setup: { ...lava, shop: legend } })).toBe(4);
    expect(maxWeapons({ setup: { ...lava, map: map('sunken'), shop: legend } })).toBe(5);
    // The gate: the whole shop and the Fire Dragon, and only once the Storm Lands are on. Then one map at a time.
    const whole = Object.fromEntries(SHOP_IDS.map((id) => [id, shopTop(id)]));
    const five = { ...freshSave(), bosses: [0, 1, 2, 3, 4] };
    expect(mapOpen({ ...five, shop: whole }, STORM_FIRST, false)).toBe(false);
    expect(mapOpen(five, STORM_FIRST, true)).toBe(false);
    expect(mapOpen({ ...five, shop: { ...whole, might: 4 } }, STORM_FIRST, true)).toBe(false);
    expect(mapOpen({ ...five, bosses: [0, 1, 2, 3], shop: whole }, STORM_FIRST, true)).toBe(false);
    expect(mapOpen({ ...five, shop: whole }, STORM_FIRST, true)).toBe(true);
    expect(mapOpen({ ...five, shop: whole }, STORM_FIRST + 1, true)).toBe(false);
    expect(mapOpen({ ...five, bosses: [0, 1, 2, 3, 4, 5], shop: whole }, STORM_FIRST + 1, true)).toBe(true);

    const run = (id: string, shop: ShopLevels = {}) => newRun({ seed: 4242, hero: HEROES[0], map: map(id), shop });
    const still = (s: RunState, steps: number) => { for (let i = 0; i < steps && s.outcome === 'running' && !waiting(s); i++) stepRun(s, STILL); };
    /** Puts a monster of `kind` right next to the hero with `hp` health (blades reach it at once). */
    const place = (s: RunState, kind: number, hp: number) => {
      const e = s.enemies[s.enemies.length - 1];
      Object.assign(e, { alive: true, id: 99999, kind, x: s.hero.x + 1.8, y: s.hero.y, hp, maxHp: kind === 4 ? 1000 : hp, speed: 0, damage: 1, radius: 0.6, gems: 0, born: 0 });
      return e;
    };
    // Sunken Kingdom: the sea moves a hero who stands still; Anchor Boots move them less.
    const sea = run('sunken');
    const anchored = run('sunken', { anchor: 2 });
    still(sea, 60);
    still(anchored, 60);
    const moved = (s: RunState) => Math.sqrt(s.hero.x * s.hero.x + s.hero.y * s.hero.y);
    expect(moved(sea)).toBeGreaterThan(1);
    expect(moved(anchored)).toBeCloseTo(moved(sea) * 0.3, 5);
    // Sky Citadel: a ring appears under a hero standing still, and its lightning hurts them.
    const sky = run('sky');
    let struck = false;
    let hurt = false;
    for (let i = 0; i < 40 * 60 && !struck; i++) {
      if (waiting(sky)) applyPick(sky, makeOffer(sky, 3).length - 1);
      const hp = sky.hero.hp;
      stepRun(sky, STILL);
      struck = sky.events.some((e) => e.k === 'storm');
      hurt = struck && sky.hero.hp < hp;
    }
    expect(hurt).toBe(true);
    // Crystal Caverns: a tough monster breaks into two small ones where it fell.
    const caves = run('crystal');
    const tough = place(caves, 2, 0.5);
    for (let i = 0; i < 60 && tough.alive; i++) stepRun(caves, STILL);
    expect(caves.enemies.filter((e) => e.alive && e.kind === 0 && Math.abs(e.x - tough.x) < 1 && Math.abs(e.y - tough.y) < 1)).toHaveLength(2);
    // Storm King's Citadel: at half health the Storm King rages and calls a swarm.
    const keep = run('citadel');
    place(keep, 4, 501);
    for (let i = 0; i < 60 && !keep.storm.raging; i++) stepRun(keep, STILL);
    expect(keep.storm.raging).toBe(true);
    expect(keep.enemies.filter((e) => e.alive).length).toBeGreaterThan(30);
    // Second Wind gets a falling hero back up once, on the Storm Lands only.
    for (const [id, shop, up] of [['swamp', { secondwind: 1 }, true], ['swamp', {}, false], ['lava', { secondwind: 1 }, false]] as const) {
      const s = newRun({ seed: 5, hero: HEROES[0], map: map(id), shop });
      s.hero.hp = 1;
      const e = place(s, 0, 9999);
      Object.assign(e, { x: s.hero.x, damage: 50 });
      stepRun(s, STILL);
      expect(s.outcome).toBe(up ? 'running' : 'lost');
      if (up) expect(s.hero.hp).toBe(s.hero.maxHp / 2);
    }
  });

  it('answers decide how many cards show, and a full weapon with its partner offers an evolution first', () => {
    const s = newRun(knight);
    while (!waiting(s)) stepRun(s, 16);
    const two = makeOffer(s, 2);
    expect(two).toHaveLength(3); // the two the answer earned, then Gold
    expect(two[2]).toEqual({ kind: 'gold' });
    expect(makeOffer(s, 4)).toEqual(two); // the offer is fixed once shown
    expect(applyPick(s, 3)).toBe(false);
    expect(applyPick(s, 1)).toBe(true);
    // Same seed, same level-up: the same cards, whatever the answer gave.
    const t = newRun(knight);
    while (!waiting(t)) stepRun(t, 16);
    const four = makeOffer(t, 4);
    expect(four.slice(0, 2)).toEqual(two.slice(0, 2));
    expect(four).toHaveLength(5);
    expect(four[4]).toEqual({ kind: 'gold' });
    // Evolution: blades at full level plus Armour.
    const e = newRun(knight);
    e.weapons[0].level = WEAPONS.blades.levels.length;
    e.passives.push({ id: 'armour', level: 1 });
    e.owed = 1;
    const offer = makeOffer(e, 3);
    expect(offer[0]).toEqual({ kind: 'evolve', id: 'blades' });
    applyPick(e, 0);
    expect(e.weapons[0].evolved).toBe(true);
    expect(e.evolved).toEqual(['blades']);
    // An evolved weapon wipes the screen: every monster in reach takes the blast.
    for (let i = 0; i < 40 * 60 && !e.events.some((ev) => ev.k === 'wipe'); i++) stepRun(e, i % 17);
    expect(e.events.some((ev) => ev.k === 'wipe')).toBe(true);
  });
});
