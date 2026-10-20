# Maths focus, classes and schools: plan

*Teachers and students choose what maths the games ask (×6, doubles, rounding…), or leave it on auto. Students are grouped into classes with their teachers, and the hub can hold more than one school. Written 18 October 2026 for James.*

**Status: draft. Brainstormed with James on 18 October 2026. He asked for a schools option and for teacher focuses that end after a set time, and answered every question in section 10 the same day. Not started: F.1 is first.**

## 1. The idea in one paragraph

Every maths question in every game comes from one **maths focus** for each student. A teacher can set a focus for a class, a group or one student, for a set time ("×6 until Friday"). When that time ends, it switches back by itself to the student's own choice or to **auto**. Auto walks the student up a ladder of skills, from bonds to 10 up to BEDMAS and on to fractions, decimals and percentages, using the mastery records the games already keep. Students belong to a **class**, classes have one or more **teachers**, and classes belong to a **school**, so other schools can use the hub later without seeing each other's data.

## 2. What's already built

- **Skill packs.** [shared/maths/skillPack.ts](../shared/maths/skillPack.ts) is the interface games use for questions: `nextQuestion(ctx)` and `recordAnswer()`. It was written so new packs can be dropped in without changing game code.
- **Auto for times tables.** `readyLevel()` in [shared/maths/selector.ts](../shared/maths/selector.ts) moves a student on once 70% of a step's facts are in box 2 or higher. Questions are mixed 60% focus, 30% review and 10% stretch.
- **Shared records.** Gem Keep and Wormholes & Black Holes both send each answer to `record_fact_answers(player, pack, …)`, which already takes a pack id.
- **What's missing:**
  - The only maths is times tables.
  - There are no classes. Settings are one school-wide row (`app_settings`), and "teacher" is just a role on `profiles`.
  - Douglas Park is written into the sign-in checks, so there's no idea of a school.

## 3. The skill ladder

One ordered list of skills, easiest first. Each skill has its own question generator in `shared/maths/skills/`.

