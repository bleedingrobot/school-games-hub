# Clan Quest: rule sheet (Stage C.0)

Started 18 October 2026. This is the "rule book" half of [CLANS-PLAN.md](CLANS-PLAN.md): every number we take from *The Clans* (Allen Ussher, 1997; GPL-2, now kept by the Synchronet BBS project), what we rescale, and every place we change it on purpose.

**Status: first draft. Section 1-4 are the original's numbers (read from its data files on 18 Oct 2026, nothing copied but the numbers). Section 5 onwards is what I propose; all of it gets tuned by the simulator in stage C.1.** Nothing here is built yet.

Source files read: `races.txt`, `classes.txt`, `items.txt`, `monsters.txt`, `spells.u8.txt` in [clans-src/data](https://gitlab.synchro.net/main/sbbs/-/tree/master/src/doors/clans-src/data). Rules and numbers aren't copyright the way text is; our names, writing and art are our own. No code or text is copied (the hub stays free of GPL).

## 1. Races (9)

Start stats. "5 is average, 8 is excellent, 3 is poor" (the original's own note). `Armor` is armour strength, `HP` and `SP` are starting hit points and skill points, `Gold` is the starting gold.

| Race | Agility | Dexterity | Strength | Wisdom | Armor | Charisma | HP | SP | Gold |
|---|---|---|---|---|---|---|---|---|---|
| Human | 5 | 5 | 5 | 4 | 0 | 4 | 12 | 4 | 300 |
| Dwarf | 4 | 5 | 8 | 3 | 2 | 3 | 17 | 3 | 75 |
| Elf | 7 | 8 | 4 | 7 | 0 | 5 | 16 | 6 | 50 |
| Half-Elf | 6 | 7 | 5 | 6 | 0 | 4 | 14 | 4 | 80 |
| Halfling | 8 | 7 | 3 | 4 | 0 | 3 | 15 | 8 | 80 |
| Orc | 4 | 3 | 8 | 2 | 2 | 0 | 14 | 3 | 500 |
| Muya | 6 | 5 | 4 | 7 | 0 | 6 | 8 | 7 | 500 |
| Minotaur | 2 | 2 | 9 | 0 | 3 | 0 | 15 | 0 | 0 |
| **Imp** (was Demon) | 5 | 8 | 5 | 4 | 1 | 0 | 12 | 5 | 0 |

The original has 9 races, not 10 as the plan said: Human, Dwarf, Elf, Half-Elf, Halfling, Orc, Muya, Minotaur and Demon. The Imp also starts knowing two spells (Fear and Bloodlust).

Original race gold is a clan's starting purse. We use one shared starting purse instead (section 5) so no race feels cheated.

## 2. Classes (11, all kept)

Class numbers are **added** to the race's. "0 is average, 3 is excellent, -3 is poor."

| Class | Agi | Dex | Str | Wis | Armor | Cha | HP | SP | Gold | Starting spells |
|---|---|---|---|---|---|---|---|---|---|---|
| Barbarian | 2 | 2 | 5 | -1 | 1 | -1 | 10 | -3 | 100 | none |
| Warrior | 4 | 3 | 3 | 1 | 0 | 0 | 8 | 6 | 50 | Light Blow, Heavy Blow, Bloodlust |
| Martial Artist | 6 | 5 | 1 | 1 | 0 | 2 | 12 | 7 | 60 | Mystic Fireball, Dragon's Uppercut, Summon Dead Warrior, Hurricane Kick |
| Knight | 4 | 3 | 4 | 2 | 1 | 4 | 13 | 6 | 500 | Holy Heal, Divine Warrior |
| Assassin | 4 | 6 | 1 | 2 | 0 | 1 | 8 | 9 | 300 | Backstab, Ropes, Blind Eye |
| Healer | 3 | 2 | 0 | 3 | 0 | 2 | 7 | 12 | 50 | Partial Heal, Heal, Strength |
| Sorcerer | 2 | 0 | -1 | 4 | 0 | 0 | 10 | 9 | 100 | Mystic Fireball, Death and Decay, Mystic Bond, Rain of Terror |
| Necromancer | 2 | 1 | -1 | 5 | 0 | 0 | 11 | 10 | 100 | Mystic Fireball, Raise Undead, Banish Undead, Fear |
| Wizard | 2 | -1 | -1 | 5 | 0 | 1 | 7 | 13 | 20 | Mystic Bond, Lightning Bolt, Mystic Fireball, Heal, Strength, Banish Undead |
| Pirate | 7 | 3 | 2 | 1 | 0 | 4 | 5 | 0 | 750 | none |
| Samurai | 5 | 4 | 2 | 1 | 1 | 2 | 10 | 5 | 250 | Mystic Fireball, Dragon's Uppercut |

*Note:* the original lists each class's spells by number; I matched them to the spell file's order (spell 1 = Partial Heal ... 28 = Ice Blast), and checked each row twice.

**Class gold** in the original is extra gold on top of the race's. We drop this too (section 5).

**Example:** a Dwarf Warrior starts at Agility 8, Dexterity 8, Strength 11, Wisdom 4, Armor 2, Charisma 3, HP 25, SP 9. A Halfling Wizard: Agility 10, Dexterity 6, Strength 2, Wisdom 9, HP 22, SP 21.

## 3. Items (47 in the original)

19 weapons, 9 armour, 6 shields, 6 scrolls, 7 books. Prices in the original are 5 to 25,000 gold; **we keep the shapes and divide prices by 10** (section 5). Each item has stat bonuses/penalties and **requirements** (minimum strength, agility, dexterity to use it well), which is why a dearer weapon isn't always better.

A taste of the weapons (original price → ours at ÷10):

| Item | Price | Bonus | Needs |
|---|---|---|---|
| Dagger | 200 → 20 | Str +3, Dex +1 | Dex 3 |
| Mace | 450 → 45 | Str +4, Dex +1 | Str 4, Agi 3, Dex 5 |
| Axe | 500 → 50 | Str +7, Dex -1, Agi -2, Cha +1 | Str 13 |
| Shortsword | 650 → 65 | Str +5, Agi -1 | Str 6, Agi 4, Dex 6 |
| Broadsword | 750 → 75 | Str +6, Agi -2, Dex +1, Cha +1 | Str 10, Dex 6 |
| Battle Axe | 750 → 75 | Str +8, Agi -1, Dex -3, Cha +1 | none listed |
| Heavenly Sword | 5000 → 500 | Str +22, Dex +2, Cha +5 | Str 10 |

Armour runs Rags (+1 armour, 50) to Hero's Armor (+4, 2250); shields run Wooden Shield (+1, 150) to Hero's Shield (+4, 2500).

**What we keep:** all weapons, armour and shields (about 34), renamed where the name is grim ("Bloody Club" → "Knobbly Club", "Death Axe" → "Thunder Axe"). The shop shows a tidy 4 to 6 items at a time, picked by the village's Smithy level, like the original's "RandLevel".
**Scrolls and books:** scrolls kept (one-use spells, free to cast). **Books** (cost 9,500 to 25,000) teach a spell for good; kept but rare, priced for late game.
**"Examine" costs 25% of the price:** kept, it's a percentage question (plan section 6).

## 4. Spells (28) and monsters (184)

**Spells.** Each has a type (heal, damage, modify, tie-up, raise/banish undead), a power, a skill-point cost (SP) and a level. Examples:

| Spell | Type | Power | SP | Level |
|---|---|---|---|---|
| Partial Heal | Heal (friendly) | 10 | 8 | 0 |
| Heal | Heal (friendly) | 14 | 13 | 0 |
| Holy Heal | Heal (friendly) | 4 | 7 | 0 |
| Light Blow | Damage | 13 | 4 | 3 |
| Mystic Fireball | Damage | 9 | 4 | 6 |
| Heavy Blow | Damage | 10 | 6 | 9 |
| Lightning Bolt | Damage | 25 | 15 | 8 |
| Backstab | Damage | 17 | 9 | 9 |
| Strength | Modify (friendly) | +5 Str | 6 | 5 |
| Ropes / Mystic Bond | Tie up an enemy for a turn | | 9 / 12 | 3 / 4 |
| Raise Undead / Banish Undead | Undead helpers | | 13 / 9 | 5 / 5 |

(The "Level" column is the character level the spell needs, as I read it; I'll confirm against the fight code in C.1.) There are two FireBreath entries (dragon-only) and four "Summon" and "Ice Blast" entries that exist as scroll effects. We keep about 20 of the 28 for players and use the rest only for monsters and scrolls.

**Monsters: 184, difficulty 1 to 20, about 9 per level.** HP runs from 7 (Mangy dog) to 53 (Green Dragon). Each has agility, dexterity, strength, wisdom, armour strength and sometimes a spell. We write **about 30 of our own** (plan section 5) with these difficulty bands as our guide:

| Our zone | Mine levels | Original difficulty | HP range | Examples in the original (we rename) |
|---|---|---|---|---|
| Meadow pests | 0-3 | 1-3 | 7-25 | Mangy dog, Giant Rat, Goblin, Wolf |
| Caves | 4-7 | 4-6 | 22-28 | Giant Spider, Ghoul, Skeleton, Lizardman |
| Swamp | 8-11 | 7-9 | 25-36 | Wyvern, Gargoyle, Large Spider, Ogre |
| Ruins | 12-15 | 10-14 | 32-48 | Golem, Cyclops, Mummy, Fire Elemental |
| Mountain | 16-20 | 15-20 | 43-53 | Small Dragon, Doom Knight, Hell Hound |
| Bosses (every 5 levels) | 5, 10, 15, 20 | | | Our own: one per zone |

**Renames for the gentle version:** Bad Boy, Drunken Fool, Beggar, Bum, Thief, Murderer, Evil Farmer, Ugly Man and the Demon family are out or renamed (people who are mean or poor aren't monsters). Dark Nun and Dark Monk go too. The keepers are animals, creatures, elementals, constructs and dragons.

## 5. How we rescale (proposed, to be tuned in C.1)

| Thing | Original | Clan Quest | Why |
|---|---|---|---|
| Stat range | 0-100 | **0-60** | A finished clan in a school term |
| Character level cap | 100 | **20** | Same |
| Training points a level | 10-13 | **12** (flat); stats cost 3 each (armour 5, charisma 6) | Simple sums, plan section 7. Costs tuned in C.1 |
| Prices and gold | Sword about 650 | **÷10**, so about 65 | Numbers kids can work with. Three-digit bands used on purpose |
| Starting gold | Race + class | **One clan purse: 200** | Same for all |
| Mine fights a day | Fixed by the sysop | **8** (answered) | |
| Fight length | Up to 50 rounds | **3-8 rounds** | |
| Enemies in a fight | Varies | **2-3 before depth 3, then 3-4** | Tuned in C.1 |
| Followers a fight | 4-13 | **4-13, kept** | Fine for division questions |
| Experience to reach a level | about 100 × level, 100 levels | **30 for level 2, then 10 more each level, but never more than 90 for one level**; mines deeper than 8 add 25% per level to experience per hit | Late game took 60+ days; now a mixed clan reaches level 20 in about 7 weeks |
| Church to wake | `(level+1) × 300` | **`(level+1) × 10`, and the first wake-up each day is free** | ÷30, then tuned in C.2 tuning pass (the first guess of ÷10 ran an all-fighters clan out of gold by day 30) |
| Resurrect | `(level+1) × 750` | **Not needed** (knocked out, never dead) | Plan section 5 |
| Looking at an item | 25% of price | **25%, kept** | A percentage question |
| Fame points | +10 win, -10 loss | **Positive only** | Plan section 5 |
| Land development | Gold per plot | **2 gold a square plus 1 gold for each unit of fence** (section 12) | Area and perimeter are the sums behind the price |
| Barracks capacity | 20 footmen / 10 axemen / 5 knights | **Same, kept** (each kind has its own room) | |
| Troop prices | 15 / 30 / 60 | **Same, kept (already small)** | |
| Worker energy | 100% a day | **Same, kept** | |

**The core fight formulas stay as in the original** (plan section 1): hit if `dexterity + 2 + two small dice` is not below the target's `agility + a small die`; damage = `half strength × (80-119%) − armour strength`, at least 1; experience per hit = `damage ÷ 3 + 1`, **and each mine level deeper than 8 adds 25% more experience per hit** (our change, see the table in section 6). We use whole numbers throughout. Everything is seeded (`shared/seededRandom.ts`) so the server can replay a fight.

## 6. Where we change the original on purpose

1. **No permanent loss.** Knocked out until the Church wakes you; never dead. (Original: lose max HP below -5, die below -15.)
2. **No ruler, no taxes, no overthrow.** Replaced by the class Village Chest and votes. The "sales tax" in the market becomes a **fixed village tax** that the class can lower by building (so tax percentages still appear in maths questions).
3. **Positive fame only.**
4. **Demon race → Imp**, grim monsters and items renamed, no gore text.
5. **No free text:** names and clan names come from word lists.
6. **Raids on classmates stay in**, with the guard rails in plan section 8.
7. **Prices ÷10, levels 20 not 100, stats 0-60.**
8. **Fights are 3-8 rounds, not up to 50.**

## 7. Our item list (all 47, ÷10, rounded)

Names changed only where grim or where two items shared a name (the second "Battle Axe" is now "Great Axe"). Bonuses and needs are the original's. Stats here are on the original's scale; the engine will cap them at 60. Prices ÷10 rounded to a whole number. The shop shows 4 to 6 of these at a time, set by the village Smithy level.

**Weapons (19)**

| Item | Price → ours | Bonus | Needs |
|---|---|---|---|
| Shortsword | 650 → 65 | Str +5, Agi -1 | Str 6, Agi 4, Dex 6 |
| Broadsword | 750 → 75 | Str +6, Agi -2, Dex +1, Cha +1 | Str 10, Dex 6 |
| Axe | 500 → 50 | Str +7, Dex -1, Agi -2, Cha +1 | Str 13 |
| Mace | 450 → 45 | Str +4, Dex +1 | Str 4, Agi 3, Dex 5 |
| Dagger | 200 → 20 | Str +3, Dex +1 | Dex 3 |
| Staff | 125 → 13 | Str +5, Agi -1, Dex +1 | Agi 6, Dex 9 |
| Wand | 250 → 25 | Str +1, Dex +1, Wis +4 | Wis 11 |
| Battle Axe | 750 → 75 | Str +8, Agi -1, Dex -3, Cha +1 | Str 13 |
| Morning Star | 800 → 80 | Str +5, Dex +2 | Str 6, Agi 8, Dex 7 |
| Scythe | 650 → 65 | Str +3, Dex +3 | Str 2, Agi 4, Dex 3 |
| Boomerang | 1100 → 110 | Str +5, Dex +4 | Str 2, Agi 6, Dex 7 |
| Falcon's Sword | 2500 → 250 | Str +8, Agi -3, Dex +1, Cha +3 | Str 12, Dex 10 |
| Sky Sword | 5000 → 500 | Str +22, Dex +2, Cha +5 | Str 10, Dex 6 |
| Knobbly Club | 100 → 10 | Str +6, Agi -1, Dex -1 | Agi 7, Dex 9, Str 8 |
| Thunder Axe | 1500 → 150 | Str +8, Agi -3, Dex -1 | Agi 8, Dex 8, Str 13 |
| Moon Blade | 2000 → 200 | Str +8, Agi -1, Dex -1 | Agi 11, Dex 5, Str 10 |
| Wizard's Staff | 1000 → 100 | Str +2, Wis +6, Dex +2, Agi +1 | Wis 11 |
| Silver Mace | 650 → 65 | Str +6, Dex +1 | Str 3, Agi 3, Dex 5 |
| Great Axe | 500 → 50 | Str +9, Dex -1, Agi -2, Cha +1 | Str 15 |

**Armors (9)**

| Item | Price → ours | Bonus | Needs |
|---|---|---|---|
| Cloth Robe | 105 → 11 | Armor +1 | - |
| Leather Armor | 250 → 25 | Armor +2, Agi -1, Dex -1 | Str 9, Dex 7 |
| Chainmail Armor | 400 → 40 | Armor +3, Agi -2, Dex -1 | Str 12, Dex 8 |
| Platemail Armor | 550 → 55 | Armor +4, Agi -3, Dex -2, Cha +1 | Str 14, Dex 9 |
| Wooden Armor | 250 → 25 | Armor +3, Agi -1, Dex -1 | Str 9, Dex 6 |
| Cloth Tunic | 250 → 25 | Armor +2 | Dex 5 |
| Kai Tunic | 750 → 75 | Armor +3 | Agi 9, Dex 8 |
| Hero's Armor | 2250 → 225 | Armor +4, Agi -2, Dex -1, Cha +2 | Str 12, Dex 10 |
| Rags | 50 → 5 | Armor +1 | - |

**Shields (6)**

| Item | Price → ours | Bonus | Needs |
|---|---|---|---|
| Wooden Shield | 150 → 15 | Armor +1 | Str 10 |
| Iron Shield | 250 → 25 | Armor +2, Dex -1 | Str 13 |
| Platinum Shield | 450 → 45 | Cha +1, Armor +2 | Str 11 |
| Crystal Shield | 650 → 65 | Cha +3, Armor +3 | Str 12, Agi 8 |
| Hero's Shield | 2500 → 250 | Cha +5, Armor +4 | Str 13, Agi 10 |
| Lion's Shield | 700 → 70 | Armor +2 | Str 7 |

**Scrolls (6)**

| Item | Price → ours | Bonus | Needs |
|---|---|---|---|
| Flame Scroll | 1000 → 100 | - | - |
| Helper Scroll | 1200 → 120 | - | - |
| Send-Away Scroll | 2500 → 250 | - | - |
| Summon Khaos | 8500 → 850 | - | - |
| Summon Dragon | 6500 → 650 | - | - |
| Ice Blast | 4500 → 450 | - | - |

**Books (7)**

| Item | Price → ours | Bonus | Needs |
|---|---|---|---|
| Book of Stamina | 13500 → 1350 | - | - |
| Book of Mana | 10000 → 1000 | - | - |
| Book of Healing | 15000 → 1500 | - | Wis 10 |
| Book of Flames | 9500 → 950 | - | Wis 10 |
| Book of Spirits I | 15000 → 1500 | - | Wis 10 |
| Book of Spirits II | 10000 → 1000 | - | Wis 10 |
| Book of Thunder | 25000 → 2500 | - | Wis 10 |


## 8. Our spell list (23 for players)

Names softened; numbers (power, SP, level) are the original's, shown in section 4. Spell numbers are the original's, so class starting spells in section 2 map straight across.

| # | Our name | Original | Notes |
|---|---|---|---|
| 1 | Little Heal | Partial Heal | |
| 2 | Heal | Heal | |
| 3 | Slow | Slow | |
| 4 | Strength | Strength | |
| 5 | Ropes | Ropes | Ties up an enemy for a turn |
| 6 | Call Spirit Helper | Raise Undead | A friendly spirit fights for you |
| 7 | Send Spirits Away | Banish Undead | |
| 8 | Fireball | Mystic Fireball | |
| 9 | Dragon's Uppercut | Dragon's Uppercut | |
| 10 | Call Ghost Warrior | Summon Dead Warrior | |
| 11 | Heavy Blow | Heavy Blow | |
| 12 | Wither | Death and Decay | |
| 13 | Magic Chains | Mystic Bond | Ties up an enemy |
| 14 | Holy Heal | Holy Heal | |
| 15 | Lightning Bolt | Lightning Bolt | |
| 16 | Sneak Attack | Backstab | |
| 18 | Battle Fury | Bloodlust | |
| 19 | Scare | Fear | |
| 20 | Light Blow | Light Blow | |
| 21 | Hurricane Kick | Hurricane Kick | |
| 22 | Divine Warrior | Divine Warrior | |
| 23 | Dazzle | Blind Eye | |
| 25 | Thunder Rain | Rain of Terror | |

Monster and scroll only: 17 and 24 (Fire Breath, two versions), 26 Chaos, 27 Dragon, 28 Ice Blast.

## 9. Our monsters (34, plus 4 bosses)

Stats are the original's (they already run up to about 54, so they fit our 0-60 cap). Where the original has several similar monsters we pick one and rename the grim ones. `Spells` uses the numbers in section 8. "Mine" is the depth where it first turns up.

| Mine | Zone | Our name | Original | HP | Agi | Dex | Str | Wis | Armor | Spells |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Meadow | Scruffy Dog | Mangy dog | 7 | 5 | 8 | 11 | 1 | 0 | |
| 0 | Meadow | Giant Rat | Giant Rat | 14 | 8 | 9 | 8 | 1 | 0 | |
| 1 | Meadow | Hedge Witch | Witch | 13 | 8 | 5 | 8 | 10 | 0 | 10 |
| 1 | Meadow | Rock Pal | Rockman | 12 | 10 | 9 | 12 | 3 | 0 | |
| 2 | Meadow | Goblin | Goblin (d2) | 16 | 7 | 9 | 10 | 4 | 1 | |
| 2 | Meadow | Grumpy Orc | Orc (d2) | 19 | 8 | 7 | 10 | 3 | 0 | |
| 3 | Meadow | Moon Wolf | Werewolf | 18 | 10 | 9 | 12 | 2 | 0 | |
| 3 | Meadow | Marsh Snake | Serpent (d3) | 20 | 10 | 8 | 14 | 3 | 1 | |
| 4 | Caves | Giant Spider | Giant Spider | 22 | 11 | 9 | 14 | 2 | 1 | |
| 4 | Caves | Hobgoblin | Hobgoblin | 25 | 11 | 10 | 13 | 3 | 1 | |
| 5 | Caves | Skeleton | Skeleton (d5) | 27 | 12 | 10 | 18 | 4 | 3 | |
| 5 | Caves | Lizard Warrior | Lizardman | 25 | 13 | 11 | 17 | 3 | 2 | |
| 6 | Caves | Cave Minotaur | Minotaur (d6) | 28 | 15 | 10 | 19 | 4 | 5 | |
| 6 | Caves | Green Slime | Green Slyme | 27 | 13 | 9 | 19 | 4 | 3 | |
| 7 | Caves | Dusk Mage | Dark Mage | 24 | 13 | 10 | 21 | 10 | 2 | 8, 13, 14 (10 SP) |
| 7 | Caves | Wyvern | Wyvern (d7) | 26 | 16 | 10 | 21 | 4 | 4 | |
| 8 | Swamp | Gargoyle | Gargoyle (d8) | 32 | 14 | 11 | 21 | 4 | 6 | |
| 8 | Swamp | Baby Dragon | Small Dragon (d8) | 30 | 11 | 10 | 23 | 4 | 5 | 24 (15 SP) |
| 9 | Swamp | Swamp Ogre | Ogre (d8) | 31 | 15 | 9 | 21 | 2 | 5 | |
| 9 | Swamp | Large Spider | Large Spider | 34 | 12 | 11 | 24 | 3 | 3 | |
| 10 | Swamp | Satyr | Satyr | 34 | 13 | 12 | 23 | 5 | 5 | |
| 11 | Swamp | Horse Archer | Centaur | 32 | 12 | 12 | 26 | 10 | 5 | 4, 5 (10 SP) |
| 12 | Ruins | Stone Golem | Golem | 40 | 14 | 13 | 29 | 4 | 6 | |
| 12 | Ruins | Cyclops | Cyclops | 43 | 12 | 12 | 27 | 5 | 5 | |
| 13 | Ruins | Giant | Giant | 41 | 13 | 12 | 27 | 4 | 5 | |
| 13 | Ruins | Ruin Sorcerer | Sorcerer (d13) | 42 | 11 | 13 | 28 | 6 | 6 | 6, 7, 8 (17 SP) |
| 14 | Ruins | Bandaged Mummy | Mummy | 44 | 12 | 12 | 33 | 6 | 6 | |
| 15 | Ruins | Fire Spirit | Fire Elemental | 44 | 15 | 13 | 38 | 7 | 7 | |
| 16 | Mountain | Young Dragon | Small Dragon (d16) | 48 | 14 | 13 | 39 | 8 | 7 | |
| 17 | Mountain | Rock Beast | Rock Beast | 50 | 15 | 14 | 40 | 7 | 8 | |
| 17 | Mountain | Emerald Wizard | Emerald Wizard | 50 | 16 | 15 | 43 | 5 | 5 | 4, 5, 7 (20 SP) |
| 18 | Mountain | Storm Wizard | Dark Wizard | 49 | 15 | 14 | 45 | 5 | 7 | 12, 10, 15 (30 SP) |
| 19 | Mountain | Storm Knight | Doom Knight (d19) | 41 | 14 | 13 | 43 | 4 | 8 | |
| 20 | Mountain | Ember Hound | Hell Hound (d20) | 51 | 15 | 16 | 52 | 7 | 8 | |

**Bosses** (one per zone end; first win gives a badge, a news line and a prize):

| Mine | Boss | Based on | HP | Agi | Dex | Str | Wis | Armor | Spells |
|---|---|---|---|---|---|---|---|---|---|
| 5 | Baron Moonbat | Vampire (d5) | 26 | 13 | 9 | 19 | 14 | 3 | 19 (18 SP) |
| 10 | Stone Warden | Gargoyle (d10) | 34 | 11 | 12 | 24 | 4 | 4 | |
| 15 | Ember Lord | Fire Elemental (d15), toughened | 44 | 15 | 13 | 38 | 7 | 7 | 15 |
| 20 | Emerald Dragon | Green Dragon | 53 | 15 | 14 | 54 | 7 | 9 | 17 (21 SP) |

Boss numbers at 5 and 10 are close to a normal monster of that depth, so the first two bosses are tuned up in C.1 (more HP, a spell). Ember Lord's "toughened" means +10 HP and a Lightning Bolt; I made that up, so it's a placeholder for the simulator. Monsters are picked by mine depth and your clan's levels, as the original does.

## 10. Race and class blurbs (one friendly line each)

**Races:** Human: *Good at everything, great at nothing.* Dwarf: *Short, strong and hard to knock down.* Elf: *Quick, sharp-eyed and clever.* Half-Elf: *A bit of both, steady and quick.* Halfling: *The fastest of all, with plenty of magic energy.* Orc: *Big, tough and not very clever.* Muya: *Clever and charming, but easy to knock over.* Minotaur: *The strongest, but slow and no magic at all.* Imp: *Fast on the feet and good with a fiery temper.*

**Classes:** Barbarian: *Pure muscle and tough as boots.* Warrior: *Strong all-rounder with a few battle tricks.* Martial Artist: *Fast kicks, fast feet.* Knight: *Heavily armoured and kind-hearted: heals friends.* Assassin: *Sneaky and sharp. Hits hardest from behind.* Healer: *Keeps the clan on its feet.* Sorcerer: *Flings fireballs and weakens enemies.* Necromancer: *Calls friendly spirits to help.* Wizard: *Fragile, with the biggest bag of spells.* Pirate: *Quickest of all and loaded with gold, but not much armour.* Samurai: *Balanced, fast and sharp.*

## 11. Still to do in C.0

- [x] Licence check: Kenney 1-Bit Pack page says CC0 (18 Oct 2026). Re-check at download.
- [x] Spell "Level" checked against the original's fight code: it makes tie-up and debuff spells harder to shrug off (the engine uses the original's comparison). Level up and damage use the caster's level and wisdom instead.
- [ ] Decide the Imp's starting gold and the clan's starting purse of 200 (section 5).
- [ ] Hand to James for a look, then stage C.1.

## 12. The empire (stage C.4, rules and numbers; set 18 Oct 2026, tuned with the simulator)

All of these are in `shared/clans/config.ts` under `empire`. Section 8 of the plan says what the empire is for; this is the rule book. Nothing here is saved or live yet.

**The vault.** The empire has its **own vault**. Land, buildings and troops are paid for from it, and it is the only gold a raider can take. The clan's purse (mine gold, shop, training, Church) is safe. You move gold between them with "Put in" and "Take out". (James can say if he would rather have one purse.)

**Land.** A new empire has **10 plots of wild land**. You **develop** a plot by choosing its sides (each 2 to 6 squares) and paying **2 gold a square plus 1 gold for each unit of fence round it** (a 4 by 5 plot: 20 squares and 18 fence, so 40 + 18 = **58 gold**). When the wild land is used up you can **claim** more for **50 gold, then 25 more each time** (up to 24 extra plots). A plot holds one building.

**Buildings** (size is the squares the plot must have; energy is a share of the day's worker energy; the workers have **100% a day**, and the energy is used up when you build, not after):

| Building | Size | Energy | Gold | Most | What each one does |
|---|---|---|---|---|---|
| Barracks | 15 | 30% | 100 | 12 | Holds 20 footmen, 10 axemen and 5 knights |
| Walls | 6 | 7% | 40 | 5 | Defenders take 10% less damage; raiders destroy 1 fewer building |
| Tower | 5 | 12% | 60 | 5 | Defenders hit back 10% harder |
| Steel Mill | 12 | 25% | 120 | 3 | Your raiding army hits 10% harder |
| Stables | 10 | 20% | 100 | 3 | 20% fewer of the hurt troops are lost |
| Gymnasium | 10 | 20% | 100 | 2 | The draft can go 5% higher |
| Developer's Hall | 15 | 35% | 150 | 3 | Developing land costs 10% less |

The Spy and Security buildings and the shops are left out (plan section 8). Energy examples: barracks 30% + walls 7% + tower 12% = 49%, so **51% is left**.

**Troops.** Footman **15** gold, axeman **30**, knight **60**. A barracks gives room for **20 footmen, 10 axemen and 5 knights** (each kind has its own room, so 85 footmen need 5 barracks). In a battle a footman counts **1**, an axeman **2** and a knight **4**: the same as their prices.

**The draft.** The share of new followers who join as footmen is set by the clan from **0 to 20%** in steps of 5 (a Gymnasium adds 5% to the top). Rounded up. They only join if the barracks have room; every follower is used up when you draft, and those not drafted go home.

**Battles.** A battle is settled in one go from two armies, a **battle plan** and a seed:
- The plan is **how many rounds** (1 to 5), **how hard** (Careful, Steady or Bold) and **how much loot** to ask for (5, 10, 15 or 20%; 10% at most against classmates).
- Each round both sides lose about a quarter of what they have left, by luck between 60% and 139% of the usual. **Steady** is the usual. **Careful** does 60% of the damage and takes 60% (slow, fewer troops hurt). **Bold** does 150% and takes 150% (quick, more troops hurt).
- Steel Mills add 10% to the raiders' damage each, Walls cut damage to the defenders by 10% each (so they take 1 ÷ 1.1, 1 ÷ 1.2 and so on), Towers add 10% to the defenders' damage each. Asking for more loot makes the defenders fight harder (asking 20% adds 20% to their damage).
- When the rounds are over: the **defenders give way** (the raiders win) if they are down to half strength **and** worse off than the raiders; the **raiders fall back** (lose) if the defenders are better off; otherwise it is a **stalemate** and nobody wins.
- **Hurt troops:** a quarter of the share of its strength a side lost does not come home, less 20% for each Stables. (A side that lost 40% of its strength loses a tenth of its troops.) The rest are back by morning.

**The six computer kingdoms** (they never run out: the treasury fills up again every day):

| Kingdom | Shown as | Troops (footmen / axemen / knights) | Strength | Walls / towers | Treasury | An army of this strength wins about 80% of the time |
|---|---|---|---|---|---|---|
| Bunny Hollow | an easy one | 12 / 0 / 0 | 12 | 0 / 0 | 300 | 15 |
| Pebble Bridge | quite easy | 24 / 6 / 0 | 36 | 0 / 0 | 600 | 45 |
| Hilltop Hold | a fair fight | 40 / 15 / 3 | 82 | 1 / 0 | 1,000 | 100 |
| Ironwood | a bit tough | 50 / 30 / 6 | 134 | 2 / 1 | 1,600 | 175 |
| Stormcrag | tough | 60 / 40 / 14 | 196 | 3 / 2 | 2,500 | 275 |
| Dragon's Rest | very tough | 80 / 50 / 25 | 280 | 4 / 4 | 3,700 | 440 |

A win takes the share of the treasury you asked for (rounded up). A loss takes nothing. **One raid on a kingdom a day** (the plan said once a day).

**Friendly War.** The same battle against the same kingdoms, but **nobody loses or wins anything** and it does not count as a raid, so you can try a plan as often as you like.

**Raids on classmates (rule only, no screens until C.5).** You choose to take **gold, land or buildings**. A win takes at most **10%** of the vault, or of the empty land (wild land first, never a plot with a building), or of the number of buildings (rounded up, **minus one for each Walls**, and Walls are never knocked down). The guard rails from plan section 8: no raids for the first **3 days** of a clan's life (nor on it), **1 raid a day**, not the same clan twice in a day, a **1-day shield** after being raided (it can't be raided again until the day after tomorrow), only against an empire between **half and double** your army's strength, and a teacher switch. The defender is a saved copy played by the computer with a steady plan. Both sides lose the hurt troops that don't come home. News lines say only "A raider from the Red Banner clan took 40 gold."

**Not done:** Quests (a later small stage), spies, the village chest and votes (C.6), saving the empire (C.5).

**James's answers on the empire (18 Oct 2026):** separate vault, a new clan can't raid either for its first 3 days, Gymnasium raises the draft limit, and the empire is bigger (up to 12 barracks and 24 extra plots to claim) so it takes about 4 to 5 weeks to fill rather than 3.
