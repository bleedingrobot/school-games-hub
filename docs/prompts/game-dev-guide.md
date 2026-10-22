# Prompt: write the game development guide

Paste this into a new Claude session in the School Games Hub folder.

---

I want to build several new games for School Games Hub at the same time, each in
its own Claude session/window, and add each one to the site when it's finished
without the sessions clashing with each other or breaking the live site.

Please investigate the code (don't change it yet) and write
docs/GAME_DEVELOPMENT_GUIDE.md: a practical guide that a new Claude session can
follow to build a game on its own and get it live.

1. Look at how Clan Quest, Dragon Maths and Maths Monsters were actually built and
   went live: their folders, the shared/ rules code, server functions, database
   migrations, on/off switches, the games list/menu, and the go-live prompts in
   docs/prompts/. Copy what worked.

2. Find every place two game sessions would edit the same thing, especially:
   - database migration numbers (Clan Quest and maths-focus already clashed)
   - shared tables like progress and teacher_students
   - the functions build script (it rewrites other games' files)
   - the games list, routes and menu
   - CLAUDE.md, package.json, shared styles
   For each, give a simple rule that avoids the clash (e.g. a numbering scheme per
   game, or "only the merge step edits this file").

3. Maths questions are the most important shared system, so give them their own
   section in the guide. Trace how Gem Keep, Clan Quest and Dragon Maths actually do
   this today (shared/maths/, docs/MATHS-FOCUS-PLAN.md) and write down the one
   approved way a new game:
   - reads the student's maths focus (teacher / group / student / auto) and never
     works it out itself
   - gets its next question from the ladder (the skill pack and nextQuestion), and
     how it asks for easier/harder questions, multiple choice, or "focus only"
   - shows every kind of question the ladder can produce (typed answers, pick-one
     choices, the decimal key, fractions) so a new skill added to the ladder later
     just works in the game without changes
   - sends answers so the server marks them itself (key + numbers, never trusting
     the browser) and records them, so they count towards the student's progress,
     focus results and teacher screens
   - handles a student who hasn't done the placement warm-up yet
   - adds its own teacher settings page (the TeacherX pages) if it needs one
   Include a small worked example: "a new game asks 5 questions from the focus and
   saves the answers". Note that the training area deliberately keeps its own
   separate records and should not be copied for games.

4. In the guide include:
   - a short quick-start for a Claude session (read this first)
   - the folder layout for a new game and which files it may / may not touch
   - how a game gets the signed-in pupil and saves scores/progress (using what
     exists today; label anything new as PROPOSED)
   - how to run and test the game on its own before it's added
   - branch + worktree setup for a new game
   - a standard go-live routine (migrations, function deploy, merge, switch on,
     rollback), one step at a time
   - a short, risk-based "ready to go live" checklist

5. Also create:
   - docs/prompts/new-game-template.md: a copy-and-paste prompt I can use to start
     a new game in a fresh window
   - a one-line pointer to the guide in CLAUDE.md

6. Only describe things you've checked in the code. If something needs changing
   before parallel development really works, list those changes in order with a
   size estimate, and stop. Don't build them until I say so.

When you're done, tell me in plain words: what's ready now, what needs fixing
first, and anything I need to decide.
