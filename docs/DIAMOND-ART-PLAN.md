# Diamond Drop: painted pictures plan

How Diamond Drop swaps its drawn-in-code art for paintings, made in ComfyUI on James's gaming PC. It follows the way Star Trader was done (`docs/TRADER-ART-PLAN.md`), so most of the tools can be copied.

Written 2 November 2026 for James.
**Status: Stage 2: plan and style mock-ups; style not chosen yet.** Nothing is painted and nothing is in the game yet.

## The short version

- **Everything with a picture gets painted:** 10 level backgrounds, the level map, 10 gems (twice: a small sprite and a big Gem Book painting), rocks, the mystery sack, the cave crab, the winch, the claw, Nugget the kiwi, the shop boosts and stall, and the Claw Workshop upgrades. That is **104 paintings** in all (section 1).
- **Three styles to choose between.** The Glow-worm Cave was painted on the gaming PC in each style, two tries each (`python3 scripts/diamond-art.py paint <dir> style-a style-b style-c`, 2 Nov 2026), and shown to James. Waiting for his pick. Seen in the tries: Nugget comes out like a chick (short beak), so his prompts need "long thin curved kiwi beak" said strongly. His choice fills the `{STYLE}` line in every prompt below.
  - **A. Storybook:** bright storybook painting, soft edges, warm light, like a picture book.
  - **B. Glowing Cave:** richer and darker, dramatic glowing light, gems shining like lamps.
  - **C. Clean Flat:** crisp flat shapes, bold outlines, few gradients, very readable.
- **Gems must stay easy to tell apart at small size on a Chromebook, by shape as well as colour** (some pupils are colour-blind). Whatever the style, each gem keeps the silhouette the drawn art uses (section 4.1). A painting that changes the shape gets remade.
- **Code keeps the movement:** the swinging, the rope line, trails, catch effects, sparkles, bubbles, steam, the clock and bars, and all text (section 3).
- **Every painting is optional.** A missing painting falls back to today's drawn version for ever, so paintings go in a batch at a time.
- **One try of each picture.** Claude checks each one, remakes only the bad ones, and shows James the set on a review page.

## 1. What gets painted

| Group | How many | Size and shape | Where it shows |
|---|---|---|---|
| Level backgrounds | 10 | 1600 × 1000, wide | Behind each level |
| Level map | 1 | 1200 × 1800, portrait | Level select, depth gauge |
| Gem sprites | 10 | 512 × 512 on plain white, cut out | On the field, in the claw, shop, Hall |
| Gem Book paintings | 10 | 800 × 800 | Gem Book pages |
| Rocks | 3 (small, medium, big) | 512 × 512 on white, cut out | On the field |
| Mystery sack | 1 | 512 × 512 on white, cut out | On the field |
| Cave crab | 1 | 512 × 512 on white, side-on, cut out | Levels 6 to 10 |
| Winch | 1 | 512 × 512 on white, cut out | Top of every level |
| Claw (starter), open and closed | 2 | 512 × 512 on white, cut out | Hangs on the rope |
| Nugget the kiwi in a yellow hard hat | 4 poses: wave, point, cheer, oops | 512 × 512 on white, cut out | Guide, level results |
| Shop boosts | 4: Strong Winch, Lucky Charm, Extra Time, Rock Blaster | 256 × 256 on white, cut out | Shop |
| Shop stall | 1 | 1000 × 700 on white, cut out | Shop |
| **Game total** | **48** | | |
| Claw heads, each open AND closed | 24 (12 heads × 2) | 512 × 512 on white, cut out | Workshop, on the claw |
| Rope tiles | 8 | 128 × 512, seamless vertical tile | Repeat down the rope |
| Winches | 5 | 512 × 512 on white, cut out | Workshop, top of level |
| Hats shown on Nugget | 7 | 512 × 512 on white, cut out | Workshop, Nugget |
| Trail shop icons | 5 | 256 × 256 on white | Workshop |
| Catch effect shop icons | 6 | 256 × 256 on white | Workshop |
| **Workshop total** | **55** | | (43 upgrades; heads count twice) |
| Home page card | 1 | 1600 × 900, no text | Home page |
| **Everything** | **104** | | |

