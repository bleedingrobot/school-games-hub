#!/usr/bin/env python3
"""
Paints Ruru's Number Trail's pictures (Ruru, the morepork owl from Kiwi's Beanstalk, flying along a moonlit trail of fence
posts: the number line, one more, one less and comparing for ages 5 to 7; docs/RURU-PLAN.md, docs/RURU-ART-PLAN.md) in
ComfyUI on James's gaming PC. Runs on a computer that can reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a
picture needs remaking"), never in the site build. Copied from scripts/weka-art.py: same graph, seeds and tidying, only the
words, picture list and paths change.

  python3 scripts/ruru-art.py paint OUT_DIR [names] [--tries 2]          # OUT_DIR/b/<name>-<try>.png
  python3 scripts/ruru-art.py paint ~/dragon-art-inbox/ruru-art/set     # every picture (tries go to .../set/b/)
  python3 scripts/ruru-art.py list                                         # every picture name
  ~/.cache/rembg-venv/bin/python scripts/ruru-art.py tidy [--force]        # picks (docs/ruru-art/picks.json) -> the game
  python3 scripts/ruru-art.py reuse                                        # copy Beanstalk's and Hop's painted friends in

Use only positive wording: this model draws whatever a prompt names, even after "no". Numbers are drawn in code, so a
picture never holds a number or writing. Each sprite is painted on a plain white background so it can be cut out; tidy
writes src/games/ruru/art/paint/<group>/<name>.webp, the names the game looks up (src/games/ruru/art.ts).
"""
from __future__ import annotations

import json
import shutil
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# One style only: clay, the same as Beanstalk's style 'b' (James asked for Beanstalk's art for Ruru's Number Trail, 5 Nov 2026).
STYLES = {
    'b': 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with soft fingerprint texture, '
         'chunky rounded shapes, bright cheerful colours, soft studio light. ',
}
AGE = ' Suitable for young children aged 5 to 7.'
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around.' + AGE)

# Ruru in exactly Beanstalk's words (scripts/beanstalk-art.py FRIENDS['ruru']), so she is the same owl. Faces RIGHT: the
# game turns her round to fly back for "one less".
RURU = ('a cute small round New Zealand ruru owl with soft brown speckled feathers, huge round yellow eyes, a tiny hooked '
        'beak, wearing a little purple knitted scarf, facing to the right, side view, ')

SHINE = 'vivid mirror-bright polished metal with strong gleaming highlights and reflections'

# wait and cheer are Beanstalk's paintings (copied by `reuse`); these are the new poses.
RURU_POSES = {
    'fly': 'flying forwards with both wings spread wide, feet tucked up, eager happy face',
    'swoop': 'swooping down to land, wings up and back, both feet reaching forwards, pleased smile',
    'perch': 'perched on top of a short plain fence post, wings folded, holding a small moth in its beak, proud and happy',
}

# The two owlets hold up a little blank sign; the number is drawn on it in code.
OWLET = ('a tiny fluffy round baby ruru owlet, pale cream and grey downy fluff, huge round yellow eyes, a tiny beak, '
         'facing forwards, ')
OWLET_POSES = {
    'wait': 'holding up a small plain blank light wooden sign with both little wings, hopeful smile',
    'hoot': 'beak open in a happy hoot, little wings up, tiny sparkles around',
}

# The magic lanterns hang on the posts, one per day played: grey (not yet), then bronze, silver, gold (tinted from gold).
LANTERN = 'one small round paper lantern with a little handle on top, glowing softly from inside, simple smooth shape, '
LANTERNS = {
    'grey': 'soft pale grey paper, unlit and gentle',
    'gold': f'its frame and handle made of {SHINE} in shining yellow gold, warm golden glow, three tiny sparkles',
}

THINGS = {
    # Drawn 11 to 21 times in a row, small, with a number on a plate in code: simple, light and calm.
    'post': 'one single short round pale cream wooden pole standing upright on its own, a plain stump with a flat round top, just one lone upright, seen from the front, smooth and simple',
    # The track at help levels 5 and 4: one square per number, light so a dark number reads clearly on it.
    'lantern-square': 'one flat square paving stone glowing soft warm cream light, seen from slightly above, smooth plain top, simple soft shape',
    'moth': 'one small friendly fluffy pale moth with soft round wings, gentle and cute',
    'golden-moon': f'the Golden Moon, a round full moon made of {SHINE} in shining yellow gold, soft craters, a gentle smiling glow, alone',
    'golden-moon-cushion': f'the Golden Moon, a round full moon made of {SHINE} in shining yellow gold, resting on a small plain plump purple velvet cushion with gold tassels at its corners, a prize',
    'sparkle': f'three {SHINE} gold four-pointed twinkle stars of different sizes spaced apart in a loose diagonal row, every star solid shining gold, flat like stickers, only gold stars on plain white',
}