| Stage | Skills |
|---|---|
| Early facts | Bonds to 10, bonds to 20, doubles to 10 + 10, halves of even numbers to 20, adding and subtracting within 20 |
| Times tables | Each table on its own (×2, ×5, ×10, ×3, ×4, ×6, ×8, ×7, ×9, ×11, ×12, in today's campaign order), then division facts |
| Place value | ×/÷ by 10, 100 and 1000, bonds to 100, bonds to 1000, doubles and halves of bigger numbers |
| Rounding | To the nearest 10, 100 and 1000, then to 1 decimal place |
| Order of operations | Two operations without brackets, then with brackets, then mixed BEDMAS |
| Fractions, decimals and percentages | Fractions of amounts (½ of 18, ¾ of 20), equivalent fractions, simplifying, adding decimals, tenths and hundredths, simple percentages (10%, 25%, 50% of an amount), fraction–decimal–percentage matches |

Rules for every skill:

- **Most answers are a single number.** So `Question.answer: number`, the number pad and multiple choice all keep working. Rounding and decimals need a decimal point on the number pad (one small change).
- **Fraction answers are multiple choice** (James, 18 Oct 2026). Questions whose answer is a fraction ("which is the same as 2/4?", "simplify 6/8") show choices to tap instead of the number pad. So `Question` gets an optional `answerText` and choices as text ("3/4"), while questions with number answers stay exactly as now. The wrong choices are made from common mistakes (3/8 for 6/8 halved only on top, and so on).
- **Each skill has an NZC tag** in `curriculumTags`, filled in from the maths-alignment-tool.
- **The ladder is just a list in [shared/maths/config.ts](../shared/maths/config.ts)**, like `CAMPAIGN_STEPS` today, so the order can be changed without touching any code.

### Two kinds of skill

- **Fact skills** (bonds, doubles, halves, tables, division) have a fixed set of facts. Leitner boxes per fact work exactly as now; only the keys change: `bond10:3+7`, `bond20:8+12`, `dbl:7`, `half:14`, `mul:6x7` (unchanged, so no records are lost).
- **Generated skills** (bigger place value, rounding, BEDMAS, fractions, decimals and percentages) can make endless questions, so there's no fixed fact list. Mastery is kept per **question type**, for example `round:100:3digit`, `round:100:near-halfway` or `bedmas:brackets-first`. Each type has a Leitner box like a fact. "Fluent" means right and quick on different days, with a new question each time.

## 4. The maths focus

Each student has one focus at any moment. It is one of:

- **Auto:** the ladder (section 5).
- **Chosen skills:** one or more skills, for example "×6" or "doubles + halves". Earlier skills still come up as review (about 30%), unless the teacher picks **only these**, which is today's `onlyFocus`.
- **Off:** only for games where maths is optional, like the space game.

### Who decides, and in what order

The server works it out each time a game asks for questions, using the first of these that applies:

1. A **teacher focus for this student** that is still running.
2. A **teacher focus for the student's group** that is still running.
3. A **teacher focus for the student's class** that is still running.
4. The **student's own choice**, if the class allows students to choose.
5. **Auto.**

The class setting **Students can choose their own focus** works like the space-maths switch:

- **Off:** teacher focus or auto only.
- **On:** students pick, unless a teacher focus is running.

### Teacher focuses end by themselves

Every teacher focus has a start time and an end time. No timer or scheduled job is needed: rule 1, 2 or 3 simply stops matching once the end time has passed, and the student drops to the next rule.

- **Length presets:** This lesson (1 hour), Rest of today (until midnight), **Until Friday (midnight at the end of Friday, the default)**, 1 week (7 days), or Custom (date and time). Ending at midnight means practice at home after school still uses the focus (James, 18 Oct 2026).
- **Times are NZ time.** The server's clock decides, never the student's device.
- **The student's own choice is never overwritten.** It's kept underneath, so when a teacher focus ends the student goes back to what they had picked.
- **Layering:** a 1-hour student focus can sit on top of a week-long class focus. When the hour is up, the student goes back to the class focus, not to auto.
- **Ending mid-game:** the student finishes the current level or game on the old focus, then switches. Questions don't change halfway through a Gem Keep level.
- **Teacher page:** each running focus shows what it is and how long is left ("×6, ends in 2 days"), with **Extend** and **End now**.
- **Student screen:** a small note says "Your teacher picked ×6 until Friday", so they know why they can't change it.
- **History:** ended focuses are kept, not deleted, so teachers can see "what we practised this term" and how students did on each focus.
- **Holidays:** no special handling. A focus simply ends, and the teacher sets a new one next term.
- **Later:** because every focus already has a start time, teachers could plan ahead ("next week: ×7") with almost no extra work.

## 5. Auto

- **Moving up.** A student's place on the ladder is the first skill that isn't secure yet (70% of its facts or question types in box 2 or higher, as now). Questions are 60% from that skill, 30% review of earlier skills (weakest first) and 10% stretch into the next one.
- **Placement, so a Year 6 student doesn't start on bonds to 10.** A new student gets a short placement check of about 10 questions. It jumps up the ladder while they answer right and quickly, and steps back when they don't. They start just below where they stopped. Until they've done it, they start at a point set by their class's year level.
  - **Changed 20 October 2026:** the class year level no longer sets a start, and the warm-up starts at the first skill. Setting Year 6 had put a whole class straight onto ×11, ×12, and that became their furthest place, which never goes back. Without a warm-up, students start at the first skill and climb from their own answers. The year level is now only a label for the teacher. The six Riley students it had moved were reset (their saved furthest place was deleted, their answers kept).
- **No going backwards in records.** A student who forgets ×7 gets more ×7 review, but their place on the ladder doesn't drop. This avoids the "I went down a level" feeling.

## 5b. Students see how far through they are (James, 18 Oct 2026)

Kids can see their own progress along the ladder, not just a score.

- **What they see:** a simple path or bar along the ladder, with each skill as a stop. Skills they've got secure are filled in, the one they're on now is highlighted ("You are here"), and the rest are greyed. A line says how far along they are ("12 of 30 skills secure").
- **Where:** on the dashboard (a small bar that opens the full path) and as a short "you moved up!" message when they pass a skill, in the style of the other achievements.
- **Only their own path.** No one else's progress is shown, and no ranks. Times-table skills open into the tables inside them (×3, ×4, ×8).
- **Teacher focus doesn't hide it.** While a teacher focus is running, the path still shows where the student is on the full ladder, with the focus skill marked "Your teacher's pick".
- **How it is worked out:** one shared function (`ladderProgress(stats)`) gives the skill they're on, which skills are secure, and a percentage, using the same 70% rule as auto. It is built in F.1 so every game and screen gets the same answer; the screens come in F.4 (when auto covers the whole ladder) and F.7.
- **Wording:** years are never shown to students ("Year 3 skill" would label them). Skills just have names.

## 6. Classes and groups

- **Tables:**
  - `classes`: school, name ("Room 12"), year, year level, archived.
  - `class_teachers`: a class can have several teachers (co-teaching, relievers).
  - `class_members`: **one current class per student**. Moving a student just changes their row.
  - `class_groups` and `class_group_members`: optional groups inside a class ("Kea", "Tūī").
- **Getting students in:**
  - **Class Warp code:** see section 6b.
  - **Teacher adds students:** the teacher ticks students from a list of their school's students who have no class. This is the backup for students who type the code wrong.
- **What teachers see:** only students in their own classes. A **school admin** sees every class in their school. All the `teacher_*` functions get this check.
- **Settings move per class.** The settings now in `app_settings` (space maths, reactions, Gem Keep tables, multiple choice, division) become per class. The school's row becomes the default a new class starts with.
- **End of year:** the school admin archives the year's classes. Mastery records belong to the student, not the class, so nothing is lost when they change rooms.
- **Leaderboards:** the privacy summary promises no classes on boards. A "my class" filter is allowed, but class names are never shown to students.

## 6b. Class Warp (James, 18 Oct 2026)

Every class, and every group inside a class, has its own **warp code**. A student types the code and is warped into that class or group. This replaces the "join code" idea in section 6, and works the same for both.

- **Codes:** short, made the same way as game codes (no vowels or lookalike characters), one for each class and one for each group. A group's code is different from its class's code.
- **Class code:** the student joins that class. If they were in another class, the screen asks first: "Leave Room 12 and warp to Room 14?" Their records come with them, because records belong to the student.
- **Group code:** the student joins that group, and the class it belongs to as well, so one code is enough. A student can be in one group per class.
- **Where students type it:** a "Class Warp" button on the dashboard (and the "Join your class" step for new students). They type the code, see the class or group name, tap to confirm, and get a short warp animation and "Welcome to Room 12!".
- **Teachers control it:** a code can be turned off (nobody can warp in), reset to a new code, or set to ask the teacher before anyone joins. The teacher sees warps as they happen ("Speedy Otter 27 joined Kea") and can move a student out.
- **Safe by default:** codes can't be guessed in bulk (limited tries per student, like game codes), a wrong code says only "That code didn't work", and an archived class's code stops working. A code only ever gives a student a place in a class or group; it never shows them anyone else's data.
- **Names:** students see the class or group name only after a correct code. Class names are never shown on leaderboards (the privacy summary promise stays).
- **Teacher backup stays:** a teacher can still tick students from the list, for anyone who can't type the code.

Open questions I decided without asking (James can change them): moving class asks for confirmation; "ask the teacher first" is off by default; group codes also join the class.

## 7. Schools

The hub stays one website and one database, with every row belonging to a school. Douglas Park becomes school number 1, and everything already saved moves into it.

### Tables and roles

- `schools`: name, active, the date the board approved it, and a contact teacher.
- `school_domains`: the email domains that school signs in with (`douglaspark.school.nz`). A school can have more than one.
- `profiles.school_id`: set once at sign-up from the email domain, and never changed by the student.
- **Roles:**
  - **student**
  - **teacher:** their own classes
  - **school admin:** everyone in their school, makes teachers, archives classes, new season
  - **site owner:** James, adds schools, sees no student data unless needed

### Keeping schools apart

- **Sign-in:** the three checks in the README stay, but "is it a Douglas Park email?" becomes "is the domain in `school_domains` for an active school?". An unknown domain still can't make an account.
- **Every read** checks the reader's school, through one helper, `my_school()`, used in every row rule and `teacher_*` function. Tests try reading another school's students, games, records and settings, and must get nothing.
- **Playing:** lobbies, game codes, classmate games and leaderboards stay **inside a school**. Playing against another school could be a later idea, but not now.
- **New season** and every other school-wide action run for one school only.

### Before a second school can join

None of this is code, but each item has to be done first:

- **Google sign-in.** The Google project is "Internal" to Douglas Park, so only Douglas Park accounts can use it. Other schools need it switched to "External" and published. Each school's Google Workspace admin also has to allow the app. Google blocks students under 18 from apps their school hasn't approved, and that school-by-school step is part of setting up each school.
- **Privacy.** Each school's principal and board approve it, with their own copy of [PRIVACY-SUMMARY.md](PRIVACY-SUMMARY.md). When a school leaves, all its data is deleted (one function, tested).
- **Cost.** By the Stage 8 numbers, one class of 30 uses about 70,000 of the 500,000 free server-function calls a month, so roughly 6 busy classes reach the free limit. Live connections (200 at once) run out sooner if several classes play at the same time. More than one school almost certainly means Supabase Pro (about US$25 a month), and someone has to pay for it.
- **Sign-in limits:** these are counted per internet address, and each school has its own, so another school doesn't use up Douglas Park's limit.

## 8. Saving and cheating

- **Generators live in `shared/`,** so a server function can rebuild any question from its seed and mark it, the same way chess and checkers games are checked.
- **Records:** `record_fact_answers` keeps one record table for every skill, keyed by fact or question type, so all games add to the same picture.
- **Focus decided on the server.** Games ask a new `my_maths_focus()` for the student's current focus (with its end time, so the game can show the note). They never decide it themselves, so a student can't get around a teacher focus.

## 9. Teacher screens

- **Skill map:** one row per student, one column per skill, each cell coloured from not started to fluent. This replaces the 12 × 12 grid as the main view; the grid stays as the detail when you tap a times-table cell.
- **Set focus:** pick class, group or students, then skills, then a length (default Until Friday).
- **Groups:** make, rename and fill groups inside a class.
- **Running focuses:** time left, Extend, End now.
- **Focus history:** what was practised, when, and how students moved on each.
- **Class setup:** join code, members, groups, co-teachers, settings.

## 10. James's answers (18 October 2026)

1. **Students choosing their own focus:** yes, with a class switch that is on by default.
2. **Top of the ladder:** fractions, decimals and percentages are in from the start, after BEDMAS (section 3). Answers that are fractions are multiple choice.
3. **Which games use the focus:** Gem Keep, the space game and any new maths game. Chess, checkers and 101 stay maths-free.
4. **When "Rest of today" and "Until Friday" end:** midnight, so home practice still counts.
5. **Groups:** in the first version, built with the focus screens in F.3.
6. **Second school:** none yet. Schools go into the tables now (F.2) so it's cheap later, but the hub isn't opened to another school until section 7's checklist is done.

## 11. Stages (stop for James after each)

1. **F.1 Skill engine:** the new times-table order (section 12), the skill ladder in config, generalised fact keys, and the first new fact skills (bonds to 10 and 20, doubles, halves). No database changes. Checked in the Gem Keep preview.
2. **F.2 Schools and classes:** `schools`, `school_domains`, `profiles.school_id` (Douglas Park as school 1), classes, class teachers, members, join codes, the school admin role, `my_school()` in every row rule, and settings moved per class. Tests for cross-school and cross-class reads.
3. **F.3 Maths focus and groups:** groups inside classes, focus rows with start and end times, `my_maths_focus()`, the student choice switch, the teacher's Set focus and Running focuses screens, the student note, and Gem Keep and the space game reading the focus.
4. **F.4 Auto everywhere:** the whole ladder, placement check, starting points by year level, and the student progress path (section 5b).
5. **F.5 Generated skills:** place value, rounding (with the decimal point key), BEDMAS, and question-type records.
6. **F.6 Fractions, decimals and percentages:** the new skills, text answers for multiple choice, and wrong choices made from common mistakes.
7. **F.7 Teacher views:** skill map and focus history.
8. **F.8 Opening to another school** (only when one is ready): Google set to External, school-by-school app approval, privacy summary and board sign-off, delete-a-school function, and moving to a paid Supabase plan if the numbers need it.
9. **Go live** (James's yes after each stage that changes the database): the migration applied, functions deployed, merge.

## 12. Where the ladder comes from (research, 18 October 2026)

There's no ready-made, openly licensed question bank for this, but there are good published **orders** to follow. The plan is to follow these orders and write our own generators, so no one else's questions are copied.

### Sources

| Source | What it gives us | Can we use it? |
|---|---|---|
| **NZC 2025 Teaching Sequences, Years 0–6** (already extracted in `maths-alignment-tool/data/curriculum/teaching-sequence/`, with stable IDs like `MS.Y5.NUM.RN.P15`) | The official year-by-year order: which facts are memorised when, rounding, fractions, decimals, percentages, order of operations | **Main source.** Each skill's `curriculumTags` holds these IDs, and the progress markers (`MA.Y5.5` and so on) come with them |
| **Number Framework, Book 1** (NZ Numeracy Project, Ministry of Education 2008) | The knowledge stages: exactly which fact sets come at each stage, for example doubles to 20, "ten and" facts, multiples of 100 that add to 1000, tens in 763, divisibility rules, and fraction, decimal and percentage conversions | A guide to the order and to fact sets the NZC doesn't spell out. It's "© Crown 2008, all rights reserved", so we use the order but don't copy its text |
| **DfE Mathematics guidance KS1–2** (England, 2020): the number facts fluency appendix | The **order of times-table families**: 10 and 5, then 2, 4 and 8, then 3, 6 and 9, then 7, then 11 and 12. Also the 36 most important facts (2–9 × 2–9) | Open Government Licence v3.0, so it can be used freely with credit |
| **Multiplication Tables Check framework** (England) | Which tables need the most practice: 6, 7, 8, 9 and 12 are the hardest, and ×1 is left out | A guide for weighting review in auto mode |
| **Bay-Williams and Kling, *Math Fact Fluency*** (ASCD 2019) | Foundational facts (+0, +1, +2, doubles, combinations of 10, 10 + n) come before derived strategies (near doubles, make ten) | A guide to the order of the early facts. It's a book, so we use the ideas only |
| **Oak National Academy API** (England) | Real KS2 maths quiz questions with answers, including multiple choice | Open Government Licence; a free API key is needed. Good for checking ideas for fraction and percentage questions and wrong answers. Check how much KS2 maths it covers before relying on it |
| **Illustrative Mathematics K–5** (original edition) | Fluency activities and games for Grades 3–5 | CC BY 4.0 (the newer v.360 edition is non-commercial only) |
| **ACARA Numeracy Learning Progression** (Australia) | Very detailed levels for additive strategies, multiplicative strategies and fractions | CC BY 4.0. Useful as a cross-check, but too detailed to use as the ladder itself |
| **Eedi diagnostic questions** (Kaggle 2024) | Wrong answers to multiple-choice maths questions, each linked to a named misconception | Licence not found. Use it only for ideas about common mistakes, not the questions themselves |

Searched but not usable: the NZ Phase 2 curriculum page blocks automatic downloads (so it was read through the alignment tool's extract and the Ministry's year-level pages); e-asTTle, PaCT, White Rose and Twinkl aren't openly licensed; and no open-source question generator was close enough to be worth using over our own.

### The ladder, from these sources

Year levels are where the NZC teaching sequence puts each skill. Auto mode follows this order.

| # | Skill | NZC | Notes |
|---|---|---|---|
| 1 | Facts to 10 (bonds to 10 and + / − within 10) | MS.Y1.NUM.OP.P1 | Number Framework stages 2–4. Combinations of 10 are foundational facts |
| 2 | Doubles and halves to 10 | MS.Y1.NUM.OP.P2 | |
| 3 | "Ten and" facts (10 + 4, 7 + 10) | MS.Y1.NUM.OP.P6 | |
| 4 | Facts to 20 (+ and −, bonds to 20) | MS.Y2.NUM.OP.P1 | Near doubles and make ten come up here |
| 5 | Doubles and halves to 20 | MS.Y2.NUM.OP.P2 | |
| 6 | ×2, ×5, ×10 and division | MS.Y2.NUM.OP.P9 | |
| 7 | Bonds to 100 (multiples of 10, then 5, then any: 34 + _ = 100) | MS.Y3.NUM.OP.P1 | |
| 8 | ×3, ×4, ×8 and division | MS.Y3.NUM.OP.P6 | |
| 9 | Round to the nearest 10 and 100 | MS.Y3.NUM.NS.P5 | |
| 10 | Multiples of 100 that add to 1000 (400 + 600) | | Number Framework stage 5 |
| 11 | Unit fraction of a number (⅓ of 15) | MS.Y3.NUM.RN.P7 | Answer is a number |
| 12 | ×6, ×9, then ×7, and division | MS.Y4.NUM.OP.P2 | |
| 13 | ×0, ×1, ÷1 and facts with tens and hundreds (30 × 4, 10 × 100) | MS.Y4.NUM.OP.P3 | |
| 14 | ÷10 to make tenths, decimal of ½ and tenths (0.3 = 3/10) | MS.Y4.NUM.RN.P3–P5 | Fraction answers are multiple choice |
| 15 | Add and subtract tenths (1.3 + 0.2) | MS.Y4.NUM.RN.P10 | Needs the decimal key |
| 16 | Round to the nearest 1000 | MS.Y4.NUM.NS.K4 | |
| 17 | ×11, ×12 and division | MS.Y5.NUM.OP.P2 | |
| 18 | Factor pairs (factors of 24) | MS.Y5.NUM.NS.P2 | Multiple choice or "a pair that makes 24" |
| 19 | Round to the nearest 10,000 and 100,000, and tenths or hundredths to a whole number | MS.Y5.NUM.NS.P3–P4 | |
| 20 | Decimal equivalents of ½, ¼, ¾, tenths and hundredths | MS.Y5.NUM.RN.P4 | Multiple choice |
| 21 | 10%, 25% and 50% as fractions and decimals, and of an amount | MS.Y5.NUM.RN.P5, P15 | |
| 22 | Non-unit fraction of a number (⅔ of 24) | MS.Y5.NUM.RN.P13 | |
| 23 | ×10 and ×100 with decimals | MS.Y5.NUM.RN.P7 | |
| 24 | Equivalent fractions, then simplifying | MS.Y5.NUM.RN.P9, MS.Y6.NUM.RN.P6 | Multiple choice |
| 25 | Square numbers to 144 and cube numbers to 125 | MS.Y6.NUM.NS.P6 | |
| 26 | Round to the nearest million, and hundredths to a tenth | MS.Y6.NUM.NS.P3–P4 | |
| 27 | Fraction, decimal and percentage equivalents (fifths, quarters, hundredths) | MS.Y6.NUM.RN.P3–P4 | Multiple choice |
| 28 | 1%, 10%, 20%, 25%, 50% and 75% of an amount, and the whole from a percentage | MS.Y6.NUM.RN.P13–P14 | |
| 29 | The whole from a fraction (¾ is 90, so the whole is ?) | MS.Y6.NUM.RN.P12 | |
| 30 | Order of operations: two operations, then brackets, then mixed | MS.Y6.NUM.OP.P1 | NZC order: brackets, exponents, × and ÷ left to right, + and − left to right |

### What this changes in the plan

- **Times-table order.** The NZC (Year 3: 2, 3, 4, 5, 8, 10) and the UK families both put **×8 with ×3 and ×4**, and ×6 with ×9. Today's `CAMPAIGN_STEPS` puts ×8 with ×6. **Decided (James, 18 Oct 2026): NZC families, changed as part of F.1, not before.** The new steps are levels 1–2 ×2, ×5, ×10 (up to ×10); 3–4 ×3, ×4, ×8; 5–6 ×6, ×9; 7–8 ×7; 9–10 ×11, ×12. Students' fact records aren't affected.
- **Weighting.** In auto, review leans towards ×6, ×7, ×8, ×9 and ×12, as the Multiplication Tables Check does, because they're the hardest.
- **Wrong answers for multiple choice** come from known mistakes, for example adding tops and bottoms (½ + ¼ = 2/6), "longer decimals are bigger" (0.25 > 0.3), and working left to right without rules (2 + 3 × 4 = 20).
- **Credit.** If DfE, Oak or Illustrative Mathematics material is used directly, the How to play or About page credits it, as its licence asks.

## Stage F.2 results: schools and classes (18 October 2026)

**Status: built and tested in a scratch database. Nothing is live.** No migration was applied to the live database, no function was deployed, nothing was merged to `main`. Work is on branch `maths-focus` (worktree `~/projects/school-games-hub-focus`).

### Before I started
`main` was merged into `maths-focus` first. It brought in Dragon Maths' `20261018001600` and `20261018001700`, and (merged again later the same day, after Clan Quest and Training went onto `main`) Clan Quest's `20261018001800` to `20261018002100` and Training's `20261018002200`. F.2's three migrations were first numbered `001800`, `001900`, `002000`, which clashed with Clan Quest, so they were **renumbered to `002300`, `002400`, `002500`** (after Training's `002200`, which is the newest on `main`; renumbering to just after Clan Quest's `002100` would have clashed with Training). Their order is unchanged. A **fourth** F.2 migration, `20261018002600_clans_schools_and_classes.sql`, was added to make Clan Quest and Training fit schools and classes (see "Clan Quest and Training after the merge" below). Before any change, every database test file passed in a scratch copy. One app test failed before the first merge: `supabase/functions/lord/handler.test.ts` "the deployable file is up to date" (the Dragon Maths function file was already out of date on `main`; rebuilding it fixed it).

### What I built
- **Schools** (`20261018002300_schools.sql`): `schools` (name, active, board-approved date, contact teacher), `school_domains`, `profiles.school_id` (Douglas Park is school 1 with `douglaspark.school.nz`; every profile is moved into it; a player's school can never change, even by a later function: a trigger refuses). The site owner has `site_owners` and `owner_add_school`, `owner_add_school_domain`, `owner_set_school_active`, `owner_set_school_contact`, `owner_schools` (counts only, no names).
- **Sign-in:** the three locks stay. "Is it a Douglas Park email?" is now "is the email's domain on an active school's list?" (`school_for_email()`, `is_school_email()`). The sign-up hook and the database backstop use it, and the new profile gets the school. **Replaced cleanly:** the database function `school_domain()` is dropped; `SCHOOL_DOMAIN` in `src/config.ts` is deleted and the website no longer sends Google an `hd` hint (it named one school; the server list does the refusing). README's "How sign-in stays school-only" is updated.
- **Roles:** student; teacher (their own classes); **school admin** (`profiles.school_admin`, always also a teacher, so every existing "is this a teacher?" check still works); **site owner**. `make_first_teacher` works as before. New by-hand functions: `make_school_admin(email)` and `make_site_owner(email)`. A school admin can also make another admin (`school_set_admin`).
- **Classes** (`20261018002400_classes_and_warp.sql`): `classes`, `class_teachers`, `class_members` (one row per student, so moving just changes the row), `class_groups`, `class_group_members`, plus `warp_requests`, `warp_tries`, `class_events`. All closed to the website; reached only through functions.
- **Class Warp:** every class and group has a code made like a game code (same 22 letters, 5 long; a test checks the database and `shared/multiplayer.ts` agree). `warp_preview` shows the name (nothing changes), `warp_join` does it. A class code puts the student in the class (the screen asks "Leave Room 12 and warp to Room 14?" when they are in another); a group code joins the group and its class; one group per class. A teacher can turn a code off, set it to ask first, or reset it; asked students wait until a teacher says yes; teachers see warps in a live list (the page looks again every 8 seconds). A wrong code, an off code, an archived class's code, another school's code, or a teacher typing it all give the same answer, `{"status":"nope"}` ("That code didn't work."). **Rate limit:** 5 wrong tries in 10 minutes per student, then even the right code waits (kept in the database, so it holds across server copies; the game codes' limit is in each function's memory). Right codes are never counted.
- **Settings per class:** `app_settings` keeps its name and columns but now has one row per school (the default) and one per class; a new class starts as a copy of the school row (`give_class_settings` copies every column, including ones added later). Each person reads the one row that applies to them (their class's; a teacher: the first class they teach; otherwise the school default). The website still reads `app_settings` and gets that one row, so none of its queries changed. The game servers now ask for the settings of the player (`settings_of(player)`) instead of reading the table.
- **Screens:** `/classes` "My classes" (make a class; code with On / Ask me first / Off and "Make a new code"; groups' codes; live "Who has joined"; requests to say yes or no to; members with Move and Take out; add students from the list of students with no class; co-teachers; school admin: archive and bring back). `/warp` Class Warp for students (type the code, see the name, confirm, short calm animation, "Welcome to Room 12!"). A "Class Warp" button on the home page and a skippable "Join your class" band for students with no class. The Teacher page links to My classes, and hides "Make teacher" and the new-season panel from teachers who are not school admins.

### Decisions I made (change any you don't like)
- **A default class keeps Douglas Park working.** The migration makes the class **"Everyone"** with every current student and every current teacher teaching it, and with today's settings. I added `schools.default_class`: Douglas Park's is Everyone, so **new Douglas Park students and teachers join it by themselves**; otherwise from the day after go-live a new student would not appear on the Teacher page. Everyone's own Class Warp code is **off**. When real classes exist, a school admin turns this off (`school_set_default_class(null)`) and students warp into their rooms. Other schools have no default class.
- **Students with no class:** they play everything, are in their school's lobbies and boards, and get the **school default settings** (the school's `app_settings` row). Teachers see them only in the "students with no class" list, which they can tick students from. They do not appear on the Teacher page until in a class. A student in an archived class counts as having no class (the membership row is kept, so nothing is lost).
- **Teacher settings buttons:** the existing switches (friend games, reactions, space maths, Gem Keep, Maths Monsters, Dragon Maths) now change **every class the teacher teaches** (a school admin: every class and the school default). The SQL functions also take an optional class, ready for F.3's screens. A teacher who teaches no class gets "Make one on the My classes page first".
- **School admin only:** making or un-making teachers, archiving classes, starting a new season (which now clears only that school). This changes who can do these three things at Douglas Park: until you run `make_school_admin`, nobody can.
- **Teachers and hidden students:** a teacher sees hidden profiles of their own students only.
- **The Teacher page list** shows the students in my classes (a school admin: the whole school) and the school's teachers.
- **Class names** are typed by teachers only (letters, numbers, spaces, `. ' -`, 30 long; no `@`), and are shown to students only after a right code. The privacy summary is updated.
- **Dragon Maths seasons are now per class** (the season start is a setting). Boards inside a school compare season numbers, so two classes on different seasons would mix on one board. Fine while Douglas Park has one class; worth deciding before classes differ.
- **Daily News** belongs to a school now (`lord_news.school_id`; the village line is one a day for each school).

### Clan Quest and Training after the merge (18 October 2026, second merge)
Clan Quest and Training were built after F.2 and read the settings table and the pupil lists the old way. Merging `main` showed that, left alone, F.2 would have broken or leaked them:

- **Four F.2 functions had lost their Clan Quest parts** (they were copied from before Clan Quest): `my_progress` (no Clan Quest achievements or scores in the recent list), `progress_rules` (no `clanQuest` rules), `teacher_students` (clan activity missing from "last played") and `teacher_new_season` (Clan Quest points would not have been cleared, and the "stays" rule for Clan Quest achievements was lost). They now include Clan Quest, Dragon Maths, Power Clash and Monsters. `progress_counts` and `rebuild_progress` are not changed by F.2, so the Clan Quest versions stay. Nothing of Power Clash, Dragon Maths or Monsters was lost.
- **Clan Quest's settings** (on/off, raids, year band, topics, tables, fights a day, fame season) are columns of `app_settings`, which now has one row per school and per class. The old code read "the" row and wrote `where id` (it would have failed or read the wrong class). Now `load_clan`, `clan_extras`, `clans_settings(player)`, `clan_fights_per_day(player)`, the raid check in `save_raid` and the midnight rest read the pupil's own row (`settings_of`), and the teacher buttons (`teacher_set_clans`, `teacher_set_clan_raids`, `teacher_set_clan_maths`, `teacher_clans_new_season`) take an optional class like the other switches.
- **Villages, news and the Mines log belong to a school.** Every school has its own "Everyone else" village (Douglas Park's is still village 1; a school added later gets one automatically). A teacher's groups belong to their school and a pupil can only be moved into a group of their own school, so raids, votes and chests never cross a school. News lines and the Mines log have a school; the midnight job writes each school's "fights won" lines on its own.
- **The scoreboard** shows this school's clans only. **Teacher reads** (`teacher_clan_info`, `teacher_reset_clan`, `teacher_clan_maths_student`, `teacher_move_pupil`, and Training's `teacher_training_student`) need the pupil to be in one of the teacher's classes (a school admin: anyone in the school); `teacher_clan_maths_class` and `teacher_villages` list only the teacher's own pupils.
- **The `clans` and `training` edge functions need no redeploy.** Their built files are identical to `main`, and they only call database functions whose names and arguments did not change (`load_clan`, `save_clan`, `save_raid`, `clan_extras`, `clan_vote`, `clan_village_mates`, `clan_raid_target`, `record_training_*`).
- **Not decided yet:** a village is one group of pupils per school, not one per class. With several real classes in a school they still share the school's "Everyone else" village unless a teacher makes groups. Making each class its own village would be a Clan Quest decision for F.3 or later.

### Every table and function checked for the school (`my_school()`) or class check
Rows already saved belong to a student, so they are in school 1 through that student's profile; no table except those below needed a new column.

| What | Check added |
|---|---|
| `profiles` (row rule) | own school only; hidden ones only for the teachers of that student |
| `app_settings` (row rule) | only the one row that applies to me; now per school and per class |
| `power_games` (row rule) | teachers see only their own students' games (it was "teachers all") |
| `mp_games`, `space_games`, `power_games`, `card_game_seats` | database refuses to seat players from two schools (trigger) |
| `lord_news` | new `school_id`; unique per school and day |
| `leaderboard`, `gem_keep_leaderboard`, `monsters_leaderboard`, `lord_hall`, `lord_warriors`, `lord_news` | this school only |
| `lobby_games`, `space_lobby_games`, `card_lobby_games`, `power_lobby_games` | creator in my school, and my class's friend-games switch |
| `mp_player_status`, `card_/power_/space_player_status` | return the player's school; "gone" includes players at another school; the four game servers treat another school's game exactly like a wrong code |
| `lord_arena_candidates` | classmates from the player's school only |
| `teacher_students`, `teacher_student_detail`, `teacher_gem_keep_student`, `teacher_lord_student`, `teacher_monster_student`, `teacher_set_hidden`, `teacher_reset_name`, `teacher_reset_lord_hero`, `teacher_delete_student` | `require_teacher_of(student)`: in my class, or I am the school admin |
| `teacher_gem_keep_class`, `teacher_monster_class`, `teacher_lord_class` | only `my_students()` (including their refusals and hall rows) |
| `teacher_set_role` | school admin, same school; `school_set_admin` is new |
| `teacher_new_season` | school admin, that school only |
| `teacher_set_multiplayer`, `_space_reactions`, `_space_maths`, `_gem_keep`, `_monsters`, `_lord` | the classes I teach (or the one I name) |
| `gem_keep_settings`, `lord_settings`, `lord_server_settings`, `lord_current_season`, `monsters_settings`, `space_maths_context`, `record_gem_keep_key`, `progress_rules`, `my_progress`, `lord_commit`, `lord_daily_news`, `load_lord` | the settings (or news) of the right player's class and school |

**Looked at and not changed, with reasons:** `achievement_types` and `name_words` (the same list for every school, no student data); `bot_games`, `card_game_seats`, `mp_games`, `space_games`, `space_game_log` row rules, `my_*_stats`, `my_gem_keep`, `my_lord`, `my_monsters` (a student sees only their own rows; the seat trigger keeps games inside a school); `is_player_in` (membership in a game I'm in); `record_*` and `record_fact_answers` functions (written only by the game servers for one named player); `award_achievements`, `progress_counts`, `points_total`, `rebuild_progress` (per player); `waiting_code_taken` (checks that a new code is free, shows nothing); `choose_my_name`, `save_my_avatar` (own row); `pick_display_name` (names stay unique across the whole hub; a very large number of schools would need more words); `is_school_user`, `is_teacher` (unchanged meaning); the edge-function entry for `gem-keep` (no settings read) and `lord` `isTeacher`.

### Tests
- **Database (scratch copy), after the second merge:** all 28 test files pass. The four Clan Quest test files were updated (their teacher is now a school admin; Clan Quest's settings are read for a named pupil), and a new `clans_schools.test.sql` (51) covers Clan Quest with two schools: separate villages, no raids across schools, scoreboard, switches per school and per class, teacher reads, news by school and the fame season. Earlier result, before the merge: all 22 files passed. New: `schools.test.sql` (84: sign-in domains, a second school once added, switched-off school, roles, site owner, school 2 cannot read school 1's students, records, boards, lobbies, games, news, settings and the other way, new season per school), `classes.test.sql` (96: Everyone, teacher sees only own classes, admin sees all, moving keeps records, no-class student plays and gets defaults, per-class settings, archive keeps data, groups), `warp.test.sql` (85: class and group codes, changing class, off, reset, archived, ask first, wrong codes, rate limit, other school). Existing files were updated: teachers in them are now school admins, and a few checks read `app_settings` through the new shape; `security.test.sql` has the new function list.
- **Scratch copies:** the shared local database has a gap (it has Training but not Dragon Maths or Clan Quest), so `scripts/scratch-db.sh` now takes `SCRATCH_BASE=<version>` (it takes Training out of the copy and applies every migration after that version in order). The rehearsal uses `SCRATCH_BASE=20261018001500`.
- **Copy of today's data:** `scripts/f2-rehearsal.sh` puts fake Douglas Park rows in at the pre-F.2 state (5 students, one hidden, 2 teachers, changed settings, games, records, Daily News), applies the four migrations (starting from the live state: everything up to Training), and checks 36 things: every profile in school 1, all in "Everyone", settings identical, a teacher's list identical, no row lost, everything callable before still callable. **36 of 36 pass** (the 9 new ones cover a Clan Quest group, news line, Mines log line, settings and raid switch carried over).
- **App, after the second merge:** type check clean; the whole app suite passes (128 files, 2,359 tests, 1 skipped on purpose, none failing; the two load-timing tests that failed before passed this time); the production build works; `npm run build:functions` was run and changed nothing that was not already committed. Earlier, before the merge: new tests for the four game servers (another school's game is "not found"), `ClassWarp`, `ClassWarpCard`, `MyClasses` and the code alphabet.
- **Real browser** (Chromium against a scratch database, signed in as real tokens): a school admin makes Room 12 and sees its code; a student with no class sees the join band and the Class Warp button, types a wrong code ("That code didn't work."), then the right one, confirms, sees the animation and "Welcome to Room 12!"; the teacher sees the warp in the live list, makes Room 14 and moves the student (records kept, one class); an ask-first code holds a student until the teacher says yes; a reset code kills the old one; the admin archives a class (it leaves the list, members kept); home page, Gem Keep, leaderboard, profile and lobby open with no failed requests for a student in a class and one with none; a plain teacher sees none of the admin's classes and no new-season panel. **axe clean** at 1366 x 640 on every new and changed screen. At 844 x 390 axe is clean on Class Warp and the home page; on My classes and the Teacher page it reports contrast on the top bar's "Teacher" link and on an old Mission Control option. **Both were already like that before F.2:** at that width the top bar is wider than the screen (also for students), which pushes things off the edge. I did not change the top bar.

### What is untested
Real Google sign-in with a second school's account (needs F.8's checklist); the live Supabase project (nothing applied there); the edge functions running in Deno (their code is covered by the handler tests and the build); the scheduled tidy job `tidy-class-warp` (the scratch copy has a stand-in scheduler); what teachers think of the My classes page with real use; the top bar at tablet width (above).

### Go-live list (when you say "go live")
*Updated 18 October 2026 after merging `main` (Clan Quest, Power Clash, Training, dashboard grouping). Numbers are the final ones.*

1. In Supabase, apply the migrations **in this order**. Everything up to `20261018002200_training.sql` must already be in (Maths Monsters `001500`, Dragon Maths `001600` and `001700`, Clan Quest `001800` to `002100`, Training `002200`). Then, one after another: `20261018002300_schools.sql`, `20261018002400_classes_and_warp.sql`, `20261018002500_school_and_class_checks.sql`, `20261018002600_clans_schools_and_classes.sql`.
2. Deploy the **seven** functions whose rebuilt file differs from `main`: `multiplayer`, `space-game`, `card-game`, `power-clash` (they now read each player's school and class), `monster`, `lord` (settings and news per player) and `save-bot-game`. **Do not redeploy** `gem-keep`, `clans` or `training`: their files are identical to `main` and the database functions they call keep their names and arguments. Deploy the seven **right after** the migrations: the old versions read `app_settings` as one row and would fail for a moment. (`lord` and `monster` also carry F.1's shared-code changes and the Maths Monsters regeneration that `main` noted as not redeployed.)
3. By hand, in the SQL editor, once you have signed in to the website once: `select public.make_school_admin('<your douglaspark address>');` and `select public.make_site_owner('<your douglaspark address>');`. Until then nobody can make teachers, archive classes or start a new season.
4. Turn off the automatic "Everyone" class (James's decision, 18 Oct 2026), straight after step 3. `school_set_default_class(null)` checks that a school admin is signed in, and the SQL editor is not signed in as anyone, so from the SQL editor run the same thing directly: `update public.schools set default_class = null where id = 1;`. (As the signed-in admin, `select public.school_set_default_class(null);` does the same.) New students then start with no class and warp into their room. Everyone's own row and members stay, so nothing changes for today's students.
5. Merge `maths-focus` to `main` and let GitHub Pages rebuild the site.
6. Afterwards: sign in as a teacher and as a student and check the Teacher page, a game, and Clan Quest (its on/off switch and the village page); open My classes.
7. Nothing else by hand.

### What F.3 needs from you
See the message that came with this stage.

### James's answers after F.2 (18 October 2026)
- **Go live:** not yet. F.3 is built on the scratch copy first.
- **"Everyone" class:** turn the automatic joining **off at go-live** (now step 4 of the go-live list, after step 3; from the SQL editor it is the `update` form, because the function needs a signed-in admin). New students then start with no class and warp into their room.
- **Dragon Maths seasons:** stay per class, as built.
- **Teacher page switches:** F.3 adds a class picker, so a teacher with several classes can set each one.
- **Class names:** a new class starts named after its teacher's email (the part before the @, for example "mr.teacher"); the teacher can rename it. Teachers see this on their own page only, and the privacy rule for class names stays (shown to students only after a right code). A school admin turns accounts into teachers, as now. To build in F.3 (not started).
- **F.3:** not started yet. Waiting for James.

## F.2 went live (18 October 2026)

James said go. Done in this order, nothing failed:

1. **Database:** the four F.2 migrations went onto the live project one after another: `002300_schools`, `002400_classes_and_warp`, `002500_school_and_class_checks`, `002600_clans_schools_and_classes`. (The go-live message said three; the list in this plan has four, and the fourth is what keeps Clan Quest and Training working, so all four went in.)
2. **Functions:** `multiplayer`, `space-game`, `card-game`, `power-clash`, `monster`, `lord` and `save-bot-game` were deployed straight after. `gem-keep`, `clans` and `training` were left alone, as the list says.
3. **By hand:** `jamesriley@douglaspark.school.nz` is now school admin (and teacher) and site owner. The automatic "Everyone" class is off (`schools.default_class` is empty for Douglas Park), done with the `update` form because the SQL editor is not signed in as anyone. New students now start with no class.
4. **Website:** `maths-focus` was pushed to `main` as a straight fast-forward (nothing new on `main` to merge). The "Test and publish" run passed, build and deploy both green.
5. **Checks from outside:**
   - All ten functions answer **401** when signed out.
   - All eleven new class and school tables, plus `app_settings`, answer **42501** to a signed-out visitor.
   - **Scored games: 202 before, 202 after.** Profiles: 36 before, 36 after.
   - Settings read back through the sign-in rules for a real student and for James's teacher account: each sees exactly one settings row, and every value matches what it was before F.2 (Gem Keep calm, Clan Quest on, Dragon Maths on, Monsters on, and so on).

Not checked by me: a real browser sign-in on the live site (step 6 of the list is for James: Teacher page, a game, Clan Quest, My classes).

## Stage F.3 results: groups and timed focus (18 October 2026)

**Status: built and tested on a scratch copy of the database and in a real browser. Nothing is live.** No migration was applied to the live database, no function was deployed, nothing was merged to `main`. F.2 is live (see "F.2 went live"), so I started from `main` as it is now. Work is on branch `maths-focus`.

### What I built
- **The focus, decided on the server** (`20261018002700_maths_focus.sql`). A student's focus is the first of: a running teacher focus for them, for their group, for their class, their own choice (if the class allows), auto. `maths_focus_of(player)` works it out and `my_maths_focus()` gives it to the signed-in student. A teacher focus only counts while it is running, and only in the class it was made for, so moving class drops it. Games never decide the focus.
- **Timed focuses.** Tables `maths_focuses` (one row per student, group or class, with start, end, an "ended early" time and a batch id so one press = one entry) and `student_maths_focus` (the student's own pick). Closed to the website. Lengths are worked out by the server in New Zealand time: This lesson (1 hour), Rest of today (midnight), **Until Friday (midnight at the end of Friday, the default)**, 1 week, or a time you pick. Nothing is deleted: End now just sets an end time, and ended ones stay for the history. No timer or scheduled job.
- **Teacher functions:** set (class, group, or a list of students), extend (must end later than it does now), end now, list running (and history), the class switch `students_choose_focus` (on by default, per class, new classes copy it), and `teacher_class_settings` (reads one class's settings for the picker).
- **Student's own choice** (`set_my_maths_focus`, `clear_my_maths_focus`): refused with a plain message when the class switch is off. What they picked is kept underneath, and comes back when a teacher focus ends or the switch goes back on.
- **Groups:** the F.2 tables and functions are now used by screens: make, rename (new `teacher_rename_group`), delete, fill (a drop-down on each student). Each group still has its own Class Warp code.
- **Class names:** a class made with no name is named from the teacher's email before the @ (marks a class name can't hold become a dash, " 2" added if taken that year). Renaming had no screen before; it does now.
- **Screens:** `/focus` (Set focus: class picker, the switch, Running focuses with Extend and End now, Set a focus, history); a **class picker** on the Teacher page (every switch there now reads and changes the picked class only); a **"My maths focus" card** on a student's home page (the note, and a picker when allowed); the note on Gem Keep's map and on Mission Control's settings screen; groups, rename and the optional class name on My classes.
- **Gem Keep and Mission Control follow the focus.** One shared pack (`makeFocusPack`): no focus = exactly what they did before (times tables); with a focus = the chosen skills as the main questions, earlier skills as review (about 30%, off with "only these"), no stretch. The class's own Gem Keep switches still apply (tables switched off, division, multiple choice). **The change shows from the next level or the next game**: Gem Keep asks again when a level is about to start, Mission Control as a game starts; if the lookup fails or is slow (1.5 s) the focus it has is kept. Chess, checkers and 101 are untouched.
- **Every built skill works in both games** (early facts, adding facts, times tables, division), which needed more than the screens: answers are saved under the right pack (Gem Keep's saving and the two game servers now accept the four packs), and the server can mark a question for any of them (`solveParts`, checked against every question the generators make). A record key like `bond10:3+7` was **refused by the database** (letters-only check): this migration widens it. Without that, early-facts answers could never have been saved.

### Decisions I made (change any you don't like)
- **Level Key follows the focus too.** All of a level's maths, including the Level Key, comes from the focus. The alternative (key always uses the level's own tables) would have meant a second pack and mixed records. A student can therefore pass a key by answering the focus skill.
- **Auto in the games is unchanged for now** (F.4 makes auto cover the whole ladder). So "no focus" is today's behaviour, not the ladder.
- **Switched-off tables and division still win** over a focus (a ×7 focus with ×7 switched off gives no ×7).
- **Unknown skill names** are accepted by the database (it can't see the ladder) and ignored by the games. The screens only offer built skills.
- **The teacher picker has no "all my classes" choice**, and lists the classes I teach first. A teacher with one class sees its name; with none, a nudge to make one.
- **Class names from the email show to students** after a right code. If an email is a real name ("jamesriley") a student would see it after warping in. The My classes page says to rename it; it doesn't stop it. Say if you'd rather it never defaults to the email.
- **A student's pick can't be saved while the switch is off**, and nothing in the focus is shown to other classes: the teacher list shows student names (the safe word names) only.

### Tests
- **Database (scratch copy):** all 29 files pass. New `maths_focus.test.sql` (180 checks): precedence, newest wins, ending, expiry, layering, own choice kept underneath, switch on/off, Friday/midnight (New Zealand time), extend/end/history, **teachers can't set, extend, end, list or read another teacher's class, a student in another class, or another school**; moving class drops a focus; groups; names; settings picker; grants. `security.test.sql` has the new function list.
- **Rehearsal on today's data** (`scripts/f3-rehearsal.sh`, 39 checks, F.2's live state plus fake classes, a group, changed settings and records of every pack): nothing lost, settings identical, new switch on everywhere, lists identical, and the new parts work on it.
- **App:** type check clean; production build works; `npm run build:functions` run. Whole suite passes, including the slow Gem Keep and Mission Control files. New tests for the shared maths (focus rules, solver against every generator), the three servers, the Set focus screen, the picker, the student card, groups and names on My classes, and the data layer.
- **Real browser** (Chromium, the real site against a scratch database, signed in as real tokens): a blank class name became `ms.teacher`, renamed; groups made, renamed and filled; the picker changed Room 14's switch only (checked in the database); Set focus for a class and for a group; Running focuses showed both with time left; a student in the group saw "Your teacher picked Number facts to 10 for another 60 minutes" and could not change it, one in the class saw "×6, ×9 until Friday"; a student picked their own focus and it survived a reload; the teacher turned choosing off (student told so) and on (their pick came back); Gem Keep's Level Key asked bonds/doubles, ×6/×9, and doubles/halves for the three students; **axe clean** at 1366 x 640 on the Teacher page, Set focus, My classes with groups and the student card. At 844 x 390 only the top bar's contrast fails, as before F.2.

### What is untested
Real Google sign-in; the live Supabase project; the edge functions running in Deno (code is covered by handler tests and the build); Mission Control with classmates in a real browser (covered by handler tests; the solo game in the browser only to the settings note); what teachers think of the screens with real use; a student's phone.

### Go-live list (when you say "go live")
1. Apply `20261018002700_maths_focus.sql` (one migration; nothing by hand).
2. Deploy the **three** functions whose behaviour changed: `gem-keep` (accepts the other packs), `space-game` (reads the focus) and `save-bot-game` (marks and records every pack). Deploy them **right after** the migration. The `card-game` file also changed by one unused line (it no longer carries the space game's code): no need to redeploy it.
3. Merge `maths-focus` to `main`; wait for Pages.
4. Afterwards: as a teacher open Teacher page (picker), Maths focus, My classes (groups); as a student check the home card and Gem Keep.
Until the site is merged nothing is visible, and with no focus set every student plays exactly as before.

### What F.4 needs from you
See the message that came with this stage.

## F.3 went live (19 October 2026)

James said go. The F.3 migration (`20261018002700_maths_focus.sql`) was applied to the live database, `gem-keep`, `space-game` and `save-bot-game` were deployed straight after, and `maths-focus` was fast-forwarded into `main` (55daa87); Pages built green. With no focus set, students play exactly as before.

## Stage F.4 results: auto everywhere, placement, and the student path (19 October 2026)

**Status: built and tested on a scratch copy of the database and in a real browser. Nothing is live.** No migration was applied to the live database, no function was deployed, nothing was merged to `main`. Work is on branch `maths-focus`.

### Before I started
`main` had moved since F.3: it brought in `20261019000100_my_moves_left.sql` (the moves-left cards), so F.4's migration is numbered **`20261019000200_maths_auto.sql`**. I merged `main` into `maths-focus` first. No test was failing before I started (my first full run happened while I was editing, and its one failure was the built `space-game` file being out of date from my own change).

### What I built
- **The class switch** "Games pick the maths (auto) when there is no focus" (`app_settings.maths_auto`, **off by default**, per class, new classes copy it). On the Set focus screen, with a short explanation. With it off, nothing changes: every student's focus is byte-for-byte what it was (checked in the rehearsal), and Gem Keep and Mission Control keep asking the times tables.
- **Auto over the whole ladder** in Gem Keep and Mission Control. When a student has no focus and the class has the switch on, the games use `AutoPack`: 60% their current skill, 30% review (weakest first, hard tables a bit likelier), 10% stretch. Gem Keep levels unlock as before. The class's tables-off, division and multiple-choice settings still apply (see "Decisions"). A teacher focus, or one the student picked, still wins. The switch and the student's start point ride inside the focus the database already sends, so the games needed almost no new plumbing.
- **Never going backwards.** `ladder_places` (closed to the website) holds each student's furthest place. Only the answer-saving server functions write it, from the student's records, through `record_ladder_place`, and a trigger refuses any move back even with the server's key. Forgetting ×7 gives more ×7 review but never drops the place (tested).
- **Placement check** (`/placement`, ~10 questions): starts at the class's year start, jumps up two skills after a right-and-quick answer (one after a first miss), steps back one after a wrong or slow one, and starts the student just below the highest skill they passed. Friendly, never called a test, no score, **skippable**. The server re-checks every question (it works each one out from how it was shown, and replays the walk) before storing only "where to start" in `ladder_placements`, once; a skip is stored too so they aren't asked again. Until it is done, the start is the class's year level, or the first skill if the year is empty.
- **Starting points by year level**: the first built skill taught a year below the class (one year behind, because earlier skills come back as review; the number is `START_YEARS_BEHIND` in `config.ts`). Year 5 starts on ×6, ×9.
- **Student progress path** ("My maths path" on the home page): a strip of stops, "You are here", "N of M skills secure", a button that opens the full path, times-table skills open into their tables, "Your teacher's pick" marked while a teacher focus runs, and a "You moved up!" message (once, with a "Great!" button; reduced-motion safe). Only their own path, no ranks, no years. It appears only when the class has auto on, so a class that hasn't turned it on sees nothing new. Everything comes from `ladderProgress`/`placeProgress`, so the path, Gem Keep, Mission Control and the server agree.
- **Teacher side:** the switch on Set focus; a **Year level** box on My classes (it could only be set when making a class before).
- **A bug found on the way:** `AutoPack` took question numbers from whichever pack made the question, so two questions in a row could share a number and the question box did not reset. Fixed (the ladder numbers its own questions). This also affected F.3 focuses that mixed packs.
- **Another:** when Gem Keep or the solo space game switched pack between levels, only the times-table records were carried over. They now keep every record.

### Decisions I made (change any you don't like)
- **Skills before a student's starting point are "Moved past", not "Secure".** They sit behind the student (auto never puts them back there) but the count "N of M skills secure" only counts skills their records really show secure, so a Year 5 student starts on "0 of 9" instead of getting free credit. The "You moved up!" message only fires for skills that became really secure, not for a jump to a new starting place.
- **Division off now also means division isn't counted**: with a class's division switch off, division facts are left out of auto's questions *and* out of "is this skill secure" (otherwise a student could never finish a times-table skill). Teacher focuses were already like this.
- **Only built skills show on the path and count.** **9 of the 31 skills in the ladder list are built** (the plan said 30; the list has 31). The other 22 stay skipped by auto and don't count; they appear as F.5 and F.6 build them.
- **The furthest place is only kept while the class has auto on**, and is updated whenever answers are saved (at most once every 30 seconds per student in Gem Keep and Mission Control).
- **A skipped placement is final** (the class's year start is used). There is no teacher button to reset a placement yet.
- **Placement answers are not added to the student's records** (they only say where to start).
- **Placement checks are on the honour system for speed**: the server checks every question and the walk, but "answered in under 5 seconds" is the browser's word, so a student could claim to be quick. Cheating only gives them harder questions.

### Tests
- **Database (scratch copy):** new `maths_auto.test.sql` (67 checks: switch off by default and nothing changes while off, who may turn it on, the focus carrying the ladder, the furthest place only moving forward even by direct update, the placement stored once, nobody else can read or write another student's, class's or school's place, `my_ladder` only gives your own); `security.test.sql` updated (two new callable functions). All files pass in the scratch copy except two Clan Quest checks about scheduled midnight jobs, which fail only because a scratch copy made without `SCRATCH_BASE` has no scheduler for them (the same test passes on the F.3 scratch recipe; not touched by F.4).
- **Rehearsal on today's data** (`scripts/f4-rehearsal.sh`, 39 checks, today's live state plus fake classes, a group, running focuses, a student's own pick, changed settings and records): nothing lost, every student's focus identical apart from the ladder facts, every setting identical with the new switch off everywhere, every teacher list identical, the new parts work on it. `scripts/scratch-db.sh` now also copies Douglas Park's rows when no `SCRATCH_BASE` is given (the shared local copy is now fully up to date, so the old recipe collides).
- **Shared maths** (`place.test.ts`, 38 tests): auto over the ladder with seeded random, the 60/30/10 mix from a starting place, tables-off and division settings kept, the solver agrees with every question auto can ask (many seeds and starting places), forgetting never drops the place, placement jumps up and steps back, the server check refuses a wrong walk, a bad question or a wrong count.
- **Servers and screens:** Gem Keep on auto (slow suite), Mission Control server and solo game on auto, gem-keep handler (place sync, placement), the path card (hidden when off, tables, teacher's pick, moved up, no storage), the placement page, Set focus switch, My classes year level.
- **Real browser** (Chromium against a scratch database, signed in with real tokens): a Year 5 student sees "0 of 9", "You are here: ×6, ×9", opens the full path (six "Moved past", tables inside), does the warm-up (ten answers sent and accepted by the server check), sees "All done!" with no score; after a placement the path starts there; a student who gets a skill secure sees "You moved up!" once; a student on a teacher focus sees "Your teacher's pick"; a student in a class with auto off sees nothing new; the teacher turns auto on for one class (only that class changes) and sets a year level. **axe clean** at 1366 x 640 and 844 x 390 on every new and changed screen, with reduced motion too; at 844 x 390 the top bar's contrast fails exactly as it did before F.2 (not touched).
- **App:** type check clean; whole suite including the slow files passes (144 files, 2,624 tests, 1 skipped on purpose, none failing); production build works; `npm run build:functions` run — only `gem-keep`, `space-game` and `save-bot-game` changed.

### What is untested
Real Google sign-in; the live Supabase project; the three edge functions running in Deno (their code is covered by handler tests, the shared tests and the build, and the database calls by the rehearsal); the placement check's *timing* on a real student's device; what teachers and students think of the path; Mission Control with classmates on auto in a real browser (covered by handler tests); the top bar at phone width.

### Go-live list (when you say "go live")
1. Check `20261019000100_my_moves_left.sql` is already applied (it came from `main`). Then apply **`20261019000200_maths_auto.sql`** (one migration; nothing by hand).
2. Deploy the **three** functions whose files changed: `gem-keep` (placement, keeps the furthest place), `space-game` and `save-bot-game` (keep the furthest place; auto questions). Deploy them **right after** the migration. No other function changed (`monster`, `lord`, `multiplayer`, `card-game`, `power-clash`, `clans`, `training` are identical).
3. Merge `maths-focus` to `main`; wait for Pages.
4. Afterwards: on Set focus, turn "Games pick the maths (auto)" on for one class; set that class's year level on My classes; as a student in it open the home page (the maths path), do the warm-up, and play a Gem Keep level.
Until a teacher turns the switch on, every student plays exactly as before.

### James's answers after F.4 (19 October 2026)
- **Decimal point key:** yes, add it in F.5 (shown only on questions that need it).
- **Order of operations:** answers are **four choices to tap**, with wrong choices made from common mistakes (working left to right gives 20 for 2 + 3 × 4).
- **Ladder order:** keep section 12 as it is.
- **Warm-up:** try it on one class after go live, once auto is switched on for them.
- **Go live:** not yet. F.5 is built on the scratch copy first.

## F.4 went live (19 October 2026)

James said go. Done in this order, nothing failed:

1. **Main moved again** (Maths Monsters N.7 and a Bond Match plan): merged into `maths-focus`, no new migration, and `npm run build:functions` changed nothing.
2. **Database:** `20261019000200_maths_auto.sql` applied to the live project (`20261019000100_my_moves_left.sql` was already in). The new switch is off on all 2 settings rows.
3. **Functions:** `gem-keep`, `space-game` and `save-bot-game` deployed straight after. Nothing else.
4. **Website:** `maths-focus` pushed to `main` as a straight fast-forward.
5. **Checks from outside:** the three functions answer 401 signed out; the two new tables, `app_settings` and `my_ladder` answer 401 to a signed-out visitor; profiles 36 before and after.

Not checked by me: a real browser sign-in on the live site. To see it, turn the switch on for one class (Set focus), set the class's year level (My classes), and open a student's home page.

## Stage F.5 results: generated skills and question-type records (19 October 2026)

**Status: built and tested on a scratch copy of the database and in a real browser. Nothing is live.** No migration was applied to the live database, no function was deployed, nothing was merged to `main`. Work is on branch `maths-focus` (pushed).

### Before I started
`main` had not moved since F.4 went live (`git fetch` brought in nothing), so there were no new migrations to number after: F.5's is **`20261019000300_maths_generated.sql`**. No test was failing before I started (the normal suite: 139 files, 2,585 tests pass, 1 skipped on purpose). In the full run at the end one load-timing test (`SetFocus.test.tsx`, "opens on the first class") failed once and passed when re-run alone, as the known flaky ones do.

### What I built
- **Ten generated skills, all the stubs you listed.** `bonds-100`, `bonds-1000`, `round-10-100`, `round-1000`, `round-big`, `round-million`, `times-tens`, `factor-pairs`, `squares-cubes` and `bedmas` are real skills now, in their old places in the ladder. **`built` went from 9 to 19.** The fractions, decimals and percentages stubs (and the early-facts stub `ten-and`, which was not in your list) are still stubs. None of the ten was much bigger than the others (BEDMAS has the most to it, with 31 sum shapes, but it went in whole), so nothing needed splitting.
- **Question-type records.** Skills with endless questions keep one record for each *type* of question, with a Leitner box like a fact. There are **57 types**. Key format (written in `shared/maths/skillPacks/generatedKit.ts`): `<skill word>:<detail>[:<detail>]`, lower case, for example `round:100:3digit`, `round:100:near-halfway`, `bond100:fives`, `times:tens-tens`, `factor:count`, `square:next`, `bedmas:brackets-first`. The part before the first colon is 1 to 10 letters or digits starting with a letter, the rest uses only `a-z 0-9 : + / -` and is at most 40 characters. **The database check F.3 widened (`^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$`) already accepts every key, and the pack check (`^[a-z0-9-]{1,30}$`) accepts the new pack name `generated`, so no table changes.** All 57 are stored under one pack, `generated`, in the same table as every other record. A test makes sure each key fits, and the module refuses to load if one doesn't.
- **What the types are.** Bonds to 100 and 1000: tens, fives (fifties), any, and "take away" (100 − 37). Rounding: by size (`2digit`, `3digit`…), **exactly halfway** and **close to halfway** (which is where students go wrong), for 10, 100, 1000, 10 000, 100 000 and 1 000 000, then decimals (to a whole number, to a tenth, to a hundredth). Times with tens and hundreds: 4 × 30, 6 × 300, 20 × 30, 34 × 10, 10 × 100 and 240 ÷ 6 (none of them is a times-table fact, so they never share a record). Factor pairs: the other number in a pair, how many factors, the biggest factor, the biggest number that goes into two numbers. Squares and cubes: 7 squared, 4 cubed, square root, cube root, the next square number. Order of operations: two operations (times first, divide first, left to right), brackets (times, divide), then mixed with and without brackets.
- **Every generator builds the question again from its numbers**, so the server can mark any answer. `solveParts` (which the server uses for solo games and the warm-up) now reads each new question back from how it was shown (a reader for each skill that takes the sum apart, builds the question again, and only accepts it if it comes out *exactly* as shown), so a made-up sum is refused. The tests check the solver against every question every generator can make (300 each, 57 types) and against separate "oracle" maths (a plain calculator for the order-of-operations answers, digit arithmetic for rounding, and so on).
- **The decimal point key.** `Question.input: 'decimal'` and the pad key already existed (from Dragon Maths and Maths Monsters). Now the rounding questions use them: **the key is shown on rounding to a tenth or a hundredth** (and on nothing else new), and every whole-number question looks and behaves exactly as before (checked: no point key, no `data-decimal` on the pad, a stray point on the keyboard is ignored). Typing 4.15 works with the pad and the keyboard, marking works, and the screen-reader text says "Your answer: 4 point 1 5" and reads the question as "Round 4 point 1 5 to the nearest tenth". The pad shows the typed digits as typed.
- **Four choices to tap, from named mistakes.** Order of operations is *always* four choices (and no number pad), whatever the class's multiple-choice switch says. For BEDMAS the wrong choices are the answers you get by following a named mistake: working left to right (20 for 2 + 3 × 4), ignoring the brackets, adding and taking away first, working equal steps right to left, adding every number, leaving out the first or last number. Rounding (and every other new skill) uses the same idea when the class has multiple choice on: rounding the wrong way, to a smaller or bigger place, a step too far, and so on. **A wrong choice is never a random number**: every question lists its named mistakes, a question with fewer than three usable ones is never asked, and the choices are always different from the right answer and from each other (tested on every question, including that each wrong choice is one of the named mistakes).
- **Auto, focus and the path** needed no new code beyond the ladder list: the ten skills join auto (60% / 30% / 10%), the teacher's Set focus picker, the student's own picker, `ladderProgress` and the path ("0 of 19"), and everything agrees because they all read the same list. Checked in the browser: the path lists 19 skills, the picker offers 19 grouped plainly (Early number facts, Times tables, Place value, Rounding, Order of operations), and a teacher's note reads "Your teacher picked Rounding bigger numbers and decimals and Order of operations until Friday".
- **Gem Keep and Mission Control** ask and mark every type, including a classmate server game, with the class's multiple-choice switch still working (see the problems found below, which would have stopped it).
- **Teacher side:** only two small things. The Maths Monsters and Dragon Maths teacher tables name the new pack and each question type in words ("Rounding to the nearest 100 when it is close to halfway") instead of showing the raw key, and the early-facts pack has a name too.

### Decisions I made (change any you don't like)
- **"Quick" is 8 seconds for these skills, not 5** (`QUICK_MS_BY_PACK` in `config.ts`). A box only moves up on a *quick* right answer, so with 5 seconds a student who knows how to round 67 407 to the nearest 1000 but takes 7 seconds would never get the skill secure. The database already takes the quick time as a parameter, so this needed no migration; the three saving functions pass 8 000 for this pack, the warm-up uses the skill's own time, and facts stay at 5. One time for the whole pack, not one for each type; say if you want different times (bonds are faster than rounding million).
- **No "pick the right one of these" questions except order of operations.** I wanted "which of these is a factor of 24" and "which is a square number", but the server marks solo games and the warm-up from the *sum as shown*, and the choices aren't in it, so it could not tell a real answer from a made-up one. I used questions whose answer follows from what is shown ("how many factors does 12 have", "the next square number after 30", "7 and ? are a factor pair of 28") and put the picking only where the answer is the number (BEDMAS). F.6 will hit the same limit for fractions (see "What F.6 needs").
- **Decimals live in `round-big`**, as you asked ("round-big uses the decimal key"): to a whole number, to a tenth (4.15 → 4.2) and halfway cases. Row 26 of the ladder ("hundredths to a tenth") is therefore in `round-big` too, and `round-million` has the million and a 7-digit number to the nearest 100 000, plus thousandths to a hundredth.
- **The point key shows on every "to a tenth/hundredth" question even when the answer is a whole number** (16.97 to a tenth is 17). A student can't know the answer's shape before they work it out, and a key that appears only sometimes tells them the answer. Typing 17 or 17.0 both work.
- **Halfway rounds up** (65 → 70, 4.15 → 4.2). It's the NZ rule and the question types for it (`halfway`, `near-halfway`) are there to practise it.
- **Order of operations leaves out exponents.** The NZ order includes them, but a square needs a raised number on the screen and the squares skill covers it ("7 squared").
- **Factor pairs** are the four types above, not "choose a pair that makes 24". The last one (the biggest number that goes into two numbers, like 12 and 18) is a stretch; it can come out if you think it is too much for Year 5.
- **The 70% rule for question types.** A skill is secure when 70% of its types are in box 2 or higher. A type reaches box 2 after two quick right answers with no mistake between, so `round-10-100` (8 types) needs 6 types, about 12 quick right answers, and one lucky type is never enough. Every skill has 4 to 9 types. With only 4 types (bonds-100, round-1000, factor-pairs, bonds-1000) the "don't repeat the last 3" rule makes the order of types fairly predictable; the numbers inside a type still change every time. I left the rule as it is.
- **Placement stays at 10 questions.** It jumps two skills up after each right-and-quick answer, so 10 questions can climb the whole 19: tested from every year level (a student who is right and quick all the way ends just below the top, from Year 1 to Year 8; one who gets nothing right starts at the first skill). The warm-up now allows a skill's own quick time (8 seconds for these), and it accepts up to 12 parts in a question (it stopped at 8, which order of operations would have broken).
- **`bonds-1000` has no NZC tag** (James's ladder gives it none; it comes from the Number Framework). Its year is unknown, so no class starts there by year level.
- **Teachers see the pack in plain words** on the two pages that show raw records, as above.

### Problems I found on the way (all fixed)
- **Mission Control would have refused every one of these answers.** The solo game's save only accepted whole-number answers up to 1000 (so 4.3 and 3 000 000 were refused), questions of at most 5 parts with each part at most 6 characters (so every rounding and order-of-operations question was refused), and the classmate server took only whole-number typed answers up to 1000. All three now take any number from 0 to a billion, up to 12 parts of 40 characters, and compare numbers the way the question box does (so 4.30 is 4.3). The classmate server also never sent the browser a question's `maxLength` or `input`, so a 4-digit answer could not be typed and a decimal question had no point key; now it does.
- The warm-up page compared a typed answer with `===`; it now uses the same comparison as everything else.

### Tests
- **Database (scratch copy):** new `maths_generated.test.sql` (20 checks): all 57 keys accepted, nine kinds of bad key and pack name refused (capitals, a point, no colon, a first word over 10 characters, starts with a digit, over 40 characters after the colon), boxes move by the Leitner rules, students cannot add or write records, Gem Keep and Mission Control are handed the generated records but never Maths Monsters' own, each student sees only their own. All 32 test files pass in the scratch copy except the same two Clan Quest checks about scheduled midnight jobs as in F.4 (a scratch copy has no scheduler for them; not touched by F.5).
- **Rehearsal on today's data** (`scripts/f5-rehearsal.sh`, 36 checks): the live database as it is after F.4 (classes, a group, running focuses, a student's own pick, changed settings, records of several packs including Maths Monsters', Room 14 on auto with a stored place, a placement and a skip), then the F.5 migration. Every record, setting, focus, place, placement and teacher list is exactly as it was; `my_gem_keep` and `my_ladder` give exactly what they gave; then the server records answers for all 57 types and Gem Keep, the home page and Mission Control are handed them (and never Maths Monsters' records); no function got new access.
- **Shared maths** (`generated.test.ts`, 247 tests): for every type, 300 rolls each: a sound question, rebuilt from its numbers (same parts, same answer), the solver agrees (same answer, same record), four distinct choices with one right, whole choices unless a decimal question, room to type the answer, the point key only on tenth/hundredth rounding, every wrong choice a named mistake, same seed same questions and another seed different ones, bad numbers refused. Separate maths for the answers (bonds, rounding including halfway, times, factors, squares, cubes, 31 sum shapes for BEDMAS against a plain calculator). The solver doesn't take over times-table or adding questions (10 × 10, 4 × 10, 120 ÷ 10 stay theirs). In `place.test.ts`: 19 built skills (10 generated, 4+ types each), the placement walk from every year, the 70% rule on a skill, auto's 60% from a generated skill, many seeds and floors including the new skills, a warm-up taking 7 seconds on a generated question accepted by the server check.
- **Servers and screens:** Mission Control classmate server (16 new: each of 8 skills, right and wrong, marked on the server and recorded under the question type; decimal and big answers; nothing silly accepted); solo save (all ten skills in one game, recorded once under `generated`, a wrong answer and a made-up sum refused); Gem Keep's save (the pack and keys accepted, wrong-pack keys dropped); the question box (decimal key, 4.15, a million, four choices, bracket groups); Gem Keep's Level Key and Mission Control's solo game playing the new skills in the screens (slow suite); the warm-up with decimals and choices.
- **Real browser** (Chromium against a scratch database with real tokens, 86 checks): a Year 8 student's warm-up walked through 10 questions (order of operations, decimals to a hundredth, squares, rounding to the nearest 100 000, factors, times with tens, rounding to 1000, plain times tables) each worked out from what is on screen; the point key showed exactly on the tenth/hundredth ones; order of operations was four taps and no pad; 4 and 14.62 typed with the keys showed as typed; no question ran off the edge at 1366 or 844 wide; what the browser sent is exactly what the server accepts (`checkPlacement`); a Year 5 student's path ("0 of 19", 19 rows, the new skills in plain words); the teacher's Set focus ticking two new skills (19 offered, grouped, told "Focus set for …"); a student seeing "Your teacher picked …"; a student's own picker offering 19. **axe clean** at 1366 x 640 and 844 x 390 on every new question type, the path, Set focus, the student card and the picker; at 844 x 390 only the top bar's contrast fails, as before F.2 (not touched).
- **App:** type check clean; production build works; `npm run build:functions` run. Whole suite including `TESTS=all`: 147 files, 2,950 tests pass, 1 skipped on purpose; one load-timing test failed once and passed alone.

### What is untested
Real Google sign-in; the live Supabase project; the three functions running in Deno (their code is covered by handler tests, the shared tests and the build, and the database calls by the rehearsal); how long real students take on these questions (8 seconds is my guess); Mission Control with classmates and decimals in a real browser (handler tests only); the 844 x 390 pad height for a decimal question beyond "nothing runs off the side and axe is clean"; a phone.

### Go-live list (when you say "go live")
1. Apply **`20261019000300_maths_generated.sql`** (one migration; nothing by hand). It only replaces two functions (`my_gem_keep` and `space_maths_context`) so they hand the games the new pack's records. It makes no table change and no data change.
2. Deploy **three functions, right after the migration and before the website goes out**: `gem-keep`, `space-game` and `save-bot-game` (they now know the pack, the 8-second quick time and the wider answers). Order matters: a class with auto on whose students get these questions before the functions are deployed would have their saves refused for the new pack. `monster` and `lord` were rebuilt too but only by one unused condition (`|| made.choose`, which no Monsters or Dragon Maths question uses): no need to redeploy them.
3. Merge `maths-focus` to `main`; wait for Pages.
4. Afterwards: with a class's auto on, a student's path says "N of 19"; as a teacher set a focus on Rounding or Order of operations for a test student and check Gem Keep's Level Key and Mission Control ask it (decimal key on a tenth, four choices on order of operations).
Until a class has auto on, or a focus names a new skill, every student plays exactly as before; Chess, checkers and 101 stay maths-free.

### What F.6 needs from you
See the message that came with this stage.

## Stage F.6 results: fractions, decimals and percentages (19 October 2026)

**Status: built and tested on a scratch copy of the database and in a real browser. Nothing is live.** No migration was applied to the live database, no function was deployed, nothing was merged to `main`. Work is on branch `maths-focus` (pushed). **F.6 has no migration.**

### Before I started
- `main` had not moved (`git fetch` brought in nothing). **F.5 is not live yet**, so F.6 is built on top of it; F.5 goes first (see the go-live list).
- Tests before I started: I ran the whole suite once; the run was cut short by my own time limit, and the only failure it showed was a load-timing test (`TrainingPage.test.tsx`, "opens on the student's saved records"), which passes when run alone. So I cannot say the whole suite was green before I started, only that nothing failed apart from that one flaky test in the part that ran. After my work the whole suite (`TESTS=all`) passes: 148 files, 3,237 tests, 1 skipped on purpose.

### What I built
- **All of it, in your order.** Every stub in the ladder is a real skill now, so **`built` went from 19 to 31 (all 31)**. First the fractions of an amount (`unit-fraction-of`, `fraction-of`), then percentages (`percent-basic`, `percent-of`), then tenths and decimals (`tenths`, `add-tenths`, `decimal-equivalents`, `times-decimals`). It went well and was not rushed, so I also built the three extras: `equivalent-fractions`, `fdp-equivalents` and `whole-from-fraction`, and `ten-and`. Nothing was left out. The ladder order is exactly section 12.
- **61 new question types** (one mastery record each, same pack `generated`, same table, same Leitner rules as F.5) and **nine "ten and" facts** (`tenand:1` to `tenand:9`, one record per fact like the other early facts, in the `early-facts` pack). Types: `fracof:half/third/quarter/fifth/tenth/big`, `fracof:non:thirds/quarters/fifths/sixths/eighths/tenths`, `equiv:missing-top/missing-bottom/same-as/simplify/simplify-blank`, `whole:half/unit/thirds/quarters/other`, `pct:half/ten/quarter/to-fraction/from-fraction/to-decimal`, `pct:one/twenty/three-quarters/big`, `pct:whole:ten/fifty/quarter`, `tenth:to-fraction/to-decimal/divide/count/half`, `addten:add/carry/take/borrow/whole/to-one`, `deceq:common/pick/hundredths/to-fraction/compare`, `timesdec:ten/hundred/div-ten/div-hundred/missing`, `fdp:frac-to-pct/pct-to-frac/dec-to-pct/pct-to-dec/match`. Each skill has 5 to 7 types. Files: `shared/maths/skillPacks/fractionSkills.ts`, `percentSkills.ts`, `decimalSkills.ts`, `fdpSkills.ts`, and the helpers in `pickKit.ts`.
- **Fractions stay under one.** No 7/4 and no mixed numbers, as a question or a choice (the picker drops any such choice and a test checks every choice of every question).
- **Fraction answers are four choices to tap with text labels; number answers are typed.** Pick-one questions (a percentage as a fraction, a decimal as a fraction, tenths as a decimal, equivalent and simplified fractions, which decimal matches a fraction, which percentage matches a decimal, and "which is bigger, 0.25 or 0.3?", which has two choices) are always choices, whatever the class's multiple-choice switch says. Typed answers (⅓ of 15, 25% of 80, 1.3 + 0.2, 34 ÷ 10) follow the switch exactly as before, and the point key shows on every question whose answer or choices can be a decimal (and on nothing else new).
- **Wrong choices are named mistakes, never random numbers.** Every question lists the mistake behind each wrong choice ("added the same to the top and bottom", "put it in the hundredths place", "thought the longer decimal is bigger", "found 25% instead", "forgot the point"); a question with too few usable mistakes is never asked, and the choices are always different from the right answer and from each other (in value too, except the one case where "stopped before the simplest" is the same fraction on purpose).
- **Screen reader text.** Fractions, percentages and decimals are read in words: "3 quarters", "25 percent", "0 point 2 5", "what percent". Every choice button has its spoken name. After a tap the blank shows the choice itself (not its number) and a wrong tap shows the whole fact ("0.3 = 3/10").

### Answers that carry their numbers (the design)
- **The problem.** A pick-one question shows only its stem in `parts`; the choices, and which one is right, are not in it. The server could mark F.5's questions by reading the sum back from its parts, but not these.
- **What is sent.** Every saved answer carries `key` (the record the question counts towards) and `params` (the numbers it was made from, `Question.params`). Solo Mission Control answers (`SpaceMathsAnswer.params`) and the placement warm-up (`PlacementAnswer.key` and `.params`) send them; the browsers fill them in from the question they asked.
- **What the server checks** (`shared/maths/claim.ts`, `solveClaim`): the key is one a generated skill owns; its generator accepts exactly those numbers (they are numbers it could have rolled); and the question they make has **exactly** the parts that were shown. The right answer comes from the rebuilt question, never from the browser. If anything does not hold up, the parts are still read the old way (`solveParts`) and the answer is accepted only if the question reads back exactly as shown, so wrong numbers can never get a made-up question through. The F.5 checks are not weakened: F.5 skills now go through the numbers first, and the old reading of the parts still backs them up.
- **Size limits.** `params` is 1 to 12 numbers, each finite and at most a billion; `key` at most 51 characters in the record-key shape; `parts` 1 to 12 parts of at most 40 characters (the old rule that a question needs at least 4 parts would have refused every pick; I changed it, see the problems below). Answers, as before, up to a billion.
- **Old browsers** (a page loaded before F.6 goes live) send only the parts: those are marked as before, which covers every skill that existed before F.6. They cannot ask F.6 questions anyway (their ladder still lists them as not built, so auto and focus skip them).
- **The classmate (server) game** needed no change: the server keeps the whole question it asked, with the choices and labels, and compares the tapped number with the one it kept. The test asks and marks all 12 new skills there. Gem Keep marks in the browser, as before, and the server only checks the keys and packs.
- **Solver tests:** `solveClaim` agrees with every question every generator can make (300 rolls for each of the 61 types), and the old "solver agrees with everything auto and focus can ask" tests now go through it.

### Decisions I made (change any you don't like)
- **No new pack, no migration.** The new types join the `generated` pack, so the database needed nothing: the key check F.3 widened already accepts every key (`tenand:4` too), and `my_gem_keep` and `space_maths_context` already hand out the `generated` and `early-facts` records. The pack's teacher label is now "Place value, rounding, order of operations, fractions, decimals and percentages".
- **Quick time is 8 seconds for all of them** (`QUICK_MS_BY_PACK`, the whole `generated` pack), and 5 for the ten-and facts. Picking a percentage out of four choices is probably about as quick as rounding; I have no real timings. Say if you want a different time for a skill.
- **75% sits beside 25%** in the basic conversions (50% = ½, 10% = 1/10, 25% = ¼, 75% = ¾), although section 12 puts 75% a year later. `percent-of` has 1%, 20%, 75%, bigger amounts, and the whole from 10%, 25% or 50%.
- **The placement walk jumps three skills, not two** (`PLACEMENT_JUMP` in `config.ts`). With 31 skills, ten questions at two skills each could not reach the top (from the first skill it ended on skill 19 of 31). It still steps back one after a wrong or slow answer and climbs one at a time after the first miss, and it is still 10 questions. A student who is right and quick throughout now starts within the last 6 skills, from any year. A Year 8 class starts so near the top that the warm-up mostly asks order of operations and finding the whole.
- **"Ten and" facts count as their own records** beside the adding facts (`add:4+10` and `tenand:4` are different records for the same sum); the browser says which it meant, as it already does for bonds. A sum like 10 + 4 = ? is marked as either.
- **Decimals are made from whole tenths or hundredths** so no question is ever made from a number with floating-point dust; wrong choices smaller than a hundredth are never offered.
- **Fraction labels and "which is bigger".** The bigger-decimal question has two choices (the wrong one is the trap: the longer decimal that is really smaller, or the shorter one that ignores the last digit); it is the only question with fewer than four.
- **Not in this stage:** exponents, mixed numbers, improper fractions, fractions that add or take away (the Maths Monsters fractions pack has them; the ladder does not ask for them yet).

### Problems I found on the way (all fixed)
- **Solo Mission Control would have refused every pick-one question.** The server insisted a question have at least four parts; "3/10 = ?" has three and "Which is bigger?" has one. It now takes one or more.
- **The warm-up and the question box printed the number of the choice** (a pick's answer is the choice's position) in "0.3 = ?"; they now print the choice.
- **Tests that assumed some skills were not built** (a stub in the path, a ten-and gap in the path card) were updated, not weakened.

### Tests
- **Database (scratch copy):** new `maths_fdp.test.sql` (14 checks): all 61 new keys and the nine ten-and keys accepted, a percent sign, a capital, a point and a long first word refused, the Leitner rules with the 8-second time, students cannot add records, Gem Keep and Mission Control are handed them. All 33 files pass in a scratch copy except the same two Clan Quest checks about scheduled midnight jobs as in F.4 and F.5 (a scratch copy has no scheduler).
- **Rehearsal on today's data** (`scripts/f6-rehearsal.sh`, 41 checks): the live database as it will be once F.5 is live (classes, a group, running focuses, a student's own pick, changed settings, records of several packs, auto on for one class, a placement and a skip). Every record, setting, focus, place, placement and teacher list is exactly as it was; the server records answers for all 61 new types and the nine ten-and facts; Gem Keep, the home page and Mission Control are handed them (never Maths Monsters' records); bad keys still refused; no function got new access.
- **Shared maths** (`fdp.test.ts`, 253 tests): for every type, 300 rolls each: a sound question; the answer worked out by separate arithmetic from what is on screen (not by the generator); rebuilt from its numbers (same parts, same choices in the same order); four distinct choices (two for "which is bigger") with one right; every wrong choice a named mistake and the right one not; no choice worth the same as the right one; every fraction choice under one; the point key exactly when a decimal can appear; spoken text with no raw fractions or percent signs; the same seed gives the same questions and another seed different ones; numbers it would never roll are refused; `solveClaim` accepts the real question and refuses a changed sum, another key, silly numbers and a made-up question. Also: the ladder (all built, order unchanged, every key in exactly one skill), the ten-and facts, the placement walk over the longer ladder, and that old (parts-only) browsers are still marked for every earlier skill.
- **Servers and screens:** solo save with all 12 new skills (right, wrong, a pick moved by one, the numbers removed, wrong numbers, silly numbers); the classmate game for each new skill, right and wrong; Gem Keep's save keeps the keys in the right pack; the question box (fractions drawn as fractions, percent and decimal labels read in words, the blank shows the choice, typed percentages, the point key, the class's multiple-choice switch); Gem Keep's Level Key and Mission Control's solo game playing the new skills in the screens (slow suite); the warm-up with picks.
- **Real browser** (Chromium, the real site against a scratch database, signed in with real tokens, 391 checks): a Year 5 student's warm-up walked through eight runs of ten questions (decimal and fraction picks, tenths, rounding, factors, times with tens, whole-from-fraction, typed decimals), each with its numbers attached, its choices read out in words, no number pad on picks, the point key exactly where needed, a wrong answer showing the whole fact; a Year 8 student's warm-up (six runs, order of operations and finding the whole); the path says "0 of 31" with all 31 rows and the new skills in plain words; the teacher's Set focus offers 31 and sets a focus on all the new skills; a student sees "Your teacher picked …". On top of that, **every one of the 61 new types was put on screen, typed and as choices, at 1366 x 640 and 844 x 390: axe clean and nothing runs off the side** (a test page, not kept). The only axe note anywhere is the top bar's contrast at 844 x 390, as since before F.2.
- **App:** type check clean; production build works; `npm run build:functions` run. Whole suite including `TESTS=all`: 148 files, 3,237 tests pass, 1 skipped on purpose.

### What is untested
Real Google sign-in; the live Supabase project; the three functions running in Deno (their code is covered by handler tests, the shared tests and the build, and the database calls by the rehearsal); how long real students take on these questions (8 seconds is my guess); Mission Control with classmates and a pick in a real browser (handler tests only); a phone; whether the named mistakes are the mistakes your students really make (they come from the plan's list and common ones I know of; the Eedi mistakes data has no licence, so I did not use it).

### Functions that changed
`gem-keep`, `save-bot-game` and `space-game` (the answer check, the wider parts rule and the new skills). `monster` and `lord` were rebuilt too, but only because they share `banded.ts`, which gained a spoken-text helper they never call: no change in what they do, **no need to redeploy them**. No other function changed.

### Go-live list (when you say "go live")
F.6 has no migration, but it needs F.5 live first (F.5's functions and F.6's are the same three, so one deploy does both).
1. Apply **`20261019000300_maths_generated.sql`** (F.5's one migration; nothing by hand). F.6 adds no migration. Check `20261019000200_maths_auto.sql` is already applied (F.4 is live).
2. Deploy **`gem-keep`, `space-game` and `save-bot-game`** straight after the migration and before the website goes out. Nothing else.
3. Merge `maths-focus` to `main`; wait for Pages.
4. Afterwards: with a class's auto on, a student's path says "N of 31"; as a teacher set a focus on, say, Fractions as decimals and Percentages of an amount for a test student, and check Gem Keep's Level Key and Mission Control ask it (fractions to tap, the point key on decimals).
Until a class has auto on, or a focus names a new skill, every student plays exactly as before; Chess, checkers and 101 stay maths-free.

### What F.7 (teacher skill map and focus history) needs from you
- **The skill map's columns.** 31 skills is wide for one table. Do you want all 31 as columns (scrolling sideways), the six stages as columns that open into their skills, or the skills grouped as the student's path groups them?
- **What a cell shows for a skill made of question types** (all the generated skills): one colour from how many of its types are secure (the same 70% rule), or the types listed on tapping? I suggest the colour, with the types in a list underneath when a teacher taps.
- **Focus history:** how long to keep ended focuses on screen (this term only, or all), and whether the teacher should see how each student did on a focus (right and quick answers on its skills while it ran) or only that it ran.
- **A button to reset a student's placement** (a skip is final today).

## Stage F.7 results: the teacher skill map and focus history (19 October 2026)

**Status: built and tested on a scratch copy of the database and in a real browser. Nothing is live.** No migration was applied to the live database, no function was deployed, nothing was merged to `main`. Work is on branch `maths-focus`. **One part of what you asked for is not built and needs your answer: how students did *while* a focus ran (see "Needs your decision").**

### Before I started
`main` had not moved. F.5 and F.6 are still not live, so F.7 is built on top of them and they go first. The normal suite passed before I changed anything (141 files, 3,147 tests, 1 skipped on purpose, none failing). I had no answers in the prompt's "My answers" box, so I used the recommended defaults.

### What I built
- **Skill map** (`/skills`, "Skill map" link on the Teacher page and on My classes). One row per student in the class (class picker as on Set focus), a column for each of the six stages, a cell coloured from not started to fluent **and lettered** (L, S, F; blank for not started; a hatched "switched off") so colour is never the only clue. A stage button opens it into its skills (all six can open at once); a skill cell opens the facts or question types behind it, with how well, % right, how many asked and average time. Times-table cells open the existing 12 × 12 grid, with the division facts listed beside it. A closed stage shows "3 of 5" skills secure. A column foot counts how many students are secure. Each row says **Now** (current skill), **Furthest**, and **Warm-up** (done / skipped / not done), with no years anywhere. It is a real table with row and column headers, every button is a native button (Enter and Space work), opening a cell moves focus to its heading, and the scrolling box is keyboard-focusable.
- **One shared rule.** Colours come from `shared/maths/skillMap.ts`, which reads each skill's share from `placeProgress`/`ladderProgress`: **secure = the same 70% as auto; fluent = 70% of the skill's facts or types in the top box.** A test checks the map against `ladderProgress` for every skill, with tables and division switched off, with a placement or year level, and for a student with no records. Switched-off tables show as "switched off" and are not counted.
- **Focus history** (replaces "What we practised" on Set focus): every ended focus, **this term by default** with a "Show every earlier focus" tick; each shows who it was for, the skills, the dates, **who set it**, and a fold-out "Where they are now on these skills" (see below). Nothing is deleted. Term dates are in `shared/maths/terms.ts`.
- **Placement reset** on the student card (teacher page, students only): says where the warm-up started them and their furthest place, and "Offer the warm-up again" with a plain confirmation. It clears the placement or skip; the **furthest place is a separate table and is never touched**, so the games never ask anything easier than where they have been. The student sees the warm-up offer again (checked in the browser).
- **Links to Set focus:** a "Set focus" link on every row (that student) and every open skill column (that skill, whole class), and a button in a cell's detail (that student and skill). Set focus opens with them ticked (an unknown student or skill in the link is ignored).
- **Database** (one migration, `20261019000400_maths_teacher_views.sql`, four functions, no table or data change): `teacher_class_skill_map(class)` (the records of one class's students, the ladder facts only, never Maths Monsters' own), `teacher_student_ladder(student)`, `teacher_reset_placement(student)`, `teacher_maths_focus_history(class, since)`. Each checks the asker teaches the class or the student; a school admin can read any class in the school; students, other teachers, other schools and signed-out visitors are refused.

### Decisions I made (change any you don't like)
- **The map uses the ladder place only when the class has auto on.** With auto off, nothing is kept or followed, so "Now" is just the first skill that is not secure and the furthest place is hidden. The page says "Auto is off for this class" and links to the switch.
- **"Furthest" is shown whenever there is one**, even if it is the same as "Now".
- **A skill behind a student's starting point** shows its real colour (usually "not started") and is marked passed-over in the detail, so the colour only tells what their records show.
- **"This term"** uses the Ministry term start dates for 2026 that I know (2 Feb, 20 Apr, 20 Jul, 12 Oct). **I could not check them against a calendar: please confirm.** Outside the list (or more than 130 days after the last listed start) it falls back to the last 10 weeks, so the history never goes blank because the list is out of date. 2027 dates need adding.
- **Real names:** the map shows the part of the school email before the @ under a student's name, as the other teacher pages already do.
- **History "set by"** shows the setter's player name, or their school name if there is none.
- **Two bugs found on the way, both mine, both fixed:** my first history panel re-asked the database on every render (the existing "looks again by itself" Set focus test caught it); the hidden screen-reader text inside the table made the whole page scroll sideways (found in the browser).

### Needs your decision: how students did while a focus ran
- **What the database keeps:** for each student and fact or question type, one record: totals (asked, right), average time, box, **when last seen**, and the last 5 days it was answered quickly and right. It does **not** keep each answer. So after a focus has ended, "answers on its skills between its start and end, and how many were right and quick" **cannot be worked out**; `last_seen` and the quick days are overwritten as the student goes on playing, so any figure I made from them would quietly be wrong.
- **What I built instead:** "Where they are now on these skills" (their level on each skill of the focus today, from their records), and a plain note on the page saying results during a focus cannot be shown yet.
- **Smallest table that would do it (not built):** `maths_focus_results (focus_id, student_id, answers, correct, quick)`, one row per student per focus, three counters. The three answer-saving functions (`gem-keep`, `space-game`, `save-bot-game`) already work out which skill an answer belongs to; after saving, each would add the batch to the row of each *running* focus whose skills include the answer's key (a small database function, closed to the website). It would only count from the day it goes live (no backfill), needs a migration and a redeploy of those three functions, and touches the answer-saving path, so it needs its own tests. **Shall I build it?**

### Tests
- **Database (scratch copy):** new `maths_teacher_views.test.sql` (57 checks): a teacher reads only their own class (not another class's students or records, not Maths Monsters' records), another teacher, a teacher at another school, a student and a signed-out visitor are refused for all four functions; the reset works only for the student's own teacher, clears a placement or a skip, never touches the furthest place, and a new warm-up can be stored afterwards; history lists only ended focuses with who set them, the "since" filter works, and every focus is still in the table. `security.test.sql` updated (four new callable functions); it passes.
- **Rehearsal on today's data** (`scripts/f7-rehearsal.sh`, 41 checks): the live database as it will be once F.5 and F.6 are live (classes, a group, running and an ended focus, own pick, changed settings, records of several packs, auto on for one class, a placement and a skip), then the F.7 migration: every row, setting, focus, place, placement, teacher list and student focus is exactly as it was, row counts in every maths table are unchanged, the map, history and reset work on it, and the only new functions a signed-in person can call are exactly the four.
- **Shared maths** (`skillMap.test.ts`, `terms.test.ts`): stages and order, no years, levels at exactly 70%, agreement with `ladderProgress` in every case above, class counts, term dates.
- **Screens:** skill map (20 tests: teachers only, table headers, colours with letters and words, where a student is, opening stages from the keyboard, opening all, the facts behind a cell, the 12 × 12 grid, switched-off tables, links, class picker, empty and error states, nothing in browser storage), focus history (8), placement reset (8), data layer (9), Set focus (history, presets), the Teacher page (link and the reset on a student card).
- **Real browser** (Chromium against a scratch database, signed in with real tokens, 87 checks): the map for Room 12 and Room 14 (switched-off tables read "off"), opening a stage by keyboard, the grid and types detail, links, another teacher shown only their own class and refused by the database for the other, a student told "Teachers only" and seeing nothing new, the history with who set it and where students are now, Set focus opened with a student and skill ticked, and the reset end to end (confirm, placement gone, furthest kept, the student offered the warm-up again). **axe clean at 1366 × 640 and 844 × 390** on the map (closed, a stage open, every stage open, both kinds of detail, a class with tables off), Set focus (history, presets) and the warm-up reset. Only the top bar's contrast fails at 844 × 390, as since before F.2. The Teacher page also shows two axe findings (a blank row header in the per-student games table and a repeated "Clan Quest" landmark name); **I checked they are identical on `main` before F.7** and did not touch them. The top bar runs wider than an 844-wide screen on every page, as before.
- **App:** type check clean; production build works; `npm run build:functions` run: **no function changed** (the only shared-code change is exporting one helper). Whole suite including `TESTS=all`: 154 files, 3,310 tests pass, 1 skipped on purpose, none failing.

### What is untested
Real Google sign-in; the live Supabase project; a class of 30 students with a year of real records (the map sends every student's ladder records in one call, about 1 MB for 30 students with 250 records each; fine, but not measured); the map on a phone; the 2026 term dates (above); whether teachers find 31 skills readable once every stage is open.

### Go-live list (when you say "go live")
1. F.5 and F.6 first (see their go-live lists): apply `20261019000300_maths_generated.sql`, deploy `gem-keep`, `space-game` and `save-bot-game`.
2. Apply **`20261019000400_maths_teacher_views.sql`** (one migration, four new functions, no table or data change; nothing by hand).
3. **No function to deploy for F.7.**
4. Merge `maths-focus` to `main`; wait for Pages.
5. Afterwards: as a teacher open Skill map, open a stage and a cell; on a student card try "Offer the warm-up again" on a test student.
Students see nothing new, and with no class on auto and no focus set every student plays exactly as before. Chess, checkers and 101 stay maths-free.

### What F.8 (opening to another school) needs from you
Whether another school is actually ready (the checklist is in section 7): Google sign-in set to External, which school and its email domain, who signs it off for privacy, and whether the numbers need a paid Supabase plan. Also your answer on per-focus results above, since a second school's teachers will want it.


## Stage F.8 results, part A: how students did while a focus ran (19 October 2026)

**Status: built and tested on a scratch copy of the database and in a real browser. Nothing is live.** No migration was applied to the live database, no function was deployed, nothing was merged to `main`. Work is on branch `maths-focus` (pushed). **Part B (opening to another school) was not started, as you asked.**

### Before I started
`main` had not moved. F.5, F.6 and F.7 are still not live, so this is built on top of them and they go first. The normal suite passed before I changed anything (147 files, 3,220 tests, 1 skipped on purpose, none failing).

### What I built
- **Table `maths_focus_results`** (migration `20261019000500_maths_focus_results.sql`): one row per student per **"Set focus" press** (batch), with three counters: answers, right, quick. Closed to the website. **Why per press and not per focus row:** one press makes one row for each group or student it names, and a student can be in two groups of the same press. Keyed by the press, that student is counted once. Keyed by row, they would be counted twice and the page would add them up wrongly.
- **`add_maths_focus_results(player, answers)`**: server-only. For each answer it finds the focuses running for that student **at the answer's own time** (between the start and the earlier of the end time and "End now"), in the student's class, for the class, their group or them, whose skills include one of the answer's skills. Late batches still count by each answer's own time. Malformed or unknown input adds nothing.
- **Which skill owns a key, and "quick", are worked out in the server code** (`shared/maths/focusResults.ts`: `skillsOfKey`, quick = right and within `quickMsForPack`), not in SQL.
- **Hooked into `gem-keep`, `space-game` and `save-bot-game`** (`supabase/functions/_shared/focusResults.ts`), right after the answers are saved, and **only when the records report they took the batch for the first time** (`record_fact_answers` returns 0 for a batch it has seen). A retry therefore never counts twice. The hook never throws: if it fails, the answers are already saved, and the problem is logged (the error code, never who).
- **`teacher_maths_focus_results(batch)`**: for a class you teach (school admins can read any class in their school). Lists every student the focus is for, with 0 for those who did none (not hidden), a class total, and the day counting began.
- **Screens:** a fold-out **"How they did"** on each ended focus in the history, and **"How they are doing so far"** on each running focus. Students with no answers show **"none"**. A focus that ended before counting began says so instead of showing zeros; one that started before says "counted from <day>". "Where they are now" stays beside it.
- **Terms removed, as you asked:** the history now shows **the last 10 weeks** (with the "show every earlier focus" tick). `shared/maths/terms.ts` and its test are deleted (nothing else used them).
- **Privacy:** `docs/PRIVACY-SUMMARY.md` has a plain-words line for the new totals.

### Decisions I made
- **Overlapping focuses: all of them count.** An answer on a skill that two running focuses name counts for both, because it really was practice for both. Within one press it counts once. A student's answer never counts for a focus whose skills it doesn't touch, so a group's results can't be inflated by the class focus.
- **"Quick" counts only right answers** (the same rule as the records).
- **A student who has left the class** stays in that focus's list if they answered something during it.
- **The class a focus belongs to is the student's class at the time the answer is saved**, the same rule as `maths_focus_of`.

### Tests
- **Database (scratch copy):** `maths_focus_results.test.sql`, 47 checks: counts only inside the window (before the start, after the end, after "End now", a focus that starts tomorrow), only the right student, only the skills named, overlapping focuses, an answer owned by two skills of one focus counted once, a student with no class, bad input, closed to students, teachers, signed-out visitors and the website, teacher-only read with other-class, other-school, student and signed-out refusals. `security.test.sql` updated (one new callable function); passes.
- **Shared/server:** `focusResults.test.ts` (key to skill for every key of every skill, quick per pack, order kept) and `_shared/focusResults.test.ts` (sends the right call, costs nothing with no ladder answers, **a failing or crashing call is logged and does not throw**).
- **Screens:** `FocusResults.test.tsx` (9), plus the history, Set focus (running and ended) and data-layer tests.
- **Rehearsal on today's data** (`scripts/f8-rehearsal.sh`, 31 checks): every record, setting, focus, list and student's data is exactly as it was after the migration; nothing is counted backwards; playing the servers' part, results fill in, a retry counts once, a student whose class has no focus costs nothing, the record counts are unaffected, and the only new function a signed-in person can call is the teacher one.
- **Real browser** (Chromium against a scratch database, signed in with real tokens, 18 checks): the running results table (2 students, one "none", total adds up), the history fold-out for a focus that ended before counting, another teacher and a student refused with 403, no failed requests. **axe clean at 1366 x 640 and 844 x 390** on Set focus with both fold-outs open (only the top bar's contrast, as since before F.2).

### What is untested
The three functions running in Deno with the real database (the hook in `entry.ts` is covered by the helper's tests, the build and the rehearsal's copy of the same steps, not by a handler test, since `entry.ts` is the part that only runs on Supabase); a real class playing for a week; how many answers one batch can carry before the counting call is slow (a Mission Control game sends one at a time; Gem Keep and the bot-game save send a game's worth).
**Not counted:** Dragon Maths (`lord`), Clan Quest (`clans`) and Maths Monsters (`monster`) also record into the same records, but you asked for the three functions above, so answers there are not counted for a focus.

### Go-live list (when you say "go live")
1. F.5, F.6 and F.7 first (see their lists): migrations `20261019000300` and `20261019000400`, then the F.5 deploys.
2. Apply **`20261019000500_maths_focus_results.sql`** (two new tables, two new functions; nothing existing changes). Counting starts from the moment it is applied.
3. **Deploy `gem-keep`, `space-game` and `save-bot-game` straight after** (they now count answers). Answers saved between steps 2 and 3 are not counted. Deploying them before step 2 is safe: the counting call would fail, be logged, and the answers still save.
4. Merge `maths-focus` to `main`; wait for Pages.
5. Afterwards: set a short focus for a test class, play a few questions on its skills as a test student, open "How they are doing so far".
Students see nothing new, and with no class on auto and no focus set every student plays exactly as before. Chess, checkers and 101 stay maths-free.

## F.5 to F.8 went live (19 October 2026)

James said go for F.5, F.6, F.7 and F.8 Part A together. Done in this order, nothing failed:

1. **Checks first:** `main` had not moved (no new migrations). Typecheck, the quick tests (149 files, 3241 passed, 1 skipped) and `npm run build:functions` (no diff) were all clean. The live database was checked by what exists in it, because migrations go on with `db query` and are not in the CLI's history: 000100 and 000200 were in; 000300, 000400 and 000500 were not.
2. **Database, one at a time, each checked after:** `20261019000300_maths_generated.sql` (F.5; `my_gem_keep` and `space_maths_context` now list the "generated" pack), `20261019000400_maths_teacher_views.sql` (F.7; four teacher functions), `20261019000500_maths_focus_results.sql` (F.8 Part A; two tables, two functions; the "counting starts" table has its one row and no results yet). F.6 has no migration.
3. **Functions:** `gem-keep` (now v5), `space-game` (v6) and `save-bot-game` (v13) deployed straight after, and nothing else. Answers saved between steps 2 and 3 are not counted for focus results.
4. **Website:** `maths-focus` pushed to `main` as a straight fast-forward (30bbe5d..574aad1); Pages built and deployed. Local `main` in the main checkout was not touched.
5. **Checks from outside:** the site answers 200; the seven functions tested answer 401 signed out; the two new tables and the teacher results function refuse a signed-out visitor (42501).

Not checked by me: a real browser sign-in, the teacher screens, or a student playing with a focus. To see it: as a teacher open Skill map and Set focus (the "How they did" and "How they are doing so far" fold-outs), set a short focus on a test class, play a few of its questions as a test student, and watch the count go up. F.8 Part B (second school) is not built.

## Decimal and fraction bonds (Bond Match M.5 part A, 20 Oct 2026)

**Built and tested on branch `maths-bonds`. Nothing live.** James picked "two new skills" over tucking the bonds into existing ones, so teachers can pick them on Set focus and Bond Match can open on them. (Bond Match is never evidence for these skills: only the other games' real questions count. See docs/BOND-MATCH-PLAN.md section 7.)

- **Fractions that make 1 (⅜ + ⅝)** (`fraction-bonds`, after A fraction of an amount; tags MS.Y3.NUM.RN.P6, MS.Y3.NUM.RN.K6): `bondf1:whole` (1 = ?/8, typed), `bondf1:missing-top` (3/8 + ?/8 = 1, typed), `bondf1:small` (thirds, quarters, fifths: 1/4 + ? = 1, four choices), `bondf1:big` (sixths, eighths, tenths), `bondf1:take` (1 − 3/8 = ?, four choices).
- **Decimals that make 1 and 10 (0.35 + 0.65)** (`decimal-bonds`, after Fractions as decimals, once hundredths are known; tags MS.Y4.NUM.RN.P10, MS.Y5.NUM.RN.P12): `bondd1:next-whole` (6.3 + ? = 7), `bondd1:hundredths` (0.35 + ? = 1), `bondd1:take` (1 − 0.35), `bondd10:tenths` (3.4 + ? = 10), `bondd10:take` (10 − 3.4). All typed with the point key.
- Code: `shared/maths/skillPacks/bondSkills.ts`, in the `generated` pack (same table, same quick time). Wrong choices are named mistakes ("made each digit up to 10": 0.35 → 0.75; "gave the same fraction"; "thought a whole is 10 parts"); decimals are made from whole hundredths or tenths; no fraction choice is over one or exactly one whole. Questions carry their numbers, so the server marks them by rebuilding (like F.6).
- **The ladder is now 33 skills.** Students keep their stored place (it's a skill name, not a number). A student already past a new skill has it behind them ("passed over", not secure until other games' answers make it so), so nobody is sent back. Progress percentages drop a little, because there are two more skills to be secure in. A warm-up that is right and quick throughout now starts within the last 7 skills, not 6 (one skill lower in real terms); the jump stays 3.
- **No migration:** the keys fit the record-key check, and the pack list is unchanged.
- **Tests:** the F.6 tests (`fdp.test.ts`) now include both skills (every roll checked against separate arithmetic, named mistakes, rebuilt and marked from its numbers, refused when changed), and the ladder and placement counts. Full run: typecheck, `test:all` (3,901) and build pass.
- **Go-live:** `docs/prompts/maths-bonds-golive.md`. Redeploy `gem-keep`, `space-game`, `save-bot-game` and `marble` (their bundled copies changed), then merge to `main`. `clans` and `lord` did not change. `monster` was not rebuilt (it is left as deployed; the `monsters-marking` branch rebuilds it).
