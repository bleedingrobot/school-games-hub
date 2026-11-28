# Stand Up If (Class Live `stand`)

**Status:** built 29 Nov 2026 NZ (thread "Build Stand Up If real-life game"). Live once its PR merges.

James's third pick from the real-life games idea page (https://claude.ai/artifact/8RaUMdyJ1UbHgeF1kytrNo): "Stand up if your answer is bigger than 50." Everyone answers on their own iPad (a class set), then stands or sits to reveal. Built around greater than and less than signs (James, 27 Nov 2026).

## Agreed design

| Question | Answer |
|---|---|
| Devices | One iPad each: pupils sign in and join as usual ("My class" only). |
| The call | Each round the big screen shows one sign, huge: "Stand up if your answer > your number". Junior: > and <. Senior: > < ≥ ≤. Never the same sign twice running. Chomp the crocodile gives a tip for the sign. |
| Questions | Each pupil's own ladder question (way A, `nextQuestion`). Their number is made from their right answer (`targetFor`: within about a quarter, in the answer's own steps; seniors sometimes get the answer itself, so "or equal to" matters and > with an equal number means sit). A class-wide number like 50 can't suit every ladder level, so each pupil has their own. |
| Stand or Sit | James, 28 Nov 2026: kids press a button. They type the answer (the shared pop-up shows right or wrong), then tap Stand or Sit, changeable until the countdown. Once everyone has tapped, the countdown starts 1.5 s later; the teacher's Go (Space) starts it now. |
| The reveal | "3, 2, 1, stand up or sit down!" and everyone shows it for real; the iPad says "Stand up!" or "Stay sitting!" to match their tap. Then each iPad shows right or not ("42 > 40 is true, so stand") and the streak. |
| Streak | James, 28 Nov 2026: each iPad keeps how many right in a row. Right = right answer and the right tap. A wrong round, or missing a round they were in for, starts it again. |
| Times | Thinking 20, 30, 45 or 60 s (default 30), countdown 4 s, results 9 s. Length: the teacher's timer chips (default 5 min). |
| Big screen | Only how many got it right and the longest streak in the room (no names: nobody is ranked by maths). |
| Points | Same as other Class Live games: joined 1, a round right 3, +2 for the room's longest streak (3 or more). Trophies "Sign Spotter" (25 rounds right) and "Stand Tall" (5 in a row). |

## Files

- Rules `shared/classlive/stand.ts` (pure): `newStand`, `advanceStand`, `targetFor`, `holds`, `standAnswer`, `standChoose`, `standGo`.
- Server `shared/classlive/standServer.ts` (`standStep`, `standPublic`, `standPlayer`), wired in `server.ts` (clock in `mutate`, `standgo` teacher step); rewards `extra.stand_spots`, `stand_streaks`.
- Big screen `src/games/classlive/StandScene.tsx`, iPad `StandPad.tsx`, card and lobby `StandCard.tsx`, styles `stand.css` (prefix `su-`).
- Migration `20261129084320_classlive_stand.sql`: activity row, 2 trophies.
- Bella: `LINES.standThink/standAllIn/standCount/standReveal/standEnd`, `STAND_SIGN_LINES`, `HOWTO.stand`.
- Test `shared/classlive/stand.test.ts`; pretend pupils in `pretendClass.ts` (`standBot`).
- Art: picker tile `pick/stand` and backdrop `stand/back`, painted 29 Nov 2026 (`docs/stand-art/config.json`, picks in `picks.json`). Music falls back to Hill's track until `stand` and `stand-hot` are made.
- Preview: `npx vite --config vite.classlive-preview.config.ts`, `?pretend=20&pick=stand`.
