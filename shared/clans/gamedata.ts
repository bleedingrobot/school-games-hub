// Generated once from the numbers in The Clans' data files (see docs/CLANS-RULES.md), then
// meant to be edited by hand. Names are our own.
import type { ClassDef, MonsterDef, RaceDef } from './types';

export const RACES: RaceDef[] = [
 {
  "name": "Human",
  "stats": {
   "agility": 5,
   "dexterity": 5,
   "strength": 5,
   "wisdom": 4,
   "armor": 0,
   "charisma": 4
  },
  "hp": 12,
  "sp": 4,
  "spells": []
 },
 {
  "name": "Dwarf",
  "stats": {
   "agility": 4,
   "dexterity": 5,
   "strength": 8,
   "wisdom": 3,
   "armor": 2,
   "charisma": 3
  },
  "hp": 17,
  "sp": 3,
  "spells": []
 },
 {
  "name": "Elf",
  "stats": {
   "agility": 7,
   "dexterity": 8,
   "strength": 4,
   "wisdom": 7,
   "armor": 0,
   "charisma": 5
  },
  "hp": 16,
  "sp": 6,
  "spells": []
 },
 {
  "name": "Half-Elf",
  "stats": {
   "agility": 6,
   "dexterity": 7,
   "strength": 5,
   "wisdom": 6,
   "armor": 0,
   "charisma": 4
  },
  "hp": 14,
  "sp": 4,
  "spells": []
 },
 {
  "name": "Halfling",
  "stats": {
   "agility": 8,
   "dexterity": 7,
   "strength": 3,
   "wisdom": 4,
   "armor": 0,
   "charisma": 3
  },
  "hp": 15,
  "sp": 8,
  "spells": []
 },
 {
  "name": "Orc",
  "stats": {
   "agility": 4,
   "dexterity": 3,
   "strength": 8,
   "wisdom": 2,
   "armor": 2,
   "charisma": 0
  },
  "hp": 14,
  "sp": 3,
  "spells": []
 },
 {
  "name": "Muya",
  "stats": {
   "agility": 6,
   "dexterity": 5,
   "strength": 4,
   "wisdom": 7,
   "armor": 0,
   "charisma": 6
  },
  "hp": 8,
  "sp": 7,
  "spells": []
 },
 {
  "name": "Minotaur",
  "stats": {
   "agility": 2,
   "dexterity": 2,
   "strength": 9,
   "wisdom": 0,
   "armor": 3,
   "charisma": 0
  },
  "hp": 15,
  "sp": 0,
  "spells": []
 },
 {
  "name": "Imp",
  "stats": {
   "agility": 5,
   "dexterity": 8,
   "strength": 5,
   "wisdom": 4,
   "armor": 1,
   "charisma": 0
  },
  "hp": 12,
  "sp": 5,
  "spells": [
   19,
   18
  ]
 }
];

