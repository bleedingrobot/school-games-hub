# Star Trader: in-game hints plan

Written 1 November 2026 for James, the day Star Trader went live, after reading every screen of the game (`src/games/trader/`) and its rules (`shared/trader/`).
**Status: H.1, H.2 and H.3 built 1 Nov 2026 on branch `trader-hints` (sections 12 to 14); not merged or live. H.4 and H.5 not started.** Branch to use: `trader-hints`. Everything stays inside `src/games/trader/`: **no server change, no migration, no shared files** (one optional server change is in section 9, and it can wait).

## The short version

- **The game is good, but a 9-year-old opening it lands on a 10-row, 6-column price table with nothing to tell them what to do.** The idea "buy here, fly there, sell for more" is never said out loud, and what you need to make that choice is spread over three screens (the market, the star chart and a planet's card).
- **The fix is a ship's robot called Bolt** who teaches by getting the pupil to *do* the real thing, not by showing slides. Bolt works in four layers:
  1. **First Flight:** a guided first trip, about 3 minutes. Bolt picks a trade that is sure to make money, lights up each button in turn, and celebrates the first profit.
  2. **Next step:** one always-there line ("Fly to Mars at (4, −2) and sell your Water there") that works out the single best thing to do from the game as it stands. "Show me" lights up the button.
  3. **First-time tips:** a short Bolt bubble the first time something new happens: pirates, space junk, customs, a friendly trader, the shipyard, the bank, the maths check, running out of jumps.
  4. **Help with choices:** at each real decision (which good, is this deal good, fight or flee, is it safe to jump with this cargo, should I borrow) Bolt shows the numbers and gives an opinion, and shows the working so the pupil learns why.
- **Help fades as the pupil gets better.** Lots of help on day 1, less after about 30 jumps, and a quiet "ask Bolt" button after that. The pupil can choose "Lots / Some / Off" at any time and replay First Flight from the title screen.
- **Bolt never blocks and never decides for them.** Every bubble can be closed, every suggestion ignored, and a pupil who already knows the game can skip it all with one tap.
- **Bolt never does the maths questions for them.** The hints explain the trading. Maths questions stay the pupil's own work, as now.
- **Size:** about the size of stage T.2. Five small stages (section 10), each with tests and a stop for James. Section 11 lists the questions for James.

## 1. Where kids get stuck (a walk through the game as it is)

What a pupil meets, in order, and what goes wrong. Each row says which part of the plan fixes it.

| # | Moment | What the game does now | Why a 9-year-old gets stuck | Fixed by |
|---|---|---|---|---|
| 1 | Title screen | One paragraph, then "Start trading" | Read once, then forgotten. No "how" | First Flight (2.1) |
| 2 | First screen | The Market: 10 goods × buy price, sell price, stock, hold, and the − / + buttons | Too much at once. Which one? How many? Two prices per good: which one is mine? | First Flight picks a good and lights up one row (2.3) |
| 3 | Buy price vs sell price | "You buy at" and "You sell at" columns | Kids mix them up, and the gap (buying costs about 9% more) makes them think they lost money straight away | Tip on the column headings; Bolt says "you buy at the left price" (5.1) |
| 4 | − and + buttons | − sells, + buys; "All" sells everything, "Max" buys as many as fit | The heading says "Buy / sell" but the buttons go sell (left) then buy (right). "All" and "Max" don't say which way they go | Small wording fixes (7) |
| 5 | Which good to buy | "cheap" / "dear" tags and "Sells best: Mars 12 (+4 each)" under some goods | The best hint in the game, but in small grey text. Nothing says *this one is the best trip from here* | ⭐ Best buy (5.1) and the next-step line (3) |
| 6 | Pressing Trade | Sometimes a maths box pops up | A surprise the first time. "Do I have to? Will I lose?" | First-time tip in the box's own note line (4) |
| 7 | After buying | Nothing happens; the pupil is still on the Market | Doesn't know the next step is the Star chart | Next-step line: "Now open the Star chart" (3) |
| 8 | Star chart | Grid from −10 to 10; type x and y to jump | Typing coordinates is the maths learning (James, 22 Oct), so we keep it. But: where is the planet that wanted my Water? Tapping it doesn't fill the boxes (on purpose), and negative numbers are new to many | Bolt lights up the planet to go to, and draws "read across, then up" guide lines the first few times (5.3) |
| 9 | Jump button greyed out | Greyed out for 5 different reasons (no planet picked, already there, too far, not enough fuel, no jumps left) | A greyed-out button with no reason given | Bolt says the reason and lights up the fix (3) |
| 10 | Landing | Back on the Market | Forgets to sell; or sells somewhere that pays less than where they bought | "Sell your Water here: this is the best price nearby" (3); a trip summary of the profit or loss (5.6) |
| 11 | Space junk | "Steer through" asks a maths question | Fine, but a bit scary the first time | First-time tip (4) |
| 12 | Friendly trader | "They will sell you 8 Ore at 30. On this planet Ore costs 36. Is that a good deal?" | Buying cheaper is good, but selling *dearer* is good. Kids get the direction wrong. Also: does it fit in the hold? Can I pay? | Deal helper with the working (5.4) |
| 13 | Pirates | Charge / shields / flee. The Flea has no laser | Which button? What do shields do? Is 70% good? | Fight helper suggests a button and says why (5.5) |
| 14 | Customs | Banned goods taken and a fine, *after* the jump | The warning was only on the planet card on the star chart. Feels unfair | Warning *before* the jump (5.3) |
| 15 | Shipyard | Fuel, repair, 5 ships, 5 gear items, cargo pods, the moon, all on one screen | No idea what to buy first, or that only some planets have a shipyard | First-time tour; next step points to the right upgrade at the right time (3, 5.2) |
| 16 | Bank | Borrow 100 to 500 | Free money? Kids borrow without a plan | First-time tip and "a loan is only good if you have a trade to spend it on" (5.7) |
| 17 | The goal | The moon (20,000) is only shown at a shipyard | Pupils don't know what they're saving for, or how close they are | A moon progress bar in the top strip (7) |
| 18 | Out of jumps | A note on the screen | OK, but cargo still in the hold is a worry | Tip: "Your cargo stays safe overnight" (4) |
| 19 | Words | holds, hull, tech level, cr, credits, customs, bounty | Words kids don't know | Bolt's word list in the help panel (6) |

## 2. Layer 1: First Flight (the guided first trip)

**Who gets it:** a pupil whose game has `stats.jumps === 0` (this comes from the server, so it follows the pupil to any Chromebook) and who has not done or skipped it on this device. A "Replay First Flight" button on the title screen and in Bolt's help panel lets anyone do it again.

**How it feels:** Bolt's bubble sits at the bottom of the screen. One thing at a time is lit up (a glowing outline and a gentle pulse; no pulse with "Less movement"). The rest of the screen stays usable: it's not a locked tour, the pupil presses the real buttons, and their real game moves on. Every bubble has "Skip First Flight".

**It follows the game, not a script.** Each step has a "done when" test on the game itself. If the pupil does things in a different order (buys before Bolt asks, or opens the chart early), First Flight jumps to the step that fits. It can never get stuck waiting for a button the pupil has already pressed.

### 2.1 The steps

Numbers below are examples; the real ones come from the pupil's galaxy.

| Step | Bolt says (short, kind, plain) | Lit up | Done when |
|---|---|---|---|
| 1. Hello | "Hi! I'm Bolt, your ship's robot. Traders get rich like this: **buy** something where it's cheap, **fly** to a planet that pays more, and **sell** it. What's left over is your profit. Save 20,000 credits and you can buy your own moon!" | nothing | "Let's go" pressed |
| 2. Your ship | "Up here is your ship's dashboard. 💰 is your credits: you have 100. ⛽ is fuel. 🚀 shows the 10 jumps you have today." | the top strip, one item at a time | "Got it" |
| 3. Pick a cargo | "This is the market. I've found a good first trade: **Water** costs **8** here, and **Mars** pays **12**. That's **4 profit on every one!** Press **Max** to fill your hold." | the Water row and its Max button | the plan buys some Water (any good counts, if they choose their own) |
| 4. Check the bill | "This line shows what you'll spend and how many credits you'll have left. Happy? Press **Trade**. Sometimes a maths check pops up first: get it right for a small discount. Getting it wrong costs nothing." | the total line, then Trade | the hold has cargo |
| 5. To the chart | "10 Water on board! Now let's fly it to Mars. Open the **Star chart**." | the Star chart tab | the chart is open |
| 6. Find Mars | "There's Mars, ringed in yellow. To jump, type where it is. **x** is how far across, **y** is how far up or down. Follow the dotted line down from Mars to read x, then across to read y." | Mars, with guide lines to both axes, then the x box | x and y point at Mars (or any planet they choose) |
| 7. Fuel and jump | "Mars needs 6 fuel and you have 20. Press **Jump!**" (If fuel is short: "You need 3 more fuel. Press **Buy 3 fuel** first.") | the fuel line, then Jump! | the jump is done |
| 8. Sell | "Welcome to Mars! It pays **12** for Water. Press **All** to sell all of it, then **Trade**." | the Water row's All button, then Trade | the Water is sold |
| 9. Profit! | "You paid 80 and sold for 120. That's **40 credits profit!** 🎉 That's trading. Now try one yourself: find something cheap, check where it sells best, and fly there. I'll keep giving you a next step at the top." | the credits in the top strip | "Thanks, Bolt" |

- **Picking the first trade (step 3):** a pure function `starterTrade(galaxy, t, pushes)` in `advice.ts` (section 8). For each good on sale here it takes the best price within a full tank (`bestSales`, already in `shared/trader/priceGuide.ts`), works out how many the pupil can buy (credits, holds and stock) and the total profit. It picks the biggest profit, preferring a planet with **no ban on that good**, **few pirates** (government pirates ≤ 3) and **enough fuel without buying more**. Tested on many seeds: there must always be one (the T.4 test already checks "at least one profitable trade from the start").
- **If an encounter happens on the first jump** (about 1 in 3), First Flight waits, the first-time tip for that encounter shows (section 4), and First Flight carries on at step 8 afterwards. Section 9 has an optional server change to make the first two jumps calm.
- **If the pupil sells somewhere else** or the price moved (other pupils traded), step 9 says what happened honestly: "You made 25 credits profit" or "Prices moved, so you lost 5 this time. It happens to every trader, and the next trip will be better."
- **Skipping:** "Skip First Flight" asks once, "Sure? You can replay it from the title screen", then turns on the next-step line straight away.

## 3. Layer 2: the next-step line

A slim bar just under the tabs, with Bolt's face and one sentence. It is worked out fresh from the game every time something changes, by a pure function `nextStep(view)` (section 8). This is Clan Quest's `nextVillageStep` idea (`src/games/clans/nextStep.ts`) brought to Star Trader, but copied, not imported.

- **"Show me"** lights up the button the sentence is about (switching tab if needed).
- **One sentence, one action, always a real number or name** ("Fly to Mars at (4, −2)", not "go somewhere better").
- It hides during encounters (those panels have their own helpers) and while a maths question is open.

### 3.1 The order Bolt checks things in (first match wins)

| # | When | Bolt says | Show me lights up |
|---|---|---|---|
| 1 | A jump was refused or the Jump button is greyed out on the chart | The reason, in words: "Mars is 23 away but your tank holds 20. Stop at Ceres first." / "You need 3 more fuel." / "You've used all 10 jumps today." | the fix (Buy fuel, a stopping planet) |
| 2 | Hold has cargo, and **this planet pays the best price within reach** for it | "Sell your Water here. This is the best price nearby (12)." | the good's All button |
| 3 | Hold has cargo, and somewhere in reach pays more | "Fly your Water to **Mars** at **(4, −2)**. It pays 12; here pays 9." | the Star chart tab, then Mars |
| 4 | Hold has cargo that is **banned** at the planet the pupil has typed in | "Careful! Mars bans Lollies. Customs will take them. Sell them first or pick another planet." | the Lollies row / the planet card's ban line |
| 5 | Hull below half | "Your hull is getting low. Mend it at the Ship tab before pirates find you." (Or "…at the next planet with a shipyard: Ceres.") | Mend the hull |
| 6 | Fuel is too low to reach the planet in the best trade | "Fill up first: Fill the tank costs 5 credits." | Fill the tank |
| 7 | At a shipyard with spare credits, and the next upgrade on the ladder (3.2) is affordable while still leaving enough to trade | "You can afford a cargo pod (100). It adds 5 holds, so every trip earns more." | that Buy button |
| 8 | Hold has free space and a profitable buy is here | "⭐ Best buy here: **Food** (costs 15, Ceres pays 21, **+6 each**)." | the Food row |
| 9 | Nothing worth buying here | "Nothing here is a good buy today. Fly somewhere busier: Ceres has cheap Ore." | the Star chart tab |
| 10 | No jumps left | "That's all your jumps for today. Your cargo is safe overnight. Come back tomorrow!" | none |
| 11 | Credits ≥ the moon price | "You have enough to buy your moon! Find a planet with a shipyard." | the moon's Buy button |

### 3.2 The upgrade ladder (for row 7)

From the config (`SHIPS`, `WEAPONS`, `SHIELDS`, `POD_PRICE`), never typed in. Only suggested when the pupil would still have at least one full hold's worth of trading money left afterwards, so they never spend themselves stuck.

1. Cargo pods (100 each, +5 holds), up to 2 on the Flea. More holds is the fastest way to earn more.
2. Gnat (400 after trade-in) once credits allow, because the Flea can never fit a laser.
3. Pulse laser (80), so pirates can be fought, not just fled.
4. Firefly, then a shield; then Bumblebee; then the big haulers (Beetle or Termite) for pupils saving for the moon.

Bolt only *suggests*. The Ship tab still lets pupils buy anything.

## 4. Layer 3: first-time tips

A Bolt bubble the **first time** each thing happens, closed with "Got it". Seen tips are remembered (section 8). Each is two or three short sentences at most.

| Tip | When | Bolt says |
|---|---|---|
| Maths check | first "Sharp trader check" | Uses the box's own note line (the `note` that `useAsk` already passes to `QuestionModal`): "Get it right for a small discount. Wrong costs nothing, and No thanks skips it." |
| Space junk | first junk | "Rocks ahead! Answer the maths check to steer round them. If you bump one you just lose a little hull, which you can mend at a shipyard." |
| Friendly trader | first offer | "A trader wants to do a deal. When **buying**, a lower price is good. When **selling**, a higher price is good. I'll help you check." (The deal helper, 5.4, is shown too.) |
| Pirates | first fight | "Pirates! ⚡ **Charge** fires your lasers (you need a laser). 🛡️ **Shields** soak up their shots. 💨 **Flee** tries to escape. If they win, they take some cargo, never your credits." |
| Pirates, no laser | first fight in a ship with no laser | "Your Flea has no lasers, so you can't fire. Fleeing works 7 times in 10. That's your best move." |
| Customs | first customs stop | "Customs took the banned goods. Each planet's card on the Star chart shows what it bans. From now on I'll warn you before you jump." |
| Wrecked | first escape pod | "Your ship was wrecked, but the escape pod worked! You kept every credit, and here's a free Flea. Lots of great traders start again." |
| Robbed | first robbery | "They got some cargo, but your ship and credits are safe. A laser and shields make pirates easier." |
| Shipyard | first open of the Ship tab at a shipyard | A three-stop tour: "Fuel and mending are here" → "Bigger ships carry more cargo" → "And this is the moon you're saving for." |
| No shipyard | first open of the Ship tab where there isn't one | "No shipyard here: they're only on planets of tech level 4 or more. You can still buy fuel." (The panel already says this; Bolt adds a nearby shipyard: "Ceres has one.") |
| Bank | first open of the Bank tab | "A loan gives you credits now. Once a week the bank adds 10% of what you borrowed. A loan only helps if you've got a good trade to spend it on." |
| First borrow | first press of a Borrow button | A one-time "Sure?" with the sum: "Borrow 300 now. After a week you'll owe 330. Part of each sale pays it back." [Borrow] [Not now] |
| News | first day with school news | "📰 This is the school news. When lots of traders sell something on a planet, it gets cheap there. Reading the news helps you find bargains." |
| Out of jumps | first time jumps reach 0 | "That's all 10 jumps for today! Your ship, cargo and credits are saved. See you tomorrow." |
| New day | first load of each new NZ day (after day 1) | A short welcome back: "Day 4! 10 jumps, 1,240 credits. You're 6% of the way to your moon. 📰 Water is cheap on Mars today." |

## 5. Layer 4: help with choices

These sit on the screens all the time while help is on "Lots", and behind a small "Ask Bolt" button on "Some" (section 6). Each one **shows the working** in a short sum, so the pupil learns how to decide and can do it without Bolt later.

### 5.1 Market: what to buy and sell
- **⭐ Best buy:** the good with the biggest total profit from here (the same sum as `starterTrade`) gets a star and a line: "Costs 15 here → Ceres pays 21 → +6 each × 10 = **+60**". It replaces the small grey "Sells best" line for that good. Other goods keep the grey line.
- **Column tips:** a ⓘ on "You buy at" and "You sell at": "You buy at: what you pay the planet. You sell at: what the planet pays you. Buying always costs a little more than selling, so a trade only makes money when you sell **somewhere else**."
- **Losing trade warning:** if the plan sells a good *here* for less than the best price within reach, a gentle line: "Ceres pays 4 more each for Ore. Sell there instead?" (only if the pupil can reach it and has jumps left).

### 5.2 Ship tab: what to upgrade
- A "Bolt suggests" ribbon on the next item on the upgrade ladder (3.2), with why: "+5 holds = about +30 credits a trip".
- On each ship: "Holds: 10 → 15 (+5)". Comparing with what you have now is easier than reading the whole stats list.

### 5.3 Star chart: where to go, and is it safe
- **Trip ideas:** a small list under the jump box, "Good trips from here", with the top 3 from `bestSales` for the cargo on board (or the best buy here): planet, (x, y), fuel, profit each. The pupil still types the coordinates. The list never fills the boxes in (James's choice on 22 Oct to keep typing coordinates as the maths).
- **Guide lines:** for the planet the pupil has tapped, dotted lines from the planet to the x axis and to the y axis, with the numbers circled where they meet. On during First Flight and the pupil's first 5 jumps, then only on "Lots".
- **Wrong coordinates help** already says "check x" or "check y". Bolt adds: "x is the number along the bottom" / "y is the number up the side. Below the middle line is negative."
- **Customs warning before the jump:** if the typed planet bans a good in the hold, the jump box shows "🚫 Mars bans Lollies. Customs will take your 3 Lollies and fine you." The Jump button still works; it's the pupil's choice.
- **Pirate warning:** if the typed planet is a pirate haven or robot council (pirates 6 or more) and the ship has no laser: "Lots of pirates around Io. Your Flea can only run."

### 5.4 Friendly trader: is it a good deal?
Uses `isGoodDeal` (already in `shared/trader/encounter.ts`), with the working:

- Buying: "They sell Ore at **30**. Here it costs **36**. You'd save 6 each × 8 = **48**. ✅ Good deal." Or: "That's **4 more** each than here. ❌ Say No thanks."
- Selling: "They pay **40** for your Furs. Here pays **35**. That's 5 more each × 6 = **30 extra**. ✅ Good deal."
- And whether it works: "It fits in your hold ✅ / You only have room for 5 ❌" and "You can pay ✅ / You need 40 more credits ❌".
- After the first 3 deals the verdict (✅ / ❌) is hidden behind "Help me decide", so the pupil compares the numbers first.

### 5.5 Pirates: what to press
A "Bolt suggests" ribbon on one button, with a reason. Simple rules from the fight's own numbers (`laserPower`, `shieldPower`, the ship's `fleePct`, the hulls):

| Situation | Suggest | Why (shown) |
|---|---|---|
| No laser | Flee | "No lasers. Fleeing works 7 times in 10." |
| Laser, and our hull more than half | Charge | "Your lasers can win this. A right answer fires at full power." |
| Shields fitted but empty, and hull above a quarter | Raise shields | "Shields up will soak their next shot." |
| Hull a quarter or less | Flee | "Your hull is very low. Get away and mend it." |

The ribbon is advice only. Fights stay a mix of luck and choice, as the plan says ("a fight, not a test").

### 5.6 Trip summary
On landing, after selling, a one-line result in the note area: "Trip to Mars: bought Water for 80, sold for 120: **+40** 🎉". This needs the price each good was bought for, which the game doesn't keep. The screen keeps it (section 8, `boughtAt`), so no server change. If it's missing (another device), the summary is skipped.

### 5.7 Bank
- Before borrowing: the "Sure?" box in section 4 on the first borrow; on "Lots", also a line "Bolt thinks: you can already fill your hold. You don't need a loan right now", whenever the pupil's credits already fill their hold with the best buy.

## 6. How help fades, and the pupil's own controls

**Three help levels**, chosen automatically from how far along the pupil is (from the server's `stats.jumps`, so the same on every device), and changeable by the pupil:

| Level | When (automatic) | What shows |
|---|---|---|
| **Lots** | First Flight and the first 30 jumps (about 3 days) | Next-step line, first-time tips, every helper open, guide lines |
| **Some** | 30 jumps on | Next-step line, first-time tips still on for anything new; helpers behind "Ask Bolt"; no guide lines |
| **Off** | only if the pupil picks it | Nothing, except the Bolt help button (it never goes away) |

- The pupil can pick "Lots / Some / Off" in Bolt's help panel or on the title screen (next to "Less movement"). Their pick wins over the automatic one.
- **Bolt's help button 🤖** in the top strip, always there. It opens a small panel:
  - **What should I do?** (the next-step line, with Show me)
  - **What's this screen?** 3 or 4 bullets about the tab that's open
  - **Words:** credits, holds, fuel, hull, jump, profit, tech level, shipyard, customs, banned, bounty, loan, interest, each in one kid-sized sentence
  - **Replay First Flight**
  - **Help level:** Lots / Some / Off

## 7. Small wording and screen changes (they reduce the need for hints)

All in our own files.

| Where | Now | Change to |
|---|---|---|
| Market heading of the last column | "Buy / sell" | "Sell ◀ ▶ Buy", to match the button order |
| Market "All" button | All | "Sell all" (the screen-reader name already says this) |
| Market "Max" button | Max | "Buy max" |
| Market subtitle | "Pick how many to buy (+) or sell (−), then press Trade." | "Press + to buy and − to sell, then press Trade. **Sell first**: it frees up holds and credits." |
| Top strip | no goal shown | 🌙 moon progress ("6%"), with "1,240 of 20,000 credits for your moon" for screen readers |
| Top strip | "🛠️ 25/25" | ok, but a title tip "Hull: your ship's health" (and the same for fuel and jumps) |
| After a trade | the note goes away when you change tab | Stays until the next action, so the "Spent / Earned" message is seen |
| Title screen | no help | "New here? Bolt will fly with you" under Start; "Replay First Flight" for returning pupils |

## 8. How it's built

**All inside `src/games/trader/`.** No server function change, so no redeploy; no migration; no shared files. Same rule as `nextStep.ts` in Clan Quest: *helpers read the engine's own functions and config and never change a rule*.

| File | What |
|---|---|
| `coach/advice.ts` | Pure helpers: `starterTrade`, `bestBuy`, `tripIdeas`, `dealAdvice` (wraps `isGoodDeal`), `fightAdvice`, `customsRisk`, `nextUpgrade`, `shipyardNearby`. Each returns numbers *and* the working text |
| `coach/nextStep.ts` | `nextStep(view)` → `{ say, target, tab? }`, the table in 3.1 |
| `coach/flight.ts` | First Flight as a list of steps, each with `say`, `target` and a `done(view)` test; `currentStep(view, memory)` picks the first step that isn't done |
| `coach/tips.ts` | The first-time tips (section 4), each with a trigger test |
| `coach/words.ts` | Bolt's sentences and the word list, numbers filled in from `shared/trader/config.ts` (like How to play should be) |
| `coach/memory.ts` | What's remembered on this device: help level, First Flight done or skipped, tips seen, deals seen (for 5.4), `boughtAt` prices per good. One `localStorage` key, `sgh-trader-coach`, wrapped in try/catch like `prefs.ts`. **Keyed by season** (from `Loaded.season`) so a New Season starts fresh tips for things like the moon goal, but not First Flight |
| `coach/Bolt.tsx` | The bubble (Bolt's face, the text, buttons), the next-step bar, the help panel |
| `coach/Spotlight.tsx` | Lights up an element found by `data-coach="…"`: an outline and pulse drawn over it, scrolled into view, **never blocking clicks** on the rest of the screen |
| Existing screens | Add `data-coach` names to the buttons Bolt points at (`trade-max-0`, `trade-go`, `tab-map`, `jump-x`, `jump-go`, `ship-pod`…); render Bolt in `TraderGame.tsx`; pass advice into `DealPanel`, `FightPanel`, `JumpBox`, `TradePanel`; the wording changes in section 7 |

**The view Bolt reads:** `{ game, galaxy, tab, phase, pushes, typed target, jumps per day, maths on, help level }`. All already in `TraderGame`. Bolt never sends anything to the server.

**Shared Chromebooks.** Tips seen are stored on the device. If two pupils share one, the second might miss a first-time tip. That's harmless: First Flight still uses the server's `stats.jumps`, and every tip is in the help panel. (If James wants it per pupil, `TraderPlay` can pass the signed-in pupil's id from the hub's sign-in into the key. That's still in our own folder.)

**Accessibility** (the hub's usual bar):
- Bolt's text goes in a polite live region, so screen readers read it. The spotlight adds the target's name to Bolt's sentence ("Press Max on the Water row").
- Keyboard: Bolt's buttons are in the normal tab order; Escape closes a bubble; focus is never trapped; "Show me" moves focus to the target.
- "Less movement": no pulse, no sliding; a still outline.
- Phone (844 × 390): the bubble docks along the bottom edge and never covers the button it points at (it moves to the top if the target is low).
- Colour contrast 4.5:1 like the other panels; no colour-only meaning (✅ ❌ come with words).

**Words:** NZ spelling, short sentences, Year 4 reading level, kind ("Lots of great traders start again"), never "wrong" or "bad"; the game's own words (credits, holds, jump).

## 9. One optional server change (not needed to start)

**Calm first jumps:** no encounter on a game's first 2 jumps (`stats.jumps < 2` in `shared/trader/server.ts`), so First Flight isn't interrupted by pirates. It's one line, but it changes the server's rules, so it means rebuilding and **redeploying the `trader` function** and re-running the simulator. **My pick: leave it out at first.** First Flight already copes with an encounter (it pauses and the first-time tip explains it). Add it only if the class trial shows first-jump pirates putting kids off.

## 10. Stages

Each ends with tests passing, a results section here, a commit, and a stop for James. Merge `origin/main` first at each stage.

| Stage | What | Tests |
|---|---|---|
| **H.1** | `advice.ts` and `nextStep.ts`, the next-step bar with Show me, the spotlight, the wording changes (section 7), the moon progress bar | Unit tests for every helper on many galaxy seeds (always a starter trade; never suggests a banned or unreachable planet; never suggests an upgrade that leaves the pupil unable to trade; each `nextStep` row); a screen test that the bar shows and Show me lights up the right button |
| **H.2** | First Flight | A screen test that plays the whole of First Flight on the preview's pretend server (`trialBackend.ts`); out-of-order steps; skip; replay; an encounter on the first jump; a loss on the first trip |
| **H.3** | First-time tips and help with choices (deal, fight, customs and pirate warnings, trip ideas, trip summary, bank) | Each tip shows once and only once; deal advice for buy and sell, fits and can't pay; fight suggestions for each row of 5.5; customs warning before the jump |
| **H.4** | Bolt's help panel, word list, help levels and fading, title screen buttons, accessibility pass | Help level changes what shows; keyboard-only run through First Flight; live region text; phone layout at 844 × 390; less movement |
| **H.5** | Preview for James (the existing `trader` preview gets a "Start as a new pupil" tool), then a try with a few kids | James and a few pupils try it; tune the wording and the 30-jump fade from what they do |

**Go live:** screen code only, so it goes out with the normal "Test and publish" after merging. No migration, no function deploy (unless section 9 is chosen). Rollback: help level defaults to Off with one config line, or revert the merge.

## 11. Questions for James

1. **The robot's name:** Bolt? (Other ideas: Sprocket, Pip, Nova.)
2. **Fading:** drop from "Lots" to "Some" after 30 jumps (about 3 days)? Or keep "Lots" for longer?
3. **⭐ Best buy and trip ideas** make the trading choice easier. That helps the kids who are stuck, but it takes away some of the "work it out" fun for keen ones. Keep them on "Lots" only (my pick), or on all levels?
4. **Calm first jumps** (section 9): leave out for now (my pick), or build it in?
5. **Tips per pupil or per device** (section 8): per device is simpler and fine for 1:1 Chromebooks. Do pupils share devices?

## 12. Stage H.1 results (1 Nov 2026): Bolt's next step and "Show me"

Built on branch `trader-hints` (its own folder, `~/games-hub-trader-hints`). **Not merged, nothing live.** Only files in `src/games/trader/` changed: no server code, no migration, no shared files. The name "Bolt" is one line (`COACH_NAME` in `text.ts`) in case James picks another (question 1).

### What's there
| Where | What |
|---|---|
| `coach/advice.ts` | Bolt's sums, all read from the game's own rules: trip ideas (buy here, sell where it pays more, within a full tank, never a banned good, biggest profit on the whole load first), what to do with cargo in the hold (sell here unless a planet in reach pays at least 10% more), banned cargo, a stop on the way, the nearest shipyard, and the next upgrade |
| `coach/nextStep.ts` | The next-step rules from section 3.1, in this order: the moon; no jumps left; the planet typed in the jump box (banned cargo, too far with a stop on the way, not enough fuel, "Press Jump!"); cargo in the hold (sell here, or fly to the named planet with its coordinates, filling the tank first if needed); a low hull; an upgrade; the ⭐ best buy here; low credits (the bank, if it's open); nothing worth buying (try the nearest planet) |
| `coach/CoachBar.tsx` | Bolt's bar (his own little robot face, drawn so he isn't mixed up with the 🤖 Robots cargo) and "Show me", which scrolls the button into view, makes it glow for 4 seconds and moves keyboard focus to it. It never covers or blocks anything. If the button is on another tab, the tab glows instead |
| `TraderGame.tsx`, `Panels.tsx`, `StarMap.tsx` | Bolt's bar under the tabs (only on the planet, never in a fight or an encounter); `data-coach` names on the buttons Bolt points at; the chart tells Bolt which planet the typed coordinates point at |
| Wording (section 7) | "Sell ◀ ▶ Buy" heading to match the buttons; "Sell all" and "Buy max"; "Press + to buy and − to sell… **Sell first**"; hover labels on fuel and hull; the trade message no longer disappears when you change tab |
| Top strip | 🌙 moon progress: a bar and a percentage (just the percentage on a phone), "100 of 20,000 credits saved for your moon" for screen readers, "Yours!" once bought |

### Decisions made while building
- **The upgrade ladder skips the Gnat.** A Flea with two cargo pods holds 20 and the Gnat only 15, and a new ship loses its pods (they're traded in at 60%). So Bolt suggests: pods → **Firefly** → a laser → a shield → pods again → Bumblebee → Termite. The Beetle is skipped too (no laser and a thin hull). Pupils can still buy anything themselves.
- **An upgrade is only suggested if the pupil keeps enough to trade:** enough to fill the hold with the cheapest good that makes a profit from here, and never less than the 100 credits they started with.
- **"Fly it somewhere else" needs at least 10% more,** so Bolt never spends a jump for 1 credit. With no jumps left, Bolt says sell here or keep the cargo safe overnight.
- **"Show me" lights the tab, not the button, when the button is on another tab,** so pupils learn where things are instead of being moved about.
- **Bolt's bar stays pinned at the top while the panel scrolls,** so his words are still there after "Show me" scrolls down to a button (found in the browser).
- The market's five buttons (Sell all, −, number, +, Buy max) fit on one line by making the number columns 4 px narrower.

### Tests
- `coach/coach.test.ts` (17, new), run on 40 galaxies: there is always a profitable first trip the pupil can afford; trips never go out of reach, make a loss or use a banned good; biggest profit first; the sell-here-or-fly advice on every planet with every good; an upgrade never leaves too little to trade with; pods first, then the Firefly; nothing suggested where there is no shipyard; and every next-step row: the day-one best buy, a tab glowing first, the moon, no jumps, banned cargo, too far with a stop, short fuel or "Press Jump!", a low hull, a cargo pod, and low credits with the bank open or closed.
- `TraderGame.test.tsx` (3 new): Bolt's bar and Show me lighting up Buy max and focusing it, then after the trade "Fly your …" lighting the Star chart tab, then the planet itself on the chart; Bolt's words when coordinates are typed; the moon progress. One old line was removed: it checked that the star chart had no "Show me" button, which was the fuel sum's button and was removed on 22 Oct.
- All Star Trader tests: 112 pass. Whole project (`npm run test:all`): 333 files, 5,809 tests pass. Typecheck clean.
- Checked by eye in the browser at 1366 × 640 and 844 × 390: a whole first trip following only Bolt (best buy → Trade → Star chart → Phobos lit → type (4, −10) → "Press Jump!" → land → "Sell your 1 Fireworks here"). No console errors.

### Not done / untested
- No First Flight, first-time tips, choice helpers, help panel or help levels yet (H.2 to H.4). Bolt is always on for now; H.4 adds Lots / Some / Off.
- The best buy can be a dear good the pupil can only afford one of (on one test galaxy: 1 Fireworks for +56 beats 10 Water for +10). That is right on the numbers, but "Buy max" buying just one may puzzle a child. H.3's ⭐ line with the whole sum ("+56 × 1 = 56") should make it clear; worth watching in the trial.
- Not tried by a child yet, and not on a real Chromebook or iPad.

### Fixed after James tried H.1 (1 Nov 2026)
**Buy max did nothing.** An older market bug (not Bolt's): the numbers picked in the market (the +3 / −3 boxes) only cleared on a new planet, not after pressing Trade. After selling 3 Fireworks, the plan still said "sell 3 Fireworks", which was now impossible, so every later button was checked on top of it and quietly refused. Now the picks clear whenever the hold changes (a trade, a friendly trader, pirates), and Buy max / Sell all say why when they can't add even one ("You cannot afford that.", "Your hold is full."). Two new screen tests (the first fails on the old code). Star Trader screen tests: 49 pass.

## 13. Stage H.2 results (1 Nov 2026): First Flight

Built on branch `trader-hints`. **Not merged, nothing live.** Only files in `src/games/trader/` changed: no server code, no migration, no shared files.

### What's there
| Where | What |
|---|---|
| `coach/advice.ts` | `starterTrade`: Bolt's first trade. Of the trips that make money and the pupil can afford, the first that fits: a calm planet (pirates 3 or fewer) reached on the fuel already in the tank, then either, then any; biggest profit first |
| `coach/flight.ts` | `flightStep(view)`: the 9 steps of section 2.1, worked out fresh from the game each time, so it follows the pupil (their own good, the chart opened early, another planet, fuel to buy, a planet that doesn't buy the good). Step 6 says "x is negative" or "y is negative" only for the side the planet is on |
| `coach/memory.ts` | What's kept on this device (`sgh-trader-coach`): First Flight done or skipped, and the trip in progress (Bolt's good and planet, the credits and jumps at the start, the buttons pressed). The trip is picked once so Bolt's numbers stay the same all the way |
| `coach/FlightBubble.tsx` | Bolt's bubble, docked at the bottom, or at the top when the lit thing is low on the screen. "Step 3 of 9", Bolt's words in a live region, the step's button ("Let's go", "Got it", "Thanks, Bolt") or "Show me", and "Skip First Flight" with a "Sure?" (Escape backs out). The lit thing glows until its step is done, and never blocks a click |
| `StarMap.tsx` | Guide lines for First Flight: dotted lines from the planet up to its x number and across to its y number, with both numbers circled |
| `Panels.tsx` | The market tells the game what is picked but not traded yet (so step 4, "press Trade", knows) |
| `TraderGame.tsx` | First Flight starts for a pupil with no jumps yet (the server's count) unless done or skipped on this device. Bolt's next-step bar waits until it's over. The bubble steps aside during an encounter, a maths check or a summary, and carries on after. Title screen: "New here? Bolt … will fly with you" and "Replay First Flight" |

### Decisions made while building
- **Profit is worked out from credits** ("You had 100 credits before the trip, and now you have 139"), not from a buy price kept on the side. It's always true, even after buying fuel, pirates or a friendly trader, and needs nothing new kept.
- **The dashboard step lights the whole top strip** (one "Got it") rather than each item in turn: three presses before doing anything felt slow.
- **Step 3 and step 4 need to know what's picked in the market**, so the market now reports it. Nothing else uses it.
- Found while testing: a lit planet or the top strip moved out of place, because the glow gave it `position: relative`. Fixed for H.1's "Show me" too.

### Tests
- `coach/coach.test.ts` (4 new, 21 in all): a first trade on all 40 galaxies that makes money, is affordable, isn't banned and needs no fuel bought; all 9 steps in order; following the pupil (chart early, own good, another planet, fuel to buy); an honest loss, and a planet that doesn't buy the good.
- `TraderGame.test.tsx` (5 new): the whole of First Flight on the pretend server, Bolt's lit button pressed at each step, through to "credits profit! 🎉" and Bolt's bar taking over; out-of-order steps; skip with "Sure?" and replay from the title; an encounter on the first jump (the bubble steps aside, then selling carries on); a loss on the first trip. The older screen tests now play as a pupil who skipped First Flight.
- Star Trader screen and coach tests: 58 pass. Whole project (`npm run test:all`): 333 files, 5,820 tests pass. Typecheck clean.
- Checked by eye in the browser at 1366 × 640 and 844 × 390: a whole First Flight from a new game (1 Fireworks from Makemake to Saturn, +39). No console errors.

### Not done / untested
- **The first trade can be one dear item** (in the preview: 1 Fireworks for +39, and a 19-fuel trip). James decided on 1 Nov 2026 to keep the biggest profit, so `starterTrade` stays as it is.
- The first-time tips for encounters (pirates, junk, a trader) come in H.3, so during First Flight an encounter shows its normal panel with no Bolt words yet.
- On a phone the bubble covers about a third of the screen. It can be moved past, but H.4's accessibility pass should look again.
- Not tried by a child, or on a real Chromebook or iPad.

## 14. Stage H.3 results (1 Nov 2026): first-time tips and help with choices

Built on branch `trader-hints`. **Not merged, nothing live.** Only files in `src/games/trader/` changed: no server code, no migration, no shared files. Bolt never answers a maths question: his tips and sums are about trading only.

### What's there
| Where | What |
|---|---|
| `coach/tips.ts` (new) | The first-time tips of section 4, in Bolt's words, and which one fits the moment (an encounter first, then the result after customs, a wreck or a robbery, then the planet: a new day, out of jumps, the Ship tab, the Bank, the news). The first one not yet seen shows |
| `coach/TipCard.tsx` (new) | Bolt's tip box. On the planet it sits where his next-step line goes (pinned at the top); in an encounter it sits just above the panel. "Got it", ✕ and Escape all close it. The shipyard tour has three stops ("1 of 3", Next), each lighting fuel, the ships and the moon |
| `coach/memory.ts` | Also keeps the tips seen, the friendly-trader deals seen, what each good in the hold cost (`boughtAt`) and the last day played. **By season:** a New Season keeps First Flight and starts the rest again. A memory from before H.3 (no season) is taken as this season, so nothing is lost |
| `coach/advice.ts` | New sums, each with its working: the ⭐ best buy line, the losing-trade line, trip ideas for the chart, the customs and pirate warnings, the deal helper, the fight suggestion, what an upgrade adds, the first-borrow "Sure?", the bank line and the trip summary |
| Market (`Panels.tsx`) | ⭐ **Best buy:** "Costs 78 here → Phobos pays 134 → +56 each × 1 = +56" in place of the small "Sells best" line for that good. **ⓘ** on "You buy at" and "You sell at" (on a phone, where the headings are hidden, a "ⓘ Which price is mine?" button). **Losing trade:** "Phobos pays 62 more each for Fireworks. Sell there instead?" when a sale here is picked |
| Ship tab | "🤖 Bolt suggests: +5 holds = about +100 credits a trip from here" on the next upgrade; every ship shows "Holds 10 → 20 (+10)" |
| Star chart (`StarMap.tsx`) | "Bolt's good trips from here": up to 3 planets, with coordinates, fuel and the profit each. Words only: the boxes are never filled in. In the jump box, once a planet is typed: "🚫 Europa bans Fireworks. If customs stop you, they will take your 3 Fireworks and fine you." and "☠️ Lots of pirates around Io. Your Flea has no lasers, so it can only run." Jump! still works |
| Friendly trader (`Encounter.tsx`) | The deal helper: the working ("They sell Ore at 30. Here it costs 36. You'd save 6 each × 8 = 48."), "It fits in your hold ✅ / You only have room for 5 ❌", "You can pay ✅ / You need 40 more credits ❌" and the verdict. After 3 deals the working and verdict wait behind "Help me decide" |
| Pirates | "Bolt suggests" on one button, with the reason under the buttons (and read out with the button) |
| Bank | The first Borrow asks "Sure? Borrow 300 now. After a week you'll owe 330. Part of each sale pays it back." [Borrow 300] [Not now], once. "Bolt thinks: You can already fill your hold with the best buy here. You don't need a loan right now." when that's true |
| Trade message | After a sale: "Trip to Phobos: bought Fireworks for 237, sold for 402: +165 🎉" (or the loss, honestly) |
| Maths check | The first "Sharp trader check" has Bolt's tip in its note line: "Get it right for a small discount. Wrong costs nothing, and No thanks skips it." |
| First Flight | An encounter on the first jump now shows its first-time tip while First Flight waits |

### Decisions made while building
- **A tip counts as seen the moment it shows,** so it never shows twice even if the pupil doesn't close it. If the moment passes before they read it (they leave the tab, a fight starts), it is gone; it's still in Bolt's help panel in H.4.
- **The no-laser pirate tip replaces the general one** for a ship with no laser (and says "they take some cargo, never your credits" too). A pupil who later has a laser still gets the general one, with Charge explained.
- **The new-day welcome doesn't say "Day 4".** The game doesn't keep which day of the season it is, and counting on the device would be wrong on a second Chromebook. It says "Welcome back! A new day: 10 jumps and 1,240 credits. You're 6% of the way to your moon." plus the top news line. Not shown on a pupil's very first day.
- **Customs warning wording:** "If customs stop you, they will take…", because customs only stop some jumps.
- **The losing-trade line and trip ideas use the same 10% rule as H.1** ("worth a jump"), so Bolt never sends a pupil off for 1 more credit.
- **Fight suggestion when no row of 5.5 fits** (a laser, the hull between a quarter and a half, shields still up): charge if one full shot could finish the pirates, otherwise flee. "Fleeing works about 5 times in 10" for ships whose chance isn't a round number.
- **"About +N credits a trip"** compares the best load from here with the new holds against the best load now, using today's stock and credits. A first try (extra holds × best profit each) said +280 for a pod when only 3 Fireworks were in stock; found in the browser.
- **The trip summary** is shown whenever goods with a known price are sold; it says "Trip to Mars" if they were bought on another planet. Prices are only known for goods bought on this device; anything else is skipped quietly.

### Tests
- `coach/choices.test.ts` (26, new): each tip shows once and only once (12 tips, each seen then gone), First Flight holds back planet tips but not encounter tips, two tips one after another, the bank tip waits while the bank is shut, the new-day words, the tour's three stops, no shipyard naming the nearest; the memory (seasons, an H.2 memory, average buy prices); the ⭐ sum; the losing-trade line on 30 galaxies; trip ideas on 30 galaxies (in reach, different planets, never a loss or a banned good); the customs and pirate warnings; deal advice for buying and selling, "fits" and "can't pay"; a fight suggestion for each row of 5.5 and the extra row; the trip summary (profit, loss, unknown price); the "Sure?" sum; the bank line.
- `TraderGame.test.tsx` (7 new, 2 added to): a tip shown once and never again (Escape, other tabs, a new visit); the shipyard tour lighting each stop; the first-borrow "Sure?"; the ⭐ line and the ⓘ; the customs warning on the chart before the jump with Jump! still working and the boxes untouched; pirates with no laser (the tip and "Bolt suggests" Flee); a friendly trader's tip and deal helper, then "Help me decide" after 3 deals. First Flight's tests now also check the trip summary and the encounter's tip. The older screen tests play as a pupil who has seen every tip.
- Star Trader tests: 91 pass. Whole project (`npm run test:all`): 335 files, 5,861 tests pass. Typecheck clean.
- Checked by eye in the browser at 1366 × 640 and 844 × 390: the news tip, ⭐ line, ⓘ, the shipyard tour, the pod suggestion, the bank's "Sure?" and Bolt's line, the maths-check note, trip ideas and both warnings on the chart, a pirate fight with its tip and suggestion. Found and fixed: the tip box covered the top of the fight panel (it now sits above it), and the tip box was too tall (buttons now sit on the right, like Bolt's bar). No console errors apart from the page reloading while I edited.

### Not done / untested
- No help levels yet (H.4): every helper shows all the time, and the tips have no "show again" in a help panel yet.
- Not seen in the browser: the customs, wrecked and robbed result tips and the out-of-jumps tip (covered by tests). The new-day welcome is only covered by tests.
- The pirate warning shows for quite a lot of planets (9 of 24 in the preview galaxy) because it uses the same "pirates 6 or more" as the plan. Worth watching whether kids find it a nag.
- A tip that shows while the pupil is busy can be missed (see the first decision).
- Not tried by a child, or on a real Chromebook or iPad.

