# Tūī's Ten Tree (teen numbers as ten and some more) — plan

Short id `tui`. **Status: Stages 1–4 built 6 Nov 2026 on branch `tui` (rules, play screen and preview, server, teacher page, voice clips); going live switched on for every class.** Game C in
`docs/EARLY-GAMES-PLAN.md`; the parts every early game shares are in section 7 there and aren't repeated here.

**Settled by James, 4 Nov 2026:** the look and voice are Kiwi's Beanstalk's (clay, style B, and Bella), and the plan has
to fade its supports slowly and carefully. Painting script written: `scripts/tui-art.py` (section 7).

## 1. The game in plain words

Tūī (Beanstalk's tūī friend, yellow scarf) is filling up for winter on the Ten Tree, a big kōwhai. On the Ten Tree a full
branch always holds exactly ten berries, and ten berries always fill one flax kete.

- **Today's challenge, about 10 goes.** Berries arrive on the branch: a full ten and some more. "How many berries?" The
  child taps the right number on one of the nests (10 and 4 → 14). Later steps turn it round, ask "how many more?" and
  "take the ten away" (section 3). A right answer: the berries fly to the kete, Tūī sings. A wrong one wobbles back and
  the picture helps a little more (section 4). No penalty, and the answer isn't shown.
- **The magic things.** 10 kōwhai flowers on the Ten Tree turn bronze, silver, then gold, one a day (the shared 30 days).
- **The win.** The Golden Nest on day 30. Then a new friend's tree (kererū, pīwakawaka, korimako, kākā).
- **Gold days finale:** after the 10 goes, two full kete appear: "ten and ten". Not recorded, just a celebration.

## 2. What the research says, and what the game does about it

1. **Teen numbers are hard in English because the words hide the ten.** "Eleven" and "twelve" don't say ten at all, and
   "fourteen" says the 4 first, so children write 41 for 14. Children who learn in languages that say "ten-four" (Chinese,
   Japanese, Korean) see teens as ten and some ones much sooner (Ho and Fuson, 1998; Miura and others).
   **So:** the game always *shows* the ten first and the ones after, the spoken question always says "ten and four"
   before the number word, and a reversal (41 for 14) is one of the wrong choices so the slip shows up in the records.
2. **Te reo Māori is one of the clear languages.** 14 is *tekau mā whā*, "ten and four". Many NZ classrooms already
   count in te reo. **So:** Bella now says the number in English only, not te reo, to match Weka's Stepping Stones
   (James, 5 Nov 2026). The right-answer line is "14! 10 and 4 is 14."

3. **Ten has to become "one thing" (unitising).** Children first see 14 as fourteen ones. The big step is seeing one ten
   and four ones (Cobb and Wheatley; Clements and Sarama's composing trajectory: "10 and some more" comes before tens
   and ones to 100). **So:** the kete. Ten loose berries visibly tuck into one kete with a "10" tag, and from then on the
   ten is one object that can't be counted by ones.
4. **Ten-frames carry the structure.** NCETM's Mastering Number (Year 1 "10 and a bit") and NSW's "Investigating teen
   numbers with 10 frames" use one full frame and a second frame filled left to right, top row first, so 4 is seen
   without counting and "5 and some more" helps for 6 to 9. **So:** bronze-help pictures use exactly that layout, the
   same one Quick looks and Pipi use, so children meet a structure they know. **Matched with Weka's Stepping Stones**
   (4 Nov): in a ten, berries 1 to 5 are one shade (orange) and 6 to 10 a deeper shade (red-orange), tinted in code
   from the one berry picture, and the ten always becomes one stand-out thing (Tūī's kete, Weka's big flat rock).
5. **Concrete, then picture, then symbols, faded on purpose (concreteness fading).** Starting with objects and fading
   to symbols beats objects alone or symbols alone for later use (Fyfe, McNeil, Son and Goldstone, 2014). The link
   between the steps must be shown, not assumed. **So:** six help levels (section 4), and from level 4 down the written
   sum "10 + 4" sits right beside the picture, so the symbols are learnt while the picture is still there.
6. **Help should follow the child, not the clock (contingent scaffolding).** Wood, Bruner and Ross (1976) and the
   van de Pol, Volman and Beishuizen review (2010): good scaffolding gives more help after a struggle, less after
   success, and is withdrawn as the child takes over. Help left in place too long gets in the way of children who no
   longer need it (the expertise reversal effect, Kalyuga). **So:** a child's help level moves down after good
   challenges and back up after a hard one, and a wrong tap brings more help back for that one go (section 4).
7. **The place-value cards moment.** Arrow cards (a "10" card with a "4" card laid over its 0) show why 14 is written
   with a 1 and a 4. **So:** after every right answer, the "4" slides onto the 0 of the "10" and becomes "14", at every
   help level. This is the one support that never fades: it is the explanation, not a crutch.
8. **Mixing the ways matters.** "16 is 10 and ?" and "16 − 10" are the same fact seen from the other side, and doing
   both is what later lets children add within 20 without counting (NZ curriculum Year 1, `MS.Y1.NUM.OP.P6`). **So:**
   the four ways are taught one at a time and then mixed (section 3).

## 3. The maths

- **No new shared maths.** Uses the existing `tenand:1` to `tenand:9` keys and ladder skill `ten-and`
  (`shared/maths/skillPacks/earlyFacts.ts`). The family already asks four ways (its variant number): 0 `10 + n`,
  1 `n + 10`, 2 `10 + ? = 1n`, 3 `1n − 10`. The game builds each go with `rebuild(key, [n, way])`.
- **Steps (the questions grow), from the child's own results, never dropping back** (the server saves `reached`, like
  Hop and Pipi):
  1. **How many?** `10 + n`. The kete or full branch first, loose berries after.
  2. **Turn it round.** Adds `n + 10`: the loose berries arrive first, on the left.
  3. **How many more?** Adds `10 + ? = 1n`: "Tūī needs 16. Here is a kete of ten. How many more berries?"
  4. **Take the ten away.** Adds `1n − 10`: the kete flies to Tūī's nest; how many berries are left?
  5. **All mixed,** weakest facts first.
  A step is passed after two challenges at it with 8 or more of 10 right at the first tap. Inside a step, about 7 of
  the 10 goes are the new way and 3 are earlier ways (so old ways stay fresh). Only 9 facts, so a round has repeats;
  `makeRound` spreads them and puts weak facts (low box) first.