export const CLASSES: ClassDef[] = [
 {
  "name": "Barbarian",
  "stats": {
   "agility": 2,
   "dexterity": 2,
   "strength": 5,
   "wisdom": -1,
   "armor": 1,
   "charisma": -1
  },
  "hp": 10,
  "sp": -3,
  "spells": []
 },
 {
  "name": "Warrior",
  "stats": {
   "agility": 4,
   "dexterity": 3,
   "strength": 3,
   "wisdom": 1,
   "armor": 0,
   "charisma": 0
  },
  "hp": 8,
  "sp": 6,
  "spells": [
   20,
   11,
   18
  ]
 },
 {
  "name": "Martial Artist",
  "stats": {
   "agility": 6,
   "dexterity": 5,
   "strength": 1,
   "wisdom": 1,
   "armor": 0,
   "charisma": 2
  },
  "hp": 12,
  "sp": 7,
  "spells": [
   8,
   9,
   10,
   21
  ]
 },
 {
  "name": "Knight",
  "stats": {
   "agility": 4,
   "dexterity": 3,
   "strength": 4,
   "wisdom": 2,
   "armor": 1,
   "charisma": 4
  },
  "hp": 13,
  "sp": 6,
  "spells": [
   14,
   22
  ]
 },
 {
  "name": "Assassin",
  "stats": {
   "agility": 4,
   "dexterity": 6,
   "strength": 1,
   "wisdom": 2,
   "armor": 0,
   "charisma": 1
  },
  "hp": 8,
  "sp": 9,
  "spells": [
   16,
   5,
   23
  ]
 },
 {
  "name": "Healer",
  "stats": {
   "agility": 3,
   "dexterity": 2,
   "strength": 0,
   "wisdom": 3,
   "armor": 0,
   "charisma": 2
  },
  "hp": 7,
  "sp": 12,
  "spells": [
   1,
   2,
   4
  ]
 },
 {
  "name": "Sorcerer",
  "stats": {
   "agility": 2,
   "dexterity": 0,
   "strength": -1,
   "wisdom": 4,
   "armor": 0,
   "charisma": 0
  },
  "hp": 10,
  "sp": 9,
  "spells": [
   8,
   12,
   13,
   25
  ]
 },
 {
  "name": "Necromancer",
  "stats": {
   "agility": 2,
   "dexterity": 1,
   "strength": -1,
   "wisdom": 5,
   "armor": 0,
   "charisma": 0
  },
  "hp": 11,
  "sp": 10,
  "spells": [
   8,
   6,
   7,
   19
  ]
 },
 {
  "name": "Wizard",
  "stats": {
   "agility": 2,
   "dexterity": -1,
   "strength": -1,
   "wisdom": 5,
   "armor": 0,
   "charisma": 1
  },
  "hp": 7,
  "sp": 13,
  "spells": [
   13,
   15,
   8,
   2,
   4,
   7
  ]
 },
 {
  "name": "Pirate",
  "stats": {
   "agility": 7,
   "dexterity": 3,
   "strength": 2,
   "wisdom": 1,
   "armor": 0,
   "charisma": 4
  },
  "hp": 5,
  "sp": 0,
  "spells": []
 },
 {
  "name": "Samurai",
  "stats": {
   "agility": 5,
   "dexterity": 4,
   "strength": 2,
   "wisdom": 1,
   "armor": 1,
   "charisma": 2
  },
  "hp": 10,
  "sp": 5,
  "spells": [
   8,
   9
  ]
 }
];

// The items are in items.ts (a line for each class).
export { ITEMS } from './items';

