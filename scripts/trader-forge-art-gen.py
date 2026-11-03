#!/usr/bin/env python3
"""
Paints the Star Forge's pictures (docs/TRADER-SYSTEM-ART-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that
can reach ComfyUI on Tailscale (http://100.97.96.115:8188; start ComfyUI on the PC with --listen 0.0.0.0), never in the site
build. Needs only the Python standard library.

  python3 scripts/trader-forge-art-gen.py batch1                 # planets clouds suns skies (then heights if installed)
  python3 scripts/trader-forge-art-gen.py batch2                 # rings moons night
  python3 scripts/trader-forge-art-gen.py batch3                 # postcards tech buttons
  python3 scripts/trader-forge-art-gen.py planets suns           # just these groups
  python3 scripts/trader-forge-art-gen.py --only planets/desert-2   # remake one (the old one is kept in <group>/_old/)
  python3 scripts/trader-forge-art-gen.py --list                 # every picture and its prompt, nothing is painted
  python3 scripts/trader-forge-art-gen.py --check                # is ComfyUI up? which depth and upscale models does it have?

Groups: planets clouds suns skies rings moons night postcards tech buttons (and heights: depth maps of the planet maps,
only if the PC has a Depth Anything node; the tidy script makes its own if not).
Pictures are written to ~/dragon-art-inbox/trader-forge-art/<group>/<name>.png with the prompt stored inside the PNG
(ComfyUI's own copy, plus a plain "forge_prompt" text entry). A picture already there is skipped. Run
scripts/trader-forge-art.py afterwards to tidy them into the game.

The graph is Star Trader's and Clan Quest's (Z-Image Turbo, 8 steps, a 1.5x second pass: 1536x768 becomes 2304x1152, the
size the existing planet maps were painted at). Seeds are fixed from the picture's name, so a picture can be painted again
exactly; --only uses a new seed each time. This model has NO negative prompt (cfg 1.0 zeroes it) and draws whatever a
prompt names, even after "no", so every prompt is worded positively: say what is there, never what is not.
Sizes bigger than 2304 wide (the -hd copies) are made by the tidy script, or here with --hd-model NAME (a ComfyUI
upscale model such as 4x-UltraSharp; --check lists them), which paints the 4096x2048 / 8192x4096 PNGs directly.
"""
from __future__ import annotations

import json
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path
from typing import NamedTuple

COMFY = 'http://100.97.96.115:8188'
INBOX = Path.home() / 'dragon-art-inbox' / 'trader-forge-art'

# ---------------------------------------------------------------------------------------------
# The names (these match shared/trader/system.ts and src/games/trader/forge/viewer/types.ts)
# ---------------------------------------------------------------------------------------------
SUNS = ['yellow', 'red', 'blue', 'white', 'pulsar', 'binary', 'blackhole', 'baby']
PLANETS = ['rocky', 'desert', 'ice', 'ocean', 'lava', 'jungle', 'gas', 'icegiant', 'crystal', 'toxic', 'eyeball', 'shattered', 'cube', 'donut', 'ringworld']
SURFACES = 4
RINGS = ['dusty', 'icy', 'crystal', 'rainbow', 'double']
CLOUDS = ['thin', 'thick', 'storms', 'spot']  # 'none' needs no painting
MOON_LOOKS = 8
BACKGROUNDS = 8
LIFE_CREATURES = {'microbes': 3, 'plants': 3, 'sea': 5, 'animals': 5, 'floaters': 4, 'crystalfolk': 3, 'robots': 4, 'cities': 4}
EFFECTS = ['aurora', 'lightning', 'volcano', 'geysers', 'meteors', 'glowseas', 'islands', 'tail']
TECH = ['satellites', 'moonbase', 'station', 'telescope', 'elevator', 'domes', 'terraformer', 'orbitalring', 'engine']
SYSTEM_TECH = ['lanes', 'miners', 'sails', 'dyson', 'gate']
BELTS = ['rocky', 'icy', 'golden']
GROUPS = ['planets', 'clouds', 'suns', 'skies', 'rings', 'moons', 'night', 'postcards', 'tech', 'buttons']
BATCHES = {
    'batch1': ['planets', 'clouds', 'suns', 'skies', 'heights'],
    'batch2': ['rings', 'moons', 'night'],
    'batch3': ['postcards', 'tech', 'buttons'],
}

# ---------------------------------------------------------------------------------------------
# The words. The picture's own words go in the middle; the style opens it and the tail closes it.
# ---------------------------------------------------------------------------------------------
STYLE = 'Cinematic film concept art, richly detailed, natural colours, realistic fine detail. '
KIDS = 'Suitable for children aged 8 to 12. '

MAP_TAIL = (' Seen from directly above as one flat rectangular texture map that fills the whole picture edge to edge, wide 2 to 1 shape, '
            'the left and right edges continue into each other, even soft light with no shadows, the same amount of detail everywhere, '
            'ground and surface only.')
CLOUD_TAIL = (' Seen from directly above as one flat rectangular map that fills the whole picture edge to edge, wide 2 to 1 shape, '
              'the left and right edges continue into each other, soft even light, bright white cloud on a solid pure black background, '
              'every part without cloud is plain pure black.')
SUN_TAIL = (' One flat rectangular texture map that fills the whole picture edge to edge, wide 2 to 1 shape, the left and right edges '
            'continue into each other, bright glowing surface everywhere, even light, the same amount of detail all over.')
SKY_TAIL = (' A seamless 360 degree equirectangular panorama of deep space, wide 2 to 1 shape, it fills the whole picture edge to edge, '
            'the left and right edges continue into each other, only sharp tiny stars and glowing space gas, empty deep space all round.')
MOON_TAIL = MAP_TAIL
NIGHT_TAIL = (' Seen from directly above as one flat rectangular map that fills the whole picture edge to edge, wide 2 to 1 shape, '
              'the left and right edges continue into each other, tiny bright glowing lights scattered on a solid pure black background, '
              'everything between the lights is plain pure black.')