- **A child who already knows it** (7 of the 9 `tenand` keys at box 2 or more when they first play) starts at step 3
  and help level 4 (ten-frames, sum shown), so the game doesn't babysit them but still shows the ten (changed 6 Nov 2026:
  level 2 skipped the ten-frames altogether).
- **Choices:** 3 nests at help levels 5 and 4, then 4. The wrong ones come from the shared family (one more, one less,
  ten more) plus the game's own reversal (41 for 14, on ways 0 and 1 when n ≥ 2). Answers on ways 2 and 3 are 1 to 9.
- **Recording** (Way A, shared section 7): each go is recorded once with `recordMathsAnswers`, right only if the first
  tap was right. A go that needed the extra help after a wrong tap is still recorded as wrong.

## 4. Supports that fade

Two things fade, slowly and separately: the **picture** (six help levels) and the **voice**. One thing never fades: the
arrow-cards moment after a right answer (section 2, point 7).

### The six help levels

| Level | Name | What the child sees and hears |
|---|---|---|
| 5 | Every berry, counted in | The full branch as a ten-frame (2 rows of 5), the loose berries pop into a second frame one at a time, top row first. Bella: "Ten berries on the branch… and four more. How many berries?" 3 nests. |
| 4 | Every berry | The same two frames, all berries appear together. The sum "10 + 4" is written under the picture. Bella reads the question only. 3 nests. |
| 3 | The kete of ten | The ten berries tuck into the kete (tag "10") as the go starts; the loose ones stay in their frame; the sum is written. 4 nests from here. |
| 2 | Small and faint | The kete and the loose berries are small and faint beside a big "10 + 4 = ?". |
| 1 | Numbers, with a peek | Only "10 + 4 = ?". A leaf button, **Peek**, brings back level 3's picture for that go. |
| 0 | Numbers only | Only "10 + 4 = ?". |

