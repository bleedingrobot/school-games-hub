# Star Trader captains: pick up

Branch `trader-captains` (worktree ~/games-hub-trader-captains, made from main on 3 Nov 2026).

James wants pupils in Star Trader to pick a starship captain: 20 male, 20 female, child-appropriate.
On 3 Nov 2026 all 40 portraits were queued on the gaming PC with `scripts/trader-captains-art-gen.py`
(log ~/dragon-art-inbox/trader-captains/paint-log.txt, pictures ~/dragon-art-inbox/trader-captains/m01..m20, f01..f20.png).
They wait behind the Star Forge paint batch. If some are missing, run the script again: it skips finished ones.

Next:
1. Use a Haiku/Sonnet helper to look at a contact sheet of the 40 and flag any that look wrong, scary, or not kid-friendly; remake those (delete the PNG, change the words in CAPTAINS, re-run).
2. Show James the sheet (AskUserQuestion cards) before building.
3. Tidy into small webp portraits (e.g. 512x512) under src/games/trader/art/.
4. Build a "Choose your captain" picker in Star Trader (saved per pupil, shown on the ship panel / trade screens). Read docs/GAME_DEVELOPMENT_GUIDE.md first; any server save needs a migration (check numbers) and stays on hold until James says go.
