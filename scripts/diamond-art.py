#!/usr/bin/env python3
"""
Paints Diamond Drop's pictures (docs/DIAMOND-ART-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that can
reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Painting needs only the standard library. Tidying the chosen tries into the game's small WebP files
(src/games/diamond/art/paint/, read by art/paint.ts) needs Pillow, numpy and rembg (~/.cache/rembg-venv).

  python3 scripts/diamond-art.py paint OUT_DIR [names] [--tries 2]   # OUT_DIR/<name>-<try>.png
  ~/.cache/rembg-venv/bin/python scripts/diamond-art.py tidy [--force]   # picks (docs/diamond-art/picks.json) → the game
  python3 scripts/diamond-art.py paint /tmp/diamond-styles style-a style-b style-c   # the three style tries (one style for all)
  python3 scripts/diamond-art.py paint /tmp/diamond-levels level-1 level-2 …        # each level's background, in its own style

The graph is Clan Quest's (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words, sizes and seeds change. Seeds
are fixed, so a try can be painted again exactly. Use only positive wording: this model draws whatever a prompt names,
even after "no".
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# The three styles James chooses between (DIAMOND-ART-PLAN.md section 3, `{STYLE}`), worded positively.
STYLES = {
    'a': "Bright storybook painting for a children's picture book, soft painted edges, warm gentle light, rich happy colours, "
         'paper grain texture. ',
    'b': 'Rich dark painting with dramatic glowing light, every gem shining like a little lamp, deep soft shadows, glowing jewel '
         'colours, magical and friendly. ',
    'c': 'Clean flat vector illustration, crisp simple shapes with bold dark outlines, flat bright colours, very clear and '
         'readable, modern mobile game art. ',
}

# One level, the Glow-worm Cave, as the game shows it: a side-on cut-away with the winch at the top and a few things to grab.
CAVE = (
    'Side-on cut-away view of an underground glow-worm cave, wide landscape, suitable for children aged 8 to 12. '
    'Across the top is a rocky cave ceiling with strings of tiny glowing blue-green glow-worm lights hanging down. '
    'In the top middle a small wooden winch on a stone ledge holds a rope with an open three-pronged metal claw hanging below it, '
    'and beside it stands a small round brown kiwi bird wearing a yellow hard hat. '
    'Below, calm dark blue-green rock fills the scene, smooth and simple, with a few separate gems resting in it, spread apart: '
    'a clear white six-sided quartz crystal, a smooth round green jade pebble, a cluster of three purple amethyst spikes, '
    'an orange teardrop topaz, and two plain grey lumpy rocks. Each gem glows softly so it stands out clearly from the rock.'
)

# Each level's background has its own style (James, 2 Nov 2026); gems, rocks, the claw and Nugget keep one look everywhere.
LEVEL_STYLES = {
    1: 'Soft storybook watercolour painting, gentle washes of colour, light paper texture, bright and sunny. ',
    2: 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with fingerprint texture, soft studio light. ',
    3: 'Coloured pencil drawing on cream paper, visible pencil strokes and gentle cross-hatching, warm hand-drawn feel. ',
    4: 'Rich dark painting with dramatic glowing light, deep soft shadows, glowing blue-green colours, magical and calm. ',
    5: 'Stained glass mosaic artwork filling the whole picture edge to edge, see-through purple, blue and lilac glass pieces joined by dark lead lines, light shining through. ',
    6: 'Traditional Japanese woodblock print style, flat layered colour, fine carved lines, gentle wave patterns, calm blues. ',
    7: "Old explorer's notebook sketch, brown ink drawing with soft watercolour tint on aged parchment paper, neat hand-drawn detail. ",
    8: 'Layered paper-cut craft art, many stacked layers of coloured card with soft shadows between them, handmade and cosy. ',
    9: 'Bold comic book art, thick black ink outlines, bright flat colours, halftone dot shading, energetic and fun. ',
    10: 'Dreamy shimmering pastel painting, soft glowing rose, lilac and pearl colours, gentle sparkles, smooth simple shapes, magical and peaceful. ',
}

# DIAMOND-ART-PLAN.md section 4.2: (place, top band). Backgrounds are empty scenery: the gems, claw and Nugget go on top.
LEVELS = {
    1: ('dark brown crumbly topsoil with tiny roots and a few pebbles, a flat sunny meadow above', 'a bright blue sky, green grass line, a few daisies and a small wooden fence'),
    2: ('a slice through a bank of earth sculpted from modelling clay, many wavy stripes of orange, rust-red, cream and brown clay running across the whole picture right down to the bottom edge, little clay roots, pebbles and a curled pink clay worm near the left and right edges', 'a thin strip of green clay grass and a little pale blue sky'),
    3: ('a flat side-on slice through the ground like a science diagram, wavy layers of grey and tan rounded river gravel, sand and smooth pebbles stacked in bands running across the whole picture right down to the bottom edge, an old buried river bed of smooth stones near the bottom', 'a thin strip of green grass with a few reeds and a little pale sky'),
    4: ('a calm dark blue-green cave with soft rock walls, tiny glow-worm lights in strings on the ceiling', 'a rocky cave ceiling with glowing glow-worm threads hanging down'),
    5: ('a hollow cave made of soft purple-blue glass rock, with pale crystal shapes along the far left and right edges, and plain purple-blue glass pieces in the middle', 'a cave ceiling with a few crystal points and a flat stone ledge'),
    6: ('a still blue underground lake in a cave, calm teal water in the middle, wet rocky shores at the edges, soft reflections', 'a high cave ceiling with stalactites and a rocky ledge'),
    7: ('layered cream and brown rock with the outlines of ancient shells, ferns and a big spiral fossil at the edges, calm stone in the middle', 'a stone ceiling with a flat rock ledge'),
    8: ('warm rock with steaming turquoise hot pools at the edges, calm warm brown-orange rock in the middle, gentle steam', 'a rocky ceiling with warm mist and a flat ledge'),
    9: ('dark red-black rock with glowing orange cracks of lava at the edges and bottom, calm plain dark rock in the middle, only rock and lava', 'a dark rock ceiling with a few glowing drips and a bare stone ledge'),
    10: ('a magical round chamber deep underground with smooth plain rose-and-violet rock walls, calm soft rock in the middle, a faint pink glow rising from the bottom centre, a gentle heart-shaped curve of pale crystal along the outer edge', 'a smooth arched ceiling with faint sparkles and a stone ledge'),
}


def level_words(n: int) -> str:
    place, top = LEVELS[n]
    return (LEVEL_STYLES[n] + 'Empty background scenery for a children\'s game, suitable for ages 8 to 12. Side-on cut-away view of the ground: '
            f'{place}. The top fifth is {top}. The middle is calm, smooth and low-detail with soft colour so small objects placed on '
            'top will stand out, with detail only at the edges and the bottom. The scenery fills the whole picture edge to edge, and most of the picture is the underground part. Wide landscape.')


# name: (words, (width, height) before the 1.5x pass)
PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    'style-a': (STYLES['a'] + CAVE, (1216, 832)),
    'style-b': (STYLES['b'] + CAVE, (1216, 832)),
    'style-c': (STYLES['c'] + CAVE, (1216, 832)),
    # Level backgrounds: 1600 x 1000 after the 1.5x pass (near enough).
    **{f'level-{n}': (level_words(n), (1072, 672)) for n in LEVELS},
}

# Everything that isn't a level background shares one look on every level: Storybook (James, 2 Nov 2026).
STORY = STYLES['a']
# Cut-outs leave out the paper grain, which made the model paint a cream frame round them.
CUTOUT = "Bright storybook painting for a children's picture book, soft painted edges, warm gentle light, rich happy colours. "
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around, suitable for children aged 8 to 12.')
NUGGET = ('Nugget, a cute New Zealand kiwi bird: a big round egg-shaped body with shaggy hair-like brown feathers, no neck, a tailless '
          'round bottom, small dark eyes, and a very long slender pale beak like a drinking straw, as long as its whole body, '
          'curving gently down to the ground, tiny wings, thick strong grey legs and big feet, wearing a small yellow hard hat, ')

# DIAMOND-ART-PLAN.md section 4.1: each gem keeps its silhouette.
GEMS = {
    'quartz': 'a clear white tall six-sided quartz crystal with a pointed top, glassy, a little blue-white shine',
    'jade': 'a pale mint-green smooth rounded jade pebble, polished, soft and waxy, all smooth curves',
    'amethyst': 'a simple purple amethyst cluster of just three pointed crystals joined at the base, one tall in the middle and one shorter on each side',
    'topaz': 'a golden-orange teardrop shaped topaz gem, pointed at the top, round at the bottom, faceted and warm',
    'emerald': 'a deep green emerald-cut gem, a rectangle with four cut corners, stepped flat facets inside',
    'sapphire': 'a bright blue round brilliant-cut sapphire, seen from the top, many triangular facets, perfectly round',
    'ruby': 'a red triangle shaped trillion-cut ruby, flat and seen from the top, three straight equal sides with gently rounded corners, faceted and glowing',
    'fireOpal': 'an orange-red oval fire opal, smooth, with tiny flecks of yellow and red flame colour inside',
    'starSapphire': 'a dark blue smooth half-round dome star sapphire lying flat, with a thin white six-pointed star shining on its surface',
    'heartDiamond': 'a large white-pink sparkling heart-shaped diamond, many facets, bright sparkles, the finest gem in the world',
}

# Sections 4.4 to 4.6, 4.9 and 4.11 (worded positively): name -> words before the sprite line.
THINGS = {
    'rock-small': 'a small grey-brown rock, rounded and lumpy, a little moss, plain',
    'rock-medium': 'a medium grey-brown boulder, lumpy, with a few cracks and moss',
    'rock-big': 'a big heavy dark grey boulder, rough and cracked, a little moss, clearly big and heavy',
    'sack': 'a small tied brown cloth sack with a lumpy round bulge, a golden rope tie and a tiny sparkle, mysterious and friendly',
    'crab': 'a small friendly cave crab seen from the side, round orange-brown shell, two little eyes on stalks, two small claws raised, six legs, cute and smiling',
    'winch': 'a chunky wooden and iron winch with a big round drum wound with rope, a handle, mounted on a small stone base, seen from the front',
    'claw': 'a strong metal claw hanging downwards with three curved prongs spread wide open, a ring at the top for a rope, steel-grey with a yellow band',
    'boost-strong-winch': 'a small shiny winch with a big muscle-red drum and a lightning-bolt-shaped handle, strong and fast',
    'boost-lucky-charm': 'a golden four-leaf clover charm on a short chain, green leaves, tiny sparkle',
    'boost-extra-time': 'a round golden pocket watch with a plain blank cream face and two thick hands, a big green plus sign beside it, a tiny sparkle',
    'boost-rock-blaster': 'a stubby friendly brass toy cannon on little wheels with a bright blue spark at its tip',
    'winch-steam': 'a small brass steam-engine winch with a chimney, a round boiler and a big drum wound with rope, white puffs painted on the chimney',
    'winch-rocket': 'a winch built like a silver rocket on its side, red fins, a round window, the rope drum on the back, bright flame nozzle',
    'winch-snail': 'a giant friendly cartoon snail whose shell is a big wooden spool with thick brown rope coiled round and round it, smiling face, antennae',
    'winch-pirate': 'a wooden pirate ship steering wheel with eight spokes and handles, fixed on a post, wound with rope',
    'winch-hamster': 'a metal hamster wheel on a stand with a happy brown hamster running inside, the rope wound round the axle',
    'icon-sparkles': 'a cluster of bright golden four-pointed sparkles of different sizes',
    'icon-bubbles': 'a group of shiny see-through soap bubbles of different sizes with rainbow shine',
    'icon-flames': 'a friendly orange and yellow flame with a red edge',
    'icon-confetti': 'a burst of colourful confetti pieces and ribbons',
    'icon-music': 'a few bright blue and pink music notes of different sizes',
    'icon-fireworks': 'a firework bursting in red, gold and blue streaks',
    'icon-disco': 'a silver mirror disco ball with small square mirrors and tiny light beams',
    'icon-gem-rain': 'small coloured gems falling like raindrops from the top, red, blue, green and yellow',
    'icon-trumpet': 'a shiny brass trumpet with three small music notes coming from it',
    'icon-happy-dance': 'a tiny round brown kiwi bird with a very long thin beak like a drinking straw, in a yellow hard hat dancing with one foot up and wings out, small hearts and stars round it',
    'icon-gem-rain-deluxe': 'a shower of many sparkling gems of all colours falling, with golden sparkles and a bright shine',
}

NUGGET_POSES = {
    'wave': 'waving one wing high, happy open-beak smile, standing',
    'point': 'pointing one wing out to the side as if showing the way, bright eyes, standing',
    'cheer': 'both wings thrown up in the air, jumping with joy, tiny sparkles round',
    'oops': 'both wings on the hat, cheeks puffed, a wobbly worried smile, a sweat drop, kind and funny',
}

HATS = {
    'pirate': 'a black pirate hat with a white skull-and-crossbones badge',
    'crown': 'a golden crown with red and blue jewels',
    'wizard': 'a tall purple pointed wizard hat with gold stars and a floppy tip',
    'chef': "a tall white puffy chef's hat",
    'astronaut': 'a round clear glass astronaut helmet with a white collar, the beak poking out through a small opening',
    'top-hat': 'a tall black top hat with a red ribbon',
    'miner-lamp': 'a yellow hard hat with a bright round lamp on the front shining a warm light',
}

# Section 4.7. Only the open claw is painted: the game squeezes it shut when it grabs, so the two always match
# (painting a closed one too gave a different object or one still open, 2 Nov 2026).
HEADS = {
    'golden': 'a gleaming solid gold three-pronged claw with a little ruby in the middle, prongs spread wide',
    'dino': 'a green cartoon dinosaur head with big friendly teeth, hanging upside down by a ring on top of its head, jaws wide open',
    'robot': 'a chunky grey robot hand with three metal fingers, blue lights and rivets, fingers spread',
    'crab': 'just the pincer of a crab on its own, shaped like a big letter V: two thick curved orange shell fingers with white tips, pointing downwards, open wide',
    'octopus': 'just one long curling purple tentacle on its own, the tentacle only, with two rows of round suckers, hanging straight down, its tip curled open',
    'magnet': 'a giant red horseshoe magnet hanging with its curved top up and its two silver tips pointing down, with a small sparkle glow at the tips',
    'chicken': 'a floppy yellow rubber chicken toy hanging upside down by its feet, its head at the bottom, funny face, wings stretched wide',
    'fork': 'a huge silver dinner fork with three long tines, hanging handle up with the tines pointing down, tines spread slightly apart',
    'dragon': 'one small scaly black and red dragon foot with three curved golden-tipped talons spread wide, pointing downwards, the whole foot visible with white space above it',
    'ice': 'a three-pronged claw made of clear pale blue ice crystals with frost sparkles, pointing downwards, crystal prongs apart',
    'glove': 'a big white cartoon glove with a red cuff, hanging by its cuff, hand open flat, fingers spread',
    'diamond': 'a three-pronged claw made of clear sparkling diamond facets with a rainbow shine, pointing downwards, prongs spread wide',
}

# Section 4.8: tall narrow tiles, the rope down the middle. Laser Beam is drawn in code as a glowing line: every painted try
# came out as a dotted strip.
ROPES = {
    'rainbow': 'a thick twisted rope in red, orange, yellow, green, blue and purple strands',
    'vine': 'a green jungle vine with small leaves and curling tendrils',
    'sausage': 'a chain of pink-brown linked sausages, funny and plump',
    'spaghetti': 'a long strand of cooked yellow spaghetti, wavy and glossy',
    'candy': 'a rope of red and white candy-cane stripes, glossy',
    'bike': 'a silver bicycle chain with shiny links',
    'star': 'a golden cord with little five-pointed stars along it',
}

SQUARE = (832, 832)
PICTURES |= {
    **{f'gem-{g}': (CUTOUT + w.capitalize() + '.' + SPRITE, SQUARE) for g, w in GEMS.items()},
    **{f'book-{g}': (STORY + w.capitalize() + ', large, resting on a small cushion of dark rock and moss, soft glow behind it, '
                     'the whole gem in the middle, calm plain dark-to-light background.', SQUARE) for g, w in GEMS.items()},
    **{name: (CUTOUT + w.capitalize() + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    **{f'nugget-{p}': (CUTOUT + NUGGET + w + '.' + SPRITE, SQUARE) for p, w in NUGGET_POSES.items()},
    **{f'hat-{h}': (CUTOUT + NUGGET.replace('wearing a small yellow hard hat, ', '') + 'standing and smiling, waving one wing, wearing '
                    + w + '.' + SPRITE, SQUARE) for h, w in HATS.items()},
    **{f'head-{h}': (CUTOUT + w.capitalize() + ', hanging from a small metal ring at the top.' + SPRITE, SQUARE) for h, w in HEADS.items()},
    **{f'rope-{r}': (CUTOUT + w.capitalize() + ', seen straight on, running vertically down the middle of a tall narrow picture from the very '
                     'top edge to the very bottom edge, plain pure white background on both sides, an even repeating pattern.', (448, 1344))
       for r, w in ROPES.items()},
    'stall': (CUTOUT + 'A little wooden market stall with a striped red and white awning, shelves with jars of coloured gems and an empty '
              'wooden counter, friendly and cosy, seen from the front.' + SPRITE, (1024, 720)),
    'map': (STORY + 'Tall portrait cut-away of the ground showing ten thin separate layers of equal height from top to bottom: green meadow topsoil, orange clay, grey '
            'river gravel, a dark cave with glow-worms, a purple crystal hollow, a blue underground lake, a layer of cream fossils, '
            'steaming hot springs, red lava rock, and at the very bottom a glowing pink heart-shaped chamber with a tiny diamond; each '
            'layer is a clear horizontal band with a wavy edge, a small wooden winch on the grass at the top.', (832, 1248)),
    'card': (STORY + 'A cross-section of the ground like a slice of layer cake, seen from the side: a sunny green meadow at the top with a little wooden winch and a shiny claw hanging on a '
             'rope, below it coloured layers going down through orange clay, grey gravel, a glowing cave with glow-worms, purple '
             'crystals, a blue lake, and at the very bottom a shining pink heart-shaped diamond; gems of many colours and shapes set in '
             'the layers; calm blue sky at the top, wide landscape.', (1216, 688)),
}


def graph(text: str, seed: int, width=1024, height=1024) -> dict:
    base = {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': text}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
        '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': width, 'height': height, 'batch_size': 1}},
    }
    sample = lambda latent, denoise: {'class_type': 'KSampler', 'inputs': {
        'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': latent, 'seed': seed, 'steps': 8, 'cfg': 1.0,
        'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': denoise}}
    return {
        **base,
        '8': sample(['7', 0], 1.0),
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '11': {'class_type': 'ImageScaleBy', 'inputs': {'image': ['9', 0], 'upscale_method': 'lanczos', 'scale_by': 1.5}},
        '12': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['3', 0]}},
        '13': sample(['12', 0], 0.4),
        '14': {'class_type': 'VAEDecode', 'inputs': {'samples': ['13', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'diamond/img'}},
    }


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def paint(out: Path, names: list[str], tries: int):
    out.mkdir(parents=True, exist_ok=True)
    for name in names:
        for n in range(1, tries + 1):
            dest = out / f'{name}-{n}.png'
            if dest.exists():
                continue
            # Fixed seeds, so a try can be painted again exactly.
            seed = (sum(map(ord, name)) * 7919 + n * 104729) % 2**32
            job = call('/prompt', {'prompt': graph(PICTURES[name][0], seed, *PICTURES[name][1])})['prompt_id']
            for _ in range(300):
                time.sleep(2)
                done = call(f'/history/{job}').get(job)
                if done:
                    break
            else:
                sys.exit(f'{dest.name}: ComfyUI took too long')
            img = next(i for o in done['outputs'].values() for i in o.get('images', []))
            q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
            with urllib.request.urlopen(f'{COMFY}/view?{q}', timeout=60) as r:
                dest.write_bytes(r.read())
            print(f'  {dest.name}', flush=True)


# ---- Tidying: the chosen try of each picture → src/games/diamond/art/paint/<group>/<game name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'diamond' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'diamond-art'

# Painting name → the Workshop item it shows (shared/diamond/workshopItems.ts).
ITEM_IDS = {
    'head': {'golden': 'golden-claw', 'dino': 'dino-jaw', 'robot': 'robot-hand', 'crab': 'crab-pincer', 'octopus': 'octopus-arm',
             'magnet': 'giant-magnet', 'chicken': 'rubber-chicken', 'fork': 'giant-fork', 'dragon': 'dragon-talon',
             'ice': 'ice-crystal-claw', 'glove': 'grabby-glove', 'diamond': 'diamond-claw'},
    'rope': {'rainbow': 'rainbow-rope', 'vine': 'jungle-vine', 'sausage': 'sausage-chain', 'spaghetti': 'spaghetti',
             'candy': 'candy-cane', 'bike': 'bike-chain', 'star': 'star-rope'},
    'winch': {'steam': 'steam-engine', 'rocket': 'rocket-winch', 'snail': 'giant-snail', 'pirate': 'pirate-ship-wheel',
              'hamster': 'hamster-wheel'},
    'hat': {'pirate': 'pirate-hat', 'crown': 'crown', 'wizard': 'wizard-hat', 'astronaut': 'astronaut-helmet', 'top-hat': 'top-hat', 'chef': 'chefs-hat',
            'miner-lamp': 'miner-lamp'},
    'icon': {'sparkles': 'sparkles', 'bubbles': 'bubbles', 'flames': 'flames', 'confetti': 'confetti', 'music': 'music-notes',
             'fireworks': 'fireworks', 'disco': 'disco-ball', 'gem-rain': 'gem-rain', 'trumpet': 'trumpet-fanfare',
             'gem-rain-deluxe': 'gem-rain-deluxe', 'happy-dance': 'happy-dance'},
    'boost': {'strong-winch': 'strongWinch', 'lucky-charm': 'luckyCharm', 'extra-time': 'extraTime', 'rock-blaster': 'rockBlaster'},
}


def destination(name: str) -> tuple[str, str, str] | None:
    """(kind of tidying, folder, file name in the game) for a painting, or None when the game doesn't use it (the map and
    the home card wait for later)."""
    if name.startswith('level-'):
        return 'scene', 'levels', name.split('-')[1]
    for pre, folder in (('gem-', 'gems'), ('book-', 'book')):
        if name.startswith(pre):
            return ('cut' if folder == 'gems' else 'square'), folder, name[len(pre):]
    if name in ('rock-small', 'rock-medium', 'rock-big', 'sack', 'crab', 'winch', 'claw', 'stall'):
        return 'cut', 'field', name
    if name.startswith('nugget-'):
        return 'cut', 'nugget', name[len('nugget-'):]
    group, _, key = name.partition('-')
    item = ITEM_IDS.get(group, {}).get(key)
    if not item:
        return None
    return ('rope' if group == 'rope' else 'cut'), {'head': 'heads', 'rope': 'ropes', 'winch': 'winches', 'hat': 'hats',
                                                     'icon': 'icons', 'boost': 'boosts'}[group], item


# Level paintings with a border round them (glass, a paper card), trimmed off by this share of the width.
TRIM = {'level-5': 0.05, 'level-8': 0.075}

# Things with a hole in the middle, where the cut-out keeps the white.
HOLLOW = {'head-magnet'}

SIZES = {'gems': 256, 'book': 320, 'field': 320, 'nugget': 320, 'heads': 256, 'winches': 320, 'hats': 320, 'icons': 160, 'boosts': 160}


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = None
    picks = json.loads((ROOT / 'docs' / 'diamond-art' / 'picks.json').read_text())

    def save(img, out: Path, quality: int):
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, 'WEBP', quality=quality, method=6)
        print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB', flush=True)

    def fit(img, size: int):
        img = img.copy()
        img.thumbnail((size, size), Image.LANCZOS)
        return img

    def trim(img, pad=4):
        a = np.asarray(img)[..., 3] > 40
        ys, xs = np.where(a)
        return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))

    for name, t in picks.items():
        where = destination(name)
        if not where:
            continue
        kind, folder, out_name = where
        src = INBOX / ('levels' if kind == 'scene' else 'items') / f'{name}-{t}.png'
        out = GAME_ART / folder / f'{out_name}.webp'
        if out.exists() and not force:
            continue
        img = Image.open(src)
        if kind == 'scene':
            img = img.convert('RGB')
            if name in TRIM:  # a border painted round it
                m = round(img.width * TRIM[name])
                img = img.crop((m, m, img.width - m, img.height - m))
            save(fit(img, 1600), out, 72)
            save(fit(img, 800), GAME_ART / folder / f'{out_name}-800.webp', 70)
        elif kind == 'square':
            save(fit(img.convert('RGB'), SIZES[folder]), out, 80)
        elif kind == 'rope':
            # White to see-through, keep the middle strip the rope runs down, and cross-fade the ends so the tile repeats.
            whole = np.asarray(img.convert('RGB'), dtype=np.float32)
            h = whole.shape[0]
            k = h // 10
            fade = np.linspace(0, 1, k)[:, None, None]
            a = whole[:h - k].copy()
            a[:k] = whole[h - k:] * (1 - fade) + whole[:k] * fade
            # The paper colour (white or cream) from the outer strips; anything close to it goes see-through.
            w = a.shape[1]
            paper = np.median(np.concatenate([a[:, :w // 8], a[:, -w // 8:]], axis=1).reshape(-1, 3), axis=0)
            alpha = np.clip((np.abs(a - paper).max(axis=2) - 14) / 30, 0, 1) * 255
            cols = np.where(alpha.mean(axis=0) > 25)[0]
            x0, x1 = max(0, cols.min() - 4), min(a.shape[1], cols.max() + 5)
            rgba = np.dstack([a, alpha])[:, x0:x1].round().astype(np.uint8)
            tile = Image.fromarray(rgba, 'RGBA')
            save(tile.resize((round(tile.width * 256 / tile.height), 256), Image.LANCZOS), out, 82)
        else:
            if session is None:
                session = new_session('isnet-general-use')
            cut = remove(img.convert('RGB'), session=session, alpha_matting=True)
            if name in HOLLOW:  # white showing through a gap the cut-out filled in
                px = np.asarray(cut).copy()
                white = (px[..., :3].min(axis=2) > 232) & (np.ptp(px[..., :3], axis=2) < 18)
                px[white, 3] = 0
                cut = Image.fromarray(px, 'RGBA')
            cut = trim(cut)
            save(fit(cut, SIZES[folder]), out, 82)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['tidy']:
        tidy('--force' in args)
        sys.exit()
    if len(args) < 2 or args[0] != 'paint':
        sys.exit(__doc__)
    tries = 2
    if '--tries' in args:
        i = args.index('--tries')
        tries = int(args[i + 1])
        del args[i:i + 2]
    paint(Path(args[1]), args[2:] or list(PICTURES), tries)
