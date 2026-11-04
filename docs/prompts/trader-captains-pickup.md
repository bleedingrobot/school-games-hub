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

## Done 4 Nov 2026 (evening)

- All 40 checked (a helper and by eye). 16 painted again (prompts changed in `scripts/trader-captains-art-gen.py`; the first tries
  are in `~/dragon-art-inbox/trader-captains/first-try/`): women who read as boys, squiggly writing on badges, grandparents who
  looked like children, a green alien too like a film character, a missing eyepatch, a too-tight shirt. m01 kept a pale frame
  three times, so `scripts/trader-captains-art.py` trims its edge (the game only ever shows captains in a circle).
- James OK'd the set on 4 Nov (sheet: https://claude.ai/artifact/Ab1nnaYDB3rT7jXcrWhYK8). He chose: saved in the pupil's game
  (they pick again after a New Season), and no names.
- Built: `shared/trader/captains.ts`, a `captain` move in `shared/trader/server.ts` (kept as `game.captain`), parsed by the
  trader function (index.ts rebuilt), `src/games/trader/Captain.tsx` (picker, Ship tab card, face on the top strip),
  portraits 256 px WebP in `src/games/trader/art/captains/`. Works in the preview (`npx vite --config vite.trader-preview.config.ts`).
- No migration. Going live needs: merge to main, then redeploy the `trader` function (James's word for each). Until the function
  is redeployed, a live pupil choosing a captain would be refused ("could not be read"), so deploy the function first or together.
