# Toon Flap Relay (Class Live activity `relay`)

**Status: BUILT (25 Nov 2026 NZ), stages 1 and 2 (game, server, big screen, iPads, voice). Paintings and the Stadium Sky are the art stage: docs/RELAY-ART-PLAN.md.** Migration `20261126000200_classlive_relay.sql` (activity row + 3 trophies, INSERT only). On for every class with the Class Live switch; not in the set-time (auto) games list yet.

**How it was built, where it differs from the plan below:**
- Effects live in `shared/classlive/relay.ts` (`flyStep`, a copy of Toon Flap's `stepRun` plus the effects, and `teamCourse`), not inside `shared/toonflap/engine.ts`, so solo Toon Flap is untouched. Each effect is a stretch of the team's course (x0 to x1), laid 2 walls ahead of the bird, so the pad, the server and the big screen all fly the same course.
- The flyer's pad sends its flap list every 0.8 s (not 0.4 s) to keep room saves down; the server replays it, capped at the wall clock.
- Teams are dealt at random for race 1, then re-dealt each race by flying (snake order on distance a turn), and whoever has flown least goes first, so everyone flies.
- The finish shows races won by colour, a podium of pupils who won the most races, and shout-outs (far flyer, team helper, trouble maker, spark maker, hot streak).
- Lanes use Toon Flap world 1 with bunting until the Stadium Sky is painted; music borrows Sky Climb's track.

Try it: `npx vite --config vite.classlive-preview.config.ts`, open `?pick=relay`, "Be a pupil" to fly or answer.

James's idea (25 Nov 2026 NZ): "a flappy toon relay? They take turns flying. When one is flying, the others answer questions to grant benefits to their team and detriments to others, where kids get put in groups and groups compete against each other." A team Class Live game built on Toon Flap (docs/TOON-FLAP-PLAN.md: `shared/toonflap/` physics, levels, painted worlds and flyers) and the Class Live room (docs/CLASSLIVE-PLAN.md: lobby codes, big screen, pads, timers, Bella, rewards).

Kind by design: Bella and the big screen name **team colours**, never a pupil, for troubles and bumps; a bump never ends anyone's turn early; no team can be swamped (section 4). Original: our own name, our fantail and flyers and our own Stadium Sky; no pipes, names or art from any existing flappy game.

## James's answers (question cards, 25 Nov 2026 NZ)

| Question | Answer |
|---|---|
| Teams | **Auto teams of 4 or 5, balanced** (3 to 6 teams; mixed by maths focus level) |
| Turns at once | **All teams at once, one lane each** |
| Flying control | **Flyer's own iPad shows the course** (tap to flap, no lag); big screen mirrors each lane a moment behind |
| Turn length | **30 s** of flying, then the baton passes |
| Bump | **Like Toon Flap: short stun**, the turn carries on |
| Winning a race | **Relay race to the nest**; furthest wins if time runs out |
| Answers to perks/troubles | **Own spark meter**: perk 2 sparks, trouble 3, the pupil chooses |
| Perks | **8 perks, unlocked race by race** (4 in race 1) |
| Troubles | **Wind, fog, extra wall, narrow gaps** (all from race 1) |
| Fairness | **Troubles hit a random team** that's free (no aiming, so no ganging up); one trouble on a team at a time |
| Catch-up | **Gentle**: last team's perks cost 1 less spark, the leader's 1 more |
| Flyer's maths | **None: the flyer just flies** (their maths is while they wait) |
| Game length | **Teacher picks 1, 3 or 5 races** on the setup card (default 3) |
| Big screen | **Stacked lanes + race bar** |
| Worlds | **One new relay stadium sky** (sports-day sky, flags, cheering crowds), painted on James's PC |
| Bella | **Sports commentator**, team colours only, never names |
| Rewards | **Usual Class Live points + 3 trophies**; no Toon Flap unlocks |
| Years | **All years**, each pupil's own maths focus |
| Set-time game | **Big screen only for now** (not in `AUTO_ACTIVITIES`; a set-time version can come later) |

## 1. How a race plays

1. **Lobby**: pupils join with the room code as usual. At Start the server deals teams (`dealTeams(players)`): `k = clamp(round(n / 4.5), 2, 6)` teams, sizes differ by at most 1; pupils sorted by focus level then dealt snake-style so each team mixes levels. Teams keep their colour (Red, Blue, Green, Yellow, Purple, Orange) for the whole session; late joiners go to the smallest team.
2. **Each race**: the **Stadium Sky** world (James: one new world of its own), with a fresh relay course from the race's seed (`buildRelayCourse(race, seed)`: about 3 minutes of walls for a good team, nest at the end). The course's walls use Toon Flap level 1's numbers in race 1 and get a little tighter each race (level 2's in race 2 … level 5's in race 5), never harder than level 5. Every team flies the **same course** in its own lane.
3. **Turns**: every team has one flyer up at a time. A turn lasts `TURN_MS` (30 s of flying; hovering doesn't count). Then the baton passes: the next teammate's pad shows "You're up! Tap to fly", and their bird starts hovering **where the last one stopped** (the team's distance carries on). Order goes round the team; a pupil who has left is skipped.
4. **Bump**: as Toon Flap, the bird tumbles and comes back hovering just before the wall, losing about 2 s of flying (`RELAY_BUMP_STEPS`). The turn never ends early.
5. **Waiting teammates** answer maths questions on their pads the whole time (section 3) and spend sparks on perks for their own flyer or troubles for another team.
6. **Win**: first team whose bird reaches the nest wins the race. When the race clock (`RACE_MS`, 3:30) or the session ends first, the furthest team wins. Then `SHOW_MS` (8 s) of cheers and a new race (a tighter course), until the **number of races the teacher picked** (1, 3 or 5 on the setup card, default 3; `races` in the session) is done. Podium at the end: most races won, then total distance. In a 1-race game only the race-1 perks are on; in a 5-race game all 8 unlock.

**Gentle wings** (a pupil's Toon Flap setting, or automatic for Years 1-2): that pupil's turns fly at 80% speed with slightly bigger gaps, as in Toon Flap. Distance still counts fully, so younger flyers never let their team down.

## 2. Flying, lag and checking (shared/toonflap + shared/classlive/relay.ts)

- **The flyer's pad runs the physics** (`stepRun` from `shared/toonflap/engine.ts`, 1/60 s steps) so a flap answers instantly. It sends its flap list and current step (`encodeFlaps`) every 0.4 s through a `relay_fly` step.
- **Server checks**: each `relay_fly` replays the turn so far (`replayRun` on the relay course with the effects in force, section 4) and saves the team's distance from the replay, never from the pad's claim. A turn's flap list is at most 30 s of steps, so a replay is cheap.
- **Big screen and other pads** read the saved flap lists and replay each lane locally a moment behind (0.4 to 0.8 s), drawing a smooth bird. Nobody but the flyer needs it live.
- **Effects in step time**: perks and troubles are given a **start wall**, not a clock time: an effect sent now starts at `nextWall + 1` of that flyer's run (about 1.5 s later), so the pad and the server agree exactly in the replay, and the flyer gets a short warning ("Fog incoming!").
- **Flyer leaves or drops out**: after 4 s with no `relay_fly`, the server passes the baton. If the big screen goes, pupils' `look` steps move the race on at each deadline (+1.5 s), as in other Class Live games.

## 3. Maths

- **Waiting teammates**: way A questions from each pupil's own focus (`makeQuestion`, skips `isUntimed`), kept and marked on the server, recorded with `recordMathsAnswers(..., 'classlive')`. One at a time, 1 s after the last answer. Each right answer gives **1 spark** (at most `MAX_SPARKS` 6 held). Wrong: the right answer shows with its reason for 1.5 s. Shared 1-4 keys (`src/maths/questionKeys.ts`).
- **The flyer**: no maths while flying (James): the relay course has no checks and no answer gaps. Each pupil flies about one turn in five, so they answer for the other four.
- **No farming**: sparks only buy effects; points follow the usual Class Live caps (section 6).

## 4. Perks, troubles and fairness

Perks cost **2 sparks**, troubles **3**. A pupil taps an effect on their pad. Perks go to their own flyer; troubles go to a **random other team** picked by the server (James: no aiming, so nobody can gang up).

**Perks** (for your own flyer, unlocked race by race like Ghost Tag):

| Race | New perk | What it does |
|---|---|---|
| 1 | Shield | Blocks the next bump |
| 1 | Wide gaps | Next 3 walls' gaps 30% bigger |
| 1 | Slow-mo | Course runs at 70% speed for 5 s |
| 1 | Tailwind | Bird jumps ahead one wall's distance |
| 2 | Magnet | Pulls the bird gently toward the middle of the next 2 gaps |
| 3 | Ghost wings | Fly through the next wall without a bump |
| 4 | Mini bird | Bird 25% smaller for 8 s |
| 5 | Clear sky | Ends any trouble on your flyer at once |

**Troubles** (sent to another team's flyer):

| Trouble | What it does |
|---|---|
| Wind gust | Pushes the bird down or up (arrows show which) for 5 s, like Toon Flap's gusts |
| Fog | For 5 s the flyer's pad shows only a circle around the bird; the big screen shows the cloud on that lane |
| Extra wall | One extra wall slots in 2 walls ahead (always with a fair gap) |
| Narrow gaps | Next 2 walls' gaps 20% smaller (never below Toon Flap level 10's gap) |

**Fairness rules** (server, `canSend`):

- **Random target** (`pickTarget(seed)`): the server picks among the other teams that are free (no trouble on now, not in their safe time), seeded so tests can replay it. If no team is free the Trouble button is grey ("Every team is busy!") and no sparks are spent.
- A team can have **one trouble at a time**; after it ends that team is **safe for 8 s** (`SAFE_MS`).
- Each pupil waits **10 s** between sends (`SEND_COOL`); perks and troubles share the wait.
- A team's **perks stack at most 2** at once.
- No troubles in a flyer's first 3 s of a turn (handover grace).
- **Catch-up (gentle)**: the last team's perks cost 1 less spark; the leading team's cost 1 more. The big screen shows a small "+1" / "−1" on those lanes.
- The server re-checks every rule (pads only show what's allowed).

## 5. Screens

- **Big screen** (`RelayScene.tsx`): a race bar on top (every team's bird along the course to the nest), then one lane per team (3 to 6 stacked lanes, each scrolling with its own bird over the stadium sky), the flyer's first name on their lane, perk/trouble arrows zipping between lanes, team spark totals, race clock, race-end cheer, podium.
- **Flyer's pad** (`RelayPad.tsx`, fly mode): the Toon Flap play screen full size (tap anywhere), turn timer ring, effect icons with a 1.5 s warning, team position ("2nd").
- **Waiting pad** (answer mode): question card, spark meter, perk and trouble buttons (locked ones grey with the reason), a "Sent to Blue!" pop-up after a trouble, a small race bar, "You fly in 2 turns".
- **Phones**: as Toon Flap, signs and prompts sit in a strip under the flying area.
- **No set-time version for now** (James): teacher-run with the big screen only, so `relay` stays out of the set-time list and the Kids vote list. Later it could show the race bar on pads instead (docs/plans/classlive-auto/PLAN.md).

## 6. Rewards

As the other Class Live games: 1 point for joining, 3 for a right answer, +2 for each race your team wins, at most 10. Trophies (`PupilReward.extra` → `classlive_stats.extra`): **Relay Champ** (win 10 races), **Team Player** (give 30 perks), **Trouble Maker** (send 30 troubles). Relay flights do not count toward Toon Flap unlocks (James said unlocks came too fast).

## 7. Voice and music

Bella as a sports commentator, team colours only: "And they're off!", "Red team takes the lead!", "Fog for Blue!", "Change flyers!", "Shield up, Green!", "Last stretch!", "Yellow wins the race!". She never names a pupil or calls out a bump. Clips via `scripts/voice-clips.py classlive`. Music: one upbeat stadium race track (a faster mix for the last stretch) plus a short race-start fanfare, made on James's PC (falls back to Toon Flap's level 1 track until then); sound kit `relay` (baton chime, whoosh for perks, thunder for troubles, crowd cheer).

## 8. Stages

1. **Rules and server**: `shared/classlive/relay.ts` (teams, relay course in the Stadium Sky, turns, baton, sparks, perks, troubles, fairness rules, unlocks, catch-up, win), effects inside the Toon Flap engine (`stepRun` options: speed, gap scale, extra wall, push, shield, ghost: kept out of solo Toon Flap's numbers so its replays don't change), `relayServer.ts` (steps: fly, answer, spend, look), hooks in `server.ts`, `rewards.ts`, migration (activity row `moves = false`, 3 trophies), pretend pupils (`relayBot.ts`: Toon Flap's bot flies, waiters answer and spend), test `shared/classlive/relay.test.ts` (2 tests in the Class Live budget: a whole race with bots, and the fairness rules).
2. **Screens**: `RelayScene.tsx`, `RelayPad.tsx`, `RelayBoard.tsx`, setup card / lobby / How to play (`RelayCard.tsx`, row in `gameList.ts`, group `run`), `relay.css`, Bella lines (`relayLines.ts`), sound kit, drawn stand-in icons, art plan `docs/RELAY-ART-PLAN.md`.
3. **Art and music** on James's PC: Stadium Sky world (back, middle and front layers like a Toon Flap world, stadium walls as flag towers and scoreboard pillars, the nest on a finish podium), 8 perk + 4 trouble icons, fog cloud, wind arrows, baton, team-colour flyer tints, picker card, race track + fanfare.

## Files

`shared/classlive/relay.ts`, `relayServer.ts`, `relayBot.ts`, `relay.test.ts`; `src/games/classlive/RelayScene.tsx` (big screen), `RelayPad.tsx` (iPad), `RelayCard.tsx` (setup card, lobby, How to play, How it works), `relayDraw.ts` (a lane, and `LanePlayer` that plays saved flaps), `relay.css`, `relayLines.ts` (Bella); `supabase/migrations/20261126000200_classlive_relay.sql`, `supabase/tests/database/classlive_relay.test.sql`. Try it (once built): `npx vite --config vite.classlive-preview.config.ts` (Toon Flap Relay card, "Be a pupil").
