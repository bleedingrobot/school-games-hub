/**
 * The Market's items: every class has its own line in each slot (docs/CLANS-ITEMS-PLAN.md). Weapons go up to tier 7 (the
 * class's own top weapon); armour and the off-hand slot up to tier 6. Each tier only adds, and each is a clear step up from
 * the one before. Every item gives some of the class's recommended stats (`CLASS_FOCUS`, the same (R) the Training Hall
 * shows): a weapon mostly one, armour and shields armour or one, plus a smaller helpful extra. What the Smithy sells grows with its level (`SMITHY_TIERS`).
 *
 * The numbers come from the ladders below, so the whole shop can be tuned in one place (`npm run clans:sim`).
 */
import type { GearKind, GearStat, ItemDef } from './types';

/** The stats each class should train first: shown as (R) in the Training Hall and the Market. */
export const CLASS_FOCUS: Record<string, GearStat[]> = {
  Barbarian: ['strength', 'dexterity', 'armor', 'hp'],
  Warrior: ['strength', 'agility', 'dexterity'],
  'Martial Artist': ['agility', 'dexterity', 'sp'],
  Knight: ['strength', 'dexterity', 'armor', 'hp', 'charisma'],
  Assassin: ['dexterity', 'agility', 'sp'],
  Healer: ['wisdom', 'sp'],
  Sorcerer: ['wisdom', 'sp'],
  Necromancer: ['wisdom', 'sp'],
  Wizard: ['wisdom', 'sp', 'hp'],
  Pirate: ['agility', 'dexterity', 'strength', 'charisma', 'hp'],
  Samurai: ['agility', 'dexterity', 'strength', 'sp'],
};

/** Gold for each tier (index 0 is tier 1, which every member starts with). Round tens, so 10% off is always whole. */
export const TIER_PRICES: Record<GearKind, readonly number[]> = {
  weapon: [0, 20, 50, 90, 160, 260, 450],
  armor: [0, 20, 40, 70, 120, 200],
  shield: [0, 20, 40, 70, 120, 200],
};

/** How much a stat grows tier by tier (index 0 is tier 1; index 6 is only used by the top weapons). */
const LADDERS = {
  /** A fighter's weapon strength. */
  big: [2, 4, 7, 10, 14, 18, 22],
  /** A quick fighter's weapon dexterity. */
  quick: [2, 4, 6, 8, 10, 12, 15],
  /** A spell caster's weapon wisdom. */
  magic: [2, 4, 6, 9, 12, 15, 18],
  /** Main armour. */
  mid: [1, 2, 3, 5, 6, 8, 10],
  /** A shield's armour. */
  guard: [1, 2, 2, 3, 4, 5, 6],
  /** Light armour's agility, a robe's wisdom. */
  light: [1, 2, 3, 4, 5, 6, 8],
  /** The helpful extra. */
  small: [1, 1, 2, 2, 3, 3, 4],
  /** A quick fighter's weapon strength (damage still comes from strength). */
  edge: [1, 1, 2, 4, 6, 8, 8],
  hp: [0, 2, 4, 5, 7, 8, 10],
  sp: [1, 2, 3, 4, 5, 6, 8],
} as const;
type Ladder = keyof typeof LADDERS;
type Gives = Partial<Record<GearStat, Ladder>>;

interface Line {
  /** Weapons, tiers 1 to 7 (7 is the class's own top weapon). */
  weapons: string[];
  weapon: Gives;
  /** What the top weapon adds on top of `weapon` at tier 7. */
  top: Partial<Record<GearStat, number>>;
  armours: string[];
  armor: Gives;
  /** The off-hand slot (a shield in the code), tiers 1 to 6. */
  offhands: string[];
  shield: Gives;
  /** What the off-hand slot is called for this class. */
  offhandWord: string;
}

