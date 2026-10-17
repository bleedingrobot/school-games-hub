# Marble game: plan

A marble-rolling game for the hub, in the spirit of the 1984 arcade game *Marble Madness*: steer a marble down tilted, blocky, isometric tracks against the clock, without falling off the edge.
Written 16 October 2026 after searching GitHub for existing versions and reading the code on `main` (Stages 1–10 live, Stage 11 Gem Keep under way).
**Status: idea saved, not scheduled.** Nothing is built. Maths added to the plan 18 Oct 2026 (section 7, James picked all six ideas). Questions 3, 6 and 7 answered 18 Oct; 1, 2, 4 and 5 still open. When it's picked up, James answers the questions in section 12 first, then stage M.1 starts.

## The short version

- **We write our own game, not a copy.** Nothing on GitHub can be reused (section 1), and the name *Marble Madness*, its levels and its art belong to Atari. So: our own name, our own courses, our own hazards. The *feel* (isometric view, momentum, steep drops, beat the clock) isn't owned by anyone.
- **One rules-and-physics engine in `shared/marble/`**, pure TypeScript, no outside physics library. Same inputs in, same run out, on every device. That lets the server **replay a run to check the time** before saving it, just as it replays chess moves and space-game dice.
- **Drawn with three.js** (MIT licence), only loaded when someone opens the marble game, so the rest of the site doesn't get slower.
- **Modes:** solo time trials on 6 courses, race against a classmate's **ghost** (their recorded best run), and 2 players on one Chromebook (the original arcade game was 2-player at once).
- **Points:** small taking-part points and achievements, like the space game. Per-course "fastest this week" boards are an option for James (section 12).
- **Maths, in a way that fits a fast game:** you answer by rolling into the right tunnel (**answer gates** and **coordinate gates**), and the clock stops for **pit-stop** and **rescue** questions. There are also **number gems** to collect and a **guess your time** star. A right answer helps (a shortcut, a power-up, no fall penalty) and a wrong answer never hurts. It uses Maths Monsters' maths engine, with a teacher switch like space maths (section 7).
- **Cost:** one server call per finished run. A class playing a lesson a week adds roughly 1,500–3,000 calls a month, against the 500,000 free.

## 1. What's already on GitHub (searched 16 Oct 2026)

