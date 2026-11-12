# Plan: finish Toon Flap, berry friends eating, Star Forge plan looks

*Written 12 Nov 2026 for James's three picks from the "what's next" list. Work runs in this order: quick wins first, the
long build last. Each stage is its own PR and goes live on its own (Site checks + Database checks green).*

## A. Star Forge: planned rings and technology get their own look (cloud only, no art) — DONE 12 Nov 2026

PR #429 made planned suns, planets and moons show their own painted map with a light blue scan. Rings, the ring world,
belts, comets, life and every technology piece still draw as the same plain blue hologram.

| Stage | What |
|---|---|
| A1 | **Rings and the ring world**: a planned ring shows its own ring picture (dusty / icy / crystal colours) faded, with the blue scan lines across it; the ring world band shows its own surface picture the same way. |
| A2 | **Technology**: each planned piece (elevator, domes, terraformer, orbital ring, engine; lanes, sails, miners, star gate, Dyson ring) keeps its own built colours and shape, see-through with the scan, so a planned engine still looks like an engine. One shared helper `planLook(material)` instead of swapping in the blue hologram. |
| A3 | **Belts, comets, life**: belts keep their rock colours, comet heads their white glow, planned life its own colour on the map, all with the scan. Check with the viewer preview's "All plans" system on laptop and iPad sizes; go live. |

## B. Tūī's Ten Tree: eating pictures for the four friends (gaming PC)

Only Tūī has an eat pose; Kererū, Pīwakawaka, Korimako and Kākā sit while the ten berries are eaten (PR #438).

| Stage | What |
|---|---|
| B1 | Add an `eat` pose to the friends in `scripts/tui-art.py` (pecking one orange berry, same Beanstalk clay words). A Remote Control session on the Mac paints 4 tries each on ComfyUI and saves them straight into the repo checkout; this thread picks the best (repaints weak ones), `tidy` cuts them out. |
| B2 | `friendArt` uses `<friend>-eat` while the ten is eaten (falls back to sit). Test, go live. |

## C. Toon Flap F.6: the last painted pieces (gaming PC, same session as B1)

Almost all F.6 art is live (PR #384, #387). Still missing:

| Stage | What |
|---|---|
| C1 | The **Rainbow stars** trail (the gold-on-every-level trail draws a stand-in) and the **wings-up pose** for the 10 level flyers (they tilt their glide picture today). Paint, pick, tidy into `src/games/toonflap/art/`, go live. Mark F.6 done in the plan. |

## D. Toon Flap F.7: Sky Dash and its board — DONE 12 Nov 2026 (score is walls flown past)

The classic one-touch version, opens after level 5 (plan section 9).

| Stage | What |
|---|---|
| D1 | **Rules** in `shared/toonflap/dash.ts`: an endless course from a seed (walls get closer and faster slowly), one touch ends the run, a check every 30 s gives a spare feather (one free bump, hold up to 3), a revive potion brings you back once. Score = distance. The sim checks the first minute is fair for a steady pupil. |
| D2 | **Server**: migration (`toonflap_dash` runs with seed, flaps and distance; best per pupil), the `toonflap` function gets `dash_start` / `dash_answer` / `dash_finish` (replays the flight, refuses impossible distances), `my_toonflap()` adds best distance, board function for own class (first names, top 10 plus your place), cleared each New Season. Points: 1 for each of the first 5 dashes a day, 3 for a new best (once a day). |
| D3 | **Screens**: Sky Dash button on the map (locked until level 5 with "Finish level 5 to open"), play screen in Cosmic Storm sky with distance counter, check card, feather count, results with board and "Try again". Bella clips for the fixed lines. Preview, test, go live (on for everyone, as Toon Flap already is). |

## Decided unless James says otherwise

- Sky Dash board: own class, first names, top 10 and your own place; reset each New Season.
- Sky Dash points as in D2 (small, so the levels stay the main way to earn).
- Painting runs now (PC is free): B1 and C1 in one Mac session.
