import { describe, expect, it, vi } from 'vitest';
import { WORLD_MAPS } from '../../../../shared/monsters/maps';
import { makeMonster } from '../../../../shared/monsters/rules';
import type { Dir, Thing, WorldState } from '../../../../shared/monsters/world/types';
import { newWorld, type InteractOutcome, type WorldOptions } from '../../../../shared/monsters/world/world';
import { TIMING, WalkController } from './controller';

const opts: WorldOptions = { maps: WORLD_MAPS };
const team = () => [makeMonster('plusplash-1', 5)];
const spot = (map: string, name: string) => WORLD_MAPS[map].spots.find((s) => s.name === name)!;
const at = (map: string, name: string, extra: Partial<WorldState> = {}): WorldState => {
  const s = spot(map, name);
  return { ...newWorld(opts, team(), 3), map, x: s.x, y: s.y, facing: s.facing, ...extra };
};

function make(initial: WorldState, timeScale = 1) {
  const log = { talks: [] as InteractOutcome[], wild: vi.fn(), trainer: [] as Thing[], states: [] as WorldState[] };
  const c = new WalkController(initial, opts, {
    onState: (s) => log.states.push(s),
    onWild: log.wild,
    onTrainer: (t) => log.trainer.push(t),
    onTalk: (o) => log.talks.push(o),
  }, timeScale);
  /** Runs the clock forward in 16 ms ticks. */
  let now = 0;
  const run = (ms: number) => {
    for (const end = now + ms; now < end; ) c.tick((now += 16));
  };
  return { c, log, run, now: () => now };
}

describe('walking over time', () => {
  it('a quick tap on a new direction only turns; holding it carries on and walks', () => {
    const { c, run } = make(at('harbour-town', 'start')); // facing up at (11,15)
    c.press('left', 0);
    run(60);
    expect([c.state.x, c.state.facing]).toEqual([11, 'left']); // turned, hasn't stepped
    c.release('left');
    run(400);
    expect(c.state.x).toBe(11);
    c.press('left', 500);
    run(260);
    expect(c.state.x).toBeLessThan(11); // now facing left: it walks
  });

  it('never goes faster than a step each ' + TIMING.step + ' ms', () => {
    const { c, run } = make(at('harbour-town', 'start', { x: 11, y: 13, facing: 'left' }));
    c.press('left', 0);
    run(1000);
    expect(11 - c.state.x).toBeLessThanOrEqual(Math.ceil(1000 / TIMING.step));
    expect(11 - c.state.x).toBeGreaterThanOrEqual(Math.floor(1000 / TIMING.step) - 1);
    c.release('left');
  });

  it('moves smoothly between tiles: the drawn position is part-way through a step', () => {
    const { c, run } = make(at('harbour-town', 'start', { x: 11, y: 13, facing: 'left' }));
    c.press('left', 0);
    run(TIMING.step / 2);
    const v = c.view(TIMING.step / 2);
    expect(v.walking).toBe(true);
    expect(v.x).toBeGreaterThan(c.state.x);
    expect(v.x).toBeLessThan(11);
    c.release('left');
  });

  it('is blocked by a wall, and stands still', () => {
    const { c, run } = make(at('harbour-town', 'start', { x: 10, y: 15, facing: 'down' }));
    c.press('down', 0);
    run(300);
    c.release('down');
    expect([c.state.x, c.state.y]).toEqual([10, 16]);
    c.press('down', 400); // (10,17) is the edge of the map
    run(400);
    expect(c.state.y).toBeLessThanOrEqual(16);
  });

  it('a tap walks the shortest way there, one step at a time, then stops', () => {
    const { c, run } = make(at('harbour-town', 'start'));
    c.tap(11, 12);
    run(2000);
    expect([c.state.x, c.state.y]).toEqual([11, 12]);
    expect(c.busy).toBe(false);
  });

  it('a tap on a person walks up to them, faces them and talks', () => {
    const { c, run, log } = make(at('harbour-town', 'start', { x: 11, y: 13 }));
    c.tap(13, 15); // the teacher
    run(2500);
    expect(log.talks).toHaveLength(1);
    expect(log.talks[0].talk!.speaker).toBe('Teacher');
    expect(c.state.facing).not.toBe('up');
  });

  it('a new key press cancels a tap walk', () => {
    const { c, run } = make(at('harbour-town', 'start', { x: 11, y: 13 }));
    c.tap(18, 13);
    run(500);
    c.press('up', 600);
    c.release('up');
    run(100);
    const x = c.state.x;
    run(1500);
    expect(c.state.x).toBe(x);
  });

  it('locked: nothing moves while a talk box or battle has the screen', () => {
    const { c, run } = make(at('harbour-town', 'start'));
    c.lock();
    c.press('up', 0);
    c.tap(11, 10);
    run(600);
    expect(c.state.y).toBe(15);
    c.unlock();
    c.press('up', 700);
    run(300);
    expect(c.state.y).toBeLessThan(15);
  });

  it('Space talks to what you face, and not while a step is going', () => {
    const { c, log } = make(at('harbour-town', 'start', { x: 9, y: 15, facing: 'up' }), 0);
    c.talk();
    expect(log.talks).toHaveLength(1);
    expect(log.talks[0].talk!.pages[0]).toMatch(/Welcome to Harbour Town/);
    const { c: c2, log: log2, run: run2 } = make(at('harbour-town', 'start', { x: 10, y: 15, facing: 'right' }));
    c2.press('up', 0);
    run2(60);
    c2.talk();
    expect(log2.talks).toHaveLength(0);
  });
});

