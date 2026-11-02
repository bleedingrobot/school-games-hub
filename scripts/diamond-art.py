#!/usr/bin/env python3
"""
Paints Diamond Drop's pictures (docs/DIAMOND-ART-PLAN.md) in ComfyUI on James's gaming PC. Runs on a computer that can
reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Standard library only.

  python3 scripts/diamond-art.py paint OUT_DIR [names] [--tries 2]   # OUT_DIR/<name>-<try>.png
  python3 scripts/diamond-art.py paint /tmp/diamond-styles style-a style-b style-c   # the three style tries

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

# name: (words, (width, height) before the 1.5x pass)
PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    'style-a': (STYLES['a'] + CAVE, (1216, 832)),
    'style-b': (STYLES['b'] + CAVE, (1216, 832)),
    'style-c': (STYLES['c'] + CAVE, (1216, 832)),
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