Ways 2 and 3 use the same levels: on "how many more?" the missing berries are empty dashed circles in the frame
(levels 5 and 4) or one empty space beside the kete (level 3); on "take the ten away" the kete visibly flies off.

### How a child's help level moves (between challenges)

- A new child starts at **level 5** (or level 4 if they already know it, section 3).
- After each day's first challenge (the counted one):
  - **8 or more of 10 right at the first tap:** a *good* challenge. **Two good challenges in a row** take the child down
    one level. So going from 5 to 0 takes at least ten school days, and usually most of the 30.
  - **4 or fewer right:** a *hard* challenge. Up one level straight away.
  - Anything else: stay.
- **When a new step starts (section 3), help goes back up two levels** (to at most 5, and never below level 4, the ten-frames): a new way of asking needs the
  picture again, then fades again.
- The server saves the level in `tui_progress`. Play-again goes later that day use the same level and never move it.

### Help inside one go (a wrong tap)

- First wrong tap: the nest wobbles back and the picture goes **up one level** for this go (at level 0 the level-3
  picture appears; at level 1 the Peek opens by itself).
- Second wrong tap: up to **level 5** for this go, and Bella says the "ten… and four more" line.
- Third wrong tap: the wrong nests fade, leaving two. The answer is never shown or said.
- The next go goes back to the child's level.

### The colours, the voice and the teacher

- **The colours still mark days, not skill.** Bronze, silver and gold flowers reward turning up (30 days, shared rule).
  Because help now follows the child, a gold day can still show berries for a child who needs them. This differs from
  Hop and Pipi, whose help fades with the colour (James chose this, 4 Nov).
- **The picture fades with the level, the voice does not:** level 5 says the "ten… and four more" line; levels 4 to 0
  read the question ("Ten plus four. How many?"), so a child who cannot read the sum yet still hears the numbers at
  level 0 and on the teacher's Off setting (S30, 8 Nov). A child can always tap Hear it again to hear it once more. The game's own mute (`tui-voice`) turns the voice off.
- **Teacher settings** (drawer): picture help **Fades / Always / Off**, as Penguin Pairs and Weka (`tui_help`, Fades by
  default). Fades is this section; Always keeps level 4; Off means level 0 and no Peek, but a wrong tap still brings the
  picture back for that go, because that is how a wrong answer gets put right. The
  student line shows the step and help level ("Step 3 How many more?, help level 2").

## 5. Rules (`shared/tui/`)

- `round.ts`: `stepFor(records, reached)`, `levelAfter(level, lastResults, stepChanged)`, `makeRound(seed, records, step)`
  (10 goes: way and fact for each, weak first, 7 new way and 3 old), `showGo(go, level, wrongTaps)` (what to draw: frames,
  kete, faint, peek, choices).