describe('grass and trainers over time', () => {
  it('a wild battle starts once the step has finished, and walking waits', () => {
    const { c, log, run } = make(at('kauri-bush', 'entrance', { x: 3, y: 5, grassSteps: 1, facing: 'right' }));
    c.press('right', 0);
    c.release('right');
    run(60);
    expect(log.wild).not.toHaveBeenCalled(); // still mid-step
    run(300);
    expect(log.wild).toHaveBeenCalledTimes(1);
    expect(log.wild.mock.calls[0][0].foe.species).toBeTruthy();
    expect(c.isLocked).toBe(true);
    c.press('right', 900);
    run(300);
    expect(c.state.x).toBe(4); // still where the battle found it
  });

  it('a trainer who sees you shows "!", walks up beside you, then challenges you', () => {
    const { c, log, run } = make(at('kauri-bush', 'trainer-approach')); // (18,10), facing up
    c.press('up', 0);
    c.release('up');
    run(TIMING.step + 100);
    expect(c.view().noticed).toBe('kauri-bush:Ranger Kiri');
    expect(log.trainer).toHaveLength(0);
    run(TIMING.notice + TIMING.trainerStep * 2 + 200);
    expect(log.trainer.map((t) => t.name)).toEqual(['Ranger Kiri']);
    expect(c.view().noticed).toBeNull();
    expect(c.view().actors.get('kauri-bush:Ranger Kiri')).toMatchObject({ x: 17, y: 9 });
    expect(c.state.facing).toBe('left'); // you turned to face them
  });

  it('with timeScale 0 everything is immediate', () => {
    const { c, log, run } = make(at('kauri-bush', 'trainer-approach'), 0);
    c.press('up', 0);
    run(100);
    expect(log.trainer).toHaveLength(1);
  });

  it('going through a door is announced and clears what you were doing', () => {
    const events: string[] = [];
    const c = new WalkController(at('harbour-town', 'start', { x: 6, y: 9, facing: 'up' }), opts, {
      onState: () => {}, onWild: () => {}, onTrainer: () => {}, onTalk: () => {}, onEnter: (s) => events.push(s.map),
    }, 0);
    c.press('up' as Dir, 0);
    expect(events).toEqual(['healing-centre']);
    expect(c.state.map).toBe('healing-centre');
  });
});
