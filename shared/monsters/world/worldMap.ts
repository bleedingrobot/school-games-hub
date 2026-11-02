/**
 * The world map in the Menu: every place (Harbour Town, the six areas and the three bonus areas behind
 * the sleeping giants), whether it is open yet, where you are, and the key things in each one: the
 * nurse, the Tinker, the notice board, people who need your help, the Tower and its badge, a sleeping
 * giant, eggs that hatch there, puzzles and nests. Worked out from the maps and the save, so it is never
 * out of date. The screen draws it (src/games/monsters/world/WorldMapPage.tsx).
 */
import { HATCH_SPOTS, EGG_LABEL } from '../quests/eggs';
import { GIANTS } from '../quests/giants';
import { PUZZLES } from '../quests/puzzles';
import { QUESTS } from '../quests/quests';
import { AREAS } from './areas';
import { questMarks, questOf, recordEvent, type QuestOptions } from './questWorld';
import type { GameMap, Spot, WorldState } from './types';

export interface Pin {
  /** A small picture for the line (an emoji). */
  icon: string;
  text: string;
  /** Something to do here now (a quest step, an egg ready to hatch here, a puzzle not solved yet). */
  todo?: boolean;
}

export interface Place {
  /** The map id. */
  id: string;
  name: string;
  open: boolean;
  /** You are here (in a Tower counts as its area). */
  here: boolean;
  /** One of the three places behind a sleeping giant. */
  bonus: boolean;
  /** What it takes to open it, while it is shut. */
  opens?: string;
  pins: Pin[];
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Which place a map belongs to: a Tower's hall and top belong to their area, the Healing Centre to the town. */
function placeOf(map: string): string {
  if (map === 'healing-centre') return 'harbour-town';
  return AREAS.find((a) => a.towerHall === map || a.towerTop === map)?.map ?? map;
}

export function worldPlaces(state: WorldState, maps: Record<string, GameMap>): Place[] {
  const q = questOf(state);
  const here = placeOf(state.map);
  const out: Place[] = [];

  const pinsFor = (map: GameMap, inside: GameMap[] = []): Pin[] => {
    const pins: Pin[] = [];
    const marks = questMarks(state, map);
    for (const t of [...inside.flatMap((m) => m.things), ...map.things]) {
      if (t.kind === 'nurse') pins.push({ icon: '❤️', text: map.id === 'harbour-town' ? 'Healing Centre: heals your team' : 'Nurse: heals your team' });
      else if (t.kind === 'tinker') pins.push({ icon: '🔧', text: 'The Tinker: makes things from bits' });
      else if (t.kind === 'board') pins.push({ icon: '📋', text: 'Notice board: 3 jobs a day' });
      else if (t.kind === 'box') pins.push({ icon: '📦', text: 'Monster box' });
      else if (marks.has(t.id)) pins.push({ icon: '❗', text: `${t.name} needs your help`, todo: true });
      else if (QUESTS.some((qu) => qu.giver === t.id)) pins.push({ icon: '🙂', text: t.name });
      else if (t.kind === 'giant') {
        const g = GIANTS.find((x) => x.id === t.giant)!;
        const awake = q.flags.includes(`woke:${g.id}`);
        pins.push(awake
          ? { icon: '🌄', text: `The giant has woken: the way to ${maps[g.opens].name} is open` }
          : { icon: '😴', text: `A sleeping giant blocks a path (wake it with a ${g.itemName})` });
      } else if (t.kind === 'nest') pins.push({ icon: '🪺', text: `Egg nest: a ${EGG_LABEL[t.egg!]} each week` });
    }
    // Puzzles: one line for all of them here.
    const ids = [...new Set(map.things.filter((t) => t.kind === 'puzzle').map((t) => t.puzzle!))];
    if (ids.length) {
      const left = ids.filter((id) => !q.flags.includes(`solved:${id}`)).length;
      const name = PUZZLES.find((p) => p.id === ids[0])?.title ?? 'Puzzle';
      pins.push(left ? { icon: '🧩', text: `${name}: not solved yet`, todo: true } : { icon: '🧩', text: `${name}: solved` });
    }
    for (const [kind, spot] of Object.entries(HATCH_SPOTS)) {
      if (spot.map !== map.id) continue;
      const mine = q.eggs.some((e) => e.kind === kind);
      pins.push({ icon: '🥚', text: `${cap(EGG_LABEL[kind as keyof typeof EGG_LABEL])}s hatch at ${spot.place}`, todo: mine });
    }
    return pins;
  };

  const town = maps['harbour-town'];
  if (town) out.push({ id: town.id, name: town.name, open: true, here: here === town.id, bonus: false, pins: pinsFor(town, maps['healing-centre'] ? [maps['healing-centre']] : []) });
  for (const a of AREAS) {
    const map = maps[a.map];
    if (!map) continue;
    const open = a.area === 1 || state.badges.includes(AREAS[a.area - 2].badge);
    // A place not open yet keeps its secrets: just its name and what opens it.
    const pins = open ? pinsFor(map) : [];
    if (open) pins.push(state.badges.includes(a.badge) ? { icon: '🏆', text: `Tower: ${cap(a.badge)} badge won` } : { icon: '🏰', text: `Tower: win the ${cap(a.badge)} badge`, todo: open });
    out.push({ id: a.map, name: a.name, open, here: here === a.map, bonus: false, opens: open ? undefined : `Win the ${cap(AREAS[a.area - 2].badge)} badge`, pins });
  }
  for (const g of GIANTS) {
    const map = maps[g.opens];
    if (!map) continue;
    const open = q.flags.includes(`woke:${g.id}`);
    out.push({
      id: map.id,
      name: open ? map.name : 'A secret place',
      open,
      here: here === map.id,
      bonus: true,
      opens: open ? undefined : `Wake the sleeping giant in ${maps[g.map].name}`,
      pins: open ? pinsFor(map) : [],
    });
  }
  return out;
}

/**
 * Fast travel (James, 3 November 2026): tap an open place on the world map and you are there. Free,
 * allowed in the middle of a quest (the Menu can't open in a battle, a puzzle or a talk), and you land
 * beside the place's nurse: Harbour Town's is inside the Healing Centre, and the three bonus places
 * have no nurse, so you land at their entrance. No steps are added, so the server's speed check is
 * unchanged, and you only ever land in a place the server already lets you stand in.
 */
export function landingFor(place: string, maps: Record<string, GameMap>): { map: string; spot: Spot } | undefined {
  const map = place === 'harbour-town' ? 'healing-centre' : place;
  const spots = maps[map]?.spots ?? [];
  const spot = spots.find((s) => s.name === 'nurse') ?? spots.find((s) => s.name === (map === 'healing-centre' ? 'wake' : 'entrance'));
  return spot && { map, spot };
}

/** Fly to an open place you are not in now. Arriving counts as a visit (a notice board job), the same as walking in. */
export function fastTravel(state: WorldState, place: string, maps: Record<string, GameMap>, opts: QuestOptions = {}): { state: WorldState; lines: string[] } | undefined {
  const p = worldPlaces(state, maps).find((x) => x.id === place);
  const land = p?.open && !p.here ? landingFor(place, maps) : undefined;
  if (!land) return undefined;
  const { x, y, facing } = land.spot;
  return recordEvent({ ...state, map: land.map, x, y, facing, beaten: [] }, { kind: 'visit', map: land.map, spot: 'enter' }, opts);
}
