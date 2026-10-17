# Mission Control maths: plan

*Times-table questions in Wormholes & Black Holes, with an on/off switch. Written 17 October 2026 for James.*

**Status: approved by James on 17 October 2026: "go with your suggestions" (every answer in section 9 is the suggestion). M.1, M.2 and M.3 done (section 10). Change from the plan (17 Oct, James's idea): the Mission Boost button is replaced by a question after your turn that charges your next roll (section 11).**

## 1. The idea in one paragraph

At the most exciting moments of a space game (flying into a wormhole, falling into a black hole) and right after your own turn, Mission Control radios a times-table question. **A right answer helps you. A wrong answer never hurts you:** you just move the normal way. It reuses Gem Keep's question engine and records, so the facts a student needs come up more often, and the teacher's 12 × 12 grid fills in from both games. It can be switched off by the teacher for everyone, and (if the teacher allows) by each student for their own games.

## 2. The three maths moments

| Moment | When | Right answer | Wrong answer (or no answer) |
|---|---|---|---|
| **Wormhole boost** | You land on a wormhole's mouth | You fly through and **3 squares further** (unless that lands on another wormhole or black hole: then just the normal exit) | You fly through as normal |
| **Black hole escape** | You land on a black hole | You fall only **half as far**, like an escape pod, without using one | You fall as normal. If you have an escape pod, it's used now, as it is today |
| **Charge question** *(replaced the Mission Boost, section 11)* | A question on a side card as soon as your turn ends; answer it while others play | A right answer gives **+1** on your next roll | Nothing happens, and nobody else sees it |

Notes:

- A **force field** still blocks a black hole completely, so no question is asked.
- The wormhole boost is already in the game engine, waiting behind the "maths" setting (built with the game, never switched on). The black hole and booster are new.
- Each board has about 7 wormholes and 6–7 black holes, so a game asks roughly **3–6 questions per player**, plus the booster. The first stage measures this with the simulator and checks games don't get much longer (target: less than a minute extra for a 4-rocket game).
- **Bots answer too**, so maths doesn't simply make students beat bots. Cadet gets about 60% right, Pilot 75% and Commander 90%, decided by the game's seed so the server can replay it.

## 3. Switching it on and off

Two switches, so it's toggleable at both levels:

1. **Teacher switch** (Teacher page, school-wide, like emoji reactions). Three settings:
   - **Off**: no maths in space games for anyone. The game is exactly as it is now.
   - **Students choose**: a **Mission Control maths** on/off chip appears in the space game's settings.
   - **On for everyone**: maths is always on, with no chip.
2. **Student chip** (only with "Students choose"): in Settings, next to Classic/Cosmic. It's remembered on their device, like the other space settings.

Against classmates, the **host's** setting is used for the whole game, and the waiting room shows "Mission Control maths: on" so everyone knows before it starts.

## 4. Which questions

- **Times tables only** (multiplication, plus missing-number and division if the teacher has those on in the Gem Keep settings). The engine already exists, so this is the quickest. Other Year 4–6 maths (adding, doubling and halving) can be added later as new "skill packs" without changing the game.
- **Which tables:** the teacher's "times tables on" list from the Gem Keep settings applies here too. Within that, the question picker uses the student's own records, so the facts they're still learning come up most. A student who has never played Gem Keep starts on ×2, ×5 and ×10, and moves on as those become secure.
- **Answering:** the same number pad and question card as Gem Keep (typing or tapping, with multiple choice if the teacher has that on). Against bots and in pass-and-play there's no timer. Against classmates there's **20 seconds**; running out counts as "no answer" (you move normally, and it isn't recorded as wrong).

## 5. Privacy and kindness

- **Classmates never see your question or whether you got it wrong.** They only see the good news ("Brave Kiwi 7 powered up the wormhole! 🚀") or the normal move. No "wrong" message ever goes to anyone else's screen.
- Answers go into the same times-table records as Gem Keep (already in the privacy summary). The summary gets one line saying space games add to them.
- **Pass-and-play:** questions are asked, but nothing is recorded, because anyone could be holding the device.

## 6. Cheating and saving

- **Against bots:** the server already replays every bot game from its seed. The saved game will also carry each question and the answer typed, and the server checks every "right" really was right before saving. Space games only earn taking-part points (the same win or lose), so faking maths gains nothing anyway.
- **Against classmates:** the server picks the question and marks the answer itself (in the `space-game` function), so nothing can be faked.
- **One fix needed first:** today Gem Keep saves a student's records as "here are my totals now", and the server keeps whichever copy has more answers. With two games adding answers, a copy loaded earlier in one game could miss answers from the other. So both games will send **each answer** ("7 × 8, right, 3.2 seconds") instead, and the server adds them up. Old saves still waiting on a device are still accepted.

## 7. Points and achievements

- **No extra points for right answers.** Space points stay the same (taking part), so the game stays fair for students who find maths hard, and there's nothing to farm.
- **Three new space achievements** (10 points each, like the others): **Mission Control** (10 right answers in space games), **Wormhole booster** (power up a wormhole), **Great escape** (escape half a black hole with maths).
- The How points work page gets a line about them.

## 8. Stages (stop for James after each)

1. **M.1 Shared answers:** the "send each answer" saving format for both games; the server adds answers to the records. Gem Keep switches over (no visible change).
2. **M.2 Game rules:** black hole escape and booster in the engine; the "maths" setting becomes on/off plus the booster; bots answer at their level; simulator check of game length and fairness with maths on and off.
3. **M.3 Against bots and pass-and-play:** the settings chip, the question card in the game, saving and checking answers, records for the signed-in student.
4. **M.4 Against classmates:** server-picked questions with the 20-second timer, the waiting-room line, only good news shown to others.
5. **M.5 Teacher switch and finishing:** the three-way teacher switch, achievements, How points work, the How to play guide, privacy summary, accessibility check (keyboard, screen reader, phone and Chromebook sizes).
6. **Go live** (James's yes): one database change, deploy `save-bot-game`, `space-game` and `gem-keep`, then merge.

Rough size: a bit smaller than Gem Keep Phase 5. M.1–M.3 can be tried in a private preview link before anything goes live.

## 9. Questions for James (my suggestion first)

1. **The three moments:** all three (wormhole boost, black hole escape, booster)? *Suggestion: yes.*
2. **Teacher switch to start with:** Off, Students choose, or On for everyone? *Suggestion: Students choose.*
3. **Student chip:** on or off the first time a student opens settings? *Suggestion: on (they can switch it off).*
4. **Classmates timer:** 20 seconds? *Suggestion: yes.*
5. **Bots answering:** 60/75/90% right for Cadet/Pilot/Commander? *Suggestion: yes.*
6. **Booster:** +2 on the roll, charging every 3 turns? *Suggestion: yes. Easy to change after a class tries it.*
7. **Show "Brave Kiwi 7 powered up the wormhole!" to classmates** (good news only)? *Suggestion: yes.*

## 10. Results so far

**M.1 Shared answers (17 Oct 2026).** Gem Keep now sends each answer (fact, right or wrong, time, when) in batches with their own id. The new database function `record_fact_answers()` (migration `20261017001200_fact_answers.sql`) adds them to the records in order, by the same rules as `shared/maths/leitner.ts` (a database test walks one fact through every rule with the numbers worked out by the game's own code). A batch sent twice counts once; batch ids are forgotten after 30 days or at a new season. Answers quicker than a quarter of a second are left out. Old "whole records" saves waiting on a device are still accepted. Checked in the browser on the local copy: 13 answers in a level and its Level Key all reached the records, offline answers too.

**M.2 Game rules (17 Oct 2026).** In `shared/space/engine.ts` with maths on:

- Wormhole: right = 3 squares further (as built before). Black hole: right = fall half as far (keeps your Escape Pod); wrong = as before (the Escape Pod works if you have one). A Force Field still blocks it with no question. A timeout counts as wrong.
- Mission Boost: a new action, before rolling, once charged (it starts charged). Right = +2 on this roll. Wrong = normal roll. Either way it's used up.
- Bots: Cadet answers right 60% of the time, Pilot 75%, Commander 90%. Pilot and Commander always take a charged boost, the Cadet half the time.
- With maths off nothing changes: no question or boost can happen (tests check this), and the bots only use their dice for maths when it's on, so they make the same moves as before and games already being played aren't affected.

**Simulator (1,000 games a setting, bots at Pilot, Cosmic mode).** Minutes are the simulator's estimate, counting each question as 10 seconds.

| Nebula | Off | Maths on, boost every 3 turns | Maths on, boost every 5 turns |
|---|---|---|---|
| 4 rockets: minutes | 6.6 | 9.0 | 8.1 |
| 2 rockets: minutes | 3.9 | 5.4 | 4.9 |

Every board showed the same pattern: about +3 minutes for 4 rockets with the boost every 3 turns (Inner Solar System 6.8 → 9.7, Deep Space 6.2 → 9.3, Asteroid Belt 4.0 → 5.7). Most of the extra questions were boosts, so **the boost now charges every 5 turns** (one number, `BOOST_CHARGE_TURNS`). That adds about 1½ minutes to a 4-rocket game. Games take fewer turns with maths on, because right answers move rockets further, but each question takes time.

**How much knowing your tables helps** (one rocket that always or never answers right, against Pilots, boost every 5 turns, Nebula):

| | Fair share | Always right | Never right |
|---|---|---|---|
| 4 rockets: wins | 25% | 29% | 18% |
| 2 rockets: wins | 50% | 57% | 37% |

So maths matters, but luck still matters more: a student who gets everything wrong still wins about 1 game in 5 of 4-rocket games. Wrong answers never move you back; the gap comes from everyone else's right answers.



**M.3 Playing bots and pass-and-play (17 Oct 2026).** In the game screen (not live: the teacher's switch is M.5, and until then only a local development build can turn maths on, with `?maths=choose` or `?maths=on`; the stand-alone phone preview has it on):

- **Settings:** a "Mission Control maths" On/Off chip (when the teacher lets students choose, remembered on the device) or a line saying maths is on (when it's on for everyone). Nothing shows when it's off.
- **The question card** is the one from Gem Keep, with the title "Wormhole boost", "Black hole escape" or "Mission Boost" and a line saying what a right answer does. No timer against bots. Right gets a sparkle and a pause; wrong shows the whole fact for 2 seconds and nothing else happens to you.
- **Which facts:** from the student's own records (the same ones Gem Keep uses), at the step they're ready for: a new student gets ×2, ×5 and ×10, and moves up a step when 70% of that step's facts are secure (`readyLevel`). The teacher's Gem Keep settings (tables on, division, missing-number, multiple choice) apply here too.
- **Mission Boost button** with "Charging: turn 3 of 5" and "Ready!" under the dice. Keyboard: B.
- **Log lines and animations** for every case. A wrong answer at a wormhole reads as a normal wormhole ride, with nothing said about the answer.
- **Saving:** the game's report now carries each question (as it was shown), the number typed, and the time. The server replays the game and checks that every right/wrong choice matches the typed answer, and that no answer is missing or extra, before saving the game. It then adds the checked answers to the times-table records (one batch per game, so a game sent twice counts once). If the records can't be updated the game is still saved. Wormhole achievements count rides made with maths on too.
- **Pass-and-play:** questions are asked from a fresh set each game; nothing is recorded or saved.
- **Classmates games** still refuse maths until M.4.

**Checked in a real browser** against the local copy, signed in as a test student, playing whole saved games on two boards with maths on: the games saved with maths on and points earned, and every answer given reached the student's records (3 answers, 2 right, in the longer game). The log showed boosts, powered-up wormholes and a black hole beaten. 5 new game-screen tests, 3 new server tests, tests for the answer checker and the ready-level helper.

**Change after trying the preview (17 Oct 2026).** James found no questions in a short test: the boost took 5 turns to charge and wormholes/black holes only ask when you land on one (about 3 questions a game). The Mission Boost is now **ready on everyone's first turn** (then recharges over 5 turns), so the feature shows up straight away. Simulator (500 games, Nebula, Pilots): 4 rockets about 8.7 minutes, 2 rockets 5.2 (off: 6.6 and 3.9).

Next: M.4 (maths in games with classmates).

## 11. Change: the question after your turn replaces the Mission Boost (17 Oct 2026)

James's idea, approved: instead of a Mission Boost button, a question appears on a small side card the moment your turn ends, and you answer it while the others take their turns. **Right = +1 on your next roll. Wrong or skipped = nothing.** The wormhole and black hole questions stay as they were.

- **Rules** (`shared/space/engine.ts`): a new action `charge` (`right: true/false`), sent at the start of your next turn before you roll, once a turn, only after you've finished a turn (the first turn has none). Right adds +1 (`MATHS_CHARGE_STEPS`) to that one roll. The boost action, its charge counter and its constants are gone. Bots answer it every turn at their level (60/75/90%), so they get the +1 too. With maths off nothing changes (a test checks that).
- **Screen** (`SpaceSolo.tsx`): the question is a card in the side column (the same question picker, records and teacher settings as before), not a pop-up. No timer, with a Skip button. It stays until answered or until you roll. Answered, it's sent for you when your next turn starts, and that turn shows "⚡ +1 charged from your answer". A wrong answer shows the right fact to the student for 2 seconds and says nothing after. Pass-and-play has no side card. The old B shortcut is gone.
- **Saving:** a `charge` action is saved as `charge:1` or `charge:0`, and its answer goes in the report's answers list in order, like the others. The server checks the typed answer matches the right/wrong sent, then adds it to the records. An answer given after the last turn of a game has no next turn to carry it, so it isn't sent.
- **Others see only good news:** the log says "<name> is charged up: +1 on this roll!" for a right answer and nothing for a wrong one.

**Simulator** (500 games, Nebula, Cosmic, Pilot bots). Minutes count the charge question as free (it's answered while others move):

| | Off | Maths on |
|---|---|---|
| 4 rockets: rounds / turns | 15.1 / 57.9 | 12.6 / 47.7 (17% fewer) |
| 4 rockets: minutes | 6.6 | 6.5 |
| 2 rockets: rounds / turns | 17.8 / 34.1 | 14.8 / 28.0 (18% fewer) |
| 2 rockets: minutes | 3.9 | 3.9 |

So games are about **a sixth shorter in turns**, a bit more than the tenth we guessed (every bot gets +1 on 60–90% of its rolls, and the wormhole and black hole rights add to that). A game has about 12 charge questions per rocket (one per turn). If each of a student's questions held the game up by 10 seconds, that would add about 2 minutes to a 4-rocket game; the card is built so it doesn't (you answer while others play).

**Fairness:** with maths on, 4-rocket wins by seat were 26% / 25% / 25% / 24%; 2-rocket 51% / 49%. The first rocket always right against Pilots won 28% (4 rockets) and 52% (2); never right won 14% and 32%. Knowing your tables helps, and luck still matters: a student who gets everything wrong still wins about 1 game in 7 against 3 bots.

**Checked:** 111 game-rule tests, the game-screen tests (full games with maths on, saved reports checked by the server's own code), the server's save tests, and a real browser (phone and desktop sizes): the card appears after your turn, answering it shows "Right! +1 is ready", and your next turn shows "+1 charged from your answer".

Next: M.4 (maths in games with classmates).
