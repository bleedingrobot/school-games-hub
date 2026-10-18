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
`main` was merged into `maths-focus` first. It brought in two new migrations from Dragon Maths, `20261018001600_dragon_maths.sql` and `20261018001700_dragon_maths_l5.sql` (Maths Monsters' `20261018001500` was already known), so F.2's three are numbered after them: `001800`, `001900`, `002000`. Before any change, every database test file passed in a scratch copy (the shared local copy is at `001500`). In the app tests one test failed before I started: `supabase/functions/lord/handler.test.ts` "the deployable file is up to date" (the Dragon Maths function file was already out of date on `main`; rebuilding it fixed it).

### What I built
- **Schools** (`20261018001800_schools.sql`): `schools` (name, active, board-approved date, contact teacher), `school_domains`, `profiles.school_id` (Douglas Park is school 1 with `douglaspark.school.nz`; every profile is moved into it; a player's school can never change, even by a later function: a trigger refuses). The site owner has `site_owners` and `owner_add_school`, `owner_add_school_domain`, `owner_set_school_active`, `owner_set_school_contact`, `owner_schools` (counts only, no names).
- **Sign-in:** the three locks stay. "Is it a Douglas Park email?" is now "is the email's domain on an active school's list?" (`school_for_email()`, `is_school_email()`). The sign-up hook and the database backstop use it, and the new profile gets the school. **Replaced cleanly:** the database function `school_domain()` is dropped; `SCHOOL_DOMAIN` in `src/config.ts` is deleted and the website no longer sends Google an `hd` hint (it named one school; the server list does the refusing). README's "How sign-in stays school-only" is updated.
- **Roles:** student; teacher (their own classes); **school admin** (`profiles.school_admin`, always also a teacher, so every existing "is this a teacher?" check still works); **site owner**. `make_first_teacher` works as before. New by-hand functions: `make_school_admin(email)` and `make_site_owner(email)`. A school admin can also make another admin (`school_set_admin`).
- **Classes** (`20261018001900_classes_and_warp.sql`): `classes`, `class_teachers`, `class_members` (one row per student, so moving just changes the row), `class_groups`, `class_group_members`, plus `warp_requests`, `warp_tries`, `class_events`. All closed to the website; reached only through functions.
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
- **Database (scratch copy):** all 22 test files pass. New: `schools.test.sql` (84: sign-in domains, a second school once added, switched-off school, roles, site owner, school 2 cannot read school 1's students, records, boards, lobbies, games, news, settings and the other way, new season per school), `classes.test.sql` (96: Everyone, teacher sees only own classes, admin sees all, moving keeps records, no-class student plays and gets defaults, per-class settings, archive keeps data, groups), `warp.test.sql` (85: class and group codes, changing class, off, reset, archived, ask first, wrong codes, rate limit, other school). Existing files were updated: teachers in them are now school admins, and a few checks read `app_settings` through the new shape; `security.test.sql` has the new function list.
- **Copy of today's data:** `scripts/f2-rehearsal.sh` puts fake Douglas Park rows in at the pre-F.2 state (5 students, one hidden, 2 teachers, changed settings, games, records, Daily News), applies the three migrations, and checks 27 things: every profile in school 1, all in "Everyone", settings identical, a teacher's list identical, no row lost, everything callable before still callable. **27 of 27 pass.**
- **App:** new tests for the four game servers (another school's game is "not found"), `ClassWarp`, `ClassWarpCard`, `MyClasses` and the code alphabet. Type check clean. Whole app suite: 1,727 of 1,729 pass; the two that fail (Gem Keep `levels.test.ts`, 101 `save.test.ts`) are the known load-timing ones and pass when re-run alone (`levels.test.ts` needs a longer timeout while other things are running). The production build works. `npm run build:functions` was run (all eight files rebuilt; seven differ from `main`).
- **Real browser** (Chromium against a scratch database, signed in as real tokens): a school admin makes Room 12 and sees its code; a student with no class sees the join band and the Class Warp button, types a wrong code ("That code didn't work."), then the right one, confirms, sees the animation and "Welcome to Room 12!"; the teacher sees the warp in the live list, makes Room 14 and moves the student (records kept, one class); an ask-first code holds a student until the teacher says yes; a reset code kills the old one; the admin archives a class (it leaves the list, members kept); home page, Gem Keep, leaderboard, profile and lobby open with no failed requests for a student in a class and one with none; a plain teacher sees none of the admin's classes and no new-season panel. **axe clean** at 1366 x 640 on every new and changed screen. At 844 x 390 axe is clean on Class Warp and the home page; on My classes and the Teacher page it reports contrast on the top bar's "Teacher" link and on an old Mission Control option. **Both were already like that before F.2:** at that width the top bar is wider than the screen (also for students), which pushes things off the edge. I did not change the top bar.

### What is untested
Real Google sign-in with a second school's account (needs F.8's checklist); the live Supabase project (nothing applied there); the edge functions running in Deno (their code is covered by the handler tests and the build); the scheduled tidy job `tidy-class-warp` (the scratch copy has a stand-in scheduler); what teachers think of the My classes page with real use; the top bar at tablet width (above).

### Go-live list (when you say "go live")
1. In Supabase, apply the migrations **in this order**, after Maths Monsters' `20261018001500` and Dragon Maths' `20261018001600` and `20261018001700` are in: `20261018001800_schools.sql`, `20261018001900_classes_and_warp.sql`, `20261018002000_school_and_class_checks.sql`.
2. Deploy the **seven** functions whose rebuilt file differs from `main`: `multiplayer`, `space-game`, `card-game`, `power-clash` (they now read each player's school and class), `monster`, `lord` (settings and news per player) and `save-bot-game`. `gem-keep`'s file is unchanged. Deploy them **right after** the migrations: the old functions read `app_settings` as one row and would fail for a moment. (The `lord` and `monster` files also carry F.1's shared-code changes and the Maths Monsters regeneration that `main` noted as not redeployed.)
3. By hand, in the SQL editor, once you have signed in: `select public.make_school_admin('<your douglaspark address>');` and `select public.make_site_owner('<your douglaspark address>');`. Until then nobody can make teachers, archive classes or start a new season.
4. Merge `maths-focus` to `main` and let GitHub Pages rebuild the site.
5. Afterwards: sign in as a teacher and as a student and check the Teacher page and a game; open My classes.
6. Nothing else by hand. (Later, when you want real classes: make them, give out the codes, then `select public.school_set_default_class(null)` as the admin, or via the My classes page once F.3 adds a button.)

### What F.3 needs from you
See the message that came with this stage.

### James's answers after F.2 (18 October 2026)
- **Go live:** not yet. F.3 is built on the scratch copy first.
- **"Everyone" class:** turn the automatic joining **off at go-live** (add `select public.school_set_default_class(null);` as the school admin to the go-live list, after step 3). New students then start with no class and warp into their room.
- **Dragon Maths seasons:** stay per class, as built.
- **Teacher page switches:** F.3 adds a class picker, so a teacher with several classes can set each one.