| Project | What it is | Can we use it? |
|---|---|---|
| ~25 repos named "Marble Madness" (Unity, C#, C++, Java student projects) | Class projects and clones | **No.** Almost none have a licence, which legally means "all rights reserved". Most aren't web games either |
| **Trackballs** (trackballs/trackballs, 59★, GPL-2.0) | Desktop marble game in C++, 187 levels | Not directly. Desktop C++, so it would be a full rewrite, and GPL rules would follow the code. Good for ideas only (hazard types, level pacing) |
| **CGmadness** (FLUXparticle/CGmadness, GPL-2.0) | Desktop Marble Madness clone in C++ | Same as Trackballs |
| **Marble Blast Web** (Vanilagy/MarbleBlast, 198★, MIT) | Web port of Marble Blast Gold/Platinum | The code is free to use, but it runs the original game's levels, art and sound, which belong to someone else. Also far bigger than we need |
| **Marbles-3D-Web-Painter** (gmarland, 11★, no licence) | three.js tool for building Marble Madness-style boards | No licence, so ideas only. Shows that three.js handles this style easily |
| Sites like "marble madness unblocked" | Copies of the real game | **No.** Copyright and trademark problems; not something to put on a school site |

**Conclusion:** writing our own is cleaner, legal, and fits the hub better (school sign-in, saving, points, server checking). It's also not a huge game: the original had 6 short courses.

## 2. What makes it fun (the bits to keep)

From the arcade original, in plain words:

- **Isometric view**: a tilted, diamond-shaped look at blocky tracks, like a model railway seen from above at an angle.
- **Momentum**: the marble speeds up downhill and keeps rolling. Steering is about nudging, not stopping dead.
- **Narrow paths and steep drops**: falling off the edge, or dropping too far, costs time (the marble is put back at the last checkpoint).
- **Beat the clock**: each course is short (30–90 seconds when played well).
- **Silly hazards** that push you around.

What we change for 8–10 year olds:

- **No "game over".** The arcade version ends when the clock runs out. Ours: the clock counts **up**, and you get a bronze, silver or gold medal for your time. Falling off costs a few seconds, never the whole run.
- **Checkpoints** halfway along longer courses.
- **Gentle first courses**, with wide paths and guard rails, so everyone finishes one in their first lesson.

## 3. Courses (our own)

Six to start, getting harder. Working names, all changeable:

| # | Course | Teaches | Hazards |
|---|---|---|---|
| 1 | **Warm-up Hill** | Steering, momentum | None. Wide path, rails |
| 2 | **Zig-Zag** | Turning at speed | Gaps without rails |
| 3 | **Bouncy Castle** | Bumpers, jump pads | Bumpers that push you |
| 4 | **Slippery Slope** | Ice (no grip) and mud (lots of grip) | Ice patches, mud |
| 5 | **The Factory** | Timing | Conveyor belts, moving platforms, sweeping arms |
| 6 | **Sky Run** | Everything | Narrow bridges, falling tiles, wind fans |

Later: a "course of the week", and maybe a level editor for students (section 11).

**Hazard ideas** (all our own, not the arcade characters): bumpers, jump pads, conveyor belts, moving platforms, sweeping arms, trapdoors, tiles that crumble after you roll over them, wind fans, ice, mud, a big slow "bowling ball" that rolls down the track, and one-way gates.

**Courses are data**: frozen literals in `shared/marble/courses.ts` (tile types and heights on a grid, plus hazards and their timing), like the space-game boards. Each course has a **reference run** in the tests that proves it can be finished and sets the gold time.

## 4. Physics: why our own, and how it stays the same everywhere

### Why not a physics library

Rapier (Apache-2.0) and cannon-es (MIT) are fine libraries, but:

- We need **exactly the same result** in Chrome on a Chromebook, Safari on an iPad, and Deno on the server, so the server can replay a run. That's hard to promise with a big general-purpose engine.
- Our world is simple: one ball rolling on a grid of flat tiles, slopes and ramps. That's a few hundred lines of code we control and can test.
- It keeps the download small (Rapier is a WebAssembly file of over 1 MB).

### How it works

- **Fixed steps**: the physics always moves forward 1/60 of a second at a time, whatever the screen is doing. The screen just draws the latest position. A slow Chromebook drawing 30 frames a second still gets the same physics.
- **Inputs are recorded each step**: one of 9 directions (8 plus "none"), with a "push harder" flag if we add one. A 60-second run is 3,600 steps; stored as "same input for N steps" runs, that's usually under 2 KB.
- **Only safe maths in the physics**: add, subtract, multiply, divide and square root give identical answers on every browser. `Math.sin`, `Math.cos` and friends can differ slightly between Chrome and Safari, so the physics never uses them (slopes are stored as ready-made numbers, and moving hazards follow tables or straight lines). The **drawing** code can use anything.
- **A test proves it**: the same recorded run gives a bit-for-bit identical finish in Node (V8) and in a real Safari engine via Playwright WebKit.

### What the physics covers

The ball (position, speed, spin for looks), gravity along the slope, rolling grip (normal, ice, mud), bumping into rails and walls, jumps and landing, falling too far ("ouch", back to checkpoint), going off the edge, and contact with each hazard.

## 5. On screen and controls

- **three.js 0.18x** (MIT), pinned to a version at least two weeks old when building. Orthographic (isometric) camera that follows the marble smoothly. Low-poly, flat colours in the Douglas Park look; the marble gets a shine and a shadow.
- **Lazy loaded**: the three.js code is its own download, fetched only on the marble pages.
- **Chromebook friendly**: screen resolution capped (pixel ratio 1.5 at most), no heavy lighting, simple shadows. If the device is slow, drop to 30 frames a second and simpler shading; the physics doesn't change.
- **Controls**:
  - Keyboard: arrow keys or WASD. Because the view is tilted, "up" means "up the screen", not "along the grid" (the engine turns it round).
  - Mouse or trackpad: hold and drag in the direction you want to roll (closest to the arcade trackball).
  - Touch (tablets): an on-screen thumb stick, left or right side.
  - Tilting the tablet: maybe later (iPads have to ask permission first, and it's hard to control in a classroom).
  - 2 players on one keyboard: WASD and arrow keys, two marbles.
- Pause button, Restart, Sound on/off, and "less motion" (no camera shake, gentler camera) following the student's device setting.

## 6. Modes

1. **Time trial (solo).** Pick a course, roll, get a time and a medal. Your best time per course is saved.
2. **Ghost race.** Race a see-through copy of a classmate's best run on that course (or your own best). Ghosts are just recorded runs played back, so this needs **no live connection**: cheap, and nobody waits for anyone.
3. **Two players, one Chromebook.** Both marbles on the same course, same screen. Not saved (two students on one account). Fun for wet lunchtimes.

Live racing between two devices is left out on purpose: it needs constant updates (expensive on the free plan) and laggy school wifi makes it feel unfair. Ghosts give most of the fun.

## 7. Maths (added 18 October 2026)

James asked for maths in this game, like Mission Control and Maths Monsters, and picked **all six ideas** below.

**The rule is the same as the space game: a right answer helps you, and a wrong answer never hurts you.** It also has to fit a fast game, so a question never pops up while you're rolling at speed. Questions come at calm moments (a checkpoint, a fall, before the run), or you answer one by **steering**.

### 7.1 The six maths moments

| Moment | When | Right answer | Wrong answer (or skip) |
|---|---|---|---|
| **Answer gates** | A sign over the track ("7 × 8 = ?") and the track splits into 2 or 3 tunnels marked with answers | The right tunnel's **shortcut door** is open: about 2–3 seconds saved | The longer way round. You don't fall off, you're just a bit slower |
| **Pit stop** | At a checkpoint. **The clock stops**, and a question card shows (Gem Keep's number pad, no timer, Skip button) | A power-up for the next section, picked by the course designer for what's coming: **Turbo** (a speed burst), **Sticky grip** (for ice), **Bubble shield** (one free fall), or **−2 seconds** | Carry on as normal |
| **Rescue** | You fall off. While the marble is carried back, **the clock stops** and a question shows | **No time lost** for that fall | The normal fall penalty (about 3 seconds) |
| **Number gems** | On courses 4–6. A sign at the start says "Collect multiples of 6" (or "pairs that make 100", etc.), and gems with numbers sit along the track | Each right gem: **−1 second** (5 at most a run) | You roll straight through it. Nothing happens, nothing is said |
| **Guess your time** | Before a run (optional): "How many seconds will this take you?" | Within 10% of your real time: a **star**. It never changes your time | Nothing. Your time shows next to your guess |
| **Coordinate gates** | Later courses: a letter-and-number grid on the floor and a sign saying "Roll through C4" | The tunnel at C4 is the shortcut, the same as an answer gate | The longer way round |

Notes:

- **Reading time.** A gate's sign appears at least 4 seconds before the split, on a gentle uphill or a mud patch that slows everyone down. There's also a **"Read time" setting**: the game pauses when a sign appears and waits (up to 10 seconds) until you press Go. The clock stops too, so it's fair. The pause is recorded in the run's inputs, so the server's replay sees it.
- **Not too much.** About 3–6 questions in a run: 1–3 gates, 1 pit stop on longer courses, rescues limited to 1 every 20 seconds (falling again and again doesn't become a quiz), plus gems and the time guess. **Course 1 (Warm-up Hill)** has just one gate on a wide, slow path, as a tutorial.
- **Rescue questions feel kind but come after a mistake.** They get their own switch (section 7.3), so a teacher can turn just these off if they feel like a telling-off.
- **Gems aren't recorded** in a student's maths records. Rolling through one by accident isn't a real answer. Gates, pit stops, rescues and coordinate gates are recorded.
- **Ghosts show only the path.** A classmate racing your ghost never sees your questions or which tunnel was right (each run has its own questions anyway).
- **Two players on one Chromebook:** questions are asked, but nothing is recorded, as with space pass-and-play.

### 7.2 How it works inside (stays replayable)

- **Gates are part of the course data.** Behind every tunnel there's a **shortcut door**, which is just a hazard that's open or shut. Which tunnel gets the right answer, and therefore which door opens, is decided at the start of the run. The doors never change mid-run, so the physics stays the same everywhere and the server can replay it. You "answer" by rolling into a tunnel: the replay knows which one you went through.
- **The server picks the questions.** When a run starts, `save-bot-game` hands out the stamped run id **and a list of about 10 questions** for that run. It uses the shared maths engine: the student's own records, the topics the teacher has on, and the student's level. It keeps them on the server (like `space_game_questions`), so the browser can't swap in an easy question. Gates take the next question on the list, and so do pit stops and rescues. The order of the right answer's tunnel comes from the run's seed.
- **When the run is saved**, the server replays it, checks every typed answer and every tunnel choice against its own question list, and then adds the answers to the student's maths records in one batch (sent twice, counted once). If the records can't be updated, the run is still saved.
- **Maths off:** gate signs show an **arrow** instead of a sum, and the shortcut is open for everyone. Pit stops, rescues and gems don't appear. That way maths-off runs aren't slower than maths-on runs where every answer is right.

### 7.3 Which maths, and the switches

- **The maths engine Maths Monsters is building** (`shared/maths/skillPacks/` on the `monsters` branch: times tables, adding and taking away, division, place value, fractions, decimals). The teacher's topic switches choose which packs are used. The question picker uses each student's records, so the facts they're still learning come up most.
- **New question kinds:** "multiples of" and "pairs that make" sets for the gems, and coordinates for coordinate gates. These go in a small new pack.
- **Teacher switch** on the Teacher page, like space maths: **Off / Students choose / On for everyone**, default *Students choose*. A separate **Rescue questions On/Off**, default **On** (James, 18 Oct). The server checks the switch at the start of every run.
- **Student chip** ("Maths: on/off") on the course picker when the teacher lets students choose, remembered on the device. The **Read time** setting sits next to it.

### 7.4 Medals, boards, points

- **Medal times** are set from each course's reference runs: **silver** is reachable with no shortcuts, and **gold** needs most of them (right answers with maths on, the arrow route with maths off).
- **Fastest-time boards:** maths changes your time, so maths-on and maths-off runs can't share one board. **Two boards per course** ("with maths" and "without"), as James decided on 18 Oct 2026.
- **No points for right answers** (same as space), so there's nothing to farm. **Achievements** (10 points each): **Gatekeeper** (10 right gates), **Pit crew** (10 right pit stops), **Rescued!** (5 rescues), **Gem collector** (collect every right gem on a course), **Good guesser** (5 time stars), **Map reader** (5 coordinate gates).
- **Privacy:** others only ever see good news, never a wrong answer. The privacy summary gets a line saying marble runs add to the maths records.

## 8. Saving, points and fairness

Same pattern as the space game, reusing `save-bot-game`:

1. **Start**: the page asks `save-bot-game` for `{game: "marble", start: true, course, maths}` and gets a **stamped run id** (HMAC, 12-hour life, tied to the student), like the space game's seed. With maths on, it also gets the run's **question list** (section 7.2), which the server keeps.
2. **Play**: entirely in the browser. Nothing is sent while playing.
3. **Finish**: the page sends the run id, course and recorded inputs. The server:
   - checks the stamp and that this run id hasn't been saved before (unique index),
   - **replays the inputs through `shared/marble`** and works out the real time itself (it never trusts the time the browser says),
   - checks the time isn't shorter than the time since the stamp was given out (stops "fast-forward" cheats),
   - with maths on, checks every typed answer and tunnel choice against its own question list, and adds them to the student's maths records (section 7.2),
   - saves the run, the time and the inputs (so it can be a ghost).
4. Replaying a 90-second run is about 5,400 small steps: a few milliseconds of server time.

**Points** (participation, like the space game; the game is `ranked: false` unless James wants fastest-time boards):

- 1 point for finishing a course, +1 for a new personal best, inside the shared 40-a-day bot-games cap; maybe 6 a day from this game.
- Achievements (about 8–10): finish every course, a gold on each course, finish without falling off, beat a classmate's ghost, 100 runs, and so on.

**New database bits** (one migration):

- `marble_runs` table: student, course, time, falls, inputs, run id (unique), maths on/off, time guess, created at.
- `marble_run_questions` table (students can't read it): each run's question list, as with `space_game_questions`.
- `app_settings.marble_maths` (Off / Students choose / On for everyone) and `app_settings.marble_rescue` (On/Off), with teacher-only functions to set them.
- `marble_bests` view or table: each student's best per course (for ghosts and medals).
- Row rules: a student reads their own runs plus classmates' **best runs only** (for ghosts); hidden students' runs are never shown. Writes only through the server function.
- Achievements added through the Stage 7 tables; tests added to `security.test.sql` by hand.

## 9. Testing

- Physics unit tests (slopes, rails, ice, landings, each hazard).
- Every course's reference run finishes, and its time is stable.
- Same run gives identical results in Node and WebKit (section 4).
- Server replay rejects a run whose inputs were edited, one with a faked time, and one saved twice.
- Maths: a run replays the same with maths on and off apart from the doors; a claimed right answer that's wrong is refused; a question not on the server's list is refused; the teacher's Off switch is obeyed by the server; "Read time" pauses replay the same; gems and 2-player runs add nothing to the records.
- Browser runs at Chromebook (1366×768) and tablet (768×1024) sizes with keyboard, mouse and touch, using the usual Playwright scripts.
- A frame-rate check on a throttled CPU, to make sure slow Chromebooks are playable.
- A private claude.ai preview for James's phone after M.2, like the space game.

## 10. Stages (when picked up)

| Stage | What | Rough size |
|---|---|---|
| **M.1** | `shared/marble/` engine: tiles, physics, inputs, replay, 2 test courses, determinism tests | Biggest piece |
| **M.2** | Game screen: three.js drawing, camera, controls (keys, mouse, touch), timer, medals, sound. Phone preview for James | Big |
| **M.3** | The 6 courses, hazards, checkpoints, reference runs and medal times | Medium (mostly design and tuning) |
| **M.4** | Saving: stamp, server replay, migration, points, achievements, best times | Medium |
| **M.5** | Ghost races and 2-players-one-keyboard | Medium |
| **M.6** | Maths 1: teacher and student switches, server question list, **answer gates**, **pit stops**, Read time, records. Needs Maths Monsters' maths packs on `main` | Medium |
| **M.7** | Maths 2: **rescue questions**, **number gems** (new "multiples of" / "pairs that make" pack), **guess your time**, **coordinate gates**, maths achievements, with-maths / without-maths boards | Medium |
| **M.8** | How to play (including maths), accessibility pass, slow-Chromebook check, privacy summary, docs, go live | Small |

Each stage ends with tests passing and a short results section here, like the other plans.

## 11. Ideas for later

- Student level editor (build a course, share it with the class by code, the teacher approves it first).
- Course of the week.
- Marble skins earned with achievements (fits the avatar maker).
- Tilt controls on tablets.

## 12. Questions for James (before M.1)

1. **Name?** Some ideas: *Marble Rush*, *Roll Out!*, *Tumble Run*, *Marble Mayhem*. (Not *Marble Madness*, which is Atari's.)
2. **Clock**: count up with medals and no game over (my pick for this age), or the arcade-style countdown as an extra "hard mode"?
3. **Answered 18 Oct: yes** (follows from question 6). **Fastest-time boards**: show a per-course "fastest this week" list for the class? It's skill, not luck, so it's fair, but it makes the game `ranked`. My pick: yes, top 10 plus "you", like the other boards, with no rating or rank badge.
4. **Theme**: plain colourful blocks (my pick, simplest and clearest), or a theme such as space (to match Wormholes & Black Holes) or New Zealand landscapes?
5. **Where it goes in the queue**: after Gem Keep (Stage 11), and before or after Power Clash? Its maths stages (M.6–M.7) need Maths Monsters live first, as Dragon Maths does.
6. **Answered 18 Oct: yes, two boards per course.** **Fastest-time boards with maths**: maths changes your time, so my pick is two boards per course ("with maths" and "without"). Or show boards only when maths is on for everyone, or make maths give power-ups that never change your time (fairer, less exciting).
7. **Answered 18 Oct: on by default.** **Rescue questions**: on by default (my pick), or off by default and the teacher turns them on?
