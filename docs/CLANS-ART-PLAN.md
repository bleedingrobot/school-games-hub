# Clan Quest: painted pictures plan

How Clan Quest gets its painted pictures, from the 656 pictures in `~/dragon-art-inbox/clans-art` to a live game. It follows the way Dragon Maths was done (`docs/lord-art/`, `scripts/lord-art.py`, `src/games/lord/art.ts`), so most of the tools already exist.

Written 26 October 2026 for James.
**Status: WAITING FOR JAMES's answers (section 3).** Nothing is built yet. The plan is on the `clans-art` branch.

## The short version

- **The pictures are made and checked.** 656 pictures, all in the same gritty painted style as Dragon Maths, made in ComfyUI on James's gaming PC (Z-Image Turbo). All 696 originals were checked for children on 26 Oct. James rejected 7, and all 7 have been remade.
- **Nothing in the game uses them yet.** Clan Quest still shows the one-colour Kenney tiles on the dark terminal look (`src/games/clans/Sprite.tsx`, `clans.css`).
- **Every picture is optional**, the same as Dragon Maths: when a picture is missing, the game shows the old tile. So the pictures can go in one screen at a time and nothing breaks along the way.
- **One thing needs the server: picking a member's look.** Each race and class has 4 painted looks (2 boys, 2 girls). Choosing one needs a small new server action. It needs **no database change**, because a member is already saved as one block of data.
- **Ten stages** (section 5). Stages A.1 and A.2 need James; the rest Claude can do and show as screenshots, with a try-out page before anything goes live.

## 1. What we have (26 Oct 2026)

**The pictures** (`~/dragon-art-inbox/clans-art`, 1.5 GB of PNGs). Each picture was made twice (`-1` and `-2`), so there are two to choose from.

