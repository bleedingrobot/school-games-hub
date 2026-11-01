#!/usr/bin/env python3
"""
Paints Sky Isles' pictures (docs/ISLES-ART-PLAN.md) in ComfyUI on James's gaming PC, in the hand-painted anime style
James chose. Runs on James's computer only, never in the site build. Standard library only.

  python3 scripts/isles-art.py paint OUT_DIR [name ...] [--tries 3]   # OUT_DIR/<name>-<try>.png; every name if none given
  python3 scripts/isles-art.py list                                   # the names

A picture already there is skipped, and seeds are fixed, so any try can be painted again exactly. ComfyUI must be
listening on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"). The graph is the one every hub painting
uses (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words change. Use only positive wording: this model draws
whatever a prompt names, even after "no".
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

STYLE = 'Lush hand-painted anime background art in gouache and watercolour, soft fluffy clouds, warm nostalgic sunlight, gentle detailed scenery. '
# The same look for pieces that are cut out, without the clouds and scenery the background wording paints behind them.
PIECE_STYLE = 'Hand-painted anime illustration in gouache and watercolour, warm sunlight, gentle detail, a single game piece. '
FRIENDLY = ' Cheerful and friendly, made for children aged 8 to 12.'
# Pieces are cut out later, so each is painted alone on white, seen from the same angle as the island bases.
PIECE = ' Seen from slightly above at a three-quarter view, the whole thing in view and centred, isolated on a plain flat pure white #FFFFFF background, nothing behind it, empty white all around the edges.'
SIDE = ' Side-on view facing right, the whole thing in view and centred, isolated on a plain flat pure white #FFFFFF background, nothing behind it, empty white all around the edges.'
CHARACTER = ' Full body in view and centred, isolated on a plain flat pure white #FFFFFF background, nothing behind it, empty white all around the edges.'

WIDE = (1344, 768)
SQUARE = (1024, 1024)

ISLAND = (
    'floating island drifting in the sky, its top a flat empty grassy meadow with soft green grass and a few wildflowers, '
    'its rocky brown underside tapering downwards with dangling roots and two small waterfalls spilling off the edge.'
)
CLEARINGS = (
    'floating island drifting in the sky, its grassy top a gentle meadow with {n} small round empty clearings of bare '
    'earth spread evenly across it, joined by winding dirt footpaths, a few small bushes and wildflowers between them. '
    'Its rocky brown underside tapers downwards with dangling roots and two small waterfalls spilling off the edge.'
)
# Buildings sit straight on a base's clearing, so each is painted with only a little grass at its foot.
ALONE = ' Standing alone, with only a few soft tufts of grass and a little earth right at its foot.'
BUILDINGS = {
    'farm': [
        'A single small barn with a red roof beside a few rows of golden wheat and a haystack.',
        'A single red barn with a hayloft beside a bigger field of golden wheat in neat rows, two haystacks and a wooden cart.',
        'A single big red barn with a silo and a little windmill, beside rich fields of tall golden wheat, haystacks and a vegetable patch.',
    ],
    'mine': [
        'A single small rocky hillock with a wooden-framed mine entrance and a little mine cart of shiny blue crystals.',
        'A single rocky hill with a sturdy timber mine entrance, rails, two mine carts of shiny blue crystals and a lantern.',
        'A single big rocky crag with a grand timber mine entrance, a little crane, rails, carts heaped with glowing blue crystals and lanterns.',
    ],
    'dock': [
        'A single short wooden jetty sticking out sideways into the air, with a small sky-boat with a red sail moored to it.',
        'A single wooden jetty with a little harbour hut and a rope post, a sky-boat with a red sail and a smaller boat moored to it.',
        'A single long wooden pier with a harbour master hut, glowing paper lanterns on posts, colourful bunting and two sky-boats with red sails moored to it.',
    ],
    'house': [
        'A single small cosy cottage with a red tiled roof, chimney smoke and a flower box.',
        'A single two-storey house with a red tiled roof, a balcony, chimney smoke and flower boxes.',
        'A single grand three-storey manor house with red tiled roofs, a little tower, many windows, chimney smoke and flower boxes.',
    ],
    'workshop': [
        'A single small timber woodworking shed with a slanted shingle roof and an open front, a stack of planks and a sawhorse beside it.',
        'A single timber workshop with a small windmill on its roof, stacks of planks and a half-built little boat hull beside it.',
        'A single big timber boatyard workshop with a windmill on its roof, a wooden crane and a nearly finished sky-boat with a sail beside it.',
    ],
    'library': [
        'A single little round stone library tower with a blue pointed roof and round windows.',
        'A single round stone library tower with a blue pointed roof, a reading balcony and a small telescope on top.',
        'A single tall stone library with two blue pointed towers, a big brass telescope, a star globe and stained-glass round windows.',
    ],
}
PIP = 'Pip, a friendly cute round white seagull mascot with a small blue scarf, a yellow beak and big kind eyes, '
BOAT = 'A small wooden sky-boat with {sail}, a little propeller at the back and small canvas wings on its sides, flying.'

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    # Island bases, Little to Grand (6, 8, 10, 13 and 16 building spots), each with painted clearings joined by paths.
    'base-1': ('A tiny ' + CLEARINGS.format(n='six') + PIECE, WIDE),
    'base-2': ('A small ' + CLEARINGS.format(n='eight') + PIECE, WIDE),
    'base-3': ('A medium-sized ' + CLEARINGS.format(n='ten') + PIECE, WIDE),
    'base-4': ('A large wide ' + CLEARINGS.format(n='thirteen') + PIECE, WIDE),
    'base-5': ('A huge grand wide ' + CLEARINGS.format(n='sixteen') + PIECE, WIDE),
    # A spot that's been claimed but not built on yet.
    'bld-empty': ('A little wooden marker post with a small blank sign, a coil of rope and a few stacked planks, ready to build.' + ALONE + PIECE, SQUARE),
    # Buildings at levels 1 to 3 (docs/ISLES-RULES.md), each standing on its own with no patch of land under it.
    **{f'bld-{kind}-{n}': (words + ALONE + PIECE, SQUARE) for kind, levels in BUILDINGS.items() for n, words in enumerate(levels, 1)},
    # Sky-boats.
    'boat-red': (BOAT.format(sail='a big billowing red sail') + SIDE, WIDE),
    'boat-blue': (BOAT.format(sail='a big billowing blue and white striped sail') + SIDE, WIDE),
    'boat-yellow': (BOAT.format(sail='a big billowing sunny yellow sail') + SIDE, WIDE),
    # Pip the sky-gull.
    'pip-wave': (PIP + 'standing and happily waving one wing hello.' + CHARACTER, SQUARE),
    'pip-point': (PIP + 'standing and pointing helpfully to the right with one wing, smiling.' + CHARACTER, SQUARE),
    'pip-cheer': (PIP + 'jumping for joy with both wings up in the air, little sparkles around.' + CHARACTER, SQUARE),
    'pip-think': (PIP + 'standing and thinking with one wing tip on its chin, looking curious.' + CHARACTER, SQUARE),
    # Backgrounds: simple, so the pieces on top stand out.
    'bg-island': ('A wide open sky high above a soft sea of clouds, gentle morning light from the upper left, a few tiny far-away floating islands near the horizon, lots of calm open sky in the middle.', WIDE),
    'bg-sky': ('A wide panoramic sky above a sea of clouds at sunrise, pink and gold light, many tiny far-away floating islands scattered in the distance, lots of open sky.', WIDE),
    'bg-race': ('A wide sky race course among soft clouds, a line of colourful pennant flags on floating poles curving away through the clouds, distant floating islands, bright sunny day, open sky in the middle.', WIDE),
}

# Sky Keepers: the portrait each pupil chooses to stand for them (docs/ISLES-PLAN.md, section 7). 20 boys and 20 girls,
# about 8 to 17, from the many backgrounds of a New Zealand classroom, each with a sky-adventurer look.
# The very words of the style James chose, so the portraits match the island and the sky.
PORTRAIT_STYLE = STYLE
PORTRAIT = (
    'A head and shoulders character portrait of {who}, smiling warmly and looking at the viewer, wearing {wearing}. '
    'A soft pale blue sky with a few soft clouds behind.'
)
KEEPERS = {
    'b01': ('an 8-year-old Maori boy with warm brown skin and short curly black hair and brown eyes', 'a green hoodie and a little brass compass on a cord'),
    'b02': ('an 8-year-old boy with fair skin and messy ginger hair and freckles', 'a red knitted jumper and a leather aviator cap pushed back'),
    'b03': ('a 9-year-old Samoan boy with brown skin and short black hair and a round cheerful face', 'a blue t-shirt with a coil of rope over one shoulder'),
    'b04': ('a 9-year-old Chinese boy with light skin and neat black hair and round glasses', 'a yellow raincoat'),
    'b05': ('a 10-year-old Indian boy with brown skin and wavy dark hair', 'an orange vest over a white shirt, with flying goggles round his neck'),
    'b06': ('a 10-year-old boy with very dark brown skin, deep cocoa-brown skin, a Tongan boy with a broad warm face and a tight short buzz cut', 'a teal sports jersey and a canvas satchel strap'),
    'b07': ('an 11-year-old boy with fair skin and straight blond hair', 'a navy pilot jacket and a striped scarf'),
    'b08': ('an 11-year-old Filipino boy with light brown skin and spiky black hair', 'a striped sailor top, with flying goggles on his forehead'),
    'b09': ('a 12-year-old Korean boy with light skin and neat side-parted black hair', 'a mustard cardigan and a map case strap'),
    'b10': ('a 12-year-old Maori boy with warm brown skin and long dark hair pulled back into a low ponytail, the hair tie visible', 'a black windbreaker and a greenstone pendant'),
    'b11': ('a 13-year-old boy with very dark brown skin, deep cocoa-brown skin, a Fijian boy with short tightly coiled black afro-textured curly hair', 'a denim jacket and a bandana round his neck'),
    'b12': ('a 13-year-old boy with fair skin and brown curly hair', 'a brown leather aviator jacket with a sheepskin collar'),
    'b13': ('a 14-year-old Somali boy with dark brown skin and short black hair', 'a green bomber jacket'),
    'b14': ('a 14-year-old Japanese boy with light skin and shaggy black hair', 'a white shirt with rolled sleeves and a red scarf'),
    'b15': ('a 15-year-old Cook Islands boy with brown skin and a short fade haircut', 'a bright orange sky-sailor jacket'),
    'b16': ('a 15-year-old boy with olive skin and dark wavy hair and a friendly grin', 'a blue knitted beanie and a grey coat'),
    'b17': ('a 16-year-old Sikh boy, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with brown skin and a navy turban', 'an olive field jacket'),
    'b18': ('a 16-year-old Niuean boy, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with rich brown skin and long curly hair', 'a shirt with a gentle tapa cloth pattern'),
    'b19': ('a 17-year-old Vietnamese young man, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with light tan skin and neat short hair', 'a dark green flight jacket with goggles round his neck'),
    'b20': ('a 17-year-old Maori young man, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with warm brown skin and a short tidy haircut', 'a red puffer vest over a white t-shirt'),
    'g01': ('an 8-year-old Maori girl with warm brown skin and curly dark hair in two puffs', 'a yellow raincoat'),
    'g02': ('an 8-year-old girl with fair skin and blonde pigtails and freckles', 'blue dungarees, with flying goggles on her head'),
    'g03': ('a 9-year-old Samoan girl with brown skin and long wavy black hair and a hibiscus flower behind her ear', 'a pink t-shirt'),
    'g04': ('a 9-year-old Indian girl with brown skin and a long black plait', 'a purple kurta top and a little brass compass on a cord'),
    'g05': ('a 10-year-old Chinese girl with light skin and a short bob and a fringe', 'a red quilted jacket'),
    'g06': ('a 10-year-old girl with very dark brown skin, deep cocoa-brown skin, a Tongan girl with thick tightly curly black hair tied back with a wide bright yellow fabric hair band', 'a teal hoodie'),
    'g07': ('an 11-year-old girl with fair skin and red wavy hair', 'a green knitted jumper and a scarf'),
    'g08': ('an 11-year-old Filipina girl with light brown skin and long straight black hair and a headband', 'a white blouse and a sky-blue vest'),
    'g09': ('a 12-year-old Korean girl with light skin and a high ponytail', 'a mustard raincoat with flying goggles round her neck'),
    'g10': ('a 12-year-old Maori girl with warm brown skin, a broad Polynesian face with a wide nose and full cheeks, and long wavy dark hair', 'a black jacket and a greenstone pendant'),
    'g11': ('a 13-year-old girl with very dark brown skin, deep cocoa-brown skin, a Fijian girl with short tightly coiled black afro-textured curly hair and a flower clip', 'an orange windbreaker'),
    'g12': ('a 13-year-old girl with fair skin and brown hair in a messy bun and glasses', 'a brown leather aviator jacket'),
    'g13': ('a 14-year-old Somali girl with dark brown skin, wearing a soft lilac hijab', 'a denim jacket'),
    'g14': ('a 14-year-old Japanese girl with light skin and long black hair and a fringe', 'a navy sailor-style coat and a red scarf'),
    'g15': ('a 15-year-old Cook Islands girl with brown skin and long curly hair and a flower crown', 'a patterned island shirt'),
    'g16': ('a 15-year-old girl with fair skin and short blonde hair', 'a green flight jacket'),
    'g17': ('a 16-year-old Indian girl, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with brown skin and long dark wavy hair', 'a maroon cardigan and a map case strap'),
    'g18': ('a 16-year-old Niuean girl, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with rich brown skin and long braids', 'a yellow zip-up jacket'),
    'g19': ('a 17-year-old Vietnamese young woman, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with light tan skin and shoulder-length hair', 'a white jacket and a blue scarf'),
    'g20': ('a 17-year-old Maori young woman, a tall older teenager who clearly looks 16 or 17, with a longer, more grown-up face, a stronger jaw, a longer neck and a more mature build, with warm brown skin and a tidy ponytail', 'a red puffer vest over a white t-shirt'),
}
for _id, (_who, _wearing) in KEEPERS.items():
    PICTURES[f'keeper-{_id}'] = (PORTRAIT.format(who=_who, wearing=_wearing), SQUARE)


def graph(text: str, seed: int, size: tuple[int, int]) -> dict:
    width, height = size
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'isles/img'}},
    }


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def paint(out: Path, names: list[str], tries: int):
    out.mkdir(parents=True, exist_ok=True)
    for n in range(1, tries + 1):
        for name in names:
            dest = out / f'{name}-{n}.png'
            if dest.exists():
                continue
            words, size = PICTURES[name]
            seed = (sum(map(ord, name)) * 7919 + n * 104729) % 2**32
            started = time.time()
            style = STYLE if name.startswith('bg-') else PORTRAIT_STYLE if name.startswith('keeper-') else PIECE_STYLE
            job = call('/prompt', {'prompt': graph(style + words + FRIENDLY, seed, size)})['prompt_id']
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
            print(f'  {dest.name}  {time.time() - started:.0f}s', flush=True)


if __name__ == '__main__':
    args = sys.argv[1:]
    tries = 3
    if '--tries' in args:
        i = args.index('--tries')
        tries = int(args[i + 1])
        del args[i:i + 2]
    if args[:1] == ['list']:
        print('\n'.join(PICTURES))
    elif args[:1] == ['paint'] and len(args) >= 2:
        unknown = [a for a in args[2:] if a not in PICTURES]
        if unknown:
            sys.exit(f'Unknown: {", ".join(unknown)}')
        paint(Path(args[1]), args[2:] or list(PICTURES), tries)
    else:
        sys.exit(__doc__)
