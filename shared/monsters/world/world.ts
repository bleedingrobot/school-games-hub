/**
 * The world's rules, tied together: take a step, talk, start a battle, come back from one.
 * Every function takes a `WorldState` and gives back a new one (the old one is never changed).
 */
import { healTeam, type Bag, type BattleSetup } from '../engine';
import { makeMonster, type Monster } from '../rules';
import { Dice } from './rng';
import { findSighting, nextGrassSteps, wildFor, type Sighting } from './encounters';
import { DELTA, type Dir, type GameMap, type Thing, type WorldState } from './types';
import { isBlocked, thingAt, warpAt } from './walking';

export type Maps = Readonly<Record<string, GameMap>>;

export interface WorldOptions {
  maps: Maps;
  /** The test page's "More battles" switch: grass starts a battle every 2-3 steps. */
  fast?: boolean;
}

export const START_BAG: Bag = { potion: 5, ball: 10 };
export const START_MAP = 'harbour-town';

export function mapOf(opts: WorldOptions, state: Pick<WorldState, 'map'>): GameMap {
  const m = opts.maps[state.map];
  if (!m) throw new Error(`There is no map "${state.map}"`);
  return m;
}

function spotOf(opts: WorldOptions, map: string, name: string) {
  const s = opts.maps[map]?.spots.find((x) => x.name === name);
  if (!s) throw new Error(`Map "${map}" has no spot called "${name}"`);
  return s;
}

/** A new game: in the home town, the given team, the starter bag, and you wake up at the healing centre if you lose. */
export function newWorld(opts: WorldOptions, team: Monster[], seed = 1): WorldState {
  const start = spotOf(opts, START_MAP, 'start');
  const wake = spotOf(opts, 'healing-centre', 'wake');
  const dice = new Dice(seed);
  return {
    version: 1,
    map: START_MAP,
    x: start.x,
    y: start.y,
    facing: start.facing,
    team: structuredClone(team),
    box: [],
    bag: { ...START_BAG },
    beaten: [],
    heal: { map: 'healing-centre', x: wake.x, y: wake.y, facing: wake.facing },
    seed: dice.seed,
    grassSteps: nextGrassSteps(dice, opts.fast ?? false),
    repel: 0,
    steps: 0,
  };
}

/** Puts you at a place (used by the test page's "Teleport to"). */
export function placeAt(state: WorldState, map: string, x: number, y: number, facing: Dir = 'down'): WorldState {
  return { ...state, map, x, y, facing, beaten: state.map === map ? state.beaten : [] };
}

export type Trigger =
  | { kind: 'wild'; foe: Monster; area: number; far: boolean }
  | { kind: 'trainer'; sighting: Sighting };

export interface StepOutcome {
  state: WorldState;
  /** turn: only turned on the spot; move: took a step; warp: went through a door or exit; bump: something is in the way. */
  action: 'turn' | 'move' | 'warp' | 'bump';
  /** Something that takes over now: a wild battle, or a trainer who has seen you. */
  trigger?: Trigger;
}

/**
 * One press of a direction. With `turnFirst`, a press that isn't the way you face only turns you
 * (so a quick tap turns on the spot, and holding the key walks). A tap-to-walk path doesn't turn first.
 */
export function step(state: WorldState, dir: Dir, opts: WorldOptions, { turnFirst = false }: { turnFirst?: boolean } = {}): StepOutcome {
  if (turnFirst && state.facing !== dir) return { state: { ...state, facing: dir }, action: 'turn' };
  const map = mapOf(opts, state);
  const nx = state.x + DELTA[dir][0];
  const ny = state.y + DELTA[dir][1];
  if (isBlocked(map, nx, ny)) return { state: { ...state, facing: dir }, action: 'bump' };

  let next: WorldState = { ...state, x: nx, y: ny, facing: dir, steps: state.steps + 1 };
  const warp = warpAt(map, nx, ny);
  if (warp) {
    if (!opts.maps[warp.to]) throw new Error(`The door at ${map.id} ${nx},${ny} leads to a map that doesn't exist: ${warp.to}`);
    next = { ...next, map: warp.to, x: warp.toX, y: warp.toY, facing: warp.facing, beaten: warp.to === state.map ? state.beaten : [] };
    return { state: next, action: 'warp', ...triggerAfter(next, opts, false) };
  }
  return { state: next, action: 'move', ...triggerAfter(next, opts, true) };
}

