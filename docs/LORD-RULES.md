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
| Player fights | Lose gold and exp | Arena (later): losing costs nothing | Plan section 11 |
| Kindness | "Charm", mostly romance | Kindness: small events reward it; 1% off shop prices per point, up to 10% | Plan section 15 |

## Kept out for good

Romance, marriage, children, orphans, drinking, gambling, student-written text, killing sleeping players, gory death lines, and free-text anything. LORD's backstory (the dragon eats the village's children) is replaced: ours steals the treasure, the food and the light.

## The curve

`tierPower(level) = 10 × 1.5^(level − 1)`: 10, 15, 23, 34, 51, 76, 114, 171, 256, 384, 577, 865. Everything is a multiple of it:

- Hero base stats on reaching a level: HP `1.2 × tier + 8`, strength `0.4 × tier + 6`, defence `0.1 × tier + 1`.
- Gear for level *n*: weapon power `0.6 × tier`, cost `6 × tier`; armour power `0.2 × tier`, cost `4 × tier`. Twelve of each, the first free.
- Monsters (5 variants a level, weakest first): HP `(1.5 + 0.3v) × tier + 4`, strength `(0.26 + 0.04v) × tier + 2`, gold `(0.8 + 0.14v) × tier`, exp `(0.7 + 0.12v) × tier`.
- Masters (reaching level *n*): HP `4.2 × tier(n−1) + 10`, strength `0.55 × tier(n−1) + 4`.
- Exp to challenge: running total of 14 average fights a level.
- Dragon stages: HP `3.4 × tier(12)`, strength `0.5, 0.6, 0.7 × tier(12)`.

## Pace (simulator, 200 seasons each, 18 Oct 2026)

A simple pupil: attacks, uses class skills, heals below 40% HP, buys the best gear it can, tries its master every day.

| Pupil | Level 12 | Beats the dragon in the season |
|---|---|---|
| Plays every day | day 18, week 3 | 100% (25-40% of tries; it can try again next day) |
| Plays 4 days a week | 18th play day, calendar day 30, week 5 | 99% for Knight; Mage and Trickster a little lower |
| Plays 2 days a week | does not get there; level 6 or 7 by the end | |

Also: about 2% of forest fights are lost, a master is beaten on about 64% of tries, a fight lasts about 3 rounds, healing eats about 40% of gold, and all three classes finish within a play day of each other. To see it all: `npm run lord:sim`.

## Still to settle (later stages)

- Ten monsters a level (five written so far), more events, and the gem shop (L.1 follow-up and L.3).
- Whether 2-days-a-week pupils should be able to finish. They reach level 6 or 7 in a season; Practice Mode, a bigger daily allowance for the teacher or a shorter first season could change that. James's call.
- Kenney 1-Bit Pack and VT323 font licences: check again when the screens start (L.3).
