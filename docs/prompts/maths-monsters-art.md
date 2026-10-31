# Maths Monsters, painted art (branch `monsters-art`)

Reply to James in plain, simple words. Nothing goes live without James's yes in this session, one step at a time (guide section 8). Stages A to D are all local. Stage E is the only live part.

This is the same job Dragon Maths had (`docs/prompts/lord-art-golive.md`, `scripts/lord-art.py`, `src/games/lord/art.ts`). Copy that pattern instead of inventing a new one.

## Where things stand (checked 26 Oct 2026)

**The pictures.** James made 414 PNGs in ComfyUI (Z-Image Turbo, on his gaming PC, see "Making or remaking a picture" below). They're in `~/dragon-art-inbox/maths-monsters-art`. Every slot has two tries, `-1` and `-2`, on a flat white background:

| Files | Slots | Size | Matches in the game |
|---|---|---|---|
| `monster-<family>-<stage>[-shiny]-<try>.png` | 108 (54 species, plain and shiny) | 1536 x 1536 | species ids `family-stage` in `shared/monsters/monsterBook.ts`; all 18 families present |
| `person-<name>-<try>.png` | 50 | 1248 x 1824 | the 50 people, nurses and trainers on the 20 maps (`shared/monsters/maps/*.json`), name slugged (`Dock worker Sione` → `dock-worker-sione`) |
| `avatar-boy-01..12`, `avatar-girl-01..12` | 24 | 1248 x 1824 | nothing yet: the player is always Kenney sprite 98 (`world/render.ts`) |
| `scene-<map>-<try>.png` | 14 (8 places, 6 towers) | 2016 x 1152 | the 8 outdoor/healing maps and the 6 Topic Towers |
| `badge-<type>` | 6 | 1536 x 1536 | the six badges (`leaf` … `stone`, `world/areas.ts`) |
| `item-<id>` | 5 | 1536 x 1536 | `ball`, `great-ball`, `potion`, `super-potion`, `repel` |

**Child safety: done.** All 414 were checked on 26 Oct. 26 people and avatar pictures (bare chests, swimwear, underwear) were remade fully clothed and swapped in. The old versions are in `~/dragon-art-inbox/maths-monsters-rejected`. Don't use anything from that folder.

**The game today** (on `main`):
- **Monsters** are SVG drawings from parts. `src/games/monsters/art/MonsterArt.tsx` is the only place they're drawn, and 9 places use it: the battle (both monsters, caught, evolving), the monster book (52 px grid, 110 px detail, dark silhouette when unknown), the start screen, the team list (52 px) and the team strip on the map (30 px).
- **The world** is Kenney pixel art (CC0) on a canvas, and stays that way.
- **People** have no pictures. They're Kenney sprites on the map, and their name shows in the talk box.
- **The battle background** is a colour wash per area (`.mb-arena` and `.mb--areaN` in `monsters.css`).
- **Badges and the Bag** have no pictures.

**Branch.** `monsters-art` was cut from `origin/main` (128cd2c) in `~/projects/school-games-hub-monsters-art`. `monsters-marking` has 2 commits that aren't on `main` yet, so if it merges first, merge `origin/main` in again.

## James's decisions (26 Oct 2026)

1. **Which try for each slot: Claude picks, with no review page.** There are 208 slots with two tries each. Choose the better try yourself. James's rules still apply: modestly dressed, no horns on people, no logos or writing.
2. **Horns: use the hornless try, and remake where both tries have horns.** The prompt said "no horns", and this model draws whatever a prompt names. By my look at the contact sheets, both tries have horns for 14 slots:
   - **People (8):** Glow Gran, Skier Jo, Wee Hana, tower guides Ana, Ngaio, Pita and Sefa, and tower trainer Aroha.
   - **Avatars (6):** girls 02, 04, 07, 09, 10 and 11.
   Look again when picking, and add any others you find.
3. **Places: remake them now as battle backgrounds.** The current scene pictures have a big monster standing in front, so they can't sit behind two battling monsters. Remake all 14 as empty landscapes with open ground in the lower third: the 8 places and the 6 Topic Tower arenas. Battles use the background of the place or Tower they happen in. The current scene pictures aren't used.
4. **Badges: use them big on the Badges page as they are. Items: remake the 5 as plain objects** for the Bag ("a red and white ball on a white background"). At Bag size (about 40 px) the current ones, a monster holding the thing, can't be told apart.
5. **Choosing a trainer look: yes, as the last stage (C4), after everything else works.** The pupil picks one of the 24 avatars. It needs a small change to saving and a redeploy of the `monster` function, so it ships on its own. The map sprite stays the Kenney one.
6. **Small sizes: use paintings everywhere, then check.** The team strip is 30 px and the book grid 52 px. Use a small painted copy. If the 30 px strip looks muddy in the browser, keep the SVG there.
7. **Tower trainer Moana: remake her** (both tries) as a tower trainer who doesn't look like Disney's Moana. Give her a different hairstyle, outfit and colours. Her name can stay.