const LINES: Record<string, Line> = {
  Barbarian: {
    weapons: ['Knobbly Club', 'Stone Hammer', 'Hand Axe', 'Bear Axe', 'Battle Axe', 'Thunder Axe', 'Great Axe'],
    weapon: { strength: 'big', dexterity: 'small' },
    top: { armor: 2, hp: 6 },
    armours: ['Rags', 'Fur Wrap', 'Hide Armour', 'Bone Armour', 'Wolf Pelt Armour', 'Mammoth Hide'],
    armor: { armor: 'mid', hp: 'hp' },
    offhands: ['Hide Shield', 'Wooden Shield', 'Bone Shield', 'Spiked Shield', 'Tusk Shield', 'Mammoth Shield'],
    shield: { armor: 'guard', hp: 'small' },
    offhandWord: 'Shield',
  },
  Warrior: {
    weapons: ['Shortsword', 'Mace', 'Broadsword', 'Silver Mace', 'Morning Star', "Champion's Sword", 'Sky Sword'],
    weapon: { strength: 'big', dexterity: 'small' },
    top: { agility: 4 },
    armours: ['Padded Jacket', 'Leather Armour', 'Wooden Armour', 'Chainmail Armour', 'Platemail Armour', "Champion's Plate"],
    armor: { armor: 'mid', agility: 'small' },
    offhands: ['Round Shield', 'Iron Shield', 'Platinum Shield', "Lion's Shield", 'Crystal Shield', "Champion's Shield"],
    shield: { armor: 'guard', agility: 'small' },
    offhandWord: 'Shield',
  },
  Knight: {
    weapons: ['Iron Sword', "Knight's Mace", 'Long Sword', 'Lance', 'Silver Sword', 'Royal Sword', "Falcon's Sword"],
    weapon: { strength: 'big', dexterity: 'small' },
    top: { charisma: 4, armor: 2 },
    armours: ['Quilted Coat', 'Ring Mail', 'Scale Mail', "Knight's Plate", 'Royal Plate', "Hero's Armour"],
    armor: { armor: 'mid', hp: 'hp' },
    offhands: ['Kite Shield', 'Banner Shield', 'Tower Shield', 'Silver Shield', 'Royal Shield', "Hero's Shield"],
    shield: { armor: 'guard', charisma: 'small' },
    offhandWord: 'Shield',
  },
  'Martial Artist': {
    weapons: ['Hand Wraps', 'Bo Staff', 'Nunchaku', 'Iron Fists', 'Tiger Claws', 'Jade Staff', 'Dragon Fist Wraps'],
    weapon: { dexterity: 'quick', strength: 'edge' },
    top: { agility: 4, sp: 4 },
    armours: ['Cloth Tunic', 'Training Gi', 'Kai Tunic', 'Black Belt Gi', 'Tiger Gi', "Master's Gi"],
    armor: { agility: 'light', sp: 'small' },
    offhands: ['Cloth Bracers', 'Leather Bracers', 'Iron Bracers', 'Jade Bracers', 'Tiger Bracers', 'Dragon Bracers'],
    shield: { agility: 'small', dexterity: 'small', sp: 'sp' },
    offhandWord: 'Bracers',
  },
  Assassin: {
    weapons: ['Dagger', 'Twin Daggers', 'Hooked Blade', 'Scythe', 'Night Blade', 'Moon Dagger', 'Shadow Fang'],
    weapon: { dexterity: 'quick', strength: 'edge' },
    top: { agility: 4 },
    armours: ['Grey Hood', 'Leather Vest', 'Night Leathers', 'Shadow Cloak', 'Silent Leathers', 'Midnight Cloak'],
    armor: { agility: 'light', armor: 'small' },
    offhands: ['Leather Gloves', 'Throwing Stars', 'Hooked Gloves', 'Smoke Bombs', 'Shadow Gloves', 'Night Gloves'],
    shield: { agility: 'small', dexterity: 'small', sp: 'sp' },
    offhandWord: 'Gloves',
  },
  Pirate: {
    weapons: ['Cutlass', 'Boarding Axe', 'Sabre', 'Boomerang', 'Sea Sabre', 'Coral Cutlass', 'Storm Cutlass'],
    weapon: { dexterity: 'quick', strength: 'edge' },
    top: { charisma: 4, hp: 4 },
    armours: ['Striped Shirt', 'Sea Coat', "Captain's Vest", 'Leather Longcoat', "Admiral's Coat", 'Storm Coat'],
    armor: { agility: 'light', hp: 'hp' },
    offhands: ['Wooden Buckler', 'Brass Buckler', "Ship's Buckler", 'Anchor Buckler', "Captain's Buckler", 'Storm Buckler'],
    shield: { agility: 'light', charisma: 'small' },
    offhandWord: 'Buckler',
  },
  Samurai: {
    weapons: ['Wooden Sword', 'Short Blade', 'Curved Sword', 'Steel Blade', 'Crane Blade', 'Moon Blade', 'Dawn Blade'],
    weapon: { dexterity: 'quick', strength: 'edge' },
    top: { sp: 3 },
    armours: ['Padded Robe', 'Bamboo Armour', 'Lacquered Armour', 'Plated Robe', 'Crane Armour', 'Moon Armour'],
    armor: { agility: 'light', armor: 'small' },
    offhands: ['Paper Fan', 'War Fan', 'Iron Fan', 'Crane Fan', 'Steel Fan', 'Moon Fan'],
    shield: { dexterity: 'small', agility: 'small', sp: 'sp' },
    offhandWord: 'Fan',
  },
  Healer: {
    weapons: ['Staff', 'Willow Rod', 'Ash Staff', 'Silver Sceptre', 'Light Staff', 'Crystal Sceptre', 'Sunrise Sceptre'],
    weapon: { wisdom: 'magic', sp: 'sp' },
    top: { sp: 2 },
    armours: ['Cloth Robe', 'Linen Robe', 'White Robe', 'Silver Robe', 'Dawn Robe', 'Sunlight Robe'],
    armor: { wisdom: 'light', armor: 'small', hp: 'small' },
    offhands: ['Herb Pouch', 'Lucky Charm', 'Book of Herbs', 'Sun Charm', 'Healing Orb', 'Golden Sun Charm'],
    shield: { sp: 'sp', wisdom: 'small', charisma: 'small' },
    offhandWord: 'Charm',
  },
  Sorcerer: {
    weapons: ['Wand', 'Spark Wand', 'Flame Staff', 'Crystal Wand', 'Blaze Staff', 'Inferno Staff', 'Ember Rod'],
    weapon: { wisdom: 'magic', sp: 'sp' },
    top: { wisdom: 1 },
    armours: ['Grey Robe', 'Red Robe', 'Ember Robe', 'Flame Robe', 'Phoenix Robe', 'Firestorm Robe'],
    armor: { wisdom: 'light', armor: 'small', hp: 'small' },
    offhands: ['Ember Stone', 'Spark Charm', 'Flame Orb', 'Book of Fire', 'Phoenix Feather', 'Sun Orb'],
    shield: { sp: 'sp', wisdom: 'small', charisma: 'small' },
    offhandWord: 'Charm',
  },
  Necromancer: {
    weapons: ['Bone Wand', 'Raven Staff', 'Moonstone Wand', 'Shadow Staff', 'Ghost Staff', 'Night Sceptre', 'Moonbone Staff'],
    weapon: { wisdom: 'magic', sp: 'sp' },
    top: { hp: 4 },
    armours: ['Dark Robe', 'Raven Robe', 'Shadow Robe', 'Moonlit Robe', 'Ghostly Robe', 'Midnight Robe'],
    armor: { wisdom: 'light', armor: 'small', hp: 'small' },
    offhands: ['Raven Feather', 'Candle Lantern', 'Spirit Book', 'Moonstone', 'Ghost Lantern', 'Night Orb'],
    shield: { sp: 'sp', wisdom: 'small', charisma: 'small' },
    offhandWord: 'Charm',
  },
  Wizard: {
    weapons: ['Apprentice Wand', 'Oak Staff', 'Rune Wand', "Wizard's Staff", 'Star Wand', 'Star Staff', 'Starfall Staff'],
    weapon: { wisdom: 'magic', sp: 'sp' },
    top: { hp: 4 },
    armours: ['Apprentice Robe', 'Wool Robe', 'Blue Robe', 'Rune Robe', 'Mage Robe', 'Star Robe'],
    armor: { wisdom: 'light', armor: 'small', hp: 'hp' },
    offhands: ['Spell Book', 'Crystal Orb', 'Rune Tome', 'Moon Orb', 'Star Charm', 'Book of Stars'],
    shield: { sp: 'sp', wisdom: 'small', charisma: 'small' },
    offhandWord: 'Charm',
  },
};