RING_TAIL = (' A flat texture of straight parallel vertical stripes that runs from the left edge to the right edge, seen straight on and '
             'filling the whole picture edge to edge, every stripe is a different width and brightness, every stripe runs from the very top '
             'to the very bottom of the picture, the gaps between stripes are plain pure black.')
CARD_TAIL = (' Wide cinematic landscape painting, warm glowing light, friendly and wondrous, a happy sense of discovery, ' + KIDS.strip() +
             ' Wide landscape.')
CUT_TAIL = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, clean empty white '
            'all around, seen from a slight angle. ' + KIDS.strip())
TILE_TAIL = (' One flat square texture that fills the whole picture edge to edge, seen straight on, even soft light with no shadows, '
             'the same amount of detail everywhere, the edges continue into each other so it can repeat.')
GLOW_TAIL = ' Glowing light on a solid pure black background, centred, the black around it is plain and empty.'
BUTTON_TAIL = (' A single icon-like picture centred in the square and filling most of it, on a deep dark blue space background with a soft '
               'glow behind it, simple bold shape that reads clearly when small. ' + KIDS.strip())


class Picture(NamedTuple):
    group: str
    name: str
    text: str
    size: tuple[int, int]  # width, height of the first pass
    refine: bool           # the 1.5x second pass


PICTURES: dict[str, Picture] = {}


def add(group: str, name: str, text: str, size: tuple[int, int], refine: bool = True) -> None:
    PICTURES[f'{group}/{name}'] = Picture(group, name, text, size, refine)


MAP = (1536, 768)

# ---- Planet surface maps: 15 kinds x 4 surfaces (the Forge's "Surface" choice, index 0 to 3) ----
PLANET_LOOKS: dict[str, list[str]] = {
    'rocky': [
        'a bare grey rocky planet like Mercury, covered in craters of every size, bright ejecta rays around the young craters, grey dust plains between them',
        'a dark brown-grey rocky planet with huge smooth basalt plains, long wrinkle ridges and a few pale rayed craters',
        'a pale tan cratered rocky planet with long cliffs, old worn craters and lighter highlands',
        'a rust-grey rocky planet with deep canyons, scattered boulder fields and sharp young craters',
    ],
    'desert': [
        'an orange-red desert planet like Mars, great canyon systems, dune fields, dark volcanic patches and dry channels',
        'a pale golden desert planet covered in rippled dune seas that sweep in long curves, a few dark rock outcrops',
        'a red-brown desert planet of flat-topped mesas, dry riverbeds, cracked clay plains and sand drifts',
        'a cream and ochre desert planet with bright salt flats, dark dune streaks and low rust-coloured hills',
    ],
    'ice': [
        'a bright white and blue ice planet like Europa, a smooth ice shell crossed by long straight tan-brown cracks and ridges',
        'a deep blue glacier-ice planet with long crevasse fields, wind-blown snow drifts and pale frozen plains',
        'a frosted pale pink-white ice planet with frozen craters, snow-covered plains and polar ice caps',
        'a blue-grey ice planet with rows of ridges, frozen lakes, thin cracks and drifts of white frost',
    ],
    'ocean': [
        'a deep blue ocean planet, water from edge to edge with swirling white foam streaks and a few tiny scattered island chains',
        'a bright turquoise shallow-sea planet with ring-shaped coral atolls, pale sandbanks and darker deep channels',
        'a dark teal ocean planet with bright swirling current patterns and a handful of green islands',
        'a rich blue ocean planet with vast pale archipelagos of small green islands and white surf lines',
    ],
    'lava': [
        'a black volcanic planet like Io, a cracked black crust with branching rivers of bright orange molten lava and glowing lava lakes',
        'a yellow and orange sulphur-covered planet with dark volcanic craters and red-orange lava lakes',
        'a dark red cracked-crust planet with thin bright yellow lava cracks glowing between the plates',
        'a charcoal-grey planet with wide glowing orange lava seas, black ash plains and dark volcanic cones',
    ],
    'jungle': [
        'a lush green jungle planet, dense forest canopy across every continent, winding blue rivers and lakes',
        'a bright emerald rainforest planet with rolling mountain ranges, soft valley mist and silver rivers',
        'a deep green forest planet mixed with golden meadows and grassland, branching rivers and clear lakes',
        'a teal and lime tropical planet of rainforest islands and wide shallow turquoise lagoons',
    ],
    'gas': [
        'close-up of endless horizontal stripes of cream, orange and brown swirling cloud, wavy edges, small white oval storms',
        'close-up of endless horizontal stripes of soft pale yellow and white cloud with gentle ripples and wavy edges',
        'close-up of endless horizontal stripes of rich red, pink and rose cloud with small swirling storms and wavy edges',
        'a gas giant with deep blue and violet horizontal cloud bands and bright white storm swirls',
    ],
    'icegiant': [
        'close-up of smooth pale cyan cloud tops with faint soft horizontal stripes and gentle haze',
        'an ice giant like Neptune, deep azure blue with bright white wispy high cloud streaks and a dark storm oval',
        'a blue-green ice giant with swirling turquoise cloud and fine pale bands',
        'a lilac-blue ice giant with soft darker bands and thin bright cloud ribbons',
    ],
    'crystal': [
        'a crystal planet, fields of purple amethyst crystals of every size packed together, glittering faces',
        'a crystal planet of clear pale-blue quartz spires and plains of shattered crystal, bright reflections',
        'a crystal planet of pink and white rose-quartz formations with glowing veins running through them',
        'a crystal planet of emerald-green crystal ridges threaded with golden veins and bright facets',
    ],
    'toxic': [
        'a toxic swamp planet, green-yellow sludge swamps with bubbling pools and drifting murky mist',
        'a purple and green swamp planet of dark mud flats, glowing green pools and thick haze',
        'an orange acid-lake planet with dark mud banks, rust-coloured pools and yellow fog',
        'a murky olive swamp planet with glowing teal pools, dark mud islands and thin mist',
    ],
    'eyeball': [
        'an eyeball world: the middle of the map is a warm bright blue sunlit ocean, round it a ring of green land, and at the left and right edges white frozen ice',
        'an eyeball world: the middle of the map is a hot brown desert, round it a ring of green life, and at the left and right edges white frozen ice',
        'an eyeball world: the middle of the map is golden sunlit rock and sand, round it a band of green forest and rivers, and at the left and right edges blue-white glacier ice',
        'an eyeball world: the middle of the map is a glittering turquoise lagoon, round it a ring of lush green plants, and at the left and right edges grey frozen plains',
    ],
    'shattered': [
        'a shattered world, huge broken grey-brown crust plates with wide glowing orange chasms between them',
        'a shattered world of dark grey plates split by deep chasms glowing electric blue',
        'a shattered world of pale icy plates split by glowing teal cracks and drifting white vapour',
        'a shattered world of red-brown plates split by chasms glowing gold, dust drifting between the plates',
    ],
    'cube': [
        'a cube planet surface that looks like neat green farmland, a patchwork of square fields, straight rivers and square lakes',
        'a cube planet surface of sandy desert with square plateaus, straight canyons and straight dune lines',
        'a cube planet surface of grey rock with straight-sided canyons, square craters and ruler-straight ridges',
        'a cube planet surface of blue-white ice with square lakes, straight cracks and squared-off snowfields',
    ],
    'donut': [
        'a donut planet surface of lush green land with long winding rivers and round lakes',
        'a donut planet surface of blue ocean dotted with green islands and white surf',
        'a donut planet surface of golden orchards and fields in curving stripes, with rivers and small lakes',
        'a donut planet surface of snow-capped mountains and green valleys, rivers running between them',
    ],
    'ringworld': [
        'the inside surface of a giant ring world, long strips of green fields, silver rivers and blue lakes running along it, with neat straight lines of land',
        'the inside surface of a giant ring world, wide blue seas and green islands, with thin straight stripes of farmland',
        'the inside surface of a giant ring world of grey-green mountain ranges and forest valleys with glinting rivers, laid out in straight bands',
        'the inside surface of a giant ring world, golden plains and green forests in straight bands, with grids of tiny glowing town lights',
    ],
}
for kind, looks in PLANET_LOOKS.items():
    assert len(looks) == SURFACES
    for i, words in enumerate(looks):
        add('planets', f'{kind}-{i}', f'{STYLE}Seamless flat top-down surface texture map of {words}.{MAP_TAIL}', MAP)

