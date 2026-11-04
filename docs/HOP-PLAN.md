# Hop's Glow-worm Pond (skip counting) — plan

Short id `hop`. Branch `hop`, worktree `~/games-hub-hop`. **Stages 1 (rules), 2 (play screen, stand-in art) and 3 (server) done, 4 Nov 2026; next is painting the art (section 5, the evening of 4 Nov), then Stage 4 (hub and teacher).** The shared skip-counting maths is live (PR #163). Name on the home card:
**Hop's Glow-worm Pond** (James, 4 Nov).

**For younger children (about 5 to 7)**, like Kiwi's Beanstalk, and built the same way. Wherever this plan doesn't say
otherwise, it does what `docs/BEANSTALK-PLAN.md` on the `beanstalk` branch does: reading aloud, no hub points, a per-class
switch, and days that are counted rather than dates.

## 1. The game in plain words

Hop is a little New Zealand native frog. He wants to cross a dark pond to reach the Glow-worm Party on the far bank, but
he can only jump in equal hops. The pond is a number line: lily pads float across it, evenly spaced, each with a number.

- **Today's challenge.** A row of pads counts in equal steps (for example 2, 4, _, 8). One pad is empty and glowing.
  Glow-worms float nearby, each carrying a number. The child taps the glow-worm with the right number, and Hop jumps
  onto the pad. Every jump is the same length, with the step ("+2") shown above the arc. A wrong glow-worm wobbles and
  drifts back, with no penalty. About 10 hops finish the challenge. Hop reaches the far bank, does his big flip, and
  catches the glow-worms.
- **The magic pads.** The way home to the party has 10 big lily pads. On each day a child finishes the challenge, one
  pad changes colour, and it stays changed:
  - Days 1 to 10 turn the pads bronze.
  - Days 11 to 20 turn them silver.
  - Days 21 to 30 turn them gold.

  As extra scenery, the water turns into a sparkling silver river on silver days, and the forest lights up on gold days.
  The thing to watch is always the 10 pads (James, 4 Nov).
- **The win.** When all 10 pads are gold, Hop gets to the Glow-worm Party and the child gets **the Golden Glow Jar**.
  Next time they play, a new New Zealand friend (a gecko, a wētā and so on) needs to cross a fresh pond, and the 30 days
  start again, the same as Beanstalk (James, 4 Nov). Those friends are painted later.
- **Days are counted, not dates.** This uses the same rule as Beanstalk: at most one pad changes per NZ day (`nzDate`).

## 2. The maths

- **Skip counting by 10s, 5s and 2s.** This is NZ Year 1 to 2 work. The game doesn't claim to teach multiplication,
  but it leads towards the ×2, ×5 and ×10 tables.
- **The child moves up when ready (James, 4 Nov).** Everyone starts on 10s. The server moves a child on to 5s, then 2s,
  once they get them right, using their focus the way Beanstalk does (the guide's way A). The pad colour doesn't decide
  the step.
- **Question kinds (James, 4 Nov):**
  - **Missing pad:** 2, 4, _, 8.
  - **What comes next:** 2, 4, 6, _.
  - **Counting back, on gold days only:** 10, 8, _, 4, as Hop hops home.
  - Starts not on a multiple of the step (3, 5, 7…) are not used.
- **Number range:** 10s up to 100, 5s up to 50, 2s up to 20 to start with, and possibly 30 later.
- **Wrong choices** sit next to the right answer: one more or one less (7 instead of 8), the wrong step (5 instead of
  6), and the number that is already shown.
- **Help that fades:** this matches Beanstalk's fading dots. On bronze days each pad shows its number and the hop is
  drawn with its step ("+2"). On silver days the step label is faint. On gold days there is no step label.
- **This needs new shared maths.** No early skip-counting questions exist yet. `shared/maths/skillPacks/patterns.ts`
  is pitched at Year 4 to 6 (it starts anywhere up to 30, with steps up to 10). The proposal is a new family in
  `earlyFacts.ts`, with keys like `skip10:up:40`, `skip5:next:25` and `skip2:back:8`, and a ladder skill `skip-count`
  set before `tables-2-5-10`. **Under the guide, `shared/maths` can't be changed from a game branch,** so this is its own
  small branch. James OK'd it on 4 Nov. It goes live on its own, before Hop.

## 3. Rules as pure functions (`shared/hop/`)

- `round.ts`: given a seed and the focus, gives today's hops: the row of pads, the gap, the right answer and the
  glow-worm choices.
- `play.ts`: given a round and the taps, gives the hops made, the mistakes, and whether the round is done.
- `progress.ts`: given the days completed, gives each pad's colour, the help level and the jar count. Copied from Beanstalk's
  `progress.ts` (`pondAfter`, `finishChallenge`, `nzDate`), as Beanstalk isn't live yet.

**How the step is picked (Stage 1, 4 Nov).** Hop makes its own rounds from the shared `skip*` keys, the way Beanstalk does
with `bond10`, rather than through `makeFocusPack`: a 5-year-old on auto is usually still on `facts-10`, so the ladder would
never serve them skip counting. `stepFor(records, reached)` gives the first of 10s, 5s, 2s whose counting-up and
what-comes-next facts are under 70% secure (box 2 or higher, the hub's rule). Counting back is left out of that share,
because it is only asked on gold days (9 of each step's 26 keys are `back`, so counting them would keep every child on 10s
until day 21). The server keeps the furthest step reached (`reached`, saved in `hop_progress` at Stage 3), so a child never
drops back a step. Once 2s are secure the child stays on 2s.

**A round** (`makeRound(seed, records, { reached, gold })`) is 10 different facts of today's step, weakest first (ties by
the seed), in a shuffled order. On gold days the last 3 hops count back, as Hop hops home. The shared family rolls each
question's numbers from the seed, and `showHop`/`showRound` make the pads, words and four glow-worms with the shared pack's
`rebuild`. The server saves the round's hops when it starts (`hop_rounds`), so the records changing later doesn't matter.
**Replay** (`play.ts`): a tap is the number picked for the current hop. Each hop counts once in the maths records: right if
the first glow-worm picked was right, with that pick's time. Wrong picks wobble and are counted as mistakes only.

## 4. Server, tables, switches

The same shape as Beanstalk:
- **Tables:** `hop_progress` and `hop_rounds`.
- **Function** `supabase/functions/hop/` with four calls: `load`, `start`, `finish`, plus a teacher help setting.
- **Switches:** a code switch `HOP_ON`, plus the per-class switch `hop_enabled`, which is off by default.
- **Group:** `easy-maths`.
- **Migration:** the next free number on 4 Nov is `20261104000600`. Check it again at Stage 3.

## 5. Art (ComfyUI on the gaming PC)

**Clay style, the same as Beanstalk,** so the two junior games look like a pair. The scene is at night, but every
number sits on a light pad or a light glow-worm with dark text, so it reads well on a Chromebook.

The set to paint (around 2 to 6 tries each):

| Picture | Versions | Notes |
|---|---|---|
| Hop the frog | wait, crouch, leap (mid-air), flip/cheer, wave | Green native frog, big friendly eyes, clay. Transparent background. |
| Lily pad | green, bronze, silver, gold | Seen from above at a slight angle, flat enough for a number on top. Metals vivid and shiny, like Beanstalk's leaves. |
| Empty "gap" pad | 1 | A pale glowing outline or ring, clearly "something goes here". |
| Glow-worm | float, cheer | Carries a number on a light glowing bead or blob. Cute, not wormy. |
| Night pond background | dark blue, silver river | Wide, so it can scroll sideways. Bush edges, ferns, a starry sky. |
| Far bank: the Glow-worm Party | 1 | A cave mouth or bush bank with glow-worm threads, lanterns and a small party. |
| Lit forest overlay | 1 | Gold-day glow over the bush edges. |
| Golden Glow Jar | on its own, on a cushion | A gold jar or lantern full of glowing worms. |
| Home card | 1 (+ small) | Hop mid-leap over glowing pads. |
| Extras | sparkle, splash ring, glow dot | Small effects. |

Numbers are drawn in code, never painted. **The script is written: `scripts/hop-art.py`** (copied from Beanstalk's, clay
style only; `python3 scripts/hop-art.py list` names all 33 pictures). For the evening on the gaming PC:
1. Style try: `python3 scripts/hop-art.py paint ~/dragon-art-inbox/hop-art/set scene --tries 4`.
2. The rest: `python3 scripts/hop-art.py paint ~/dragon-art-inbox/hop-art/set --tries 3` (or name some pictures).
3. Write the chosen try of each into `docs/hop-art/picks.json` (`{"hop-wait": 2, ...}`), then
   `~/.cache/rembg-venv/bin/python scripts/hop-art.py tidy`. It writes WebP files to `src/games/hop/art/paint/`
   (`friends/`, `pads/`, `things/`, `back/`) and the home card to `src/assets/home/hop.webp`.
The game picks each picture up as soon as it is there (`src/games/hop/art.ts`); until then it draws a stand-in in code.
Friends' scarves: Hop blue, gecko red, wētā green, tuatara orange, kiwi yellow, ruru purple.

## 6. Shared files touched (at the end, one line each)

The registry, `gameCardArt`, `FUNCTIONS`, privacy, `hub_games` and the teacher settings list. The skip-counting
questions are a separate `shared/maths` branch (section 2).

## 7. Stages

0. Plan (this file).
1. Rules in `shared/hop/`, and their tests. **Done 4 Nov.** The `shared/maths` skip-counting branch went live first (PR #163).
2. The play screen: pads, glow-worms, the jump, the fading help. A preview for James. **Done 4 Nov (stand-in art).**
3. The server: migration, function, maths recording and the day rule. **Done 4 Nov.**
4. The hub and teacher settings, the guided first go, the pads changing colour, and the jar moment. **Done 4 Nov (not live).**
5. Go live, one step at a time, on James's word. This comes after Beanstalk is live, so its pattern is proven.

## Stage 2 results (4 Nov)

**What was built:** `src/games/hop/` and the preview `preview/hop/` (`npx vite --config vite.hop-preview.config.ts`, or
`npm run hop:single` for one HTML file; also published as a private try-out page, https://claude.ai/artifact/Pgag3omCMSV8rYnuNt7E33).
- **Home:** the night pond with the 10 magic pads curving to the Glow-worm Party, Hop waving on the near bank, "Day N of
  30", "Counting in tens/fives/twos", Play, and the shelf of jars.
- **Play:** 10 pips, the question ("What is missing?" / "What comes next?"), the row of 4 or 5 pads with Hop on the pad
  before the glowing gap, the arcs between pads with the step ("+10", "−2" counting back): full on bronze days, faint on
  silver, none on gold. Four glow-worms with numbers on glowing beads; the right one flies to the pad and Hop jumps; a
  wrong one wobbles. Each hop is read aloud with the shared pack's words.
- **Finish:** the changed pad glows with Hop on it, "Next time we count in fives!" when the step moved up, and on day 30
  Hop at the party and the Golden Glow Jar.
- **Voice** (`hop-voice`, on unless turned off) and **sounds** (the hub's setting), as Beanstalk.
- **Trial backend** (`backend.ts`) runs `shared/hop/` in the browser, with its own maths records, so the step really moves
  up. Preview tools: pretend tomorrow, jump to day N, count in 10s/5s/2s, start again. Stage 3 swaps it for the server.
- **Art:** stand-ins drawn in code (frog, pads, glow-worms, the night, the cave), replaced by the paintings when tidied.

**Tests:** 6: the 4 rule tests, 1 accessibility test (contrast, big targets, reduced motion) and 1 whole trial game.

## Stage 3 results (4 Nov)

**Migration** `20261104000600_hop.sql` (the next free number across `main` and every branch on 4 Nov; check again at go-live):
- `hop_progress`: one row a pupil. The count of finished days, the NZ day a pad last changed, the furthest step reached
  (10, 5 or 2) and a version, so two tabs can't both save. Made by the pupil's first `start`.
- `hop_rounds`: one row a challenge. Its seed, step, gold-day flag and **its ten hops as the server made them** (the round
  depends on the pupil's records at that moment, so it is kept rather than made again from the seed). Once finished: the
  taps and the wrong glow-worms. A seed is used once per pupil, a challenge finishes once, finished ones over 30 days go.
- Both tables have RLS on, no policy and no grant. Pupils can't read them or call the server's functions.
- `hop_finish` only lets the finished days stay or go up by one, and the step reached only stay or move on (`hop_step_rank`).
- The switch `app_settings.hop_enabled` (off to start) and `hop_labels` (step labels, on to start), set by
  `teacher_set_hop(enabled, labels, target_class)`.
- No `hub_games` row, achievement or teacher lines yet: those are Stage 4's own migration.

**Function** `supabase/functions/hop/` (`handler.ts`, `entry.ts`, the built `index.ts`), with its rules in
`shared/hop/server.ts`, the same file the preview runs (`shared/hop/memoryServices.ts` stands in for the database):
- `load` gives the finished days, the last pad day, today's NZ date by the server's clock, the step for next time and the
  class's step-label setting.
- `start` reads the pupil's records (`space_maths_context`, the same as every maths game), makes the round
  (`makeRound`, gold days from the saved days) and keeps it.
- `finish` checks the challenge is the pupil's and still open, replays the taps on the kept round, refuses anything odd or
  unfinished, changes a pad with `finishChallenge` and the server's NZ date, works out the step for next time from the
  records plus this round's answers, and saves. Each hop is recorded once with `recordMathsAnswers` (`hop:<seed>`), right
  only if the first glow-worm picked was right.
- Every call checks the teacher's switch first. Signed out gets 401, over 30 requests a minute gets 429.
- Load: about 3 requests a child a lesson (load, start, finish); `load` and `start` each read the maths records once.
- Not yet in `FUNCTIONS` (scripts/build-functions.mjs): that is a shared file, added at go-live with the others.

**The game** shows step labels only when the teacher allows them. `src/data/hop.ts` is the caller for the real server,
ready for Stage 4. Preview tools add "The teacher lets the hops show their step".

**Tests:** 8 of 8: 4 rule tests, 2 screen tests and 2 server tests (only a pupil's own finished challenge counts, once,
each hop against its skip-counting fact, and the step never drops back; one pad a NZ day by the server's clock, with
counting back and the jar on gold days), plus the "index.ts is up to date" check.
`supabase/tests/database/hop.test.sql` has 26 checks. There is no local database in the cloud session, so it runs in CI's
"Database checks" on the draft pull request.

## Stage 4 results (4 Nov)

**Migration** `20261104000900_hop_hub.sql` (next free number across `main` and every branch on 4 Nov; check again at go-live):
- `hub_games` row `hop` with its hooks: `hop_counts` (Golden Glow Jars, one per 30 finished days), `hop_point_rules` ("No
  points"), `hop_players_list`, `hop_last_played`; no season function, and `keep_achievements` on, so New Season leaves
  the pond alone. Switch column `hop_enabled`.
- Six achievements, one per Golden Glow Jar, one per friend in order (Hop, Gecko, Wētā, Tuatara, Kiwi, Ruru; `hop_jars`
  1 to 6). No hub points. The function already tells the hub when a jar is won (`game_progress_changed`).
- The teacher's lines: `teacher_hop_class` (pupils playing, jars won) and `teacher_hop_student` (days done, last pad day,
  furthest step reached 10/5/2, last played). Teachers only; a pupil can't read a classmate's.
- Nothing shared is re-created.

**The game in the hub:** `src/games/hop/index.tsx` (group `easy-maths`, not ranked, no bots), `switch.ts` (the code switch
`HOP_ON`, OFF; `VITE_HOP_ON=true` shows it on your own computer; plus `useTeacherSwitch` reading `hop_enabled`),
`HopPlay.tsx` (the real server through `src/data/hop.ts`; the preview still uses the trial backend) and a Home button
back to the hub. `src/data/hop.ts` also has the teacher's reads and `teacher_set_hop` saves.

**The teacher:** `teacher.ts` and `src/pages/TeacherHop.tsx`: the On switch in the Games table row (with its "?"), a Maths
column line ("Skip counting · N playing · N Golden Glow Jars"), a "Step labels on the hops" drawer (`hop_labels`), and on a
student's page a line that opens to their pond (pads by colour, step reached, last pad change, last played, jars).

**Guided first go:** on a child's very first challenge (no finished days, no pad day yet) a pointing hand sits on the
right glow-worm on the first hop, and the first hop is read with "Start with the glow-worm the hand points to". It goes
once that hop is answered. The pad-change moment and the jar moment are unchanged and run on the server's result, which the
trial backend already mirrors.

**Housekeeping:** `Art.tsx` renamed `HopArt.tsx`. Next to `art.ts` it only differed in case, which a Mac can't tell apart
(`tsc` refused it and the screens couldn't be tested there).

**Tests:** the hop tests, 10 of 10 (the new one checks the hand shows on the first hop of a new pupil and not later);
`tsc --noEmit` clean. `hop.test.sql` now has 34 checks (8 new: the hub row, six achievements, jars counted from days, the
achievement given, last played, a pupil can't read a classmate's pond); run on a scratch database copy, 34 of 34. The
function's `index.ts` didn't change.

**Left for go-live (shared one-line edits, not made):**
- `src/games/registry.ts` and its test: add `hopsGlowwormPond`.
- `src/components/gameCardArt.ts`: the home card picture (with the painted art).
- `FUNCTIONS` in `scripts/build-functions.mjs`: add `hop`.
- The privacy summary: add Hop's pond (days done, step reached).
- Flip `HOP_ON` in `src/games/hop/switch.ts`, run the migrations, deploy the function.

## 8. Decisions (James, 4 Nov)

1. **Theme:** NZ glow-worms (titiwai), not fireflies. A native frog, the Glow-worm Party and the Golden Glow Jar.
2. **Progress:** 10 pads going bronze, then silver, then gold. The water and forest are extra scenery.
3. **Step:** the child moves up from 10s to 5s to 2s when ready (server, focus).
4. **Questions:** missing pad, what comes next, and counting back on gold days.

5. **Name:** Hop's Glow-worm Pond.
6. **After the jar:** a new NZ friend on a fresh pond.
7. **Maths:** a separate `shared/maths` skip-counting branch, OK'd.

## 9. Still open

- Whether Hop's game shares Beanstalk's day and progress code, by pulling it into shared code when Beanstalk goes
  live, or copies it.