(The plan said "about 40 and about 40". Counting each claw twice, open and closed, the Workshop comes to 55.)

**Level backgrounds, in order:** 1 Grassy Topsoil, 2 Clay Bank, 3 Old River Gravel, 4 Glow-worm Cave, 5 Crystal Hollow, 6 Underground Lake, 7 Fossil Seam, 8 Hot Springs, 9 Magma Edge, 10 The Diamond Heart. Each is a cut-away of the earth, getting deeper and stranger.
- The **top 18%** is the surface or sky band where the winch sits. From level 4 down, that band is a cave ceiling or a ledge instead of sky.
- The **middle must be calm and low-detail** so gems, rocks and crabs read on top. Detail lives at the edges and the bottom.

## 2. How the pictures get into the game

The same three parts as Star Trader:

1. **`scripts/diamond-art.py`**, a copy of `scripts/trader-art.py`. It reads `~/dragon-art-inbox/diamond-art` and writes `.webp` files into `src/games/diamond/art/paint/<group>/<name>.webp`.
   - **Sprites** (gems, rocks, sack, crab, winch, claws, Nugget, boosts, stall, heads, winches, hats, icons): white background removed with rembg (`~/.cache/rembg-venv`), trimmed, 256 px plus a 96 px copy for small uses (the field, the shop).
   - **Level backgrounds and the level map:** 1600 px wide plus 800 px for phones (the map 1200 px tall plus 600).
   - **Gem Book paintings:** 800 px plus 400 px.
   - **Rope tiles:** kept at 128 × 512 and checked that top and bottom edges match, so they repeat without a join.
   - **Card:** 1600 px plus 800 px.
2. **`src/games/diamond/art/paint.ts`** looks a painting up by the game's own name (`gemArt('ruby')`, `levelArt(4)`, `clawArt('golden-claw', 'open')`) and returns nothing when it's missing. Pictures load in the background, and the drawn version shows until they arrive. Drawn code art stays as the fallback for ever.
3. **`src/games/diamond/art/art.test.ts`** checks that every gem, level, Workshop item and boost the game knows has its painting, that every painting is used, and that a missing name gives nothing.

**Inbox, never straight to main.** James's PC saves tries into `~/dragon-art-inbox/diamond-art/<group>/`, not into the repo. Claude copies the chosen ones across on branch `claw`, tidies them, and nothing reaches `main` except through a reviewed pull request.

**Picks.** `docs/diamond-art/picks.json` says which try was chosen for each picture, and why a remake was done.

Generating is done by `~/dragon-art-inbox/tools/diamond-art.py` (groups `gems`, `field`, `levels`, `book`, `shop`, `heads`, `ropes`, `winches`, `hats`, `icons`, `card`). Each PNG carries its prompt, so any single picture can be remade by naming it.

## 3. Stays in code

- **Moving things:** the swinging, the winch turning, the rope drawn as a line (rope tiles repeat along it), the claw closing, the gem coming up.
- **Effects:** the five trails and six catch effects themselves, sparkles, glow-worm twinkle, bubbles, steam, dust when a rock breaks, the gem shine.
- **Interface:** the clock, the target bar, the depth gauge's numbers, coins, prices, all text.
- Reduced motion keeps its small still glow instead of the effects.

## 4. Prompts

Every picture uses this shape: `{STYLE}`, then the picture's own prompt, with the shared negative prompt below. Pictures that are cut out add the sprite line.

**`{STYLE}`** is one of these, filled in once James picks (the mock-up uses all three):
- A: `bright storybook painting, soft edges, warm light, rich colours, like a children's picture book`
- B: `rich dark painting, dramatic glowing light, gems shining like lamps, deep shadows, glowing colours`
- C: `clean flat illustration, crisp flat shapes, bold dark outlines, few gradients, very readable, bright colours`

