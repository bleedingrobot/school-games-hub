#!/usr/bin/env python3
"""
Paints Penguin Pairs' pictures (Two-Shoes, a little blue penguin, crossing stepping stones to win dancing shoes, at water that mirrors fish: doubles and halves for
ages 5 to 7; docs/KORORA-PLAN.md, docs/KORORA-ART-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that can
reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Copied from scripts/hop-art.py: same graph, seeds and tidying, only the words, picture list and paths change.

  python3 scripts/korora-art.py paint OUT_DIR [names] [--tries 2]          # OUT_DIR/b/<name>-<try>.png
  python3 scripts/korora-art.py paint ~/dragon-art-inbox/korora-art/set     # every picture (tries go to .../set/b/)
  python3 scripts/korora-art.py list                                         # every picture name
  ~/.cache/rembg-venv/bin/python scripts/korora-art.py tidy [--force]        # picks (docs/korora-art/picks.json) -> the game

The graph is Diamond Drop's (Z-Image Turbo, 8 steps, a 1.5x second pass). Seeds are fixed, so a try can be painted again
exactly. Use only positive wording: this model draws whatever a prompt names, even after "no". Numbers are drawn in code,
so a picture never holds a number or writing. Each sprite is painted on a plain white background so it can be cut out;
tidy writes src/games/korora/art/paint/<group>/<name>.webp, the names the game looks up (src/games/korora/art.ts).
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# One style only: clay, the same as Beanstalk's and Hop's style 'b' (James picked clay for Penguin Pairs, 4 Nov 2026).
STYLES = {
    'b': 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with soft fingerprint texture, '
         'chunky rounded shapes, bright cheerful colours, soft studio light. ',
}
AGE = ' Suitable for young children aged 5 to 7.'
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around.' + AGE)

# Two-Shoes, the little blue penguin (id korora; was Kororā). Friends all wear a knitted scarf.
KORORA = ('Korora, a cute small New Zealand little blue penguin, slate blue back and head, a clean white tummy and chin, a short '
          'dark beak, big round friendly dark eyes, rosy cheeks, small pink webbed feet, chubby round body, wearing a little knitted red scarf, ')

SHINE = 'vivid mirror-bright polished metal with strong gleaming highlights and reflections'

KORORA_POSES = {
    'wait': 'standing upright on its pink feet, flippers down at its sides, calm and happy, looking ahead with a smile',
    'dive': 'diving forward head first with its flippers swept back, streamlined, eager smile',
    'gulp': 'standing and happily gulping down a small orange fish, the fish tail sticking out of its beak, eyes closed with joy',
    'cheer': 'jumping for joy with both flippers up high, beak open in a big smile, tiny sparkles around',
}

# The stepping stones (and answer stones) carry nothing: numbers are drawn in code, so the top stays smooth and flat.
PEBBLE = ('One big flat stepping stone, wide and low with a rounded edge, seen from slightly above, the same simple shape every time, '
          'its top perfectly smooth and flat, one clean even surface, ')
# Only the grey stone is painted: the clay style always crinkled a painted gold top, so tidy makes the gold, silver and
# bronze stones from the smooth grey one (stone_metal), and all four keep the same shape.
PEBBLES = {
    'grey': 'one solid piece of soft warm grey stone, matte and gentle, the same grey all over',
}

CHICK = ('a cute tiny baby penguin chick, a round fuzzy ball of soft fluffy grey-brown down all over its body and tummy, very fluffy '
         'textured fuzz, a tiny dark beak, big round eyes, tiny stubby wings, ')
FISH = 'one small cute orange fish with a round body, a simple tail fin and one big friendly eye, smiling, '

THINGS = {
    'chick-wait': CHICK + 'sitting and waiting hopefully, looking up, small smile',
    'chick-happy': CHICK + 'flapping its tiny wings with joy, beak open in a happy smile',
    'fish': FISH + 'lying flat on its side, side view',
    # The prize: a pair of dancing shoes. Painted gold; bronze and silver are tinted from it so all three match.
    'shoes-gold': (f'a pair of dazzling little dancing shoes side by side, made of {SHINE} in shining yellow gold, a small heel and a '
                   'pink satin ribbon bow on each, three tiny gold sparkles around, a prize'),
    'splash': 'a lively splash of shiny see-through light blue water, droplets leaping up and outwards, sculpted from glossy translucent blue clay, all blue water',
    # Gold metal only: the word yellow kept turning one star into plain yellow clay.
    'sparkle': f'three identical gold metal four-pointed twinkle stars of different sizes spaced apart in a loose diagonal row, each star cast in solid gold, {SHINE}, every star equally shiny gold metal, flat like stickers, only shiny gold metal stars on plain white',
}

# The friend at each later pool, after Two-Shoes' gold dancing shoes. All birds, so the little ones are always chicks.
FRIENDS = {
    'hoiho': 'a cute small New Zealand yellow-eyed penguin, a hoiho, slate grey back, white tummy, a pale yellow band around its head and bright yellow eyes, a smile, wearing a little blue knitted scarf, ',
    'kiwi': ('a cute round New Zealand kiwi bird with a pale pink beak that reaches far out in front of its face, long, thin and gently curved '
             'downwards, a big round egg-shaped body with fluffy shaggy brown feathers, small bright dark eyes, rosy cheeks, thick '
             'strong grey legs and big feet, wearing a little yellow knitted scarf, '),
    'pukeko': 'a cute round New Zealand pukeko bird, deep shiny blue feathers, a bright red beak and red forehead shield, long orange legs set wide apart, big friendly eyes, wearing a little green knitted scarf, ',
    'kereru': 'a cute plump New Zealand kereru wood pigeon, one solid rounded body, shiny green and purple head and back, a short tail joined to its body, a clean white chest, a small red beak, big kind eyes, wearing a little orange knitted scarf, ',
    'takahe': ('a cute very big heavy round New Zealand takahe bird, much chunkier than a pukeko, a huge thick bright red beak, olive green back and '
               'turquoise blue chest, short thick red legs, tiny wings, big kind eyes, wearing a little purple knitted scarf, '),
}
FRIEND_POSES = {
    'wait': 'standing calmly and happily, looking ahead with a smile',
    'cheer': 'jumping for joy with both wings up high, a big smile, tiny sparkles around',
}

SQUARE = (832, 832)
WIDE = (1072, 672)  # backgrounds: about 1600 x 1000 after the 1.5x pass
BACK = (' Empty background scenery for a children\'s game, calm soft colours in the middle so things placed on top stand out. '
        'Wide landscape.' + AGE)
COAST = ('A side view of a sunny New Zealand stream: one straight, level, calm stream of clear water with two parallel straight banks, '
         'running across the whole picture from the left edge to the right edge through the lower middle, like a wide flat river seen from the '
         'side, the water an even straight band of the same width all the way across, empty water, a straight sandy grassy bank along the '
         'bottom edge of the picture and another straight sandy grassy bank along the top of the water, green hills and a pohutukawa tree '
         'behind the far bank, the only colours sand, green plants, blue water and sky, a tidy uncluttered scene')

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    **{f'korora-{p}': (KORORA + w + ', the whole penguin.' + SPRITE, SQUARE) for p, w in KORORA_POSES.items()},
    **{f'pebble-{k}': (PEBBLE + w + '.' + SPRITE, SQUARE) for k, w in PEBBLES.items()},
    **{name: (w[0].upper() + w[1:] + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    **{f'{f}-{p}': (w + pose + '.' + SPRITE, SQUARE) for f, w in FRIENDS.items() for p, pose in FRIEND_POSES.items()},
    # Three backgrounds: a sunny day, sparkling silver light for silver days, and a golden evening for gold days.
    'back-across-day': (COAST + ', bright blue sky, the water clear light blue and calm.' + BACK, WIDE),
    'back-across-silver': (COAST + ', soft silvery morning light, bright silver glints sparkling along the stream, calm plain water in the middle.' + BACK, WIDE),
    'back-across-evening': (COAST + ', a warm golden evening, the sky orange and gold, golden light on the sand and on the still water.' + BACK, WIDE),
    'card': (KORORA + 'hopping happily along a row of flat stepping stones across a calm glassy lagoon, reflected in the water below, '
             'a pair of shining gold dancing shoes with pink ribbons waiting on the grassy bank ahead, a sunny New Zealand coast, wide '
             'landscape picture for a game title card.' + AGE, (1216, 688)),
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'korora/img'}},
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




# ---- Tidying: the chosen try of each picture -> src/games/korora/art/paint/<group>/<name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'korora' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'korora-art' / 'set' / 'b'
HOME = ROOT / 'src' / 'assets' / 'home'
SIZES = {'pebbles': 256, 'friends': 320, 'things': 256}
FRIEND_NAMES = ('korora', 'hoiho', 'kiwi', 'pukeko', 'kereru', 'takahe')


def destination(name: str) -> tuple[str, str, str] | None:
    """(kind of tidying, folder, file name in the game) for a painting."""
    if name == 'card':
        return 'card', '', 'korora'
    if name.startswith('back-'):
        return 'scene', 'back', name[len('back-'):]
    group, _, key = name.partition('-')
    if group == 'pebble':
        return 'cut', 'pebbles', key
    if group in FRIEND_NAMES:
        return 'cut', 'friends', name
    return 'cut', 'things', name


def tint(img, metal: str):
    """The bronze and silver dancing shoes, tinted from the gold pair (Hop's pads taught that bronze and silver tries come out part
    clay, while gold comes out all metal), so the three pairs keep the same shape."""
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


def stone_metal(img, metal: str):
    """A smooth polished gold, silver or bronze stone made from the matte grey one: the clay texture is blurred away, the
    shading kept, and a soft shine added on the top, so the top stays perfectly smooth."""
    import numpy as np
    from PIL import Image, ImageFilter
    px = np.asarray(img, dtype=np.float32)
    alpha, inside = px[..., 3], px[..., 3] > 200
    light = px[..., :3].mean(axis=2)
    lo, hi = np.percentile(light[inside], [2, 98])
    light = ((light - lo) / (hi - lo)).clip(0, 1)
    light = np.asarray(Image.fromarray((light * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255
    ys, xs = np.nonzero(inside)
    tall, wide = ys.max() - ys.min(), xs.max() - xs.min()
    yy, xx = np.mgrid[:light.shape[0], :light.shape[1]]
    shine = np.exp(-(((xx - xs.min() - wide * 0.4) / (wide * 0.22)) ** 2 + ((yy - ys.min() - tall * 0.35) / (tall * 0.12)) ** 2))
    light = (0.15 + 0.75 * light ** 1.3 + 0.5 * shine).clip(0, 1)[..., None]
    dark, mid, top = {
        'gold': (np.array([90, 52, 6.]), np.array([222, 170, 40.]), np.array([255, 246, 200.])),
        'bronze': (np.array([70, 30, 12.]), np.array([190, 112, 50.]), np.array([255, 222, 180.])),
        'silver': (np.array([48, 54, 64.]), np.array([168, 176, 188.]), np.array([250, 252, 255.])),
    }[metal]
    rgb = np.where(light < 0.6, dark + (mid - dark) * light / 0.6, mid + (top - mid) * (light - 0.6) / 0.4)
    return Image.fromarray(np.dstack([rgb, alpha]).clip(0, 255).round().astype(np.uint8))


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = None
    picks = json.loads((ROOT / 'docs' / 'korora-art' / 'picks.json').read_text())

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

    def fill_holes(cut, source, see_through=False):
        # rembg can take a white tummy for background; anything walled in by the figure stays solid, in its painted colours.
        # It can also leave a white chest half see-through, so the inside of the figure (away from its edge) is made solid too.
        from scipy.ndimage import binary_erosion, binary_fill_holes
        px = np.asarray(cut).copy()
        hole = binary_fill_holes(px[..., 3] > 128) & (px[..., 3] <= 128)
        if not see_through:
            hole |= binary_erosion(binary_fill_holes(px[..., 3] > 20), iterations=4) & (px[..., 3] < 255)
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
        cut = trim(fill_holes(remove(img.convert('RGB'), session=session, alpha_matting=True), img.convert('RGB'), name == 'splash'))
        save(fit(cut, {'fish': 160}.get(name, SIZES[folder])), out, 82)
        if name == 'pebble-grey':
            for metal in ('gold', 'bronze', 'silver'):
                save(fit(stone_metal(cut, metal), SIZES[folder]), GAME_ART / folder / f'{metal}.webp', 82)
        if name == 'shoes-gold':
            for metal in ('bronze', 'silver'):
                save(fit(tint(cut, metal), SIZES[folder]), GAME_ART / folder / f'shoes-{metal}.webp', 82)


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