function makeItem(cls: string, kind: GearKind, name: string, tier: number, gives: Gives, top: Line['top'] = {}): ItemDef {
  const bonus: ItemDef['bonus'] = {};
  for (const [stat, ladder] of Object.entries(gives) as [GearStat, Ladder][]) {
    const v = LADDERS[ladder][tier - 1];
    if (v) bonus[stat] = v;
  }
  for (const [stat, v] of Object.entries(top) as [GearStat, number][]) bonus[stat] = (bonus[stat] ?? 0) + v;
  return { name, kind, cls, tier, price: TIER_PRICES[kind][tier - 1], bonus };
}

export const ITEMS: ItemDef[] = Object.entries(LINES).flatMap(([cls, line]) => [
  ...line.weapons.map((n, i) => makeItem(cls, 'weapon', n, i + 1, line.weapon, i === line.weapons.length - 1 ? line.top : {})),
  ...line.armours.map((n, i) => makeItem(cls, 'armor', n, i + 1, line.armor)),
  ...line.offhands.map((n, i) => makeItem(cls, 'shield', n, i + 1, line.shield)),
]);

/** What the off-hand slot is called for a class ("Shield", "Bracers", "Charm" ...). */
export const offhandWord = (cls: string) => LINES[cls]?.offhandWord ?? 'Shield';

