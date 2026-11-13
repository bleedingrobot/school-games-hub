# Mine Runner: easier flying, open feel, better graphics (plan)

Written 13 Nov 2026 for James's ask: kids say Mine Runner's **controls are hard** and it **feels claustrophobic**; can we draw on open-source flight controls, and vastly improve the graphics? For Claude threads. **Status: James picked "all stages, in order" (13 Nov 2026). M1 LIVE 13 Nov (PR #485). M2 built 13 Nov: a third flight mode `easy` (World `easy`, migration `20261113000600` widens the mode checks); Easy controls are the default, Classic in Settings. Old steady/free runs replay unchanged (determinism fingerprint of the old modes stayed `384a26e9`). Boards: question card to James on old best times (recommended: keep them). Next: M3.** Branch `claude/project-thread-rpsdb0`.

## 1. Why it feels hard and closed in (from the code)

| Problem | Where | What it is now |
|---|---|---|
| Too many controls at once | `src/games/mine/controls.ts`, `TouchControls.tsx` | Keyboard: W/S, A/D, R/F, 4 arrows, Q/E, Space, Shift. Touch: two sticks + rise + sink + fire + missile + use. Six-way flight with nothing automatic. |
| Turning is slow and steppy | `shared/mine/config.ts` `TURN_UNIT 0.012`, `TURN_MAX 6`; `controls.ts` `AIM_EVERY 3`, `KEY_TURN 4` | Fastest turn about 124°/s, keys about 82°/s. Turn is decided 10 times a second and held, so the view moves in small jerks. |
| No help in tunnels | `shared/mine/engine.ts` | Walls stop you dead-ish (slide only); nothing steers you away from them or lines you up with the tunnel. |
| The camera is in the nose | `renderer.ts` line ~340 | First person, FOV 78 (90 portrait). You never see your ship, so you can't judge the walls. |
| Very short sight | `renderer.ts` `Fog(palette.fog, 2.5, 34)`, camera far 70 | Haze starts 2.5 blocks away: a 5-wide tunnel fades almost at once. Rooms are dark. |
| Small spaces | `config.ts` `TUNNEL_WIDTH 5`, `ROOM_HALF_SIZES [3,4]` | Tunnels 5 blocks, rooms 7–9 blocks, ship radius 0.45. |
| Flat look | `renderer.ts` walls `MeshBasicMaterial` vertex colours, `walls.ts` `SHADE` | Boxy blocks, one flat colour per face, no light, no texture, no glow. |

## 2. Open-source to draw on (ideas, not code in the rules)

The rules (`shared/mine/`) must stay our own: the server replays every run bit-for-bit, so no `Math.sin`, no outside physics. We take **ideas** from these and write our own; draw-only code (`renderer.ts`) may use three.js add-ons directly.

| Source | Licence | What we take |
|---|---|---|
| **MouseFlight** by Brian Hernandez (github.com/brihernandez/MouseFlight; War Thunder style) | MIT (check the LICENSE before copying anything) | **Point-to-fly**: a target point on screen follows the mouse or finger; the ship turns itself towards it, with a smooth, capped turn rate. The pupil points where to go instead of driving yaw and pitch. |
| brihernandez's ArcadeJetFlightExample | MIT | Arcade "auto-level" and gentle banking feel. |
| **three.js examples** (`three/examples/jsm`: `PointerLockControls`, `FlyControls`, `EffectComposer`, `UnrealBloomPass`, `OutputPass`) | MIT, already installed (`three@0.186.0`) | Pointer-lock pattern; **bloom** for glowing crystals, shots, glow-worms. No new dependency. |
| **Critically damped spring / SmoothDamp** (Game Programming Gems 4, "Critically Damped Ease-In/Ease-Out Smoothing"; widely used) | A formula | **Chase camera** that follows behind the ship smoothly, and pulls in when a wall is behind it. |
| **isosurface / surface nets** by Mikola Lysenko (github.com/mikolalysenko/isosurface) | MIT | **Smooth cave walls** built from our block grid (draw only; collision stays on the blocks). |
| Descent source ports (DXX-Rebirth, D2X-XL) | GPL | **Idea only, no code** (GPL would bind our code): "auto-leveling" and "bump assist". |

## 3. The plan, in stages (each goes live on its own)

### M1. Open it up (draw only, no rules change, no board change)
- **Chase camera, on by default** ("Behind the ship"; "From the cockpit" stays an option). Camera sits about 2.2 behind and 0.7 above, spring-smoothed; a short ray test against the block grid pulls it in so it never goes into rock. Draw a simple code-made ship (later painted).
- **See further:** fog from 8 to 60 (per palette), camera far 90; FOV 85 wide / 95 portrait; slight FOV widen with speed.
- **Light, not haze:** walls to `MeshLambertMaterial` with vertex colour; a soft spotlight "headlamp" from the ship; one warm point light per room (lanterns), cooler light in tunnels so you can tell them apart.
- **Smooth the view:** draw the ship's turn eased between aim updates (the stored input is unchanged).
- Tests: renderer stays draw-only; `npm run mine:determinism` fingerprint must not change.

### M2. Easy flying (rules change: a rules version, see section 4)
- **New default scheme "Easy"**: the ship **flies forward by itself** (hold Brake to slow or stop); **point-to-fly**: mouse/finger/stick sets an aim point and the ship turns to it (MouseFlight idea), keys: arrows or WASD steer, Space fires. **Touch: one steering stick + Fire + Brake** (missile and use pop up only when they make sense). Rise/sink and strafe go away in Easy.
- **Faster, smoother turning:** `TURN_UNIT` up (about 1.5x), `AIM_EVERY` 3 to 1 if the measured run size allows (Stage 1 measured 10–25 KB; check against the limit), eased stick curve.
- **Tunnel assist:** a gentle push away from walls and a soft line-up with the tunnel's direction (computed from nearby open blocks, whole-number safe maths); a wall bump is a soft bounce, never damage.
- **Auto-aim on robots** like the reactor's (`AIM_ASSIST_COS`), a little wider in Easy.
- "Classic" scheme (today's controls) stays in Settings for confident pilots.
- **Boards:** Easy and Classic runs replay under their own rules version. Old best times either stay on a "classic" board or the boards start fresh: **James decides (question card; deleting runs needs his OK).**

### M3. Bigger caves (level change: new layouts)
- `TUNNEL_WIDTH` 5 to 7, rooms half-size 5–7, `ROOM_SPACING` up to keep tunnels a fair length; one **big cavern** per level (high ceiling, about 20 across) for the reactor or a key; a few **openings to daylight** (shafts with sky) for the theme places.
- New layouts mean new seeds: the bot test must still finish every level; boards for changed levels start fresh (same James card as M2).

### M4. Big graphics upgrade (draw only)
- **Smooth rock** from surface nets over the block grid, nudged slightly into the rock so it never looks closer than the collision wall.
- **Painted tileable rock textures**, triplanar-mapped (no stretching), one set per mine (greenstone, gold diggings, gold tunnel, coal, glow-worm caves, volcanic), with a painted normal map; code colours stay as the fallback.
- **Glow and life:** bloom (three.js `UnrealBloomPass`), glowing crystals and pounamu seams, glow-worm ceilings (instanced points), lava glow in the volcanic mine, dust motes in the headlamp, sparks.
- **Better robots, ship, keys:** shaped in code with painted skins (no outside models).
- **Speed tiers:** Low (Chromebook: no bloom, flat rock), Medium, High, picked by the existing `setQuality` speed check.

### M5. Art plan (with M4)
`docs/MINE-ART-PLAN.md` and `docs/mine-art/config.json` (`scripts/game_art.py`, `kind: scene` for tileable textures): 6 rock textures + 6 normal maps (1024 px, seamless), crystal/pounamu/gold-seam decals, glow-worm ceiling, 6 level-picker cards, robot and ship skins, the home card if missing. James paints in the evening on his PC (ComfyUI); the thread fetches the files itself.

## 4. Rules version (M2, M3)
The flight mode is the rules version: each run is replayed under its own `mode` ('steady', 'free', 'easy'), so a new way of flying is a new mode and old runs stay valid without deleting anything. Rule changes must only touch code behind `w.easy` (or a later new mode); check with the determinism report that the old modes' lines are unchanged. M3 changes the levels themselves, which changes every mode's replay: it needs a level version in the seed recipe or fresh boards (James's card).

## 5. Order and size
M1 small (one PR, live the same day). M2 medium (two PRs: rules + server, then screens). M3 medium. M4 large (two or three PRs). M5 alongside M4. Recommended order: M1, M2, M3, M4+M5.
