#!/usr/bin/env python3
"""
Paints Clan Quest's season monster pictures (docs/CLANS-SEASON-GOALS-PLAN.md section 11) in ComfyUI on James's gaming PC.
Runs on a computer that can reach ComfyUI on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"), never in the site build.
Standard library only.

  python3 scripts/clans-monster-art.py paint OUT_DIR [names] [--tries 3]   # OUT_DIR/<name>-<try>.png
  python3 scripts/clans-monster-art.py paint /tmp/timeline-art stage-build stage-ready stage-new-season   # the timeline medallions

The graph is the one saved inside every Clans painting (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words, sizes
and seeds change. Seeds are fixed, so a try can be painted again exactly. Use only positive wording: this model draws whatever
a prompt names, even after "no".
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

STYLE = (
    'Dark fantasy oil painting, painterly concept art with visible brushstrokes, rich dramatic light, highly detailed. '
    'Exciting but friendly, suitable for children aged 8 to 12. '
)
# name: (description, (width, height) before the 1.5x pass). Portraits are square like the mine monsters; scenes are wide like the place paintings.
PICTURES = {
    'grimmor-the-storm-giant': (
        'A huge grey-skinned mountain giant with a wild beard like storm clouds, wearing rough furs and a belt of rope, '
        'holding a tree-trunk club in one hand and lifting a big boulder over his head with the other, '
        'lightning flickering in dark clouds behind him. Full figure, standing on a rocky hilltop.',
        (1024, 1024)),
    'siege-giant': (
        'A wooden fantasy village with a log wall and a stone watchtower at dusk, warm lights in the windows. '
        'Behind the hills a huge storm giant looms over the village, about to throw a big boulder, lightning in the clouds. '
        'Archers on the watchtower fire arrows at the giant and soldiers with spears stand ready on the wall. Wide landscape view.',
        (1344, 768)),
    # The season timeline's medallions (docs/CLANS-SEASON-TIMELINE-PLAN.md). Shown in a circle, so the subject sits in the middle.
    'stage-build': (
        'A half-built timber hall in a fantasy village, wooden scaffolding and fresh beams, a big hammer and a saw resting on a stack of logs '
        'in the front, warm morning sunlight, a small banner on a pole. Centred subject, simple background.',
        (1024, 1024)),
    'stage-ready': (
        'A small wooden supply cart in a village square, loaded with a bundle of arrows with glowing orange tips, a round bottle of red potion '
        'and a rolled-up rope net, stormy grey sky with distant mountains behind. Centred subject, simple background.',
        (1024, 1024)),
    'stage-new-season': (
        'A golden sunrise over a peaceful wooden fantasy village on a green hill, a shelf of shining trophies and a sword hung on a wall '
        'in the front, fresh spring leaves, hopeful and calm. Centred subject, simple background.',
        (1024, 1024)),
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'clans-monster/img'}},
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
            job = call('/prompt', {'prompt': graph(STYLE + PICTURES[name][0], seed, *PICTURES[name][1])})['prompt_id']
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
    tries = 3
    if '--tries' in args:
        i = args.index('--tries')
        tries = int(args[i + 1])
        del args[i:i + 2]
    paint(Path(args[1]), args[2:] or list(PICTURES), tries)
