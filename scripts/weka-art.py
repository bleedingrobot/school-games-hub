#!/usr/bin/env python3
"""
Paints Weka's Stepping Stones' pictures (Weka, a cheeky brown New Zealand bird, hopping across a bush stream on stepping
stones: adding by making ten for ages 5 to 7; docs/WEKA-PLAN.md, docs/WEKA-ART-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that can
reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Copied from scripts/korora-art.py: same graph, seeds and tidying, only the words, picture list and paths change.

  python3 scripts/weka-art.py paint OUT_DIR [names] [--tries 2]          # OUT_DIR/b/<name>-<try>.png
  python3 scripts/weka-art.py paint ~/dragon-art-inbox/weka-art/set     # every picture (tries go to .../set/b/)
  python3 scripts/weka-art.py list                                         # every picture name
  ~/.cache/rembg-venv/bin/python scripts/weka-art.py tidy [--force]        # picks (docs/weka-art/picks.json) -> the game

The graph is Diamond Drop's (Z-Image Turbo, 8 steps, a 1.5x second pass). Seeds are fixed, so a try can be painted again
exactly. Use only positive wording: this model draws whatever a prompt names, even after "no". Numbers are drawn in code,
so a picture never holds a number or writing. Each sprite is painted on a plain white background so it can be cut out;
tidy writes src/games/weka/art/paint/<group>/<name>.webp, the names the game looks up (src/games/weka/art.ts).
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# One style only: clay, the same as Beanstalk's style 'b' (James asked for Beanstalk's art for Weka's Stepping Stones, 4 Nov 2026).
STYLES = {
    'b': 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with soft fingerprint texture, '
         'chunky rounded shapes, bright cheerful colours, soft studio light. ',
}
AGE = ' Suitable for young children aged 5 to 7.'
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around.' + AGE)

# Weka, the brown bush bird. Friends all wear a knitted scarf. Weka always faces RIGHT: the game turns it round to hop back.
WEKA = ('Weka, a cute round New Zealand weka bird, streaky warm brown and chestnut feathers, a strong straight grey beak, '
        'bright friendly red eyes, rosy cheeks, sturdy pinkish-red legs and feet, a short perky tail, wearing a little knitted '
        'green scarf, facing to the right, side view, ')

SHINE = 'vivid mirror-bright polished metal with strong gleaming highlights and reflections'

WEKA_POSES = {
    'wait': 'standing on both feet, wings folded, calm and happy, looking ahead with a smile',
    'hop': 'in the middle of a springy hop forwards, both feet tucked up off the ground, wings a little out, eager smile',
    'land': 'just landed on both feet with knees bent, wings out for balance, pleased smile',
    'cheer': 'jumping for joy with both wings up high, beak open in a big smile, tiny sparkles around',
}

# The magic stones on the far bank carry nothing; the answer stones and stepping stones get numbers drawn in code, so
# their middles stay smooth and plain.
STONE = ('One big smooth rounded river stone, oval and quite flat, seen from slightly above, the same simple shape every time, '
         'its top smooth and plain, ')
STONES = {
    'grey': 'soft warm grey stone, matte and gentle',
    'gold': f'the whole stone covered edge to edge in shining yellow gold, {SHINE}, every part of it gold, three tiny sparkles',
}

THINGS = {
    # Drawn sixteen to twenty times in a row, small, with a number on top: simple, flat and calm.
    'step-stone': 'one flat round grey stepping stone with a smooth plain top, seen from slightly above, a little wet at the edges, simple soft shape',
    # Stone 10: wider, flatter and warmer, so it always stands out among the grey stones.
    'big-rock': 'one big wide low flat oval stepping stone slab of sandy-gold clay, three times wider than it is tall, a single flat layer with one smooth flat top, seen from slightly above, like a big flat pebble lying on the ground',
    'golden-basket': f'the Golden Picnic Basket, a woven picnic basket with a handle made of {SHINE} in shining yellow gold, a red and white checked cloth peeking out, alone',
    'golden-basket-cushion': f'the Golden Picnic Basket, a woven picnic basket with a handle made of {SHINE} in shining yellow gold, a red and white checked cloth peeking out, resting on a small plain plump red velvet cushion with gold tassels at its corners, a prize',
    'splash': 'a lively little splash of shiny see-through light blue water, droplets leaping up and outwards, sculpted from glossy translucent blue clay, all blue water',
    'sparkle': f'three {SHINE} gold four-pointed twinkle stars of different sizes spaced apart in a loose diagonal row, every star solid shining gold, flat like stickers, only gold stars on plain white',
}

# The friend at each later stream, after Weka's Golden Picnic Basket: birds that walk more than they fly. Face right too.
FRIENDS = {
    'kiwi': ('a cute round wingless New Zealand kiwi bird with a pale pink beak that reaches far out in front of its face, long, thin and gently curved '
             'downwards, a big round smooth egg-shaped body covered all over in fluffy hair-like shaggy brown feathers, small bright dark eyes, rosy cheeks, thick '
             'strong grey legs and big feet, wearing a little yellow knitted scarf, facing to the right, side view, '),
    'takahe': ('a cute very plump heavy New Zealand takahe bird shaped like a big round ball, short thick sturdy red legs close under its body, '
               'a huge thick triangular red beak, shimmering turquoise and peacock-blue head and chest, an olive green and teal back with '
               'tiny stubby wings, big kind eyes, wearing a little purple knitted scarf, facing to the right, side view, '),
    'kakapo': 'a cute round chubby New Zealand kakapo parrot, soft moss green feathers with fine dark speckles, a pale owl-like face with whiskers, a big pale beak, big kind eyes, short strong grey legs, wearing a little red knitted scarf, facing to the right, side view, ',
    'pukeko': 'a cute round New Zealand pukeko bird, deep shiny blue feathers, a bright red beak and red forehead shield, long orange legs, big friendly eyes, wearing a little orange knitted scarf, facing to the right, side view, ',
    'kea': 'a cute round New Zealand kea parrot, olive green feathers with dark edges, a flash of orange under its wings, a long curved grey beak, big cheeky eyes, wearing a little blue knitted scarf, facing to the right, side view, ',
}
FRIEND_POSES = {
    'wait': 'standing calmly and happily, looking ahead with a smile',
    'cheer': 'jumping for joy with both wings up high, a big smile, tiny sparkles around',
}

SQUARE = (832, 832)
WIDE = (1072, 672)  # backgrounds: about 1600 x 1000 after the 1.5x pass
BACK = (' Empty background scenery for a children\'s game, calm soft colours in the middle so things placed on top stand out. '
        'Wide landscape.' + AGE)
# The game lays a straight line of stepping stones across the middle band, so the water there must be calm and plain.
STREAM = ('A wide view of a sunny New Zealand bush stream seen from the side: a grassy near bank along the bottom, a calm, wide, '
          'shallow stream right across the middle with smooth plain water, a far bank with ferns, flax and native bush behind it, '
          'a tidy uncluttered scene with an empty middle band of water')

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    **{f'weka-{p}': (WEKA + w + ', the whole bird.' + SPRITE, SQUARE) for p, w in WEKA_POSES.items()},
    **{f'stone-{k}': (STONE + w + '.' + SPRITE, SQUARE) for k, w in STONES.items()},
    **{name: (w[0].upper() + w[1:] + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    **{f'{f}-{p}': (w + pose + '.' + SPRITE, SQUARE) for f, w in FRIENDS.items() for p, pose in FRIEND_POSES.items()},
    # Three backgrounds: a sunny morning, sparkling silver light for silver days, and a golden evening for gold days.
    'back-morning': (STREAM + ', bright blue sky, the water clear light blue and calm.' + BACK, WIDE),
    'back-silver': (STREAM + ', soft silvery morning light, bright silver glints on the water at the edges, calm plain water in the middle.' + BACK, WIDE),
    'back-evening': (STREAM + ', a warm golden evening, the sky orange and gold, golden light on the bush and on the calm water.' + BACK, WIDE),
    'card': (WEKA + 'hopping happily along a straight line of round grey stepping stones across a sunny bush stream, a big flat '
             'sandy-gold rock in the middle of the line, a picnic basket waiting on the far bank, wide landscape picture for a game '
             'title card.' + AGE, (1216, 688)),
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'weka/img'}},
    }


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def paint(out: Path, names: list[str], style: str, tries: int):
    out = out / style
    out.mkdir(parents=True, exist_ok=True)
    for name in names:
        words, size = PICTURES[name]
        for n in range(1, tries + 1):
            dest = out / f'{name}-{n}.png'
            if dest.exists():
                continue
            # Fixed seeds, so a try can be painted again exactly (the same seed in every style, so styles compare fairly).
            seed = (sum(map(ord, name)) * 7919 + n * 104729) % 2**32
            job = call('/prompt', {'prompt': graph(STYLES[style] + words, seed, *size)})['prompt_id']
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
            print(f'  {style}/{dest.name}', flush=True)




# ---- Tidying: the chosen try of each picture -> src/games/weka/art/paint/<group>/<name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'weka' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'weka-art' / 'set' / 'b'
HOME = ROOT / 'src' / 'assets' / 'home'
SIZES = {'stones': 256, 'friends': 320, 'things': 256}
FRIEND_NAMES = ('weka', 'kiwi', 'takahe', 'kakapo', 'pukeko', 'kea')


def destination(name: str) -> tuple[str, str, str] | None:
    """(kind of tidying, folder, file name in the game) for a painting."""
    if name == 'card':
        return 'card', '', 'weka'
    if name.startswith('back-'):
        return 'scene', 'back', name[len('back-'):]
    group, _, key = name.partition('-')
    if group == 'stone':
        return 'cut', 'stones', key
    if name == 'step-stone':
        return 'cut', 'things', 'stone'
    if group in FRIEND_NAMES:
        return 'cut', 'friends', name
    return 'cut', 'things', name


def tint(img, metal: str):
    """The bronze and silver stones, tinted from the gold one (Hop's pads taught that bronze and silver tries come out part
    clay, while gold comes out all metal), so the three metal stones keep the same shape."""
    import numpy as np
    from PIL import Image
    px = np.asarray(img, dtype=np.float32)
    light = px[..., :3].mean(axis=2, keepdims=True) / 255
    # Dark shadow, the metal's own middle, and a pale shine on the highlights.
    dark, mid, shine = {
        'bronze': (np.array([70, 30, 12.]), np.array([190, 112, 50.]), np.array([255, 222, 180.])),
        'silver': (np.array([48, 54, 64.]), np.array([168, 176, 188.]), np.array([250, 252, 255.])),
    }[metal]
    rgb = np.where(light < 0.6, dark + (mid - dark) * light / 0.6, mid + (shine - mid) * (light - 0.6) / 0.4)
    return Image.fromarray(np.dstack([rgb, px[..., 3:]]).clip(0, 255).round().astype(np.uint8), 'RGBA')


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = None
    picks = json.loads((ROOT / 'docs' / 'weka-art' / 'picks.json').read_text())

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

    def fill_holes(cut, source):
        # rembg can take a white tummy for background; anything walled in by the figure stays solid, in its painted colours.
        from scipy.ndimage import binary_fill_holes
        px = np.asarray(cut).copy()
        hole = binary_fill_holes(px[..., 3] > 128) & (px[..., 3] <= 128)
        px[hole, :3] = np.asarray(source)[hole]
        px[hole, 3] = 255
        return Image.fromarray(px, 'RGBA')

    for name, t in picks.items():
        where = destination(name)
        if not where:
            continue
        kind, folder, out_name = where
        out = (HOME if kind == 'card' else GAME_ART / folder) / f'{out_name}.webp'
        if out.exists() and not force:
            continue
        img = Image.open(INBOX / f'{name}-{t}.png')
        if kind == 'card':
            img = img.convert('RGB')
            save(fit(img, 1600), out, 80)
            save(fit(img, 800), HOME / f'{out_name}-small.webp', 78)
            continue
        if kind == 'scene':
            img = img.convert('RGB')
            save(fit(img, 1600), out, 72)
            save(fit(img, 800), GAME_ART / folder / f'{out_name}-800.webp', 70)
            continue
        if session is None:
            session = new_session('isnet-general-use')
        cut = trim(fill_holes(remove(img.convert('RGB'), session=session, alpha_matting=True), img.convert('RGB')))
        save(fit(cut, {'step-stone': 160, 'big-rock': 200}.get(name, SIZES[folder])), out, 82)
        if name == 'stone-gold':
            for metal in ('bronze', 'silver'):
                save(fit(tint(cut, metal), SIZES[folder]), GAME_ART / folder / f'{metal}.webp', 82)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['tidy']:
        tidy('--force' in args)
        sys.exit()
    if args[:1] == ['list']:
        print('\n'.join(PICTURES))
        sys.exit()
    if len(args) < 2 or args[0] != 'paint':
        sys.exit(__doc__)
    opts = {'--tries': '2', '--style': 'b'}
    for flag in opts:
        if flag in args:
            i = args.index(flag)
            opts[flag] = args[i + 1]
            del args[i:i + 2]
    paint(Path(args[1]), args[2:] or list(PICTURES), opts['--style'], int(opts['--tries']))
