#!/usr/bin/env python3
"""
Paints Diamond Drop's pictures (docs/DIAMOND-ART-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that can
reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Standard library only.

  python3 scripts/diamond-art.py paint OUT_DIR [names] [--tries 2]   # OUT_DIR/<name>-<try>.png
  python3 scripts/diamond-art.py paint /tmp/diamond-styles style-a style-b style-c   # the three style tries (one style for all)
  python3 scripts/diamond-art.py paint /tmp/diamond-levels level-1 level-2 …        # each level's background, in its own style

The graph is Clan Quest's (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words, sizes and seeds change. Seeds
are fixed, so a try can be painted again exactly. Use only positive wording: this model draws whatever a prompt names,
even after "no".
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# The three styles James chooses between (DIAMOND-ART-PLAN.md section 3, `{STYLE}`), worded positively.
STYLES = {
    'a': "Bright storybook painting for a children's picture book, soft painted edges, warm gentle light, rich happy colours, "
         'paper grain texture. ',
    'b': 'Rich dark painting with dramatic glowing light, every gem shining like a little lamp, deep soft shadows, glowing jewel '
         'colours, magical and friendly. ',
    'c': 'Clean flat vector illustration, crisp simple shapes with bold dark outlines, flat bright colours, very clear and '
         'readable, modern mobile game art. ',
}

# One level, the Glow-worm Cave, as the game shows it: a side-on cut-away with the winch at the top and a few things to grab.
CAVE = (
    'Side-on cut-away view of an underground glow-worm cave, wide landscape, suitable for children aged 8 to 12. '
    'Across the top is a rocky cave ceiling with strings of tiny glowing blue-green glow-worm lights hanging down. '
    'In the top middle a small wooden winch on a stone ledge holds a rope with an open three-pronged metal claw hanging below it, '
    'and beside it stands a small round brown kiwi bird wearing a yellow hard hat. '
    'Below, calm dark blue-green rock fills the scene, smooth and simple, with a few separate gems resting in it, spread apart: '
    'a clear white six-sided quartz crystal, a smooth round green jade pebble, a cluster of three purple amethyst spikes, '
    'an orange teardrop topaz, and two plain grey lumpy rocks. Each gem glows softly so it stands out clearly from the rock.'
)

# Each level's background has its own style (James, 2 Nov 2026); gems, rocks, the claw and Nugget keep one look everywhere.
LEVEL_STYLES = {
    1: 'Soft storybook watercolour painting, gentle washes of colour, light paper texture, bright and sunny. ',
    2: 'Handmade plasticine claymation scene, everything sculpted from smooth modelling clay with fingerprint texture, soft studio light. ',
    3: 'Coloured pencil drawing on cream paper, visible pencil strokes and gentle cross-hatching, warm hand-drawn feel. ',
    4: 'Rich dark painting with dramatic glowing light, deep soft shadows, glowing blue-green colours, magical and calm. ',
    5: 'Stained glass mosaic artwork filling the whole picture edge to edge, see-through purple, blue and lilac glass pieces joined by dark lead lines, light shining through. ',
    6: 'Traditional Japanese woodblock print style, flat layered colour, fine carved lines, gentle wave patterns, calm blues. ',
    7: "Old explorer's notebook sketch, brown ink drawing with soft watercolour tint on aged parchment paper, neat hand-drawn detail. ",
    8: 'Layered paper-cut craft art, many stacked layers of coloured card with soft shadows between them, handmade and cosy. ',
    9: 'Bold comic book art, thick black ink outlines, bright flat colours, halftone dot shading, energetic and fun. ',
    10: 'Dreamy shimmering pastel painting, soft glowing rose, lilac and pearl colours, gentle sparkles, smooth simple shapes, magical and peaceful. ',
}

# DIAMOND-ART-PLAN.md section 4.2: (place, top band). Backgrounds are empty scenery: the gems, claw and Nugget go on top.
LEVELS = {
    1: ('dark brown crumbly topsoil with tiny roots and a few pebbles, a flat sunny meadow above', 'a bright blue sky, green grass line, a few daisies and a small wooden fence'),
    2: ('smooth orange-red clay layers with gentle stripes, small roots at the edges', 'a green grassy bank edge and a pale sky with soft clouds'),
    3: ('grey and tan rounded river gravel and sand layers, small pebbles at the edges, a dry old river bed', 'a green bank above with reeds and a pale evening sky'),
    4: ('a calm dark blue-green cave with soft rock walls, tiny glow-worm lights in strings on the ceiling', 'a rocky cave ceiling with glowing glow-worm threads hanging down'),
    5: ('a hollow cave made of soft purple-blue glass rock, with pale crystal shapes along the far left and right edges, and plain purple-blue glass pieces in the middle', 'a cave ceiling with a few crystal points and a flat stone ledge'),
    6: ('a still blue underground lake in a cave, calm teal water in the middle, wet rocky shores at the edges, soft reflections', 'a high cave ceiling with stalactites and a rocky ledge'),
    7: ('layered cream and brown rock with the outlines of ancient shells, ferns and a big spiral fossil at the edges, calm stone in the middle', 'a stone ceiling with a flat rock ledge'),
    8: ('warm rock with steaming turquoise hot pools at the edges, calm warm brown-orange rock in the middle, gentle steam', 'a rocky ceiling with warm mist and a flat ledge'),
    9: ('dark red-black rock with glowing orange cracks of lava at the edges and bottom, calm plain dark rock in the middle, only rock and lava', 'a dark rock ceiling with a few glowing drips and a bare stone ledge'),
    10: ('a magical round chamber deep underground with smooth plain rose-and-violet rock walls, calm soft rock in the middle, a faint pink glow rising from the bottom centre, a gentle heart-shaped curve of pale crystal along the outer edge', 'a smooth arched ceiling with faint sparkles and a stone ledge'),
}


def level_words(n: int) -> str:
    place, top = LEVELS[n]
    return (LEVEL_STYLES[n] + 'Empty background scenery for a children\'s game, suitable for ages 8 to 12. Side-on cut-away view of the ground: '
            f'{place}. The top fifth is {top}. The middle is calm, smooth and low-detail with soft colour so small objects placed on '
            'top will stand out, with detail only at the edges and the bottom. The scenery fills the whole picture edge to edge, and most of the picture is the underground part. Wide landscape.')


# name: (words, (width, height) before the 1.5x pass)
PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    'style-a': (STYLES['a'] + CAVE, (1216, 832)),
    'style-b': (STYLES['b'] + CAVE, (1216, 832)),
    'style-c': (STYLES['c'] + CAVE, (1216, 832)),
    # Level backgrounds: 1600 x 1000 after the 1.5x pass (near enough).
    **{f'level-{n}': (level_words(n), (1072, 672)) for n in LEVELS},
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'diamond/img'}},
    }


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def paint(out: Path, names: list[str], tries: int):
    out.mkdir(parents=True, exist_ok=True)
    for name in names:
        for n in range(1, tries + 1):
            dest = out / f'{name}-{n}.png'
            if dest.exists():
                continue
            # Fixed seeds, so a try can be painted again exactly.
            seed = (sum(map(ord, name)) * 7919 + n * 104729) % 2**32
            job = call('/prompt', {'prompt': graph(PICTURES[name][0], seed, *PICTURES[name][1])})['prompt_id']
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


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) < 2 or args[0] != 'paint':
        sys.exit(__doc__)
    tries = 2
    if '--tries' in args:
        i = args.index('--tries')
        tries = int(args[i + 1])
        del args[i:i + 2]
    paint(Path(args[1]), args[2:] or list(PICTURES), tries)