/** After arriving on a tile: has a trainer seen you, or has the grass started a battle? */
function triggerAfter(state: WorldState, opts: WorldOptions, steppedOnGrass: boolean): { state: WorldState; trigger?: Trigger } {
  const map = mapOf(opts, state);
  const sighting = findSighting(map, state);
  if (sighting) return { state, trigger: { kind: 'trainer', sighting } };
  if (!steppedOnGrass || !map.isGrass[state.y * map.width + state.x] || !map.wild.length) return { state };

  const fast = opts.fast ?? false;
  const dice = new Dice(state.seed);
  let grassSteps = fast ? Math.min(state.grassSteps, 3) : state.grassSteps;
  let repel = state.repel;
  if (repel > 0) {
    repel -= 1;
  } else {
    grassSteps -= 1;
    if (grassSteps <= 0) {
      const foe = wildFor(map, state.x, state.y, dice);
      if (foe) {
        const far = map.far[state.y * map.width + state.x];
        return {
          state: { ...state, seed: dice.seed, grassSteps: nextGrassSteps(dice, fast), repel },
          trigger: { kind: 'wild', foe, area: map.area, far },
        };
      }
    }
  }
  return { state: { ...state, grassSteps, repel } };
}

export interface Talk {
  /** Who is speaking, if it is a person. */
  speaker?: string;
  pages: string[];
}

export interface InteractOutcome {
  state: WorldState;
  talk?: Talk;
  /** A trainer who wants to battle once the talking is done. */
  challenge?: Thing;
  thing?: Thing;
}

/** The tile you face. */
export const facingTile = (s: Pick<WorldState, 'x' | 'y' | 'facing'>): [number, number] => [s.x + DELTA[s.facing][0], s.y + DELTA[s.facing][1]];

const fill = (page: string, state: WorldState) => page.replace('{box}', String(state.box.length)).replace('{team}', String(state.team.length));

/** Space / Enter / a tap on what you are facing: read a sign, chat, or be healed by the nurse. */
export function interact(state: WorldState, opts: WorldOptions): InteractOutcome {
  const map = mapOf(opts, state);
  const [x, y] = facingTile(state);
  const thing = thingAt(map, x, y);
  if (!thing) return { state };
  const speaker = thing.kind === 'person' || thing.kind === 'trainer' || thing.kind === 'nurse' ? thing.name : undefined;
  const say = (pages: string[]) => ({ speaker, pages: pages.map((p) => fill(p, state)) });
  if (thing.kind === 'nurse') {
    const healed: WorldState = {
      ...state,
      team: healTeam(state.team),
      heal: { map: map.id, x: state.x, y: state.y, facing: state.facing },
    };
    return { state: healed, thing, talk: say([...thing.pages, 'All done! Your monsters are fully rested.']) };
  }
  if (thing.kind === 'trainer') {
    if (state.beaten.includes(thing.id)) return { state, thing, talk: say(thing.winPages ?? thing.pages) };
    return { state, thing, talk: say(thing.pages), challenge: thing };
  }
  return { state, thing, talk: say(thing.pages) };
}

/** The battle a wild trigger starts. */
export function wildBattle(state: WorldState, trigger: Extract<Trigger, { kind: 'wild' }>): BattleSetup {
  return { kind: 'wild', area: trigger.area, far: trigger.far, team: state.team, box: state.box, bag: state.bag, foes: [trigger.foe] };
}

/** The battle a trainer starts: the far half of the area, so the harder questions. */
export function trainerBattle(state: WorldState, opts: WorldOptions, trainer: Thing): BattleSetup {
  const map = mapOf(opts, state);
  return {
    kind: 'trainer',
    area: Math.max(map.area, 1),
    far: true,
    team: state.team,
    box: state.box,
    bag: state.bag,
    foes: (trainer.team ?? []).map((m) => makeMonster(m.species, m.level)),
  };
}

export interface FinishedBattle {
  outcome: 'won' | 'lost' | 'ran' | 'caught';
  team: Monster[];
  box: Monster[];
  bag: Bag;
}

/**
 * Back on the map. Win, catch or run: carry on with the team, box and bag the battle ended with
 * (a caught monster is already in the team, or in the box when the team is full). Lose: the team
 * is healed, nothing is lost, and you wake up at the last healing spot.
 */
export function afterBattle(state: WorldState, result: FinishedBattle, trainer?: Thing): WorldState {
  const next: WorldState = { ...state, team: structuredClone(result.team), box: structuredClone(result.box), bag: { ...result.bag } };
  if (result.outcome === 'lost') {
    const h = state.heal;
    return { ...next, team: healTeam(next.team), map: h.map, x: h.x, y: h.y, facing: h.facing, beaten: [] };
  }
  if (result.outcome === 'won' && trainer && !next.beaten.includes(trainer.id)) next.beaten = [...next.beaten, trainer.id];
  return next;
}
