#!/usr/bin/env python3
"""
Tidies the Kingdom Keeper pictures (docs/kingdom-art/PROMPTS.md) into small WebP files the game uses
(src/games/kingdom/art/). Runs on James's computer only, never in the site build. Needs Python with Pillow and numpy,
and rembg for the people (the venv at ~/.cache/rembg-venv has all three).

  python3 scripts/kingdom-art.py scene   IN.png market        # a place: 1600 and 800 wide, cropped to 16:9
  python3 scripts/kingdom-art.py map     IN.png               # the valley map: 1600 and 800 wide, shape kept
  python3 scripts/kingdom-art.py person  IN.png steward       # an adviser, cut out with rembg, 720 high
  python3 scripts/kingdom-art.py ruler   IN.png ruler-girl-1  # a ruler look: 720 high and a 240-high -small copy
  python3 scripts/kingdom-art.py all     INBOX_DIR            # everything in docs/kingdom-art/picks.json
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'kingdom' / 'art'
PICKS = ROOT / 'docs' / 'kingdom-art' / 'picks.json'
PEOPLE = {'steward', 'reeve', 'ratcatcher', 'trader', 'healer', 'builder'}


def save(img: Image.Image, group: str, name: str, quality=74):
    out = ART / group / f'{name}.webp'
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=quality, method=6)
    print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB')


def fit_width(img: Image.Image, width: int) -> Image.Image:
    return img if img.width <= width else img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def fit_height(img: Image.Image, height: int) -> Image.Image:
    return img if img.height <= height else img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def scene(src: str, name: str):
    img = Image.open(src).convert('RGB')
    w, h = img.size
    if w / h > 16 / 9:  # too wide: trim the sides
        nw = round(h * 16 / 9)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:  # too tall: keep a little below the middle (the ground matters more than the sky)
        nh = round(w * 9 / 16)
        top = min(h - nh, round((h - nh) * 0.6))
        img = img.crop((0, top, w, top + nh))
    save(fit_width(img, 1600), 'scenes', name, 72)
    save(fit_width(img, 800), 'scenes', f'{name}-800', 70)


def map_(src: str):
    img = Image.open(src).convert('RGB')
    save(fit_width(img, 1600), 'scenes', 'map', 74)
    save(fit_width(img, 800), 'scenes', 'map-800', 72)


def trim(img: Image.Image, pad=6, min_alpha=40) -> Image.Image:
    a = np.asarray(img)[..., 3] > min_alpha
    if a.sum() < 400:
        sys.exit('nothing left after cutting out')
    ys, xs = np.where(a)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


_session = None


def cut(src: str) -> Image.Image:
    """
    Cuts a figure off its white painted paper with rembg (isnet-general-use). rembg makes grey fur and pale cloth
    half see-through (Nettle's terrier), so inside its outline anything clearly not white paper is made solid again.
    """
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session('isnet-general-use')
    src_img = Image.open(src).convert('RGB')
    img = remove(src_img, session=_session, alpha_matting=True)
    arr = np.asarray(img).copy()
    rgb = np.asarray(src_img).astype(np.float32)
    not_paper = np.sqrt(((rgb - 255) ** 2).sum(axis=2)) > 60
    alpha = arr[..., 3]
    solid = (alpha > 16) & not_paper
    # Those pixels get the painting's own colours back (rembg darkens the colour of anything it thought see-through).
    arr[..., :3] = np.where(solid[..., None], rgb.astype(np.uint8), arr[..., :3])
    alpha = np.where(solid, 255, alpha)
    # Paint splatters on the paper come out as faint specks: drop anything nearly see-through.
    arr[..., 3] = np.where(alpha < 24, 0, alpha)
    return trim(Image.fromarray(arr, 'RGBA'))


def person(src: str, name: str):
    save(fit_height(cut(src), 720), 'people', name, 78)


def ruler(src: str, name: str):
    img = cut(src)
    save(fit_height(img, 720), 'rulers', name, 78)
    save(fit_height(img, 240), 'rulers', f'{name}-small', 76)


def all_(inbox: str):
    picks = json.loads(PICKS.read_text())
    for slot, file in picks.items():
        src = str(Path(inbox) / file)
        print(slot, '<-', file)
        if slot == 'map':
            map_(src)
        elif slot in PEOPLE:
            person(src, slot)
        elif slot.startswith('ruler-'):
            ruler(src, slot)
        else:
            scene(src, slot)


if __name__ == '__main__':
    cmd, *args = sys.argv[1:]
    {'scene': scene, 'map': map_, 'person': person, 'ruler': ruler, 'all': all_}[cmd](*args)
