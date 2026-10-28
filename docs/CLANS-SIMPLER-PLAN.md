# Clan Quest: making the village and empire simpler (plan, 28 Oct 2026)

James: the mines and combat work really well, but the kids are confused by the village and the empire. This plan keeps the mines and fights exactly as they are and makes the other two parts much easier. Nothing is built yet.

## What confuses kids now

**Three kinds of gold.** The clan purse, the empire vault and the village chest. The vault starts at 0, so nothing in the empire can be bought until a kid finds "Put in" (`shared/clans/empire.ts:30`, `src/games/clans/Empire.tsx:36`). The Land screen just says "0 gold" with no nudge.

**A ten-step chain before the first building.** Put in gold, pick a plot shape, answer area, answer fence, see the price, develop, pick the plot, pick the building, answer energy, build. Troops then need a barracks *and* vault gold.

**Too many ideas at once.** Wild land, developed plots, fences, worker energy %, seven buildings with max counts, three troop kinds with "might", followers, the draft %, rounds, how hard, loot %, stalemate, treasury and shield. Some words mean two things ("plot", "strength" and "might").

**Traps.**
- The draft defaults to 0%. Pressing "Draft my followers" at 0% still uses up every follower (`Barracks.tsx:113`, `empire.ts:208-216`).
- "Claim more land" only shows up once the wild land is gone.
- The village vote closes on Monday, but no countdown is shown.

**The village is a side screen.** It has a goal, a chest, a vote and a "built" list on one page. Kids don't see why it matters to their clan.

## Options

### A. Tidy up (small)
Keep every rule and fix the rough edges:
- a "what to do next" hint on each screen;
- the vault starts with some gold, and a big "Put in" button appears when it's empty;
- the draft defaults to the highest rate and warns before using followers;
- plain words everywhere;
- a countdown on the vote.

*Good:* quick and safe, and no saved data changes. *Bad:* the ten-step chain and the many ideas are still there, so kids will still be confused.

### B. Streamline (medium) — **recommended**
Keep the shape (build a castle, raise an army, raid, help the class) and cut it to a few big ideas.

**Empire**
1. **One clan purse.** The vault is gone. Raiders take a small share of the purse but never more than 10%, and **gold kept in a "Strongroom" building is safe**, so walls still matter. (Or keep it simpler still: raiders take only kingdom-style loot and never touch your gold.)
2. **No developing land.** You have building spaces instead of wild plots and fences. Tap an empty space, tap a building, tap Build. The area and fence maths stays as an optional maths moment ("This barracks needs a 3 × 5 space: how many squares?"). It isn't a gate any more.
3. **No worker energy.** Swap it for a simple **2 builds or upgrades a day** (James, 28 Oct). That rule is easy to see and hard to get wrong.
4. **Four buildings, each with levels 1 to 5**, instead of seven with max counts:
   - **Barracks** (more room for troops);
   - **Walls** (defenders take less damage, and fewer buildings are lost);
   - **Tower** (defenders hit back harder);
   - **Forge** (the old Steel Mill: your raiders hit harder).
   Stables, Gymnasium and Developer's Hall are folded into these levels or dropped. Levelling up is one big "Upgrade" button with its price.
5. **Troops join by themselves.** Followers from mine wins become footmen automatically, up to barracks room, so there is no draft screen. You can still buy axemen and knights with a "how much will 3 knights cost?" moment.
6. **One-tap battle plan.** Pick a kingdom, pick **Careful / Steady / Bold**, and go. Rounds are always 3 and loot is fixed at 10%. The kingdom card shows a traffic light (green "you should win", amber "close", red "too strong") so army strength needs no explaining. Friendly War stays as "Practice battle".

**Village**
7. **One class goal on the home screen.** For example, a big bar saying "Our class is building a Smithy: 340 / 500 gold", with a **Give** button and a picture of the building that grows as gold comes in.
8. **The vote becomes three picture cards.** Each card says what the building does for *your* clan ("Smithy: weapons cost less"). A countdown shows "Vote closes in 3 days".
9. **Thank-you rewards for giving**, not only voting. For example, a fame star for each 50 gold given. Then giving feels worth it.

*Good:* the first building takes three taps, and there are about six ideas instead of about twenty. All the maths moments stay as optional questions. *Bad:* empire saves need changing, so existing plots, buildings, vault gold and troops have to be carried over (see Moving saves). It is also some rework of `empire.ts`, `Land.tsx`, `Barracks.tsx`, `Raid.tsx` and the tests.

### C. Fold the empire into the clan (big)
Remove land and buildings altogether. The empire becomes a "Clan Camp" with four upgrade levels (army size, defence, attack, training) bought with the purse, and raids happen against kingdoms only.

*Good:* simplest of all. *Bad:* loses the land maths (area, perimeter) and the "build something" feeling that made the empire worth adding, and it is the biggest rewrite.

## Recommendation

**Option B, in three small steps**, each its own PR and live once James says so.

1. **Quick wins first:** the Option A list. This helps kids this week and needs no save changes.
2. **Village:** one goal on the home screen, picture vote cards, a countdown and rewards for giving. This is screens only, and the server rules stay the same.
3. **Empire:**
   - one purse;
   - building spaces with levels;
   - 2 builds a day;
   - automatic footmen;
   - the one-tap battle plan with traffic lights.
   This needs a save migration (below).

Classmate raids stay switched off (as now) until step 3 is settled. They would use the same one-tap plan.

## Moving saves (step 3)

Nothing is deleted. Each clan's save is carried over:
- vault gold goes back into the purse;
- each existing building becomes level 1 of that kind (or a higher level if they had several);
- spare developed plots become empty spaces;
- troops are kept.

James to OK the migration before it runs on the live database.

## Questions for James

1. Option B as recommended, or the smaller A or the bigger C?
2. ~~With one purse, can raiders take gold?~~ **Answered 28 Oct 2026:** yes, up to 10% of the purse, and a Strongroom keeps some of it safe.
3. ~~1 or 2 builds a day?~~ **Answered 28 Oct 2026:** 2 a day.
