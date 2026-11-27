#!/usr/bin/env python3
"""
Turn the raw puzzle paintings from scripts/monsters-puzzle-paint.py into game files.
  python scripts/monsters-puzzle-pick.py [raw-folder] [name ...]   -> src/games/monsters/world/assets/puzzles/<name>.webp
  python scripts/monsters-puzzle-pick.py sheet                      -> docs/monsters-art-test/puzzles-sheet-2.png
Needs Pillow, numpy and rembg (sprites are cut out with rembg's isnet-general-use).
"""
import importlib.util, sys
sys.dont_write_bytecode = True
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/games/monsters/world/assets/puzzles'
SHEET = ROOT / 'docs/monsters-art-test/puzzles-sheet-2.png'
spec = importlib.util.spec_from_file_location('paint', ROOT / 'scripts/monsters-puzzle-paint.py')
paint = importlib.util.module_from_spec(spec); spec.loader.exec_module(paint)

# Game size of each picture (shown at about half this on screen, so it stays sharp on iPads). Default: 256 square.
SIZE = {
 'bank': (256, 768), 'door-arch': (800, 600), 'lock-door': (800, 600), 'tag': (256, 128), 'sign': (512, 256),
 'glowworm': (128, 256), 'drum': (128, 256), 'chest-lock': (320, 320), 'cave-roof': (512, 512),
 'seed-pod': (128, 128), 'puzzle-sign': (128, 128), **{f'bit-{t}': (128, 128) for t in ('leaf', 'water', 'fire', 'ice', 'spark', 'stone')},
}
MAXKB = {'door-arch': 90, 'lock-door': 90, 'bank': 60}

def tileable(im):
    a = np.asarray(im.convert('RGB'), np.float32); h, w = a.shape[:2]
    r = np.roll(a, (h // 2, w // 2), (0, 1))
    def sm(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
    xs, ys = np.arange(w), np.arange(h)
    bx = sm(1 - np.abs(xs - w / 2) / 190)[None, :]; by = sm(1 - np.abs(ys - h / 2) / 190)[:, None]
    ex = sm(np.minimum(xs, w - 1 - xs) / 230)[None, :]; ey = sm(np.minimum(ys, h - 1 - ys) / 230)[:, None]
    k = np.maximum(bx * ey, by * ex)[..., None]
    return Image.fromarray((a * k + r * (1 - k)).clip(0, 255).astype(np.uint8))

_session = None
def cutout(src):
    global _session
    from rembg import new_session, remove
    _session = _session or new_session('isnet-general-use')
    cut = remove(Image.open(src).convert('RGB'), session=_session, alpha_matting=True)
    return cut.crop(cut.getbbox())

def save_webp(im, dest, maxkb):
    for q in (90, 82, 74, 66, 58, 50, 42, 34):
        im.save(dest, 'WEBP', quality=q, method=6)
        if dest.stat().st_size <= maxkb * 1000: break

def pick(raw, n):
    kind = paint.ITEMS[n][0]
    w, h = SIZE.get(n, (256, 256))
    src = raw / f'{n}.png'
    if kind == 'tile':
        im = tileable(Image.open(src)).resize((w, h), Image.LANCZOS)
    elif kind == 'pic':
        im = Image.open(src).convert('RGB').resize((w, h), Image.LANCZOS)
    else:
        cut = cutout(src).convert('RGBA')
        cut.thumbnail((w - 4, h - 4), Image.LANCZOS)
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        im.paste(cut, ((w - cut.width) // 2, (h - cut.height) // 2), cut)
    dest = OUT / f'{n}.webp'
    save_webp(im, dest, MAXKB.get(n, 45)); print(n, im.size, dest.stat().st_size, flush=True)

def sheet():
    names = list(paint.ITEMS); cell, pad, cols = 160, 12, 8
    rows = (len(names) + cols - 1) // cols
    out = Image.new('RGB', (cols * (cell + pad) + pad, rows * (cell + pad) + pad), (128, 128, 128))
    for i, n in enumerate(names):
        im = Image.open(OUT / f'{n}.webp').convert('RGBA'); im.thumbnail((cell, cell))
        out.paste(im, (pad + (i % cols) * (cell + pad), pad + (i // cols) * (cell + pad)), im)
    SHEET.parent.mkdir(parents=True, exist_ok=True); out.save(SHEET); print(SHEET)

if __name__ == '__main__':
    if sys.argv[1:2] == ['sheet']: sheet()
    else:
        raw = Path(sys.argv[1] if len(sys.argv) > 1 else '.puzzle-raw')
        for n in (sys.argv[2:] or list(paint.ITEMS)):
            if (raw / f'{n}.png').exists(): pick(raw, n)
            else: print('not painted yet:', n)
