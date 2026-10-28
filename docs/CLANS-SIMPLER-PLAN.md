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

## New idea (James, 28 Oct 2026): every clan has its own village, no class groups

Groups are hard for the teacher to manage. Instead, each clan builds **its own village**, and raids other clans.

### How it would work
- **One place: "My Village".** The village and the empire become one screen. It holds all the clan's buildings:
  - the old class buildings: Training Hall, Smithy and Church;
  - the empire ones: Barracks, Walls, Tower, Forge and Strongroom.
  Each building has levels 1 to 5. You pay for them from the **clan purse**, the same gold you earn in the mines. There is no vault, no chest and no vote.
- **Building.** Tap a building, then tap Upgrade, up to **2 builds a day**. Each building says in one line what it does for *your* clan, for example "Smithy: weapons cost 5% less". The maths moments stay as optional questions:
  - area and fence when a building grows;
  - "how much more gold do I need?";
  - the troop bill.
- **Raids on other clans** (James chose the class, not the whole school, 28 Oct). You can raid any clan **in your class**, with the same guard rails as now:
  - a fair match only (half to double your army);
  - 1 raid a day;
  - a new clan is safe for its first 3 days;
  - a 1-day shield after being raided;
  - at most 10% of their gold, and gold in the Strongroom is safe;
  - the teacher switch.
  Computer kingdoms and Practice battles stay.
- **Teacher page.** The village groups panel goes. The raid switch stays.

### Why it's simpler
- One place to build instead of three (Village, Empire, Land).
- One kind of gold instead of three.
- No weekly vote to wait for, and nothing for the teacher to set up.
- What a kid builds is theirs, so the reason to save up is clear.

### What we'd lose
The "whole class builds together" feeling. If you miss it later, a light version could come back without groups: a class banner that grows as everyone's clans level up, with nothing to give or vote on.

### Moving saves (nothing deleted)
- Each clan's village starts at the levels its group village had reached, so nobody goes backwards.
- Gold still in a chest goes to the clans in that group: shared equally, or by what each one gave if the server kept a record.
- The old village tables are left in place but no longer used. Removing them can wait, and you would be asked first.

### Order of work
This replaces steps 2 and 3 above:
1. Quick fixes (step A).
2. "My Village": merge the village and empire into one screen with one purse, building levels and 2 builds a day, plus the save move.
3. Raids across the class, without groups, and the teacher page tidy-up.

## Live (28 Oct 2026)

My Village went live on 28 Oct 2026 (PR #72): migration `20261028001000` pasted in the SQL Editor, `clans` deployed, site published, and the old group chests shared out with `clan_my_village_share_chests()`.

## Step 2 build plan: "My Village" (agreed by James 28 Oct 2026; how it is built)

**Branch `clans-my-village`.** It goes live in one go, because the engine, screens and server must change together.

### Engine (`shared/clans/`)
- The `Empire` save gets:
  - `levels`: trainingHall, smithy, church, barracks, walls, tower, forge, strongroom, each 0 to 5. Smithy keeps its max of 6 and Church its max of 3.
  - `buildsToday`.
- `vault`, `wild`, `claimed`, `plots`, `energyUsed` and `draftPercent` go.
- `upgradeSave(old)` converts an old save when it loads. It is pure and tested.
  - Vault gold goes into the purse.
  - Group village levels are copied in.
  - Each old building becomes a level: its count, capped at 5. 2 Steel Mills become Forge level 2.
  - Spare plots become a one-off gold refund of their develop price.
  - Stables, Gymnasium and Developer's Hall are refunded at their gold price.
  - Troops are kept, and a save is converted only once.
- **Costs.** Level n costs `base × n` gold, with 2 builds a day. Bases are tuned with the simulator so a clan fills its village in about 4 to 5 weeks, the pace James set. The class village prices were for a whole class, so per-clan prices will be lower.
- **What each building does:**

  | Building | What it does |
  |---|---|
  | Training Hall | Training costs 1 less a level, as now |
  | Smithy | More items in the shop, as now |
  | Church | One more free wake-up a level, as now |
  | Barracks | Room for 20 footmen, 10 axemen and 5 knights a level |
  | Walls | Raiders do 10% less damage a level, and walls stop building losses |
  | Tower | Defenders hit back 10% harder a level |
  | Forge | Your raiders hit 10% harder a level |
  | Strongroom | Keeps 200 gold a level safe from raiders |

- **Area and fence moment.** Each building's plan grows with its level, for example barracks level n is 3 × (n + 2) squares. The area and fence questions are asked on Upgrade, as optional maths.
- **Troops join by themselves.** New followers from mine wins join as footmen while the barracks have room. The draft screen goes. Axemen and knights are still bought, with the troop-bill moment.
- **Classmate raids:**
  - Take gold: up to 10% of (purse minus strongroom-safe gold).
  - Take buildings: knocks one level off a building, never Walls or Strongroom, with one fewer loss for each Walls level.
  - "Land" goes, because there are no plots now.
- The battle, kingdoms and Friendly War are unchanged. The battle plan is cut to one choice (Careful, Steady or Bold), with 3 rounds and 10% loot.

### Screens (`src/games/clans/`)
- One **My Village** screen replaces Village, Empire, Land and Barracks. It shows a picture of the village, then each building as a card with its level, what it does, the price and an Upgrade button. A "What to do next" line sits on top, and "Builds left today: 2" is shown.
- Raid screens get the one-choice plan and the traffic lights.
- How to play is rewritten for the new screens.

### Server (`supabase/`)
- One new migration:
  - `save_raid` checks against the purse and levels instead of the vault and plots.
  - Raid targets and checks use "same class" (`current_class_of`) instead of `clan_village_of`.
  - The nightly job resets `buildsToday`.
  - `load_clan` stops overlaying group village levels, once a save is converted.
  - Chest gold is shared equally among each group's clans, added to their purses one time.
- The village tables and the teacher's village functions stay, unused. Nothing is dropped.
- Rebuild only the `clans` function (`npm run build:functions -- clans`).

### Teacher page
- The village groups panel goes. The classmate raid switch stays.

### Tests and going live
- Engine and screen tests are updated. The SQL tests run on a scratch copy.
- The simulator checks the pace, and `test:all` and the build must pass.
- **The live database migration and the save conversion need James's OK first**, because they change every pupil's save.

### Pictures (James chose 3 sizes per building, 28 Oct 2026)
- There is a small, medium and big picture for each of the 8 buildings, so the village visibly grows:
  - small for levels 1 and 2;
  - medium for levels 3 and 4;
  - big for level 5 and above.
- That is 24 pictures in `src/games/clans/art/buildings/<kind>-<size>.webp`. The barracks, walls, tower and steel mill (Forge) pictures already there are kept as the medium size.
- They are made with `scripts/clans-art.py` on James's gaming computer, in the same style as the others (docs/CLANS-ART-PLAN.md). If a picture is missing, the game falls back to the one-size picture, so nothing breaks.
