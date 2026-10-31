#!/usr/bin/env python3
"""
Tidies the Gem Keep Crystal Night pictures (docs/prompts/gem-keep-art.md) into small WebP files the game uses
(src/games/gem-keep/art/). Runs on James's computer only, never in the site build. Needs Python with Pillow, numpy,
scipy and rembg (the venv at ~/.cache/rembg-venv has all four).

  python3 scripts/gem-keep-art.py board    IN.png 3       # level 3's board: 1600 x 1000 and an 800 x 500 copy
  python3 scripts/gem-keep-art.py campaign IN.png         # the world map: 1600 and 800 wide, shape kept
  python3 scripts/gem-keep-art.py sprite   IN.png boss    # cut out with rembg, centred on a square, sized by kind
  python3 scripts/gem-keep-art.py all      INBOX_DIR      # everything in docs/gem-keep-art/picks.json
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'gem-keep' / 'art'
PICKS = ROOT / 'docs' / 'gem-keep-art' / 'picks.json'
# Square size of each sprite: about twice the size it's drawn at on a Chromebook, so it stays sharp.
SPRITE_SIZE = {
    'tower-1': 256, 'tower-2': 256, 'tower-3': 256, 'keep': 320, 'rock': 160,
    'gem-red': 128, 'gem-blue': 128, 'gem-green': 128, 'gem-yellow': 128,
    'walker': 160, 'runner': 160, 'brute': 192, 'swarm': 112, 'boss': 256,
}
# Solid stone shapes: holes rembg leaves inside the outline are filled (needs scipy, which the rembg venv has).
SOLID = {'tower-1', 'tower-2', 'tower-3', 'keep', 'rock'}


def save(img: Image.Image, path: Path, quality=82):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=quality, method=6)
    print(f'{path.relative_to(ROOT)}  {img.width}x{img.height}  {path.stat().st_size // 1024} KB')


def board(src: str, n: int):
    img = Image.open(src).convert('RGB')
    # Boards are painted at 16:10 over the level's own layout, so no cropping: just resize.
    for size, suffix in (((1600, 1000), ''), ((800, 500), '-800')):
        save(img.resize(size, Image.LANCZOS), ART / 'boards' / f'board-level-{n}{suffix}.webp', quality=78)


def campaign(src: str):
    img = Image.open(src).convert('RGB')
    for width, suffix in ((1600, ''), (800, '-800')):
        save(img.resize((width, round(img.height * width / img.width)), Image.LANCZOS), ART / 'campaign' / f'campaign{suffix}.webp', quality=78)


def trim(img: Image.Image, pad=4, min_alpha=40) -> Image.Image | None:
    a = np.asarray(img)[..., 3] > min_alpha
    if a.sum() < 400:
        return None
    ys, xs = np.where(a)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


def sprite(src: str, name: str):
    """Cuts the object off its background, then centres it on a transparent square."""
    if name not in SPRITE_SIZE:
        sys.exit(f'{name}: not a sprite the game looks for ({", ".join(SPRITE_SIZE)})')
    from rembg import new_session, remove
    global _session
    if '_session' not in globals():
        _session = new_session('isnet-general-use')
    painted = Image.open(src).convert('RGB')
    cut = remove(painted, session=_session)
    # rembg blackens what it removes; only its outline is used, the colours stay as painted.
    rgba = np.dstack([np.asarray(painted), np.asarray(cut)[..., 3]])
    # Dark stone comes out half see-through: firm up everything but the softest edge.
    alpha = np.clip((rgba[..., 3].astype(int) - 25) * 4, 0, 255).astype(np.uint8)
    if name in SOLID:
        # rembg sees the dark gaps between bricks as background: fill every hole inside the outline.
        from scipy.ndimage import binary_fill_holes
        alpha = np.maximum(alpha, binary_fill_holes(alpha > 128).astype(np.uint8) * 255)
    # Drop stray specks (they make the trimmed box too big and the sprite too small): keep pieces at least
    # a twentieth the size of the biggest one.
    from scipy.ndimage import label
    pieces, count = label(alpha > 40)
    if count > 1:
        sizes = np.bincount(pieces.ravel())[1:]
        keep = np.isin(pieces, np.flatnonzero(sizes >= sizes.max() / 20) + 1)
        alpha = np.where(keep, alpha, 0).astype(np.uint8)
    rgba[..., 3] = alpha
    img = trim(Image.fromarray(rgba, 'RGBA'))
    if img is None:
        sys.exit(f'{src}: nothing left after cutting out')
    side = max(img.width, img.height)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    size = SPRITE_SIZE[name]
    save(square.resize((size, size), Image.LANCZOS), ART / 'sprites' / f'{name}.webp', quality=85)


def everything(inbox: str):
    picks = json.loads(PICKS.read_text())
    for n, file in picks['boards'].items():
        board(f'{inbox}/{file}', int(n))
    campaign(f'{inbox}/{picks["campaign"]}')
    for name, file in picks['sprites'].items():
        sprite(f'{inbox}/{file}', name)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    kind, src = sys.argv[1], sys.argv[2]
    if kind == 'board':
        board(src, int(sys.argv[3]))
    elif kind == 'campaign':
        campaign(src)
    elif kind == 'sprite':
        sprite(src, sys.argv[3])
    elif kind == 'all':
        everything(src)
    else:
        sys.exit(__doc__)
