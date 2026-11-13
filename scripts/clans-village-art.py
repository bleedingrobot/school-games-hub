#!/usr/bin/env python3
"""
Paints the Clan Quest village scene art (stages V3-V4 of docs/CLANS-VILLAGE-SCENE-PLAN.md) in ComfyUI on James's gaming
PC: one picture per building level, the three village grounds, the empty building site, scaffolding, and raid smoke.
Same look as today's building pictures (src/games/clans/art/buildings/*-big.webp; tidied by scripts/clans-art.py): dark,
gritty, painterly medieval fantasy seen three-quarter from above, cut out on transparent. Runs on a computer that can
reach ComfyUI on Tailscale, never in the site build. Tries go to ~/dragon-art-inbox/clans-village/.

  python3 scripts/clans-village-art.py level N [kinds] [--tries 2]   # level N of each building, img2img from level N-1's pick
  python3 scripts/clans-village-art.py ground [1 2 3] [--tries 2]    # img2img from ground-<n>-init.png (code-drawn start)
  python3 scripts/clans-village-art.py extras [site scaffold smoke] [--tries 2]
  python3 scripts/clans-village-art.py walls [1-5] [--tries 2]       # wall strip, corner tower and gate for each Walls level
  python3 scripts/clans-village-art.py villagers [names] [--tries 2] # the villagers who walk the roads
  python3 scripts/clans-village-art.py sheet NAME FILES...           # a contact sheet to compare tries
  ~/.cache/rembg-venv/bin/python scripts/clans-village-art.py tidy   # picks.json in the inbox -> src/games/clans/art/

Level 1 is painted from words alone; each next level is painted from the picked try of the level before (image to image,
denoise LEVEL_DENOISE, 0.55 to 0.72: lower kept the levels nearly the same) so it is clearly the same building growing. Seeds are fixed, so a try can be painted again
exactly. Positive wording only: the model draws whatever a prompt names.

The grounds start from the code-drawn pictures (branch clans-village-art-inbox, ground-init/), with the 7 building plots
added as flat bare-earth patches at the plot positions in src/games/clans/villageLayout.ts, so the plots stay in the same
places on all three looks.
"""
from __future__ import annotations

import io
import json
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'
ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'clans' / 'art'
INBOX = Path.home() / 'dragon-art-inbox' / 'clans-village'
# Image-to-image strength from the level before: higher for the later levels, where the building grows the most.
LEVEL_DENOISE = {2: 0.55, 3: 0.68, 4: 0.72, 5: 0.72, 6: 0.72}

STYLE = ('Dark gritty painterly medieval fantasy game art, hand-painted texture, rich muted earthy colours with warm '
         'firelight glow, dramatic soft light, isometric three-quarter top-down view from above at an angle. ')
SPRITE = (' One single building standing on its own small square patch of trodden earth ground, the whole building and its '
          'ground patch visible, centred, with space all around, on a plain pure white background, clean empty white all around.')

KINDS = {
    'traininghall': ('a training hall where young adventurers practise, with wooden training dummies, archery targets and '
                     'weapon racks', 5),
    'smithy': ('a blacksmith\'s smithy with an anvil, a glowing furnace, a stone chimney with smoke, tools hanging up', 6),
    'church': ('a village church with a bell tower, arched windows and a wooden door', 3),
    'barracks': ('a soldiers\' barracks, a long hall with weapon racks, shields and a training yard by the door', 5),
    'tower': ('a tall watchtower lookout, a lookout platform at the top, a ladder and a lantern', 5),
    'forge': ('a big steel forge works with blast furnaces glowing orange, a water wheel, piles of iron ingots and coal', 5),
    'strongroom': ('a treasure strongroom vault, thick walls, a heavy iron-bound door with a big lock, chests of gold coins '
                   'outside', 5),
}

