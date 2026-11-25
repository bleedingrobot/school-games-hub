# Saboteur Crew (Class Live activity `crew`)

**Status: PLAN ONLY (25 Nov 2026 NZ). Not built. James says when to build.** Migration: pick the next free number when building (`node scripts/migration-numbers.mjs`); it only INSERTs (docs/CLASSLIVE-PLAN.md section 5, "Adding an activity").

James's idea (25 Nov 2026 NZ): an original hidden-role Class Live game. Every pupil runs their own hub avatar around a robot factory, keeping the machines running by answering maths questions. A few pupils are secretly **Glitches** who jam machines. The teacher calls a meeting, the class talks it over and votes someone off. Built on Four Corners / Ghost Tag (docs/CORNERS-PLAN.md, docs/GHOST-PLAN.md): same room, joystick, saved spots, lobby codes, timers, music, Bella, rewards.

Kind by design: the hidden role is a playful part ("a Glitch in the factory"), never "bad" or "the baddie"; votes are secret; nobody is knocked out of play; Bella never names who voted for whom. Original: our own name, factory, robots and art; no names, characters, look or sounds from any existing game.

## James's answers (question cards, 25 Nov 2026 NZ)

| Question | Answer |
|---|---|
| Hidden team's name | **Glitches** (everyone else is the **Crew**) |
| Map | **Robot factory**, one map to launch |
| Glitches per round | 1 for every 8 pupils (at least 1, at most 4, never more than a third) |
| Glitches' maths | **None**: Glitches walk and jam (their pad still looks busy, see below) |
| Jamming | **Delayed jam**: tap Jam beside a machine, it starts sparking 4 s later |
| Fixing | **Answers fill a bar**: each right answer fills the machine part way; small machines need 2, big ones 3 |
| No machine jammed | **Daily jobs**: each Crew pupil has 4 jobs at different machines; a right answer there fills the factory's power bar |
| Meetings | **Teacher only** (big screen button) |
| Talking | **Out loud, 40 s** on a big-screen timer; no typing on pads |
| Voting | **Secret vote on pads**: tap a face or Skip; big screen shows counts only; most votes is sent off, a tie (or Skip winning) sends nobody |
| Voted off | Becomes a **helper drone**: keeps playing, can't vote |
| Reveal | **Yes, kindly, straight away** ("Ava was a Glitch!" / "Ava was Crew. Beep boop, drone mode on!") |
| Winning | **Power bar vs Glitches**: Crew win by filling the power bar or sending off every Glitch; Glitches win if 4 machines are jammed at once or the round's time runs out |
| Round | **4 minutes**; rounds repeat until the Class Live timer ends, new Glitches each round |
| Glitch tricks | **Lights out from round 3** (unlocked round by round) |
| Crew power-ups | **Yes, unlocked by round** |
| Big screen | **Whole map, roles hidden** |
| Years | **All years**, each pupil's own maths focus |
| Rewards | **Same as other Class Live games** |
| Voice and music | **Bella as the factory computer**; factory music, a tense version when 3 machines are jammed |

## Rules (shared/classlive/crew.ts)

