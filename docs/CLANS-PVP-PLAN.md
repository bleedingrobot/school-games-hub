# Clan Quest: fighting classmates (plan, 17 Nov 2026)

**Status:** stage 1 (Village Raids) being built on `claude/clans-village-raids`. Stage 2 (Live Clan Duels) not started.

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

**Teacher switch:** still "Raids on classmates" in Clan Quest settings, off by default (question for James: on by default?).

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

## Stage 2: Live Clan Duels (later)

Like the Dragon Maths arena: two pupils online at once, a move each round (rock-paper-scissors style) plus a maths
question, village upgrades as bonuses, practice duels against computer clans, ready-made cheers, a teacher switch off by
default. Pays into the same Banners board.