# ---- Cloud maps (white on black) ----
CLOUD_LOOKS = {
    'thin': 'thin wispy cirrus cloud, long soft streaks and small scattered patches with big clear gaps between them',
    'thick': 'big thick clumps of billowing white cumulus cloud covering about half of the map, with wide black gaps winding between the clumps',
    'storms': 'swirling spiral storm systems like hurricanes, curling bands of towering cloud with a clear eye at the centre of each',
    'spot': 'long thin horizontal streaks of white cloud in stripes, and one single big oval swirl of white cloud in the middle',
}
for kind, words in CLOUD_LOOKS.items():
    add('clouds', kind, f'{STYLE}Seamless flat map of cloud patterns only: {words}.{CLOUD_TAIL}', MAP)

# ---- Sun surfaces ----
SUN_LOOKS = {
    'yellow': 'close-up of boiling golden-yellow plasma cells packed together like a honeycomb of fire, a few small dark spots, bright glowing threads',
    'red': 'close-up of deep orange-red boiling plasma cells packed together like a honeycomb of fire, large dark brown spots, glowing threads',
    'blue': 'the surface of a blue giant star, blinding white-blue plasma with swirling bright electric-blue streamers and fine glowing threads',
    'white': 'close-up of brilliant glowing white-hot plasma with fine pale blue ripples and swirls and tiny bright sparkles, dazzling and luminous',
    'pulsar': 'the surface of a pulsar neutron star, glowing pale blue-white with fine curving magnetic field lines swirling in bright arcs',
    'binary': 'close-up of large boiling orange-yellow plasma cells packed together like a honeycomb of fire, a few small dark spots, glowing hot',
    'blackhole': 'a seamless swirl of hot glowing gas streaks in orange, gold and white on a deep dark red background, like the bright spinning disc round a black hole',
    'baby': 'the surface of a young protostar, glowing pink-orange with swirls of dusty gas and sparkling bright specks, still wrapped in cloud',
}
for kind, words in SUN_LOOKS.items():
    add('suns', kind, f'{STYLE}Seamless flat surface texture map of {words}.{SUN_TAIL}', MAP)

# ---- Skies (360 degree panoramas), index 0 to 7 ----
SKY_LOOKS = [
    'a rich purple and magenta nebula with glowing wisps and dark dust lanes, many stars',
    'the Milky Way seen edge-on, a bright glowing band of countless stars and dust lanes across the middle, dark sky above and below',
    'a beautiful spiral galaxy close by in the distance with its glowing arms, among scattered stars',
    'a deep dark sky with only a few very bright stars and many faint ones, a hint of dark blue',
    'a teal and blue-green nebula with soft glowing clouds and sparkling stars',
    'a red and orange fiery nebula of glowing gas clouds with bright blue young stars',
    'a golden dust cloud with a bright star cluster, warm amber and cream colours',
    'a pink and violet star-birth nebula with glittering new stars and long ribbons of glowing gas',
]
assert len(SKY_LOOKS) == BACKGROUNDS
for i, words in enumerate(SKY_LOOKS):
    add('skies', str(i), f'{STYLE}{words}.{SKY_TAIL}', MAP)

