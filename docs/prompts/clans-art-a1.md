Clan Quest painted pictures, stages A.0 to A.3: tidy up, let me pick the pictures and the frame, then build the tidy-up script and picture loader. The plan is docs/CLANS-ART-PLAN.md; read all of it first.

Where things are:
- School Games Hub repo. Work in the worktree ~/projects/school-games-hub-clans-art on branch `clans-art` (made from `main` on 26 Oct 2026; the plan file is in it but not committed yet, so commit it first). Other sessions are working in the other checkouts (clans-ladder, dragon-art and more), so don't work in them, don't touch their branches, and never do a bare `git push` (push only `clans-art` and `clans-horse-archer`, with `-u origin <branch>`). **Don't merge to main and don't deploy anything until I say "go live".**
- The pictures: ~/dragon-art-inbox/clans-art (656 PNGs, two copies of each, `-1` and `-2`; every one has its ComfyUI workflow and prompt saved inside). Leave the originals where they are; the script reads from there. ~/dragon-art-inbox/clans-rejected holds the 7 rejected ones (don't use them).
- How Dragon Maths did the same job, to copy: `scripts/lord-art.py`, `src/games/lord/art.ts`, `src/games/lord/art.test.ts`, `src/games/lord/art/CREDITS.md` and docs/lord-art/ on the `dragon-art` branch (read them with `git show dragon-art:<path>`; don't check that branch out). rembg runs from a scratch venv (`pip install "rembg[cpu]"`, model cached in ~/.u2net). Start long batches detached (`setsid nohup ... &`) because Claude Code restarts have killed background jobs before.

My answers to the plan's section 3 (26 Oct 2026):
1. The look: **(a) a dark painted frame** (dark stone and iron, an old serif font, still dark), but show me it first (A.2).
2. Members: **pupils choose one of the 4 looks** for each member, with "Change look" later.
3. Copies: **(a) a picking page** for me.
4. Horse Archer: **its own small pull request first.**

Do these, in order:

**A.0 Tidy up.** The Horse Archer rename is done and tested but not committed in the worktree ~/projects/school-games-hub-horse-archer (branch `clans-horse-archer`: the monster's name in `shared/clans/gamedata.ts`, its tile in `src/games/clans/tileMap.ts`, the rebuilt `supabase/functions/clans/index.ts` and the table in `docs/CLANS-RULES.md`). Check it again (Clans tests and the type check), commit it, push it and open a pull request to `main` saying it needs the `clans` function redeployed when merged. Don't merge it. Then make the same rename on `clans-art` (cherry-pick the commit), so the art test can expect `horse-archer`.

**A.1 The picking page.** A page (an artifact, like the review page at https://claude.ai/artifact/SweErGomm5oGatEVg4NPHV, which saved my choices in its database for you to read back) showing both copies of every non-member picture side by side: 130 pairs (38 monsters, 34 items, 20 scenes, 12 banners, 10 quests, 7 buildings, 6 kingdoms, 3 troops), grouped, with the name the game uses under each pair. I tap the one I want; a count shows how many are left. Pick a sensible default for each pair yourself and mark it, so I only have to change the ones I disagree with, and say which ones you think are clearly wrong (for example `item-moon-blade-1` shows a man, not a blade). Use small copies of the pictures so the page loads quickly. Members don't need picking: all 4 looks are used.

**A.2 The frame.** A try-out page (build on the existing Clans preview: `npm run clans:preview`, `vite.clans-preview.config.ts` and `preview/clans/`) showing the **market screen** and the **clan home screen** in the dark painted frame, using real pictures from the inbox, plus one alternative frame so I can compare. Laptop and phone width. Send me screenshots and tell me how to open it.

Then **stop and wait** for me to say I've picked the pictures and the frame.

**A.3 The script and loader** (only after I say so). Read my choices from the picking page. Write `scripts/clans-art.py` (copied from lord-art.py, with the Clans groups and sizes in plan section 2), `src/games/clans/art.ts` and `src/games/clans/art.test.ts` (every monster, item, race-class-look, building, troop, kingdom, quest, clan name and place has its picture, and every picture is used) and `src/games/clans/art/CREDITS.md`. Generate all the files, check them against the originals by eye (contact sheets: cut-outs must have clean edges with no white halo and nothing cut off, especially horns, weapons and wings), and check the total size against the plan's estimate. Don't change any screen yet; that's A.4. After A.3 is committed, you may delete ~/dragon-art-inbox/clans-test, clans-test2 and clans-superseded, but nothing else in the inbox.

Tests: run the whole suite and the type check. Known failures to check and name: stale server bundles (`npm run build:functions` fixes them; leave the stale `supabase/functions/monster/index.ts` alone) and the random tests (101 stats, chess bot, one Wormholes & Black Holes test) that can fail once when the machine is busy.

Commit as you go with clear messages and push `clans-art`. Add a short "Stage A.x results" section to the plan after each stage. When you stop, tell me in plain words (no jargon or file paths): what you did, links to the picking page and the frame try-out, anything you weren't sure about, and what's next.