## Stage A: choose and remake (no code)

1. **Pick.** For each of the 208 slots, choose the better try by looking at contact sheets, and write the choices to `~/dragon-art-inbox/maths-monsters-final/picks.json`. Skip the 35 slots being remade (point 2).
2. **Remake 35 slots:** the 14 horned slots, the 14 scenes, the 5 items and the 2 Moana tries (see "Making or remaking a picture" below). Make 3 candidates per slot and choose the best one yourself, unless the result is borderline. Show James a contact sheet of what you chose before moving on.
   - **Scenes:** use the 16:9 graph from a `scene-*.png` and describe only land, sky and buildings ("an empty sunny beach with rock pools, open sand in the front"). Name no animals or monsters at all.
   - **People:** keep their old description and add clothing and hair in positive words. Never write "no horns". Name what is on the head instead ("short dark hair tied back with a red band").
3. **Gather.** Copy the chosen files to `~/dragon-art-inbox/maths-monsters-final/<slot>.png`, dropping the try number. Check the count: 108 monsters, 50 people, 24 avatars, 14 scenes, 6 badges, 5 items.

## Stage B: tidy into WebP (`scripts/monsters-art.py`)

Model it on `scripts/lord-art.py`: same `slug`, same `save`, and run it on this computer only, never in the site build. The pictures are on a white background, so cut them out with **rembg**. It runs from a scratch venv (`pip install "rembg[cpu]"`, model cached in `~/.u2net`), exactly as the Dragon Maths hero looks were done. Start long batches detached with `setsid nohup`, because Claude Code restarts have killed background jobs before.

Output goes to `src/games/monsters/art/painted/<group>/<name>.webp`:

| Group | Cut out? | Sizes | Name |
|---|---|---|---|
| `monsters` | yes | 384 square, plus `-small` 128 | `carrycrab-2`, `carrycrab-2-shiny` |
| `people` | yes | 640 tall, plus `-small` 200 (a head-and-shoulders crop for the talk box) | `nurse-joy` |
| `looks` | yes | 640 tall, plus `-small` 200 | `boy-01`, `girl-12` |
| `scenes` | no (crop to 16:9) | 1600 and `-800` | the place's map id or `tower-N`, e.g. `kauri-bush`, `tower-3` (battle backgrounds) |
| `badges`, `items` | yes | 256 | `fire`, `great-ball` |

Look at every cut-out on a dark background and on a light one (a contact sheet). rembg sometimes eats white parts: the penguins' bellies, the polar bears, Remaindeer's antlers. Fix those by hand or with the plain flood-fill (`remove_background` in `lord-art.py`). Add `art/painted/CREDITS.md` saying who made them (James, with Z-Image Turbo in ComfyUI) and when.

**Size, estimated:** about 10 MB in the repo. The browser only downloads a picture when a screen shows it, so a battle costs two monster pictures. Check the real total in `npm run build`.

## Stage C: code (in `src/games/monsters/` only)

**C1. `art/painted.ts`**, like `src/games/lord/art.ts`:
- `import.meta.glob('./painted/**/*.webp', { eager: true, query: '?url', import: 'default' })`, with `slug` from the same rule.
- Helpers: `monsterPic(species, shiny, small?)`, `personPic(name, small?)`, `scenePic(map)`, `badgePic(type)`, `itemPic(id)`, `lookPic(look, small?)`.
- **Every picture is optional.** When a file is missing, show what's there today, so pictures can arrive in any order and nothing breaks.

**C2. `MonsterArt` draws the picture when there is one.**
- Keep the same props and the same wrapper span, so the idle bob, hurt wobble and faint (CSS on the wrapper) and reduced motion still work.
- Inside the span, use an `<img>` instead of the `<svg>`. `flip` becomes `transform: scaleX(-1)` on the img. Use the `-small` copy when `size` is 64 or less. The stage scale stays as it is.
- `nameless` (an unknown book entry) becomes a dark silhouette with `filter: brightness(0)` and `opacity` on the img, with `alt=""`. Otherwise the img's `alt` is today's label ("Carrycrab (shiny)").
- Painted shiny pictures are already a different colour, so drop the SVG sparkles over a picture, or keep one small sparkle if James likes it.
- Keep the SVG drawings. They're the fallback and the tests use them.

**C3. People, places, badges, items.**
- **Talk box:** the speaker's `-small` portrait beside the words (`personPic(speaker)`). Decorative, `alt=""`, because the name is already in the text.
- **Trainer battles:** the trainer's picture in the battle intro ("Ranger Kiri wants to battle!") before their monster comes out.
- **Battle backgrounds** (decision 3): the remade landscape for the place or Tower, set as the `.mb-arena` background (`cover`, anchored to the bottom). The colour wash stays underneath as the fallback, and the `-800` copy is used on phones. Make sure the health cards and the question box still read clearly on top: add a soft light panel behind them if needed, and check contrast with axe.
- **Badges page:** the six badge pictures, greyed out for badges not earned yet.
- **Bag:** the remade plain item pictures beside each item's name.