export const MONSTERS: MonsterDef[] = [
 {
  "name": "Scruffy Dog",
  "zone": "Meadow",
  "mine": 0,
  "boss": false,
  "difficulty": 1,
  "hp": 7,
  "sp": 0,
  "stats": {
   "agility": 5,
   "dexterity": 8,
   "strength": 11,
   "wisdom": 1,
   "armor": 0,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Giant Rat",
  "zone": "Meadow",
  "mine": 0,
  "boss": false,
  "difficulty": 1,
  "hp": 14,
  "sp": 0,
  "stats": {
   "agility": 8,
   "dexterity": 9,
   "strength": 8,
   "wisdom": 1,
   "armor": 0,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Hedge Witch",
  "zone": "Meadow",
  "mine": 1,
  "boss": false,
  "difficulty": 1,
  "hp": 13,
  "sp": 10,
  "stats": {
   "agility": 8,
   "dexterity": 5,
   "strength": 8,
   "wisdom": 10,
   "armor": 0,
   "charisma": 0
  },
  "spells": [
   10
  ]
 },
 {
  "name": "Rock Pal",
  "zone": "Meadow",
  "mine": 1,
  "boss": false,
  "difficulty": 1,
  "hp": 12,
  "sp": 0,
  "stats": {
   "agility": 10,
   "dexterity": 9,
   "strength": 12,
   "wisdom": 3,
   "armor": 0,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Goblin",
  "zone": "Meadow",
  "mine": 2,
  "boss": false,
  "difficulty": 2,
  "hp": 16,
  "sp": 0,
  "stats": {
   "agility": 7,
   "dexterity": 9,
   "strength": 10,
   "wisdom": 4,
   "armor": 1,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Grumpy Orc",
  "zone": "Meadow",
  "mine": 2,
  "boss": false,
  "difficulty": 2,
  "hp": 19,
  "sp": 0,
  "stats": {
   "agility": 8,
   "dexterity": 7,
   "strength": 10,
   "wisdom": 3,
   "armor": 0,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Moon Wolf",
  "zone": "Meadow",
  "mine": 3,
  "boss": false,
  "difficulty": 3,
  "hp": 18,
  "sp": 0,
  "stats": {
   "agility": 10,
   "dexterity": 9,
   "strength": 12,
   "wisdom": 2,
   "armor": 0,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Marsh Snake",
  "zone": "Meadow",
  "mine": 3,
  "boss": false,
  "difficulty": 3,
  "hp": 20,
  "sp": 0,
  "stats": {
   "agility": 10,
   "dexterity": 8,
   "strength": 14,
   "wisdom": 3,
   "armor": 1,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Giant Spider",
  "zone": "Caves",
  "mine": 4,
  "boss": false,
  "difficulty": 4,
  "hp": 22,
  "sp": 0,
  "stats": {
   "agility": 11,
   "dexterity": 9,
   "strength": 14,
   "wisdom": 2,
   "armor": 1,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Hobgoblin",
  "zone": "Caves",
  "mine": 4,
  "boss": false,
  "difficulty": 4,
  "hp": 25,
  "sp": 0,
  "stats": {
   "agility": 11,
   "dexterity": 10,
   "strength": 13,
   "wisdom": 3,
   "armor": 1,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Skeleton",
  "zone": "Caves",
  "mine": 5,
  "boss": false,
  "difficulty": 5,
  "hp": 27,
  "sp": 0,
  "stats": {
   "agility": 12,
   "dexterity": 10,
   "strength": 18,
   "wisdom": 4,
   "armor": 3,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Lizard Warrior",
  "zone": "Caves",
  "mine": 5,
  "boss": false,
  "difficulty": 5,
  "hp": 25,
  "sp": 0,
  "stats": {
   "agility": 13,
   "dexterity": 11,
   "strength": 17,
   "wisdom": 3,
   "armor": 2,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Cave Minotaur",
  "zone": "Caves",
  "mine": 6,
  "boss": false,
  "difficulty": 6,
  "hp": 28,
  "sp": 0,
  "stats": {
   "agility": 15,
   "dexterity": 10,
   "strength": 19,
   "wisdom": 4,
   "armor": 5,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Green Slime",
  "zone": "Caves",
  "mine": 6,
  "boss": false,
  "difficulty": 6,
  "hp": 27,
  "sp": 0,
  "stats": {
   "agility": 13,
   "dexterity": 9,
   "strength": 19,
   "wisdom": 4,
   "armor": 3,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Dusk Mage",
  "zone": "Caves",
  "mine": 7,
  "boss": false,
  "difficulty": 6,
  "hp": 24,
  "sp": 10,
  "stats": {
   "agility": 13,
   "dexterity": 10,
   "strength": 21,
   "wisdom": 10,
   "armor": 2,
   "charisma": 0
  },
  "spells": [
   8,
   13,
   14
  ]
 },
 {
  "name": "Wyvern",
  "zone": "Caves",
  "mine": 7,
  "boss": false,
  "difficulty": 7,
  "hp": 26,
  "sp": 0,
  "stats": {
   "agility": 16,
   "dexterity": 10,
   "strength": 21,
   "wisdom": 4,
   "armor": 4,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Gargoyle",
  "zone": "Swamp",
  "mine": 8,
  "boss": false,
  "difficulty": 8,
  "hp": 32,
  "sp": 0,
  "stats": {
   "agility": 14,
   "dexterity": 11,
   "strength": 21,
   "wisdom": 4,
   "armor": 6,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Baby Dragon",
  "zone": "Swamp",
  "mine": 8,
  "boss": false,
  "difficulty": 8,
  "hp": 30,
  "sp": 15,
  "stats": {
   "agility": 11,
   "dexterity": 10,
   "strength": 23,
   "wisdom": 4,
   "armor": 5,
   "charisma": 0
  },
  "spells": [
   24
  ]
 },
 {
  "name": "Swamp Ogre",
  "zone": "Swamp",
  "mine": 9,
  "boss": false,
  "difficulty": 8,
  "hp": 31,
  "sp": 0,
  "stats": {
   "agility": 15,
   "dexterity": 9,
   "strength": 21,
   "wisdom": 2,
   "armor": 5,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Large Spider",
  "zone": "Swamp",
  "mine": 9,
  "boss": false,
  "difficulty": 9,
  "hp": 34,
  "sp": 0,
  "stats": {
   "agility": 12,
   "dexterity": 11,
   "strength": 24,
   "wisdom": 3,
   "armor": 3,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Satyr",
  "zone": "Swamp",
  "mine": 10,
  "boss": false,
  "difficulty": 10,
  "hp": 34,
  "sp": 0,
  "stats": {
   "agility": 13,
   "dexterity": 12,
   "strength": 23,
   "wisdom": 5,
   "armor": 5,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Horse Archer",
  "zone": "Swamp",
  "mine": 11,
  "boss": false,
  "difficulty": 11,
  "hp": 32,
  "sp": 10,
  "stats": {
   "agility": 12,
   "dexterity": 12,
   "strength": 26,
   "wisdom": 10,
   "armor": 5,
   "charisma": 0
  },
  "spells": [
   4,
   5
  ]
 },
 {
  "name": "Stone Golem",
  "zone": "Ruins",
  "mine": 12,
  "boss": false,
  "difficulty": 12,
  "hp": 40,
  "sp": 0,
  "stats": {
   "agility": 14,
   "dexterity": 13,
   "strength": 29,
   "wisdom": 4,
   "armor": 6,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Cyclops",
  "zone": "Ruins",
  "mine": 12,
  "boss": false,
  "difficulty": 12,
  "hp": 43,
  "sp": 0,
  "stats": {
   "agility": 12,
   "dexterity": 12,
   "strength": 27,
   "wisdom": 5,
   "armor": 5,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Giant",
  "zone": "Ruins",
  "mine": 13,
  "boss": false,
  "difficulty": 13,
  "hp": 41,
  "sp": 0,
  "stats": {
   "agility": 13,
   "dexterity": 12,
   "strength": 27,
   "wisdom": 4,
   "armor": 5,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Ruin Sorcerer",
  "zone": "Ruins",
  "mine": 13,
  "boss": false,
  "difficulty": 13,
  "hp": 42,
  "sp": 17,
  "stats": {
   "agility": 11,
   "dexterity": 13,
   "strength": 28,
   "wisdom": 6,
   "armor": 6,
   "charisma": 0
  },
  "spells": [
   6,
   7,
   8
  ]
 },
 {
  "name": "Bandaged Mummy",
  "zone": "Ruins",
  "mine": 14,
  "boss": false,
  "difficulty": 15,
  "hp": 44,
  "sp": 0,
  "stats": {
   "agility": 12,
   "dexterity": 12,
   "strength": 33,
   "wisdom": 6,
   "armor": 6,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Fire Spirit",
  "zone": "Ruins",
  "mine": 15,
  "boss": false,
  "difficulty": 15,
  "hp": 44,
  "sp": 0,
  "stats": {
   "agility": 15,
   "dexterity": 13,
   "strength": 38,
   "wisdom": 7,
   "armor": 7,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Young Dragon",
  "zone": "Mountain",
  "mine": 16,
  "boss": false,
  "difficulty": 16,
  "hp": 48,
  "sp": 0,
  "stats": {
   "agility": 14,
   "dexterity": 13,
   "strength": 39,
   "wisdom": 8,
   "armor": 7,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Rock Beast",
  "zone": "Mountain",
  "mine": 17,
  "boss": false,
  "difficulty": 17,
  "hp": 50,
  "sp": 0,
  "stats": {
   "agility": 15,
   "dexterity": 14,
   "strength": 40,
   "wisdom": 7,
   "armor": 8,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Emerald Wizard",
  "zone": "Mountain",
  "mine": 17,
  "boss": false,
  "difficulty": 17,
  "hp": 50,
  "sp": 20,
  "stats": {
   "agility": 16,
   "dexterity": 15,
   "strength": 43,
   "wisdom": 5,
   "armor": 5,
   "charisma": 0
  },
  "spells": [
   4,
   5,
   7
  ]
 },
 {
  "name": "Storm Wizard",
  "zone": "Mountain",
  "mine": 18,
  "boss": false,
  "difficulty": 18,
  "hp": 49,
  "sp": 30,
  "stats": {
   "agility": 15,
   "dexterity": 14,
   "strength": 45,
   "wisdom": 5,
   "armor": 7,
   "charisma": 0
  },
  "spells": [
   12,
   10,
   15
  ]
 },
 {
  "name": "Storm Knight",
  "zone": "Mountain",
  "mine": 19,
  "boss": false,
  "difficulty": 19,
  "hp": 41,
  "sp": 0,
  "stats": {
   "agility": 14,
   "dexterity": 13,
   "strength": 43,
   "wisdom": 4,
   "armor": 8,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Ember Hound",
  "zone": "Mountain",
  "mine": 20,
  "boss": false,
  "difficulty": 20,
  "hp": 51,
  "sp": 0,
  "stats": {
   "agility": 15,
   "dexterity": 16,
   "strength": 52,
   "wisdom": 7,
   "armor": 8,
   "charisma": 0
  },
  "spells": []
 },
 {
  "name": "Baron Moonbat",
  "zone": "Caves",
  "mine": 5,
  "boss": true,
  "difficulty": 5,
  "hp": 26,
  "sp": 18,
  "stats": {
   "agility": 13,
   "dexterity": 9,
   "strength": 19,
   "wisdom": 14,
   "armor": 3,
   "charisma": 0
  },
  "spells": [
   19
  ]
 },
 {
  "name": "Stone Warden",
  "zone": "Swamp",
  "mine": 10,
  "boss": true,
  "difficulty": 10,
  "hp": 46,
  "sp": 12,
  "stats": {
   "agility": 11,
   "dexterity": 12,
   "strength": 24,
   "wisdom": 4,
   "armor": 4,
   "charisma": 0
  },
  "spells": [
   11
  ]
 },
 {
  "name": "Ember Lord",
  "zone": "Ruins",
  "mine": 15,
  "boss": true,
  "difficulty": 15,
  "hp": 54,
  "sp": 20,
  "stats": {
   "agility": 15,
   "dexterity": 13,
   "strength": 38,
   "wisdom": 7,
   "armor": 7,
   "charisma": 0
  },
  "spells": [
   15
  ]
 },
 {
  "name": "Emerald Dragon",
  "zone": "Mountain",
  "mine": 20,
  "boss": true,
  "difficulty": 20,
  "hp": 53,
  "sp": 21,
  "stats": {
   "agility": 15,
   "dexterity": 14,
   "strength": 54,
   "wisdom": 7,
   "armor": 9,
   "charisma": 0
  },
  "spells": [
   17
  ]
 }
];