LEVELS = {
    1: 'small and humble first version: rough timber planks, a canvas tarp roof, a single lamp, simple and plain',
    2: 'a bit bigger: a proper wooden shingle roof, a low wooden fence round it, a wooden cart outside',
    3: 'bigger and sturdier: a grey stone base with timber above, a second storey, a coloured clan banner hanging at the front',
    4: 'grand and busy: a new side wing and a small tower added, warm glowing windows, crates and barrels stacked outside',
    5: 'very big and magnificent: tall dark slate roofs with shining gold trim, flags flying from the towers, a soft magic glow, '
       'its own little paved stone courtyard with a low stone wall',
    6: 'the greatest and most magnificent of all: a huge master building with many towers, gleaming gold trim on every roof, '
       'flags flying, glowing blue magic fire and runes, a big paved stone courtyard with a stone wall and statues',
}
# Church has only 3 levels, so its third is its grandest.
TOP = {'church': {3: LEVELS[5]}}


def building_words(kind: str, level: int) -> str:
    what, _ = KINDS[kind]
    words = TOP.get(kind, {}).get(level, LEVELS[level])
    return STYLE + f'A medieval fantasy village building, {what}, level {level}: {words}.' + SPRITE


EXTRAS = {
    'site': ('An empty building site on a small square patch of flat bare earth ground: four wooden pegs at the corners joined '
             'by a rope, a neat pile of timber planks, a few stones, a shovel, and a small wooden sign on a post with a plain '
             'blank board.' + SPRITE.replace('One single building standing on its own', 'Standing on its own')),
    'scaffold': ('Wooden building scaffolding: a tall square frame of lashed timber poles and planks with ladders, ropes and a '
                 'pulley, a cloud of light brown building dust billowing round its base, a few planks and buckets, nearly '
                 'as tall as it is wide. The whole scaffold visible, centred, on a plain pure white background, clean empty '
                 'white all around.'),
    'smoke': ('Raid damage: a pile of broken charred timber planks, scattered stones and rubble on a little patch of scorched '
              'earth, with thick grey smoke rising from it in a soft column and a few small glowing embers, wider than it is '
              'tall. The whole pile and smoke visible, centred, on a plain pure white background, clean empty white all around.'),
}

# ---- The Walls round the village and the villagers on the roads (James, 14 Nov 2026: painted, not drawn in code) ----
# Walls are painted side-on: a long straight strip the game repeats along each edge of the village (slanted in code to
# follow the edge), a corner tower or post, and the gate at the front corner. Five looks, one per Walls level.
SIDE = ('Dark gritty painterly medieval fantasy game art, hand-painted texture, rich muted earthy colours with warm '
        'firelight glow, dramatic soft light, seen straight from the side at eye level. ')
WALLS = {
    1: ('a low rough wooden fence of uneven split timber posts and two horizontal rails', 'a single thick wooden fence post with '
        'a rope tied round it', 'a simple wooden farm gate between two posts'),
    2: ('a sturdy wooden fence of planks with crossbars, about chest height, with a few iron nails and moss', 'a tall square '
        'wooden post with a small hanging lantern', 'a wooden gate with two doors under a timber arch with a little sign board'),
    3: ('a tall palisade wall of sharpened upright logs lashed together with rope', 'a short round log tower with a pointed '
        'log roof', 'a palisade gate of sharpened logs with two heavy wooden doors and a log lintel'),
    4: ('a tall palisade wall of sharpened logs with a wooden walkway along the top and iron spikes', 'a wooden watchtower on '
        'thick log legs with a shingle roof and a lookout platform', 'a big timber gatehouse with two watch platforms, '
        'heavy iron-bound doors and torches'),
    5: ('a high grey stone castle wall with battlements along the top, mossy stones and arrow slits', 'a round grey stone castle '
        'tower with battlements and a pointed slate roof with a flag', 'a grey stone castle gatehouse with two round towers, a '
        'raised iron portcullis and a wooden drawbridge door'),
}
STRIP = (' A long straight section only, filling the whole picture from the left edge to the right edge, on a plain pure '
         'white background above it, flat even ground line along the bottom.')
