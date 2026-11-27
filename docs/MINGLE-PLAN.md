# Maths Mingle (Class Live `mingle`)

**Status:** built 27 Nov 2026 NZ (thread "Build real-life maths games"). Live once its PR merges; see the bottom.

James's pick from the real-life games idea page (https://claude.ai/artifact/8RaUMdyJ1UbHgeF1kytrNo, 27 Nov 2026 NZ): music plays and the class mingles for real. When it stops, the big screen calls "Get into groups of 24 ÷ 6!" and everyone scrambles into groups of that size. Anyone left over goes to a station iPad, taps their name and answers their way back in.

## Agreed design

| Question | Answer |
|---|---|
| Who is left over? | Kids left out walk to a station iPad and tap their own name (honour system, as Real-life Four Corners). The teacher can tap a name on the big screen to let someone back in. |
| Getting back in | Teacher picks 3, 5 or 10 right answers (default 5), not in a row. Each pupil's own ladder questions (way A). |
| The calls | Junior (groups of 2 to 5) or senior (2 to 8) on the card. Rounds 1 to 3 easy, 4 to 6 middle, then hard (`tierOf`). Never the same size twice running. Shown only on the big screen. |
| Twists | Fun twists on by default ("…standing on one leg!"): about one round in four, never two in a row. |
| Music | Musical Thrones' dance tracks, one hall per round; music stops on the call. Random 8 to 20 s, or the teacher taps Stop now (S). |
| Length | The teacher's usual timer chips. |
| Points | Same as other Class Live games (3 for answering right at a station). Trophy "Back in the Groove": back in 10 times. |
| Lobby games | No: the class list is the class's ("My class" only). Not a set-time game. |

Questions to James are on cards in the thread; the build follows my recommended answers until he picks.

## Files

- Calls `shared/classlive/mingle.ts` (pure). Station rules are Real-life Four Corners' (`jail.ts`, `jailServer.ts`): the game is a `JailGame` with `mode: 'mingle'`, `level`, `twists`.
- Server: `server.ts` activity `mingle` opens `newJail(…, { level, twists })`; rewards `extra.mingle_backs`.
- Big screen `src/games/classlive/MingleScene.tsx` + `mingle.css` (rounds run only on the big screen: nothing in them counts); card and lobby `MingleCard.tsx`; station `JailPad.tsx` (mingle words).
- Migration `20261127205117_classlive_mingle.sql`: activity row, trophy.
- Bella: `LINES.mingleStop/mingleDance/mingleLeft/mingleEnd`, `MINGLE_SIZE_LINES`, `HOWTO.mingle` (clips recorded).
- Test: second test in `shared/classlive/jail.test.ts`.
- Preview: `npx vite --config vite.classlive-preview.config.ts`, `?pick=mingle`.

## Art

Stand-ins: Musical Thrones' hall backdrops and picker tile. Picker tile to paint: `docs/mingle-art/config.json`.
