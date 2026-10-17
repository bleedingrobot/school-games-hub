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

## 6. Classes and groups

- **Tables:**
  - `classes`: school, name ("Room 12"), year, year level, archived.
  - `class_teachers`: a class can have several teachers (co-teaching, relievers).
  - `class_members`: **one current class per student**. Moving a student just changes their row.
  - `class_groups` and `class_group_members`: optional groups inside a class ("Kea", "Tūī").
- **Getting students in:**
  - **Join code:** the teacher shows a code made the same way as game codes (no vowels or lookalike characters), and students type it once.
  - **Teacher adds students:** the teacher ticks students from a list of their school's students who have no class. This is the backup for students who type the code wrong.
- **What teachers see:** only students in their own classes. A **school admin** sees every class in their school. All the `teacher_*` functions get this check.
- **Settings move per class.** The settings now in `app_settings` (space maths, reactions, Gem Keep tables, multiple choice, division) become per class. The school's row becomes the default a new class starts with.
- **End of year:** the school admin archives the year's classes. Mastery records belong to the student, not the class, so nothing is lost when they change rooms.
- **Leaderboards:** the privacy summary promises no classes on boards. A "my class" filter is allowed, but class names are never shown to students.

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

1. **F.1 Skill engine:** the skill ladder in config, generalised fact keys, and the first new fact skills (bonds to 10 and 20, doubles, halves). No database changes. Checked in the Gem Keep preview.
2. **F.2 Schools and classes:** `schools`, `school_domains`, `profiles.school_id` (Douglas Park as school 1), classes, class teachers, members, join codes, the school admin role, `my_school()` in every row rule, and settings moved per class. Tests for cross-school and cross-class reads.
3. **F.3 Maths focus and groups:** groups inside classes, focus rows with start and end times, `my_maths_focus()`, the student choice switch, the teacher's Set focus and Running focuses screens, the student note, and Gem Keep and the space game reading the focus.
4. **F.4 Auto everywhere:** the whole ladder, placement check, and starting points by year level.
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

- **Times-table order.** The NZC (Year 3: 2, 3, 4, 5, 8, 10) and the UK families both put **×8 with ×3 and ×4**, and ×6 with ×9. Today's `CAMPAIGN_STEPS` puts ×8 with ×6. Suggestion: change step 2 to ×3, ×4, ×8 and step 3 to ×6, ×9 (one line in config). Gem Keep players' records aren't affected.
- **Weighting.** In auto, review leans towards ×6, ×7, ×8, ×9 and ×12, as the Multiplication Tables Check does, because they're the hardest.
- **Wrong answers for multiple choice** come from known mistakes, for example adding tops and bottoms (½ + ¼ = 2/6), "longer decimals are bigger" (0.25 > 0.3), and working left to right without rules (2 + 3 × 4 = 20).
- **Credit.** If DfE, Oak or Illustrative Mathematics material is used directly, the How to play or About page credits it, as its licence asks.
