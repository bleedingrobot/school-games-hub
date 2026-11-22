# Circuit Racer: credits

## Physics ideas: OpenRoads (MIT licence)

Circuit Racer's physics (`shared/circuit/physics.ts`) follows the *ideas* in **OpenRoads**
(github.com/praveenscience/OpenRoads-SkyRoads-Clone), copyright (c) 2014 anprogrammer, MIT licence: fixed 30 steps a
second, moving in small tries and stopping flush against anything solid, a sideways nudge off clipped corners, crash or
bonk by speed, half-speed bounces, sliding off half-landed ledges, a jump helper that tries ±10% to ±60%, fuel by speed and
air by time, and inputs recorded by distance. The code, units and tuning are our own.

We use **none** of SkyRoads' (1993) roads, art, music, sounds or name, and nothing from OpenRoads' data files.

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
> persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and
> this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED
> "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

## Art

The road, racer, chips, cables, sparks and gates are drawn in code (three.js, `textures.ts`; Volt as an SVG stand-in), and
stay as the fallback. The paintings in `paint/` (5 world backdrops, the world map, 5 finish paintings, the dashboard frame,
6 tile textures, 4 racer portraits and Volt) and the home card in `card/` were painted for School Games Hub on 23 Nov 2026
with ComfyUI on the school's gaming PC (Z-Image Turbo), from the words in `docs/circuit-art/config.json`
(`docs/CIRCUIT-ART-PLAN.md`). Our own look; nothing from SkyRoads or OpenRoads.
