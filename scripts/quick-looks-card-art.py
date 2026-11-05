#!/usr/bin/env python3
"""
Paints the home page card for Quick looks (src/assets/home/quick-looks.webp) in the clay style of the other Foundational
skills cards (Beanstalk, Hop, Pipi, Penguin Pairs, Weka), in ComfyUI on James's gaming PC. Runs on a computer that can
reach ComfyUI on Tailscale, never in the site build. Same graph and seeds as scripts/weka-art.py.

  python3 scripts/quick-looks-card-art.py paint OUT_DIR [--tries 4]   # OUT_DIR/card-<try>.png
  python3 scripts/quick-looks-card-art.py pick OUT_DIR/card-2.png     # -> src/assets/home/quick-looks(-small).webp
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / 'src' / 'assets' / 'home'

# Borrow Weka's ComfyUI graph and caller, so the look and settings stay the same.
_spec = importlib.util.spec_from_file_location('weka_art', ROOT / 'scripts' / 'weka-art.py')
weka = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(weka)

STYLE = weka.STYLES['b']
CARD = (
    'Dot, a cute round little ladybird made of clay, shiny red shell with big black spots, a happy smiling face with big eyes, '
    'wearing a little knitted yellow scarf, standing proudly in the middle of a sunny cottage garden, waving one arm. Behind '
    'her a row of small wooden raised garden beds full of bright clay flowers, daisies, tulips and sunflowers, a low white '
    'picket fence, soft green hills and a calm pale blue sky with one fluffy cloud. The ladybird and the flower beds in the '
    'upper middle of the picture, plain green lawn along the bottom, wide landscape picture for a game title card. '
    'Suitable for young children aged 5 to 7.'
)


def paint(out: Path, tries: int):
    """Tries go to OUT_DIR/q/card-<n>.png (fixed seeds, so a try can be painted again exactly)."""
    weka.PICTURES = {'card': (CARD, (1216, 688))}
    weka.STYLES = {'q': STYLE}
    weka.paint(out, ['card'], 'q', tries)


def pick(src: Path):
    from PIL import Image
    img = Image.open(src).convert('RGB')
    for size, name, q in ((1600, 'quick-looks', 80), (800, 'quick-looks-small', 78)):
        im = img.copy()
        im.thumbnail((size, size), Image.LANCZOS)
        out = HOME / f'{name}.webp'
        im.save(out, 'WEBP', quality=q, method=6)
        print(f'  {out.relative_to(ROOT)}  {im.width}x{im.height}  {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['paint'] and len(a) >= 2:
        tries = int(a[a.index('--tries') + 1]) if '--tries' in a else 4
        paint(Path(a[1]).expanduser(), tries)
    elif a[:1] == ['pick'] and len(a) == 2:
        pick(Path(a[1]).expanduser())
    else:
        sys.exit(__doc__)
