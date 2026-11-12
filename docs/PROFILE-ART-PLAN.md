# Profile trophies: art plan

*Written 12 Nov 2026 for card P2 of [plans/profile/PLAN.md](plans/profile/PLAN.md). The reasons and the full reward table are in [PROFILE-REVIEW.md](PROFILE-REVIEW.md) (sections 4, 5 and 8). Everything here is painted in ComfyUI on James's gaming PC with `scripts/game_art.py`; nothing is drawn in code.*

**Status: done, 12 Nov 2026.** All 98 paintings made, checked small, committed and in use: Dragon Heads, rings, shelf, pictures and trophies are wired in (`src/avatar/paintedArt.ts`). Only the name-scroll (the top reward's own picture) is painted but not used yet. A few paintings keep a faint friendly silhouette behind the subject (the shelf and gold backdrop most).

**James's brief:** "I want the picture to look over the top AMAZING!" These are the top prizes in the hub and are worn beside a child's name everywhere, so they must look far more special than a built avatar: legendary, glowing, treasure-like. For ages 5 to 11: nothing gory or frightening.

## 1. The look

**The style is "Epic" (picked by James, 12 Nov 2026).** Four directions were painted for the Dragon Head (Epic, Loot, Jewel, Toon) and judged on how grand they look and how well they read as a round 44 px copy. Epic won: luminous painterly fantasy art, mirror-bright metal, a radiant sunburst of light rays behind the subject, glowing particles and lens sparkles, on a dark midnight-blue and violet background. The words are in `profile-art/config.json` under `styles.epic`, put in front of every picture's own words, so the whole set matches. A second style, `plain`, is used only for the three picture rings, which are painted on white so they can be cut out.

Rules for every picture:

- **Square**, 1024 × 1024 painted (1536 after the second pass), saved at 512 px with a 160 px small copy.
- **No words, letters or numbers.**
- **One subject, big and centred**, with a bold outline shape that still reads at 44 px.
- **A dark jewel-toned background** (midnight blue and violet), kept in the picture, so the glow and sparkles are kept too. Trophies and pictures are never cut out. On the cabinet shelf the dark edges can be faded with a round mask so they sit on the shelf's blue velvet.
- **Bronze, silver and gold must be told apart at a glance, and each must look grander than the one before**, not just a colour swap:

| Metal | Words used in every prompt |
|---|---|
| Bronze | warm reddish-brown bronze, sturdy and plain with hammered marks, a soft amber glow, just a few small sparkles |
| Silver | bright gleaming silver, finely engraved, blue sapphires, a cool blue-white glow, frosty sparkles all around |
| Gold | dazzling polished gold, richly ornate, rubies, emeralds and diamonds, golden light rays bursting out behind, clouds of sparkles |

- **Checked small.** Every pick was looked at as a round 44 px and 96 px copy (how `AvatarImage` shows it) and repainted if it turned to mush.

## 2. Where the files go

`scripts/game_art.py profile …` reads [profile-art/config.json](profile-art/config.json); the chosen try of each is in [profile-art/picks.json](profile-art/picks.json). `tidy` writes into `src/avatar/art/`:

| Folder | What | Files |
|---|---|---|
| `pictures/` | earned profile pictures | `<name>.webp` (512 px) and `<name>-small.webp` (160 px) |
| `trophies/` | trophies, three metals each | `<name>-bronze.webp`, `-silver`, `-gold`, each with a `-small` copy |
| `rings/` | the three picture rings, cut out with a see-through middle | `ring-bronze.webp`, `ring-silver.webp`, `ring-gold.webp` |
| `cabinet/` | the trophy cabinet shelf | `shelf.webp` (1600 px) and `shelf-800.webp` |

`src/avatar/paintedArt.ts` finds them: `EARNED_PICTURES` (earnedPictures.ts) uses the pictures and Dragon Heads, `TrophyArt` the trophies, `AvatarImage` the rings (big sizes only) and the cabinet the shelf. A new trophy adds its id to `TROPHY_ART` in paintedArt.ts. The trophy ids in the database are chosen by those cards; the file names here are the art's names, and the table in section 4 says which reward each one is for.

Two small additions to `scripts/game_art.py` came with this set: the kind `icon` (kept whole with its background, shrunk to `max` and `small`) and `hollow` on a cut-out (a ring's middle is cut out, not filled in).

**Small sizes.** Use the `-small` copy wherever a picture is drawn at 80 px or less (top bar, leaderboard, lobby). The painted rings are for big sizes only (the profile card, the "New trophy!" moment); at 44 px the ring `AvatarImage` draws itself is crisper.

## 3. Paintings reused, not repainted

| Reward | Uses | How |
|---|---|---|
| **Heart Diamond picture** (Diamond Drop) | `src/games/diamond/art/paint/gems/heartDiamond.webp` | the painted gem placed on the painted `backdrop-pink` glow: `pictures/heart-diamond.webp` |
| **Rainbow Toon picture** (Toon Flap) | `src/games/toonflap/art/flyers/rainbow-up.webp` | the painted flyer placed on the painted `backdrop-gold` glow: `pictures/rainbow-toon.webp` |
| **That friend as your picture** (each early-years game) | each game's own `friends/<friend>-cheer.webp` | P9 lays the game's `-cheer` friend over `pictures/backdrop-gold.webp` when it draws the picture, so no new files per friend |

The two placed pictures are made by `scripts/game_art.py`'s sister step in section 6, from painted parts only.

## 4. Every picture, in paint order

"Each" in the last column means bronze, silver and gold versions were painted. An earned picture has one painting and its ring shows the metal, except the Dragon Head, which has its own painting per metal.

### Stage 1: the Dragon Head (needed by P4 before 22 November)

| Reward | Game | File | Painted |
|---|---|---|---|
| **Dragon Head picture** | Dragon Maths, first five to slay the dragon | `pictures/dragon-head-bronze`, `-silver`, `-gold` | each |

### Stage 2: rings and the cabinet shelf

| What | File |
|---|---|
| Picture rings | `rings/ring-bronze`, `ring-silver`, `ring-gold` |
| Trophy cabinet shelf (wide, 1280 × 448 painted) | `cabinet/shelf` |

### Stage 3: the other earned pictures

| Reward | Game | File |
|---|---|---|
| **Clan Banner** | Clan Quest | `pictures/clan-banner` |
| **Chess Crown** | Chess | `pictures/chess-crown` |
| **Checkers Crown** | Checkers | `pictures/checkers-crown` |
| **Gem Crown** | Gem Keep | `pictures/gem-crown` |
| **Book Master** | Maths Monsters | `pictures/book-master` |
| **Golden Marble** | Marble Rush | `pictures/golden-marble` |
| **Perfect Match** | Bond Match | `pictures/perfect-match` |
| **Golden Pickaxe** | Mine Runner | `pictures/golden-pickaxe` |
| **Golden Bow** | Archery | `pictures/golden-bow` |
| **Royal Crown** | Royal Decree | `pictures/royal-crown` |
| **Black Hole** | Star Trader | `pictures/black-hole` |
| **Heart Diamond** | Diamond Drop | `pictures/heart-diamond` (reused gem, section 3) |
| **Lighthouse** | Sky Isles | `pictures/lighthouse` |
| **Rainbow Toon** | Toon Flap | `pictures/rainbow-toon` (reused flyer, section 3) |
| **All-rounder** | Whole hub | `pictures/all-rounder` |
| **Double Slayer** | Two games: Dragon Maths + Clan Quest | `pictures/double-slayer` |
| **Board Master** | Two games: Chess + Checkers | `pictures/board-master` |
| **Treasure Keeper** | Two games: Sky Isles + Diamond Drop | `pictures/treasure-keeper` |
| **That friend as your picture** | each early-years game | the game's own `-cheer` friend over `pictures/backdrop-gold` |
| Glow backdrops | for the reused paintings | `pictures/backdrop-gold`, `pictures/backdrop-pink` |
| Name Scroll (not in the table; the top reward's own picture) | Whole hub | `pictures/name-scroll` |

### Stage 4: the trophies, each in bronze, silver and gold

| Trophy | Game | File (add `-bronze`, `-silver`, `-gold`) | The shape |
|---|---|---|---|
| Slayer's Sword | Dragon Maths | `trophies/slayers-sword` | a hero's sword, point down, dragon-wing crossguard |
| Monster Tooth | Clan Quest | `trophies/monster-tooth` | one big ivory fang on a metal stand |
| Champion's Knight | Chess | `trophies/champions-knight` | a chess knight |
| Champion's King | Checkers | `trophies/champions-king` | two stacked checkers with a crown |
| Card Shark | 101 | `trophies/card-shark` | a grinning shark leaping from a fan of cards |
| Clash Cup | Power Clash | `trophies/clash-cup` | a cup with lightning bolts |
| Wormhole | Wormholes | `trophies/wormhole` | a swirling portal in a metal ring |
| League Champion | Maths Monsters | `trophies/league-champion` | a paw-print medal in a laurel wreath |
| Shiny Star | Maths Monsters | `trophies/shiny-star` | a mirror-bright star on a stand |
| Marble Cup | Marble Rush | `trophies/marble-cup` | a cup holding a big swirled marble |
| Bond Star | Bond Match | `trophies/bond-star` | a star of two halves that fit together |
| Miner's Lamp | Mine Runner | `trophies/miners-lamp` | a glowing miner's lantern |
| Hawk Feather | Archery | `trophies/hawk-feather` | a feather with an arrow crossed behind |
| Royal Seal | Royal Decree | `trophies/royal-seal` | a crown seal with ribbon tails |
| Star Ring | Star Trader | `trophies/star-ring` | a little sun with a great ring around it |
| Keeper's Medal | Sky Isles | `trophies/keepers-medal` | a lighthouse medal on a ribbon |
| Times Tables Shield | Training | `trophies/times-tables-shield` | a shield with a big multiplication cross |
| Season Regular | Whole hub | `trophies/season-regular` | a rising-sun-and-tick medallion |
| Adventurer's Badge | Two games: Archery + Mine Runner | `trophies/adventurers-badge` | a compass star over a bow and a pickaxe |
| Star Monarch | Two games: Royal Decree + Star Trader | `trophies/star-monarch` | a crown with a ringed planet above it |
| Golden Wings | Two games: Marble Rush + Toon Flap | `trophies/golden-wings` | spread wings holding a marble |
| Best Friends Cup | Two games: any two early-years games | `trophies/best-friends-cup` | a cup with two little birds for handles |
| Garden Cup | each early-years game (30, 90, 150 days) | `trophies/garden-cup` | a cup overflowing with flowers and ferns |
| Garden Gate | Quick looks | `trophies/garden-gate` | an arched gate with flowering vines, light shining through |

Trophies that can only be won once (Shiny Star, Garden Gate) still have all three metals, so the cards that build them can choose.

## 5. How it was painted

```bash
python3 scripts/game_art.py profile paint ~/dragon-art-inbox/profile-art/set --tries 3
```

Three tries each, into the inbox outside the repo. A try already there is skipped, so a run that stops (ComfyUI not answering: `curl http://100.97.96.115:8188/system_stats`) can simply be started again. The prompts are the style words in `config.json` plus each picture's own words; seeds are fixed by name, so any try can be painted again exactly.

## 6. Tidying

```bash
~/.cache/rembg-venv/bin/python scripts/game_art.py profile tidy
~/.cache/rembg-venv/bin/python scripts/profile-art-reuse.py
```

The first writes every pick into `src/avatar/art/`. The second makes the two placed pictures in section 3 (an existing painted cut-out over a painted backdrop).

## 7. If a picture needs remaking

Paint more tries of just that one (`… paint ~/dragon-art-inbox/profile-art/set NAME --tries 6`), change its number in `picks.json`, and run `tidy --force`. To change what it shows, change its `prompt` in `config.json` first and delete its old tries from the inbox.
