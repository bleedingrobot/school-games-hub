#!/usr/bin/env python3
"""
Paints Toon Flap's pictures (docs/TOON-FLAP-ART-PLAN.md) in ComfyUI on James's gaming PC, over Tailscale. Never part of
the site build. Painting needs only the standard library; tidying needs Pillow, numpy and rembg (~/.cache/rembg-venv).

  python3 scripts/toonflap-art.py paint OUT_DIR [names or prefixes] [--tries 2]   # OUT_DIR/<name>-<try>.png
  ~/.cache/rembg-venv/bin/python scripts/toonflap-art.py tidy [--force]          # docs/toonflap-art/picks.json -> the game

The graph is Diamond Drop's (Z-Image Turbo, 8 steps, a 1.5x second pass). Seeds are fixed, so a try can be painted again
exactly; a flyer's poses share one seed so they look alike. Prompts describe each level's style in words (art plan 1a) and
never name a show or studio. Wording is positive only: this model draws whatever a prompt names, even after "no".
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'
KIDS = " Children's cartoon art, friendly and fun, wordless, every character an original design."

# Art plan section 1a: each level's look, for scenery (back layers) and for things (walls, flyers, extras).
SCENE = {
    1: 'Flat modern preschool TV cartoon background painting, simple soft flat shapes with no outlines, warm soft pastel colours: '
       'pale sky blue, soft grass green, warm cream, terracotta roofs, gentle blue-grey shadows, one soft shadow tone, a light gentle '
       'gradient in the sky, a calm sunny suburban afternoon. ',
    2: 'Classic 1950s theatrical cartoon short background, hand-painted gouache with soft dry-brush texture and no outlines, burnt '
       'orange, ochre, dusty pink and purple-shadowed mesas under a pale yellow sky, strong perspective, zany slapstick energy. ',
    3: 'Zany undersea TV cartoon art, very bright saturated colours: ocean blue, sand yellow, coral pink, lime green and purple, '
       'medium-thick slightly wobbly black outlines on everything, goofy lopsided rubbery shapes, flat colour with simple one-tone '
       'shadows, flat flower-shaped clouds floating in the water in pale blue-green and pink. ',
    4: 'Classic 1940s cel-animation cartoon background, richly painted mid-century interior with soft light and real shadows and no '
       'outlines, warm wood brown, cream walls, mint green, deep red and cheese gold, everything enormous, seen from floor level. ',
    5: '1990s American prime-time sitcom cel animation background art, hand-drawn with thin slightly wobbly dark brown outlines, flat '
       'cel colours with one hard-edged darker shadow tone, warm saturated palette of salmon pink, mint green, mustard, tan, '
       'orange and lilac, a clean cyan-blue sky with big soft fluffy white clouds that have no outlines, a 1960s American suburb at '
       'normal human scale seen from street level, wide lawns, telephone poles with sagging wires, rounded old cars, lumpy trees. ',
    6: '1970s Saturday-morning mystery cartoon background, moody painted night scene with soft watercolour-like gradients and no '
       'outlines, deep indigo, teal fog, sickly green, orange lamp glow and purple shadows, silly-spooky and not scary. ',
    7: 'Construction-paper cut-out animation, every shape a flat piece of coloured paper with slightly uneven cut edges, no outlines, '
       'faint paper texture and tiny drop shadows between layers, snow white, grey-blue mountains, pine green, paper sky blue, '
       'red and yellow, very simple and deliberately crude. ',
    8: 'Painterly anime-inspired adventure cartoon background, rich warm volcanic palette: lava orange, deep red, dark basalt, gold, '
       'soft steam white and a distant teal sea, soft atmospheric light, curling stylised flames and steam like brush calligraphy. ',
    9: 'Classic Japanese TV anime cel art, crisp black outlines, two-tone hard-edged cel shading, neon night colours: navy, hot pink, '
       'cyan, electric purple and window yellow, glowing lights, rounded retro-futuristic shapes. ',
    10: '1960s space-age TV cartoon art, clean thin black outlines, flat colour with simple gradients and starburst highlights, '
        'atomic-age Googie shapes, boomerang curves and starbursts, deep space blue with teal, atomic orange, cream and pale lilac. ',
}
THING = {
    1: 'Flat modern preschool TV cartoon style, simple soft rounded flat shapes with no outlines, a slightly darker edge colour, warm soft '
       'pastel colours, one soft shadow tone. ',
    2: 'Classic 1950s theatrical cartoon style, thick-to-thin brush ink outlines, flat colour, bold stretchy squash-and-stretch shapes, '
       'big expressive eyes with black pie-cut pupils, zany slapstick energy. ',
    3: SCENE[3].replace(', flat flower-shaped clouds floating in the water in pale blue-green and pink', '') + 'Big round eyes. ',
    4: 'Classic 1940s cel-animation cartoon style, soft dark-brown outlines, soft painted shading, large oval eyes, elastic and fluid. ',
    5: '1990s American prime-time sitcom cel animation style, thin even dark brown outlines, flat cel colours with one hard-edged '
       'shadow tone, characters with huge round bulging white eyes that touch each other with tiny dot pupils and a big overbite and a round bulb '
       'nose and no chin and thin arms and legs and four-fingered hands and pale peach skin and a gormless happy grin. ',
    6: '1970s Saturday-morning mystery cartoon style, thick black outlines, flat colour, simple limited-animation poses, oval eyes. ',
    7: 'Construction-paper cut-out animation style, every shape a flat piece of coloured paper with slightly uneven cut edges, no '
       'outlines, faint paper texture and tiny drop shadows between layers, very simple and deliberately crude. Two touching round white '
       'eyes with dot pupils. ',
    8: 'Anime-inspired adventure cartoon style, fine clean outlines, cel shading with one shadow tone, rich warm lava orange, deep red '
       'and gold, curling stylised flames. ',
    9: SCENE[9] + 'Big sparkly eyes with highlights. ',
    10: SCENE[10].replace('deep space blue with ', ''),
}
import re as _re
# Walls and ground rows use the look without any eye or character wording: with it, the model gave every rock a face.
PROP = {n: _re.sub(r'(,\s*|\.\s*)?[^,.]*\b(eyes|hands|poses|expressive|slapstick|elastic)\b[^,.]*', '', t).strip(' ,.') + '. '
        for n, t in THING.items()}
SCENERY = " Children's cartoon art, wordless, plain still objects and scenery only."
PLAIN = 'Bright clean modern children\'s cartoon style, bold smooth dark outlines, flat bright colours with soft shading. '

SPRITE = (' The whole thing visible with space around it, centred, on a plain pure white background, clean empty white all around.')
FLYING = ' Side view facing right, flying, ' + SPRITE.strip()

# name: (back layer, middle layer row, wall)
WORLDS = {
    1: ('a wide sunny suburban backyard, a wooden house on stilts with a veranda and lattice, pale-trunked gum trees, rolling lawn, '
        'a soft sunny sky', 'a row of white picket fence, round bushes and giant smiling sunflowers along the ground',
        'a very tall thick cream wooden fence post with a pointed top, wrapped in green sunflower leaves, with a big bright yellow sunflower on top'),
    2: ('a wide desert canyon with flat-topped mesas, tall skinny impossible rock towers in the distance and a long straight dusty road',
        'a row of flat stylised cactus, orange boulders and small rock stacks along the ground',
        'a very tall skinny red rock tower with a flat top and wobbly layered sides'),
    3: ('a wide undersea cartoon town of goofy lopsided coral houses with round porthole windows, sand, bubbles, flower-shaped clouds '
        'in the water above', 'a row of wavy cartoon kelp, round sea plants, shells and coral lumps along the sea floor',
        'a very tall pink coral tower with knobbly round branches and round holes'),
    4: ('a huge cosy empty kitchen seen from floor level, giant table and chair legs, cupboards, a black and white checked floor, '
        'a little arched mouse hole in the skirting board', 'a row of giant cheese wedges, a fallen spoon, tins and cups along the floor',
        'a very tall polished wooden table leg with a big wedge of holey yellow cheese on top'),
    5: ('a sunny suburban street seen flat side-on from across the road, a long row of 1960s split-level houses in salmon, mint and tan facing the viewer side by side, big front lawns, telephone poles and wires, lumpy '
        'green trees, rolling hills behind and a far-off power station with two grey cooling towers', 'a row of lumpy green hedges, '
        'mailboxes on posts, a fire hydrant and a short white picket fence along the footpath',
        'a very tall thick round advertising pillar with pink and lilac stripes and a little round dome on top'),
    6: ('a creaky crooked haunted mansion on a hill under a big full moon, a purple night sky, bare twisty trees and drifting fog',
        'a row of crooked gravestones, pumpkins, bare twisty bushes and a broken iron fence along the ground',
        'a very tall crooked brick chimney leaning a little, with a lopsided top'),
    7: ('a snowy mountain town with big grey-blue paper mountains, little paper houses with snowy roofs and paper pine trees',
        'a row of paper pine trees and snowy paper bushes along the snowy ground',
        'a very tall paper chimney stack with a cap of white paper snow on top'),
    8: ('a tropical volcano island with a big smoking volcano, glowing lava pools, temple roofs on terraced cliffs and steam, a teal sea',
        'a row of dark lava rocks, glowing lava pools, curling steam and tropical ferns along the ground',
        'a very tall dark lava rock pillar with glowing orange cracks and a carved stone temple cap on top'),
    9: ('a neon night city skyline of tall rounded retro-futuristic towers, sky-bridges, tubes, glowing windows and flying cars',
        'a row of small neon-lit buildings, glowing pipes and little signal lights along the bottom',
        'a very tall thick rounded skyscraper tower block, navy with rows of glowing yellow windows and pink and cyan neon stripes, a short antenna on top'),
    10: ('a starry outer space sky with big ringed planets and flying-saucer houses on tall stilts floating on little asteroids',
         'a row of small cratered asteroids and little bubble-dome houses along the bottom',
         'a very tall thick round space tower of orange and teal metal panels with round portholes and a glowing bubble dome on top'),
}

# Art plan section 5a. (level style, rider and craft). Riders are our own made-up characters.
FLYERS = {
    'fantail': (None, 'a cute round cartoon New Zealand fantail bird, grey-brown back, cream-yellow belly, a white eyebrow stripe, big '
                'friendly cartoon eyes, a tiny beak and a big spread fan-shaped tail with white edges'),
    'rainbow': (None, 'a cute round cartoon fantail bird with shimmering rainbow feathers in red, orange, yellow, green, blue and purple, '
                'big friendly cartoon eyes, a tiny beak and a big spread rainbow fan-shaped tail, little sparkles around it'),
    'puppy-plane': (1, 'a cheerful little cream puppy with floppy brown ears riding a big folded white paper plane'),
    'rocket-carrot': (2, 'a big orange carrot flying like a rocket with green leaves at the back and a puff of flame, ridden by a small '
                      'round cream-coloured bunny wearing aviator goggles and a red scarf'),
    'bathtub-boat': (3, 'a white claw-foot bathtub flying with bubbles foaming over the top, a little orange fish wearing swimming goggles '
                     'sitting in it'),
    'mousetrap-glider': (4, 'a small grey mouse with big round ears and a green cap riding a wooden mousetrap fitted with paper glider wings'),
    'donut-cruiser': (5, 'a giant pink-iced donut with rainbow sprinkles flying, ridden by a lanky man with spiky black hair, '
                      'a blue cap and a mint green shirt, waving, his big bulging eyes touching, a big overbite'),
    'mini-van': (6, 'a small rounded plain teal and orange minivan with little white feathered wings and round headlights'),
    'toilet-rocket': (7, 'a shiny white porcelain toilet bowl with its lid up, flying with a rocket flame puffing from underneath, a little round boy in a pink knitted '
                      'bobble hat and a yellow raincoat sitting on it, grinning'),
    'lava-lizard': (8, 'a small red-orange fire lizard with glowing yellow spots surfing on a glowing lava rock, little flames trailing'),
    'jet-bot': (9, 'a small round white and cyan robot with a big round visor face showing sparkly eyes, wearing a pink jet pack'),
    'saucer-kid': (10, 'a cute lilac alien kid with three eyes and a little antenna in a teal and orange flying saucer with a glass bubble dome'),
}
# Poses share a seed so they look alike. Birds get two flaps; everything else flies in one picture (code tilts it).
BIRD_POSES = {'glide': 'gliding with wings spread out flat', 'up': 'flapping with both wings raised high above its back'}

TRAILS = {
    'flowers': 'a small sparkly pink and yellow cartoon flower',
    'cookies': 'a round chocolate chip cookie',
    'donut-crumbs': 'a small bite-sized piece of pink-iced donut with sprinkles',
    'pineapples': 'a small cute pineapple',
    'cheese': 'a small wedge of holey yellow cheese',
    'mouse-tail': 'a short curly pink mouse tail with a little heart at the tip',
    'rainbow-stars': 'a plump rainbow-coloured five-pointed star',
}
EXTRAS = {
    'jellyfish': (3, 'a goofy pink jellyfish with a round wobbly bell and curly tentacles, big happy eyes, floating alone'),
    'ghost': (6, 'a silly friendly white sheet ghost with a wobbly tail and a goofy grin, puffing its cheeks to blow'),
    'steam': (None, 'a big fluffy round cloud of white steam rising in swirly curls, soft and puffy'),
    'comet': (10, 'a small round comet with a smiling face and a long glowing orange and teal tail'),
    # Zones and bumps the game drew in code until 11 Nov 2026 (James: paint everything possible).
    'gust': (None, 'a swirling gust of icy wind, three curly pale blue wind streaks blowing to the left with snowflakes tumbling in them'),
    'bubble': (None, 'one big round soap bubble, very pale blue and see-through with a rainbow sheen and a white shine spot'),
    'bump-stars': (None, 'a little ring of five spinning yellow cartoon stars and tiny swirls, the kind seen after a bonk'),
}

SQUARE = (832, 832)
WIDE = (1360, 512)       # 2040 x 768 after the 1.5x pass
STRIP = (1360, 352)      # 2040 x 528
TALL = (448, 1344)       # 672 x 2016

PICTURES: dict[str, tuple[str, tuple[int, int], int | None]] = {}  # name -> (words, size, shared seed)
for n, (back, row, wall) in WORLDS.items():
    PICTURES[f'w{n}-back'] = (SCENE[n] + f'Wide side-scrolling game background, {back}. Calm and low in contrast with gentle colours and '
                              'little detail, so things in front stand out. The scene continues off both sides, wide panorama.' + SCENERY, WIDE, None)
    PICTURES[f'w{n}-mid'] = (PROP[n] + f'{row.capitalize()}, all standing on one flat line along the very bottom edge of a very wide picture, '
                             'evenly spread from the left edge to the right edge, everything above them plain pure white background.' + SCENERY, STRIP, None)
    PICTURES[f'w{n}-wall'] = (PROP[n] + f'{wall.capitalize()}, standing straight upright in the middle of a tall narrow picture, rising from '
                              'the very bottom edge to near the top, a thick solid chunky column filling the middle half of the picture\'s width, the '
                              'same width all the way up, plain pure white background on both sides, a sturdy game obstacle.' + SCENERY, TALL, None)
for f, (lvl, words) in FLYERS.items():
    style = THING[lvl] if lvl else PLAIN
    if lvl is None:
        for pose, how in BIRD_POSES.items():
            PICTURES[f'{f}-{pose}'] = (style + f'{words.capitalize()}, {how}.' + FLYING + KIDS, SQUARE, None)
    else:
        PICTURES[f'{f}-glide'] = (style + words.capitalize() + '.' + FLYING + KIDS, SQUARE, None)
for f, (lvl, words) in FLYERS.items():
    PICTURES[f'{f}-dizzy'] = ((THING[lvl] if lvl else PLAIN) + words.capitalize() + ', dizzy after a bump, tumbling and tilted, swirly '
                              'spiral eyes and a wobbly grin, little stars circling its head.' + FLYING + KIDS, SQUARE, None)
PICTURES['fantail-perched'] = (PLAIN + FLYERS['fantail'][1].capitalize() + ', perched happily on a small wooden post, wings folded, tail '
                               'fanned, side view facing right.' + SPRITE + KIDS, SQUARE, None)
PICTURES['fantail-cheer'] = (PLAIN + FLYERS['fantail'][1].capitalize() + ', cheering with both wings thrown up in the air and a big happy '
                             'open-beak smile, little stars around it, facing the viewer.' + SPRITE + KIDS, SQUARE, None)
for t, words in TRAILS.items():
    PICTURES[f'trail-{t}'] = (PLAIN + words.capitalize() + ', a single small simple icon, chunky and bright.' + SPRITE, SQUARE, None)
PICTURES['potion'] = (PLAIN + 'A round glass cartoon potion bottle with a cork, full of glowing magenta and gold liquid, little sparkles '
                      'and a soft glow, a single icon.' + SPRITE, SQUARE, None)
for e, (lvl, words) in EXTRAS.items():
    PICTURES[f'extra-{e}'] = ((THING[lvl] if lvl else PLAIN) + words.capitalize() + '.' + SPRITE + KIDS, SQUARE, None)
PICTURES['ui-perch'] = (PLAIN + 'A short wooden post with a little red and yellow triangle flag on top, a checkpoint marker.' + SPRITE, SQUARE, None)
PICTURES['ui-nest'] = (PLAIN + 'A round cosy bird nest of woven twigs and soft feathers, seen from the side, a finish line goal.' + SPRITE, SQUARE, None)
PICTURES['ui-badge'] = (PLAIN + 'A blank round bright yellow badge coin with a thick orange rim and nothing written on it.' + SPRITE, SQUARE, None)
PICTURES['ui-sign'] = (PLAIN + 'A blank round white wooden sign with a thick friendly border and nothing written on it.' + SPRITE, SQUARE, None)
PICTURES['map'] = (PLAIN + 'A wide cartoon adventure map seen from above, a winding dotted trail passing through ten little worlds in a '
                   'row, each in its own colours: a sunny backyard, a red desert canyon, a bright undersea reef, a giant kitchen, a '
                   'cheerful town, a spooky purple manor, snowy paper mountains, a volcano island, a neon night city and outer space '
                   'with ringed planets.' + KIDS, (1072, 672), None)
PICTURES['hangar'] = (PLAIN + 'A big friendly cartoon aircraft hangar inside, seen from the front, three rows of four empty glowing bays '
                      'with soft spotlights, bunting, tool racks and a big open door to a blue sky, the bays empty and ready.' + KIDS, (1072, 672), None)
PICTURES['card'] = (PLAIN + 'Wide game card scene, 16:9: a cute round grey-brown cartoon fantail bird with a cream belly and a big spread fan '
                    'tail flying joyfully through a gap between two tall chunky walls in the middle of the picture, wings raised. Behind '
                    'it four cartoon worlds blend into each other from left to right: a sunny garden with giant sunflowers, a bright '
                    'undersea reef with bubbles, a red desert canyon with rock towers and a starry sky with a ringed planet. Calm open '
                    'soft sky across the top, the bird in the centre, bright, flat and clean, joyful.' + KIDS, (1216, 688), None)


def seed_for(name: str, n: int) -> int:
    # Poses of one flyer share a seed (the part before the pose), so they look alike.
    base = name.rsplit('-', 1)[0] if name.endswith(('-glide', '-up', '-perched', '-cheer', '-dizzy')) else name
    return (sum(map(ord, base)) * 7919 + n * 104729) % 2**32


def graph(text: str, seed: int, width: int, height: int) -> dict:
    sample = lambda latent, denoise: {'class_type': 'KSampler', 'inputs': {
        'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': latent, 'seed': seed, 'steps': 8, 'cfg': 1.0,
        'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': denoise}}
    return {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': text}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
        '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': width, 'height': height, 'batch_size': 1}},
        '8': sample(['7', 0], 1.0),
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '11': {'class_type': 'ImageScaleBy', 'inputs': {'image': ['9', 0], 'upscale_method': 'lanczos', 'scale_by': 1.5}},
        '12': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['3', 0]}},
        '13': sample(['12', 0], 0.4),
        '14': {'class_type': 'VAEDecode', 'inputs': {'samples': ['13', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'toonflap/img'}},
    }


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def paint(out: Path, wanted: list[str], tries: int, first: int):
    out.mkdir(parents=True, exist_ok=True)
    names = [p for p in PICTURES if not wanted or any(p == w or p.startswith(w) for w in wanted)]
    for name in names:
        words, size, _ = PICTURES[name]
        for n in range(first, first + tries):
            dest = out / f'{name}-{n}.png'
            if dest.exists():
                continue
            job = call('/prompt', {'prompt': graph(words, seed_for(name, n), *size)})['prompt_id']
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


# ---- Tidying: the chosen try of each picture -> src/games/toonflap/art/... (layout agreed with the build, 11 Nov 2026) ----

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'toonflap' / 'art'
INBOX = Path.home() / 'dragon-art-inbox' / 'toonflap-art'


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = new_session('isnet-general-use')
    picks = json.loads((ROOT / 'docs' / 'toonflap-art' / 'picks.json').read_text())

    def save(img, out: Path, quality=80):
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, 'WEBP', quality=quality, method=6)
        print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB', flush=True)

    def cut(img):
        # rembg alone drops white parts of a sprite (a white cloud, ghost or wing). So also keep everything that the
        # plain light background can't reach from the picture's edge: white shapes inside a dark outline stay.
        from scipy import ndimage
        rgb = img.convert('RGB')
        c = remove(rgb, session=session, alpha_matting=True)
        px = np.asarray(rgb).astype(np.int16)
        light = (px.min(axis=2) > 225) & (px.max(axis=2) - px.min(axis=2) < 24)
        labels, _ = ndimage.label(light)
        edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
        inside = ~np.isin(labels, edge[edge > 0])
        inside = ndimage.binary_opening(inside, iterations=2)
        keep = ndimage.gaussian_filter(inside.astype(np.float32), 0.8) * 255
        rgba = np.asarray(c).copy()
        rgba[..., :3] = np.asarray(rgb)
        rgba[..., 3] = np.maximum(rgba[..., 3], keep.astype(np.uint8))
        c = Image.fromarray(rgba, 'RGBA')
        a = rgba[..., 3] > 40
        ys, xs = np.where(a)
        return c.crop((max(0, xs.min() - 4), max(0, ys.min() - 4), min(c.width, xs.max() + 5), min(c.height, ys.max() + 5)))

    def square(img, size: int, fill=0.94):
        # Fit inside a square with the body centred (all flyers share one square hit box).
        img = img.copy()
        img.thumbnail((round(size * fill), round(size * fill)), Image.LANCZOS)
        sq = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        sq.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
        return sq

    def loop_x(a, k):
        # Cross-fade the right end into the left so the picture repeats left to right.
        fade = np.linspace(0, 1, k)[None, :, None]
        out = a[:, :a.shape[1] - k].copy()
        out[:, :k] = a[:, -k:] * (1 - fade) + a[:, :k] * fade
        return out

    for name, t in picks.items():
        src = INBOX / f'{name}-{t}.png'
        img = Image.open(src)
        if name.endswith('-back'):
            out = ART / 'worlds' / name[1:].split('-')[0] / 'back.webp'
            if out.exists() and not force:
                continue
            a = loop_x(np.asarray(img.convert('RGB'), dtype=np.float32), img.width // 12)
            save(Image.fromarray(a.round().astype(np.uint8)).resize((2048, 768), Image.LANCZOS), out, 74)
        elif name.endswith('-mid'):
            out = ART / 'worlds' / name[1:].split('-')[0] / 'mid.webp'
            if out.exists() and not force:
                continue
            c = remove(img.convert('RGB'), session=session, alpha_matting=True)
            a = loop_x(np.asarray(c, dtype=np.float32), c.width // 12)
            ys = np.where(a[..., 3].max(axis=1) > 40)[0]
            a = a[max(0, ys.min() - 4):]
            strip = Image.fromarray(a.round().astype(np.uint8), 'RGBA')
            save(strip.resize((2048, round(strip.height * 2048 / strip.width)), Image.LANCZOS), out, 74)
        elif name.endswith('-wall'):
            folder = ART / 'worlds' / name[1:].split('-')[0]
            if (folder / 'wall-bottom.webp').exists() and not force:
                continue
            c = cut(img)
            c = c.resize((256, round(c.height * 256 / c.width)), Image.LANCZOS)
            # The end piece is the top 512 px (cap pointing up); the stretchy middle is a looped slice from below it.
            end = c.crop((0, 0, 256, min(512, c.height)))
            save(end, folder / 'wall-bottom.webp', 82)
            save(end.transpose(Image.FLIP_TOP_BOTTOM), folder / 'wall-top.webp', 82)
            body = np.asarray(c.crop((0, c.height - 600, 256, c.height - 40)), dtype=np.float32)
            k = 48
            fade = np.linspace(0, 1, k)[:, None, None]
            m = body[:body.shape[0] - k].copy()
            m[:k] = body[-k:] * (1 - fade) + body[:k] * fade
            save(Image.fromarray(m[:512].round().astype(np.uint8), 'RGBA'), folder / 'wall-middle.webp', 82)
        else:
            kind, size, quality = 'flyers', 256, 82
            if name.startswith('trail-'):
                kind, size, name = 'trails', 64, name[6:]
            elif name.startswith('extra-'):
                kind, name = 'extras', name[6:]
            elif name.startswith('ui-'):
                kind, name = 'ui', name[3:]
            elif name == 'potion':
                kind, size = '', 128
            elif name in ('map', 'hangar', 'card'):
                out = ART / f'{name}.webp'
                if not out.exists() or force:
                    full = img.convert('RGB')
                    full.thumbnail((1600, 1600), Image.LANCZOS)
                    save(full, out, 74)
                    if name == 'card':
                        small = full.copy()
                        small.thumbnail((800, 800), Image.LANCZOS)
                        save(small, ART / 'card-small.webp', 72)
                continue
            out = (ART / kind if kind else ART) / f'{name}.webp'
            if out.exists() and not force:
                continue
            save(square(cut(img), size), out, quality)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['tidy']:
        tidy('--force' in args)
        sys.exit()
    if len(args) < 2 or args[0] != 'paint':
        sys.exit(__doc__)
    opts = {'--tries': 2, '--first': 1}
    for o in opts:
        if o in args:
            i = args.index(o)
            opts[o] = int(args[i + 1])
            del args[i:i + 2]
    paint(Path(args[1]), args[2:], opts['--tries'], opts['--first'])
