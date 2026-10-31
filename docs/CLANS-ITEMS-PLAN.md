# Clan Quest: items and Market plan

*Written 1 November 2026 from the code on `main` (5ca810f). Stage 1 (rules, Market, server) is built on branch `clans-items`; see "Stage 1 results" at the end. The pictures are stage 2.*

## What James asked for

1. Review the items: the stats they give are strange.
2. Remove "Look closely" (paying to see an item's real stats).
3. One maths question when buying, worth a 10% discount.
4. Remove the recommendations / "which is the better buy?" part.
5. Give each class a clear line of weapons, armour and shields, shown so pupils can see the next upgrade and buy and wear it in one tap.
6. Items give each class's recommended stats, plus a few others that still help.
7. New art is fine where it is needed, painted on the gaming PC.

**James's decisions (1 Nov 2026):** a full line for every class (not three shared families); pupils may buy any tier the Smithy sells (skip ahead); the question is "What is 10% of the price?"; items may add max HP and SP.

---

## 1. Review: what is wrong with the items today

The 34 items were copied from the old game's numbers (`shared/clans/gamedata.ts`). How the stats work in a fight (`shared/clans/fight.ts`):

| Stat | What it does |
|---|---|
| Strength | Damage = half strength, minus the target's armour |
| Dexterity | Chance to hit (against the target's agility) |
| Agility | Who goes first, and dodging |
| Armour | Takes 1 off every hit (very strong: +1 armour is worth about +2 strength) |
| Wisdom | Spells: how strong, and whether they land |
| Charisma | Nothing in fights. Only opens some quest choices |

The problems:

- **Price doesn't match power.** The Staff (13 gold) gives Strength +5. The Shortsword (65 gold) gives Strength +5 and Agility −1. The Great Axe and the Axe cost the same, but the Great Axe is better. The Thunder Axe (150) is about the same as the Battle Axe (75). Hero's Armour (225) gives the same armour as Platemail (55). The Lion's Shield (70) is the Iron Shield (25) without the minus.
- **One item breaks the game.** The Sky Sword gives Strength +22. The next best weapon gives +9.
- **"Needs" make no sense.** The cheapest weapon, the Knobbly Club (10 gold), needs Agility 7, Dexterity 9 and Strength 8: harder to use than the Sky Sword. The Axe needs Strength 13, which almost no level 1 member has. If a member doesn't meet the needs the item **silently does nothing**, which is why "Look closely" had to exist.
- **Minuses everywhere.** Most weapons and armour take away agility or dexterity. Pupils can't tell if an item is an upgrade without doing sums.
- **Nothing for spell casters.** Healers, Sorcerers, Necromancers and Wizards fight with wisdom, but there are only two wisdom items (Wand, Wizard's Staff), and both need Wisdom 11. Shields all need Strength 7 to 13, so casters can't use any.
- **No order to follow.** Items unlock by Smithy level in a muddle (the Knobbly Club and Great Axe appear late; the Staff early), so there is no "next one up".

---

## 2. The new items (built)

All in `shared/clans/items.ts`. Every class has its own line: **7 weapons** (tier 7 is the class's own top weapon), **6 armours** and **6 off-hand items** (a shield in the code; on screen it's Shield, Bracers, Gloves, Buckler, Fan or Charm by class). 11 classes × 19 = **209 items**.

- **Recommended stats.** Each class's (R) stats (`CLASS_FOCUS`, moved from the Training Hall's text into shared code so both use the same list) are what its items give. A weapon mostly gives an (R) stat; armour and off-hand items mostly give armour or an (R) stat; every item gives at least one (R) stat, plus a smaller helpful extra. Between a class's line and its top weapon, every one of its (R) stats is covered (a test checks).
- **HP and SP.** Items may add max HP and SP (armour for the front-liners, charms and staffs for casters). Wearing an item adds them to the member's max; swapping it out takes them off (`wear`).
- **No minuses, no "needs".** If you can buy it, it works. Every tier is at least as good in every stat as the one before and better overall (a test checks).
- **Numbers from ladders.** Each class line names which stats grow on which ladder, so the whole shop is tuned in one place.

### Prices (after the simulator)

| Tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Weapon | free | 20 | 50 | 90 | 160 | 260 | 450 |
| Armour, off-hand | free | 20 | 40 | 70 | 120 | 200 | |

The first guesses were about twice this. With them, the computer clans in the simulator spent so much on gear that by day 21 their army was half as strong (might 149 against 287 with the old items) and the village filled 3 days later. At these prices: might 276, village full on day 20 (as before), and a little more gold kept back. Mine win rates are slightly up (balanced 99% vs 97%, fighters 83% vs 77%).

### What the Smithy sells (`SMITHY_TIERS`)

| Smithy level | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Up to tier | 2 | 3 | 4 | 5 | 6 | 6 | 7 (top weapon) |

Tier 2 is on sale from the start because everyone already wears tier 1; the top weapon needs a fully built Smithy.

### Old saves

`refreshGear` runs on every load. A save from before the class lines (no `gearVersion`) has each old item swapped for the same slot's item in the member's own line, at the tier its old price was worth (`OLD_ITEM_TIERS`), and empty slots get tier 1. After that, a member who picked a new class at a new season has their gear moved to the same tier of the new line. Nobody loses gear. No database change.

### Quests

The two quests that found an item now give the finder tier 2 in that slot of their own line, or half its price in gold if everyone already has that or better.

## 3. The Market screen (built)

One card per member. Each slot shows what they wear, a row of dots (how far along the line), the **next item** with what it adds ("Strength +4 → +7 (R)") and **Buy · price**. If the Smithy doesn't sell it yet: "Needs the Smithy at level N". "See all" opens the whole line, where any tier the Smithy sells can be bought.

Buying asks one question: *"The Oak Staff costs 50 gold. What is 10% of 50?"* Right: 10% off. Wrong or "Show me how": the full price. The item is bought either way. The server asks the same question again from the price and marks the answer (`earnedDiscount`); with percentages switched off for the class there is no question and no discount.

Gone: Look closely, the shelf tabs, ✓ marks, Which is the better buy?, the village tax on items, Check my change. **Monster supplies are unchanged** (still taxed, still "check the bill").

## 4. Pictures

33 of the old 34 paintings are used again (the five armours renamed from "armor" to "armour"; the plain Axe is now only a stand-in). **176 items need a painting.** Until each has one, it borrows the nearest painting in its slot by the words in its name (`ITEM_STAND_INS` in `art.ts`); charms, bracers, fans and gloves show the old tile.

Painted on the gaming PC with `scripts/clans-item-art.py` (paint, contact sheets, tidy into 200 px cut-outs), words in `docs/clans-art/item-descriptions.json`, picks in `docs/clans-art/item-picks.json`.

## 5. Stages

1. **Rules, Market and server.** Done (below).
2. **Pictures:** paint the 176 on the gaming PC, check every try is right for children, James picks.
3. **Go live:** merge the branch (the clans function redeploys itself when its `index.ts` changes). James's word first.

## Stage 1 results (1 Nov 2026)

Branch `clans-items` (worktree `~/games-hub-clans-items`), from `main` at c9bf698.

- Built everything in sections 2 and 3. Server: the `buy` action takes an optional `answer`, the result says whether the discount was given, the `examine` action and the `examined` list are gone (an old page sending `examine` is refused as an unknown action). `supabase/functions/clans/index.ts` rebuilt.
- Tests: new `shared/clans/items.test.ts` (lines, no minuses, each tier better, round-ten prices, (R) stats covered, Smithy table, starter gear, HP/SP, old-save conversion, class change). Market, quest, shop, season and art tests rewritten. `npm run typecheck`, `npm run test:all` (331 files, 5783 tests) and `npm run build` pass.
- **Not tested yet:** the Market in a real browser at Chromebook and phone sizes; the preview pages; a real old save loading on the server.
- **Go-live list:** merge `origin/main`, re-run the checks, merge the PR (the clans function deploys itself). No migration.
