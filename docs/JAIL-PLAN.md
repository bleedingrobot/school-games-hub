# Real-life Four Corners (Class Live `jail`)

**Status:** built 27 Nov 2026 NZ (thread "Build hybrid real-life Four Corners"). Live once its PR merges; see the bottom.

James's idea (27 Nov 2026 NZ): the class plays Four Corners for real in the room. A few iPads sit in the middle as jail stations. A pupil who is out runs to a station, taps their own name, answers questions, and when they get enough right the big screen flashes their name and Bella says they're back in.

## Agreed design (James picked "Build it as a Class Live game")

| Question | Answer |
|---|---|
| Who is on the stations? | Every pupil of the class (the class list, read when the room opens), not just pupils who joined. Tapping a name needs no sign-in. |
| Which iPads are stations? | Any device that joined the game as usual. Pupils sign in and join, then the iPads go in the middle. |
| Points and maths | Go to the pupil who tapped their name (they join the room on that station the first time). Answers are recorded to them. |
| How many right? | Teacher picks 3, 5 or 10 on the card (default 5). Not in a row. |
| Wrong tap | "Are you <name>?" first; "Not you?" on the question screen takes the name off the jail list. The teacher can tap a name on the big screen to let someone out (no flash). |
| Big screen | The classroom page James played with (artifact AsFYTDr4fBKNLQ2puJevxn, /mnt/project-files/four-corners-room/index.html), moved in nearly line for line: painted maps, te reo corners (Tahi Yellow 1, Rua Red 2, Toru Blue 3, Whā Green 4), countdown with te reo numbers, music turning hot at 5 s, FREEZE, dice, OUT stamp, twists and settings. Plus a jail list (names only, never scores), the late code, End, and a big green "<name> is back in!" flash with confetti and Bella. |
| Countdown and dice | Only on the big screen (nothing goes to the server). |
| Lobby games | No: the class list is the class's, so it's "My class" only. Not a set-time game (it needs a big screen and a teacher). |

## Files

- Rules `shared/classlive/jail.ts`; server steps `shared/classlive/jailServer.ts` (every pupil step carries `as`, the pupil on the class list); wired in `server.ts` (open reads `classPupils`, teacher action `jailfree`).
- Big screen `src/games/classlive/jailStage.ts` (the classroom page in a shadow root) and `JailScene.tsx`; station `JailPad.tsx`; card and lobby `JailCard.tsx`; styles `jail.css`.
- Migration `20261127173309_classlive_jail.sql`: the activity row, `classlive_class_pupils(class)` (server only), trophy Jailbreak (10 comebacks, measure `classlive_jail_backs`).
- Bella: `LINES.backIn` and `HOWTO.jail` in `voiceLines.ts` (clips recorded).
- Test: `shared/classlive/jail.test.ts` (one server test).
- Preview: `npx vite --config vite.classlive-preview.config.ts`, pick Real-life Four Corners; pretend pupils go to jail and answer their way out.

## Art

Uses Four Corners' paintings (maps, backdrops, dice, jail rooms for the stations) and music. New: the picker tile `src/games/classlive/art/paint/pick/jail.webp` (+ `-800`); until it is painted the tile shows the jungle jail.