# ---- Ring strips ----
RING_LOOKS = {
    'dusty': 'soft brown-grey dusty ring bands, wide faint stripes with one narrow dark gap, fine grain',
    'icy': 'bright white and pale blue icy ring bands, many sharp thin stripes of different brightness, glittering',
    'crystal': 'glittering pale violet, pink and clear crystal ring bands, sparkling stripes of different widths',
    'rainbow': 'soft bands of every rainbow colour, red, orange, yellow, green, blue and violet, glowing stripes of different widths',
    'double': 'two broad bright cream-and-gold ring bands, one on the left half and one on the right half, with a wide plain pure black gap in the middle between them',
}
for kind, words in RING_LOOKS.items():
    add('rings', kind, f'{STYLE}Cross-section of a planet\'s ring: {words}.{RING_TAIL}', (1536, 384))

# ---- Moon surfaces, index 0 to 7 ----
MOON_LOOKS_TEXT = [
    'a grey cratered moon like our Moon, pale highlands and darker smooth plains',
    'a dark basalt moon with huge black lava plains, a few bright craters and long ridges',
    'a white icy moon with a web of thin tan-brown cracks and a few smooth bright plains',
    'a sulphur-yellow volcanic moon with dark patches, orange vents and pale frost',
    'a rusty red moon with iron-coloured plains, deep craters and long shallow valleys',
    'a cream-coloured moon with long parallel grooves and ridges, and a few worn craters',
    'a blue-grey moon with many small craters and a few huge bright rayed craters',
    'a dusty brown pitted moon with rounded hills, small craters and pale dust drifts',
]
assert len(MOON_LOOKS_TEXT) == MOON_LOOKS
for i, words in enumerate(MOON_LOOKS_TEXT):
    add('moons', str(i), f'{STYLE}Seamless flat top-down surface texture map of {words}.{MOON_TAIL}', MAP)

# ---- Night maps (lights on black), by planet kind ----
CITY = 'a web of tiny warm orange-yellow city lights, bright clusters for big cities joined by thin glowing lines of road lights'
NIGHT_LOOKS = {
    'rocky': f'the night side of a rocky planet: {CITY}, spread across the land in patches',
    'desert': f'the night side of a desert planet: {CITY}, strung along rivers and around a few oases',
    'ocean': 'the night side of an ocean planet: small bright clusters of warm orange-yellow lights on island chains, with a few glowing blue sea-lanes between them',
    'jungle': f'the night side of a jungle planet: {CITY}, spread along rivers and lakes with dark gaps for forest',
    'eyeball': 'the night side of an eyeball world: a ring of warm orange-yellow city lights in a curved band across the middle of the map, a few lights beyond it',
    'cube': f'the night side of a cube planet: {CITY}, laid out in neat square grids of straight streets',
    'donut': f'the night side of a donut planet: {CITY}, in long curving chains',
    'ringworld': f'the night side of a ring world: neat bands of warm orange-yellow town lights and straight glowing roads running along its length',
    'lava': 'the night side of a lava world: branching rivers and lakes of bright orange and yellow glowing lava, with thin red cracks',
    'crystal': 'the night side of a crystal world: thin glowing veins and bright points of violet, blue and pink light spreading like a net',
}
for kind, words in NIGHT_LOOKS.items():
    add('night', kind, f'{STYLE}Seamless flat map of {words}.{NIGHT_TAIL}', MAP)

# ---- Life postcards: every life kind x its creature index (shared/trader/system.ts, LIFE[...].creatures) ----
CARDS: dict[str, list[str]] = {
    'microbes': [
        'a close view of a rock pool on an alien shore full of glowing green slime and tiny glowing blobs, gentle ripples, a soft pink sky with two small moons',
        'colourful microbe mats in rings of orange, yellow and turquoise round a steaming hot spring on a rocky alien plain, a twinkling sky',
        'close-up of a shallow warm rock pool at dusk, the water filled with swirling clouds of millions of tiny bright blue-green glowing specks, glowing ribbons of light in the water',
    ],
    'plants': [
        'a forest of tall green trees and giant ferns on an alien world under a warm yellow sun, a clear river, a large ringed planet in the pale sky',
        'a forest on an alien world under a small deep-red sun low on the horizon, the leaves are nearly black-purple to catch the red light, a glowing red sky, still and beautiful',
        'a forest on an alien world under a giant blue-white sun in a bright blue sky, the leaves are red and orange, tall flowers glow like lanterns',
    ],
    'sea': [
        'enormous gentle glowing whale-like creatures swimming through a deep blue sea, seen from under the water, shafts of light from above',
        'a drifting swarm of glowing jellyfish with long trailing ribbons in dark teal water, tiny lights in the dark',
        'a coral seafloor with round armoured crab-like creatures with big friendly eyes and brightly patterned shells, schools of small fish',
        'giant graceful manta-like gliders with wide wings gliding above a coral garden in clear turquoise water',
        'shoals of shining ribbon-shaped fish swirling in huge spirals round a tall underwater rock tower, sunbeams in the water',
    ],
    'animals': [
        'a herd of woolly six-legged grazing animals with curly horns on a grassy plain at sunrise, a gentle river and two moons in the sky',
        'tall gentle long-necked giants with soft patterned skin browsing the tops of purple trees at golden sunset',
        'a crowd of small round fluffy hopping creatures with huge ears and big eyes among glowing mushrooms and blue flowers',
        'a herd of striped horned animals galloping across a wide plain with a river and mountains behind, dust glowing gold, joyful',
        'flocks of tall feathered running birds with long colourful tails crossing a meadow beside a calm lake',
    ],
    'floaters': [
        'huge soft pink jelly-like creatures floating among glowing pink and gold clouds of a gas giant, little lights inside them, seen from above the clouds',
        'long ribbon-shaped creatures trailing through deep canyons of orange and cream cloud, soft light',
        'clusters of round balloon-like creatures with glowing bellies drifting between towers of white cloud, a far-off soft glow of lightning below',
        'wide flat sail-shaped creatures gliding side by side in a sky of deep blue and violet cloud, a bright small sun',
    ],
    'crystalfolk': [
        'friendly tall walking beings made of clear glowing crystal, tidy angular bodies with soft light inside, walking across a field of purple crystals at night',
        'small round crystal beings rolling and humming among tall pink crystal spires, rainbow light playing through them',
        'a circle of tall walking shapes made entirely of clear glowing blue crystal, faceted and see-through like living gemstones, standing among crystal pillars in a great hall of blue crystal, beams of coloured light',
    ],
    'robots': [
        'a shining robot town of round domed houses and neat lines of glowing lights on a desert plain at dusk, small friendly robots rolling along the streets',
        'friendly little round robot gardeners with big round lens eyes tending rows of glowing plants in a huge greenhouse field',
        'builder robots with many arms constructing a tall silver tower with cranes, warm light, a busy happy building site',
        'small round scout robots with antennae rolling across a red rocky landscape beside a landing pad, a big sky with two moons',
    ],
    'cities': [
        'a busy glowing city of tall towers with spaceships taking off into a violet evening sky, warm lights everywhere',
        'a floating city of white towers and green gardens on a cloud-top platform joined by bridges, a ringed planet in the sky',
        'a harbour city on a calm sea at night with a glowing waterfront, bridges and boats hung with lanterns',
        'a leafy city of treehouse towers high in giant trees, lanterns and walkways glowing at dusk, ships passing overhead',
    ],
}
for kind, scenes in CARDS.items():
    assert len(scenes) == LIFE_CREATURES[kind], kind
    for i, words in enumerate(scenes):
        add('postcards', f'{kind}-{i}', f'{STYLE}{words[0].upper() + words[1:]}.{CARD_TAIL}', (1344, 768))