- `play.ts` (replay the taps), `progress.ts` (`treeAfter`, copied from Pipi's `beachAfter`), `server.ts`
  (`handleTui`: load, start, finish; saves `reached`, `level`, `good_in_row`, `played`).
- **Tests (at most 8):** Hop's 4 rule tests (round, replay, 30 days, finish), plus help level down after two good, up
  after a hard one, up two on a new step, and a wrong tap raising the go's picture.

## 6. Guided first go

The very first go is always 10 and 2 at level 5. The hand points at the full branch (Bella: "Ten"), the 2 loose berries
("and two more"), then hovers over the nests. It never points at the answer, and goes after the first right one.

## 7. The look and the painting (Beanstalk's clay)

**Clay, the same words as Beanstalk's style B**, so the two games look like a pair. Tūī is Beanstalk's tūī friend
(dark blue-green clay, yellow knitted scarf), with the white tufts at the throat, where a real tūī has them.
Numbers and counts are always drawn in code: a painting can't be trusted to hold exactly ten, so the game places single
berry pictures itself, and draws the ten-frame outlines, the "10" tag text and every number. The sparkle is drawn in
code too (the clay model keeps adding blobs, Beanstalk found).

**The set: 30 pictures** (`python3 scripts/tui-art.py list`):

| Group | Pictures |
|---|---|
| `tui/` | tui-sit, tui-eat, tui-sing, tui-cheer, tui-fly, tui-nest |
| `friends/` | kererū, pīwakawaka, korimako, kākā: each sit and cheer (scarves blue, green, orange, red) |
| `tree/` | berry, berry-gold, branch (wide, empty), kete-open, kete-full (plain tag), nest (an answer) |
| `flowers/` | flower-bud, -bronze, -silver, -gold (foil-wrapped, like Beanstalk's leaves) |
| `things/` | golden-nest, nest-cushion |
| `back/` | spring (bronze days), silver (misty morning), golden (gold evening) |
| `home/` | card (Tūī on a kōwhai branch beside a full kete) |

### Painting steps for James (gaming PC with ComfyUI)

1. **On the gaming PC:** start ComfyUI from `D:\ComfyUI\ComfyUI_windows_portable` with `--listen 0.0.0.0`
   (`run_nvidia_gpu.bat`), so the Mac can reach it on Tailscale at `100.97.96.115:8188`.
2. **On the Mac** (or a Remote Control session there), in the repo on this branch:
   `python3 scripts/tui-art.py paint ~/dragon-art-inbox/tui-art/set home/card tui/tui-sit --tries 4`.
   This is the style check: the card and Tūī. Look that the clay matches Beanstalk's and the tufts are at the throat.
3. **The rest:** `python3 scripts/tui-art.py paint ~/dragon-art-inbox/tui-art/set --tries 3` (about 90 pictures, it skips
   what is already there; around 20 to 30 minutes). Tries land in `~/dragon-art-inbox/tui-art/set/b/`.
4. **Pick** one try of each into `docs/tui-art/picks.json` (`{"tui/tui-sit": 2, ...}`). Check: the branch's middle is
   empty, the kete tag is blank, each berry is a single berry, no numbers or writing anywhere.
5. **Tidy:** `~/.cache/rembg-venv/bin/python scripts/tui-art.py tidy`. It cuts the sprites out and writes WebP files to
   `src/games/tui/art/paint/<group>/` and the home card to `src/assets/home/tui.webp` (plus `-small`). Push to the
   game's branch. The game uses each picture as soon as it is there and draws a clay stand-in until then.

If a try keeps failing (the beak, the kete tag picking up writing), change only the words for that picture in
`scripts/tui-art.py` and paint it again; the seeds are fixed, so the other pictures don't change.

## 8. Voice (Bella)

Bella (Kokoro `af_bella`, speed 0.9) for every line, recorded with `scripts/voice-clips.py tui` (add `tui` to its list)
from `src/games/tui/voiceLines.ts`, with a `voiceLines.test.ts` that writes `public/voice/tui/lines.json`. `SAY_AS`
already says Tūī as "Too-ee" and Kererū; add Pīwakawaka, Korimako, Kākā, kōwhai and kete.
No te reo numbers: English only (James, 5 Nov 2026). About 150 lines: every question at every voice level for the nine facts
and four ways, the "ten… and n more" lines, praise, the guided first go, and the prize. Bella reads the question, never
the answer before a right tap; after a right tap she says the whole fact as a stem sentence, "Ten and four is fourteen" (the
same words as Weka's "10 and 3 make 13": "and", never "equals"), with the arrow-cards moment.

## 9. Achievements

One per Golden Nest, per friend (five: Tūī, Kererū, Pīwakawaka, Korimako, Kākā). No hub points. Not a season game.

## 10. Stages

0. This plan and the painting script (this branch). 1. Rules and tests (`shared/tui/`). 2. Play screen with clay
stand-ins drawn in code and a preview (`preview/tui`). 3. Server (migration `<next number>_tui.sql`: `tui_progress`,
`tui_rounds`, switch `tui_enabled` and help `tui_help`, both on by default; function `supabase/functions/tui`).
4. Hub card in Foundational skills, teacher drawer and student line, guided first go, prize moment, Bella clips.
5. Go live. **No shared-maths branch.** Painting can happen any time from now; the game picks the pictures up.

## 11. James's answers (4 Nov 2026)

1. **How help fades: by the child's results** (section 4), not by the days. The colours still mark days.
2. **Te reo numbers: changed on 5 Nov 2026.** Bella says the number in English only, to match Weka. The right-answer
   line is "14! 10 and 4 is 14." (First said yes on 4 Nov, with te reo on the easier help levels.)
3. **Painting waits until James is home from work** (the gaming PC). The first try from a Mac session on 4 Nov stopped
   before it painted anything (`extra_usage_unavailable`). Steps are in section 7.

Later idea (parked): grow into tens and ones to 100 with several kete. That needs new shared maths.

## Sources

- Ho, C. S.-H. and Fuson, K. C. (1998). Children's knowledge of teen quantities as tens and ones: comparisons of
  Chinese, British, and American kindergartners. *Journal of Educational Psychology* 90(3).
  https://hub.hku.hk/handle/10722/168969
- Fyfe, E. R., McNeil, N. M., Son, J. Y. and Goldstone, R. L. (2014). Concreteness fading in mathematics and science
  instruction: a systematic review. *Educational Psychology Review* 26. https://pc.cogs.indiana.edu/?p=885
- Wood, D., Bruner, J. S. and Ross, G. (1976). The role of tutoring in problem solving. *Journal of Child Psychology and
  Psychiatry* 17. van de Pol, J., Volman, M. and Beishuizen, J. (2010). Scaffolding in teacher–student interaction: a
  decade of research. *Educational Psychology Review* 22.
- Kalyuga, S. (2007). Expertise reversal effect and its implications for learner-tailored instruction. *Educational
  Psychology Review* 19.
- Clements, D. H. and Sarama, J. *Learning and Teaching Early Math: The Learning Trajectories Approach* (Routledge).
- NCETM, Mastering Number, Year 1 overview ("10 and a bit"):
  https://axis.ncetm.org.uk/media/zclpoezm/mastering-number-year-1-overview.pdf
- Oak National Academy, "Use knowledge of 10 and a bit to solve problems":
  https://thenational.academy/teachers/programmes/maths-primary-ks1/units/composition-of-numbers-11-to-19/lessons/use-knowledge-of-10-and-a-bit-to-solve-problems
- NSW Department of Education, "Investigating teen numbers with 10 frames":
  https://education.nsw.gov.au/teaching-and-learning/curriculum/mathematics/mathematics-curriculum-resources-k-12/thinking-mathematically-resources/mathematics-es1-s1-investigating-teen-numbers-with-10-frames
- Te reo Māori counting (tekau mā tahi …): https://www.languagesandnumbers.com/how-to-count-in-maori/en/mri/
- NZ Ministry of Education, Mathematics and Statistics, Phase 1:
  https://newzealandcurriculum.tahurangi.education.govt.nz/

## Build notes (6 Nov 2026)

Stages 1–4 are built on branch `tui`.

- `shared/tui`: `round.ts`, `play.ts`, `progress.ts`, `server.ts`, `memoryServices.ts`, and `tui.test.ts` (4 tests).
- `supabase/migrations/20261106000100_tui.sql`: tables `tui_progress` and `tui_rounds`; settings `tui_enabled` (default true)
  and `tui_help` (default 'fade'); `teacher_set_tui`, `teacher_tui_class`, `teacher_tui_student`; `hub_games` hooks; five
  achievements, one per Golden Nest per friend.
- `supabase/functions/tui`: the server function.
- `src/games/tui`: `TuiGame`, `Goes`, `art.tsx`, `tui.css`, words, `voiceLines`, and 162 Kokoro `af_bella` clips in
  `public/voice/tui`.
- `src/pages/TeacherTui.tsx`: the teacher page.
- `preview/tui`: the preview. Run it with `npx vite --config vite.tui-preview.config.ts`.

Two small choices made while building:

1. The sum is always written on "how many more?" and "take the ten away" goes, even at level 5, because the picture can't
   say the target number.
2. The guided first go's hand points at the full branch, then the loose berries, then sweeps across all the nests. It never
   stops on the answer.
