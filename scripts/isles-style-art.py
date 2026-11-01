#!/usr/bin/env python3
"""
Paints Sky Isles' style try-outs (docs/ISLES-PLAN.md, stage S.L) in ComfyUI on James's gaming PC: the same three test
pictures in each of several styles, so James can compare them side by side and choose the game's look. Runs on James's
computer only, never in the site build. Standard library only.

  python3 scripts/isles-style-art.py OUT_DIR [style ...] [--tries 2] [--scenes island,sky,race]

Writes OUT_DIR/<style>-<scene>-<try>.png. A picture already there is skipped, and seeds are fixed, so any try can be
painted again exactly. ComfyUI must be listening on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking").
The graph is the one every hub painting uses (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words change.
Use only positive wording: this model draws whatever a prompt names, even after "no".
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = 'http://100.97.96.115:8188'

# Each style is the opening of the prompt. None of them repeats another hub game's look: Kingdom Keeper is
# animated-film painting, Dragon Maths and Clan Quest gritty painted, Star Trader cinematic, Marble Rush toy diorama.
STYLES = {
    'anime-painted': 'Lush hand-painted anime background art in gouache and watercolour, soft fluffy clouds, warm nostalgic sunlight, gentle detailed scenery.',
    'cosy-3d': 'Stylised 3D video game render, chunky rounded shapes with hand-painted textures, soft global illumination, vibrant saturated colours, a premium cosy adventure game.',
    'low-poly': 'Low-poly 3D illustration, faceted geometric shapes, flat-shaded soft pastel colours, gentle ambient light, clean and minimal.',
    'pixel-hd': 'Highly detailed high-resolution pixel art, crisp square pixels, rich colour palette, a modern pixel art fantasy game scene with glowing light.',
    'papercut': 'Layered papercut art, shapes cut from coloured card stacked in layers with soft shadows between them, paper texture, handmade depth.',
    'storybook-ink': "Classic children's picture book illustration, delicate pen and ink linework with loose watercolour washes, whimsical and gentle, cream paper.",
    'cel-shaded': 'Bold cel-shaded illustration, clean thick outlines, flat bright colours and crisp hard shadows, a modern adventure cartoon.',
    'travel-poster': 'Vintage travel poster art, bold simplified shapes, limited warm palette, screen-print grain texture, art deco elegance.',
    'isometric': 'Isometric 3D illustration, a crisp miniature game-board view from above at an isometric angle, fine detail, soft shadows, clean bright colours.',
    'bright-fantasy': 'Bright high-fantasy digital painting, luminous jewel colours, soft painterly brushwork, golden hour light, epic and joyful.',
}

SCENES = {
    'island': (
        'A single small floating island drifting high above soft white clouds, seen from slightly above. On its grassy top '
        'a patchwork of golden wheat fields, two cosy cottages with chimney smoke, a small mine entrance in a rocky hill, a '
        'windmill workshop, a little round library tower, and a wooden dock at the edge with a small sky-boat with a red sail '
        'moored to it. Its rocky underside has dangling roots and little waterfalls spilling off the edge into the clouds. '
        'Bright morning, blue sky.'
    ),
    'sky': (
        'A wide view of a bright sky full of many small floating islands of different sizes at different heights above a sea '
        'of clouds, each with tiny fields and cottages, two of them joined by a rope bridge, a tall white lighthouse shining '
        'on the biggest island, little wooden sky-boats with colourful sails sailing between them, seagulls, sunrise, a '
        'feeling of depth and adventure.'
    ),
    'race': (
        'An exciting race between three little wooden sky-boats with big billowing striped sails, flying fast between '
        'floating islands and puffy clouds, colourful streamers and pennants flapping, wind streaks, a finish arch of '
        'balloons on a floating island ahead, dynamic low angle, joyful and full of speed.'
    ),
}
ENDING = ' Cheerful and friendly, made for children aged 8 to 12. Wide landscape picture.'


def graph(text: str, seed: int, width=1344, height=768) -> dict:
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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'isles-styles/img'}},
    }


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def paint(out: Path, styles: list[str], scenes: list[str], tries: int):
    out.mkdir(parents=True, exist_ok=True)
    for n in range(1, tries + 1):
        for style in styles:
            for scene in scenes:
                dest = out / f'{style}-{scene}-{n}.png'
                if dest.exists():
                    continue
                seed = (sum(map(ord, style + scene)) * 7919 + n * 104729) % 2**32
                started = time.time()
                job = call('/prompt', {'prompt': graph(STYLES[style] + ' ' + SCENES[scene] + ENDING, seed)})['prompt_id']
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
                print(f'  {dest.name}  {time.time() - started:.0f}s', flush=True)


if __name__ == '__main__':
    args = sys.argv[1:]
    tries, scenes = 2, list(SCENES)
    if '--tries' in args:
        i = args.index('--tries')
        tries = int(args[i + 1])
        del args[i:i + 2]
    if '--scenes' in args:
        i = args.index('--scenes')
        scenes = args[i + 1].split(',')
        del args[i:i + 2]
    if not args:
        sys.exit(__doc__)
    paint(Path(args[0]), args[1:] or list(STYLES), scenes, tries)