# ---- Technology: cut-outs on white (rembg), and textures ----
TECH_CUT = {
    'satellite': 'a small satellite with two long blue solar panel wings and a round dish, scuffed silver body',
    'moonbase': 'a small moon base of linked white domes and a tall antenna with warm lit windows, seen from a slight angle',
    'station': 'a space station with a big rotating wheel, a long central spine, docking arms and solar panels, scuffed white metal',
    'telescope': 'a giant space telescope with a huge segmented gold mirror on a white support frame',
    'elevator': 'the top station of a space elevator: a chunky station with a thick cable running down from its underside, glowing windows',
    'dome': 'a clear glass dome habitat with green plants and a small town inside, a white metal base ring',
    'terraformer': 'a big white terraforming machine, a tall tower with huge fans and vents puffing green mist, on a wide base',
    'miner': 'a chunky asteroid mining ship with a big claw arm holding a lump of rock, orange and grey, floodlights',
    'sail': 'a space probe: a huge flat square sheet of shining gold foil, thin as paper, held flat by four long thin silver booms in an X, a small boxy silver probe at the centre',
    'trade-ship': 'a small round cargo ship with stacked cargo pods and blue engine glows, scuffed and weathered',
    'engine': 'a giant planet engine: a huge engine block with a wide glowing nozzle, braces and pipes, scuffed grey metal, built to push a world',
}
for name, words in TECH_CUT.items():
    add('tech', name, f'{STYLE}{words[0].upper() + words[1:]}.{CUT_TAIL}', (832, 832))
TECH_TEX = {
    'hull': ('Flat texture of scuffed, weathered grey spaceship hull plates with rivets, panel lines and small hatches', TILE_TAIL),
    'solar-panel': ('Flat texture of dark blue solar panel cells in a neat grid with thin silver lines and a faint shine', TILE_TAIL),
    'ring-strip': ('Flat texture of the outside of a huge space ring: grey metal plates with rows of tiny warm lit windows and long pipes', TILE_TAIL),
    'gate-frame': ('Flat texture of the metal of a giant star gate ring: carved silver-and-blue panels with glowing blue lines', TILE_TAIL),
    'gate-swirl': ('A swirling round portal of bright blue-white light, a glowing spiral tunnel, star-bright centre', GLOW_TAIL),
    'engine-flame': ('A long blue-white engine flame, bright white hot core fading to blue at the tip, pointing downwards', GLOW_TAIL),
    'lane-glow': ('A soft glowing horizontal streak of light with sparkles along it, gold in the middle fading to nothing at both ends', GLOW_TAIL),
    'tether': ('Flat texture of a thick space elevator cable: braided grey fibres with a bright thin line of light running along it, running from the top edge to the bottom edge', TILE_TAIL),
    'belt-rocky': ('Flat texture of grey-brown asteroid rock, rough and pitted with tiny craters and cracks', TILE_TAIL),
    'belt-icy': ('Flat texture of pale blue-white asteroid ice, rough and frosty with cracks and glittering bright spots', TILE_TAIL),
    'belt-golden': ('Flat texture of golden asteroid rock, rough with veins of shining gold and dark pits', TILE_TAIL),
}
for name, (words, tail) in TECH_TEX.items():
    add('tech', name, f'{STYLE}{words}.{tail}', (768, 768))

