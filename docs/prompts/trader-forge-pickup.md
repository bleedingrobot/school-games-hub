# Star Forge: pick up where we left off (branch `trader-system`, after the 4 Nov 2026 evening repaint)

Reply to James in plain, simple words. Work only in the worktree `/Users/jriley/games-hub-trader-system` (branch `trader-system`). Start with `git -C ~/games-hub-trader-system status` and `git log --oneline -10`. Nothing is live: the Forge's migration is on hold (`supabase/migrations-on-hold.txt`) and nothing is deployed. Use Sonnet helpers for looking through contact sheets and other routine checks.

## Read first
- `docs/TRADER-SYSTEM-PLAN.md`: the whole plan. All the questions in section 13 are answered (4 Nov).
- `docs/TRADER-SYSTEM-ART-PLAN.md` section 8: the 4 Nov notes, including how the 14 maps were repainted.
- Review page sent to James on 4 Nov: https://claude.ai/artifact/Nz5fPT6J9KBaEgjZ4T2gEQ (with Gallery and Repainted sections)

## Where it stood (4 Nov 2026, evening)

**Committed on `trader-system`:**
- All the paintings (71 MB). Planets keep the big `-hd` copy only for the best 2 surfaces of each kind (`HD_PLANETS` in `scripts/trader-forge-art.py`).
- Six new night skies. Painted skies are dimmed in the viewer (`PAINTED_SKY_BRIGHT` in `viewer/index.ts`).
- Forge pieces show only once the pupil can afford them, with a "🔒 N more appear as you earn credits" line. Bolt's tips are reworded to match, and there is a test for it.
- **S.8 sharing (4 Nov afternoon, commit `976c7ab`):** the 🌌 Gallery tab (classmates' built systems, own first), gallery pictures drawn by each pupil's browser and saved by the trader function in the private bucket `trader-gallery` (at most every 5 minutes, never on Simple graphics), six preset stickers (counts only for the owner), look-only visits in full screen, and the teacher's "Show the class's systems" projector tour on the Star Trader settings. All in the on-hold migration `20261103000300_trader_forge.sql` (never applied live; checked 4 Nov). The preview has "Pretend classmates (Gallery)", "Pretend I built a system" and "Teacher's projector tour" in its tools. Tests: `handler.test.ts`, `supabase/tests/database/trader_gallery.test.sql`, `TraderGame.test.tsx`, `forge/ProjectorTour.test.tsx`. The screenshot script for headless Chrome is described in step 4.
- James's answers are in the plan: claim a star at about 3,000 first; affordable pieces only; keep as many silly pieces as possible; portraits later; stickers from a fixed set; New Season credits all carried over, up to a cap.

**Repainted and committed (4 Nov evening, commit `f535fff`):** the 14 weak planet maps (donut 1 and 3, ring world 1 and 3, all four eyeball, shattered 0, 1 and 3, jungle 0, ocean 3, ice 2). No eyes, Earth maps or bars now. `HD_PLANETS` for shattered is now (0, 1). The viewer preview has two example systems, `Repainted A` and `Repainted B`, that show all 14 (`?d=Repainted%20A&f=2&level=incredible&still&shot`). All old versions are in `~/dragon-art-inbox/trader-forge-art/planets/_old/`.

## Then
The art is finished. Ask James (on a clickable card) which of these comes next:
1. **Going live** (needs James's OK): follow `docs/GAME_DEVELOPMENT_GUIDE.md` section 8: merge origin/main into `trader-system`, the code switch, the migration `20261103000300_trader_forge.sql` taken off hold, and the trader function deployed.
2. **The New Season picture upload** to the profile album.
3. **Achievements and points.**
4. **More silly pieces** (James wants as many as possible; paint them on the gaming PC, never in code).
5. Small, only if James asks: a closer camera for the gallery pictures. (`ringworld-3` was painted a third time on 4 Nov evening and now has flat bands.)
