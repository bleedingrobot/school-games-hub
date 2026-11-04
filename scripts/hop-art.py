#!/usr/bin/env python3
"""
Paints Hop's Glow-worm Pond pictures (a little green New Zealand frog hopping across lily pads at night, skip-counting; docs/HOP-PLAN.md, section 5) in
ComfyUI on James's gaming PC. Runs on a computer that can reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Copied from scripts/beanstalk-art.py: same graph, seeds and tidying, only the words, picture list and paths change.

  python3 scripts/hop-art.py paint OUT_DIR [names] [--style b] [--tries 2]   # OUT_DIR/<style>/<name>-<try>.png
  python3 scripts/hop-art.py paint ~/dragon-art-inbox/hop-art/set scene      # one style try (tries go to ~/dragon-art-inbox/hop-art/set/b/)
  python3 scripts/hop-art.py list                                            # every picture name
  ~/.cache/rembg-venv/bin/python scripts/hop-art.py tidy [--force]           # picks (docs/hop-art/picks.json) → the game

Tries go to ~/dragon-art-inbox/hop-art/. The graph is Diamond Drop's (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words, sizes and seeds
change. Seeds are fixed, so a try can be painted again exactly. Use only positive wording: this model draws whatever a prompt names,
even after "no". The game is for younger children (about 5 to 7), so everything is big, round, soft and friendly. The scene is at
night, but each sprite is painted on a plain white background so it can be cut out.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# One style only: clay, the same as Beanstalk's style 'b', so the two junior games look like a pair.
STYLES = {
    'b': 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with soft fingerprint texture, '
         'chunky rounded shapes, bright cheerful colours, soft studio light. ',
}
AGE = ' Suitable for young children aged 5 to 7.'
SPRITE = (' Single object, centred, the whole object visible with space around it, on a plain pure white background, '
          'clean empty white all around.' + AGE)

# Hop, the little green New Zealand frog. Friends all wear a knitted scarf.
HOP = ('Hop, a cute small bright green New Zealand native frog like an Archey\'s frog, soft brown speckles on its back, '
       'big round friendly golden eyes, a wide happy smile, a chubby round body, wearing a little knitted blue scarf, ')

# Metal pads must read at a glance (the same words as Beanstalk's leaves).
SHINE = 'vivid mirror-bright polished metal with strong gleaming highlights and reflections'

GLOW = 'soft glowing blue-green'
SCENE = ('A wide picture of a calm night in a New Zealand bush pond under a starry sky, with silver fern fronds and bush on the banks. '
         f'Round lily pads curve in an arc across the dark water: the nearest pads are {SHINE} in coppery bronze, the middle pads are '
         f'{SHINE} in bright silver, and the far pads are {SHINE} in shining yellow gold with sparkles. '
         f'In the middle, {HOP}leaping through the air between two pads with its legs stretched out, smiling. '
         f'Little cute glow-worms float over the water, each hugging a round {GLOW} glowing bead. '
         f'On the far bank, a cave mouth in the bush with glowing blue glow-worm threads hanging down, little lanterns and a tiny '
         'party with bunting, the Glow-worm Party.')

# Each pad the same shape so the colour change reads clearly; a number is drawn on top in the game, so the middle stays calm.
PAD = ('One big round lily pad seen from above at a slight angle, floating flat on the water, round with one small notch cut '
       'into its edge, the middle of the pad flat, smooth and plain, ')
PADS = {
    'green': 'fresh bright green, soft and alive',
    'bronze': f'the whole pad wrapped smoothly in shiny crinkled coppery bronze foil like a chocolate coin wrapper, {SHINE}, every part of it bronze',
    'silver': f'the whole pad wrapped smoothly in shiny crinkled silver foil like a chrome mirror, {SHINE}, every part of it silver',
    'gold': f'the whole pad wrapped smoothly in shiny crinkled yellow gold foil, {SHINE}, every part of it gold, three tiny sparkles',
}

HOP_POSES = {
    'wait': 'sitting upright on its back legs, calm and happy, looking ahead with a smile',
    'crouch': 'crouching low with its back legs folded under it, ready to jump, eager smile',
    'leap': 'jumping through the air mid-leap, back legs stretched out long behind it and front arms reaching forward, joyful',
    'cheer': 'doing a big happy flip high in the air, both arms up, mouth open in a big smile, tiny sparkles around',
    'wave': 'sitting and waving one hand high in a friendly wave, big smile',
}

# The glow-worm carries a number on its bead (drawn in code), so the bead stays plain and light.
GLOWWORM = ('a cute tiny soft pale glow-worm larva, a New Zealand titiwai, with a smiling face, ')
GLOWWORMS = {
    'float': 'floating gently and hugging a big round smooth pale glowing blue-green bead, the bead plain and light',
    'cheer': 'cheering with a big smile, one arm up, the other arm hugging a big round smooth pale glowing blue-green bead, the bead plain and light, tiny sparkles around',
}

THINGS = {
    'pad-gap': 'an empty glowing ring floating on the water, a pale soft blue-green glowing outline of a round lily pad with a small notch, '
               'clearly a place where something goes, the inside calm and empty',
    'party': 'the far bank of a night pond: a cave mouth in a mound of bush with glow-worm threads hanging down glowing blue, little '
             'lanterns, and a tiny party with colourful bunting',
    'jar': 'the Golden Glow Jar, a round shining gold jar lantern full of glowing blue glow-worm lights, with a warm glow',
    'jar-cushion': 'the Golden Glow Jar, a round shining gold jar lantern full of glowing blue glow-worm lights, resting on a round plump red velvet cushion with gold tassels, a prize',
    'sparkle': 'three shiny gold foil four-pointed stars of different sizes standing on their own, nothing else',
    'splash': 'a little ring of water splash, a round crown of clear blue water drops',
    'glow-dot': 'one soft round blue glowing dot with a gentle glow',
}

# The friend stuck on each later pond, after Hop's Golden Glow Jar. Each keeps a knitted scarf of its own colour.
FRIENDS = {
    'gecko': 'a cute green New Zealand gecko with bright yellow spots, big round friendly eyes and a smile, wearing a little red knitted scarf, ',
    'weta': 'a cute friendly New Zealand weta insect, a round shiny brown body with stripes, six long spiky back legs, long thin feelers, big kind eyes and a smile, wearing a little green knitted scarf, ',
    'tuatara': 'a cute friendly green-grey New Zealand tuatara with a soft spiky crest down its back, big kind eyes and a smile, wearing a little orange knitted scarf, ',
    'kiwi': ('a cute round New Zealand kiwi bird: a big round egg-shaped body with fluffy shaggy brown feathers, no neck, a '
             'tailless round bottom, small bright dark eyes, rosy cheeks, and a very long slender pale beak like a drinking straw, '
             'as long as its whole body, curving gently down towards the ground, tiny wings, thick strong grey legs and big feet, wearing a little yellow knitted scarf, '),
    'ruru': 'a cute small round New Zealand ruru owl with soft brown speckled feathers, huge round yellow eyes, a tiny hooked beak, wearing a little purple knitted scarf, ',
}
FRIEND_POSES = {
    'wait': 'sitting calmly and happily, looking ahead with a smile',
    'cheer': 'jumping for joy with both arms or wings up high, a big smile, tiny sparkles around',
}

SQUARE = (832, 832)
WIDE = (1072, 672)  # backgrounds: about 1600 x 1000 after the 1.5x pass
BACK = (' Empty background scenery for a children\'s game, calm soft colours in the middle so things placed on top stand out. '
        'Wide landscape.' + AGE)
NIGHT = ('A wide night view of a New Zealand bush pond under a starry sky, bush edges and silver fern fronds along the left and right '
         'sides, calm empty plain water across the middle third')

PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    'scene': (SCENE + AGE, (1072, 672)),
    **{f'hop-{p}': (HOP + w + ', the whole frog.' + SPRITE, SQUARE) for p, w in HOP_POSES.items()},
    **{f'pad-{k}': (PAD + w + '.' + SPRITE, SQUARE) for k, w in PADS.items()},
    **{f'glowworm-{p}': (GLOWWORM + w + ', the whole glow-worm.' + SPRITE, SQUARE) for p, w in GLOWWORMS.items()},
    **{name: (w.capitalize() + '.' + SPRITE, SQUARE) for name, w in THINGS.items()},
    **{f'{f}-{p}': (w + pose + '.' + SPRITE, SQUARE) for f, w in FRIENDS.items() for p, pose in FRIEND_POSES.items()},
    # Three backgrounds: the pond, the silver river, and the bush lit up warm gold for gold days.
    'back-pond': (NIGHT + ', the dark blue water reflecting the stars.' + BACK, WIDE),
    'back-river': (NIGHT + ', the water a sparkling silver river flowing gently, bright silver glints.' + BACK, WIDE),
    'back-forest': (NIGHT + ', the bush edges and ferns lit up with a warm golden glow, the water dark and calm.' + BACK, WIDE),
    'card': (HOP + 'leaping through the air with its legs stretched out, over glowing round lily pads in '
             f'coppery bronze, bright silver and shining gold foil, on a night pond with floating glow-worms holding {GLOW} glowing beads, '
             'a starry sky, wide landscape picture for a game title card.' + AGE, (1216, 688)),
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'hop/img'}},
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




# ---- Tidying: the chosen try of each picture → src/games/hop/art/paint/<group>/<name>.webp ----

ROOT = Path(__file__).resolve().parent.parent
GAME_ART = ROOT / 'src' / 'games' / 'hop' / 'art' / 'paint'
INBOX = Path.home() / 'dragon-art-inbox' / 'hop-art' / 'set' / 'b'
HOME = ROOT / 'src' / 'assets' / 'home'
# Things the game doesn't use (the style try). The home card goes to src/assets/home/ (docs/GAME_DEVELOPMENT_GUIDE.md, section 2).
LATER = {'scene'}
SIZES = {'pads': 256, 'friends': 320, 'things': 256}


def destination(name: str) -> tuple[str, str, str] | None:
    """(kind of tidying, folder, file name in the game) for a painting, or None when the game doesn't use it."""
    if name in LATER:
        return None
    if name == 'card':
        return 'card', '', 'hop'
    if name.startswith('back-'):
        return 'scene', 'back', name[len('back-'):]
    if name == 'pad-gap':
        return 'cut', 'pads', 'gap'
    group, _, key = name.partition('-')
    if group == 'pad':
        return 'cut', 'pads', key
    if group in ('hop', 'gecko', 'weta', 'tuatara', 'kiwi', 'ruru'):
        return 'cut', 'friends', name
    return 'cut', 'things', name


def tidy(force: bool):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    session = None
    picks = json.loads((ROOT / 'docs' / 'hop-art' / 'picks.json').read_text())

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
        cut = trim(remove(img.convert('RGB'), session=session, alpha_matting=True))
        # The party bank is wide, so it is kept larger.
        save(fit(cut, {'party': 480}.get(name, SIZES[folder])), out, 82)


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