# ---- Forge button pictures (512 x 512 in the game). Names are the Forge picker's own groups and keys
# (src/games/trader/forge/Picker.tsx). The surface-<kind>-<n> and sky-<n> buttons are cut from the planet and sky maps by the tidy script. ----
BUTTONS: dict[str, str] = {
    # suns
    'sun-yellow': 'a glowing yellow star with a soft golden corona',
    'sun-red': 'a deep orange-red star with dark spots and a soft red glow',
    'sun-blue': 'a huge blinding blue-white star with long streamers of light',
    'sun-white': 'a tiny hard white star inside a faint glowing shell of old gas',
    'sun-pulsar': 'a spinning pale blue star with two narrow beams of light sweeping out from opposite sides',
    'sun-binary': 'two stars, one yellow and one orange, circling each other with a swirl of glowing gas between them',
    'sun-blackhole': 'a round black hole with a glowing orange swirling ring round it and bent starlight',
    'sun-baby': 'a young glowing star wrapped in a pink and orange cloud of dust and gas, sparkling',
    # planets
    'planet-rocky': 'a grey cratered rocky planet',
    'planet-desert': 'an orange-red desert planet with dunes and canyons',
    'planet-ice': 'a white and blue icy planet with cracks',
    'planet-ocean': 'a deep blue ocean planet with white swirling cloud',
    'planet-lava': 'a black planet with glowing orange rivers of lava',
    'planet-jungle': 'a green jungle planet with blue rivers and white cloud',
    'planet-gas': 'a banded orange and cream gas giant with a big storm spot',
    'planet-icegiant': 'a smooth blue-green ice giant planet',
    'planet-crystal': 'a planet covered in glittering purple crystals',
    'planet-toxic': 'a murky green-yellow swamp planet with swirling mist',
    'planet-eyeball': 'a planet that looks like an eye: a bright blue sunlit centre, a green ring, and white ice all round',
    'planet-shattered': 'a planet broken into big drifting pieces with glowing orange cracks',
    'planet-cube': 'a cube-shaped planet with green fields and blue lakes on its faces',
    'planet-donut': 'a donut-shaped planet with a hole through the middle, green land and blue seas',
    'planet-ringworld': 'a giant thin band built round a glowing star, a green and blue landscape on its inside',
    # rings
    'ring-dusty': 'a brown planet with soft dusty rings',
    'ring-icy': 'a pale blue planet with bright icy rings',
    'ring-crystal': 'a planet with sparkling pink and violet crystal rings',
    'ring-rainbow': 'a planet with rainbow-coloured rings',
    'ring-double': 'a planet with two wide golden rings and a dark gap between them',
    # effects
    'effect-aurora': 'green and pink curtains of aurora light over the pole of a planet',
    'effect-lightning': 'a stormy planet with bright forked lightning in its clouds',
    'effect-volcano': 'a glowing volcano erupting orange lava on the night side of a planet',
    'effect-geysers': 'tall white plumes of ice spraying up from the icy south pole of a small planet',
    'effect-meteors': 'bright meteors streaking and burning in the sky above a planet',
    'effect-glowseas': 'a planet with glowing blue-green seas shining on its night side',
    'effect-islands': 'a green island with a waterfall floating in the sky among clouds',
    'effect-tail': 'a planet streaming a long glowing tail of dust like a comet',
    # life
    'life-microbes': 'a rock pool full of glowing green microbes',
    'life-plants': 'a green planet with tall trees and ferns',
    'life-sea': 'a friendly glowing whale-like sea creature in blue water',
    'life-animals': 'a cute woolly six-legged grazing animal with curly horns',
    'life-floaters': 'a soft pink floating jelly creature in glowing clouds',
    'life-crystalfolk': 'a friendly walking being made of glowing purple crystal',
    'life-robots': 'a friendly little round robot with big round lens eyes',
    'life-cities': 'a glowing city of tall towers with a spaceship taking off',
    # technology (planet technology: group tech; system technology: group systemtech)
    'tech-satellites': 'two small satellites with blue solar wings orbiting a planet',
    'tech-moonbase': 'a small lit moon base of white domes on a grey moon',
    'tech-station': 'a space station with a big rotating wheel',
    'tech-telescope': 'a giant space telescope with a golden mirror',
    'tech-elevator': 'a space elevator, a thin thread rising from a planet to a station high above',
    'tech-domes': 'glass domes with green plants inside on a rocky planet',
    'tech-terraformer': 'a tall terraforming machine puffing green mist over barren ground',
    'tech-orbitalring': 'a thin metal ring built all the way round a planet, with tiny lights',
    'tech-engine': 'a planet with a giant engine on it and a long blue flame trailing behind',
    'systemtech-lanes': 'glowing golden trade lanes with small ships flying between two planets',
    'systemtech-miners': 'a mining ship with a claw arm grabbing an asteroid',
    'systemtech-sails': 'a ship with a huge shining gold solar sail',
    'systemtech-dyson': 'a star surrounded by a band of dark blue solar panels, light spilling from the gaps',
    'systemtech-gate': 'a giant ring-shaped star gate with a swirling blue portal in the middle',
    # belts, clouds, comets, planet sizes
    'belt-rocky': 'a belt of grey tumbling asteroid rocks curving round a star',
    'belt-icy': 'a belt of pale blue icy asteroids curving round a star',
    'belt-golden': 'a belt of golden shining asteroids curving round a star',
    'clouds-none': 'a clear planet with no clouds, sharp and bright',
    'clouds-thin': 'a planet with thin wispy white clouds',
    'clouds-thick': 'a planet wrapped in thick white clouds',
    'clouds-storms': 'a planet with swirling hurricane storms',
    'clouds-spot': 'a gas giant with one giant oval storm spot',
    'comets-1': 'one comet with a glowing head and a long bright tail',
    'comets-2': 'two comets with glowing heads and long bright tails crossing each other',
    'comets-3': 'three comets with glowing heads and long bright tails streaking in different directions',
    'size-0': 'a small blue-green planet drawn quite small in the middle of the square with plenty of space round it',
    'size-1': 'a medium blue-green planet in the middle of the square with some space round it',
    'size-2': 'a large blue-green planet filling most of the square',
    'size-3': 'a huge blue-green planet so big it fills the whole square and runs off the edges',
}
for key, words in BUTTONS.items():
    add('buttons', key, f'{STYLE}{words[0].upper() + words[1:]}.{BUTTON_TAIL}', (1024, 1024), refine=False)

# Sizes of the -hd paintings made with --hd-model (everything else is upscaled by the tidy script).
HD_TARGET = {'planets': (4096, 2048), 'clouds': (4096, 2048), 'night': (4096, 2048), 'skies': (8192, 4096)}

