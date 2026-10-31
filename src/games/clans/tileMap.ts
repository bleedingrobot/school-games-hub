/**
 * Which picture (a 16 x 16 tile in tiles.png, as [column, row]) belongs to what. The pictures are from
 * Kenney's 1-Bit Pack (CC0, see KENNEY-LICENSE.txt). They are one colour, so the game colours each one.
 */
export type Tile = [column: number, row: number];

export const TILE = 16;
export const SHEET_COLUMNS = 49;
export const SHEET_ROWS = 22;

export const MONSTER_TILES: Record<string, Tile> = {
  'Scruffy Dog': [31, 7], 'Giant Rat': [29, 7], 'Hedge Witch': [26, 9], 'Rock Pal': [24, 7], Goblin: [25, 2], 'Grumpy Orc': [29, 2],
  'Moon Wolf': [27, 7], 'Marsh Snake': [28, 8], 'Giant Spider': [28, 5], Hobgoblin: [26, 2], Skeleton: [26, 0], 'Lizard Warrior': [29, 8],
  'Cave Minotaur': [28, 2], 'Green Slime': [27, 8], 'Dusk Mage': [26, 4], Wyvern: [26, 8], Gargoyle: [31, 3], 'Baby Dragon': [31, 8],
  'Swamp Ogre': [24, 3], 'Large Spider': [27, 5], Satyr: [27, 2], 'Horse Archer': [28, 7], 'Stone Golem': [30, 6], Cyclops: [31, 6],
  Giant: [24, 8], 'Ruin Sorcerer': [27, 4], 'Bandaged Mummy': [29, 6], 'Fire Spirit': [26, 6], 'Young Dragon': [29, 8], 'Rock Beast': [30, 8],
  'Emerald Wizard': [28, 4], 'Storm Wizard': [30, 4], 'Storm Knight': [28, 0], 'Ember Hound': [31, 7], 'Baron Moonbat': [26, 8],
  'Stone Warden': [30, 6], 'Ember Lord': [29, 0], 'Emerald Dragon': [28, 8],
};
export const DEFAULT_MONSTER_TILE: Tile = [25, 2];

/** One person-shaped picture per class, coloured by race. */
export const CLASS_TILES: Record<string, Tile> = {
  Barbarian: [30, 0], Warrior: [25, 0], 'Martial Artist': [28, 1], Knight: [28, 0], Assassin: [24, 0], Healer: [24, 4],
  Sorcerer: [27, 4], Necromancer: [29, 1], Wizard: [28, 4], Pirate: [25, 1], Samurai: [31, 2],
};
export const DEFAULT_CLASS_TILE: Tile = [25, 0];

/** One picture per shop item (by name), from the same sheet. Anything missing gets its kind's default. */
export const ITEM_TILES: Record<string, Tile> = {
  Shortsword: [32, 6], Broadsword: [32, 7], 'Moon Blade': [33, 8], "Falcon's Sword": [34, 8], 'Sky Sword': [36, 9],
  Dagger: [34, 6], Axe: [39, 7], 'Battle Axe': [42, 8], 'Great Axe': [41, 7], 'Thunder Axe': [40, 8],
  Mace: [37, 7], 'Silver Mace': [37, 8], 'Morning Star': [38, 8], 'Knobbly Club': [32, 2], Staff: [32, 4], "Wizard's Staff": [33, 4],
  Wand: [34, 3], Scythe: [44, 5], Boomerang: [37, 6],
  Rags: [37, 1], 'Cloth Robe': [38, 1], 'Cloth Tunic': [32, 1], 'Leather Armor': [33, 1], 'Wooden Armor': [34, 1], 'Chainmail Armor': [35, 1],
  'Platemail Armor': [36, 1], 'Kai Tunic': [47, 7], "Hero's Armor": [36, 0],
  'Wooden Shield': [37, 2], 'Iron Shield': [38, 2], 'Platinum Shield': [39, 2], 'Crystal Shield': [40, 2], "Lion's Shield": [39, 3], "Hero's Shield": [38, 3],
};
export const KIND_TILES: Record<string, Tile> = { weapon: [32, 6], armor: [32, 1], shield: [37, 2] };
/** Heading pictures for the places. */
export const PLACE_TILES: Record<string, Tile> = { market: [43, 4], training: [32, 8], church: [44, 11], mines: [38, 5] };
