# Star Forge paintings: paint, tidy, check, commit (branch `trader-system`)

Reply to James in plain, simple words. Work only in the worktree `/Users/jriley/games-hub-trader-system` (branch `trader-system`). Do not touch `main`. Nothing is deployed or switched on; this only adds paintings.

## Read first

- `docs/TRADER-SYSTEM-ART-PLAN.md`: the whole painting plan (what, how, the three batches, checks, tonight's steps).
- `src/games/trader/forge/viewer/types.ts` (top comment): the file names and sizes the viewer looks for.
- `docs/TRADER-ART-PLAN.md`: how the old Star Trader paintings were checked and shown.

## The job

1. Check the gaming PC: `python3 scripts/trader-forge-art-gen.py --check`. If ComfyUI isn't reachable, tell James to start it with `--listen 0.0.0.0` (plan section 7) and wait for him.
2. For each batch in order, run it in the background (it takes 8 to 30 minutes; re-run the same line if it stops):
   - `python3 scripts/trader-forge-art-gen.py batch1` (planets, clouds, suns, skies, height maps)
   - then `batch2` (rings, moons, night), then `batch3` (postcards, tech, buttons)
3. After each batch, tidy it: `~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py <groups>`, and make contact sheets with `--sheets DIR`.
4. **Look at every picture** (the sheets, then zoom on doubtful ones). Child-safety check for Year 4 to 6 and the quality checklist are in plan section 6. Flag each bad one with the reason.
5. **Remake the bad ones, one try each:** `python3 scripts/trader-forge-art-gen.py --only <group>/<name>` (old one is kept in `_old/`), tidy that group again with `--force`. A second failure: change the words in the painter's table and the plan's appendix, try once more, then tell James.
6. Build a **review page** (private artifact) of the whole batch with what was remade and why. Tell James the link.
7. When James is happy with a batch: commit the tidied files in `src/games/trader/forge/art/paint/` to `trader-system` (with the script and plan changes). Check the total size with the tidy script's last line; if the `-hd` copies pass about 100 MB, ask James before committing them (plan section 8).
8. Update `docs/TRADER-SYSTEM-ART-PLAN.md` status and tell James which batches are in.

The prompts are in the painter script (`PICTURES`) and in the plan's appendix; keep the two the same. There is no negative prompt for this model: say only what is there. Use helper agents (Sonnet) for looking through the contact sheets and for routine remakes.