PIECE = ' Just the one piece, whole and centred, with space all around, on a plain pure white background, clean empty white all around.'
VILLAGERS = {
    'farmer': 'a cheerful medieval farmer in a brown tunic and straw hat carrying a basket of red apples',
    'water': 'a medieval village woman in a green dress and headscarf carrying a wooden bucket of water',
    'child': 'a happy medieval village child in a blue tunic running with a little wooden toy sword',
    'guard': 'a friendly medieval town guard in a red tabard and round helmet walking with a long spear',
}
WALKER = (' Full body, walking to the right, seen from the side, small and friendly, suitable for children aged 8 to 12.' + PIECE)


def paint_walls(levels: list[int], tries: int):
    out = INBOX / 'walls'
    out.mkdir(parents=True, exist_ok=True)
    for lv in levels:
        strip, corner, gate = WALLS[lv]
        for t in range(1, tries + 1):
            run(out / f'wall-{lv}-{t}.png', SIDE + f'A village wall: {strip}.' + STRIP, (1536, 512))
            run(out / f'corner-{lv}-{t}.png', SIDE + f'A corner piece of a village wall: {corner}.' + PIECE, (768, 1024))
            run(out / f'gate-{lv}-{t}.png', SIDE + f'The front entrance of a village wall: {gate}, seen from the front.' + PIECE, SQUARE)


def paint_villagers(names: list[str], tries: int):
    out = INBOX / 'villagers'
    out.mkdir(parents=True, exist_ok=True)
    for name in names:
        for t in range(1, tries + 1):
            run(out / f'villager-{name}-{t}.png', SIDE + f'A villager: {VILLAGERS[name]}.' + WALKER, (768, 1024))


def tileable(img, blend: float = 0.18):
    """A wall strip that repeats without a seam: its last part is faded into its first, then cut off."""
    import numpy as np
    from PIL import Image
    a = np.asarray(img.convert('RGBA')).astype(float)
    w = a.shape[1]
    n = int(w * blend)
    ramp = np.linspace(0, 1, n)[None, :, None]
    a[:, :n] = a[:, :n] * ramp + a[:, w - n:] * (1 - ramp)
    return Image.fromarray(a[:, : w - n].clip(0, 255).astype('uint8'), 'RGBA')


GROUND_BASE = (STYLE + 'Looking down on a medieval fantasy village green, a big diamond-shaped plot of land with a plain grass '
               'edge, seven flat empty patches of bare trodden earth ready for buildings, everything else ')
GROUNDS = {
    1: GROUND_BASE + ('a muddy new camp: bare brown mud and patchy grass, puddles, dirt tracks, a few small canvas tents, '
                      'a campfire, a stone well in the middle, a few dark trees round the edge. Dark night-blue background outside the land.'),
    2: GROUND_BASE + ('a growing village: gravel roads, wooden carts, glowing lanterns on posts, crates and barrels, green '
                      'grass, a stone well in the middle, a few dark trees round the edge. Dark night-blue background outside the land.'),
    3: GROUND_BASE + ('a proud town: wide paved cobblestone roads and a paved square, a stone fountain in the middle, colourful '
                      'flags and bunting on poles, flower beds, neat green grass, lanterns, a few trees round the edge. Dark '
                      'night-blue background outside the land.'),
}
GROUND_DENOISE = 0.62
# Plot feet in scene units (1000 x 620); villageLayout.ts PLOTS. The flat patch is centred a little above the foot.
PLOTS = {'traininghall': (500, 175), 'smithy': (300, 265), 'church': (700, 265), 'barracks': (205, 385),
         'tower': (795, 385), 'forge': (395, 470), 'strongroom': (605, 470)}


# ---- ComfyUI ----

def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def upload(png: bytes, name: str) -> str:
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
            f'Content-Type: image/png\r\n\r\n').encode() + png
    body += f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(COMFY + '/upload/image', data=body,
                                 headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())['name']


