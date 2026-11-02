# Prompt: Sky Isles cosy art (stage C.A), to run when the gaming PC is on

Paste everything below the line into a new Claude session opened in `~/games-hub-isles`, on an evening when James's gaming PC (ComfyUI) is on. It can run before or after stage C.3. Saved 3 Nov 2026, when the PC wasn't available.

---

You are painting new art for **Sky Isles** (short id `isles`) for James's **School Games Hub**. James teaches Years 4–6. Reply to James in plain, simple words, without jargon, file paths or commit hashes unless he asks. Use Haiku helper agents for quick, simple jobs and Sonnet helpers for jobs that need judgement (looking at the paintings). There's no need to ask first. **Always ask James questions on clickable cards** (the AskUserQuestion tool, recommended option first).

## Before anything else
1. Read `docs/ISLES-COSY-PLAN.md` (the cosy rework James chose on 3 Nov 2026, especially sections 6, 8 and 11), `docs/ISLES-ART-PLAN.md` and `scripts/isles-art.py`.
2. Work only in this worktree, on branch `isles`. Run `git fetch` and `git merge origin/main` first. Push only with `git push origin isles`.
3. Check the PC: `curl -s http://100.97.96.115:8188/system_stats`. If it doesn't answer, ask James to start ComfyUI and stop there. **Never draw art in code.**

## What to paint (3 tries each, all in the chosen hand-painted anime style)

Add each name and its words to `scripts/isles-art.py`, using the existing style wording (`PIECE_STYLE`, `PIECE`, `FRIENDLY`). Use positive wording only: this model draws whatever a prompt names, even after "no". Paint into `~/isles-art-inbox/art/`, never straight into the repo.

**1. Repaints James asked for (2 Nov 2026)**
- `bld-farm-2` and `bld-farm-3`: like today's, but with **no wide wheat slab**. The farm sits on a few tufts of grass like every other building.
- `bld-workshop-1`: a small **windmill**, so all three workshop levels are windmills (match `bld-workshop-2` and `-3`).

**2. Decorations** (cut out, 1024 × 1024, `dec-…`, the same three-quarter view as the buildings, smaller than a building, a few tufts of grass at the foot):
`dec-flowers` (a bed of bright flowers), `dec-bench` (a wooden picnic bench), `dec-lantern` (a stone garden lantern), `dec-cherry` (a cherry blossom tree), `dec-chimes` (wind chimes hanging from a little wooden frame), `dec-bridge` (a little arched wooden footbridge), `dec-fountain` (a round stone fountain), `dec-balloon` (a small hot-air balloon tied down by ropes), `dec-rainbow` (a rainbow arch of flowers over a garden gate), `dec-flags` (a pole with bright sail flags), `dec-arch` (a welcome arch of vines and flowers), `dec-telescope` (a brass star telescope on a little platform). That's 12.

**3. Islanders** (cut out, 1024 × 1024, `walker-1` … `walker-6`): small, round, friendly villagers in simple colourful clothes, walking, side-on facing right, chibi proportions. Mixed ages and backgrounds: a farmer with a basket, a child with a kite, a grandparent with a walking stick, someone carrying bread, a fisher with a rod, a gardener with a watering can. They're shown tiny on the island, so keep shapes bold and simple.

**4. Small pictures** (cut out, 1024 × 1024):
- `icon-crystal`: one glowing pale-blue sky crystal.
- `icon-coin` (James, 3 Nov 2026): one pretty, shiny gold coin, slightly tilted, with a little floating island stamped on its face and a soft golden glint on its rim. It pops up over each building at the Collect step (beside "+6"), so it must read clearly at about 40 px.
- `gift-flowers`, `gift-cake`, `gift-lantern`: a bunch of flowers tied with ribbon, a small iced cake, a glowing paper lantern.

**5. The sky garden** (James, 3 Nov 2026; cut out, 1344 × 768, `base-garden`): a small, flat, grassy floating island, painted like the existing bases (`base-1` … `base-5`, same rocky underside, roots and little waterfalls), with winding paths and about 20 small bare patches for decorations. No buildings. It floats beside a Grand Isle once its Lighthouse is lit. After picking, place its 20 decoration spots by hand, the same way as the bases' spots.

**Total: 3 repaints + 12 decorations + 6 walkers + 5 small pictures + 1 garden = 27 pictures, 81 tries.**

## Picking and putting them in
1. A Sonnet helper looks at each set of tries beside the existing buildings (`src/games/isles/art/bld-*.webp`) and suggests a pick. Check against "Checks for every picture" in `ISLES-ART-PLAN.md`: right for 8 to 11-year-olds, no melted shapes or lettering, the same light, grass green and camera angle as the island pieces.
2. Show James the tries side by side (one artifact page, the suggested pick marked) and ask on cards which to keep. Repaint any he doesn't like.
3. Add the picks to `docs/isles-art/picks.json`. Teach `tidy` the new groups: decorations 256 px, walkers 128 px, icons (the coin too) and gifts 160 px, the garden like the bases (1200 px wide). Then run `~/.cache/rembg-venv/bin/python scripts/isles-art.py tidy … --force` for the repaints and the new names.
4. Update `ISLES-ART-PLAN.md` (a "Cosy batch" section), `src/games/isles/art/CREDITS.md`, and the art test's list of expected files.
5. If stage C.3 is already done, check the paintings replace the stand-in decoration, walker, coin and crystal shapes (the screens already look for `dec-…`, `walker-…`, `icon-coin` and `base-garden` by name) and republish the preview to the same page, https://claude.ai/artifact/AbCJrV8AhotXCHaedgVe6V (`ISLES_INLINE=1 npm run isles:preview`, then `scripts/inline-monsters-preview.mjs`).
6. Run the type check and `npm run test:all`. Commit to `isles` and push.
