# Dragon Maths: rule sheet (L.0)

Every rule and number in the game, which ones come from *Legend of the Red Dragon* (via LORD.ts), and where we changed it on purpose. The code is in `shared/lord/` (numbers in `data.ts`, rules in `engine.ts`). Pace is checked with `npm run lord:sim`. Plan: [LORD-PLAN.md](LORD-PLAN.md).

No LORD.ts code or text is copied (it is GPL-3). Rules and numbers are not owned the same way; we credit LORD and LORD.ts for them.

## From LORD

| Rule | In the game |
|---|---|
| Daily turns | 10 forest fights and 3 arena fights a day; they come back on the first play of a new New Zealand day and do not pile up |
| 12 levels, then the dragon | Same. A master stands between each pair of levels |
| Exp is never spent | You need enough **total** exp to challenge your master. Losing to a master costs nothing |
| Masters | One try a day. Win: next level, more strength, defence and HP, full heal |
| Damage | Random half of your strength plus the other half. Monsters have no defence; your defence takes off a random 0 to defence from each hit |
| Monsters | Mostly your level, 1 trip in 6 a level lower |
| Forest events | 1 trip in 5 is an event, and **events do not use up a fight** |
| Healer | Pay gold per HP. All HP comes back free on a new day |
| Bank | Banked gold is safe when you lose |
| Shop | Selling your old gear gives half back. The best gear needs enough base strength or defence, which comes from beating masters |
| Run away | Works most of the time (65%), never from masters or the dragon |
| Classes | Three, with a few skill uses a day |
| Dragon | Found at level 12 after the last master. Winning gives a star and starts you again |

## Changed on purpose

