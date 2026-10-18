/**
 * The world's rules, tied together: take a step, talk, start a battle, come back from one.
 * Every function takes a `WorldState` and gives back a new one (the old one is never changed).
 */
import { healTeam, type Bag, type BattleSetup } from '../engine';
import { speciesOf } from '../monsterBook';
import { makeMonster, type Monster } from '../rules';
import { Dice } from './rng';
import { findSighting, nextGrassSteps, wildFor, type Sighting } from './encounters';
import { addToBag, describeLoot, LOOT } from './rewards';
import { DELTA, type Dir, type Gate, type GameMap, type Thing, type WorldState } from './types';
import { gateAt, isBlocked, thingAt, warpAt } from './walking';

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
  return refreshBook({
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
    badges: [],
    seen: [],
    owned: [],
    chests: [],
    paid: [],
  });
}

const sorted = (ids: Iterable<string>) => [...new Set(ids)].sort();

/** The monsters you hold are in the book as owned, and so are the earlier forms they grew from. */
export function refreshBook(state: WorldState): WorldState {
  const have = new Set([...state.owned, ...state.team.map((m) => m.species), ...state.box.map((m) => m.species)]);
  for (const id of [...have]) {
    const { family, stage } = speciesOf(id);
    for (let earlier = 1; earlier < stage; earlier++) have.add(`${family}-${earlier}`);
  }
  const owned = sorted(have);
  return { ...state, owned, seen: sorted([...state.seen, ...owned]) };
}

/** You have met these monsters in a battle (they go in the book, even if you ran away). */
export function meet(state: WorldState, foes: readonly Monster[]): WorldState {
  const seen = sorted([...state.seen, ...foes.map((f) => f.species)]);
  return seen.length === state.seen.length ? state : { ...state, seen };
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
  if (isBlocked(map, nx, ny, state.badges)) return { state: { ...state, facing: dir }, action: 'bump' };

  let next: WorldState = { ...state, x: nx, y: ny, facing: dir, steps: state.steps + 1 };
  const warp = warpAt(map, nx, ny);
  if (warp) {
    if (!opts.maps[warp.to]) throw new Error(`The door at ${map.id} ${nx},${ny} leads to a map that doesn't exist: ${warp.to}`);
    next = { ...next, map: warp.to, x: warp.toX, y: warp.toY, facing: warp.facing, beaten: warp.to === state.map ? state.beaten : [] };
    const after = triggerAfter(next, opts, false);
    return { state: after.state, action: 'warp', trigger: after.trigger };
  }
  const after = triggerAfter(next, opts, true);
  return { state: after.state, action: 'move', trigger: after.trigger };
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
  /** A screen to open once the talking is done (the monster box or the monster book). */
  open?: 'box' | 'book';
  /** What the screen should make a sound for. */
  cue?: 'heal' | 'chest';
}

/** The tile you face. */
export const facingTile = (s: Pick<WorldState, 'x' | 'y' | 'facing'>): [number, number] => [s.x + DELTA[s.facing][0], s.y + DELTA[s.facing][1]];

const fill = (page: string, state: WorldState) => page.replace('{box}', String(state.box.length)).replace('{team}', String(state.team.length));

/** "Leaf badge". */
export const badgeName = (badge: string) => `${badge[0].toUpperCase()}${badge.slice(1)} badge`;

/** What a closed gate says: its own words, then which badge is missing. */
export const gatePages = (gate: Gate): string[] => [...gate.pages, `You need the ${badgeName(gate.badge)} to go on. Win it from the Topic Tower trainer in this area.`];

/** Space / Enter / a tap on what you are facing: read a sign, chat, open a chest, or be healed by the nurse. */
export function interact(state: WorldState, opts: WorldOptions): InteractOutcome {
  const map = mapOf(opts, state);
  const [x, y] = facingTile(state);
  const thing = thingAt(map, x, y);
  if (!thing) {
    const gate = gateAt(map, x, y);
    if (gate && isBlocked(map, x, y, state.badges)) return { state, talk: { pages: gatePages(gate) } };
    return { state };
  }
  const speaker = thing.kind === 'person' || thing.kind === 'trainer' || thing.kind === 'nurse' ? thing.name : undefined;
  const say = (pages: string[]) => ({ speaker, pages: pages.map((p) => fill(p, state)) });
  if (thing.kind === 'nurse') {
    const healed: WorldState = {
      ...state,
      team: healTeam(state.team),
      heal: { map: map.id, x: state.x, y: state.y, facing: state.facing },
    };
    return { state: healed, thing, cue: 'heal', talk: say([...thing.pages, 'All done! Your monsters are fully rested.']) };
  }
  if (thing.kind === 'trainer') {
    // Beaten this visit, or a Tower trainer whose badge you already hold: no more battle, just a chat.
    if (state.beaten.includes(thing.id) || (thing.badge && state.badges.includes(thing.badge))) return { state, thing, talk: say(thing.winPages ?? thing.pages) };
    return { state, thing, talk: say(thing.pages), challenge: thing };
  }
  if (thing.kind === 'chest') {
    if (state.chests.includes(thing.id)) return { state, thing, talk: say(['The chest is empty now.']) };
    const loot = LOOT[thing.loot ?? ''] ?? {};
    const opened: WorldState = { ...state, chests: [...state.chests, thing.id], bag: addToBag(state.bag, loot) };
    return { state: opened, thing, cue: 'chest', talk: say([...thing.pages, `You found ${describeLoot(loot)}!`]) };
  }
  if (thing.kind === 'box' || thing.kind === 'book') return { state, thing, talk: say(thing.pages), open: thing.kind };
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

export interface BattlePrize {
  /** A badge earned for the first time. */
  badge?: string;
  /** Items a trainer paid for the first win. */
  loot?: Bag;
}

/**
 * Back on the map. Win, catch or run: carry on with the team, box and bag the battle ended with
 * (a caught monster is already in the team, or in the box when the team is full). Lose: the team
 * is healed, nothing is lost, and you wake up at the last healing spot. A first win over a Tower
 * trainer gives the badge, and a first win over a trainer with `loot` pays it (never twice).
 */
export function finishBattle(state: WorldState, result: FinishedBattle, trainer?: Thing): { state: WorldState; prize: BattlePrize } {
  let next: WorldState = { ...state, team: structuredClone(result.team), box: structuredClone(result.box), bag: { ...result.bag } };
  const prize: BattlePrize = {};
  if (result.outcome === 'lost') {
    const h = state.heal;
    next = { ...next, team: healTeam(next.team), map: h.map, x: h.x, y: h.y, facing: h.facing, beaten: [] };
  } else if (result.outcome === 'won' && trainer) {
    if (!next.beaten.includes(trainer.id)) next.beaten = [...next.beaten, trainer.id];
    if (trainer.badge && !next.badges.includes(trainer.badge)) {
      next.badges = [...next.badges, trainer.badge];
      prize.badge = trainer.badge;
    }
    if (trainer.loot && !next.paid.includes(trainer.id)) {
      prize.loot = LOOT[trainer.loot];
      next.bag = addToBag(next.bag, prize.loot);
      next.paid = [...next.paid, trainer.id];
    }
  }
  return { state: refreshBook(next), prize };
}

export const afterBattle = (state: WorldState, result: FinishedBattle, trainer?: Thing): WorldState => finishBattle(state, result, trainer).state;