# A guess at seconds per picture on a gaming PC (the first picture of each run gives the real number).
SECONDS = {'planets': 22, 'clouds': 22, 'suns': 22, 'skies': 22, 'rings': 12, 'moons': 22, 'night': 22, 'postcards': 20, 'tech': 10,
           'buttons': 6, 'heights': 4}


# ---------------------------------------------------------------------------------------------
# ComfyUI
# ---------------------------------------------------------------------------------------------
def graph(text: str, seed: int, width: int, height: int, refine: bool, hd: tuple[str, tuple[int, int]] | None = None) -> dict:
    g: dict = {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': text}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
        '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': width, 'height': height, 'batch_size': 1}},
    }

    def sample(latent, denoise):
        return {'class_type': 'KSampler', 'inputs': {
            'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': latent, 'seed': seed, 'steps': 8, 'cfg': 1.0,
            'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': denoise}}

    g['8'] = sample(['7', 0], 1.0)
    g['9'] = {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}}
    last = ['9', 0]
    if refine:
        g['11'] = {'class_type': 'ImageScaleBy', 'inputs': {'image': ['9', 0], 'upscale_method': 'lanczos', 'scale_by': 1.5}}
        g['12'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['3', 0]}}
        g['13'] = sample(['12', 0], 0.4)
        g['14'] = {'class_type': 'VAEDecode', 'inputs': {'samples': ['13', 0], 'vae': ['3', 0]}}
        last = ['14', 0]
    if hd:
        model, (tw, th) = hd
        g['20'] = {'class_type': 'UpscaleModelLoader', 'inputs': {'model_name': model}}
        g['21'] = {'class_type': 'ImageUpscaleWithModel', 'inputs': {'upscale_model': ['20', 0], 'image': last}}
        g['22'] = {'class_type': 'ImageScale', 'inputs': {'image': ['21', 0], 'upscale_method': 'lanczos', 'width': tw, 'height': th, 'crop': 'disabled'}}
        last = ['22', 0]
    g['10'] = {'class_type': 'SaveImage', 'inputs': {'images': last, 'filename_prefix': 'trader-forge/img'}}
    return g


def call(path: str, body: dict | None = None, timeout: int = 60):
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def run_graph(g: dict, max_wait: int = 900) -> bytes:
    """Sends a graph, waits, and gives back the first picture it saved."""
    job = call('/prompt', {'prompt': g})['prompt_id']
    waited = 0
    while waited < max_wait:
        time.sleep(2)
        waited += 2
        done = call(f'/history/{job}').get(job)
        if done:
            if done.get('status', {}).get('status_str') == 'error':
                raise RuntimeError(f'ComfyUI reported an error: {json.dumps(done["status"].get("messages", ""))[:400]}')
            img = next(i for o in done['outputs'].values() for i in o.get('images', []))
            q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
            with urllib.request.urlopen(f'{COMFY}/view?{q}', timeout=180) as r:
                return r.read()
    raise RuntimeError('ComfyUI took too long')


def add_text(png: bytes, **entries: str) -> bytes:
    """Adds plain-text entries to a PNG (before its end marker), using only the standard library."""
    end = png.rfind(b'IEND') - 4
    chunks = b''
    for k, v in entries.items():
        data = k.encode('latin-1') + b'\0' + v.encode('latin-1', 'replace')
        chunks += struct.pack('>I', len(data)) + b'tEXt' + data + struct.pack('>I', zlib.crc32(b'tEXt' + data) & 0xFFFFFFFF)
    return png[:end] + chunks + png[end:]


def seed_for(key: str, attempt: int) -> int:
    return (zlib.crc32(key.encode()) + attempt * 104729) % 2**32


def check() -> dict:
    """Is ComfyUI up, and what depth and upscale models does it have? Exits with a plain message if it isn't reachable."""
    try:
        stats = call('/system_stats', timeout=10)
    except (urllib.error.URLError, OSError) as e:
        sys.exit(f'Cannot reach ComfyUI at {COMFY} ({e}).\nOn the gaming PC start ComfyUI with --listen 0.0.0.0 and check Tailscale is on.')
    dev = (stats.get('devices') or [{}])[0]
    print(f'ComfyUI is up. GPU: {dev.get("name", "?")}, free memory {dev.get("vram_free", 0) // 2**20} MB of {dev.get("vram_total", 0) // 2**20} MB.')
    info: dict = {'depth': None, 'upscalers': []}
    try:
        for node in ('DepthAnythingV2Preprocessor', 'DepthAnythingPreprocessor'):
            o = call(f'/object_info/{node}', timeout=20).get(node)
            if o:
                ck = o['input']['required'].get('ckpt_name')
                info['depth'] = (node, ck[0][0] if ck and isinstance(ck[0], list) and ck[0] else None)
                break
        up = call('/object_info/UpscaleModelLoader', timeout=20).get('UpscaleModelLoader')
        if up:
            info['upscalers'] = up['input']['required']['model_name'][0]
    except Exception as e:  # a missing node is not a problem
        print(f'  (could not list models: {e})')
    print('Depth model node:', info['depth'][0] if info['depth'] else 'not installed (the tidy script will make height maps from the pictures instead)')
    print('Upscale models:', ', '.join(info['upscalers']) if info['upscalers'] else 'none (the tidy script will upscale the -hd copies)')
    return info