/** One class's line in one slot, tier 1 first. */
export const itemLine = (cls: string, kind: GearKind) => ITEMS.filter((i) => i.cls === cls && i.kind === kind);

/** The item at a tier of a class's line (undefined past the top). */
export const itemAt = (cls: string, kind: GearKind, tier: number) => ITEMS.find((i) => i.cls === cls && i.kind === kind && i.tier === tier);

/**
 * The highest tier the Smithy sells at each level, 0 to 6. Tier 2 is on sale from the start (everyone already has tier 1),
 * each level adds one more, and the class's own top weapon (tier 7) needs a fully built Smithy.
 */
export const SMITHY_TIERS = [2, 3, 4, 5, 6, 6, 7] as const;
export const unlockedTier = (smithy: number) => SMITHY_TIERS[Math.max(0, Math.min(SMITHY_TIERS.length - 1, smithy))];
/** The Smithy level that first sells a tier. */
export const smithyFor = (tier: number) => Math.max(0, SMITHY_TIERS.findIndex((t) => t >= tier));

/**
 * The tier each item from before the class lines counts as, from its old price. Only the one-off gear conversion
 * (`refreshGear`) reads it.
 */
export const OLD_ITEM_TIERS: Record<string, number> = {
  'Knobbly Club': 1, Staff: 1, Dagger: 2, Wand: 2, Mace: 3, Axe: 3, 'Great Axe': 3, Shortsword: 3, Scythe: 3, 'Silver Mace': 3,
  Broadsword: 3, 'Battle Axe': 3, 'Morning Star': 4, "Wizard's Staff": 4, Boomerang: 4, 'Thunder Axe': 4, 'Moon Blade': 5,
  "Falcon's Sword": 5, 'Sky Sword': 6,
  Rags: 1, 'Cloth Robe': 1, 'Leather Armor': 2, 'Wooden Armor': 2, 'Cloth Tunic': 2, 'Chainmail Armor': 3, 'Platemail Armor': 3,
  'Kai Tunic': 3, "Hero's Armor": 5,
  'Wooden Shield': 1, 'Iron Shield': 2, 'Platinum Shield': 3, 'Crystal Shield': 3, "Lion's Shield": 3, "Hero's Shield": 5,
};