- Board is a unit square: the factory floor with rooms (Assembly, Paint Shop, Boiler Room, Sorting Belt, Battery Bay, Control Room, Packing Dock, Canteen as the meeting room in the middle). **8 machines** (`MACHINES`): 5 small (fix 2), 3 big (fix 3), each with a spot and a reach `REACH_R` (0.08).
- **Start of a round**: everyone in the Canteen; roles dealt (`glitchCount(n) = clamp(round(n/8), 1, min(4, floor(n/3)))`; those who were Glitch fewest times go first). Each pad shows a private role card for 4 s ("You're Crew!" / "You're a Glitch! Jam machines, stay sneaky."). Glitches see each other (small spark above their heads, on their own pads only).
- **Power bar** (0 to 100): each right job answer adds `JOB_POWER`, scaled to class size so a busy class fills it in about 3 of the 4 minutes with no jams. Each jammed machine drains `DRAIN` a second. Crew win at 100.
- **Jobs**: each Crew pupil gets 4 jobs (different machines, spread over the map), shown as a list and arrows on their pad. At a job machine they get a question; a right answer ticks the job and adds power. After 4 jobs they get 4 new ones.
- **Jam**: a Glitch within reach of a working machine taps Jam. It is saved on the server at once but the machine only starts sparking `JAM_DELAY` (4 s) later. Each Glitch then waits `JAM_COOL` (20 s). A machine fixed in the last 10 s can't be jammed again.
- **Fix**: anyone (Crew or drone) in reach of a sparking machine gets fix questions; each right answer fills its fix bar one step (2 or 3 steps). Several pupils can fix together. A full bar mends it.
- **Glitches win** when 4 machines are sparking at once, or the 4 minutes run out before the power bar is full. **Crew win** at 100 power or when every Glitch has been sent off.
- **Glitches' pad**: no maths (James). To keep it fair, a Glitch's pad looks like a Crew pad from a distance: the same job list and arrows ("fake jobs"); at a fake job they hold a Work button for 3 s while a progress bar fills (adds no power). Jam is a second button that shows only when in reach.
- **Meeting** (teacher only): the teacher taps "Call meeting" on the big screen (or presses M). Everyone is pulled to the Canteen, the clock pauses, sparking stops draining. The big screen shows the sparking machines and a 40 s talk timer (teacher can skip or add 20 s). When 3 machines are sparking, the big screen nudges the teacher: "3 machines down! Call a meeting?" (no auto meeting).
- **Vote** (15 s after the talk): pads show the faces of everyone still on the floor, plus Skip. Drones don't vote. Counts only on the big screen, never who voted for whom; the server never sends votes to any pad. Most votes is sent off; a tie or Skip winning sends nobody ("No one was sent off. Back to work!").
- **Sent off**: a friendly reveal animation (robot arm lifts the avatar onto a belt, sign flips to "Glitch!" or "Crew"). They become a **helper drone** (little hover robot wearing their avatar's face) for the rest of the round: can't vote, can't jam. A Crew drone keeps doing jobs and fixes. A Glitch drone answers maths questions too: each right answer shortens the other Glitches' jam wait by 3 s (so every sent-off pupil does maths).
- **Round end**: winners' side cheers, everyone's role is shown, then `SHOW_MS` (8 s) and a new round. When the session's time is up a running round ends at once (power bar decides: over 50 is a Crew win).
- **Score**: rounds won, then right answers (Crew) / jams (Glitches) for the shout-outs. Podium shares ties.
- **Mechanics** (`UNLOCK`, round by round like Ghost Tag): round 1 jobs, jams, fixes; round 2 power-up crates (Crew only, picked up by walking over; a right answer switches it on): speed boots (6 s), camera console (shows the whole map with all avatars on your pad for 8 s), toolkit (next fix answer mends a machine fully); round 3 **lights out** (each Glitch once a round: everyone's pad sees only `LIGHT_R` 0.2 around them for 8 s, the big screen dims to torch circles; Crew can switch the lights back on early with 2 right answers at the Control Room); round 4 conveyor belts (carry avatars along); round 5 sliding doors that close for 5 s now and then; from round 6 a mix of 2 to 4.

## Maths

Way A from each pupil's focus (`makeQuestion`, skips `isUntimed` skills), kept and marked on the server (`crewServer.ts`), recorded with `recordMathsAnswers(..., 'classlive')` like Ghost Tag. One question at a time, 1.5 s after the last answer; questions only at a job, a sparking machine, the Control Room light switch, or to switch on a power-up (drones anywhere). Wrong answer: the right answer shows for 1.5 s, then a new question. Question pop-ups use the shared 1-4 keys (`src/maths/questionKeys.ts`).

## Movement and lag

As Ghost Tag: devices move their avatar at once and save the spot through `classlive_move` (activity row `moves = true`, `max_speed` 0.6) every 0.4 s; the big screen reads `classlive_positions` every 0.3 s and steps the game (`view`) every 0.5 s (jam timers, drain, round end). Glitch status is never in anything a Crew pad receives (positions carry no roles; the Glitch spark only goes to Glitch pads). During lights out a pad only gets spots within `LIGHT_R` (a small `classlive_crew_move` wrapper, like `classlive_ghost_move`). If the big screen is gone, a pupil's `look` moves the game on at each deadline (+1.5 s).

## Rewards

As the other Class Live games: 1 point for joining, 3 for a right answer or (Glitches, who do no maths) a jam that sparks, +2 for being on the winning side in any round, at most 10. Trophies (PupilReward.extra → classlive_stats.extra): **Chief Engineer** (fix 25 machines), **Sharp Detective** (vote for a Glitch 10 times), **Master Glitch** (win 5 rounds as a Glitch).

## Voice and music

Bella is the factory computer ("Beep! Machine down in the Paint Shop.", "Meeting in the Canteen!", "Vote now.", "The Crew powered up the factory!", "The Glitches jammed the factory!"). Bella never says who voted for whom and reads the reveal only as "That was a Glitch!" / "That was Crew." (names stay on screen). Clips via `scripts/voice-clips.py classlive`. Music `crew-factory` and `crew-factory-hot` (3 machines sparking), made on James's PC (falls back to the boss tracks until then). Sound kit `crew`: clanks, sparks, alarm siren for meetings, power-up hum.

## Stages

1. **Rules and server**: `shared/classlive/crew.ts` (roles, jobs, jams, fixes, power bar, votes, unlocks), `crewServer.ts` (pupil steps: move, job, jam, fix, vote, power-up), hooks in `server.ts` (`mutate`, `newSession`, join, look, routing), `rewards.ts`, migration (activity row + 3 trophies + `classlive_crew_move`), pretend pupils (`crewBot.ts`: run to jobs, fix, Glitches jam, random votes), test `shared/classlive/crew.test.ts` (2 tests in the Class Live budget).
2. **Screens**: big screen `CrewScene.tsx` (factory, power bar, sparking machines, meeting room, vote counts, reveal, round end, podium), pupil pad `CrewPad.tsx` (joystick, role card, job list and arrows, question pop-up, Jam / Work buttons, vote faces, drone mode), `CrewBoard.tsx`, setup card / lobby / How to play / help page (`CrewCard.tsx`, row in `gameList.ts`, group `run`), `crew.css`, Bella lines (`crewLines.ts`), sound kit, drawn stand-in art, art plan `docs/CREW-ART-PLAN.md` + `docs/crew-art/config.json`.
3. **Art and music** on James's PC: factory map, backdrop, picker card, 8 machines (working + sparking), drone, power-ups, lights-out overlay, reveal sign, 2 music tracks.

## Files (planned)

`shared/classlive/crew.ts`, `crewServer.ts`, `crewBot.ts`, `crew.test.ts`; `src/games/classlive/CrewScene.tsx`, `CrewPad.tsx`, `CrewBoard.tsx`, `CrewCard.tsx`, `crew.css`, `crewLines.ts`. Try it (once built): `npx vite --config vite.classlive-preview.config.ts` (Saboteur Crew card, "Be a pupil").
