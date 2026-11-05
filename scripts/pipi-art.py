#!/usr/bin/env python3
"""
Paints Pipi's Hidden Shells pictures (a cute little New Zealand pipi shellfish and its friends finding shells on a beach, part-whole within 10 for ages 5 to 7;
docs/PIPI-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that can reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Copied from scripts/hop-art.py: same graph, seeds and tidying, only the words, picture list and paths change.

  python3 scripts/pipi-art.py paint OUT_DIR [names] [--style c] [--tries 2]   # OUT_DIR/<style>/<name>-<try>.png ("/" in a name becomes "_")
  python3 scripts/pipi-art.py paint ~/dragon-art-inbox/pipi-art/set back/morning  # one style try (tries go to ~/dragon-art-inbox/pipi-art/set/c/)
  python3 scripts/pipi-art.py list                                            # every picture name
  ~/.cache/rembg-venv/bin/python scripts/pipi-art.py tidy [--force]           # picks (docs/pipi-art/picks-clay.json) → the game

Tries go to ~/dragon-art-inbox/pipi-art/. The graph is Diamond Drop's (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words, sizes and seeds
change. Seeds are fixed, so a try can be painted again exactly. Use only positive wording: this model draws whatever a prompt names,
even after "no". The game is for younger children (about 5 to 7), so everything is big, round, soft and friendly. Numbers are drawn in code,
so a picture never holds a number or writing. Each sprite is painted on a plain white background so it can be cut out; tidy writes
src/games/pipi/art/paint/<group>/<name>.webp, the names the game looks up (src/games/pipi/art.ts).
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# One style only: clay, the same words as Beanstalk, Hop and Penguin Pairs (James, 4 Nov 2026: "in the style of the other
# foundational skills"). The first set was paper cut-out (style 'b' in ~/dragon-art-inbox/pipi-art/set/b/); the clay set is style 'c'.
STYLES = {
    'c': 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with soft fingerprint texture, '
         'chunky rounded shapes, bright cheerful colours, soft studio light. ',
}
AGE = ' Suitable for young children aged 5 to 7.'
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around.' + AGE)

# Pipi, the little New Zealand pipi shellfish. Friends all wear a knitted scarf.
PIPI = ('Pipi, a cute small New Zealand pipi shellfish, a smooth wedge-shaped clam shell in pale peachy cream with soft pink stripes, '
        'big round friendly eyes, a small smile, a little pink foot it can wave, ')

# Metal shells must read at a glance (the same words as Hop's pads).
SHINE = 'vivid mirror-bright polished metal with strong gleaming highlights and reflections'

PIPI_POSES = {
    'sit': 'sitting upright on the sand, calm and happy, looking ahead with a smile',
    'dig': 'half sunk into the sand and tipped to one side, digging in, the top half of the shell showing, cheerful smile',
    'pop': 'popping up out of the sand with a little puff of sand around it, surprised happy smile, tiny sparkles',
    'wave': 'sitting upright and waving its little pink foot high in a friendly wave, big smile',
}

# The shell carries a number on its face (drawn in code), so the middle stays calm.
SHELL = ('One fan-shaped scallop shell seen from above, the same simple shape every time, with soft ridges fanning out from a small hinge '
         'at the bottom, the flat middle of the shell calm, smooth and plain, ')
SHELLS = {
    'sand': 'soft sandy beige and pale pink clay, matte and gentle',
    # Beanstalk found clay asked to be "metal" comes out matt; wrapped in foil it shines (4 Nov 2026).
    'bronze': f'the whole shell wrapped smoothly in shiny crinkled coppery bronze foil like a chocolate coin wrapper, {SHINE}, every part of it bronze, the middle flat and smooth',
    'silver': f'the whole shell wrapped smoothly in shiny crinkled silver foil like a chrome mirror, {SHINE}, every ridge and the middle the same grey metallic silver',
    'gold': f'the whole shell wrapped smoothly in shiny crinkled metallic gold foil like a gold chocolate coin wrapper, {SHINE}, every ridge and the middle the same rich metallic gold, three tiny sparkles',
}

PEARL = f'the Golden Pearl, one big round smooth pearl in {SHINE} in shining yellow gold with a soft warm glow'
THINGS = {
    'pearl': PEARL + ', a single round pearl floating by itself in empty white space, only the pearl and its small soft shadow',
    'pearl-cushion': PEARL + ', resting on a small plain plump red velvet cushion with gold tassels at its corners, a prize',
}

# The friend stuck on each later beach, after Pipi. Each keeps a knitted scarf of its own colour.
FRIENDS = {
    'pipi': PIPI.replace('a cute small', 'a big, cute') + 'wearing a little knitted blue scarf, ',
    'korora': 'a cute little blue penguin chick, a New Zealand korora, soft fluffy blue-grey feathers, a white tummy, big round friendly eyes and a smile, wearing a little red knitted scarf, ',
    'tuatara': 'a cute friendly small green-grey New Zealand tuatara lizard with a long tail and a row of soft spikes down its back, big kind eyes and a smile, wearing a little orange knitted scarf, ',
    'weta': 'a cute friendly small New Zealand weta insect, a round shiny brown body with stripes, six long spiky back legs, long thin feelers, big kind eyes and a smile, wearing a little green knitted scarf, ',
    'kiwi': ('a cute small round New Zealand kiwi bird with a pale pink beak that reaches far out in front of its face, pointing straight out forward '
             'and slightly down, as long as its whole body, long and slender like a sharpened pencil, with a little round nostril at the tip, '
             'the beak clearly the longest part of the bird; seen from the side, its small round head sitting low and snug on a big round egg-shaped body with fluffy shaggy brown feathers, a round bottom, '
             'small bright dark eyes, rosy cheeks, tiny wings, thick strong grey legs and big feet with three toes, wearing a little yellow knitted scarf, '),
    'tui': 'a cute small round New Zealand tui bird with glossy dark blue-green feathers, a little white tuft at its throat, big round friendly eyes, a small dark beak and a smile, wearing a little purple knitted scarf, ',
}
FRIEND_POSES = {
    'wait': 'sitting calmly and happily, looking ahead with a smile',
    'cheer': 'jumping for joy with both arms or wings up high, a big smile, tiny sparkles around',
    'wave': 'sitting and waving one hand, wing or foot high in a friendly wave, big smile',
}

SQUARE = (832, 832)
WIDE = (1072, 672)  # backgrounds: about 1600 x 1000 after the 1.5x pass
BACK = (' Empty background scenery for a children\'s game, calm soft colours in the middle so things placed on top stand out. '
        'Wide landscape.' + AGE)
BEACH = ('A wide view of a calm New Zealand beach: the sky across the top, a grassy sand dune on the left with a pohutukawa tree with red flowers, '
         'a calm sea along the middle, and wide smooth empty sand across the whole lower half, ')

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    **{f'pipi/pipi-{p}': (PIPI + w + ', the whole shellfish.' + SPRITE, SQUARE) for p, w in PIPI_POSES.items()},
    **{f'friends/{f}-{p}': (w + pose + '.' + SPRITE, SQUARE) for f, w in FRIENDS.items() for p, pose in FRIEND_POSES.items()},
    **{f'shells/shell-{k}': (SHELL + w + '.' + SPRITE, SQUARE) for k, w in SHELLS.items()},
    **{f'things/{name}': (w.capitalize() + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    # Three backgrounds: morning, afternoon and sunset.
    'back/morning': (BEACH + 'a pale blue morning sky with a few soft white clouds.' + BACK, WIDE),
    'back/afternoon': (BEACH + 'a warm peach afternoon sky with a few soft clouds.' + BACK, WIDE),
    'back/sunset': (BEACH + 'a gold and pink sunset sky, the sea glowing softly gold.' + BACK, WIDE),
    'home/card': (PIPI + 'sitting on a sandy beach waving its foot, a few small pipi shells peeking out of the sand around it, and shells lined along the tideline, '
                  'a calm blue sea behind, wide landscape picture for a game title card.' + AGE, (1216, 688)),
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'pipi/img'}},
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
            dest = out / f'{name.replace("/", "_")}-{n}.png'
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




# ---- Tidying: the chosen try of each picture → src/games/pipi/art/paint/<group>/<name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'pipi' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'pipi-art' / 'set' / 'c'
HOME = ROOT / 'src' / 'assets' / 'home'
# The home card goes to src/assets/home/ (docs/GAME_DEVELOPMENT_GUIDE.md, section 2).
SIZES = {'pipi': 320, 'friends': 320, 'shells': 256, 'things': 256}


def destination(name: str) -> tuple[str, str, str]:
    """(kind of tidying, folder, file name in the game) for a painting; the names are the paths the game looks up."""
    group, _, key = name.partition('/')
    if name == 'home/card':
        return 'card', '', 'pipi'
    if group == 'back':
        return 'scene', 'back', key
    return 'cut', group, key


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = None
    picks = json.loads((ROOT / 'docs' / 'pipi-art' / 'picks-clay.json').read_text())

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
        kind, folder, out_name = destination(name)
        out = (HOME if kind == 'card' else GAME_ART / folder) / f'{out_name}.webp'
        if out.exists() and not force:
            continue
        img = Image.open(INBOX / f'{name.replace("/", "_")}-{t}.png')
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
        cut = trim(remove(img.convert('RGB'), session=session, alpha_matting=True))
        save(fit(cut, SIZES[folder]), out, 82)


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
    opts = {'--tries': '2', '--style': 'c'}
    for flag in opts:
        if flag in args:
            i = args.index(flag)
            opts[flag] = args[i + 1]
            del args[i:i + 2]
    paint(Path(args[1]), args[2:] or list(PICTURES), opts['--style'], int(opts['--tries']))