def graph(text: str, seed: int, size: tuple[int, int], init: str | None = None, denoise: float = 1.0) -> dict:
    w, h = size
    g = {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b_fp8_mixed.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3.0}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': text}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
    }
    if init:
        g['20'] = {'class_type': 'LoadImage', 'inputs': {'image': init}}
        g['21'] = {'class_type': 'ImageScale', 'inputs': {'image': ['20', 0], 'upscale_method': 'lanczos', 'width': w, 'height': h, 'crop': 'center'}}
        g['7'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['21', 0], 'vae': ['3', 0]}}
    else:
        g['7'] = {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}}
    sample = lambda latent, d: {'class_type': 'KSampler', 'inputs': {
        'model': ['4', 0], 'positive': ['5', 0], 'negative': ['6', 0], 'latent_image': latent, 'seed': seed, 'steps': 8,
        'cfg': 1.0, 'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': d}}
    g.update({
        '8': sample(['7', 0], denoise),
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '11': {'class_type': 'ImageScaleBy', 'inputs': {'image': ['9', 0], 'upscale_method': 'lanczos', 'scale_by': 1.5}},
        '12': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['3', 0]}},
        '13': sample(['12', 0], 0.4),
        '14': {'class_type': 'VAEDecode', 'inputs': {'samples': ['13', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'clans-village/img'}},
    })
    return g


def run(dest: Path, text: str, size: tuple[int, int], init: Path | None = None, denoise: float = 1.0):
    if dest.exists():
        return
    seed = (sum(map(ord, dest.stem)) * 7919 + 104729) % 2**32
    name = upload(init.read_bytes(), f'cv-{dest.stem}-init.png') if init else None
    job = call('/prompt', {'prompt': graph(text, seed, size, name, denoise)})['prompt_id']
    for _ in range(1800):  # the PC can be slow when something else is using its graphics card
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


def picks() -> dict:
    f = INBOX / 'picks.json'
    return json.loads(f.read_text()) if f.exists() else {}


SQUARE = (1024, 1024)


def paint_level(level: int, kinds: list[str], tries: int):
    out = INBOX / 'buildings'
    out.mkdir(parents=True, exist_ok=True)
    p = picks()
    for kind in kinds:
        if level > KINDS[kind][1]:
            continue
        init = None
        if level > 1:
            prev = p.get(f'{kind}-{level - 1}')
            if prev is None:
                print(f'  {kind}-{level}: pick level {level - 1} first')
                continue
            init = out / f'{kind}-{level - 1}-{prev}.png'
        for n in range(1, tries + 1):
            run(out / f'{kind}-{level}-{n}.png', building_words(kind, level), SQUARE, init, LEVEL_DENOISE[level] if init else 1.0)


def ground_init(n: int) -> Path:
    """The code-drawn start picture with the 7 plots added as flat bare-earth diamonds, and its right edge tidied."""
    from PIL import Image, ImageDraw
    src = INBOX / f'ground-{n}-init.png'
    out = INBOX / f'ground-{n}-init-plots.png'
    img = Image.open(src).convert('RGB')
    sx, sy = img.width / 1000, img.height / 620
    d = ImageDraw.Draw(img)
    bg = img.getpixel((40, 40))
    d.rectangle((img.width - 80, 0, img.width, img.height), fill=bg)
    for x, y in PLOTS.values():
        cx, cy, rx, ry = x * sx, (y - 30) * sy, 80 * sx, 46 * sy
        d.polygon([(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)], fill=(112, 88, 62), outline=(84, 66, 46))
    img.save(out)
    return out


def paint_ground(ns: list[int], tries: int):
    out = INBOX / 'ground'
    out.mkdir(parents=True, exist_ok=True)
    for n in ns:
        init = ground_init(n)
        for t in range(1, tries + 1):
            run(out / f'ground-{n}-{t}.png', GROUNDS[n], (1344, 832), init, GROUND_DENOISE)


def paint_extras(names: list[str], tries: int):
    out = INBOX / 'extras'
    out.mkdir(parents=True, exist_ok=True)
    for name in names:
        size = (1152, 832) if name == 'smoke' else SQUARE
        for t in range(1, tries + 1):
            run(out / f'{name}-{t}.png', STYLE + EXTRAS[name], size)


