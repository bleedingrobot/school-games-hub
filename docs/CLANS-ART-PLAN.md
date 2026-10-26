# Clan Quest: painted pictures plan

How Clan Quest gets its painted pictures, from the 656 pictures in `~/dragon-art-inbox/clans-art` to a live game. It follows the way Dragon Maths was done (`docs/lord-art/`, `scripts/lord-art.py`, `src/games/lord/art.ts`), so most of the tools already exist.

Written 26 October 2026 for James.
**Status: A.0–A.5, A.7 and A.8 done (26 Oct). A.6 (fights) waits until the `clans-ladder` branch is live (James, 26 Oct), since both change the fight files. Then A.9: try-out page and going live (James decides).** The plan is on the `clans-art` branch.

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

**James's answers (26 Oct 2026):** 1 (a) the dark painted frame, shown first at A.2; 2 pupils choose one of the 4 looks, with "Change look" later; 3 (a) a picking page; 4 its own pull request first.

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

**A.3 The tidy-up script and loader (Claude).** `scripts/clans-art.py`, `art.ts`, `art.test.ts`, the cut-outs and sizes from section 2, and `art/CREDITS.md`. All files are generated at once (the cut-outs take about an hour on this server, started in the background so it survives restarts). Nothing shows on screen yet. The inbox's test folders are kept (James, 26 Oct).

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

## Stage A.0 results (26 Oct 2026)

- Horse Archer rename committed on `clans-horse-archer` and opened as PR #22 (https://github.com/bleedingrobot/school-games-hub/pull/22). Clans tests pass (446). Not merged; needs the `clans` function redeployed when it is.
- The same commit cherry-picked onto `clans-art`, so the art test can expect `horse-archer`.
- The raw pictures are also in the private repo https://github.com/bleedingrobot/clans-art-source, for working on another machine. The script still reads `~/dragon-art-inbox/clans-art`.
- Unused tries not deleted yet: that waits until after A.3, as the A.1 prompt says.

## Stage A.1 results (26 Oct 2026)

- The picking page: https://claude.ai/artifact/EbGN13X2A7VhvojCULieKf. 130 pairs in 8 groups, small copies built in. Claude's pick is already chosen in each pair; James taps to change one, or "Keep the rest" to accept a group. Choices save to the page's `picks` collection (one document per picture, `{choice: 1|2}`); A.3 reads them back, and any pair James didn't touch uses Claude's pick.
- Claude's picks and notes are in `docs/clans-art/default-picks.json`.
- **Clearly wrong:** Moon Blade copy 1 and Staff copy 2 are men (the other copies are fine). Both copies of Wizard's Staff (a wizard), Wooden Armor (a knight in metal) and Giant Rat (looks like a pig) are wrong. These three could be remade.
- **Worth a look:** scythe (looks like a pickaxe), wand (club-like), rags (a sack), leather armour (looks metal), knobbly club (mallets), boomerang copy 1, cave minotaur (on four legs), green slime (an armoured figure), the wishing well (smoking), two banners with a cross on the pole. Skeleton, mummy, fire spirit and moon wolf have dark backgrounds, so their cut-outs need checking in A.3.

## Stage A.2 results (26 Oct 2026)

- The try-out: https://claude.ai/artifact/Kenwp9gEFvqFMLjPMcrbMr (add `#iron-home`, `#iron-market`, `#oak-home` or `#oak-market`). Locally: `npm run clans:frame`, then serve `dist-preview-clans-frame/`.
- Real Market and member cards with a pretend clan. `preview/clans-frame/Sprite.tsx` stands in for the game's Sprite (via a plugin in `vite.clans-frame.config.ts`) so the screens show paintings; `preview/clans-frame/art/` has the few cut-outs it needs (made with rembg from Claude's picks).
- Two frames, both dark: **Stone and iron** (cold grey stone, iron edges, parchment text, ember for the main button) and **Oak and brass** (dark wood, brass edges, warm cream, a serif for all text). Both use an engraved serif for headings and a painting across the top of each place. The old pixel icon beside a place's name is hidden.
- Checked at 1366 px and 390 px wide: no sideways scrolling. On phones the shoppers in the Market sit two to a row.
- rembg lives in `~/.cache/rembg-venv` (the scratch folder ran out of space).

## Stage A.3 results (26 Oct 2026)

- **James's choices:** Claude's pick for all 130 pairs (nothing changed on the picking page), and the **stone and iron** frame.
- `scripts/clans-art.py`, `src/games/clans/art.ts`, `art.test.ts` and `art/CREDITS.md` are in. All 959 files made (34 MB): 396 member looks with small copies, 38 monsters, 34 items, 3 troops, 7 buildings, 12 banners, and 20 scenes, 10 quests and 6 kingdoms with -800 copies. Clans tests pass (160), including the new art test.
- Cut-outs checked by eye on contact sheets (`scripts/clans-art.py --sheets`). The dark-background ones (skeleton, mummy, fire spirit, moon wolf) came out clean.
- **Still to fix later:** a few members keep a pale painted splash by their feet, which shows on the dark frame. Worst are `imp-barbarian-female-1` and `imp-necromancer-female-2`; fix in A.5 (touch up or remake). Wizard's Staff, Wooden Armour and Giant Rat are still the wrong-looking ones from A.1 and could be remade.
- The inbox's test folders (`clans-test`, `clans-test2`, `clans-superseded`) are kept: James chose to leave them where they are.