**Sprite line** (added to every cut-out picture): `single object, centred, whole object visible, plain white background, nothing else, no shadow on the ground`

**Shared negative prompt** (every picture): `text, letters, numbers, words, watermark, logo, signature, people, human, faces, hands, blood, gore, scary, frightening, photo, blurry, cropped, cut off, extra objects, frame, border, brand, cartoon character copied from a game`

Keep the game original: no prompt names an existing game, character or brand.

### 4.1 Gems (sprite and Gem Book)

The silhouette is fixed. The sprite prompt is `{STYLE}, <gem prompt>, + sprite line`. The Gem Book prompt is `{STYLE}, <gem prompt>, large, resting on a small cushion of dark rock and moss, soft glow behind it, whole gem in the middle, calm plain dark-to-light background`.

| Gem | Silhouette (must keep) | Gem prompt |
|---|---|---|
| Quartz | tall hexagonal crystal | `a clear white tall six-sided quartz crystal with a pointed top, glassy, a little blue-white shine` |
| Jade | smooth rounded pebble | `a pale mint-green smooth rounded jade pebble, polished, soft and waxy, no sharp points` |
| Amethyst | cluster of three pointed crystals | `a purple amethyst cluster of exactly three pointed crystals joined at the base, one tall, two shorter` |
| Topaz | teardrop | `a golden-orange teardrop shaped topaz gem, pointed at the top, round at the bottom, faceted and warm` |
| Emerald | rectangle with cut corners | `a deep green emerald-cut gem, a rectangle with four cut corners, stepped flat facets inside` |
| Sapphire | round brilliant cut | `a bright blue round brilliant-cut sapphire, seen from the top, many triangular facets, perfectly round` |
| Ruby | triangle | `a red triangular trillion-cut ruby, three equal sides with gently rounded corners, faceted and glowing` |
| Fire Opal | oval with flecks | `an orange-red oval fire opal, smooth, with tiny flecks of yellow and red flame colour inside` |
| Star Sapphire | dome with six-rayed star | `a dark blue smooth dome-shaped star sapphire with a bright white six-rayed star on top` |
| Heart Diamond | large heart | `a large white-pink sparkling heart-shaped diamond, many facets, bright sparkles, the finest gem in the world` |

### 4.2 Level backgrounds (1600 × 1000)

Prompt: `{STYLE}, side-on cut-away view of the ground, <level prompt>, the top fifth is <top band>, the middle is calm, smooth and low-detail with soft colour so small objects will stand out, detail only at the edges and the bottom, wide landscape`.

| Level | Level prompt | Top band |
|---|---|---|
| 1 Grassy Topsoil | `dark brown crumbly topsoil with tiny roots and a few pebbles, a flat sunny meadow above` | `a bright blue sky, green grass line, a few daisies and a small wooden fence` |
| 2 Clay Bank | `smooth orange-red clay layers with gentle stripes, small roots at the edges` | `a green grassy bank edge and a pale sky with soft clouds` |
| 3 Old River Gravel | `grey and tan rounded river gravel and sand layers, small pebbles at the edges, a dry old river bed` | `a green bank above with reeds and a pale evening sky` |
| 4 Glow-worm Cave | `a calm dark blue-green cave with soft rock walls, tiny glow-worm lights in strings on the ceiling` | `a rocky cave ceiling with glowing glow-worm threads hanging down` |
| 5 Crystal Hollow | `a hollow cave with big pale crystals growing from the walls at the edges, soft purple-blue rock in the middle` | `a cave ceiling with a few crystal points and a flat stone ledge` |
| 6 Underground Lake | `a still blue underground lake in a cave, calm teal water in the middle, wet rocky shores at the edges, soft reflections` | `a high cave ceiling with stalactites and a rocky ledge` |
| 7 Fossil Seam | `layered cream and brown rock with the outlines of ancient shells, ferns and a big spiral fossil at the edges, calm stone in the middle` | `a stone ceiling with a flat rock ledge` |
| 8 Hot Springs | `warm rock with steaming turquoise hot pools at the edges, calm warm brown-orange rock in the middle, gentle steam` | `a rocky ceiling with warm mist and a flat ledge` |
| 9 Magma Edge | `dark red-black rock with glowing orange cracks of lava at the edges and bottom, calm dark rock in the middle` | `a dark rock ceiling with a few glowing drips and a stone ledge` |
| 10 The Diamond Heart | `a magical round chamber deep underground, calm soft rose-and-violet rock in the middle, a faint pink glow rising from the bottom centre, crystals curving round the edges like a heart` | `a smooth arched ceiling with faint sparkles and a stone ledge` |