def sheet(name: str, files: list[Path]):
    from PIL import Image, ImageDraw
    cell = 400
    cols = min(4, len(files))
    rows = (len(files) + cols - 1) // cols
    s = Image.new('RGB', (cols * cell, rows * (cell + 20)), (40, 40, 44))
    d = ImageDraw.Draw(s)
    for i, f in enumerate(files):
        im = Image.open(f).convert('RGB')
        im.thumbnail((cell - 8, cell - 8))
        x, y = (i % cols) * cell, (i // cols) * (cell + 20)
        s.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        d.text((x + 6, y + cell + 2), f.stem, fill=(240, 240, 240))
    path = INBOX / 'sheets' / f'{name}.jpg'
    path.parent.mkdir(exist_ok=True)
    s.save(path, quality=85)
    print(path)


# ---- Tidy: picks.json -> src/games/clans/art/ ----

def tidy():
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    from scipy.ndimage import binary_fill_holes
    session = new_session('isnet-general-use')
    p = picks()

    def save(img, out: Path, q: int):
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, 'WEBP', quality=q, method=6)
        print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB', flush=True)

    def cut(src: Path, width: int):
        rgb = Image.open(src).convert('RGB')
        px = np.asarray(remove(rgb, session=session, alpha_matting=True)).copy()
        hole = binary_fill_holes(px[..., 3] > 128) & (px[..., 3] <= 128)
        px[hole, :3] = np.asarray(rgb)[hole]
        px[hole, 3] = 255
        a = px[..., 3] > 40
        ys, xs = np.where(a)
        img = Image.fromarray(px, 'RGBA').crop((max(0, xs.min() - 2), max(0, ys.min() - 2), min(rgb.width, xs.max() + 3),
                                               min(rgb.height, ys.max() + 3)))
        if img.width > width:
            img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
        return img

    for key, t in p.items():
        if key.startswith('ground-'):
            img = Image.open(INBOX / 'ground' / f'{key}-{t}.png').convert('RGB').resize((2000, 1240), Image.LANCZOS)
            save(img, ART / 'village' / f'{key}.webp', 74)
            save(img.resize((1000, 620), Image.LANCZOS), ART / 'village' / f'{key}-800.webp', 72)
        elif key.startswith('wall-'):
            # Always 768 x 256 (3:1): the game repeats it along each edge at that shape (VillageScene.tsx, PaintedWalls).
            img = tileable(cut(INBOX / 'walls' / f'{key}-{t}.png', 1536))
            save(img.resize((768, 256), Image.LANCZOS), ART / 'village' / f'{key}.webp', 80)
        elif key.startswith(('corner-', 'gate-')):
            save(cut(INBOX / 'walls' / f'{key}-{t}.png', 320), ART / 'village' / f'{key}.webp', 80)
        elif key.startswith('villager-'):
            save(cut(INBOX / 'villagers' / f'{key}-{t}.png', 120), ART / 'village' / f'{key}.webp', 82)
        elif key in EXTRAS:
            save(cut(INBOX / 'extras' / f'{key}-{t}.png', 480), ART / 'village' / f'{key}.webp', 80)
        else:
            save(cut(INBOX / 'buildings' / f'{key}-{t}.png', 480), ART / 'buildings' / f'{key}.webp', 80)


if __name__ == '__main__':
    a = sys.argv[1:]
    tries = 2
    if '--tries' in a:
        i = a.index('--tries')
        tries = int(a[i + 1])
        del a[i:i + 2]
    if a[:1] == ['level'] and len(a) >= 2:
        paint_level(int(a[1]), a[2:] or list(KINDS), tries)
    elif a[:1] == ['ground']:
        paint_ground([int(x) for x in a[1:]] or [1, 2, 3], tries)
    elif a[:1] == ['extras']:
        paint_extras(a[1:] or list(EXTRAS), tries)
    elif a[:1] == ['walls']:
        paint_walls([int(x) for x in a[1:]] or [1, 2, 3, 4, 5], tries)
    elif a[:1] == ['villagers']:
        paint_villagers(a[1:] or list(VILLAGERS), tries)
    elif a[:1] == ['sheet'] and len(a) >= 3:
        sheet(a[1], [Path(f) for f in a[2:]])
    elif a[:1] == ['tidy']:
        tidy()
    else:
        sys.exit(__doc__)
