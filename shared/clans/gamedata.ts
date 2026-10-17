// Generated once from the numbers in The Clans' data files (see docs/CLANS-RULES.md), then
// meant to be edited by hand. Names are our own; prices are the original's divided by 10.
import type { ClassDef, ItemDef, MonsterDef, RaceDef } from './types';

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

export const ITEMS: ItemDef[] = [
 {
  "name": "Shortsword",
  "kind": "weapon",
  "price": 65,
  "bonus": {
   "strength": 5,
   "agility": -1
  },
  "needs": {
   "strength": 6,
   "agility": 4,
   "dexterity": 6
  },
  "shopLevel": 6
 },
 {
  "name": "Broadsword",
  "kind": "weapon",
  "price": 75,
  "bonus": {
   "strength": 6,
   "agility": -2,
   "dexterity": 1,
   "charisma": 1
  },
  "needs": {
   "strength": 10,
   "dexterity": 6
  },
  "shopLevel": 6
 },
 {
  "name": "Axe",
  "kind": "weapon",
  "price": 50,
  "bonus": {
   "strength": 7,
   "dexterity": -1,
   "agility": -2,
   "charisma": 1
  },
  "needs": {
   "strength": 13
  },
  "shopLevel": 6
 },
 {
  "name": "Mace",
  "kind": "weapon",
  "price": 45,
  "bonus": {
   "strength": 4,
   "dexterity": 1
  },
  "needs": {
   "strength": 4,
   "agility": 3,
   "dexterity": 5
  },
  "shopLevel": 6
 },
 {
  "name": "Dagger",
  "kind": "weapon",
  "price": 20,
  "bonus": {
   "strength": 3,
   "dexterity": 1
  },
  "needs": {
   "dexterity": 3
  },
  "shopLevel": 6
 },
 {
  "name": "Staff",
  "kind": "weapon",
  "price": 13,
  "bonus": {
   "strength": 5,
   "agility": -1,
   "dexterity": 1
  },
  "needs": {
   "agility": 6,
   "dexterity": 9
  },
  "shopLevel": 6
 },
 {
  "name": "Wand",
  "kind": "weapon",
  "price": 25,
  "bonus": {
   "strength": 1,
   "dexterity": 1,
   "wisdom": 4
  },
  "needs": {
   "wisdom": 11
  },
  "shopLevel": 6
 },
 {
  "name": "Battle Axe",
  "kind": "weapon",
  "price": 75,
  "bonus": {
   "strength": 8,
   "agility": -1,
   "dexterity": -3,
   "charisma": 1
  },
  "needs": {
   "strength": 13
  },
  "shopLevel": 5
 },
 {
  "name": "Morning Star",
  "kind": "weapon",
  "price": 80,
  "bonus": {
   "strength": 5,
   "dexterity": 2
  },
  "needs": {
   "strength": 6,
   "agility": 8,
   "dexterity": 7
  },
  "shopLevel": 4
 },
 {
  "name": "Scythe",
  "kind": "weapon",
  "price": 65,
  "bonus": {
   "strength": 3,
   "dexterity": 3
  },
  "needs": {
   "strength": 2,
   "agility": 4,
   "dexterity": 3
  },
  "shopLevel": 3
 },
 {
  "name": "Boomerang",
  "kind": "weapon",
  "price": 110,
  "bonus": {
   "strength": 5,
   "dexterity": 4
  },
  "needs": {
   "strength": 2,
   "agility": 6,
   "dexterity": 7
  },
  "shopLevel": 2
 },
 {
  "name": "Falcon's Sword",
  "kind": "weapon",
  "price": 250,
  "bonus": {
   "strength": 8,
   "agility": -3,
   "dexterity": 1,
   "charisma": 3
  },
  "needs": {
   "strength": 12,
   "dexterity": 10
  },
  "shopLevel": 1
 },
 {
  "name": "Sky Sword",
  "kind": "weapon",
  "price": 500,
  "bonus": {
   "strength": 22,
   "dexterity": 2,
   "charisma": 5
  },
  "needs": {
   "strength": 10,
   "dexterity": 6
  },
  "shopLevel": 0
 },
 {
  "name": "Knobbly Club",
  "kind": "weapon",
  "price": 10,
  "bonus": {
   "strength": 6,
   "agility": -1,
   "dexterity": -1
  },
  "needs": {
   "agility": 7,
   "dexterity": 9,
   "strength": 8
  },
  "shopLevel": 2
 },
 {
  "name": "Thunder Axe",
  "kind": "weapon",
  "price": 150,
  "bonus": {
   "strength": 8,
   "agility": -3,
   "dexterity": -1
  },
  "needs": {
   "agility": 8,
   "dexterity": 8,
   "strength": 13
  },
  "shopLevel": 1
 },
 {
  "name": "Moon Blade",
  "kind": "weapon",
  "price": 200,
  "bonus": {
   "strength": 8,
   "agility": -1,
   "dexterity": -1
  },
  "needs": {
   "agility": 11,
   "dexterity": 5,
   "strength": 10
  },
  "shopLevel": 1
 },
 {
  "name": "Wizard's Staff",
  "kind": "weapon",
  "price": 100,
  "bonus": {
   "strength": 2,
   "wisdom": 6,
   "dexterity": 2,
   "agility": 1
  },
  "needs": {
   "wisdom": 11
  },
  "shopLevel": 6
 },
 {
  "name": "Cloth Robe",
  "kind": "armor",
  "price": 11,
  "bonus": {
   "armor": 1
  },
  "needs": {},
  "shopLevel": 6
 },
 {
  "name": "Leather Armor",
  "kind": "armor",
  "price": 25,
  "bonus": {
   "armor": 2,
   "agility": -1,
   "dexterity": -1
  },
  "needs": {
   "strength": 9,
   "dexterity": 7
  },
  "shopLevel": 6
 },
 {
  "name": "Chainmail Armor",
  "kind": "armor",
  "price": 40,
  "bonus": {
   "armor": 3,
   "agility": -2,
   "dexterity": -1
  },
  "needs": {
   "strength": 12,
   "dexterity": 8
  },
  "shopLevel": 6
 },
 {
  "name": "Platemail Armor",
  "kind": "armor",
  "price": 55,
  "bonus": {
   "armor": 4,
   "agility": -3,
   "dexterity": -2,
   "charisma": 1
  },
  "needs": {
   "strength": 14,
   "dexterity": 9
  },
  "shopLevel": 6
 },
 {
  "name": "Wooden Armor",
  "kind": "armor",
  "price": 25,
  "bonus": {
   "armor": 3,
   "agility": -1,
   "dexterity": -1
  },
  "needs": {
   "strength": 9,
   "dexterity": 6
  },
  "shopLevel": 6
 },
 {
  "name": "Cloth Tunic",
  "kind": "armor",
  "price": 25,
  "bonus": {
   "armor": 2
  },
  "needs": {
   "dexterity": 5
  },
  "shopLevel": 5
 },
 {
  "name": "Kai Tunic",
  "kind": "armor",
  "price": 75,
  "bonus": {
   "armor": 3
  },
  "needs": {
   "agility": 9,
   "dexterity": 8
  },
  "shopLevel": 3
 },
 {
  "name": "Hero's Armor",
  "kind": "armor",
  "price": 225,
  "bonus": {
   "armor": 4,
   "agility": -2,
   "dexterity": -1,
   "charisma": 2
  },
  "needs": {
   "strength": 12,
   "dexterity": 10
  },
  "shopLevel": 2
 },
 {
  "name": "Rags",
  "kind": "armor",
  "price": 5,
  "bonus": {
   "armor": 1
  },
  "needs": {},
  "shopLevel": 5
 },
 {
  "name": "Wooden Shield",
  "kind": "shield",
  "price": 15,
  "bonus": {
   "armor": 1
  },
  "needs": {
   "strength": 10
  },
  "shopLevel": 6
 },
 {
  "name": "Iron Shield",
  "kind": "shield",
  "price": 25,
  "bonus": {
   "armor": 2,
   "dexterity": -1
  },
  "needs": {
   "strength": 13
  },
  "shopLevel": 6
 },
 {
  "name": "Platinum Shield",
  "kind": "shield",
  "price": 45,
  "bonus": {
   "charisma": 1,
   "armor": 2
  },
  "needs": {
   "strength": 11
  },
  "shopLevel": 6
 },
 {
  "name": "Crystal Shield",
  "kind": "shield",
  "price": 65,
  "bonus": {
   "charisma": 3,
   "armor": 3
  },
  "needs": {
   "strength": 12,
   "agility": 8
  },
  "shopLevel": 5
 },
 {
  "name": "Hero's Shield",
  "kind": "shield",
  "price": 250,
  "bonus": {
   "charisma": 5,
   "armor": 4
  },
  "needs": {
   "strength": 13,
   "agility": 10
  },
  "shopLevel": 2
 },
 {
  "name": "Silver Mace",
  "kind": "weapon",
  "price": 65,
  "bonus": {
   "strength": 6,
   "dexterity": 1
  },
  "needs": {
   "strength": 3,
   "agility": 3,
   "dexterity": 5
  },
  "shopLevel": 3
 },
 {
  "name": "Lion's Shield",
  "kind": "shield",
  "price": 70,
  "bonus": {
   "armor": 2
  },
  "needs": {
   "strength": 7
  },
  "shopLevel": 2
 },
 {
  "name": "Great Axe",
  "kind": "weapon",
  "price": 50,
  "bonus": {
   "strength": 9,
   "dexterity": -1,
   "agility": -2,
   "charisma": 1
  },
  "needs": {
   "strength": 15
  },
  "shopLevel": 2
 }
];

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
  "name": "Centaur",
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
