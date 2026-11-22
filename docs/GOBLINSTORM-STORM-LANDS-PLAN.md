# Goblin Storm: the Storm Lands (maps 6–10)

*James, 22 Nov 2026: plan 5 more levels. First idea was "beat every map 3 times with every hero" (120 wins); too hard. Then once with each hero (40 wins). Then James chose: **unlock them by buying the whole shop**, and add **Legendary upgrades** to the shop that help on the new maps, working **on the new maps only**.*

**Status: LIVE 22 Nov 2026 for every class (stage 3, migration `20261122000400`, `STORM_LANDS_ON = true`). Stage 1 rules #718, stage 2 art #723 (Kraken scenes repainted as an octopus). Next: stage 4, Bella's lines for each twist.**

## The Storm Gate
- **Opens with:** the whole shop bought (all 28 levels, 21,300 gold) **and** the Fire Dragon beaten once. The Fire Dragon keeps the maps in order; the shop is the long part.
- Then each Storm Lands map opens by beating the boss of the one before, like the first five.
- `stormGateOpen(save)` and `mapOpen(save, map, stormLands)` in `shared/goblinstorm/server.ts`.

## The five maps (`MAPS` in `shared/goblinstorm/config.ts`, ids for the art)

| # | Map (`id`) | Common · Fast · Tough → Mini-boss / Boss | Twist (`storm`) | Tier |
|---|---|---|---|---|
| 6 | Sunken Kingdom (`sunken`) | `raider` · `jelly` · `crabknight` → `giantcrab` / `kraken` | `current`: the sea pushes you, a new way every 30 s ("The tide turns!") | 2.4 |
| 7 | Sky Citadel (`sky`) | `harpy` · `gargoyle` · `cloudgolem` → `roc` / `stormgiant` | `lightning`: every 3.3 s two glowing rings (one under you) strike 1.7 s later; they hurt you and monsters | 2.8 |
| 8 | Crystal Caverns (`crystal`) | `beetle` · `shardbat` · `gemgolem` → `crystalqueen` / `wyrm` | `split`: tough monsters break into 2 small ones | 3.1 |
| 9 | Shadow Swamp (`swamp`) | `bogimp` · `wisp` · `hulk` → `hag` / `hydra` | `fog`: you only see close by (drawing only) | 3.4 |
| 10 | Storm King's Citadel (`citadel`) | `stormgoblin` · `crow` · `giant` → `stormknight` / `stormking` | `rage`: at half health the Storm King calls a swarm of 36 and charges twice as often | 4.0 |

Gold from a Storm Lands run is × 1.5. All the twists' numbers are in `STORM`.

## Legendary upgrades (`LEGENDARY`; only on the Storm Lands)

| Upgrade | Levels | Does | Costs |
|---|---|---|---|
| Fifth Weapon | 1 | hold 5 weapons | 4,000 |
| Second Wind | 1 | once a run, get back up with half health | 3,500 |
| Storm Might | 3 | +15% damage a level | 1,500 / 2,500 / 3,500 |
| Storm Surge | 3 | evolution blasts 15% sooner a level | 1,500 / 2,500 / 3,500 |
| Anchor Boots | 2 | the sea pushes 35% less a level | 1,200 / 2,000 |
| Storm Lantern | 2 | see further in the fog | 1,200 / 2,000 |

28,900 gold in all. They live in the save's `shop` next to the normal items, and the run keeps them from its start like the shop. `buyLegend` in `shop.ts` is the rule (only once the whole shop is bought); the database's `buy_goblinstorm` needs the same prices at go-live.

## Why the first five maps can't change
- Every twist uses its own seeded numbers (`STORM_STREAM`), never the run's, and runs only when the map has `storm`. Legendary levels read as 0 off the Storm Lands (`legendLevel`).
- Checked: the determinism report's lines for the first five maps are identical before and after (767 lines). The whole fingerprint moved to `5b08d5a3` because it now also plays the new maps (988 lines).

## Sim (`node scripts/goblinstorm-sim.mjs --only storm|journey`, 22 Nov 2026)
Win rate for all heroes (8 seeds), whole shop plus:

| Legendary | Sunken | Sky | Crystal | Swamp | Citadel |
|---|---|---|---|---|---|
| none | 14% | 5% | 16% | 13% | 9% |
| level 1 | 14% | 8% | 20% | 23% | 8% |
| level 2 | 28% | 11% | 22% | 27% | 17% |
| all | 30% | 20% | 20% | 31% | 14% |

The bot doesn't mind fog, so Shadow Swamp will be harder for pupils than the table says. Ranger and Frost Witch struggle most (weak starting weapons at these tiers).

**Steady player** (5 runs a school day, cheapest shop level first, 4 players): whole shop and Storm Gate on day **35–44**; all 5 Storm bosses by day **49–56**; every Legendary by day **62–69**. The gate is about 7–9 school weeks, because the shop is 21,300 gold.

## Stages
| Stage | What | Live? |
|---|---|---|
| 1 | Maps, twists, Legendary effects, gate rule, stand-in looks, twist drawing, sim, preview `?storm=1&legend=2` | no (switch off) |
| 2 | Art on this PC: 5 grounds, 25 monsters, 5 boss story scenes, map cards, 6 Legendary icons, the Storm Gate painting; story pages (map + boss) for each; the Lava boss page no longer says "the storm is over" once the gate is open | no |
| 3 | Go live: migration (maps 0–9, `buy_goblinstorm` Legendary row and prices, `record_goblinstorm_run` × 1.5 gold is from the replay already), Legendary row in the Shop screen, Storm Gate line on the map screen, achievements (Storm Gate, Storm Breaker), Storm King's Crown trophy, bosses out of 10 on the board and teacher column, `STORM_LANDS_ON = true` | yes |
| 4 | Bella's lines for each twist | yes |

## Tests
Goblin Storm is at its 8. The Storm Lands checks are one rule test (Legendary does nothing off the Storm Lands; the gate; each twist; Second Wind); the health-growth checks moved into the first rule test to make room.

## Stage 3 results (go live, 22 Nov 2026)
- Migration `20261122000400`: runs on maps 0–9; `buy_goblinstorm` sells the Legendary row once the whole shop is bought (`'locked'` before; new helper `goblinstorm_shop_full`, not callable by pupils); `goblinstorm_gate` measure; achievements Storm Gate 🌀 and Storm Breaker 🌈 (all 10 bosses); trophy Storm King's Crown (`goblinstorm-stormcrown`, map 9's boss). `record_goblinstorm_run` unchanged.
- Screens: the Shop's ⚡ Legendary row (gold frames, shine, greyed and 🔒 until the whole shop is bought; painted icons); gold shows as Best haul only once the Legendary row is all bought too; the next-step line points at the cheapest Legendary; the Storm Gate story page once, the first time the map screen shows with the gate open; the Lava boss page now ends "something still rumbles…"; a What's new line.
- `goblinstorm.test.sql` has 84 checks (11 new: map 9 allowed and 10 not, Legendary locked then bought at its price and its top, the gate measure, the Storm King's Crown, the two achievements).
