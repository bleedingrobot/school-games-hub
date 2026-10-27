# Clan Quest: making fights feel better (plan, 27 October 2026)

*A session builds it a stage at a time, on branch `clans-fight-feel`, and merges only on James's word.*

**James decided (27 Oct 2026):**
- After a round plays out, it **waits for Enter**. The point is that children **see clearly what happened**, so they feel part of the fight.
- About **3 seconds** of playback per round (Enter or a tap skips).
- **"BIG HIT!"** at **30%** of the target's full HP.
- **Sound later**, off by default.
- **Art: a mix.** Bigger effects (spell bursts, a victory banner, the "Beaten!" stamp) are painted in ComfyUI on James's PC in the game's painted style (process in `docs/CLANS-ART-PLAN.md`, "If a picture needs remaking"); small things (numbers, shakes, glows) are CSS.

## What happens now

A round plays **all at once**. When you press Enter on the plan, `playRound` in `shared/clans/fight.ts` runs every hit, miss, spell and knock-out in one go. The fight log fills with eight or so lines, the HP bars jump (a quarter-second slide), and **straight away** the next Battle Cry question appears. In a ladder fight it's a box that covers the screen. So:

- you never *see* a hit land: it's a line of text in a scrolling log;
- a big hit and a tiny one look the same;
- a monster being beaten is just its picture going grey;
- the question arrives before you've taken in what happened.

The good news: the engine already records everything we need, in order, in `fight.log` (who hit whom, for how much, spells, knock-outs, the Battle Cry). The screen can **replay that list** with effects. That's display only: the rules, the server and the maths don't change, so it can't make fights easier or harder.

## Suggestions

### 1. Play the round out, one action at a time (the big one)

After Enter, the screen steps through the round's log, about **a third of a second per action**:

- the attacker steps forward (a small nudge towards the other side);
- the target **flashes and shakes**, and a **damage number floats up** above it ("-7");
- its HP bar drains;
- the matching log line lights up as it happens.

A round of 8 actions takes about **3 seconds**. **Press Enter or tap to skip** to the end, so impatient players lose nothing. A whole round is capped at about 4 seconds however much happens.

### 2. A breath before the question

When the round has played out, show a one-line **round summary** in the panel for a moment:

> **Round 2:** you did 34 damage and took 9. **Goblin A is beaten!**

Then the Battle Cry question appears **in the panel**, with the fighters still visible above it. In ladder fights the question box opens only *after* the playback, never on top of it.

**Decided:** it waits for Enter ("Next round").

### 3. Make big moments big

Every effect is driven by numbers the engine already has:

| Moment | How we spot it | What you see |
|---|---|---|
| **Big hit** | damage is 30% or more of the target's full HP | bigger, gold number with "BIG HIT!", a stronger shake, a tiny screen bump |
| **Knock-out blow** | the target drops to 0 | the monster topples and fades; a "Beaten!" stamp; the gold it drops pops up |
| **Battle Cry** | the round's `cry` event | the whole clan glows; damage numbers have a little flame for that round; healing shows green "+N" on everyone |
| **Spells** | `cast` events, by spell kind | a coloured burst: orange for fire, blue-white for lightning, green sparkles for heals, a rope for Ropes and Magic Chains |
| **Miss** | `miss` event | a grey "miss!" and the target leans aside |
| **Close call** | a clan member left under 20% HP | their card pulses red for a moment |
| **Clan member knocked out** | `down` on our side | they sit down gently ("resting"): soft, not scary |
| **Win** | `result = 'won'` | a short victory flourish over the arena before "See how everyone did" |

