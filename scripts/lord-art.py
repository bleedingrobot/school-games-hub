#!/usr/bin/env python3
"""
Tidies James's Dragon Maths pictures (docs/lord-art/PROMPTS.md) into small WebP files the game uses (src/games/lord/art.ts).
Runs on the server only, never in the site build. Needs Python with Pillow and numpy (both already on the server).

  python3 scripts/lord-art.py scene    IN.png forest-1          # a place: 1600 and 800 wide, cropped to 16:9
  python3 scripts/lord-art.py map      IN.png                   # the kingdom map: 1600 and 800 wide, shape kept
  python3 scripts/lord-art.py cutout   IN.png people innkeeper  # one figure on a flat background: background removed
  python3 scripts/lord-art.py sheet    IN.png monsters 5 2 "Mud Slug" "Hungry Hedgehog" ...   # a grid sheet, left to right, top to bottom
  python3 scripts/lord-art.py preview  IN.png 5 2              # show where a sheet would be cut (writes IN-cuts.png)

Names become file names with the same rule as art.ts (slug). A name of "-" skips that cell.
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ART = Path(__file__).resolve().parent.parent / 'src' / 'games' / 'lord' / 'art'
SIZES = {'monsters': 320, 'masters': 420, 'people': 720, 'dragon': 720}


def slug(name: str) -> str:
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', name.lower()))


def save(img: Image.Image, group: str, name: str, quality=78):
    out = ART / group / f'{name}.webp'
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=quality, method=6)
    print(f'  {out.relative_to(ART.parent.parent.parent.parent)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB')


def fit_width(img: Image.Image, width: int) -> Image.Image:
    if img.width <= width:
        return img
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def scene(src: str, name: str):
    img = Image.open(src).convert('RGB')
    w, h = img.size
    if w / h > 16 / 9:  # too wide: trim the sides
        nw = round(h * 16 / 9)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:  # too tall: keep the middle, a little lower than centre (the ground matters more than the sky)
        nh = round(w * 9 / 16)
        top = min(h - nh, round((h - nh) * 0.6))
        img = img.crop((0, top, w, top + nh))
    save(fit_width(img, 1600), 'scenes', name, 72)
    save(fit_width(img, 800), 'scenes', f'{name}-800', 70)


def map_(src: str):
    img = Image.open(src).convert('RGB')
    save(fit_width(img, 1600), 'scenes', 'map', 74)
    save(fit_width(img, 800), 'scenes', 'map-800', 72)


def remove_background(img: Image.Image, tol=40.0, soft=34.0) -> Image.Image:
    """Makes the flat background see-through: everything joined to the edges that is close to the edge colour."""
    rgb = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(edge, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    near = dist < tol
    # Grow from the edges through background-coloured pixels only (so a teal monster in the middle stays).
    region = np.zeros_like(near)
    region[0, :], region[-1, :], region[:, 0], region[:, -1] = near[0, :], near[-1, :], near[:, 0], near[:, -1]
    while True:
        grown = region.copy()
        grown[1:] |= region[:-1]
        grown[:-1] |= region[1:]
        grown[:, 1:] |= region[:, :-1]
        grown[:, :-1] |= region[:, 1:]
        grown &= near
        if (grown == region).all():
            break
        region = grown
    alpha = np.where(region, 0.0, 1.0)
    # Soften the edge: pixels next to the background fade by how close they are to its colour, with the colour unmixed.
    ring = np.zeros_like(region)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2)):
        ring |= np.roll(np.roll(region, dy, 0), dx, 1)
    ring &= ~region
    a_ring = np.clip((dist - tol) / soft, 0.15, 1.0)
    alpha = np.where(ring, a_ring, alpha)
    a3 = alpha[..., None]
    unmixed = np.where(a3 > 0, (rgb - (1 - a3) * bg) / np.maximum(a3, 1e-3), rgb)
    out = np.dstack([np.clip(unmixed, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(img: Image.Image, pad=6, min_alpha=40) -> Image.Image | None:
    a = np.asarray(img)[..., 3] > min_alpha
    if a.sum() < 400:
        return None
    ys, xs = np.where(a)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


def fit_height(img: Image.Image, height: int) -> Image.Image:
    if img.height <= height:
        return img
    return img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def cutout(src: str, group: str, name: str):
    img = trim(remove_background(Image.open(src)))
    if img is None:
        sys.exit('Nothing left after removing the background: is the background a flat colour?')
    save(fit_height(img, SIZES.get(group, 600)), group, slug(name), 80)


def cells(w, h, cols, rows):
    for r in range(rows):
        for c in range(cols):
            yield (round(c * w / cols), round(r * h / rows), round((c + 1) * w / cols), round((r + 1) * h / rows))


def sheet(src: str, group: str, cols: int, rows: int, names: list[str]):
    clear = remove_background(Image.open(src))
    if len(names) > cols * rows:
        sys.exit(f'{len(names)} names but only {cols * rows} cells')
    for box, name in zip(cells(clear.width, clear.height, cols, rows), names):
        if name == '-':
            continue
        piece = trim(clear.crop(box))
        if piece is None:
            print(f'  (empty cell for {name})')
            continue
        save(fit_height(piece, SIZES.get(group, 320)), group, slug(name), 82)


def preview(src: str, cols: int, rows: int):
    img = Image.open(src).convert('RGB')
    draw = ImageDraw.Draw(img)
    for box in cells(img.width, img.height, cols, rows):
        draw.rectangle(box, outline=(255, 0, 255), width=3)
    out = Path(src).with_name(Path(src).stem + '-cuts.png')
    img.save(out)
    print(out)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    kind, src, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
    if kind == 'scene':
        scene(src, rest[0])
    elif kind == 'map':
        map_(src)
    elif kind == 'cutout':
        cutout(src, rest[0], rest[1])
    elif kind == 'sheet':
        sheet(src, rest[0], int(rest[1]), int(rest[2]), rest[3:])
    elif kind == 'preview':
        preview(src, int(rest[0]), int(rest[1]))
    else:
        sys.exit(__doc__)