| Thing | LORD | Ours | Why |
|---|---|---|---|
| Numbers | Gold in the hundreds of millions | Gold and prices ÷ 100 and rounded to two significant figures; dearest item 5,200 | Sums for a 9-year-old |
| Exp curve | 100, 400, 1,000, 4,000 ... 10,000,000 (about 157 days to level 12) | About 14 fights a level, built from the monsters' own exp | A 5-week season (see below) |
| Losing a forest fight | Lose all gold and 10% exp, dead till tomorrow | Lose carried gold only, keep exp, wake at the healer with 30% HP and keep playing | James, question 3 |
| Bank interest | 10% a day, automatic | None; the economy is tuned without it. An optional maths bonus is possible later | Plan section 15 |
| Classes | Death Knight, Mystic, Thief | **Knight** (Power strike, double damage), **Mage** (Zap, a fixed 1.5 × attack; Mend, heal a quarter), **Trickster** (Dodge, the next hit misses and you hit back; Pinch, a normal hit and a quarter of the monster's gold). 3 uses a day | Kid-friendly; balanced by the simulator, all three finish within a day of each other |
| Healer price | 5 × level per HP | `round(level × 0.25)` per HP, at least 1 | Healing ate 55-60% of gold at the first try; now about 40% |
| The dragon | One 15,000 HP fight; 3 kills end the game for everyone | Three stages, a breather between them (30% HP back); no game-ending kill, seasons instead | Plan section 9 |
| Seasons | Optional tournament mode | 35 days; every hero starts again; stars and the Hall of Heroes are kept | James, 18 Oct |
| Player fights | Lose gold and exp | Arena: the computer plays both heroes, losing costs nothing, a classmate's hero is only a copy | Plan section 11, "The arena" below |
| Kindness | "Charm", mostly romance | Kindness: small events reward it; 1% off shop prices per point, up to 10% | Plan section 15 |

## The arena, the computer heroes, news and points (L.5)

- **The arena:** 3 a day (they don't pile up). The server picks an opponent within one level of yours (or the three closest if nobody is): a saved copy of a classmate's hero (this season, never hidden, never yourself) or one of the eight computer heroes. Both heroes start at full health; the computer plays both sides for up to 30 rounds, you first. A hit is LORD's damage roll minus a random 0 to the other hero's defence (defence counts on both sides in player fights), at least 1. In round 2 each hero uses its class move once for free (Knight: double hit; Mage: 1.5 × attack, no roll; Trickster: the next hit misses). If it isn't over after 30 rounds the larger share of health left wins. The duel is seeded, so the two heroes and the seed play it again exactly (stored in `lord_fights`).
- **Win:** `round(0.5 × tierPower(level))` experience (about half a forest monster). **Lose:** nothing, no health, no gold, no exp. A classmate's real hero is never touched.
- **Computer heroes:** Sir Gareth, Dame Maple, Old Bram, Lady Wren, Captain Flint, Wizard Pim, Sister Hazel and Big Mort. Each is one whole season played by the same simulator that tunes the pupils' pace (a steady 2 to 7 days a week), so they level up by beating real masters, buy gear, and now and then beat the dragon and start again. They are worked out from the season number, never stored, and clearly labelled "computer hero" everywhere.
- **Daily News:** one village line a day (a little life, often with a number in it; nothing about the day changes), what the computer heroes did, and lines about pupils from things the server accepted: a master beaten, the dragon beaten, an arena win, being flattened by a monster. One line per pupil per kind per day. All written by the code; `{p}` is filled in with the hub name when read. Hidden profiles leave no lines. Kept 30 days, shown for 3.
- **Warriors list:** this season's heroes, ordered by dragons beaten this season, then level. Hub name, avatar, level, stars. Top 10 plus you. Never maths. **Hall of Heroes:** who beat the dragon in each season and how many times, kept for good.
- **Points** (`lord_point_rules()`): 1 for every 3 forest fights won, 3 for beating a master, 10 for beating the dragon. Inside the 40-a-day limit every game against the computer shares. Arena fights and maths answers earn none. A new points season clears them; heroes, stars, the Hall and the achievements stay.
- **Achievements (8):** first master, level 6, level 12, beat the dragon, beat it twice, 50 forest wins, 10 arena wins, 50 riddles and puzzles. They read counts the server keeps for each pupil over all seasons.
- **A fight left alone for a whole day** (handed out two or more New Zealand days ago) counts as a loss, the soft kind: a forest fight drops the gold carried and wakes you at the healer; a master fight heals you (the day's try stays used); a dragon fight sends you home.
- **Saved-up turns:** unused forest fights pile up for missed days (two days' worth at most); a missed day saves up an extra master try (two at most). See Pace.
- **The season pause:** switching the game off pauses the season clock; switching it on moves the start date forward by the days it was closed.

## Kept out for good

Romance, marriage, children, orphans, drinking, gambling, student-written text, killing sleeping players, gory death lines, and free-text anything. LORD's backstory (the dragon eats the village's children) is replaced: ours steals the treasure, the food and the light.

## The curve

`tierPower(level) = 10 × 1.5^(level − 1)`: 10, 15, 23, 34, 51, 76, 114, 171, 256, 384, 577, 865. Everything is a multiple of it:

- Hero base stats on reaching a level: HP `1.2 × tier + 8`, strength `0.4 × tier + 6`, defence `0.1 × tier + 1`.
- Gear for level *n*: weapon power `0.6 × tier`, cost `6 × tier`; armour power `0.2 × tier`, cost `4 × tier`. Twelve of each, the first free.
- Monsters (10 a level, weakest first; `v` runs from 0 to 4 across them): HP `(1.5 + 0.3v) × tier + 4`, strength `(0.26 + 0.04v) × tier + 2`, gold `(0.8 + 0.14v) × tier`, exp `(0.7 + 0.12v) × tier`.
- Masters (reaching level *n*): HP `4.2 × tier(n−1) + 10`, strength `0.55 × tier(n−1) + 4`.
- Exp to challenge: running total of 14 average fights a level.
- Dragon stages: HP `3.05 × tier(12)`, strength `0.43, 0.51, 0.59 × tier(12)`.

## Pace (simulator, 200 seasons each, 18 Oct 2026, with the arena and saved-up turns)

A simple pupil: attacks, uses class skills (3 uses a day, shared across all three dragon stages), heals below 40% HP, buys the best gear it can, tries its master every day, answers maths questions right 70% of the time, and wins about half of three arena duels a day against a hero of its own strength.

| Pupil | Level 12 | Beats the dragon in the season |
|---|---|---|
| Plays every day | day 16, week 3 | 100% (about 35% of tries; it can try again next day) |
| Plays 4 days a week | 14th play day, calendar day 23, week 4 | 91% to 100% (Trickster the lowest) |
| Plays 2 days a week | reaches level 12 in 32% to 46% of seasons (level 10 or 11 otherwise) | 6% to 9% |

**Saved-up turns (James, 18 Oct: a pupil who plays twice a week should be able to reach the dragon).** Forest fights you didn't use pile up for the days you missed, up to two days' worth (20 on a play day after a break). A missed day also saves up an extra master try, up to two (spent before the day's try, win or lose). Arena fights, skills and health don't pile up. Nothing changes for a pupil who plays every day or most days (the numbers above for them are the same as before). A 2-days-a-week pupil went from level 8 to level 10 or 11, and about 4 in 10 now reach the dragon, but only about 1 in 12 beat it before the season ends: they arrive late and get few tries. That's still a stretch for a very casual pupil, and is what the arena plus saving up can honestly do without making the game short for everyone. Before the saving up, the wall was the one master try a day: 10 play days is at most 10 tries.

Also: about 2% of forest fights are lost, a master is beaten on about 61% to 73% of tries (less for a casual pupil who rushes), a fight lasts about 3 rounds, healing eats about 45% of gold, and all three classes finish within a play day of each other. To see it all: `npm run lord:sim`.

## The dragon and the maths (James, 18 Oct: "a fight, not a test")

Each riddle before a dragon stage gives a **small** bonus for a right answer: a shield of `0.02 × tier(12)` (17) and a ×1.2 first hit (half of that after a hint). A wrong answer gives nothing and the fight goes on. With the best gear and class skills, a Knight wins about **16%** of tries with no right answers and about **45%** with every answer right (Mage 9% and 60%, Trickster 11% and 27%). A simulated pupil who answers 70% right wins about 35% of tries as Knight or Mage and about 22% as Trickster, and can try again each day. Gear and skills decide it; maths nudges it. The Trickster is the weakest against the dragon and could use a small buff later.

## Still to settle (later stages)

- The gem shop (2 gems for a permanent +1 strength, defence or HP), and more events when pupils have played.
- 2-days-a-week pupils now often reach the dragon but rarely beat it in the first season (see Pace). A longer first season or Practice Mode could help. James's call, after real pupils have played.
- Kenney 1-Bit Pack and VT323 font licences: check again when the screens start (L.3).
