# Pigeon's Number Line: painted art (done, 8 Nov 2026)

Painted with `python3 scripts/game_art.py pigeon paint|tidy` from `docs/pigeon-art/config.json`; picks are in `docs/pigeon-art/picks.json`; pictures are in `src/games/pigeon/art/paint/` and the home card is `src/assets/home/pigeon.webp`. The code stand-ins in `art.tsx` remain only as a fallback. The list below is the original to-do.


Everything is a stand-in drawn in code in `src/games/pigeon/art.tsx` and `src/assets/home/pigeon.svg` (home card). A painted pass, as for Tūī (`scripts/tui-art.py`, made on the gaming PC through ComfyUI), still needs:

- Five friends (pigeon, sparrow, fantail, bellbird, parrot) in three poses (sit, eat, cheer).
- Berry clusters: green, bronze, silver, gold.
- The Golden Berry Branch.
- Branch backgrounds for bronze, silver and gold days.
- Home card art (`pigeon.webp` and `pigeon-small.webp`, 1600 and 800 wide; then change the two imports in `src/components/gameCardArt.ts` from the svg).

The number line itself (ticks, numbers, arrow) is drawn by the kit's NumberLine and stays code.
