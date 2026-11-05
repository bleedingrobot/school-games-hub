#!/usr/bin/env python3
"""
Royal Decree villager pictures: raw ComfyUI PNGs -> game WebPs (run with the rembg venv: ~/.cache/rembg-venv/bin/python).

  python3 scripts/decree-art.py person IN.png baker   # one villager, cut out with rembg, 720 high + a 240-high -small copy
  python3 scripts/decree-art.py all INBOX_DIR         # everything in docs/decree-art/picks.json
Same cut-out as scripts/kingdom-art.py.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'decree' / 'art'
PICKS = ROOT / 'docs' / 'decree-art' / 'picks.json'


def save(img: Image.Image, name: str, quality: int):
    out = ART / 'people' / f'{name}.webp'
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=quality, method=6)
    print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB')


def fit_height(img: Image.Image, height: int) -> Image.Image:
    return img if img.height <= height else img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def trim(img: Image.Image, pad=6, min_alpha=40) -> Image.Image:
    a = np.asarray(img)[..., 3] > min_alpha
    if a.sum() < 400:
        sys.exit('nothing left after cutting out')
    ys, xs = np.where(a)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


_session = None


def cut(src: str) -> Image.Image:
    """Cuts a figure off its white painted paper with rembg (isnet-general-use); pale cloth that rembg made see-through is made solid again."""
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
    arr[..., :3] = np.where(solid[..., None], rgb.astype(np.uint8), arr[..., :3])
    alpha = np.where(solid, 255, alpha)
    arr[..., 3] = np.where(alpha < 24, 0, alpha)
    return trim(Image.fromarray(arr, 'RGBA'))


def person(src: str, name: str):
    img = cut(src)
    save(fit_height(img, 720), name, 78)
    save(fit_height(img, 240), f'{name}-small', 76)


def all_(inbox: str):
    for slot, file in json.loads(PICKS.read_text()).items():
        print(slot, '<-', file)
        person(str(Path(inbox) / file), slot)


if __name__ == '__main__':
    cmd, *args = sys.argv[1:]
    {'person': person, 'all': all_}[cmd](*args)
