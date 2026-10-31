#!/usr/bin/env python3
"""
Paints Clan Quest's fight effects (docs/CLANS-FIGHT-FEEL.md, stage 2) in ComfyUI on James's gaming PC, and tidies the
chosen tries into small WebP files the game uses (src/games/clans/art/fx/). Runs on James's computer only, never in the
site build. Needs Pillow and numpy (any Python with them; a venv is fine).

  python3 scripts/clans-fx-art.py paint OUT_DIR [names] [--tries 3]   # paint tries into OUT_DIR (fx-<name>-<try>.png)
  python3 scripts/clans-fx-art.py tidy OUT_DIR                        # the picks in docs/clans-art/fx-picks.json -> WebP

ComfyUI must be listening on Tailscale (docs/CLANS-ART-PLAN.md, "If a picture needs remaking"). The graph is the one
saved inside every Clans painting (Z-Image Turbo, 8 steps, a 1.5x second pass); only the words and seeds change.
Each effect is painted glowing on plain black, and tidying turns the black see-through: a pixel is as solid as it is
bright, so only the light is left, and a soft round edge hides any painted border. No cut-out needed. Use only positive wording: this model draws whatever a
prompt names, even after "no".
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FX = ROOT / 'src' / 'games' / 'clans' / 'art' / 'fx'
PICKS = ROOT / 'docs' / 'clans-art' / 'fx-picks.json'
COMFY = 'http://100.97.96.115:8188'

STYLE = (
    'Dark fantasy oil painting, painterly concept art with visible brushstrokes, rich glowing light, highly detailed. '
    'Friendly and exciting, suitable for children aged 8 to 12. '
)
BLACK = ' Centred, isolated on a plain flat pure black background, empty black all around the edges.'
EFFECTS = {
    'fire': 'A round burst of bright orange and gold flame with swirling embers and sparks flying outwards, a magical fireball exploding.',
    'lightning': 'A crackling burst of blue-white lightning, jagged forks of electric light spreading out from a bright glowing centre.',
    'heal': 'A gentle round swirl of soft green and gold sparkles and glowing fireflies circling a warm glowing centre, tiny glowing leaves, calm and kind.',
    'magic': 'A swirling ring of violet and teal magical light with swirl patterns, stars and sparkles circling a bright glowing centre.',
    'impact': 'A bright golden starburst of impact, sharp rays of warm light bursting outwards from a glowing white centre, with small sparks.',
    'victory': 'A glowing golden laurel wreath around two crossed swords, a radiant heroic emblem shining with warm golden light and sparkles.',
}
# Square, and about twice as big as it's drawn on a Chromebook, so it stays sharp.
SIZE = {'victory': 384}
DEFAULT_SIZE = 256


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
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['14', 0], 'filename_prefix': 'clans-fx/img'}},
    }


def call(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(COMFY + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def paint(out: Path, names: list[str], tries: int):
    out.mkdir(parents=True, exist_ok=True)
    for name in names:
        for n in range(1, tries + 1):
            dest = out / f'fx-{name}-{n}.png'
            if dest.exists():
                continue
            # Fixed seeds, so a try can be painted again exactly.
            seed = (sum(map(ord, name)) * 7919 + n * 104729) % 2**32
            job = call('/prompt', {'prompt': graph(STYLE + EFFECTS[name] + BLACK, seed)})['prompt_id']
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


def light_only(img):
    """Light painted on black -> the same light on see-through: brightness becomes solidness."""
    import numpy as np
    from PIL import Image
    rgb = np.asarray(img.convert('RGB')).astype(float)
    bright = rgb.max(axis=2)
    # The painted black isn't quite black: anything this dark is background.
    alpha = np.clip((bright - 24) / (255 - 24), 0, 1)
    # A soft round edge, so a painted border or a dark corner never shows.
    h, w = bright.shape
    y, x = np.mgrid[0:h, 0:w]
    r = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2))
    alpha *= np.clip((1.0 - r) / 0.12, 0, 1)
    # Undo the darkening the black gave the colours, so the light keeps its own colour where it's faint.
    colour = np.clip(rgb / np.maximum(bright, 1)[..., None] * 255, 0, 255)
    return Image.fromarray(np.dstack([colour, alpha * 255]).astype(np.uint8))


def tidy(out: Path):
    from PIL import Image
    picks = json.loads(PICKS.read_text())
    FX.mkdir(parents=True, exist_ok=True)
    for name, n in picks.items():
        size = SIZE.get(name, DEFAULT_SIZE)
        img = Image.open(out / f'fx-{name}-{n}.png').resize((size, size), Image.LANCZOS)
        dest = FX / f'{name}.webp'
        light_only(img).save(dest, 'WEBP', quality=85, method=6)
        print(f'  {dest.relative_to(ROOT)}  {size}x{size}  {dest.stat().st_size // 1024} KB')


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) < 2 or args[0] not in ('paint', 'tidy'):
        sys.exit(__doc__)
    tries = 3
    if '--tries' in args:
        i = args.index('--tries')
        tries = int(args[i + 1])
        del args[i:i + 2]
    if args[0] == 'paint':
        paint(Path(args[1]), args[2:] or list(EFFECTS), tries)
    else:
        tidy(Path(args[1]))
