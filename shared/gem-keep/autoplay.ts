/**
 * A simple computer player, for tests and balancing: does a level feel winnable for someone
 * who builds sensibly, and lost for someone who does nothing? It isn't clever, on purpose:
 * a student playing properly should do better than it.
 */
import { GEM, TOWER } from './config';
import { act, canBuildOn, newGame, step, type GameState } from './engine';
import { combineCost, COLOURS, type Colour } from './gems';
import { pathTiles, type LevelData, type Tile } from './level';

export type Strategy = 'idle' | 'towers-only' | 'sensible';

/** Grass tiles, best first: the ones with the most path within reach of a tower. */
export function bestTiles(state: GameState, reach = GEM.range): Tile[] {
  const path = state.level.paths.flatMap(pathTiles);
  const tiles: { tile: Tile; score: number }[] = [];
  for (let y = 0; y < state.ground.length; y++) {
    for (let x = 0; x < state.ground[y].length; x++) {
      if (!canBuildOn(state, [x, y])) continue;
      const score = path.filter(([px, py]) => Math.hypot(px - x, py - y) <= reach).length;
      tiles.push({ tile: [x, y], score });
    }
  }
  return tiles.sort((a, b) => b.score - a.score).map((t) => t.tile);
}

/** Spends mana the way a sensible player might. Returns how many moves it made. */
export function spendMana(state: GameState, strategy: Strategy, colours: readonly Colour[] = COLOURS): number {
  if (strategy === 'idle') return 0;
  let moves = 0;
  for (let guard = 0; guard < 50; guard++) {
    // Any gem in the bag goes into an empty tower, biggest first.
    const empty = state.towers.find((t) => !t.gem);
    const slots = state.inventory.map((g, slot) => ({ g, slot })).filter((s) => s.g).sort((a, b) => b.g!.grade - a.g!.grade);
    if (empty && slots.length) {
      act(state, { type: 'place', slot: slots[0].slot, x: empty.x, y: empty.y });
      moves++;
      continue;
    }
    if (strategy === 'sensible') {
      // A gem in the bag that matches a tower's gem gets combined into the tower.
      const match = slots
        .map((s) => ({ s, tower: state.towers.find((t) => t.gem && t.gem.grade === s.g!.grade && t.gem.grade < GEM.maxGrade) }))
        .find((m) => m.tower);
      if (match && state.mana >= combineCost(match.s.g!.grade)) {
        act(state, { type: 'combine', from: { slot: match.s.slot }, onto: { x: match.tower!.x, y: match.tower!.y } });
        moves++;
        continue;
      }
    }
    if (empty && state.mana >= GEM.createCost) {
      act(state, { type: 'create', colour: colours[state.towers.indexOf(empty) % colours.length] });
      moves++;
      continue;
    }
    // Enough towers for now? Then make the weakest tower's gem stronger.
    const towersWanted = strategy === 'sensible' ? 2 + state.wave : 99;
    if (state.towers.length < towersWanted && state.mana >= TOWER.buildCost + GEM.createCost) {
      const [tile] = bestTiles(state);
      if (!tile) break;
      act(state, { type: 'build', x: tile[0], y: tile[1] });
      moves++;
      continue;
    }
    if (strategy === 'sensible') {
      const weakest = state.towers.filter((t) => t.gem && t.gem.grade < GEM.maxGrade).sort((a, b) => a.gem!.grade - b.gem!.grade)[0];
      if (weakest && weakest.gem!.grade <= 2 && state.mana >= GEM.createCost + combineCost(1)) {
        act(state, { type: 'create', colour: weakest.gem!.colours[0] });
        moves++;
        continue;
      }
      const upgradable = state.towers.find((t) => t.gem && t.level < TOWER.maxLevel && t.gem.grade >= 2);
      if (upgradable && state.mana >= TOWER.upgradeCost[upgradable.level - 1] + 40) {
        act(state, { type: 'upgrade', x: upgradable.x, y: upgradable.y });
        moves++;
        continue;
      }
    }
    break;
  }
  return moves;
}

/** Plays a whole level. The player spends mana before each wave and every 2 seconds during it. */
export function autoplay(level: LevelData, strategy: Strategy, seed = 1, colours?: readonly Colour[]): GameState {
  const state = newGame(level, seed);
  while (state.phase === 'build' || state.phase === 'wave') {
    if (state.phase === 'build') {
      spendMana(state, strategy, colours);
      act(state, { type: 'start-wave' });
    }
    step(state);
    if (state.step % 120 === 0) spendMana(state, strategy, colours);
    state.events.length = 0;
  }
  return state;
}
