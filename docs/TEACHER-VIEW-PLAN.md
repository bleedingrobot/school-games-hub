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

*Done 28 Oct 2026 on `teacher-settings` (branched from `teacher-shell`). No database change; nothing any switch saves changed.*
- *`src/teacher/Settings.tsx` (+ `settings.css`): `SettingToggle`, `SettingChoice`, `SettingChips`, `SettingNumber`,
  `SettingDate` and `DangerAction`, plus `useSetting(load, deps, enabled)` to load a value. Each control is given the value
  (null while loading) and a save function; it changes at once, says "Saved ✓" for 2 s, and on failure goes back and shows
  the error. "About" text sits behind a "?" (`aria-expanded`). In `SettingChoice` the arrow keys move along and Space or Enter
  picks, so moving never saves a choice by accident; it shows nothing until it has loaded. `SettingChips` refuses to untick
  the last chip ("Leave at least one ticked"). Number and date fields save on Enter or blur, refuse out-of-range values, and
  Escape puts the saved value back. `DangerAction` is the only red control: the button wakes once the words are typed.
  Every target is 44 px, focus rings show inside the segmented control, and the switch doesn't slide with reduced motion.*
- *Today's four lesson controls and the Mission Control maths switch use them. The Training panel's longer description and
  the Skip button's "which buttons stay" note moved behind their "?".*
