# Class quest rewards

**Status:** stage 1 (rewards core + Rename Scroll) LIVE 19 Nov 2026 (#606, migration `20261119000400_quest_rewards.sql`). Stage 2 (Hero Titles) built 19 Nov 2026, migration `20261119000500_hero_titles.sql`: 32 titles in `shared/quests/titles.ts`, worn in the avatar's `title` key (server-written only), so leaderboards get it with the avatar; `owned_titles` table instead of a `profiles.title` column; `use_quest_reward`, `set_my_title`, `my_titles`. Stage 3 (Bonus Turns Day) built 19 Nov 2026, migration `20261119000600_bonus_turns.sql`: `bonus_turns` table, and `settings_of(player)` adds the pupil's own bonus day to `unlimited_days`, so all six games (edge functions included) get it with no game changes; the quest kind's game comes from `quest_turns_game(kind)`. Stage 5 (Game Coins) built 19 Nov 2026, migration `20261119000700_game_coins.sql`: the pouch is the `quest_rewards` row itself (detail `{game, amount}`, then `got`); each game's edge-function load calls `open_coin_pouches(player, game, version, per_unit)` after its own day and New Season handling (Dragon Maths: 5 forest wins of gold at the hero's level), and `archery_state` opens Archery pouches itself; amounts in `COIN_POUCH` (`shared/quests/rewards.ts`). Stage 4 (Quest Frames) built 19 Nov 2026, migration `20261119000800_quest_frames.sql`: 8 frames in `shared/quests/frames.ts`, worn in the avatar's `frame` key (server-written only, like the title); `owned_frames`, `set_my_frame`, `my_frames`; `AvatarImage` draws a ring in each frame's colours until the paintings land (`frame-<id>` in `docs/quests-art/config.json`, cut out into `src/avatar/art/frames/`, found by `paintedFrame`). An earned picture keeps its metal ring below 120 px. Paintings not done yet: see `docs/prompts/quest-frames-paint.md`. The red dot on the profile link is left for a later stage. Builds on [CLASS-QUESTS-PLAN.md](CLASS-QUESTS-PLAN.md) (stages 1 and 2 live).

James (19 Nov 2026): class quests should give a reward, and the first one is a Rename Scroll. When a teacher starts a quest, they
choose the reward. I suggested 15 rewards. James picked the first five, then swapped Look Token for Game Coins (19 Nov 2026):

| Reward | What the pupil gets |
|---|---|
| **Rename Scroll** | One Name Scroll. The pupil uses it through the existing P11 own-name flow, with teacher approval. |
| **Quest Frame** | A painted ring around their avatar. They choose one from a set of frames. |
| **Hero Title** | A short title under their name, such as "the Brave". They choose it from a fixed list. |
| **Bonus Turns Day** | One day of unlimited turns in the quest's game. They use it on a day they choose. |
| **Game Coins** | A pouch of the quest's game's own money (credits, gold or coins), about half a normal day's earnings. |

The other ten ideas (look token, lucky box, monster egg, name colour, banner, sticker, class cheer, next-quest vote, Hall of
Heroes plaque, pet companion) are kept for later.

## James's answers (question card, 19 Nov 2026)

| Question | Answer |
|---|---|
| Who chooses the reward | **The teacher picks one** on the Start Quest screen. Everyone who finishes that quest gets it. The bar shows it from day 1. |
| Which game for Bonus Turns and Game Coins | **The quest's own game.** |
| Where Hero Titles come from | **A fixed list we write**, about 30 titles. There is no typing, so no approval is needed. |
| Unused rewards | **They stack.** Unused rewards wait in a "My rewards" spot on the profile until the pupil uses them. |

## Which quests can offer which rewards

Rename Scroll, Quest Frame and Hero Title work for every quest. The two game rewards only work where the game has something to
give:

| Reward | Quest games it works for today | Why |
|---|---|---|
| Bonus Turns Day | Star Trader, Dragon Maths, Clan Quest, Maths Monsters, Diamond Drop, Sky Isles | These are the six games on the teacher's "Unlimited turns today" switch (`20261105000200_unlimited_turns.sql`). The others have no daily turns to add. |
| Game Coins | Star Trader, Dragon Maths, Clan Quest, Archery Challenge, Diamond Drop, Sky Isles | These six have money a pupil spends. Kingdom Keeper, Maths Monsters, Bond Match, Royal Decree, Gem Keep, Marble Rush, Mine Runner, Wormholes and Toon Flap have none. |

On the teacher's Start Quest screen, a reward card that doesn't fit the chosen quest is greyed out, with a one-line reason
("Bond Match has no daily turns", "Marble Rush has no coins"). Eight quest games (Kingdom Keeper, Bond Match, Royal Decree,
Gem Keep, Marble Rush, Mine Runner, Wormholes, Toon Flap) only offer the three hub rewards until they gain turns or money.

## How it works (all on the server)

- **`class_quests.reward text not null default 'scroll'`**, checked against the five reward ids. Old quests read as
  `'scroll'`, but they get nothing back-dated.
- **`teacher_start_class_quest(target_class, which, reward text default 'scroll')`** refuses a reward that doesn't fit the
  quest's game, using the same table as above. The table is kept in one place, `shared/quests/rewards.ts`, and mirrored in a
  `quest_reward_fits(kind, reward)` SQL function.
- **`quest_rewards`** table: `id`, `player`, `quest` (references `class_quests` on delete set null), `reward`, `game`,
  `got_at`, `used_at` (null means unused), and `detail jsonb` (what they picked: the frame id, the title id, the bonus day, the
  coin amount). It has RLS and no direct grants. It is kept through New Season and removed when the account goes.
- **`quest_won(who)`** also inserts one `quest_rewards` row for the quest's reward. It does this inside the same function, so
  every win gets exactly one reward.
  - **Rename Scroll:** this also inserts a `name_scrolls` row straight away, with a new `how = 'quest'`. The `how` check
    constraint is widened to allow it, and there is no once-ever index for `'quest'`. The `quest_rewards` row is marked used
    at once, because the P11 page already handles scrolls.
- **`my_quest_rewards()`** lists the pupil's rewards, unused first. **`use_quest_reward(id, choice jsonb)`** spends one:
  - Frame: `choice.frame` must be a frame id. The id is added to the pupil's owned frames.
  - Title: `choice.title` must be on the list. The id is added to the pupil's owned titles.
  - Bonus Turns: switches on unlimited turns for that pupil and game for the rest of today (NZ). Today only, so it can't be
    saved for a later day after it's used.
  - Game Coins: never waits in My rewards, because there is nothing to choose. It goes straight into a pouch at the win (see
    Game Coins below) and the `quest_rewards` row is marked used.
- **`my_class_quest()`** gains `reward` so the bar can show it.

### Bonus Turns

- **New table `bonus_turns(player, game, day)`.** `unlimited_today(player, game)` also returns true when there is a row for
  that player, game and today.
- Every game that already calls `unlimited_today` gets the bonus day for free.
- Diamond Drop, Star Trader and Sky Isles read the class settings row directly instead. Each needs a one-line check to use
  `unlimited_today` (or `unlimited_games`). Test each one.
- As with the teacher switch, normal turns are used first, then extra turns give full in-game rewards but no hub points.

### Quest Frames

- **The avatar gets a `frame` key.** `is_valid_avatar` accepts it, and `save_my_avatar` refuses a frame the pupil doesn't own.
- **New table `owned_frames(player, frame, got_at)`.**
- `AvatarImage` draws the painted frame outside the circle. When the pupil also wears an earned picture, the frame replaces
  the metal ring at large sizes and the ring stays at small sizes. Check this on the profile, leaderboards and the class list.
- **Art:** 8 frames to start (vine, flame, starfield, crystal, ocean wave, autumn leaves, golden laurel, glow-worm). Painted in
  ComfyUI on the gaming PC as round rings with a transparent middle (see `docs/quests-art/config.json`).

### Hero Titles

- **The list:** `shared/quests/titles.ts`, about 30 friendly titles, for example "the Brave", "Moon Walker", "Star Seeker",
  "Gem Finder", "Dragon Friend" and "Kind Captain". It has no rank words, nothing that compares pupils, and nothing
  teachers would need to check.
- **New table `owned_titles(player, title, got_at)`** and a new column **`profiles.title`**. `set_my_title(id or null)` checks
  ownership.
- **Shown in:** the profile header and every leaderboard row. Leaderboards render the name in about eight places, so first
  make one shared `PlayerName` component (name, title, favourite trophies) and use it in every leaderboard row. The class
  list and the teacher views show the plain name only.

### Game Coins

- **New table `coin_pouches(id, player, game, amount, why, got_at, opened_at)`.** `quest_won` writes one row when the quest's
  reward is Game Coins. Nothing edits the game's save straight away.
- **Each game opens its pouches on its own server load**, inside the version-checked save it already makes: it adds the amount,
  sets `opened_at`, and the game shows "Quest pouch: +150 coins!". This way an open tab is never made stale, and a pupil with no
  save yet (straight after a New Season) gets the pouch on their first load. Sky Isles' coin inbox (`isles_post`) already works
  this way, so copy it.

| Game | Money | Opened in | Pouch | A normal day earns |
|---|---|---|---|---|
| Star Trader | credits | `trader_save` / the trader edge function load. Also update `net_worth`. | 200 credits | about 450 on day 1, more later |
| Dragon Maths | gold | the `lord` edge function load | 5 forest wins at the hero's level (worked out when opened) | 10 forest fights |
| Clan Quest | clan gold | `clans` load (`gold = gold + n, version = version + 1`, as duels do) | 150 gold | about 400 (8 fights) |
| Archery Challenge | coins | `archery_players.coins = coins + n` at once (no version, so no pouch needed) | 150 coins | up to 600 (daily cap) |
| Diamond Drop | coins | `diamond_keep` / load | 75 coins | about 50 to 150 |
| Sky Isles | coins | `isles_load` (new pouch kind in the existing inbox) | 75 coins | about 170 |

Amounts live in one list in `shared/quests/rewards.ts`, to be tuned after the first quests. Pouches are game money only and never
give hub points. A pouch opened after a New Season still pays, into the new save.

## Screens

- **Teacher, Start a quest:** after picking the quest card, there is a row of five painted reward cards, with Rename Scroll
  picked first. Cards that don't fit are greyed out with the reason. The button says "Start this week's quest · Reward:
  Quest Frame".
- **Teacher, running and past quests:** shows the reward next to the title.
- **Pupil quest bar:** a small reward chip in the title strip, such as "🎁 Quest Frame". On the Quest complete fanfare, a reward
  card flips over after the banner ("You earned a Quest Frame!"), with a **Choose it now** button and a **Later** button. Later
  sends the reward to My rewards.
- **Profile, My rewards:** a shelf of unused rewards with a count badge, and a red dot on the profile link while any are
  unused.
  - Tapping a reward opens its chooser: frame picker, title picker, or "Use your Bonus Turns Day today?".
  - Used rewards drop into a small "Used" list.
- **What's new box:** add a line to `src/news/hubNews.ts` when each stage goes live.

## Stages (one PR each, each live when merged)

1. **Rewards core and Rename Scroll.** `class_quests.reward`, `quest_rewards`, the `quest_won` hook, the widened
   `name_scrolls.how`, the teacher reward row (only Rename Scroll is active, the others say "coming soon"), the bar chip, the
   fanfare card and My rewards on the profile.
2. **Hero Titles.** The list, `owned_titles`, `profiles.title`, the shared `PlayerName` component across leaderboards, and the
   title picker.
3. **Bonus Turns Day.** `bonus_turns`, the `unlimited_today` change, and the direct-read fixes in Diamond Drop, Star Trader and
   Sky Isles.
4. **Quest Frames.** The art (ComfyUI), avatar `frame`, `owned_frames`, the `AvatarImage` drawing and the frame picker.
5. **Game Coins.** `coin_pouches` and the pouch opening in each of the six games, one game at a time inside the PR, each
   with its own test.

Each stage adds pgTAP tests next to `supabase/tests/database/class_quests*.test.sql`. Every stage must test that a pupil can't
use another pupil's reward or use one twice, and that a teacher can't start a quest with a reward that doesn't fit.
