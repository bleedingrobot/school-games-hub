# 6. Art, the home card and Bella's voice

James paints the final art himself in the evening, on his gaming PC with ComfyUI. A thread never waits for art and never asks James to approve screenshots: build with drawn stand-ins, write the art plan, and carry on to live.

## Painted art

1. **Build with drawn (code) art first** and keep it as the fallback for good, so a picture not downloaded or not painted yet still works.
2. **Write `docs/<ID>-ART-PLAN.md`:** every picture, its size, and a prompt for each, staged so each screen can go live on its own. Copy `docs/TOON-FLAP-ART-PLAN.md` (older pupils) or `docs/WEKA-ART-PLAN.md` (junior).
3. **Write `docs/<id>-art/config.json`** from [templates/art-config.json](templates/art-config.json) (cut down from `docs/weka-art/config.json`): style words, `inbox`, `picks`, `art_dir`, `home_dir`, and each picture's `prompt`, `size`, `kind` (`cut` = cut out of white, `scene` = kept whole with an 800 px copy, `card` = home card), `folder` and `file`. Check it with `python3 scripts/game_art.py <id> paint OUT --dry-run`.
4. **There is one art script:** `scripts/game_art.py`. Never write a new `<id>-art.py` (the old per-game scripts stay only for old games).
5. James paints (`paint`), 2 to 6 tries each, into the inbox (a folder outside the repo), never straight to `main`. He records the chosen try in `docs/<id>-art/picks.json`.
6. A later thread runs `tidy` (rembg) to write the `.webp` files into `src/games/<id>/art/`, adds `CREDITS.md` in the art folder, and checks `src/games/art.test.ts` passes (no missing or spare pictures).

## The home page card

- A game without a card picture shows a band of its `colours` and its `Icon`, so nothing breaks while you build.
- Style: the Marble Rush course-card look (`docs/HOME-ART-PLAN.md`): a bright, flat storybook landscape, wide 16:9, about 1600 × 900, subject in the middle, calm sky at the top, **no text**. Put its prompt in your `config.json` as a `card` picture.
- When it is painted: drop `src/assets/home/<id>.webp` (about 1600 px) and `<id>-small.webp` (about 640 to 800 px) in. They are found by file name, no import lines; add a `FOCUS` line in `src/components/gameCardArt.ts` only if the Play button's crop needs moving. `src/games/art.test.ts` fails if a game has no picture (add it to `NOT_PAINTED_YET` until it does) or a picture has no game.

## Read-aloud: Bella for every game

- **Bella (Kokoro voice `af_bella`) is the read-aloud voice for every game**, junior or older (James, 4 Nov 2026).
- Put every line the game can say in `src/games/<id>/voiceLines.ts` as `allVoiceLines()`, built from the same word functions the screens use (`words.ts`), so text and clips can't drift. Add the kit's voice-lines test: `voiceLinesSuite(game, allVoiceLines)` from `src/kit/voiceLinesSuite.ts` (copy `src/games/weka/voiceLines.test.ts`). It writes `public/voice/<id>/lines.json`, the list the clip script records: after changing a line run `WRITE_VOICE_LINES=1 npx vitest run src/games/<id>/voiceLines.test.ts`.
- Play lines with `speak(text, '<id>', onEnd)` from `src/speech.ts`: the clip if there is one, else the browser's voice. Start the answer clock in `onEnd`.
- The voice-lines test fails while a line has no clip, so make the clips in the same PR: set up Kokoro as in the header of `scripts/voice-clips.py`, then `python3 -I scripts/voice-clips.py <id>` records the missing lines into `public/voice/<id>/` (`--list` shows the games). Do it in your own container if the network allows the install; otherwise on James's Mac through folder access or a Remote Control session.
- Read-aloud lines never give away the answer still being worked out.