### 4.3 Level map (1200 × 1800)

`{STYLE}, tall portrait cut-away of the ground showing ten layers from top to bottom: green meadow topsoil, orange clay, grey river gravel, a dark cave with glow-worms, a purple crystal hollow, a blue underground lake, a layer of cream fossils, steaming hot springs, red lava rock, and at the very bottom a glowing pink heart-shaped chamber with a tiny diamond; each layer is a clear horizontal band with a wavy edge, a small winch on the grass at the top, no text`

### 4.4 Field things (sprites, 512 × 512)

All add the sprite line.

| Picture | Prompt |
|---|---|
| Small rock | `{STYLE}, a small grey-brown rock, rounded and lumpy, a little moss, plain` |
| Medium rock | `{STYLE}, a medium grey-brown boulder, lumpy, with a few cracks and moss` |
| Big rock | `{STYLE}, a big heavy dark grey boulder, rough and cracked, a little moss, clearly bigger and heavier than a pebble` |
| Mystery sack | `{STYLE}, a small tied brown cloth sack with a question-mark-free lumpy bulge, a golden rope tie and a tiny sparkle, mysterious and friendly` |
| Cave crab | `{STYLE}, a small friendly cave crab seen from the side, round orange-brown shell, two little eyes on stalks, two small claws raised, six legs, pale cave-crab colours, cute not scary` |
| Winch | `{STYLE}, a chunky wooden and iron winch with a big round drum wound with rope, a handle, mounted on a small stone base, seen from the front` |
| Claw, open | `{STYLE}, a strong metal claw hanging downwards with three curved prongs spread wide open, a ring at the top for a rope, steel-grey with a yellow band` |
| Claw, closed | `{STYLE}, the same strong metal claw hanging downwards with three curved prongs closed together tightly, a ring at the top, steel-grey with a yellow band` |

### 4.5 Nugget the kiwi (sprites, 512 × 512)

Nugget is a round, friendly brown kiwi bird with a long thin beak and tiny wings, wearing a yellow hard hat. Every prompt starts: `{STYLE}, Nugget, a cute round brown kiwi bird with a long thin curved beak, tiny wings, little strong legs, wearing a small yellow hard hat,` then:

| Pose | Prompt ends |
|---|---|
| Wave | `waving one wing high, happy open-beak smile, standing, + sprite line` |
| Point | `pointing one wing out to the side as if showing the way, bright eyes, standing, + sprite line` |
| Cheer | `both wings thrown up in the air, jumping with joy, tiny sparkles round, + sprite line` |
| Oops | `both wings on the hat, cheeks puffed, a wobbly worried smile, sweat drop, kind and funny not sad, + sprite line` |

### 4.6 Shop boosts (256 × 256) and stall

Add the sprite line.

