#!/usr/bin/env python3
"""
Paints Tūī's Ten Tree pictures (a tūī collecting berries on a kōwhai tree, teen numbers as ten and some more, ages 5 to 7;
docs/TUI-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that can reach ComfyUI on Tailscale
(docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Copied from scripts/pipi-art.py: same graph, seeds and tidying. The style words are Beanstalk's clay (style b in
scripts/beanstalk-art.py), so the two games look like a pair (James, 4 Nov 2026).

  python3 scripts/tui-art.py paint ~/dragon-art-inbox/tui-art/set home/card tui/tui-sit --tries 4   # style try first
  python3 scripts/tui-art.py paint ~/dragon-art-inbox/tui-art/set --tries 3                         # the rest (skips what is there)
  python3 scripts/tui-art.py list                                                                   # every picture name
  ~/.cache/rembg-venv/bin/python scripts/tui-art.py tidy [--force]          # picks (docs/tui-art/picks.json) → the game

Tries go to ~/dragon-art-inbox/tui-art/set/b/ ("/" in a name becomes "_"). The graph is Diamond Drop's (Z-Image Turbo,
8 steps, a 1.5x second pass); only the words, sizes and seeds change. Seeds are fixed, so a try can be painted again
exactly. Use only positive wording: this model draws whatever a prompt names, even after "no". Numbers and counts are
drawn in code: a picture never holds a number or writing, and the game places single berries itself (a painting can't
be trusted to hold exactly ten). Each sprite is painted on plain white so it can be cut out; tidy writes
src/games/tui/art/paint/<group>/<name>.webp, the names the game will look up (src/games/tui/art.ts).
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# One style only: Beanstalk's clay (style b there), word for word.
STYLES = {
    'b': 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with soft fingerprint texture, '
         'chunky rounded shapes, bright cheerful colours, soft studio light. ',
}
AGE = ' Suitable for young children aged 5 to 7.'
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around.' + AGE)
SHINE = 'vivid mirror-bright polished metal with strong gleaming highlights and reflections'

# Tūī is Beanstalk's tūī friend (dark blue clay, yellow knitted scarf), with the white tuft at the throat where a real
# tūī has it (Beanstalk's came out with it on the head).
TUI = ('Tui, a cute small round New Zealand tui bird made of glossy dark blue-green clay, two little white curly feather tufts '
       'at its throat just above its scarf, big round friendly eyes, a thin curved dark beak, tiny wings, short dark legs, '
       'wearing a little yellow knitted scarf, ')
TUI_POSES = {
    'sit': 'perched calmly on a short twig, happy, looking ahead with a smile',
    'eat': 'perched on a short twig and pecking happily at one round orange berry held in its beak',
    'sing': 'perched on a short twig with its head tipped up and beak open, singing, three small curly musical swirls in the air',
    'cheer': 'jumping for joy with both wings up high, beak open in a big smile, tiny sparkles around',
    'fly': 'flying with both wings spread wide, carrying one round orange berry in its beak, happy',
    'nest': 'standing proudly beside a round shining golden nest as big as itself, one wing resting on its rim, smiling',
}

# The friend on each later tree, after Tūī's Golden Nest. Each keeps a knitted scarf of its own colour.
FRIENDS = {
    'kereru': 'a cute plump New Zealand kereru wood pigeon with a shiny green-purple head and back, a pure white chest, a red beak and red feet, wearing a little blue knitted scarf, ',
    'piwakawaka': 'a cute tiny round New Zealand fantail bird, soft brown and cream feathers, a big fanned-out tail like an open fan, big round friendly eyes, wearing a little green knitted scarf, ',
    'korimako': 'a cute small round New Zealand bellbird, soft olive-green feathers, a little dark curved beak, bright red eyes that look kind and friendly, wearing a little orange knitted scarf, ',
    'kaka': 'a cute round New Zealand kaka parrot, olive-brown feathers with a flash of bright red under its wings, a big curved grey beak, big friendly eyes, wearing a little red knitted scarf, ',
}
FRIEND_POSES = {
    'sit': 'perched calmly on a short twig, happy, looking ahead with a smile',
    'cheer': 'jumping for joy with both wings up high, a big smile, tiny sparkles around',
}

# The counting things. Berries are placed one by one in code (a ten-frame on bronze days), so each is a single plain berry.
TREE = {
    'berry': 'one single round shiny orange berry, like a karamu berry, a tiny green stalk on top, smooth and plump',
    'berry-gold': f'one single round berry in {SHINE} in shining yellow gold, a tiny gold stalk on top',
    # The ten-frame sits on this branch: two long rows of five berries are placed along it in code, so it is plain and empty.
    'branch': 'one long straight horizontal kowhai tree branch, smooth brown clay bark, a few small green leaves only at the two ends, '
              'the long middle of the branch plain, empty and smooth, seen from the side',
    # The full ten: ten berries tuck into a flax kete, which shuts. The game writes "10" on the tag.
    'kete-open': 'one small round woven flax basket, a Maori kete, woven from green-gold flax strips with two handles, open at the top '
                 'and empty, seen from the front',
    'kete-full': 'one small round woven flax basket, a Maori kete, woven from green-gold flax strips with two handles, closed and '
                 'plump and full, a plain round cream clay tag hanging on the front, the tag plain and empty, seen from the front',
    # Answers sit on nests; the number is drawn on top.
    'nest': 'one small round bird nest made of twigs and soft moss, seen from the front and a little above, the inside a calm '
            'smooth soft brown, empty',
}

# The 10 magic things on the Ten Tree turn bronze, silver and gold, like Beanstalk's leaves. The same shape each time.
FLOWER = 'One big rounded kowhai flower cluster seen from the front, a soft bunch of curved petals hanging from a short stalk, '
FLOWERS = {
    'bud': 'a closed soft green bud, fresh and alive',
    'bronze': f'the whole flower wrapped smoothly in shiny crinkled coppery bronze foil like a chocolate coin wrapper, {SHINE}, every part of it bronze',
    'silver': f'the whole flower wrapped smoothly in shiny crinkled silver foil like a chrome mirror, {SHINE}, every part of it silver',
    'gold': f'the whole flower wrapped smoothly in shiny crinkled yellow gold foil, {SHINE}, every part of it gold, three tiny sparkles',
}

NEST = f'the Golden Nest, one round bird nest woven from twigs in {SHINE} in shining yellow gold with a soft warm glow'
THINGS = {
    'golden-nest': NEST + ', by itself in empty white space, only the nest and its small soft shadow',
    'nest-cushion': NEST + ', resting on a small plain plump red velvet cushion with gold tassels at its corners, a prize',
}

SQUARE = (832, 832)
WIDE = (1072, 672)  # backgrounds: about 1600 x 1000 after the 1.5x pass
BACK = (' Empty background scenery for a children\'s game, calm soft colours in the middle so things placed on top stand out. '
        'Wide landscape.' + AGE)
# The Ten Tree stands at the left; the wide middle stays calm for the branch, berries and nests.
TREE_BACK = ('A wide view of a New Zealand hillside in clay: a big friendly kowhai tree with a thick curving trunk at the far left, its '
             'branches reaching along the top edge, rolling green hills and a few silver fern fronds along the bottom, ')

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    **{f'tui/tui-{p}': (TUI + w + ', the whole bird.' + SPRITE, SQUARE) for p, w in TUI_POSES.items()},
    **{f'friends/{f}-{p}': (w + pose + ', the whole bird.' + SPRITE, SQUARE) for f, w in FRIENDS.items() for p, pose in FRIEND_POSES.items()},
    **{f'tree/{k}': (w.capitalize() + '.' + SPRITE, SQUARE if k != 'branch' else (1216, 448)) for k, w in TREE.items()},
    **{f'flowers/flower-{k}': (FLOWER + w + '.' + SPRITE, SQUARE) for k, w in FLOWERS.items()},
    **{f'things/{name}': (w.capitalize() + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    # Three backgrounds: bronze days (spring morning), silver days (misty silver morning), gold days (golden evening).
    'back/spring': (TREE_BACK + 'the tree full of bright yellow kowhai flowers, a fresh pale blue morning sky.' + BACK, WIDE),
    'back/silver': (TREE_BACK + 'a soft misty silver-blue morning, dew sparkling on the grass.' + BACK, WIDE),
    'back/golden': (TREE_BACK + 'a warm golden evening sky, everything glowing softly gold.' + BACK, WIDE),
    'home/card': (TUI + 'perched on a kowhai branch with yellow flowers, beside it a small woven flax kete full of round orange berries '
                  'and a few loose berries on the branch, a soft blue sky and green hills behind, wide landscape picture for a game '
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'tui/img'}},
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





# ---- Tidying: the chosen try of each picture → src/games/tui/art/paint/<group>/<name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'tui' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'tui-art' / 'set' / 'b'
HOME = ROOT / 'src' / 'assets' / 'home'
# The home card goes to src/assets/home/ (docs/GAME_DEVELOPMENT_GUIDE.md, section 2).
SIZES = {'tui': 320, 'friends': 320, 'tree': 512, 'flowers': 256, 'things': 256}  # tree: the branch is wide


def destination(name: str) -> tuple[str, str, str]:
    """(kind of tidying, folder, file name in the game) for a painting; the names are the paths the game looks up."""
    group, _, key = name.partition('/')
    if name == 'home/card':
        return 'card', '', 'tui'
    if group == 'back':
        return 'scene', 'back', key
    return 'cut', group, key


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = None
    picks = json.loads((ROOT / 'docs' / 'tui-art' / 'picks.json').read_text())

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
    opts = {'--tries': '2', '--style': 'b'}
    for flag in opts:
        if flag in args:
            i = args.index(flag)
            opts[flag] = args[i + 1]
            del args[i:i + 2]
    paint(Path(args[1]), args[2:] or list(PICTURES), opts['--style'], int(opts['--tries']))
