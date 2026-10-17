/**
 * Which picture (a 16 × 16 tile in tiles.png, as [column, row]) belongs to what. The pictures are from
 * Kenney's 1-Bit Pack (CC0, see KENNEY-LICENSE.txt). They are one colour, so the game colours each one.
 */
export type Tile = [column: number, row: number];

export const TILE = 16;
export const SHEET_COLUMNS = 49;
export const SHEET_ROWS = 22;

export const MONSTER_TILES: Record<string, Tile> = {
  'Mud Slug': [27, 8], 'Grumpy Goose': [25, 7], 'Angry Squirrel': [30, 7], 'Rude Crow': [26, 7], 'Bog Frog': [31, 8],
  'Sneaky Kobold': [26, 2], 'Stick Spider': [28, 5], 'Gloomy Badger': [29, 6], 'Tax Goblin': [25, 2], 'Mossy Imp': [27, 2],
  'Cave Bat': [26, 8], 'Thorn Hog': [30, 8], 'Pebble Golem': [30, 6], 'Wasp Swarm': [31, 5], 'Cranky Troll Pup': [29, 2],
  'Wolf Pup': [31, 7], 'Bandit Trainee': [25, 1], 'Fungus Fiend': [26, 6], 'Giant Beetle': [30, 5], 'Hedge Witch': [26, 9],
  'Grey Wolf': [27, 7], 'Ogre Cook': [24, 3], 'Skeleton Dancer': [25, 0], 'Bog Troll': [28, 6], 'Mirror Imp': [25, 5],
  'Forest Troll': [30, 3], 'Dire Boar': [28, 7], 'Shadow Cat': [29, 7], 'Rock Gnasher': [24, 7], 'Sock Wraith': [27, 6],
  'Ogre Chief': [28, 3], 'Stone Harpy': [29, 5], 'Iron Beetle': [28, 5], 'Bramble Witch': [24, 5], 'Night Stalker': [24, 1],
  'Cave Troll': [29, 3], 'Flame Imp': [27, 2], 'Gargoyle': [31, 3], 'Venom Wyrm': [28, 8], 'Knight of Rust': [29, 6],
  'Frost Giant': [24, 8], 'Storm Hawk': [26, 8], 'Bone Colossus': [31, 4], 'Lava Toad': [31, 8], 'Dread Knight': [28, 0],
  'Hydra Pup': [25, 8], 'Thunder Ogre': [28, 3], 'Doom Spider': [27, 5], 'Ember Drake': [31, 7], 'Grave Lord': [29, 4],
  'Fire Giant': [24, 6], 'Basalt Wyvern': [26, 8], 'Plague Beast': [30, 8], 'Shadow Titan': [24, 8], 'Wyrm Queen': [28, 8],
  'Dragon Guard': [31, 0], 'Cinder Colossus': [30, 6], 'Elder Drake': [29, 8], 'Lair Warden': [27, 0], 'Scorch Knight': [29, 0],
};
export const MASTER_TILES: Tile[] = [[25, 9], [24, 0], [27, 1], [28, 2], [24, 4], [30, 0], [29, 1], [27, 3], [26, 9], [28, 1], [29, 3]];
export const DRAGON_TILE: Tile = [29, 8];
export const DEFAULT_MONSTER_TILE: Tile = [25, 2];

export const WEAPON_TILES: Tile[] = [[32, 2], [33, 6], [32, 7], [33, 8], [34, 7], [35, 8], [36, 7], [37, 8], [38, 7], [40, 7], [38, 8], [40, 8]];
export const ARMOUR_TILES: Tile[] = [[37, 3], [38, 3], [39, 3], [37, 4], [32, 1], [33, 1], [34, 1], [35, 1], [32, 0], [33, 0], [34, 0], [36, 0]];

export const ICON_TILES: Record<string, Tile> = {
  gold: [41, 3], gem: [23, 4], heart: [42, 10], potion: [32, 13], skull: [37, 11], sword: [33, 6], shield: [37, 3], key: [33, 11],
  fire: [26, 11], star: [43, 12], scroll: [34, 15], coin: [22, 4],
};
export const CLASS_TILES: Record<string, Tile> = { knight: [24, 0], mage: [26, 9], trickster: [25, 2] };
export const HERO_TILE: Tile = [25, 0];