| Picture | Prompt |
|---|---|
| Strong Winch | `{STYLE}, a small shiny winch with a big muscle-red drum and a lightning-bolt-shaped handle, strong and fast` |
| Lucky Charm | `{STYLE}, a golden four-leaf clover charm on a short chain, green leaves, tiny sparkle` |
| Extra Time | `{STYLE}, a round golden pocket clock with a thick plus-shaped hand pair, no numbers, a tiny sparkle` |
| Rock Blaster | `{STYLE}, a small round black cartoon bomb-free blaster: a stubby brass cannon with a blue spark at the tip, friendly` |
| Shop stall | `{STYLE}, a little wooden market stall with a striped red and white awning, shelves with jars of coloured gems and a counter, friendly and cosy, nobody behind the counter` |

### 4.7 Claw heads (512 × 512, open and closed)

Every head is shown hanging downwards, with a ring or hook at the top for the rope. Prompt: `{STYLE}, <head prompt>, <open or closed phrase>, + sprite line`. The **same shape and colours** must be used for the open and the closed picture.

| Head | Head prompt | Open | Closed |
|---|---|---|---|
| Golden Claw | `a gleaming solid gold three-pronged claw with a little ruby in the middle` | `prongs spread wide` | `prongs pressed together` |
| Dino Jaw | `a green dinosaur skull jaw with big friendly teeth, hanging by a ring on its head` | `jaws wide open` | `jaws shut` |
| Robot Hand | `a chunky grey robot hand with three metal fingers, blue lights and rivets` | `fingers spread` | `fingers curled into a fist` |
| Crab Pincer | `a big orange crab pincer with bumpy shell and a white tip` | `pincer open wide` | `pincer snapped shut` |
| Octopus Arm | `a purple octopus tentacle with two rows of round suckers, curled at the end` | `tentacle end stretched open and fanned` | `tentacle end curled tight` |
| Giant Magnet | `a giant red horseshoe magnet with silver tips, small spark lines` | `with a small sparkle glow at the tips` | `the same magnet with a bigger spark glow, the tips close` |
| Rubber Chicken | `a floppy yellow rubber chicken with a funny face, wings out, hanging by its feet` | `wings stretched wide` | `wings wrapped tight round itself` |
| Giant Fork | `a huge silver dinner fork with three long tines` | `tines spread slightly apart` | `tines bent together` |
| Dragon Talon | `a curved black and red dragon talon claw with golden tips, scaly` | `talons spread wide` | `talons curled shut` |
| Ice Crystal Claw | `a pale blue claw made of clear ice crystals with frost sparkles` | `crystal prongs apart` | `crystal prongs together` |
| Grabby Glove | `a big white cartoon glove with a red cuff, no arm, hanging by its cuff` | `hand open flat, fingers spread` | `hand closed in a fist` |
| Diamond Claw | `a claw made of clear sparkling diamond facets with a rainbow shine` | `prongs spread wide` | `prongs pressed together` |

### 4.8 Rope tiles (128 × 512, seamless vertical)

Prompt: `{STYLE}, <rope prompt>, seen straight on, running vertically down the middle of a tall narrow image, plain white background, the pattern repeats exactly the same at the top and the bottom edge, seamless`. The rope is drawn in the middle 64 px, the rest is white (cut out).

| Rope | Rope prompt |
|---|---|
| Rainbow Rope | `a thick twisted rope in red, orange, yellow, green, blue and purple strands` |
| Jungle Vine | `a green jungle vine with small leaves and curling tendrils` |
| Laser Beam | `a glowing straight beam of bright cyan light with a white centre` |
| Sausage Chain | `a chain of pink-brown linked sausages, funny and plump` |
| Spaghetti | `a long strand of cooked yellow spaghetti, wavy and glossy` |
| Candy Cane | `a rope of red and white candy-cane stripes, glossy` |
| Bike Chain | `a silver bicycle chain with oily links` |
| Star Rope | `a golden cord with little five-pointed stars along it` |

### 4.9 Winches (512 × 512)

Add the sprite line. Same size and drum position as the starter winch, so they swap one for one.

