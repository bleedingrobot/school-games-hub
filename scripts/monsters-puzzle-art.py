#!/usr/bin/env python3
"""
Picture tiles for the Maths Monsters puzzle screens. Runs on this computer only; paints on the gaming PC's ComfyUI.
  python scripts/monsters-puzzle-art.py gen [name] [seeds]   paint candidates (default 3 seeds) into the raw folder
  python scripts/monsters-puzzle-art.py pick name seed       make src/games/monsters/world/assets/puzzles/<name>.webp from a candidate
  python scripts/monsters-puzzle-art.py sheet                contact sheet of all ten -> docs/monsters-art-test/puzzles-sheet.png
Raw candidates go to $PUZZLE_RAW (default: .puzzle-raw in the repo, not committed).
Use ~/.cache/rembg-venv/bin/python (Pillow, numpy, rembg).
"""
import importlib.util, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get('PUZZLE_RAW', ROOT / '.puzzle-raw'))
OUT = ROOT / 'src/games/monsters/world/assets/puzzles'
SHEET = ROOT / 'docs/monsters-art-test/puzzles-sheet.png'
SIZE, MAXKB = 128, 25
spec = importlib.util.spec_from_file_location('wa', ROOT / 'scripts/monsters-world-art.py')
wa = importlib.util.module_from_spec(spec); spec.loader.exec_module(wa)

STYLE = 'hand-painted, soft painterly brush strokes, bright cheerful colours, polished modern cosy top-down RPG game art, friendly for children'
SPR = ('seen from a high three-quarter top-down view, hand-painted polished cosy RPG game sprite, bright friendly colours, soft shading, '
       'isolated on a plain flat pure white background, no ground, no shadow, no text')
TILE = 'seamless tileable top-down painted texture, {s}, ' + STYLE + ', flat even lighting, no objects, no border, no frame, no grid, no text'

# name -> (kind, prompt). kind: tile | sprite | lantern-lit (img2img of the unlit lantern's raw)
ITEMS = {
 'stone': ('sprite', 'one single flat round grey stepping stone seen straight from above, smooth plain flat top surface with no marks, a thick rounded rim, soft grey stone, ' + SPR),
 'pool': ('tile', TILE.format(s='evenly covered all over with shallow clear turquoise rock-pool water, a few smooth grey pebbles scattered evenly on the pool floor beneath the water, soft light ripples, uniform all over, no shoreline, no sand bank, no edge')),
 'ice': ('tile', TILE.format(s='pale blue glassy ice surface with faint white cracks and frosty sparkles')),
 'rock': ('sprite', 'one single large snowy boulder, grey rock with a cap of white snow, ' + SPR),
 'chest': ('sprite', 'one single small closed wooden treasure chest with gold metal bands and a lock, ' + SPR),
 'crate': ('sprite', 'one single closed wooden shipping crate, a solid cube with a flat closed plank lid on top, plank sides, metal corner brackets, rope handles, ' + SPR),
 'wharf': ('tile', TILE.format(s='old weathered brown wooden wharf planks laid side by side, wood grain, dark gaps between planks, a few nail heads')),
 'wall': ('tile', TILE.format(s='dark deep navy-blue harbour water, only gentle slow ripples and subtle lighter wave lines, empty open water, no buoys, no floats, no boats, no dots, no objects')),
 'lantern': ('sprite', 'one single unlit old black iron lantern with glass panes and a ring handle, the glass is dark and empty, no flame, no fire, no light, no glow, unlit, cold and dull, ' + SPR),
 'lantern-lit': ('lit', 'one single old black iron lantern with glass panes and a ring handle, blazing bright orange flame inside, intense warm orange light, strong glowing orange halo around the glass, ' + SPR),
}
ORDER = list(ITEMS)

def tileable(im):
    a = np.asarray(im.convert('RGB'), np.float32); h, w = a.shape[:2]
    r = np.roll(a, (h // 2, w // 2), (0, 1))
    def sm(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
    xs, ys = np.arange(w), np.arange(h)
    bx = sm(1 - np.abs(xs - w / 2) / 190)[None, :]; by = sm(1 - np.abs(ys - h / 2) / 190)[:, None]
    ex = sm(np.minimum(xs, w - 1 - xs) / 230)[None, :]; ey = sm(np.minimum(ys, h - 1 - ys) / 230)[:, None]
    k = np.maximum(bx * ey, by * ex)[..., None]
    return Image.fromarray((a * k + r * (1 - k)).clip(0, 255).astype(np.uint8))

def cutout(src):
    from rembg import new_session, remove
    cut = remove(Image.open(src).convert('RGB'), session=new_session('isnet-general-use'), alpha_matting=True)
    return cut.crop(cut.getbbox())

def gen(only=None, seeds=3):
    RAW.mkdir(parents=True, exist_ok=True)
    for n in ORDER:
        if only and only != n: continue
        kind, text = ITEMS[n]
        for s in range(1, seeds + 1):
            d = RAW / f'{n}-{s}.png'
            if d.exists(): continue
            seed = 5000 + ORDER.index(n) * 100 + s
            if kind == 'lit':  # same drawing as the unlit lantern with the same number, repainted glowing
                src = RAW / f'lantern-{s}.png'
                latent = {'l': {'class_type': 'LoadImage', 'inputs': {'image': wa.upload(src)}},
                          's': {'class_type': 'ImageScale', 'inputs': {'image': ['l', 0], 'upscale_method': 'lanczos', 'width': 768, 'height': 768, 'crop': 'disabled'}},
                          '7': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['s', 0], 'vae': ['3', 0]}}}
                wa.run(wa.base(text, seed, 0.62, latent), d)
            else:
                latent = {'7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': 1024 if kind == 'tile' else 768, 'height': 1024 if kind == 'tile' else 768, 'batch_size': 1}}}
                wa.run(wa.base(text, seed, 1.0, latent), d)
            print(d, flush=True)

def save_webp(im, dest):
    for q in (90, 82, 74, 66, 58, 50, 42, 34):
        im.save(dest, 'WEBP', quality=q, method=6)
        if dest.stat().st_size <= MAXKB * 1000: break

def pick(n, s):
    OUT.mkdir(parents=True, exist_ok=True)
    src = RAW / f'{n}-{s}.png'
    if ITEMS[n][0] == 'tile':
        im = tileable(Image.open(src)).resize((SIZE, SIZE), Image.LANCZOS)
    else:
        cut = cutout(src).convert('RGBA')
        cut.thumbnail((SIZE - 8, SIZE - 8), Image.LANCZOS)
        im = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        im.paste(cut, ((SIZE - cut.width) // 2, (SIZE - cut.height) // 2), cut)
    save_webp(im, OUT / f'{n}.webp'); print(n, (OUT / f'{n}.webp').stat().st_size)

def sheet():
    cell, pad = 192, 16
    out = Image.new('RGB', (5 * (cell + pad) + pad, 2 * (cell + pad) + pad), (128, 128, 128))
    for i, n in enumerate(ORDER):
        im = Image.open(OUT / f'{n}.webp').convert('RGBA').resize((cell, cell), Image.LANCZOS)
        out.paste(im, (pad + (i % 5) * (cell + pad), pad + (i // 5) * (cell + pad)), im)
    SHEET.parent.mkdir(parents=True, exist_ok=True); out.save(SHEET); print(SHEET)

if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'gen': gen(sys.argv[2] if len(sys.argv) > 2 else None, int(sys.argv[3]) if len(sys.argv) > 3 else 3)
    elif c == 'pick': pick(sys.argv[2], sys.argv[3])
    elif c == 'sheet': sheet()