**C4. Choosing a look** (decision 5, its own commit):
- The start screen gets "Choose your look", a grid of 24 small pictures with radio-button semantics, keyboard and screen-reader friendly. The map Menu gets "Change my look".
- `WorldState` gets `look?: string` (`shared/monsters/world/types.ts`), with `LOOKS` listed in `shared/monsters/world/start.ts`.
- `shared/monsters/save/check.ts` (`worldShape`) refuses a `look` that isn't absent or one of `LOOKS`. Old saves have no `look`, so they stay fine and get a default picture.
- `shared/` is in the function bundle, so rebuild with `node scripts/build-functions.mjs` and commit the bundle. The server must accept `look` before the website sends it (see stage E).
- No migration: the world is saved as JSON.

**C5. Tests.**
- Every species, plain and shiny, has a picture.
- Every person on every map has a portrait.
- Every badge has a picture, and every look has both sizes.
- No picture is over its size budget.
- `MonsterArt` falls back to the SVG when a picture is missing, and the silhouette has no name.
- The look check: an unknown `look` is refused, a missing one is accepted.
- The existing tests still pass, especially `MonsterArt.test.tsx`, `BattleScreen.test.tsx` and `save/check.test.ts`.

## Stage D: check it (local)

```sh
cd ~/projects/school-games-hub-monsters-art
git fetch origin && git merge origin/main
npx tsc --noEmit -p .
npx vitest run src/games/monsters shared/monsters supabase/functions/monster
npm run build          # note the total size of the painted pictures
node scripts/build-functions.mjs && git status --short supabase/functions/monster   # only if C4 changed shared/
```

On this computer the single big `vitest run` gets killed partway, so run it folder by folder.

Then use the test page (`npm run monsters:preview`, Walk around tab), in Chromium at 1366 x 640 and at phone size 844 x 390, checking:
- a grass battle and a trainer battle;
- catching and evolving;
- the book with unknown entries;
- the team strip;
- the talk box with a portrait, a battle background in every place and Tower, the Bag and the Badges page;
- choosing and changing a look.

Also run axe on each of those screens, check reduced motion, and repeat the N.7 smoothness check: 4 times slower CPU, walking and a battle start, with no new late frames. Pictures load on first use, so make sure the battle doesn't stutter while its pictures arrive: load the two monster pictures as the battle flash starts. Publish the single-file test page (`npm run monsters:single`) as a private Artifact for James to try.

## Stage E: go live (ask James before each step)

- **Without C4:** website only. Merge to `main` (a pull request for James, or push straight to main if he says so) and watch "Test and publish". No function deploy, no migration.
- **With C4:** first deploy the `monster` function from this branch (`npx supabase functions deploy monster --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`). The old website never sends `look`, so it keeps working. Check with a POST that gives a 401, not a 404 or a crash. Then merge the website.
- **Try it live as the teacher**, on a phone and a laptop: a battle, the book, a talk, the Bag and Badges pages, choosing a look.
- **Write it down:** a results note in `docs/MONSTER-PLAN.md` and the memory note.

**Turning it off again:**
- The Maths Monsters switch on the Teacher page.
- Or revert the merge commit (the SVGs come back).
- If C4 shipped, redeploy `monster` from `main` after the revert. Saved looks stay inside the saves and do no harm.

## Making or remaking a picture

How it was done for Clans and the 26 Maths Monsters remakes on 26 Oct:
- ComfyUI runs on James's PC (Tailscale `100.97.96.115:8188`). He starts it with `--listen 0.0.0.0` from `D:\ComfyUI\ComfyUI_windows_portable`. Check that it's up with `curl http://100.97.96.115:8188/system_stats`.
- Every inbox PNG carries its whole ComfyUI graph in its `prompt` text chunk. Load it, change node `5`'s text, give nodes `8` and `13` the same new random seed, set node `10`'s `filename_prefix`, POST it to `/prompt`, then poll `/history/<id>` and fetch from `/view`. The script used on 26 Oct is `~/dragon-art-inbox/tools/maths-monsters-regen.py` (usage: `python3 -I maths-monsters-regen.py OUT_DIR CANDIDATES [slot-filter]`). Change its `NEW` and `SLOTS` lists for new slots.
- **Only use positive words.** This model draws whatever a prompt names, even after "no" or "-free": "pipe-free grin" gave pipes, "nobody shirtless" gave open shirts. Write "shirt buttoned all the way up to the collar", "jacket zipped up to the chin", "a plain red and white ball". Never write "no horns", "no pipe" or "not shirtless".
- **James's rule:** nobody shirtless, shirts buttoned up, nobody in swimwear or underwear. Look at every candidate before it goes anywhere near the game.
- The ComfyUI queue is shared with other sessions (Clans uses it too). Only delete jobs whose `filename_prefix` is yours.