# New friends at later trails, after each Golden Moon (Kiwi, Weta and Tuatara are reused from Beanstalk and Hop). Face right.
FRIENDS = {
    'kakapo': 'a cute round chubby New Zealand kakapo parrot, soft moss green feathers with fine dark speckles, a pale owl-like face with whiskers, a big pale beak, big kind eyes, short strong grey legs, wearing a little red knitted scarf, facing to the right, side view, ',
    'pekapeka': 'a cute tiny round New Zealand long-tailed bat, soft warm brown fur, big friendly dark eyes, small rounded ears, thin soft brown wings, wearing a little teal knitted scarf, facing to the right, side view, ',
}
FRIEND_POSES = {
    'wait': 'standing calmly and happily, looking ahead with a smile',
    'cheer': 'jumping for joy with both wings up high, a big smile, tiny sparkles around',
}

SQUARE = (832, 832)
WIDE = (1072, 672)  # backgrounds: about 1600 x 1000 after the 1.5x pass
BACK = (' Empty background scenery for a children\'s game, calm soft colours in the middle so things placed on top stand out. '
        'Wide landscape.' + AGE)
# The game lays the straight trail of light posts across the lower middle band, so that band must be plain and calm.
TRAIL = ('A wide view of a gentle New Zealand farm hillside at night seen from the side: a big round moon, a soft deep blue '
         'sky with a few stars, low rolling hills, a few cabbage trees and a flax bush at the edges, a wide flat plain grassy '
         'band right across the lower middle, a tidy uncluttered scene with an empty middle band')

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    **{f'ruru-{p}': (RURU + w + ', the whole owl.' + SPRITE, SQUARE) for p, w in RURU_POSES.items()},
    **{f'owlet-{p}': (OWLET + w + ', the whole owlet.' + SPRITE, SQUARE) for p, w in OWLET_POSES.items()},
    **{f'lantern-{k}': (LANTERN + w + '.' + SPRITE, SQUARE) for k, w in LANTERNS.items()},
    **{name: (w[0].upper() + w[1:] + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    **{f'{f}-{p}': (w + pose + '.' + SPRITE, SQUARE) for f, w in FRIENDS.items() for p, pose in FRIEND_POSES.items()},
    # Three backgrounds: a moonlit night, silver frost for silver days, and a golden moonrise for gold days.
    'back-night': (TRAIL + ', soft silver-blue moonlight, calm plain grass in the middle band.' + BACK, WIDE),
    'back-silver': (TRAIL + ', a frosty night, silver frost sparkling on the grass at the edges, calm plain grass in the middle band.' + BACK, WIDE),
    'back-gold': (TRAIL + ', a big golden moon rising, warm golden light on the hills and on the calm grass.' + BACK, WIDE),
    'card': (RURU + 'flying happily along a straight line of short pale fence posts across a moonlit hillside at night, small '
             'round lanterns glowing on the posts, two fluffy owlets waiting at the end, a big round moon, wide landscape picture '
             'for a game title card.' + AGE, (1216, 688)),
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'ruru/img'}},
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



# ---- Tidying: the chosen try of each picture -> src/games/ruru/art/paint/<group>/<name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'ruru' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'ruru-art' / 'set' / 'b'
HOME = ROOT / 'src' / 'assets' / 'home'
SIZES = {'lanterns': 192, 'friends': 320, 'things': 256}
FRIEND_NAMES = ('ruru', 'owlet', 'kakapo', 'pekapeka')
# Already painted for other early games: copied in by `reuse`, never painted again.
REUSED = {
    'ruru-wait': 'beanstalk', 'ruru-cheer': 'beanstalk',
    'kiwi-wait': 'hop', 'kiwi-cheer': 'hop', 'weta-wait': 'hop', 'weta-cheer': 'hop', 'tuatara-wait': 'hop', 'tuatara-cheer': 'hop',
}


def destination(name: str) -> tuple[str, str, str] | None:
    """(kind of tidying, folder, file name in the game) for a painting."""
    if name == 'card':
        return 'card', '', 'ruru'
    if name.startswith('back-'):
        return 'scene', 'back', name[len('back-'):]
    group, _, key = name.partition('-')
    if group == 'lantern' and key in LANTERNS:
        return 'cut', 'lanterns', key
    if group in FRIEND_NAMES:
        return 'cut', 'friends', name
    return 'cut', 'things', name


def reuse():
    for name, game in REUSED.items():
        src = ROOT / 'src' / 'games' / game / 'art' / 'paint' / 'friends' / f'{name}.webp'
        out = GAME_ART / 'friends' / f'{name}.webp'
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, out)
        print(f'  {out.relative_to(ROOT)}  (from {game})', flush=True)


def tint(img, metal: str):
    """The bronze and silver lanterns, tinted from the gold one so the three keep the same shape (as Weka's stones)."""
    import numpy as np
    from PIL import Image
    px = np.asarray(img, dtype=np.float32)
    light = px[..., :3].mean(axis=2, keepdims=True) / 255
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
    picks = json.loads((ROOT / 'docs' / 'ruru-art' / 'picks.json').read_text())

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
        # rembg can take a pale tummy for background; anything walled in by the figure stays solid, in its painted colours.
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
        save(fit(cut, {'post': 160, 'lantern-square': 160, 'moth': 128}.get(name, SIZES[folder])), out, 82)
        if name == 'lantern-gold':
            for metal in ('bronze', 'silver'):
                save(fit(tint(cut, metal), SIZES[folder]), GAME_ART / folder / f'{metal}.webp', 82)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['tidy']:
        tidy('--force' in args)
        sys.exit()
    if args[:1] == ['reuse']:
        reuse()
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
