#!/usr/bin/env python3
"""
Paints Bond Builder's pictures (Jack and the Beanstalk, New Zealand style, a kiwi at the top; docs/BEANSTALK-PLAN.md) in ComfyUI on James's gaming PC. Runs on a
computer that can reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.

  python3 scripts/beanstalk-art.py paint OUT_DIR [names] [--style a] [--tries 2]   # OUT_DIR/<style>/<name>-<try>.png
  python3 scripts/beanstalk-art.py paint /tmp/beanstalk scene --style a            # one style try
  python3 scripts/beanstalk-art.py list                                            # every picture name
  ~/.cache/rembg-venv/bin/python scripts/beanstalk-art.py tidy [--force]           # picks (docs/beanstalk-art/picks.json) → the game

The graph is Diamond Drop's (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words, sizes and seeds change. Seeds
are fixed, so a try can be painted again exactly. Use only positive wording: this model draws whatever a prompt names,
even after "no". The game is for younger children (about 5 to 7), so everything is big, round, soft and friendly.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# The three styles James chooses between. Cut-outs use the same words (no paper grain: it paints a frame round them).
STYLES = {
    'a': "Soft bright storybook painting for a picture book for young children, gentle watercolour washes, rounded friendly "
         'shapes, warm sunny light, happy clear colours. ',
    'b': 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with soft fingerprint texture, '
         'chunky rounded shapes, bright cheerful colours, soft studio light. ',
    'c': "Bold simple cartoon for a preschool television show, thick soft rounded dark outlines, flat bright cheerful colours, "
         'big round friendly shapes, very clear and easy to read. ',
}
AGE = ' Suitable for young children aged 5 to 7.'
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around.' + AGE)

# The one stuck at the top is a kiwi (James, 4 Nov 2026): it can't fly, so it needs the gold trail to get down.
# The beak words are Diamond Drop's: asked only for a long beak, the clay style gave it a short robin's beak.
KIWI = ('Kiwi, a cute round New Zealand kiwi bird: a big round egg-shaped body with fluffy shaggy brown feathers, no neck, a '
        'tailless round bottom, small bright dark eyes, rosy cheeks, and a very long slender pale beak like a drinking straw, '
        'as long as its whole body, curving gently down towards the ground, tiny wings, thick strong grey legs and big feet, wearing a little red knitted scarf, ')
JACK = ('Jack, a cheerful small New Zealand boy about six years old with messy brown hair and freckles, a green cap, a red '
        'and black checked bush shirt, blue shorts and black gumboots, ')
# Children choose to be Jack or Jill (James, 4 Nov 2026): Jill matches Jack's look and poses.
JILL = ('Jill, a cheerful small New Zealand girl about six years old with two bouncy brown pigtails tied with yellow ribbons '
        'and freckles, a yellow cap, a blue and white checked shirt, red shorts and black gumboots, ')

# Metal leaves must read at a glance (James: "much more vibrant and metallic").
SHINE = 'vivid mirror-bright polished metal with strong gleaming highlights and reflections'

# The style try: the whole story in one picture, so James can see the style on every kind of thing at once.
SCENE = ('A giant green beanstalk with a thick curling stem and big heart-shaped leaves rising from a little New Zealand farm '
         'garden at the bottom all the way up into a long white cloud at the top, tall portrait picture. '
         f'At the very top, standing on a curl of the beanstalk on the cloud, is {KIWI}looking down a little worried. '
         f'Big leaves all the way up the stalk: the lowest leaves are {SHINE} in coppery bronze, the middle leaves are {SHINE} '
         f'in bright silver, and the top leaves are {SHINE} in shining yellow gold with sparkles. '
         f'At the bottom beside the stalk stands {JACK}waving up at the kiwi. Behind: a little white farmhouse with a red roof, '
         'a pohutukawa tree with red flowers, silver fern fronds, a woolly sheep, and a snowy cone-shaped mountain far away. '
         'Bright blue sky.')

# Each leaf the same shape so the colour change reads clearly; a number is drawn on top in the game, so the middle stays calm.
LEAF = ('One big rounded heart-shaped beanstalk leaf seen flat from the front, pointing up, with a short curly stalk at the '
        'bottom and one soft vein down the middle, the middle of the leaf smooth and plain, ')
LEAVES = {
    'green': 'fresh bright green, soft and alive',
    # Asked to be "made of metal", clay leaves came out matt with a few foil patches; wrapped in foil they shine (4 Nov).
    'bronze': f'the whole leaf and its stalk wrapped smoothly in shiny crinkled coppery bronze foil like a chocolate coin wrapper, {SHINE}, every part of it bronze',
    'silver': f'the whole leaf wrapped smoothly in shiny crinkled silver foil like a chrome mirror, {SHINE}, every part of it silver',
    'gold': f'the whole leaf wrapped smoothly in shiny crinkled yellow gold foil, {SHINE}, every part of it gold, three tiny sparkles',
}

KIWI_POSES = {
    'wait': 'sitting hunched up and a little worried, wings hugged round itself, looking down',
    'wave': 'standing and flapping one wing in a big happy wave, smiling',
    'hop': 'hopping down with its tiny wings spread out for balance, feet in the air, excited',
    'cheer': 'jumping for joy with both wings up high, beak open in a big smile, tiny sparkles around',
    'egg': 'standing proudly beside a large shining golden egg as big as itself, one wing resting on the egg, smiling',
}
JACK_POSES = {
    'wave': 'standing and waving one hand high, big smile',
    'point': 'pointing up to the sky with one hand, looking up, excited',
    'cheer': 'jumping with both arms up in the air, laughing',
    'hold': 'holding a large shining golden egg in both arms, proud and delighted',
}

THINGS = {
    'golden-egg': 'a large shining smooth golden egg standing upright with a warm glow and a few bright sparkles',
    'egg-cushion': 'a large shining golden egg resting on a round plump red velvet cushion with gold tassels, sparkles all round, a prize',
    'bean': 'one magic bean, a plump shiny purple-and-green speckled bean with a tiny curled green sprout and a soft glow',
    'sparkle': 'three shiny gold foil four-pointed stars of different sizes standing on their own, nothing else',
    'stem-top': 'the very top of a giant green beanstalk, a thick stem ending in a flat curled platform shaped like a snail shell with two small curly tendrils, seen from the side',
    'watering-can': 'a small friendly red watering can with water drops coming out of the spout',
}

# The friend stuck on each later beanstalk, after Kiwi's Golden Egg (James, 4 Nov 2026). Each keeps a knitted scarf of its own colour.
FRIENDS = {
    'tui': 'a cute round New Zealand tui bird with glossy dark blue-green feathers, a white tuft of curly feathers at its throat like a little bow tie, a thin curved black beak, wearing a little yellow knitted scarf, ',
    'kereru': 'a cute plump New Zealand kereru wood pigeon with a shiny green-purple head and back, a pure white chest, a red beak and red feet, wearing a little blue knitted scarf, ',
    'weta': 'a cute friendly New Zealand weta insect, a round shiny brown body with stripes, six long spiky back legs, long thin feelers, big kind eyes and a smile, wearing a little green knitted scarf, ',
    'ruru': 'a cute small round New Zealand ruru owl with soft brown speckled feathers, huge round yellow eyes, a tiny hooked beak, wearing a little purple knitted scarf, ',
    'takahe': 'a cute plump round New Zealand takahe bird with bright blue and green feathers, a big thick bright red beak, strong red legs, wearing a little orange knitted scarf, ',
}
FRIEND_POSES = {k: KIWI_POSES[k] for k in ('wait', 'cheer')}

SQUARE = (832, 832)
WIDE = (1072, 672)  # backgrounds: about 1600 x 1000 after the 1.5x pass
BACK = ' Empty background scenery for a children\'s game, calm soft colours in the middle so things placed on top stand out. Wide landscape.' + AGE

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    'scene': (SCENE + AGE, (832, 1248)),
    **{f'leaf-{k}': (LEAF + w + '.' + SPRITE, SQUARE) for k, w in LEAVES.items()},
    **{f'kiwi-{p}': (KIWI + w + '.' + SPRITE, SQUARE) for p, w in KIWI_POSES.items()},
    **{f'{f}-{p}': (w + pose + '.' + SPRITE, SQUARE) for f, w in FRIENDS.items() for p, pose in FRIEND_POSES.items()},
    **{f'jack-{p}': (JACK + w + ', the whole child from head to boots.' + SPRITE, SQUARE) for p, w in JACK_POSES.items()},
    **{f'jill-{p}': (JILL + w + ', the whole child from head to boots.' + SPRITE, SQUARE) for p, w in JACK_POSES.items()},
    **{name: (w.capitalize() + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    # The stalk: a tall tile the game repeats upwards, the stem straight up the middle from the very top to the very bottom.
    'stem': ('One very thick chunky smooth green clay beanstalk stem as wide as a third of the picture, seen straight on, running '
             'vertically straight up the middle of a tall narrow picture from the very top edge to the very bottom edge, cut off by both '
             'edges, gently twisting with soft rolled stripes, plain pure white background on both sides, '
             'an even repeating pattern.' + AGE, (448, 1344)),
    # Three backgrounds stacked as the beanstalk grows: the garden, the open sky, the land above the clouds.
    'back-garden': ('A sunny New Zealand farm garden: a little white farmhouse with a red tin roof on the left, a wooden fence, a '
                    'pohutukawa tree with red flowers, silver fern fronds, two woolly sheep in a green paddock, a patch of soft brown dug '
                    'earth in the middle where a beanstalk sprouts, rolling green hills and a snowy cone-shaped mountain far away, blue sky.' + BACK, WIDE),
    'back-sky': ('Only open bright blue sky high above the world, a few soft small white clay clouds near the edges, '
                 'empty, calm and plain everywhere else.' + BACK, WIDE),
    'back-clouds': ('A wide calm view high above the world: a smooth floor of soft white clouds along the bottom third, three '
                    'snowy white mountain tops far away poking through the clouds, a smooth pale golden and blue sky above, '
                    'large plain empty areas of sky.' + BACK, WIDE),
    'card': ('A giant green beanstalk with big heart-shaped leaves curling up from a cottage garden into the clouds, the leaves '
             f'wrapped in shiny bronze, silver and gold foil, on top of a cloud at the top {KIWI}waving, standing on the cloud next to a '
             'shining golden egg as big as the kiwi, bright blue sky, '
             'wide landscape picture for a game title card.' + AGE, (1216, 688)),
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'beanstalk/img'}},
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


# ---- Tidying: the chosen try of each picture → src/games/beanstalk/art/paint/<group>/<name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'beanstalk' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'beanstalk-art' / 'set' / 'b'
# Things the game doesn't use yet (the style try and the home card wait for later).
LATER = {'scene', 'card'}
SIZES = {'leaves': 256, 'friends': 320, 'child': 320, 'things': 256}


def destination(name: str) -> tuple[str, str, str] | None:
    """(kind of tidying, folder, file name in the game) for a painting, or None when the game doesn't use it."""
    if name in LATER:
        return None
    if name.startswith('back-'):
        return 'scene', 'backs', name[len('back-'):]
    group, _, key = name.partition('-')
    if group == 'leaf':
        return 'cut', 'leaves', key
    if group in ('jack', 'jill'):
        return 'cut', 'child', name
    if group in ('kiwi', 'tui', 'kereru', 'weta', 'ruru', 'takahe'):
        return 'cut', 'friends', name
    return 'cut', 'things', name