Keep it gentle and short. No blood or gore (the game's rule); stars, sparkles and bonks.

### 4. Numbers you can follow

- Floating numbers in **colours with words or signs**, never colour alone: "-12" for damage, "+8" for healing, "miss!".
- The HP bar shows a pale "ghost" of what was just lost before it drains, so you can see how big the chunk was.
- A **"Your best hit today"** line on the fight-over screen, which children love to beat. It's display only: work it out from the fight's log.

### 5. Sound (later, optional)

A soft bonk, a whoosh for spells and a chime for a win, **off by default**. Classrooms! A speaker button on the fight screen would turn it on. Only worth doing if James wants it.

## Must-haves for every stage

- **Reduced motion:** with `prefers-reduced-motion` on, nothing moves or shakes. The numbers still appear and the log line still lights up, and the round summary still shows.
- **Screen readers:** the log stays the polite live region. The summary line is read out, and the floating numbers are hidden from screen readers (the log already says it).
- **Keyboard:** Enter/tap skips playback; focus moves to the question or plan exactly as now.
- **Slow Chromebooks:** CSS animations only (transform and opacity), no canvas. Check it stays smooth at 1366 x 640 with the CPU slowed.
- **Nothing changes in the rules or on the server.** The orders and Battle Cry answers sent are exactly the same; tests check this.
- Fights must not feel *slower* overall: skipping playback is always one key.

## Suggested stages

1. **Stage 1: pacing.** Round playback (suggestion 1, with floating numbers and shake for every hit), the round summary, and the question waiting until playback ends (suggestion 2). This is the biggest change in how a fight feels.
2. **Stage 2: big moments.** Big hits, knock-out topple and "Beaten!", Battle Cry glow, spell bursts, close calls, the win flourish (suggestion 3).
3. **Stage 3: polish.** Ghost HP chunk, best hit of the day, any tuning from what James and the class say (suggestion 4).
4. **Maybe later:** sound (suggestion 5).

Each stage: build on its own branch, try it in the Clans preview, share a test page with James, and merge only on his word.

## Questions for James

All answered (see the top).

## Stage 1 results (27 Oct 2026): pacing

Built on `clans-fight-feel`. Display only: the orders and Battle Cry answers sent are exactly as before, and the server is untouched.

- **Each round plays out one action at a time** (`src/games/clans/playback.ts` turns the round's log into steps; `Fight.tsx` shows them). The one acting is outlined and steps towards the other side (sideways on wide screens, up and down on phones); whoever it lands on is outlined, shakes and flashes, and a number floats up over them: "-7" (pink), "+8" (green), "miss!" or "shrugs it off" (grey). HP bars drain as it happens, the log gets each line as it happens, and the newest line is lit. About a third of a second an action, never much more than 4 seconds a round. A number stays for its whole rise (about 1 second), even as the next actions start.
- **Enter, Space, the Skip button or a tap on the fighters** shows the rest of the round at once.
- **A summary waits for Enter**: "Round 2: you did 34 damage and took 9. You healed 8. Goblin A is beaten! Ash is resting." with a **Next round** button. Only then does the next Battle Cry question (or ladder question box) come. When a round ends the fight, the summary sits above "The enemies are beaten".
- **Knock-outs come after the hit that caused them** (the engine logs them just before). The log rebuilt after a refresh uses the same order.
- **Reduced motion**: nothing moves, shakes or flashes; the newest number just appears. **Screen readers**: the log is still the polite live region, the summary is a status line, and the numbers are hidden from them.
- **Tests**: `playback.test.ts` (the steps end on exactly the engine's HP for every round of 80 fights, with heals, spells and both Battle Cries; numbers, attacker and target; the summary; knock-out order; the timing), and two screen tests in `FightPlan.test.tsx` (plays out, Skip, the summary waits, Enter goes on; the log ends the same). Tests that click through fights now also press Skip and Next round. All 5,041 tests, the type check and the build pass.
- **Checked in the preview** at 1366 x 640 and phone width: numbers sit on the right fighter, no sideways scrolling.
- **Not done yet** (stage 2): big hits, the knock-out topple and "Beaten!" stamp, Battle Cry glow, spell bursts, close calls and the win flourish. The painted pictures for those come from ComfyUI (reachable on 27 Oct).

## Stage 2 results (27 Oct 2026): big moments

Built on `clans-fight-feel`, on top of stage 1. Still display only: nothing sent to the server changes.

- **Big hits** (30% or more of the target's full HP): a gold "BIG HIT! -12", a painted gold burst, a stronger shake, and a small bump of the whole arena. In the first mines, where monsters have about 10 HP, most killing blows are big hits; raise `BIG_HIT` in `playback.ts` if that feels like too many.
- **Knock-outs**: a beaten monster topples over and greys out, and a gold **"Beaten!"** stamp lands on it (it replaces the old "gone" tag). The knock-out is part of the hit that caused it, in the log line too ("… for 11. Rock Pal crumbles away!"), and the log rebuilt after a refresh matches. A knocked-out member sits down gently ("resting", as before).
- **Spells**: a painted burst over the target: fire (Fireball, Fire Breath, Dragon's Uppercut), lightning (Lightning Bolt, Thunder Rain), healing (every heal, and the Battle Cry's heal), a gold impact (Light Blow, Heavy Blow and the other single-target strikes), and arcane magic (Wither, Ropes, buffs and the rest).
- **Battle Cry**: the clan's side glows gold (more damage) or green (healing) while the round plays, and the clan's damage numbers glow orange.
- **Misses** lean aside instead of shaking. **Close calls**: a member left under 20% HP gets a red pulse.
- **Winning**: the painted gold crest and "Victory!" over the fighters for about 2 seconds, above "The enemies are beaten".
- A beaten fighter's picture, name and bar fade; its burst, number and stamp stay bright.
- **Not done**: the gold each monster drops (the engine only keeps the fight's total, which the end screen already shows).

**The paintings** (`src/games/clans/art/fx/`, 6 files, about 190 KB in all, each optional: without one, the burst is a CSS glow). Made with `scripts/clans-fx-art.py` in ComfyUI on James's PC (the same Z-Image Turbo graph as every Clans painting), painted glowing on plain black; tidying turns the black see-through (brightness becomes solidness) with a soft round edge, so they sit cleanly on any background. Three tries each; picks in `docs/clans-art/fx-picks.json`: fire 1, lightning 3, impact 3, victory 1, heal 5 and magic 6. The first heals looked like a mushroom cloud, so heal was reworded as a gentle swirl of fireflies; the first magic had letter-like runes, so "runes" became "swirl patterns" (tries 4 and 5 of magic and try 4 of heal came out with a white border). Seeds are fixed, so any try can be painted again exactly. All six checked for children.

**Tests**: `playback.test.ts` (big hits match the 30% rule; every knock-out the engine logged is on a step; close calls are under 20%; each spell's light), the art test now knows the `fx` folder (every effect there, each under 60 KB), and the round test checks beaten enemies show "Beaten!". All 5,045 tests, the type check and the build pass. Checked in the preview at 1366 x 640 and phone width (no sideways scrolling).

## Stage 3 results (27 Oct 2026): polish

Built on `clans-fight-feel`, on top of stages 1 and 2 (same pull request). Still display only.

- **Ghost HP chunk**: every HP bar in a fight has a pale copy behind it (`Bar`'s new `ghost` option). When HP drops, the green drains straight away and the pale chunk follows about half a second later, so you can see how big the hit was. Healing fills over it. With reduced motion there's no ghost (both move at once). Other screens' bars are unchanged.
- **Best hit**: the end of a fight says "Best hit: Hugo's Light Blow hit Scruffy Dog A for 7." (worked out from the fight's log: hits and damage spells by the clan). If it beats the clan's best of the game day, it adds "★ Your best hit today!"; otherwise "Your best today is still 18 (…)". The day's best is kept on this device only (browser storage, keyed by clan name and game day): it's just for fun, nothing counts it, and with storage blocked it just isn't remembered.
- **Tests**: `bestHit` (hits and damage spells, never heals or the enemies'), and the won-fight test checks the line, the new best and that it's remembered. All 5,046 tests, the type check and the build pass.
- **Checked in the preview**: the best-hit line, and the ghost's look (set by hand mid-drain). The drain timing couldn't be watched there because the browser pane was hidden, which pauses transitions; it's a plain CSS transition.
- **Not done**: sound (later, off by default, per James).

## Went live (27 Oct 2026)

Stages 1 to 3 went live on 27 Oct 2026 (afternoon, NZ time). Brought up to date with that day's `main` (which had the typed hero names, PR #45), then the type check, all 5,099 tests and the site build passed again. PR #44 merged. Its own "Test and publish" run failed before publishing: the database tests couldn't download their Docker images ("Data limit exceeded" from Docker Hub), and a rerun hit the same limit. The next run, for PR #46, passed every step and published the site with the fight upgrade in it; the live Clan Quest code was checked for the new fight screen. No migration and no function deploy. **Still to do:** James tries a fight on a real screen (the playback timing couldn't be watched in Claude's hidden browser pane), and sound, later and off by default.
