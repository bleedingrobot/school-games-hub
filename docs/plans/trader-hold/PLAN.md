# Star Trader: see your hold

**Asked by James, 20 Nov 2026.** When the market is open, show a painted top-down picture of your ship with a box for every hold. Boxes fill up with what you buy. Tap or hover a box to see where that good sells best right now. Cargo pods sit alongside the ship, clamped on. The point: kids can see what they bought, what's in the hold at any time, and where to go to sell it.

**Mock-up (approved 20 Nov):** [hold-mockup.jpg](hold-mockup.jpg). First tries at the goods pictures: [goods-tries.jpg](goods-tries.jpg).

**Status:** plan merged 20 Nov (#635). H.0 pictures and H.1 hold view built 20 Nov: all 6 ships, the pod and 10 goods painted; on screens 1100 px and wider the hold floats big over the planet on the right (tried a bottom-right dock and a top-right card too; over the planet gave the biggest boxes), narrower screens keep it at the top of the market (#637, live). H.2 built 20 Nov: tap or hover a good for the two best places in reach, the gain on each against the price here, and "sell it here" when here is best; phone strip tiles open the same card (#638, live). H.3 built 20 Nov: the game keeps what you paid for the goods in the hold (`paid`, kept in step by one helper, `setCargo`); the card shows "You paid N each", gains against that, and red when selling here loses money. Next: H.4 "Show on star map". No migration expected (the game is saved as one JSON blob; see H.3).

## What it looks like

- **The ship from above**, painted, with its open cargo deck marked out as a grid: one box per hold (Firefly 20 = 10 × 2).
- **Cargo pods** (5 holds each, up to 2) are painted containers clamped to the side of the ship, one above and one below. No pods, no containers.
- **Each box shows the good's picture.** Boxes of the same good sit together, in the order of the goods list.
- **"18 of 30 holds full"** with a bar, at the top; small labels "Firefly - 16 of 20 holds", "Cargo pod - 2 of 5".
- **Tap or hover any box:** every box of that good lights up and a card shows:
  - the good, how many, and what you paid each (H.3);
  - the two best places to sell it in reach right now, with the price and the gain on each one;
  - the price here (red if it's less than you paid);
  - a "Show on star map" button (H.4).
- **The market table stays underneath, as it is now.** While you pick amounts (before pressing Trade), the boxes you're about to buy show faintly, and the ones you're about to sell fade out. Trade makes them real with a little drop-in.

## What's already there

| Need | Already in the game | Gap |
|---|---|---|
| What's in the hold | `t.cargo` (count per good), `holdsOf`, `usedHolds` (`shared/trader/state.ts`) | none |
| Pods | `t.pods`, `POD_HOLDS = 5`, `MAX_PODS = 2` | none |
| Where it sells best | `bestSales()` in `shared/trader/priceGuide.ts`: the one best planet in a full tank's reach, today's prices with the school's market | needs the top two, not one |
| Planned trade before pressing Trade | the market's `plan` and `out?.state` preview (`src/games/trader/Panels.tsx`) | none |
| What you paid | not kept: cargo is counts only | new `paid` field (H.3) |
| Ship pictures | side views in `src/games/trader/art/paint/ships/` | top-down views, pods, goods |

## Pictures (painted on James's PC)

All through `scripts/game_art.py` with a new `docs/trader-hold-art/config.json`, two styles:

- **`top`** – each ship from directly above, nose right, matching its side-view colours and shape: Flea, Gnat, Firefly, Bumblebee, Beetle, Termite (6). Each must have a clear open cargo deck. The Firefly from the mock-up is done.
- **`top`** – the cargo pod: a long open tray (try 3 from the mock-up is good).
- **`goods`** – the 10 goods as bright icons on white, cut out: Water, Furs, Food, Ore, Games, Fireworks, Medicine, Machines, Lollies, Robots. All 10 first tries are done and look right.

Each ship gets a **hold layout** in `src/games/trader/holdLayout.ts`: where the deck is on the painting (as fractions) and how many columns and rows. Pods have one layout (5 in a row). A test checks every ship's columns × rows ≥ its holds.

Pictures go in `src/games/trader/art/paint/top/` and `.../goods/` (WebP, ships about 1200 px wide, goods 128 px). Until they're in, the hold is drawn as a plain rounded ship outline with boxes and the goods as emoji, so nothing waits on art.

## Big ships

The Beetle has 50 holds and the Termite 60. On a laptop that's still fine (10 × 5 and 12 × 5, boxes about 30 px). On a phone the boxes get too small to tap.

**Decided (James, 20 Nov):** one box per hold on every ship on laptop and iPad (that's the whole idea: count the boxes). On a narrow phone, show a short strip instead: one tile per good with "× 6", and a tiny ship picture with the full bar. Tapping a tile opens the same card.

## Stages

Each stage is its own PR, merged when green, then live.

### H.0 Pictures
Art config and paint all 6 ships, the pod and the 10 goods; pick, tidy, commit. Write the hold layout for each ship from its painting. (Can run alongside H.1.)

### H.1 The hold view
- `src/games/trader/HoldView.tsx`: the ship, the pods, the boxes, the "x of y holds full" bar. Reads `t` (and the market's preview state while picking).
- Shows at the top of the market panel on both steps (Sell and Buy); replaces the plain "Holds 18 of 30 full" line there.
- Drop-in when boxes fill, fade when sold; none of that with reduced motion.
- Each good's group of boxes is one button for screen readers ("Lollies, 6 in hold").
- Drawn stand-in until H.0 lands.

### H.2 Where it sells best
- `topSales(galaxy, t, pushes, n)` in `shared/trader/priceGuide.ts` (the top `n` planets in reach for each good, nearest first on a tie); `bestSales` becomes `topSales(…, 1)`.
- The card on tap or hover: top two places, their price, and the price here. Gain shown against the price here until H.3 adds "you paid".
- Same note as the market: prices can still change before you land.

### H.3 What you paid
- `paid?: number[]` on `Trader`: total credits spent on the goods now in the hold, per good. Optional, so old saves load; until a good is bought again its "you paid" line just doesn't show.
- Kept in step everywhere cargo changes: `buy` adds, `sell` takes off the average share, customs (`settleCustoms`), pirates (`fight.ts`), the escape pod and friendly traders (`acceptDeal`) all go through one helper so `paid` can't drift. The server already replays these, so no new trust.
- Card shows "You paid 32 each" and the gain per box against that. Red when selling here would lose money.

### H.4 Show on star map
- The card's button closes the market, opens the star map and pulses the chosen planet, with the route if it's in reach.

### H.5 Phones, Bolt and news
- The narrow-phone strip (see Big ships).
- Bolt's hints (H.1 to H.5 of the hints plan) point at the hold card where they now talk about where to sell.
- A "What's new" line: "Star Trader: see your hold – tap a box to find where it sells best."
- Screens checked at phone, iPad and laptop.

## Tests

- `holdLayout`: every ship's grid fits its holds; pods fit 5.
- `topSales`: order, ties, nothing in reach.
- `paid`: buy, part sell, customs, pirates, escape pod, friendly trader; old save with no `paid`.
- `HoldView`: right number of filled and empty boxes for ship + pods; preview boxes while picking; card opens on tap.
