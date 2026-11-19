# Paint the Quest Frames (pick-up prompt)

Quest Frames are live with drawn rings (docs/QUEST-REWARDS-PLAN.md, stage 4). Only the paintings are left.

1. On the gaming PC with ComfyUI up (`curl http://100.97.96.115:8188/system_stats`), paint the eight `frame-*` pictures from
   `docs/quests-art/config.json` (vine, flame, starfield, crystal, ocean, autumn, laurel, glow-worm), 2 to 6 tries each:
   `python3 scripts/game_art.py quests paint <inbox>` (see docs/game-guide/6-art-voice-cards.md).
2. Record the chosen try for each in `docs/quests-art/picks.json`.
3. `tidy` them (rembg, hollow middle) into `src/avatar/art/frames/<id>.webp` and `<id>-small.webp`. `paintedFrame` in
   `src/avatar/paintedArt.ts` finds them by name: no code change needed.
4. Check the ring sits on the drawn ring (outer edge at the box edge, hole about 78 % wide) on the profile (112 px), the
   frame picker (72 px) and a leaderboard row. If the hole is a different size, move `INSIDE` in `src/avatar/AvatarImage.tsx`.