def upload(path: Path) -> str:
    import uuid
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{path.name}"\r\nContent-Type: image/png\r\n\r\n').encode() + path.read_bytes() + \
           (f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{b}--\r\n').encode()
    req = urllib.request.Request(COMFY + '/upload/image', data=body, headers={'Content-Type': f'multipart/form-data; boundary={b}'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())['name']


def paint_heights(force: bool, info: dict) -> int:
    """Depth maps of the planet maps (heights/<kind>-<surface>.png), if the PC has a Depth Anything node. Returns how many were made."""
    if not info.get('depth'):
        print('heights: no Depth Anything node on the PC, skipped. The tidy script makes height maps from the pictures itself.')
        return 0
    node, ckpt = info['depth']
    made = 0
    for key, pic in PICTURES.items():
        if pic.group != 'planets':
            continue
        src, dest = INBOX / 'planets' / f'{pic.name}.png', INBOX / 'heights' / f'{pic.name}.png'
        if not src.exists() or (dest.exists() and not force):
            continue
        g = {'1': {'class_type': 'LoadImage', 'inputs': {'image': upload(src)}},
             '2': {'class_type': node, 'inputs': {'image': ['1', 0], **({'ckpt_name': ckpt} if ckpt else {}), 'resolution': 1024}},
             '3': {'class_type': 'SaveImage', 'inputs': {'images': ['2', 0], 'filename_prefix': 'trader-forge/height'}}}
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(run_graph(g, 300))
        print(f'  heights/{dest.name}', flush=True)
        made += 1
    return made


def paint(keys: list[str], force: bool, hd_model: str | None) -> list[str]:
    todo = []
    for key in keys:
        dest = INBOX / PICTURES[key].group / f'{PICTURES[key].name}.png'
        if dest.exists() and not force:
            continue
        todo.append(key)
    print(f'{len(todo)} to paint ({len(keys) - len(todo)} already in the inbox).', flush=True)
    if todo:
        est = sum(SECONDS.get(PICTURES[k].group, 20) for k in todo)
        print(f'Rough guess: {est // 60} minutes. The real speed shows after the first picture.', flush=True)
    failed, started, spent = [], time.time(), 0.0
    for n, key in enumerate(todo, 1):
        pic = PICTURES[key]
        dest = INBOX / pic.group / f'{pic.name}.png'
        dest.parent.mkdir(parents=True, exist_ok=True)
        attempt = 0
        if dest.exists():  # a remake: keep the old one, use a new seed
            old = dest.parent / '_old'
            old.mkdir(exist_ok=True)
            attempt = len(list(old.glob(f'{pic.name}-*.png'))) + 1
            dest.rename(old / f'{pic.name}-{attempt}.png')
        t0 = time.time()
        try:
            hd = (hd_model, HD_TARGET[pic.group]) if hd_model and pic.group in HD_TARGET else None
            png = run_graph(graph(pic.text, seed_for(key, attempt), *pic.size, pic.refine, hd))
            dest.write_bytes(add_text(png, forge_key=key, forge_prompt=pic.text, forge_seed=str(seed_for(key, attempt))))
        except (urllib.error.URLError, OSError) as e:
            print(f'  {key}: lost contact with ComfyUI ({e}). Start it again and re-run: finished pictures are skipped.')
            failed.append(key)
            break
        except Exception as e:  # one bad picture should not stop the run
            print(f'  {key}: failed ({e})')
            failed.append(key)
            continue
        spent += time.time() - t0
        left = (len(todo) - n) * spent / n
        print(f'  [{n}/{len(todo)}] {key}  {time.time() - t0:.0f}s  (about {left / 60:.0f} min left)', flush=True)
    print(f'Done in {(time.time() - started) / 60:.1f} minutes. {len(failed)} failed.' + (f' Re-run to retry: {", ".join(failed)}' if failed else ''))
    return failed


# ---------------------------------------------------------------------------------------------
# Listing (also used to write the prompt tables in docs/TRADER-SYSTEM-ART-PLAN.md)
# ---------------------------------------------------------------------------------------------
def markdown() -> str:
    out = []
    for group in GROUPS:
        items = [(k, p) for k, p in PICTURES.items() if p.group == group]
        out.append(f'### {group} ({len(items)})\n\n| File (in the inbox folder) | Painted at | Prompt |\n|---|---|---|')
        for k, p in items:
            w, h = (round(p.size[0] * 1.5), round(p.size[1] * 1.5)) if p.refine else p.size
            out.append(f'| `{k}.png` | {w} × {h} | {p.text} |')
        out.append('')
    return '\n'.join(out)


def counts() -> dict[str, int]:
    return {g: sum(1 for p in PICTURES.values() if p.group == g) for g in GROUPS}


def main(argv: list[str]) -> None:
    args = list(argv)
    if '--markdown' in args:
        print(markdown())
        return
    if '--list' in args:
        for k, p in PICTURES.items():
            print(f'{k}\n    {p.text}\n')
        print(', '.join(f'{g} {n}' for g, n in counts().items()), '= ', len(PICTURES))
        return
    if '--check' in args:
        check()
        return
    force = '--force' in args
    hd_model = None
    if '--hd-model' in args:
        i = args.index('--hd-model')
        hd_model = args[i + 1]
        del args[i:i + 2]
    only: list[str] = []
    if '--only' in args:
        i = args.index('--only')
        only = args[i + 1].split(',')
        del args[i:i + 2]
    names = [a for a in args if not a.startswith('--')]
    if only:
        keys = []
        for o in only:
            hits = [k for k in PICTURES if k == o or (('/' not in o) and k.endswith('/' + o))]
            if len(hits) != 1:
                sys.exit(f'"{o}" matches {len(hits)} pictures. Use group/name, for example planets/desert-2. Try --list.')
            keys.append(hits[0])
        check()
        paint(keys, True, hd_model)
        return
    groups: list[str] = []
    for n in names or ['batch1', 'batch2', 'batch3']:
        groups += BATCHES.get(n, [n])
    unknown = [g for g in groups if g not in GROUPS and g != 'heights']
    if unknown:
        sys.exit(f'Unknown group: {", ".join(unknown)}. Use: {", ".join(GROUPS)} heights batch1 batch2 batch3')
    info = check()
    failed = []
    for g in groups:
        if g == 'heights':
            paint_heights(force, info)
        else:
            failed += paint([k for k, p in PICTURES.items() if p.group == g], force, hd_model)
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1:])
