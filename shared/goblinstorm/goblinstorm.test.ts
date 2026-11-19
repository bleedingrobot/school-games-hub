// Goblin Storm's rules (docs/GOBLINSTORM-PLAN.md): the 3 rule tests the plan allows. Balance is the sim's job.
import { describe, expect, it } from 'vitest';
import { botRun } from './bot';
import { HEROES, MAPS, RUN_STEPS, WEAPONS } from './config';
import { applyPick, makeOffer, newRun, stepRun, waiting, type RunSetup } from './engine';
import { decodeSteering, encodeSteering, replayRun } from './replay';

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
