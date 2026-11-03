# Hop's Glow-worm Pond (skip counting) — plan

Short id `hop`. Branch `hop`, worktree `~/games-hub-hop`. Stage 0 (plan), started 4 Nov 2026. Name on the home card is
not final yet (section 9).

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
  After that, a new 30 days starts. What comes next is still open (section 9).
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
  set before `tables-2-5-10`. **Under the guide, `shared/maths` can't be changed from a game branch,** so this would be
  its own small branch with James's OK (section 9).

## 3. Rules as pure functions (`shared/hop/`)

- `round.ts`: given a seed and the focus, gives today's hops: the row of pads, the gap, the right answer and the
  glow-worm choices.
- `play.ts`: given a round and the taps, gives the hops made, the mistakes, and whether the round is done.
- `progress.ts`: given the days completed, gives each pad's colour, the help level and the jar count. Copy Beanstalk's
  `progress.ts`, or share it if Beanstalk has gone live by then.

## 4. Server, tables, switches

The same shape as Beanstalk:
- **Tables:** `hop_progress` and `hop_rounds`.
- **Function** `supabase/functions/hop/` with four calls: `load`, `start`, `finish`, plus a teacher help setting.
- **Switches:** a code switch `HOP_ON`, plus the per-class switch `hop_enabled`, which is off by default.
- **Group:** `easy-maths`.
- **Migration:** the next free number on 4 Nov is `20261104000500`. Check it again at Stage 3.

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

Numbers are drawn in code, never painted. Tries go to `~/dragon-art-inbox/hop-art/`. The art script will be
`scripts/hop-art.py`, copied from `scripts/beanstalk-art.py`.

## 6. Shared files touched (at the end, one line each)

The registry, `gameCardArt`, `FUNCTIONS`, privacy, `hub_games` and the teacher settings list. The skip-counting
questions are a separate `shared/maths` branch (section 2).

## 7. Stages

0. Plan (this file).
1. Rules in `shared/hop/`, and their tests. Separately, the `shared/maths` skip-counting branch, if James OKs it.
2. The play screen: pads, glow-worms, the jump, the fading help. A preview for James.
3. The server: migration, function, maths recording and the day rule.
4. The hub and teacher settings, the guided first go, the pads changing colour, and the jar moment.
5. Go live, one step at a time, on James's word. This comes after Beanstalk is live, so its pattern is proven.

## 8. Decisions (James, 4 Nov)

1. **Theme:** NZ glow-worms (titiwai), not fireflies. A native frog, the Glow-worm Party and the Golden Glow Jar.
2. **Progress:** 10 pads going bronze, then silver, then gold. The water and forest are extra scenery.
3. **Step:** the child moves up from 10s to 5s to 2s when ready (server, focus).
4. **Questions:** missing pad, what comes next, and counting back on gold days.

## 9. Still open

- The name on the home card.
- What happens after the Golden Glow Jar: a new friend, as in Beanstalk, or a new pond?
- An OK for the separate `shared/maths` skip-counting branch.
- Whether Hop's game shares Beanstalk's day and progress code, by pulling it into shared code when Beanstalk goes
  live, or copies it.