- *Skipped questions tab: its own radio list is gone; one line links to Today, where the switch lives (section 4.4).*
- *`TrainingFirstSwitch` (`src/training/TeacherTrainingFirst.tsx`) is removed; its checks (saves for the class, the 2-hour
  note, says when it can't load) are now in `TeacherShell.test.tsx` and `Settings.test.tsx`.*
- *Delete student and Start a new season use `DangerAction`, in the same places. The "🗑️ Delete" button that opens the
  delete box stays red (it leads to the can't-undo step) and is not inside `DangerAction`.*
- *Not done: the single page-level status area from section 5 (each control still has its own status line).*

**Stage 3: Games table + new game contract** (section 6). Convert one game per PR (each game's file is its own, so these can run
in parallel), class-scoped class reports, then remove `TeacherPanels`.

*How a game moves to the new contract (one game per PR, on its own branch; only that game's files change):*
1. *Read what the game gives today in its `index.tsx`: `useTeacherSwitch`, `TeacherPanels`, `StudentPanel`, and the panels
   themselves (usually `src/pages/Teacher<Game>.tsx`). Note which settings are an on/off switch, which is a 3-way maths
   switch, and what is left (topics, modes, the class report).*
2. *On/off switch: give `teacher.switch` with `useValue(classId)`, `save(on, classId)` and an optional one-line `about`.
   `useValue` returns `{ value, failed }` (what `useSetting` from `src/teacher/useSetting.ts` gives, `value` null while
   loading), so the row can say when it couldn't load. Put the hook in the game's own folder (Bond Match: `switch.ts`), and
   import `useSetting` from `useSetting.ts`, not `Settings.tsx`, so the dashboard doesn't load the settings CSS.*
3. *Maths switch: the same, as `teacher.maths` (Wormholes: `src/games/space/teacher.ts`). A game with a maths setting that
   isn't a 3-way switch gives `useSummary(classId)` instead, one short line for the Maths column.*
4. *Everything else goes in one `teacher.Settings` component that takes `classId` and is loaded with `lazy()`. Build it
   from the shared controls in `src/teacher/Settings.tsx`. Don't repeat the switches already in the row. A longer
   description goes behind an `about` "?" rather than in a paragraph.*
5. *Move `StudentPanel` under `teacher` (lazy), and add `studentSummary(student)` if there is a one-line summary.*
6. *Delete `TeacherPanels` and the top-level `StudentPanel` from the definition, and the old panel code they used. Once
   `teacher` is set the table ignores them. Keep `useTeacherSwitch`: it isn't for the teacher page, it's how the pupils'
   dashboard hides the game's card while the class has it off.*
7. *Tests: keep the old panel tests' checks on what each control saves, pointed at the new component. Update
   `registry.test.ts` if it lists the game's teacher parts. Add a row check in `src/teacher/Games.test.tsx` (the row shows
   the switch or maths choice and saves it for the header's class).*
8. *Check the row and the drawer at 1366 × 640 and 390 × 844, then run typecheck, test:all and build.*

*Stage 3a (the table and the contract) done 28 Oct 2026 on `teacher-games-table` (branched from `teacher-settings`). No
database change.*
- *`teacher?: TeacherContract` in `GameDefinition` (`src/games/types.ts`): `switch`, `maths`, `useSummary`, `Settings`,
  `StudentPanel` and `studentSummary`. No `alerts` or `hardest` yet (stage 5). Two changes from section 6: `useValue`
  returns `{ value, failed }` instead of `boolean | null`, so a row can say "We couldn't load this setting", and `switch`
  and `maths` have an optional `about` line. `TeacherPanels` and the old `StudentPanel` still work beside it.*
- *The Games tab (`src/teacher/Games.tsx`) is the table from 4.5: a real table (Game, On, Maths, Settings) grouped like
  the dashboard, with `SettingToggle` and `SettingChoice` inline (a new `compact` look). A game with no switch says
  "always". "Settings ›" opens a drawer at 800 px and wider (focus stays inside it, Escape or the backdrop closes it, and
  focus goes back to the link) and its own page, `/teacher/:classId/games/:gameId`, on a narrower screen. On a phone each row
  becomes a small card and the maths choice drops under its label. Games that haven't moved still get a row, and their
  old `TeacherPanels` open in the same drawer. Because the table can't read their switches yet, their On and Maths say "in
  Settings".*
- *Wormholes & Black Holes: the maths switch is in the Maths column and Emoji reactions is its Settings.*
- *Bond Match is fully moved: an on/off switch and nothing to open. Its description now sits behind the switch's "?", and
  the old panel (with its red button) is gone. Its student panel is under `teacher`, with a summary line ("5 games, 6
  stars"). Nothing reads `studentSummary` until the student page (stage 4).*
- *The old Games section, `GameSection` and `MathsSwitchPanel` are gone from `src/pages/Teacher.tsx`.*
- *Focus going back to "Settings ›" survives the page being rebuilt on every address change (Layout keys its CrashScreen
  by the path), including the browser's Back button. Arriving from another tab doesn't move focus.*
- *Not done: no class-scoped class reports and no migrations. Gem Keep's, Maths Monsters', Dragon Maths' and Clan Quest's
  class reports are still whole school. No other game is converted.*

*Mine Runner moved 28 Oct 2026 on `teacher-games-mine` (from `teacher-games-table`). No database change; nothing it saves
changed.*
- *Its row has the on/off switch and the maths switch, and nothing to open (as in the 4.5 sketch). The game's description
  and the question-door details sit behind each one's "?". The old panel, with its red "Switch Mine Runner off" button, is
  gone, and so is its file (`src/pages/TeacherMine.tsx`).*
- *The hooks are in `src/games/mine/teacher.ts`. The old panel's tests moved to `src/games/mine/teacher.test.tsx`, with the
  same checks, now for a named class. The Games tab exports `GameSwitchSetting` beside `MathsSwitchSetting`, so a game can
  test its own row.*

*Marble Rush moved 28 Oct 2026 on `teacher-games-marble` (from `teacher-games-mine`). No database change; nothing it saves
changed.*
- *Its row says "always" for On (it has no on/off switch) and has the 3-way maths switch, with the gates and pit stops
  explained behind its "?". Its Settings hold the rescue questions as a switch. While maths is off they say why there's
  nothing to switch, as the old panel did by hiding the button. The red "Switch rescue questions off" button is gone.*
- *The maths hook is in `src/games/marble/teacher.ts`. `src/pages/TeacherMarble.tsx` now holds only
  `MarbleTeacherSettings`. Its tests keep the old checks, now for a named class, plus one for the note shown with maths off.*

*Archery Challenge moved 28 Oct 2026 on `teacher-games-archery` (from `teacher-games-load-failed`). No database change;
nothing it saves changed.*
- *Its row has the on/off switch (the game's description behind its "?"). As in the 4.5 sketch, the Maths column sums up
  classmate fights ("Classmate fights on"), because its maths, the speed rounds, is always there and has no switch. The
  first game to use `useSummary`. It says "Couldn't load" if the setting can't be read.*
- *Its Settings: classmate fights as a switch (the old description behind its "?"), the note that it only matters while the
  game is on, the points, and This week (counts only, for the class, as before). Both red buttons are gone.*
- *The points stay in the Settings rather than behind the row's "?", because they need the speed-round rules
  (`shared/archery/speed.ts`), which would pull the maths-question code onto the dashboard.*
- *The hooks are in `src/games/archery/teacher.ts`. `src/pages/TeacherArchery.tsx` now holds only `ArcherySettings`. Its
  tests keep the old checks, now for a named class, plus the summary line and the note being hidden while the game is on.*

*Kingdom Keeper moved 28 Oct 2026 on `teacher-games-kingdom` (from `teacher-games-archery`). No database change; nothing
it saves changed.*
- *Its row has the on/off switch, with the game and its points behind the "?", and "Follows focus" in the Maths column (as
  in the 4.5 sketch: each adviser's question follows the student's own focus, and there is no switch). Nothing to open. The
  old panel, with its red "Switch Kingdom Keeper off" button, is gone, and so is its file (`src/pages/TeacherKingdom.tsx`).*
- *The hook, the summary and the "about" line are in `src/games/kingdom/teacher.ts`. The old panel had no tests; the row's
  are new in `src/games/kingdom/teacher.test.tsx`.*
- *Every game in the table with no class report has now moved. Left: Gem Keep, Maths Monsters, Dragon Maths and Clan
  Quest, which each have a class report and a student panel, and need the class-scoped reports first (section 6).*

*Gem Keep moved 28 Oct 2026 on `teacher-games-gem-keep` (from `teacher-games-about-popover`), with its class report now for
one class. One migration, `20261028000100_gem_keep_class_report.sql` (not live yet); nothing it saves changed.*
- *Server: `teacher_gem_keep_class(target_class uuid)` gives the old report for one class: the teacher's students in that
  class (`class_members`), refused with 42501 unless `teaches_class` (a school admin teaches every class), and 22023 for no
  class. The argument has no default, so the old `teacher_gem_keep_class()` beside it still answers a call with no arguments
  (with a default, PostgREST couldn't choose). Drop the old one in the PR that removes `TeacherPanels`. Checked by
  `supabase/tests/database/gem_keep_class_report.test.sql`.*
- *The site doesn't break before the migration is live: `fetchClassGemKeep(classId)` falls back to the old call when the
  server says the function doesn't exist (PGRST202), and the report is then headed "Gem Keep: the whole school" with a line
  saying so. Once the migration is applied it says "Gem Keep: this class" with no change to the site.*
- *Its row says "always" for On and sums up its settings in the Maths column ("Calm · ×2–×10 · typing", from
  `src/games/gem-keep/teacher.ts`, which reads only three columns). Its Settings (`GemKeepTeacherSettings` in
  `src/pages/TeacherGemKeep.tsx`) use the shared controls: Questions (Calm/Challenge), Times tables on (chips, at least one),
  Missing numbers, Division questions, How students answer (Typing/Multiple choice) and the Level Key pass mark (a number,
  5–10; it was a dropdown), then the class report. Gem Keep saves all its settings at once, so the saves go one at a time,
  each from the newest settings, and two quick changes can't undo each other.*
- *Its student panel is under `teacher`, with a summary line ("12 of 30 stars, 4 Level Keys passed").*
- *Tests: the old checks in `ProgressPages.test.tsx` stay (closed until opened; a table and the pass mark save for the class;
  the hardest facts), now for the header's class, plus a save from every other control and the whole-school fallback. In
  `Games.test.tsx` the "game that hasn't moved" test now uses Maths Monsters, and Gem Keep has a row check.*

*Maths Monsters moved 28 Oct 2026 on `teacher-games-monsters` (from `teacher-games-gem-keep`), with its class report now for
one class. One migration, `20261028000200_monsters_class_report.sql` (not live yet); nothing it saves changed.*
- *Server: `teacher_monster_class(target_class uuid)`, the same pattern as Gem Keep's: the old report (players, badges, each
  topic, hardest questions, and refused saves from the last 2 weeks) for the teacher's students in that class only, 42501
  unless `teaches_class`, 22023 for no class, and the old no-argument function left beside it. Checked by
  `supabase/tests/database/monsters_class_report.test.sql` (17 checks, including a teacher with two classes and refused
  saves kept to their class).*
- *The same fallback as Gem Keep: until the migration is live, the report is the whole school's and says so.*
- *Its row has the on/off switch (the game behind its "?") and "4 of 6 topics" (or "All 6 topics") in the Maths column, as
  in the 4.5 sketch. The old red "Switch Maths Monsters off" button is gone. Its Settings: Topics on (shared chips, at least
  one stays ticked, the "nearest topic" rule behind the "?"), a note while the game is off, then the class report.*
- *`teacher_set_monsters` saves the switch and the topics together, so `saveMonstersEnabled` and `saveMonstersTopics` read
  the class's current settings and save them with the one change. No server change was needed.*
- *On a phone the hardest-questions table (five columns) was wider than its card; it now scrolls sideways inside it.*
- *Its student panel is under `teacher`, with a summary line ("12 of 54 monsters, 2 of 6 badges").*
- *Tests: `TeacherMonsters.test.tsx` keeps every check (switch on and off, each topic on and off, the last topic stays on,
  a failed save goes back, the class report, the student panel), now for a named class; the switch is tested through its
  Games table row. In `Games.test.tsx` the "game that hasn't moved" tests now use Dragon Maths, and Monsters has a row check.*

*Dragon Maths moved 28 Oct 2026 on `teacher-games-dragon` (from `teacher-games-monsters`), with its class report now for
one class. One migration, `20261028000300_lord_class_report.sql` (not live yet). Nothing it saves changed, and its season
dates still work exactly as before (one date per class; the one school date of section 9 is the next step).*
- *Server: `teacher_lord_class(target_class uuid)`, the same pattern as Gem Keep's and Monsters': the old report (the season,
  heroes at each level this season, hardest questions, requests turned down in the last 2 weeks, and the Hall of Heroes) for
  the teacher's students in that class only, 42501 unless `teaches_class`, 22023 for no class, and the old no-argument
  function left beside it. One difference: the season is the class's own (its settings row, which its pupils play by). The
  old call used the teacher's own row, which for a teacher with two classes was the other class's season. Checked by
  `supabase/tests/database/lord_class_report.test.sql` (23 checks, including two classes with different seasons).*
- *The same fallback as Gem Keep and Monsters: until the migration is live, the report is the whole school's and says so.*
- *Its row has the on/off switch and where the class's season is in the Maths column ("Season 2, 12 days left"; "Season 2
  paused, 30 days left" while the game is off and its clock waits; "Season 1 starts in 5 days"; "Starts when switched
  on"), as in the 4.5 sketch. The "?" says switching off pauses the season clock and switching on again carries the season
  on where it left off. The red "Switch Dragon Maths off (pause the season)" button is gone.*
- *Its Settings: a note while the game is off (if its clock is paused: since when, and that switching on in the Games table
  carries on the season where it left off), Forest fights a day (a number, 1–30, saved on Enter or leaving the box; it had a
  Save button), First day of season 1 (a date, likewise), Topics on (shared chips), then the class report. The longer
  descriptions moved behind each one's "?".*
- *`teacher_set_lord` needs the switch with every save, so the Settings' saves (`saveLordChange` in `src/data/lord.ts`) read
  the class's current switch first and send it back unchanged: a stale one would switch the game, and its season clock, on or
  off. The row's switch (`saveLordEnabled`) sends only the switch. No server change was needed.*
- *On a phone the hardest-questions table scrolls sideways inside its card, as Monsters' does.*
- *Its student panel is under `teacher`, with a summary line ("Level 5 mage, season 2, 1 dragon star").*
- *Tests: `TeacherLord.test.tsx` keeps every check (on, off and on again; the pause and carrying on; forest fights and the
  date save; each topic, the order, the last topic stays on; a failed save goes back; the class report; the student panel),
  now for a named class; the switch is tested through its Games table row. The old "the season clock is paused" status line
  after switching off is now in the switch's "?". In `Games.test.tsx` the "game that hasn't moved" tests now use Clan Quest,
  and Dragon Maths has a row check.*

*Dragon Maths school season built 28 Oct 2026 on `teacher-games-dragon-season` (from `teacher-games-dragon`), as designed in
docs/DRAGON-SCHOOL-SEASON.md (section 5 lists the small differences). One migration, `20261028000400_lord_school_season.sql`
(not live yet). No change to the `lord` server function.*
- *Server: the season date and the holiday pause live on the school's default settings row. `lord_settings`,
  `lord_current_season` (the Warriors list) and both class reports read them from there; the class rows keep their old dates,
  unread. `teacher_set_lord`'s switch only switches (and starts season 1 today if the school has no date). New:
  `lord_school_season()` for any teacher, and `admin_set_lord_season(date)` and `admin_set_lord_holiday(paused)` for school
  admins (42501 for anyone else; 22023 for a date that would take the season number down). The one-off step gives each school
  the earliest date any of its rows has. Checked by `supabase/tests/database/lord_school_season.test.sql` (44 checks, two
  classes mid-season on different dates), plus a `handler.test.ts` case for a hero jumping three seasons.*
- *Site: the Dragon Maths drawer opens with "Seasons (whole school)": for a school admin the date and a "Holiday pause (whole
  school)" switch, for any other teacher the same line read-only with "Set by a school admin". The class part keeps forest
  fights and topics. The row's Maths column shows the school's season ("Season 3, holiday pause" while paused) and its "?"
  says off is for this class only. Until the migration is live, `lord_school_season` answers PGRST202 and the drawer, the row
  and the "?" stay exactly as #60 left them (each class's own date and pause).*
- *Before it goes live: James runs the read-only query in DRAGON-SCHOOL-SEASON.md 2.3 (with his OK) to see which classes jump
  forward, then it's applied at a quiet time with teachers told the day before.*

*Clan Quest moved 28 Oct 2026 on `teacher-games-clans` (from `teacher-games-dragon-season`), with its class report now for
one class. One migration, `20261028000500_clan_maths_class_report.sql` (not live yet); nothing it saves changed. Every game
has now moved.*
- *Server: `teacher_clan_maths_class(target_class uuid)`, the same pattern as Gem Keep's: the old report (how many answered,
  every kind of story question, the kinds most often wrong) for the teacher's students in that class only, 42501 unless
  `teaches_class`, 22023 for no class, and the old no-argument function left beside it. Checked by
  `supabase/tests/database/clan_maths_class_report.test.sql` (19 checks, a teacher with two classes). The village functions
  are unchanged: villages stay whole school and any teacher can manage them (section 9).*
- *The same fallback as the others: until the migration is live, the report is the whole school's and says so.*
- *Its row has the on/off switch (the game behind its "?") and "Year 4 · 5 topics · 10/day" in the Maths column, read
  straight from the settings row (`src/games/clans/teacher.ts`). The red "Switch Clan Quest off" button is gone.*
- *Its Settings: a note while the game is off, Made-up hero names (a switch), the maths (Year band as a choice, Topics on and
  the times tables as chips, Mine fights a day as a number; no Save button), Raids on classmates (a switch, per class), the
  class report, then "Clan Quest villages (whole school)", unchanged apart from a real table for who is in which group and
  44 px controls. The red buttons for names and raids are gone; deleting a village (can't be undone) stays red.*
- *`teacher_set_clan_maths` saves only the settings it is sent and keeps the rest, so each control sends only its own
  setting; the saves still go one at a time, in order. Mine fights a day out of range is now refused with a word (it was
  quietly made 30), as Dragon Maths' forest fights are.*
- *The fame season stays where it is (Students, with the other seasons): it is already in the right place, and Stage 6's
  End of year page is its eventual home.*
- *Its student panel is under `teacher`, with a summary line ("Red Banner, day 4, average level 3.5").*
- *Tests: `TeacherClans.test.tsx` keeps every check (switch on and off, a failed save, hero names, raids, each maths setting,
  the last topic stays on, fights a day kept to 1–30, the times tables only with that topic, the villages, the fame season,
  the student panel), now for a named class; the switch is tested through its Games table row. New: saves go in order, the
  class report and its fallback, and `src/data/clans.test.ts`. In `Games.test.tsx` the "game that hasn't moved" tests now use
  a made-up game, and Clan Quest has a row check.*

*`TeacherPanels` removed 28 Oct 2026 on `teacher-games-remove-panels` (from `teacher-games-clans`). One migration,
`20261028000600_drop_school_class_reports.sql` (not live yet), which drops the four old class reports that had no class:
`teacher_gem_keep_class()`, `teacher_monster_class()`, `teacher_lord_class()` and `teacher_clan_maths_class()`.*
- *Order on the live site: apply the four class report migrations (20261028000100, 0200, 0300, 0500), then publish this
  website, then apply this one. Before the four are live, this website's class reports fail to load; before the website is
  published, the live site still calls the old reports.*
- *`GameDefinition` no longer has `TeacherPanels` or the top-level `StudentPanel`; `teacher` is the only way in. The Games
  table lost its "in Settings" placeholders and the old-panel drawer; the Students page reads `teacher.StudentPanel` only.
  `SeasonPanels` stays (Clan Quest's fame season).*
- *The four class reports call only the class version: no PGRST202 fallback and no "the whole school" heading. Dragon Maths'
  school-season fallback (`fetchLordSchoolSeason`'s `live: false`) stays: its migration (20261028000400) isn't needed before
  this one.*
- *Database tests: each class report test's "old call still works" checks are replaced by one check that the old call is
  gone. `gem_keep.test.sql`, `monsters.test.sql`, `lord_l5.test.sql` and `clans_rewards.test.sql` called the old reports as a
  school admin; they now ask for the school's Everyone class (every pupil in them is in it), with the same numbers.
  `lord_school_season.test.sql`'s "old whole-school report" check now asks for Room Two. `security.test.sql` lists functions
  by name, so it needed no change.*
- *Site tests: the fallback tests are gone (data and pages), and so are the two "game that hasn't moved yet" tests in
  `Games.test.tsx`.*

**Stage 4: Students roster and student page,** with `teacher_class_overview` and class-scoped `teacher_students`.

*Done 28 Oct 2026 on `claude/project-thread-4t7spr` (from `teacher-games-remove-panels`). One migration,
`20261028000700_teacher_class_overview.sql`. Nothing is written by it; nothing any button saves changed.*
- *Server: `teacher_students(target_class uuid)` reads the shared `teacher_students()` (so the games' "last played" hooks keep
  working) and keeps the students in that class; the old no-argument call is unchanged. `teacher_class_overview(target_class)`
  gives each student in the class their list row, the last 7 days' questions shown and skipped (`question_log`), when they
  were last active (a finished game or a question shown) and their focus with their ladder place (`maths_focus_of`).
  `teacher_student_card(student)` is the top of the student page, so a link to it works on its own. All three: 42501 unless
  the teacher teaches the class or student (a school admin: anyone in the school; the card also opens the school's teachers,
  as the old list did), 22023 for no class. Checked by `supabase/tests/database/teacher_class_overview.test.sql` (31 checks,
  a teacher with two classes); `security.test.sql` lists the two new names. Every database test file passes on a fresh copy.*
- *Students tab (`src/teacher/Students.tsx`): a real table for the class (Student, Real name, Last active, Questions (7
  days), Skipped, Ladder, Focus), sortable by any column (kept in the address: `?sort=…&way=…`), with "Find a student".
  "Hide real names" hides the column (and stops the filter matching real names), remembered per teacher on that computer.
  A second button shows the old list ("All my students"; for a school admin "Whole school", teachers too), for finding
  someone outside this class. The season resets stay underneath. On a phone the table scrolls sideways inside its card.*
- *Student page (`src/teacher/StudentPage.tsx`, `/teacher/:classId/students/:studentId`): Overview (level and points,
  ladder place, focus, last 7 days, the warm-up reset), Games (wins and losses, then one folded line per game with its
  `studentSummary`; the game's `StudentPanel` loads only when its line is opened; games with nothing to say are listed as
  "Not played yet"), Recent games, Manage (New name, Hide/Show, Move to another class, Make/Remove teacher for school
  admins, then Delete in a red "Can't be undone" box). Switching class from a student page lands on the new class's list.*
- *Today: This week adds "Right now: N active in the last 15 minutes · M haven't played for 7 days (Who ›)", counts only;
  "Who ›" opens the roster with the quietest first (`?sort=quiet`).*
- *`src/pages/Teacher.tsx` is gone (its parts moved to the two files above).*
- *Not done: the plan's "Show: not in a class" (Class set-up already adds students who aren't in a class); Reset Dragon
  hero, Reset clan and the hero-name swap stay inside each game's own panel; Make/Remove teacher moves to Admin in stage 6;
  `teacher_class_overview` doesn't yet carry the lesson switches, game switches or warp requests (Today still asks for those
  separately, as in stage 1).*
- *Order on the live site: apply this migration before publishing the website (before it, the class roster and the student
  page can't load; "All my students" still works).*

**Live, 28 Oct 2026: stages 0–4.** In this order: the class reports (`20261028000100`, `0200`, `0300`, `0500`) and
`20261028000700_teacher_class_overview.sql` were applied to the live database by hand. The code was merged into `main`
(PR #68), and the site was published by the "Test and publish" run (build, database tests and deploy all passed). Checked
live: the new functions exist, `anon` can't call them, and a teacher's class gave 16 on the roster and 16 on the list.
- *After the site was published, James ran `20261028000600_drop_school_class_reports.sql` in the SQL Editor. It dropped the
  4 old whole-school reports, which the site no longer calls. Checked afterwards: only the class versions are left.*
- *Not live on purpose: `20261028000400` (Dragon Maths one season for the school). It waits for James's read-only check
  (DRAGON-SCHOOL-SEASON.md 2.3) and for teachers to be told the day before.*

**Stage 5: Merged hardest questions and alerts** on the class Maths and Today pages.

*Done 28 Oct 2026 on `claude/project-thread-4t7spr`. No migration: it reads the class reports that went live with stage 3.*
- *Contract: `teacher.hardest(classId)` gives `HardestRow`s (question in words, topic, asked, right, students) and
  `teacher.alerts(classId)` gives `TeacherAlert`s (one line, and where "See ›" goes). Gem Keep, Maths Monsters, Dragon Maths
  and Clan Quest give `hardest`; Maths Monsters and Dragon Maths give `alerts`. Each reads its own class report, and
  `src/teacher/shortCache.ts` shares one request when Today asks for both within a few seconds.*
- *Maths → Hardest questions (`/teacher/:classId/maths/hardest`, `src/teacher/Hardest.tsx`): every game's rows in one table,
  hardest first (lowest share right, then most asked), with a Game column and a Game filter. A game that can't load is named
  under the table. The old per-game tables stay in each game's Settings for now.*
- *Today: Needs you adds a line per student whose saves or requests a game turned down in the last 7 days ("Maths Monsters
  turned down 2 saves from Speedy Otter 27 this week", made-up names only), and "N students skipped 30% or more of their
  questions this week" (at least 5 questions; opens the roster sorted by Skipped). This week adds "Hardest right now" (the top
  three, with Maths ›).*
- *Not done: "students in no class" (admin) waits for the Admin page (stage 6). Alerts can't be dismissed; they drop off after
  7 days.*

**Stage 6: the Admin page.** In this order, each its own PR: Overview + Students + Teachers (moving what exists, plus
school-admin role); Classes; End of year checklist + `admin_log`; Safety (alerts across the school, player lookup);
School game settings (villages, Dragon dates, then the new defaults and copy-to-classes). Stage 0 already moves the
resets into an admin-only section, so nothing waits on this stage to be safe.

*Part 1 done 28 Oct 2026 on `claude/project-thread-4t7spr`: Overview, Students, Teachers. One migration,
`20261028000800_admin_pages.sql` (read only): `admin_overview()`, `admin_students()` and `admin_teachers()`, each
`require_school_admin()` and the admin's own school only (`supabase/tests/database/admin_pages.test.sql`, 33 checks, two
schools). The actions use the existing `school_set_admin` (refuses your own row, so the last admin can't remove themself),
`teacher_set_role` and the student page.*
- *`/teacher/admin` has sub-tabs Overview, Students, Teachers (`src/teacher/Admin.tsx`). Overview: "Needs an admin" (students
  not in a class, classes with no teacher, join requests waiting over a day) and the school's numbers, no names. Students:
  every student with class, last played and hidden, filters Everyone / Not in a class / Hidden / Not played for 30 days, Find,
  Hide real names; a name opens the student page in their own class. Teachers: classes, school admin, Make/Remove school
  admin and Remove teacher (with a confirm step), never on your own row.*
- *Not done yet: Make/Remove teacher also stays on the student page; ticked bulk actions (move, delete leavers) come with End
  of year. Next: Classes.*
- *Live 28 Oct 2026: the migration applied by hand and checked as a school admin, then the site published (PR #71).*

*Part 2 done 28 Oct 2026: Classes. One migration, `20261028000900_admin_classes.sql`: `admin_classes()` (read only: every class
with teachers, students, code and mode, last active) and `admin_create_class(name, year, level, teacher)` (wraps
`teacher_create_class`, then hands the class to the chosen teacher; a blank name is named after that teacher). Tested by
`supabase/tests/database/admin_classes.test.sql` (32 checks, two schools).*
- *Admin → Classes: Current / No teacher / Archived; each class links to its teacher area; add or take off teachers
  (`teacher_add_co_teacher`, `teacher_remove_co_teacher`), Archive / Unarchive (`teacher_archive_class`); "Make a class" for any
  teacher. Overview's "Classes with no teacher" links to it. Archived classes can't have their teachers changed until
  unarchived.*
- *Live 28 Oct 2026: the migration pasted into the SQL Editor by James and checked as a school admin, then the site published
  (PR #75). Next: End of year checklist + `admin_log`.*

*Part 3 done 28 Oct 2026: End of year. One migration, `20261028001000_admin_end_of_year.sql`: an `admin_log` table (no client
access) and `admin_year()`, `admin_mark_step()`, `admin_archive_classes()`, `admin_delete_leavers()` (only students in no class
or an archived class; type the number), `admin_new_points_season()` and `admin_clans_new_season()`. Each does its step and
writes the log in the same transaction, wrapping the existing functions. Tested by
`supabase/tests/database/admin_end_of_year.test.sql` (74 checks, two schools).*
- *Admin → End of year (`src/teacher/AdminYear.tsx`): a "New school year" box and six steps, each with "Last done … by …":
  next year's classes (mark done), archive last year's classes (ticked list), students who have left (tick, type the number,
  delete), new points season, Clan Quest fame season, Dragon Maths (a reminder until the one school date is live). History
  lists the last 20 steps.*
- *The points-season reset moved here from the Students page (James, 28 Oct 2026), which now links to it. The Clan Quest fame
  panel stays on Students for ordinary teachers' own classes.*

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

   *Decided by James, 28 Oct 2026:*
   - *Dragon Maths season dates: **one for the whole school**, set by a school admin. (Today each class saves its own
     `lord_season_start` in its settings row, and switching a class off pauses its season clock with `lord_paused_since`.)
     Dragon Maths moves to the Games table first with its dates working exactly as today; the one school date is then
     designed and shown to James before it is built, because it changes how seasons are worked out. Designed and agreed
     28 Oct: docs/DRAGON-SCHOOL-SEASON.md.*
   - *Clan Quest villages: **whole school, and any teacher can manage them** (as today). Raids stay per class. So the admin
     check on the village functions in section 6 is **not** added.*
3. Should non-admin teachers see the whole-school student list at all, or only their classes plus students in no class?
4. Is the Teacher page ever projected? (Decides whether real names start hidden.)
5. Admin page: are "defaults for new classes" and "copy settings to classes" wanted now, or later?
6. Should there be more than one school admin, and who can make one?

*Also decided by James, 28 Oct 2026:*
- *The PR that removes `TeacherPanels` also drops the four old no-argument class report functions
  (`teacher_gem_keep_class()`, `teacher_monster_class()`, `teacher_lord_class()`, `teacher_clan_maths_class()`) and the
  website's fallbacks to them. That migration is applied only after all four new class report migrations are live.*
- *`scripts/scratch-db.sh` is fixed in its own small PR, based on `main`: its copies leave out the `hub_games` rows and the
  achievement list (and what that list depends on), so about 20 unrelated database test files fail on them.*
