# Rocket Relay (Class Live `rocket`)

**Status:** built 27 Nov 2026 NZ (thread "Build real-life maths games"). Live once its PR merges.

James's second pick from the real-life games idea page (https://claude.ai/artifact/8RaUMdyJ1UbHgeF1kytrNo, 27 Nov 2026 NZ): a real running relay. Teams line up at one end of the hall or field; each team's iPad sits at the other end. The runner sprints to the iPad, taps "I'm here", answers, runs back and tags the next runner. Every right answer boosts the team's rocket on the big screen. First to the Moon wins.

## Agreed design (James's card answers, 27 Nov 2026)

| Question | Answer |
|---|---|
| Teams | The site makes the teams from the class list (2 to 6, default 4), dealt at random. Every runner gets questions at their own ladder level, so random teams are fair. |
| Station | Any device that joined the room; it picks its team once (kept in sessionStorage). It sends steps `as` the runner, who joins the room the first time they check in, so points and maths go to them. "Not here today?" skips a runner. |
| Wrong answer | One more try, then run back. Right first time: a full boost (`BOOST` 2). Right on the second try: a small boost (`SMALL_BOOST` 1). Wrong twice: run over, nothing. |
| Questions per run | Teacher picks 1, 2 or 3 (default 1). |
| Race end | The Moon, or time's up (the teacher's usual timer chips): then the highest rocket wins, and a tie has no winner. The Moon is the biggest team's size × 3 laps × questions per run × a full boost. |
| Points | Same as other Class Live games: joined 1, a right answer 3, the winning team +2. Trophies "Relay Runner" (10 legs) and "Moon Landing" (3 wins). |
| Lobby games | No: the class list is the class's ("My class" only). Not a set-time game. |

## Files

- Rules `shared/classlive/rocket.ts` (pure): `newRocket`, `checkIn`, `skip`, `answer`, `rocketPlaces`, `winningTeam`.
- Server `shared/classlive/rocketServer.ts` (`rocketStep`, `rocketPublic`), wired in `server.ts`; rewards `extra.rocket_runs`, `rocket_wins`.
- A check-in has no event, so the step names the runner in `players`: otherwise `mutate` sees no change and doesn't save it.
- Big screen `src/games/classlive/RocketScene.tsx`, station `RocketPad.tsx`, card and lobby `RocketCard.tsx`, styles `rocket.css` (prefix `rk-`).
- Migration `20261127213026_classlive_rocket.sql`: activity row, 2 trophies.
- Bella: `LINES.rocketBoost/rocketEnd`, `ROCKET_MOON_LINES`, `HOWTO.rocket` (clips recorded).
- Test `shared/classlive/rocket.test.ts`; pretend runners in `pretendClass.ts` (`rocketBot`).
- Art: picker tile `pick/rocket` (`docs/rocket-art/config.json`); the big screen falls back to `back/star-sky`. Music falls back to Sky Climb's track until `rocket` and `rocket-hot` are made.
- Preview: `npx vite --config vite.classlive-preview.config.ts`, `?pretend=20&pick=rocket`.