| Group | Files | Size | What the game calls it | Where it would show |
|---|---|---|---|---|
| Members | 396 | 1248 × 1824 portrait | 9 races × 11 classes, 2 boys and 2 girls each | Member cards, creator, fights, training, church |
| Monsters | 76 | 1536 square | 38 monsters (`MONSTERS` in `shared/clans/gamedata.ts`) | Fights, mines |
| Items | 68 | 1536 square | 34 shop items (`ITEMS`) | Market, member gear |
| Scenes | 40 | 2016 × 1152 wide | 20 places: village, market, training, church, mines, empire, barracks, raid, news, scoreboard, creator, quests, rest, battlefield, victory, and 5 mine zones (meadow, caves, swamp, ruins, mountain) | The top of each screen, and behind fights |
| Banners | 24 | 1248 × 1824 portrait | 12 clan names (`CLAN_NOUNS` in `shared/clans/words.ts`: Wolves, Foxes, Owls...) | Clan home, village, scoreboard |
| Quests | 20 | 2016 × 1152 wide | 10 quests (`shared/clans/quests.ts`) | Quest screen |
| Buildings | 14 | 1536 square | 7 buildings (`shared/clans/empire.ts`) | Land and Empire |
| Kingdoms | 12 | 2016 × 1152 wide | 6 raid targets (Bunny Hollow ... Dragon's Rest) | Raid |
| Troops | 6 | 1536 square | Footman, axeman, knight | Barracks, raid |

Every name the game uses has a picture, and no picture is spare, with one exception: the game still says **Centaur**, and the pictures are **Horse Archer**. That rename is done and tested on the `clans-horse-archer` branch, but not committed yet (Stage A.0).

**Other folders in the inbox:** `clans-rejected` (the 7 rejected pictures), plus `clans-test`, `clans-test2` and `clans-superseded` (early tries, not used). They can go once Stage A.3 is done.

**The checks so far:** every picture was looked at for children aged 10–12 (no bare chests on women, nothing gory). James decided on the 20 borderline ones on the review page (https://claude.ai/artifact/SweErGomm5oGatEVg4NPHV). Any picture made later gets the same check before it goes in.

**What's open at the same time:** the `clans-ladder` branch (Battle Cry questions from each child's own maths) is 4 commits ahead of `main` and changes the fight files too. Whichever goes live second will need a careful merge. Plan: keep `clans-art` merged with `main` after every stage, and leave the fight screen (Stage A.6) until the ladder is live if that's soon.

## 2. How the pictures get into the game

The same three parts as Dragon Maths:

1. **A tidy-up script**, `scripts/clans-art.py` (a copy of `scripts/lord-art.py` with the Clans groups). It reads `~/dragon-art-inbox/clans-art`, takes the chosen copy of each picture, and writes small `.webp` files into `src/games/clans/art/<group>/<name>.webp`:
   - **Cut-outs** (members, monsters, items, troops, buildings, banners): the white background is removed with rembg, as for the Dragon Maths heroes. Members are kept at 720 px tall, plus a 200 px copy for small cards; monsters at 400 px; items, troops and buildings at 200 px.
   - **Wide pictures** (scenes, quests, kingdoms): 1600 px wide, plus an 800 px copy for phones.
   - About **30 MB** in the repo in all, but a screen only downloads the pictures it shows, so a pupil's first visit downloads about 1–2 MB.
2. **`src/games/clans/art.ts`**: looks up a picture by the game's own name (`monsterArt('Giant Rat')` → `art/monsters/giant-rat.webp`) and returns nothing when it's missing.
3. **`src/games/clans/art.test.ts`**: checks every monster, item, race and class, building, troop, kingdom, quest, clan name and place has its picture, and every picture is used. This catches a renamed monster (like Centaur) straight away.

`Sprite.tsx` then shows the painting when there is one and the old tile when there isn't. The Kenney tiles stay as the fallback.

## 3. Questions for James

1. **How much should the look change?** Dragon Maths changed its whole frame to match the paintings (wood, parchment, a storybook font). Clan Quest is a dark terminal screen with bright old-computer colours. Choices:
   - **(a) A dark painted frame (recommended).** Keep the dark background, but swap the bright terminal borders and fonts for a dark stone-and-iron frame with an old serif font, so the paintings sit in a frame that suits them. The colours stay dark, so the game still feels like Clan Quest.
   - **(b) Keep the terminal look** and just put the paintings in. Quickest, but gritty oil paintings inside bright 1990s boxes look odd.
   - **(c) The same parchment frame as Dragon Maths.** The two games would match, but they'd lose their own feel.
2. **Members' looks.** Each race and class has 4 looks (2 boys, 2 girls). Should pupils **choose a look for each member** in the creator, with a "Change look" button later, like Dragon Maths heroes (recommended)? Or should the game **pick one for them** (no server change, but no choice)? Existing clans would get a look picked for each member until the pupil changes it.
3. **Which copy of each picture?** For everything except members, there are two copies. Claude can either:
   - **(a) make a picking page (recommended):** both copies side by side, tap the one you like, 130 choices, about 15 minutes; or
   - **(b) choose them itself** and show you the result.
4. **Horse Archer:** commit the rename now as its own small pull request (recommended, so it can go live before the pictures), or fold it into this branch?

## 4. What changes for pupils

- **Every place has a painting** across the top (the market, training hall, church, mines, empire, village and so on), with a smaller one on phones.
- **Fights** show the monster painted, standing in the right mine zone (meadow, caves, swamp, ruins, mountain), and a victory picture when you win.
- **Your clan** shows each member's painted portrait on their card, and your clan's banner.
- **The creator** shows the race and class you're picking, and lets you choose a look.
- **The market** shows each weapon, armour and shield. The **empire** shows your buildings, troops and the kingdoms you can raid. **Quests** each have their own picture.
- **Nothing about the rules, numbers or maths changes.**

## 5. Stages

Each stage ends with tests passing, screenshots for James (laptop and phone width), and a commit on `clans-art`. Nothing goes live until Stage A.9.

**A.0 Tidy up (small, Claude).** Commit the Horse Archer rename (question 4). Copy the 5 remade pictures' winning versions into place (already done) and delete the unused tries.

**A.1 Choose the copies (James, about 15 minutes).** A picking page like the review page: each slot with its two copies side by side, tap one. The choices are saved with the page, and Claude reads them back. (Skipped if James chose 3b.) Claude flags any pair where one copy is clearly wrong, for example `item-moon-blade-1`, which shows a man rather than a blade.

**A.2 Decide the look (James).** Claude makes the market screen in the chosen frame (question 1) as a try-out page with one or two alternatives, and James picks.

**A.3 The tidy-up script and loader (Claude).** `scripts/clans-art.py`, `art.ts`, `art.test.ts`, the cut-outs and sizes from section 2, and `art/CREDITS.md`. All files are generated at once (the cut-outs take about an hour on this server, started in the background so it survives restarts). Nothing shows on screen yet. The inbox's test folders are deleted after this.

**A.4 The frame and the places (Claude).** The new frame from A.2 in `clans.css`, and a painted picture at the top of each place: village, news, scoreboard, market, training, church, mines, empire, barracks, raid, quests and creator each have their own. There's no picture made for the clan home screen or the land screen, so home uses the village and land uses the empire (or James can have two more made). Buttons, text sizes and the keyboard shortcuts stay where they are.

**A.5 Members (Claude, includes the server).** The painted portrait on member cards, in training and in the church. If James chose looks (question 2): a look picker in the creator, a "Change look" button on the member card, a new `look` action in `supabase/functions/clans/handler.ts` and `shared/clans/actions.ts` (the look is one of 4, checked by the server), and a test. Members saved before then get a look picked from their name, so they never change by themselves.

**A.6 Fights (Claude).** The monster painting in the fight, the mine zone's scene behind it, the victory and rest pictures. Keep the fight readable on a phone: the painting shrinks first, the buttons never move. Wait for `clans-ladder` if it's about to go live (section 1).

**A.7 Market, empire and quests (Claude).** Item paintings in the market and on gear, buildings on the land plots, troops in the barracks, kingdoms on the raid screen, the battlefield picture for friendly war, and a picture for each quest.

**A.8 Banners and checks (Claude).** Clan banners on the home screen, village and scoreboard (the banner matches the second word of the clan's name). Then the checks: every picture has a short description for screen readers, the slow-Chromebook check from Stage C.7 again (aiming for the first screen under 2 MB and no stutter in fights), phone width, keyboard only, and How to Play's pictures updated.

**A.9 Try-out page, then live (James decides).** A try-out page with a pretend clan so James can click through every screen. Then a pull request to `main`. Going live needs the `clans` function redeployed (for the look action and Horse Archer) and **no database change**: `node scripts/build-functions.mjs`, then `npx supabase functions deploy clans --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`.

**Rough size:** A.3–A.8 are about a day of Claude's work in all; A.5 is the biggest single stage.

## 6. Making more pictures later

If a picture needs remaking (a new monster, a wrong picture, a new item):

1. On the gaming PC, start ComfyUI from a command window in `D:\ComfyUI\ComfyUI_windows_portable` with `--listen 0.0.0.0` (or add that to `run_nvidia_gpu.bat`), so Claude can reach it on Tailscale at `100.97.96.115:8188`.
2. Claude takes the settings stored inside an existing picture of the same group (each PNG carries its whole ComfyUI workflow and prompt), changes only the description, and makes 3 tries.
3. Claude checks each try is suitable for children and shows the best one before it goes in.

**Known limit:** Z-Image Turbo can't draw centaurs (it always draws a rider on a horse, even when told not to), which is why the Centaur became the Horse Archer. Other half-and-half creatures may have the same problem.

## Credits to carry over

- Paintings made by James with Z-Image Turbo in ComfyUI, October 2026.
- Fallback pictures: Kenney's 1-Bit Pack (CC0), already credited in `src/games/clans/KENNEY-LICENSE.txt`.
- The game itself: see `docs/CLANS-PLAN.md`.