## Stage A.4 results (26 Oct 2026)

- The stone and iron frame is now the game's own look, at the end of `clans.css` (the old terminal rules above it still do the layout). Fonts are bundled, not fetched from Google: IM Fell English SC for headings (the same file as Dragon Maths) and Alegreya Sans for text, each with its licence file.
- A painting across the top of every place, chosen in `ClanQuest.tsx` (`SCENE_FOR`): creator, home (village), mines, market, training, church, empire, land (empire), barracks, raid, classmate raid (raid), quest, village, news and scoreboard. Phones get the 800 copy and a shorter strip. How to Play, Achievements, the fight and the results have none yet (the fight's come in A.6).
- The old pixel icon beside a place's name is hidden only while a painting shows, so it comes back if a picture is ever missing.
- Checked at 1366 px and 390 px: no sideways scrolling, and the fight's question box still reads clearly. Members, monsters and items are still the bright pixel tiles until A.5–A.7.
- 2 new tests (each place shows its painting; none in a fight yet). Clans tests: 468 pass.

## Stage A.5 results (26 Oct 2026)

- Each member has one of four looks (`shared/clans/looks.ts`): Girl 1, Girl 2, Boy 1, Boy 2. The creator shows the four paintings on each card; on the clan home, "Change look" opens them. Free, any time except during a fight (like every other action).
- **Server:** a new `look` action (`shared/clans/actions.ts`), and the creator's choices carry the look; the server checks it is one of the four. **No database change.** Clans saved before this get a look worked out from each member's name, so it never changes by itself. The `clans` bundle (`supabase/functions/clans/index.ts`) is rebuilt; it needs deploying with the rest at A.9.
- Painted portraits on the member cards, the Market, the Training Hall and the Church. The fight keeps the old figures until A.6.
- Tests: 7 for the rules (`looks.test.ts`), 3 on screen (creator picker; "Change look" saved on a pretend server; an old clan still shows paintings). Clans: 475 pass; the server function's 55 pass.
- The pale splash is cleaned off `imp-barbarian-female-1` and `imp-necromancer-female-2` (cut out again, then pale grey paper faded out). The necromancer's right wing was lost in the original cut-out and still is; a remake would fix it.
- Checked at 1366 px and 390 px: no sideways scrolling.

## Stage A.7 results (26 Oct 2026)

James chose to do A.7 before A.6, so the fight files stay untouched until `clans-ladder` is live.

- **Items:** painted in the Market shelf, larger in the item's detail panel, and small beside each worn item on a member card (`ItemSprite` in `Sprite.tsx` shows the painting, or the old tile if there isn't one).
- **Quests:** the painting across the top of the Quest screen is today's quest (all day, done or not); the general quests picture is only for a day with no quest.
- **Empire** (done in parallel by a second Claude session): buildings on the Empire home and on each built plot in Land, with small ones in the "build on this plot" list; troops beside each line in the Barracks and on the Empire home; the picked kingdom's painting on the Raid screen; after a battle, the kingdom (raid) or the battlefield (Friendly War). New test file `EmpireArt.test.tsx`.
- Every painting is decoration (`alt=""`): the words beside it already say what it is, so a screen reader doesn't read things twice.
- Still the wrong-looking ones from A.1: Wizard's Staff (a wizard) and Wooden Armour (a knight in metal) show in the Market.

## Stage A.8 results (26 Oct 2026)

- **Banners:** the clan's banner (from the second word of its name) beside its name on the clan home, beside every clan on the Scoreboard, and in the list on "Raid a classmate". The Village has no list of clans, so nothing there.
- **How to Play:** one new line about looks and "Change look". It had no pictures to update.
- **Weight** (production build, measured in the browser): the creator downloads about 223 KB of pictures, 79 KB of fonts and 554 KB of code (156 KB compressed), so well under the 2 MB goal; the clan home adds about 85 KB more. Phones load the small copies (about 176 KB of pictures for the creator).
- **Phone width and keyboard:** no sideways scrolling at 390 px on any screen checked (creator, home, Market, Training, Church, Mines, Quest, Scoreboard, Empire, Land, Barracks, Raid, Friendly War). Every new control is an ordinary button, and the accessibility tests pass.
- Clans tests: 483 pass.
- **Not checked here:** a real slow Chromebook (the Stage C.7 check). Worth a click-through at school before A.9.
