# Clan Quest: fighting classmates (plan, 17 Nov 2026)

**Status:** stage 1 (Village Raids) live 17 Nov 2026 (#544, art and animation #545). Stage 2 (Live Clan Duels) built on `claude/clans-live-duels`. Stage 2 (Live Clan Duels) not started.

James (17 Nov 2026) wants clans to fight each other. He chose **option C**: Village Raids first (any time, the other pupil
doesn't need to be on), then Live Clan Duels for class time (like the Dragon Maths arena). His rules:

- everyone can play **from the start** (no waiting days for a new clan);
- **villages and upgrades make a difference**;
- losing must **not feel bad**: nobody's gold is taken.

## What was there before

Classmate raids (C.6) used the troop battle (`battle()` in `empire.ts`): a winner took 10% of the purse or knocked levels
off buildings, both sides lost troops, the raided clan got a one-day shield, new clans waited 3 days, one raid a day, and
raids rested for the last two weeks of the season. The teacher switch (`clan_raids_enabled`) is off unless turned on.
All of that taking is gone in stage 1; the old `save_raid` SQL function stays (unused) because it is on `main`.

## Stage 1: Village Raids

1. **Pick a rival.** The raid screen shows the three classmates closest to your clan's **power** (heroes' levels, village
   levels and army), each with a traffic light: *Should win* (green), *Close* (amber), *Tough* (red). Everyone else is in a
   small list underneath. You can raid **3 times a day**, each a different clan. Clans you raided today are greyed.
2. **Storm the walls (siege).** One maths question from the child's own maths (the ladder, like the monster siege). Your
   **army and Forge** against their **army and Walls** decide how much of the defenders' HP is knocked off before the
   heroes fight (up to 30%, a right answer adds a quarter more). Their **Tower** shoots first: your heroes start a little
   hurt (3% a Tower level).
3. **Heroes fight.** Your four heroes against a copy of their four (the computer plays theirs), round by round, with a
   Battle Cry question every round, just like the mines. Smithy and Training Hall already show in the heroes' stats.
   If the rounds run out, the defenders hold.
4. **Nobody loses anything.** Raids never change either clan's heroes, gold, troops or buildings. Rewards are made by the
   game:

   | | Gold | Banners |
   |---|---|---|
   | Raid won | 40 (60 against a *Tough* rival) | 3 (4 against *Tough*) |
   | Raid lost, ran or timed out | 10 | 1 |
   | Your village held (paid for the first 3 a day) | 20 | 2 |

   Winning also gives the old 3 fame (`classRaids`). The raided clan reads a kind note: "held!" or "got past your walls.
   Nothing was taken."
5. **Banners board.** Banners count for the week (Monday to Sunday) and show on a class board on the raid screen. It
   starts again every Monday, so a bad week is soon forgotten. Banners are not points and never rank maths.
6. **Gone:** shields, the 3-day wait for new clans, the "fair match" refusal, taking gold or buildings, troop losses, and
   raids resting at the end of the season.

**Teacher switch:** "Raids on classmates" in Clan Quest settings. James (17 Nov 2026): on. Both classes and the school defaults row (copied into every new class) have it on.

### How it is built

- Rules: `shared/clans/raids.ts` (power, rivals, siege, the raid fight, rewards) and `CONFIG.raids`.
- Fight: `FightState.raid` like `FightState.monster`; `fightOf` builds a raid fight from the snapshot kept on the open
  fight, so the server replays it exactly. The defenders are shown by race and class, never by a pupil's name.
- Actions: `raidTargets` (rivals + board), `ask` for `raid` (the siege question), `raidStart`, then the usual
  `cryCheck` / `fightRound`. The old `raidClass` action is gone.
- Server: at the last round the handler loads the raided clan again and saves both in one transaction with the new SQL
  function `save_village_raid`, which can only add the held-reward gold and Banners to the raided clan.
- Migration `20261117000300_clans_village_raids.sql`: `clan_village_mates` and `clan_raid_target` give heroes and
  Banners; `save_village_raid`.

### Art and animation (James, 17 Nov 2026: "flashy, immersive")

Four paintings made in ComfyUI on this PC (`docs/clans-raid-art/`): the war hall (raid list), the siege, the village
square (the fight) and the camp (after a raid that didn't win). The siege fills the screen with flaming arrows and a
BREACH! stamp; the fight opens with the two clans' banners clashing and RAID! slamming down (`RaidStage.tsx`); a win rains
your clan's banner over the results. Rival cards and the Banners board animate in, Tough rivals glow red, embers drift.
Nothing moves with reduced motion.

## Stage 2: Live Clan Duels

James (17 Nov 2026): "Start". Built like Dragon Maths' live arena (`shared/lord/clash*.ts`), with clan names only.

- **Duel Arena** (My Village → ⚔️ Duel Arena, or from Village Raids): classmates' clans with Clan Quest open, a **Duel!**
  button each, three practice clans (Gentle, Fair, Tough; no prizes), and the three painted order cards. A classmate's
  challenge pops up on any screen with 30 seconds to answer.
- **Each round** both pick in secret: **Charge** rides down **Volley**, **Volley** rains over **Shield Wall**, **Shield Wall**
  stops **Charge**. Then one maths question (the pupil's own ladder, `ask` for 'duel'): a right answer is a full hit, a wrong
  one a graze. The winning order hits twice as hard. 60 seconds a round, 5 rounds (3 extra if level).
- **Village bonuses** (never more than about a fifth, so a new clan can win): Forge +4% a level, Walls −4% a level,
  Barracks +2 strength a level, Tower an opening volley of 2 a level, Church one heal of 3 a level below half strength.
- **Nobody loses anything.** Win 40 gold + 3 Banners, loss 15 + 1, draw 25 + 2 (+5 gold a Strongroom level), for each
  pupil's first 3 duels a day. Giving up or walking away ends it with no prizes. Three cheers at the end, no chat.
- **Teacher switch:** "Live duels" in Clan Quest settings, ON to start (James: on).

### How it is built

- Rules `shared/clans/duel.ts`; server steps `shared/clans/duelServer.ts` (the `clans` function's `duel-*` requests);
  migration `20261117000400_clans_live_duels.sql` (clan_here, clan_duels with Realtime, hidden clan_duel_picks, prizes,
  cron tidy, `teacher_set_clan_live_duels`). One maths question powers one round only (`used_ask`).
- Screens `Duels.tsx`, `useDuels.ts`, `src/data/clanDuel.ts`; the test page plays against pretend clans (`pretendDuels.ts`).
- Art (`docs/clans-duel-art/`): the tournament field, the arena gate, and three order cards. The duel fills the screen: the
  two clans' banners swing in, painted order cards slam together from the sides (the winner glows, the loser cracks),
  hits pop, the Church heal sparkles, and a win rains Banners.
