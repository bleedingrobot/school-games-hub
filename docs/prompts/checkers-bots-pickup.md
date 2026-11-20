# Pick up: checkers painted bots

Branch `claude/checkers-bot-portraits` (pushed, no PR yet). Done so far:

- `src/components/BotPortrait.tsx` + `botPortrait.css`: the painted bot piece, now shared. Chess passes
  `CHESS_BOTS` (`src/games/chess/botPictures.ts`) and looks the same as before.
- `docs/checkers-art/bots.json`: pirate bots holding a red checkers counter (a chick in a paper pirate hat, a robot
  in a striped bandana with an eyepatch on its screen, a kea pirate captain for Medium).
- The chess preview shows checkers with `#checkers&bot=easy` (`preview/chess/main.tsx`).

Still to do:

1. With the gaming PC on and ComfyUI open, paint from the Mac with a copy of `docs/checkers-art/bots.json` whose
   comfy is `http://100.97.96.115:8188`:
   `PYTHONIOENCODING=utf-8 python3 scripts/game_art.py <mac copy> paint ~/dragon-art-inbox/checkers-bots --tries 4`
2. Contact sheet, pick, write `docs/checkers-art/bots-picks.json`, tidy with the rembg venv
   (`~/.cache/rembg-venv/bin/python scripts/game_art.py <mac copy> tidy`) into `src/games/checkers/art/bot/`.
3. Add `src/games/checkers/botPictures.ts` (`CHECKERS_BOTS`) and swap `BOT_EMOJI` in `CheckersPlay.tsx` (setup screen
   and player card) for `<BotPortrait>`, like `ChessPlay.tsx`.
4. Screenshots at 390x844, 820x1180, 1280x800; `npm run test:changed`; hubNews line (90 characters or fewer,
   `game: 'checkers'`); note it in `docs/CHECKERS-LOOK-PLAN.md` (answers its bot portraits question); PR with
   auto-merge; confirm live.
