# Teacher view: review and redesign plan

Written 27 Oct 2026, from a read of every teacher-facing file on `main` (29755fd): `src/pages/Teacher.tsx`, every
`src/pages/Teacher<Game>.tsx`, `TeacherQuestionSkips.tsx`, `src/training/TeacherTrainingFirst.tsx`,
`src/teacher/TeacherClass.tsx`, `MyClasses.tsx`, `SetFocus.tsx`, `SkillMap.tsx`, the `GameDefinition` contract in
`src/games/types.ts`, and the SQL behind the class views. Nothing has been changed yet: this is the plan to agree first.

---

## 1. What the page is today

One long scroll. In order, for a teacher with every game on:

| # | Panel | Scope it *says* | Scope it *is* |
|---|---|---|---|
| – | Three long links: My classes, Maths focus, Skill map | – | Separate pages, each with its own class picker |
| – | "Switches below are for the class…" picker | class | class |
| 1 | Games against friends | class | class |
| 2 | Emoji reactions in space games | class | class |
| 3 | Mission Control maths | "school-wide" (code comment) | class |
| 4 | Training before games | class | class |
| 5 | Skipped questions: skip-button switch + 2 tables | class | class |
| 6 | Gem Keep settings | "For every student" | class |
| 7 | Gem Keep: the class (2 tables) | "the class" | **whole school** |
| 8 | Maths Monsters switch + topics | class | class |
| 9 | Maths Monsters: the class (3–4 tables) | "the class" | **whole school** |
| 10 | Dragon Maths switch, fights, season date, topics | class | class |
| 11 | Dragon Maths: the class (3–4 tables) | "the class" | **whole school** |
| 12 | Clan Quest switch + made-up names | class | class |
| 13 | Clan Quest maths (own Save button) + records | "for the whole school" | settings: class; records: **whole school** |
| 14 | Clan Quest villages + raids | – | raids: class; villages: **whole school** |
| 15 | Clan Quest fame season (type NEW SEASON) | – | the teacher's own classes (an admin: the whole school) |
| 16 | Marble Rush maths | class | class |
| 17 | Bond Match | class | class |
| 18 | Mine Runner on/off + maths | class | class |
| 19 | Archery on/off + classmate fights + week summary | class | class |
| 20 | Kingdom Keeper | class | class |
| 21 | Players (find, expand a row → ~8 more panels) | – | **whole school** |
| 22 | End of year: start a new season (admin) | school | school |

About **30 server calls** fire when the page opens, and **~8 more** each time a player row is opened.

## 2. What is wrong

### 2.1 Things that are actually misleading (fix whatever else we do)

1. **"The class" views show the whole school.** `teacher_gem_keep_class`, `teacher_monster_class`, `teacher_lord_class`,
   `teacher_clan_maths_class`, `teacher_villages` and `teacher_students` ignore the class picker; they read every pupil at
   `my_school()`. They sit directly under "Switches below are for the class Room 12", so a teacher reads school numbers as
   their class.
2. **Copy contradicts behaviour.** Gem Keep settings say "For every student"; Clan Quest maths says "These settings are for the
   whole school". Both save per class.
3. **Clan Quest fame season** sits in the middle of everyday switches, with the same NEW SEASON words as the real
   school-wide reset, and doesn't say whose fame it resets. (Corrected 28 Oct: the database is right. A plain teacher's
   reset only touches pupils in the classes they teach; only a school admin's covers the whole school. No admin check is
   needed, just honest copy and a better place.)