| Winch | Prompt |
|---|---|
| Steam Engine | `{STYLE}, a small brass steam-engine winch with a chimney, a round boiler and a big drum wound with rope, white puffs painted on the chimney` |
| Rocket Winch | `{STYLE}, a winch built like a silver rocket on its side, red fins, a round window, the rope drum on the back, bright flame nozzle` |
| Giant Snail | `{STYLE}, a giant friendly garden snail whose spiral shell is the rope drum, wound with rope, smiling face, antennae` |
| Pirate Ship Wheel | `{STYLE}, a wooden pirate ship steering wheel with eight spokes and handles, fixed on a post, wound with rope` |
| Hamster Wheel | `{STYLE}, a metal hamster wheel on a stand with a happy brown hamster running inside, the rope wound round the axle` |

### 4.10 Hats shown on Nugget (512 × 512)

Prompt: `{STYLE}, Nugget, a cute round brown kiwi bird with a long thin curved beak and tiny wings, standing and smiling, wearing <hat>, + sprite line`. The pose, size and place match Nugget's "wave" picture so they line up.

| Hat | Hat prompt |
|---|---|
| Pirate Hat | `a black pirate hat with a white skull-and-crossbones badge` |
| Crown | `a golden crown with red and blue jewels` |
| Wizard Hat | `a tall purple pointed wizard hat with gold stars and a floppy tip` |
| Chef's Hat | `a tall white puffy chef's hat` |
| Astronaut Helmet | `a round clear glass astronaut helmet with a white collar, the beak poking out through a small opening` |
| Top Hat | `a tall black top hat with a red ribbon` |
| Miner Lamp | `a yellow hard hat with a bright round lamp on the front shining a warm light` |

### 4.11 Shop icons for trails and catch effects (256 × 256)

Add the sprite line. Each is a small still picture of the effect, so pupils can tell them apart in the Workshop. The effect itself is drawn in code.

| Icon | Prompt |
|---|---|
| Sparkles | `{STYLE}, a cluster of bright golden four-pointed sparkles of different sizes` |
| Bubbles | `{STYLE}, a group of shiny see-through soap bubbles of different sizes with rainbow shine` |
| Flames | `{STYLE}, a friendly orange and yellow flame with a red edge` |
| Confetti | `{STYLE}, a burst of colourful confetti pieces and ribbons` |
| Music Notes | `{STYLE}, a few bright blue and pink music notes of different sizes` |
| Fireworks | `{STYLE}, a firework bursting in red, gold and blue streaks` |
| Disco Ball | `{STYLE}, a silver mirror disco ball with small square mirrors and tiny light beams` |
| Gem Rain | `{STYLE}, small coloured gems falling like raindrops from the top, red, blue, green and yellow` |
| Trumpet Fanfare | `{STYLE}, a shiny brass trumpet with three small music notes coming from it` |
| Nugget's Happy Dance | `{STYLE}, a tiny round brown kiwi in a yellow hard hat dancing with one foot up and wings out, small hearts and stars round it` |
| Gem Rain Deluxe | `{STYLE}, a shower of many sparkling gems of all colours falling, with golden sparkles and a bright shine` |

### 4.12 Home page card (1600 × 900, no text)

Same shape as the Marble Rush course cards (`docs/HOME-ART-PLAN.md`): painted landscape, calm sky at the top, subject in the middle.

`{STYLE}, a bright cut-away cliff: a sunny green meadow at the top with a little wooden winch and a shiny claw hanging on a rope, below it coloured layers going down through orange clay, grey gravel, a glowing cave with glow-worms, purple crystals, a blue lake, and at the very bottom a shining pink heart-shaped diamond; gems of many colours and shapes set in the layers; calm sky at the top, wide 16:9, no text`

## 5. Batches

Each batch can go live on its own. Each starts from a fresh `origin/main` merged into `claw`, ends with tests passing, screenshots for James, and the drawn fallback still working.

| Batch | What | How many | Screens that change |
|---|---|---|---|
| **D.1** | Gem sprites, rocks (3), mystery sack, cave crab | 15 | The level field, the claw holding a gem, Hold on! |
| **D.2** | Winch, claw open and closed, Nugget in 4 poses | 7 | Top of every level, the guide, level results |
| **D.3** | Backgrounds for levels 1 to 5 | 5 | Levels 1 to 5 |
| **D.4** | Backgrounds for levels 6 to 10, level map | 6 | Levels 6 to 10, level select, depth gauge |
| **D.5** | Gem Book paintings, 4 shop boosts, shop stall | 15 | Gem Book, the shop |
| **D.6** | Claw heads 1 to 6 (Golden Claw, Dino Jaw, Robot Hand, Crab Pincer, Octopus Arm, Giant Magnet), open and closed | 12 | Workshop, try-on, the claw in play |
| **D.7** | Claw heads 7 to 12 (Rubber Chicken, Giant Fork, Dragon Talon, Ice Crystal Claw, Grabby Glove, Diamond Claw), open and closed | 12 | Workshop, try-on, the claw in play |
| **D.8** | 8 rope tiles, 5 trail icons | 13 | Workshop, the rope in play |
| **D.9** | 5 winches, 7 hats on Nugget | 12 | Workshop, top of level, Nugget |
| **D.10** | 6 catch effect icons | 6 | Workshop |
| **D.11** | Home page card | 1 | Home page |
| | **Total** | **104** | |

The order puts the pictures that change the most-used screens first (gems, then winch and claw, then levels). The Workshop batches only matter once pupils own upgrades.

## 6. How to check

1. **One try of each picture** (James's rule): the PC makes one try, no pile of options.
2. **Claude checks every picture** and remakes only the bad ones. A picture is bad if:
   - a gem has the wrong silhouette (section 4.1), or two gems look alike at 48 px;
   - a sprite is cut off, has a second object, or its cut-out has white fringes;
   - a background has a busy middle, or its top band is not clear where the winch sits;
   - open and closed claws are not the same object, or a rope tile shows a join;
   - there is any text, a face on a thing that should not have one, anything scary, or anything that looks like an existing game.
3. **Small-size test:** all 10 gems side by side at 48 px on each level background, and in greyscale. Each must still be told apart by shape.
4. **Review page for James:** every painting with its name, grouped by batch, with the picks recorded in `docs/diamond-art/picks.json`.
5. **Screenshots** of each changed screen at **1366 × 640** (Chromebook) and **844 × 390** (phone), with paintings on and with them off (drawn fallback).
6. **Art test** passes (section 2), and the first screen of a level stays light to download.

## 7. Notes

- **Children:** every painting is checked for 8 to 11 year olds. The crab is cute, not scary; Magma Edge is warm, not frightening; Nugget's "oops" is funny, not sad.
- **Original game:** all names and shapes are our own.
- **Style choice (2 Nov 2026):** James chose a different style for each level, **backgrounds only**. Gems, rocks, the claw, rope, winch and Nugget keep one look on every level, so they read the same everywhere. That one look is still to choose (Storybook recommended).
- **Level styles** (`LEVEL_STYLES` in `scripts/diamond-art.py`): 1 storybook watercolour, 2 plasticine, 3 coloured pencil, 4 glowing dark painting, 5 stained glass, 6 woodblock print, 7 explorer's notebook sketch, 8 layered paper-cut, 9 bold comic book, 10 shimmering pastel dream.
- **Background picks so far** (tries named `level-N-T`, seeds fixed in the script): 1-3, 2-1, 3-2, 4-2, 5-3, 6-2, 7-1, 8-2, 9-4, 10-4. James OK'd these on 2 Nov 2026. Level 5's thin glass border is trimmed in the game. Earlier tries of 5, 9 and 10 drew a window frame, creatures or faces; the reworded prompts fixed them.

## Credits to carry over

- Paintings made by James with ComfyUI on his gaming PC (model to be noted when made), November 2026.
- Fallback art: drawn in code (`src/games/diamond/`).