def bronze(img):
    """The bronze leaf, tinted from the silver one: every bronze try came out part matt clay (4 Nov 2026), and a tint keeps
    the four leaves the same shape."""
    import numpy as np
    from PIL import Image
    px = np.asarray(img, dtype=np.float32)
    light = px[..., :3].mean(axis=2, keepdims=True) / 255
    # Dark copper in the shadows, warm bronze in the middle, a pale peach shine on the highlights.
    dark, mid, shine = np.array([70, 30, 12.]), np.array([190, 112, 50.]), np.array([255, 222, 180.])
    rgb = np.where(light < 0.6, dark + (mid - dark) * light / 0.6, mid + (shine - mid) * (light - 0.6) / 0.4)
    return Image.fromarray(np.dstack([rgb, px[..., 3:]]).clip(0, 255).round().astype(np.uint8), 'RGBA')


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = None
    picks = json.loads((ROOT / 'docs' / 'beanstalk-art' / 'picks.json').read_text())

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
        out = GAME_ART / folder / f'{out_name}.webp'
        if out.exists() and not force:
            continue
        img = Image.open(INBOX / f'{name}-{t}.png')
        if kind == 'scene':
            img = img.convert('RGB')
            save(fit(img, 1600), out, 72)
            save(fit(img, 800), GAME_ART / folder / f'{out_name}-800.webp', 70)
            continue
        if session is None:
            session = new_session('isnet-general-use')
        cut = trim(remove(img.convert('RGB'), session=session, alpha_matting=True))
        save(fit(cut, SIZES[folder]), out, 82)
        if name == 'leaf-silver':
            save(fit(bronze(cut), SIZES[folder]), GAME_ART / folder / 'bronze.webp', 82)


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
    opts = {'--tries': '2', '--style': 'a'}
    for flag in opts:
        if flag in args:
            i = args.index(flag)
            opts[flag] = args[i + 1]
            del args[i:i + 2]
    paint(Path(args[1]), args[2:] or list(PICTURES), opts['--style'], int(opts['--tries']))