4. **Waiting Class Warp requests** (students who need a teacher's yes to join) only show on My classes, inside an expanded
   class. A teacher on the Teacher page has no idea someone is waiting.

### 2.2 Structure

- **Everything is equal weight.** "Pause games against friends" (needed in 3 seconds when a lesson goes wrong) looks exactly
  like "First day of Dragon Maths season 1" (set once a year). The page is ordered by when each feature was built, not by
  how often a teacher needs it.
- **Organised by game, not by job.** "What maths are my class getting?" is spread over Mission Control maths, Gem Keep tables,
  Monsters topics, Dragon topics, Clan maths, Marble, Mine, plus the separate Maths focus page. "How is Aroha doing?" is spread
  over the Players list (school-wide), the skip table, the Skill map page, and eight stacked game panels in her row.
- **Three class pickers** that don't talk: Teacher page (sessionStorage), Maths focus and Skill map (`?class=`). Pick Room 12
  on one, land on Room 9 on the next.
- **The most-used tools are links off the page.** Maths focus and Skill map are the core teaching tools; they appear as two of
  three long underlined sentences.
- **Destructive and routine actions are mixed.** Delete student, Make teacher, two NEW SEASON resets, reset hero, reset clan,
  delete village all live beside everyday toggles.

### 2.3 Controls

- **Six different idioms for "on/off":** state paragraph + one button (friends, reactions, Monsters, Bond Match, Dragon); bold
  inline label + button (Training, Mine, Archery, Kingdom, Clans names); radio list (space/Marble/Mine maths, skip button);
  auto-saving chips (Gem Keep, Monsters topics); chips with a separate **Save** button (Clan maths); per-field Save buttons
  (Dragon fights and date).
- **Red "danger" buttons for reversible switches.** "Pause games against friends" and "Switch reactions off" are styled the
  same as "Delete forever". Red should mean "can't undo".
- **The button names the action, not the state**, so the state has to be read from a sentence above it. A toggle shows state
  and action at once.
- **Long game descriptions repeat on every visit** (Archery's points rules, Kingdom's Hamurabi blurb, Mine's points). Useful
  once, noise after.
- **Integrity alerts are buried**: Monsters' "saves turned down" and Dragon's "requests turned down" are the bottom table of a
  school-wide panel.

### 2.4 Privacy note

The page shows real names, skip percentages and hardest facts on load. Teachers often have the Teacher page open on a
projected screen. Nothing sensitive should be visible on the landing view without a click, and a "hide real names" switch
would help.

## 3. What a teacher actually needs, by how often

**Every lesson (seconds, often under pressure, often on a projector):**
- Which class am I looking at.
- Anything waiting for me (warp requests; a student flagged).
- Emergency controls: pause friend games, reactions off, a game off.
- Who's in, who's playing now; find a student fast → new name / hide.

**Weekly (planning, at a desk):**
- How is the class getting on in maths: skill map, hardest facts, skips.
- Set / extend / end a maths focus.
- Who hasn't played, who is struggling, who is skipping.
- One student's full picture.

**When introducing a game (a few times a term):**
- Turn a game on or off for the class; choose its maths mode and topics.

**Rare (set-up, once a year, or never):**
- Make a class, code, warp mode, groups, co-teachers, add unassigned students.
- Reset a hero / clan / warm-up; move a student; delete a student; make a teacher.
- Season dates, fame season, new points season, archive classes.

The redesign follows this order: the first list is on the landing screen; the second is one click away; the third is a
compact table; the fourth is out of the way behind a clear "Class set-up" tab and an admin-only "Admin" area.

## 4. The new shape

### 4.1 One teacher area, class first

All teacher pages share one header and one class choice, held in the URL so links and the back button keep the class:

```
/teacher/:classId              Today       (landing)
/teacher/:classId/students     Students    (+ /students/:studentId)
/teacher/:classId/maths        Maths       (Focus · Skill map · Skips · Hardest questions)
/teacher/:classId/games        Games
/teacher/:classId/setup        Class set-up (today's My classes, for this class)
/teacher/admin                 Admin       (school admins only: section 4.7)
```

Old routes (`/teacher`, `/classes`, `/focus`, `/skills`) redirect, so CLASS-LAUNCH.md and bookmarks keep working.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Room 12 ▾   28 students · 6 playing now · Code K7Q-2P (asks first)        │
│ [Today] [Students] [Maths] [Games] [Class set-up]           [Admin]       │
└──────────────────────────────────────────────────────────────────────────┘
```

The class switcher remembers the last class (as now) and shows "(not mine)" for an admin. A teacher with one class sees its
name with no dropdown. The nav "Teacher" link gets a count badge when warp requests are waiting.

### 4.2 Today (the landing screen)

```
┌ Needs you ──────────────────────────────────────────────────────────────┐
│ 2 students want to join Room 12:  Zippy Meerkat 79 [Yes] [No]  …         │
│ Maths Monsters turned down 3 saves from Speedy Otter 27 this week  [See] │
└──────────────────────────────────────────────────────────────────────────┘
┌ Lesson controls (Room 12) ──────────────────────────────────────────────┐
│ Games against friends   [● On ]      Emoji reactions   [  Off ○]         │
│ Training before games   [  Off ○]    Skip button       [On | 3 | Off]    │
│ [Pause every game for this class]  (one tap, undo shown)                 │
└──────────────────────────────────────────────────────────────────────────┘
┌ This week in Room 12 ───────────────────────────────────────────────────┐
│ Focus: Bonds to 20, ends Fri  [Extend] [End]  [Set a new focus]          │
│ 24 of 28 played · 1,240 questions · 9% skipped · 4 haven't played [who]  │
│ Hardest right now: 7×8 (41%), 13−6 (48%), 6×7 (52%)          [Maths ›]   │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Needs you** only appears when there is something. Sources: warp requests (approve inline), integrity refusals from any
  game, students over the high-skip mark, students in no class (admin). Empty = one quiet line "Nothing needs you".
- **Lesson controls** are the four class-wide switches teachers flip mid-lesson, as real toggles that show state.
  "Pause every game" is new (one class flag the dashboard and functions already check alongside each game switch) and is
  the 3-second emergency stop; if we don't want a new flag, it can loop the existing game switches and record which were on so
  "Undo" puts them back.
- **This week** is counts and links, no names, so it is safe on a projector.

### 4.3 Students

A class roster, one row per student, sortable:

| Student | Real name | Last played | Questions (7 d) | Skipped | Ladder: now | Focus |
|---|---|---|---|---|---|---|

- Filter box, "Show: this class / whole school / not in a class" (whole school for admins and for finding a student who isn't
  in a class yet).
- "Hide real names" toggle, remembered per teacher.
- Opening a student goes to `/teacher/:classId/students/:id` (a real page, linkable, back button works), with sections:
  - **Overview**: level and points, ladder place and warm-up, their focus, skip rate, their hardest questions across games.
  - **Games**: one collapsed line per game they have played ("Gem Keep: 14 of 30 stars, 3 keys"), opening into that game's
    `StudentPanel`. Panels load only when opened (today all eight load at once).
  - **Recent games**: today's list, as is.
  - **Manage** (bottom, plainly separated): New name, Hide/Show, Move to class, Reset warm-up, Reset Dragon hero, Reset clan,
    swap made-up hero names; then a red **Danger** box with Delete (type the name). Make/Remove teacher moves to Admin.

### 4.4 Maths

Sub-tabs, all for the chosen class:
- **Focus**: today's SetFocus page, unchanged except it uses the shared class.
- **Skill map**: today's SkillMap page, same.
- **Skipped questions**: today's tables (the switch itself lives on Today).
- **Hardest questions**: one table merging every game's "hardest" list (Gem Keep facts, Monsters, Dragon, Clan Quest), with a
  "Game" column and a filter, all **for this class**. This replaces five scattered tables.

### 4.5 Games

One compact table for the class, grouped like the dashboard (no maths / easy maths / complex maths):

```
Game                On        Maths                       Settings
Chess, Checkers     always    –
Wormholes & BH      always    [Off | Choose | On]         Reactions ›
Gem Keep            always    Calm · ×2–×10 · typing      Settings ›
Maths Monsters      [● On]    4 of 6 topics               Settings ›
Dragon Maths        [ Off ○]  Season 3, 12 days left      Settings ›
Clan Quest          [● On]    Year 4 · 5 topics · 10/day  Settings ›
Marble Rush         always    [Off | Choose | On]         Rescue ›
Mine Runner         [● On]    [Off | Choose | On]
Archery             [● On]    classmate fights on         Settings ›
Kingdom Keeper      [ Off ○]  follows focus
Bond Match          [● On]    –
```

- The on/off toggle and the 3-way maths switch are inline (they are the common changes).
- **Settings ›** opens that game's own panel in a side drawer (or a sub-page on a Chromebook-width screen): topics, tables,
  modes, fights a day, the game description (collapsed under "About this game"), and the game's class report — now for
  this class.
- One look tells the teacher what their class can see. Today that needs a long scroll.

### 4.6 Class set-up

Today's My classes ClassPanel for the chosen class: name and year, Class Warp code and mode, who has joined, groups, members,
add students who aren't in a class yet, co-teachers, archive. "Make a class" moves to the class switcher ("+ New class").
This is everything an ordinary teacher needs that isn't about one lesson; nothing school-wide lives here.

### 4.7 Admin (school admins only)

A separate page, `/teacher/admin`, for the jobs that affect the whole school. Only teachers with `school_admin` see the
**Admin** tab; anyone else who opens the URL gets "This page is for school admins". As now, the page hiding itself is only
tidiness: every admin action is checked by the database (`teacher_new_season` and `teacher_set_role` already do; the
others below need the check added).

It has its own sub-nav, ordered by how often an admin needs each part:

```
/teacher/admin                 Overview
/teacher/admin/classes         Classes
/teacher/admin/students        Students
/teacher/admin/teachers        Teachers
/teacher/admin/games           School game settings
/teacher/admin/safety          Safety
/teacher/admin/year            End of year
```

**Overview** (the admin's "Today"): the school at a glance and anything only an admin can sort out.
- Needs an admin: students in no class (with "Add to a class"), classes with no teacher, warp requests waiting more than a
  day in any class, integrity refusals across the school this week, new staff accounts still set as students.
- Numbers, no names: classes, students, teachers; how many played this week; questions answered; skip rate. Each links to
  the matching admin page.

**Classes**: every class in the school (archived ones behind a filter), with teachers, student count, code and warp mode,
last activity. An admin can open any class's teacher area (it shows "(not mine)" in the header), add or remove a
teacher from a class, archive or unarchive, and make a class for someone else.

**Students**: the whole-school roster (moves here from today's Teacher page, so ordinary teachers see their own classes
only; see question 3). Columns: player name, real name, class, last played, hidden. Filters: no class, hidden, not played
for 30 days. Actions per row or ticked rows: move to a class, hide/show, new name, and **Delete** (in a danger box, type
the name; ticked delete for leavers types the number of students).

**Teachers**: every teacher account, their classes, admin or not. **Make teacher / Remove teacher** move here from the
student row (only admins could do them anyway). New: make or remove a **school admin**, with a rule that the last admin
can't remove themself.

**School game settings**: what is genuinely school-wide, kept apart from the per-class Games tab:
- Clan Quest villages and groups (school-wide today; question 2).
- Dragon Maths season start and length (question 2).
- **Defaults for new classes** (new): the switches a new class starts with, instead of every class starting from the
  database's built-in defaults. Uses the same Games table component, saved as a school row.
- **Copy settings to classes** (new): take one class's switches and apply them to ticked classes, with a preview of what
  changes. Saves an admin flipping the same switch in ten classes.
- **Pause every game, whole school** (new, if question 1 is yes): the school-wide version of the lesson emergency stop, for
  an incident or an outage, with Undo.

**Safety**: one place for what is today spread over game panels and runbooks:
- Hidden students and why they matter (can't play friends, off boards), with Show again.
- Every game's turned-down saves and requests across the school (from the `alerts` hook in section 6), filterable by game,
  class and student.
- Recent new names given by teachers, and made-up Clan Quest hero names (with the swap button), so an admin can spot a
  name being used to tease.
- A read-only "look up a player around a time" form that replaces the SQL in CLASS-LAUNCH.md ("Looking up a problem
  afterwards"): player name + time → their games in the hour either side. Needs one new admin-only RPC wrapping that query.

**End of year**: one guided checklist instead of resets on three pages, done in order, each step showing what it will
change before it runs:
1. Make next year's classes (or keep and rename them).
2. Archive last year's classes.
3. Students who have left: list of students in no class or in archived classes only, tick and delete.
4. Start a new points season (type NEW SEASON; school-wide; already admin-checked).
5. Clan Quest fame season for the whole school.
6. Dragon Maths: set the new season start date.
The page records when each step was last done ("Points season started 3 Feb 2026 by J. Riley"), so a second admin doesn't
run one twice.

## 5. One look and feel for every setting

A small set of shared components in `src/teacher/` so every game panel looks and behaves the same:

- `<SettingToggle label state onChange about?>`: a real switch (role="switch"), shows the state, saves at once, says
  "Saved ✓" inline for 2 s, and on failure flips back with the error. Optional `about` text behind a "?" disclosure.
- `<SettingChoice options>`: segmented 2–4 option control (maths Off/Choose/On, skip On/3/Off, Calm/Challenge).
- `<SettingChips>`: multi-select chips (topics, tables) with the "leave at least one" rule built in.
- `<SettingNumber>` / `<SettingDate>`: save on blur or Enter, no separate Save buttons.
- `<DangerAction words confirm>`: the only red control; for things that cannot be undone. Reversible switches are never red.
- One page-level status/toast area instead of a status line under every panel.

Copy rule: the label names the setting ("Games against friends"), the switch shows the state, and the one-line "about" says
what On means. No paragraphs above the control.

## 6. Changes to how games plug in

Today a game gives `TeacherPanels` (anything it likes, stacked on the page) and `StudentPanel`. Replace with a small
contract so the hub decides layout and each game still owns its own file (keeps the GAME_DEVELOPMENT_GUIDE rule that games
don't edit shared pages):

```ts
teacher?: {
  /** Row on the Games table. */
  switch?: { useValue(classId): boolean | null; save(on, classId): Promise<void> };
  maths?:  { useValue(classId): MathsSwitch | null; save(mode, classId): Promise<void> };
  /** One-line summary for the Games table ("4 of 6 topics"). */
  useSummary?(classId): string | null;
  /** The drawer: settings + class report, both given classId. Lazy. */
  Settings?: ComponentType<{ classId: string }>;
  /** Student page, Games section. Lazy, loaded only when opened. */
  StudentPanel?: ComponentType<{ student: string }>;
  /** One line for the student's collapsed Games row ("14 of 30 stars"). */
  studentSummary?(student): Promise<string | null>;
  /** Items for Today → Needs you (integrity refusals, etc.). */
  alerts?(classId): Promise<TeacherAlert[]>;
  /** Hardest-questions rows for the merged Maths table. */
  hardest?(classId): Promise<HardestRow[]>;
}
```

Server side:
- Give `teacher_gem_keep_class`, `teacher_monster_class`, `teacher_lord_class`, `teacher_clan_maths_class` and
  `teacher_students` a `target_class` argument, filtered with `class_members` and checked with `teaches_class` (the
  pattern `teacher_question_skips` already uses). New migrations; keep the old signatures working until the client moves.
- One `teacher_class_overview(target_class)` RPC for Today and the Students roster (roster rows, the four lesson switches,
  every game's on/off and maths mode, warp requests, week counts). That replaces ~30 calls on load with one or two.
- Add the admin check to the village functions and the Dragon season date, once question 2 is decided.
- Admin-only RPCs for the Admin page: `admin_overview()`, `admin_students(filter)`, `admin_set_school_admin(person, on)`
  (refuses removing the last admin), `admin_copy_class_settings(from, to[])`, `admin_class_defaults` get/set,
  `admin_player_lookup(name, around)` (read-only), and an `admin_log` table for end-of-year steps and other admin actions.
- Decide: are Clan Quest villages and Dragon season dates per school or per class? Today villages are per school while
  raids are per class, and Dragon dates save per class.

## 7. Order of work

Each stage ships on its own and leaves the site working.

**Stage 0: quick fixes on today's page (small, one PR).**
- Relabel the school-wide panels "(whole school)" and fix the Gem Keep and Clan Quest copy, until stage 3 makes them per class.
- Show waiting warp requests at the top of the Teacher page, and a count on the nav link.
- Make Maths focus and Skill map buttons/tabs at the top instead of sentences.
- Wrap each game's panels in a collapsed `<details>` with a one-line state summary ("Mine Runner: On · maths: students choose").
- Move the Players list above the game panels; move both NEW SEASON resets into a final "School admin / end of year" section.

*Done 28 Oct 2026 on `teacher-view-plan`, with these differences:*
- *No one-line state summary yet: each game's state lives inside its own panel, so the summary needs stage 3's
  `useSummary`. Instead, a game's panels now only mount (and ask the server) when opened, which cuts most of the ~30
  calls the page made on arrival.*
- *The folded games sit above the Players list (11 short rows before a list of every pupil), and the bottom section is
  "Seasons and end of year": the fame season (every teacher, saying whose fame it resets) and the points season (admins).
  Games add to it with a new optional `SeasonPanels` in `GameDefinition`.*
- *No migration: the fame season was already scoped correctly (section 2.1).*

**Stage 1: the teacher shell.** Shared header, class in the URL, sub-nav, redirects. Focus, Skill map and My classes move in
as Maths and Class set-up with almost no change. Today page with Needs you + Lesson controls.

*Done 28 Oct 2026 on `teacher-shell`. Decided by James: no "Pause every game" button for now (no database change), and real
names stay shown. What changed and what didn't:*
- *Routes as in 4.1, plus `/teacher/:classId/maths/skills` and `/maths/skips` as the Maths sub-tabs (Focus, Skill map,
  Skipped questions; the skip tables would otherwise have had no home). `/teacher`, `/classes`, `/focus?class=` and
  `/skills?class=` open the class named, else the one this visit last used, else the first, on the right tab; a skill map's
  `?student=` and `?skill=` come along. A class not in the list opens the first one on the same tab.*
- *The header (`src/teacher/TeacherShell.tsx`) feeds the existing `useTeacherClass()`, so every game panel, the skip panel,
  SetFocus and SkillMap read the header's class with almost no change (their own pickers are gone).*
- *Today: Needs you (this class's warp requests with Yes/No, a count and link for other classes; one quiet line when
  nothing waits), Lesson controls (friends, reactions, Training before games, skip button as real switches that save at once
  and flip back on failure), This week (running focuses as counts with Extend and End, and last 7 days' questions and skip
  rate from `teacher_question_skips`; no names). No "6 playing now", "haven't played" or hardest facts yet: they need
  `teacher_class_overview` (stage 4) and the merged hardest list (stage 5).*
- *Students is today's Players list (still whole school) with the season resets under it. Class set-up is My classes' panel
  for the header's class, then Make a class, then (admins) archived classes. A teacher with no class sees today's My classes
  page. `/teacher/admin` is a placeholder.*
- *Not done: the old `TrainingFirstSwitch` panel is no longer on any page (Today has the switch) but is kept with its test
  until stage 2 replaces it.*

**Stage 2: shared setting components** (section 5), then convert the four lesson switches and the space maths switch.

**Stage 3: Games table + new game contract** (section 6). Convert one game per PR (each game's file is its own, so these can run
in parallel), class-scoped class reports, then remove `TeacherPanels`.

**Stage 4: Students roster and student page,** with `teacher_class_overview` and class-scoped `teacher_students`.

**Stage 5: Merged hardest questions and alerts** on the class Maths and Today pages.

**Stage 6: the Admin page.** In this order, each its own PR: Overview + Students + Teachers (moving what exists, plus
school-admin role); Classes; End of year checklist + `admin_log`; Safety (alerts across the school, player lookup);
School game settings (villages, Dragon dates, then the new defaults and copy-to-classes). Stage 0 already moves the
resets into an admin-only section, so nothing waits on this stage to be safe.

## 8. Tests to carry over / add

- Existing `Teacher*.test.tsx` files keep their assertions about what each switch saves; they move with the panels.
- New: class choice carries across every teacher route; a student in another class never appears in a class view; Today shows
  Needs you only when there is something; reversible switches are never `button--danger`; old routes redirect.
- Database tests for every new `target_class` argument (a teacher can't read a class they don't teach).
- Admin: a non-admin teacher gets no Admin tab and every `admin_*` RPC refuses them; the last admin can't remove themself;
  copy-to-classes changes only the ticked classes; player lookup only reads.

## 9. Questions to decide before stage 1

1. Is a one-tap "Pause every game for this class" wanted, or is pausing friend games enough?
2. Villages and Dragon Maths seasons: school-wide or per class?
3. Should non-admin teachers see the whole-school student list at all, or only their classes plus students in no class?
4. Is the Teacher page ever projected? (Decides whether real names start hidden.)
5. Admin page: are "defaults for new classes" and "copy settings to classes" wanted now, or later?
6. Should there be more than one school admin, and who can make one?
