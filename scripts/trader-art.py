#!/usr/bin/env python3
"""
Tidies James's Star Trader paintings (~/dragon-art-inbox/trader-art, plan in docs/TRADER-ART-PLAN.md) into small WebP
files the game uses (src/games/trader/art/paint.ts). Runs on the server only, never in the site build.
Needs Pillow and numpy, and rembg for the ship cut-outs (on this server it's in ~/.cache/rembg-venv).

  ~/.cache/rembg-venv/bin/python scripts/trader-art.py                 # everything still missing
  ~/.cache/rembg-venv/bin/python scripts/trader-art.py planets         # just this group
  ~/.cache/rembg-venv/bin/python scripts/trader-art.py --force ships   # make them again even if they're there
  ~/.cache/rembg-venv/bin/python scripts/trader-art.py --sheets DIR    # contact sheets of the results, to check by eye

Some pictures were made more than once; docs/trader-art/picks.json says which try is used.
A file that's already there is skipped, so a run that stops part-way can just be started again.
"""
import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'trader' / 'art' / 'paint'
INBOX = Path(os.environ.get('TRADER_ART_INBOX', Path.home() / 'dragon-art-inbox' / 'trader-art'))
PICKS = json.loads((ROOT / 'docs' / 'trader-art' / 'picks.json').read_text())

SHIP_LONG, SHIP_CARD = 512, 160
MAP_W, MAP_SMALL_W = 1024, 256
SCENE_W, SCENE_SMALL_W = 1600, 800
GROUPS = ('ships', 'planets', 'scenes')


def pick(stem: str) -> dict:
    group = stem.split('-', 1)[0]
    return PICKS.get(stem) or PICKS.get(f'{group}-*') or {}


def save(img: Image.Image, out: Path, quality: int):
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=quality, method=6)
    print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB', flush=True)


def fit_long(img: Image.Image, size: int) -> Image.Image:
    scale = size / max(img.width, img.height)
    return img if scale >= 1 else img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)


def trim(img: Image.Image, pad=6, min_alpha=40) -> Image.Image | None:
    a = np.asarray(img)[..., 3] > min_alpha
    if a.sum() < 400:
        return None
    ys, xs = np.where(a)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


_session = None


def cut_out(src: Path) -> Image.Image:
    """The ship on its white background, cut out with rembg and trimmed to the ship."""
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session('isnet-general-use')
    img = trim(remove(Image.open(src).convert('RGB'), session=_session, alpha_matting=True))
    if img is None:
        raise SystemExit(f'{src.name}: nothing left after cutting out')
    return img


def even_out(a: np.ndarray) -> np.ndarray:
    """Takes out light that changes from left to right (a lamp on one side, a darker edge), so the turning planet
    shows no bright or dark stripe. Only the big slow change goes; craters and patches stay."""
    lum = a.mean(axis=2)
    cols = lum[lum.shape[0] // 6: -lum.shape[0] // 6].mean(axis=0)
    w = a.shape[1]
    # Laid end to end three times so the blur wraps round the way the planet does.
    sigma = w / 10
    x = np.arange(-3 * sigma, 3 * sigma + 1)
    kernel = np.exp(-x ** 2 / (2 * sigma ** 2))
    wide = np.convolve(np.tile(cols, 3), kernel / kernel.sum(), mode='same')[w:2 * w]
    return np.clip(a * (wide.mean() / np.maximum(wide, 1))[None, :, None], 0, 255)


def wrap_seam(a: np.ndarray, blend_frac=0.08) -> np.ndarray:
    """Cross-fades the right end into the left so the map's two edges meet with no join, then drops the faded strip."""
    w = a.shape[1]
    k = int(w * blend_frac)
    t = np.linspace(0, 1, k)[None, :, None]
    out = a[:, :w - k].copy()
    out[:, :k] = a[:, w - k:] * (1 - t) + a[:, :k] * t
    return out


def jobs(groups: set[str]):
    """(source file, folder, name in the game) for every picture the game uses."""
    for f in sorted(INBOX.glob('*.png')):
        m = re.match(r'([a-z]+)-(.+)-(\d+)$', f.stem)
        if not m or m[1] not in groups:
            continue
        if pick(f'{m[1]}-{m[2]}').get('try', 1) == int(m[3]):
            yield f, m[1], m[2]


def outputs(folder: str, name: str) -> list[Path]:
    small = {'ships': 'card', 'planets': 'small', 'scenes': '800'}[folder]
    return [ART / folder / f'{name}.webp', ART / folder / f'{name}-{small}.webp']


def make(job):
    src, folder, name = job
    if folder == 'ships':
        img = cut_out(src)
        save(fit_long(img, SHIP_LONG), ART / folder / f'{name}.webp', 82)
        save(fit_long(img, SHIP_CARD), ART / folder / f'{name}-card.webp', 80)
    elif folder == 'planets':
        a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
        if pick(f'planets-{name}').get('even'):
            a = even_out(a)
        img = Image.fromarray(wrap_seam(a).round().astype(np.uint8))
        save(img.resize((MAP_W, MAP_W // 2), Image.LANCZOS), ART / folder / f'{name}.webp', 80)
        save(img.resize((MAP_SMALL_W, MAP_SMALL_W // 2), Image.LANCZOS), ART / folder / f'{name}-small.webp', 78)
    else:
        img = Image.open(src).convert('RGB')
        save(fit_long(img, SCENE_W), ART / folder / f'{name}.webp', 72)
        save(fit_long(img, SCENE_SMALL_W), ART / folder / f'{name}-800.webp', 70)


def sheets(out_dir: Path):
    """Ships on a dark and a light square (to check the cut edges), and each planet map twice side by side (to check
    the join where the two edges meet)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    ships = sorted(f for f in (ART / 'ships').glob('*.webp') if not f.stem.endswith('-card'))
    if ships:
        cell, cols = 260, 3
        sheet = Image.new('RGB', (cols * cell, 2 * ((len(ships) + cols - 1) // cols) * (cell // 2 + 16)), (40, 40, 44))
        draw = ImageDraw.Draw(sheet)
        for i, f in enumerate(ships * 2):
            x, y = (i % cols) * cell, (i // cols) * (cell // 2 + 16)
            sheet.paste((24, 25, 27) if i < len(ships) else (225, 220, 205), (x + 2, y + 2, x + cell - 2, y + cell // 2 - 2))
            img = Image.open(f).convert('RGBA')
            img.thumbnail((cell - 12, cell // 2 - 12))
            sheet.paste(img, (x + (cell - img.width) // 2, y + (cell // 2 - img.height) // 2), img)
            draw.text((x + 4, y + cell // 2), f.stem, fill=(230, 230, 230))
        sheet.save(out_dir / 'ships.jpg', quality=82)
        print(out_dir / 'ships.jpg')
    planets = sorted(f for f in (ART / 'planets').glob('*.webp') if not f.stem.endswith('-small'))
    if planets:
        w, h, cols = 600, 150, 2
        sheet = Image.new('RGB', (cols * w, ((len(planets) + cols - 1) // cols) * (h + 16)), (40, 40, 44))
        draw = ImageDraw.Draw(sheet)
        for i, f in enumerate(planets):
            x, y = (i % cols) * w, (i // cols) * (h + 16)
            img = Image.open(f).convert('RGB').resize((w // 2, h))
            sheet.paste(img, (x, y + 16))
            sheet.paste(img, (x + w // 2, y + 16))
            draw.text((x + 4, y + 2), f'{f.stem} (the join is in the middle)', fill=(230, 230, 230))
        sheet.save(out_dir / 'planets.jpg', quality=82)
        print(out_dir / 'planets.jpg')


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--sheets' in args:
        sheets(Path(args[args.index('--sheets') + 1]) if len(args) > args.index('--sheets') + 1 else ROOT / 'dist-trader-art-sheets')
        sys.exit()
    force = '--force' in args
    groups = {a for a in args if not a.startswith('--')} or set(GROUPS)
    unknown = groups - set(GROUPS)
    if unknown:
        sys.exit(f'Unknown groups: {", ".join(sorted(unknown))}. Use: {", ".join(GROUPS)}')
    todo = [j for j in jobs(groups) if force or not all(p.exists() for p in outputs(j[1], j[2]))]
    print(f'{len(todo)} pictures to make', flush=True)
    workers = int(os.environ.get('TRADER_ART_WORKERS', '2'))
    with ProcessPoolExecutor(workers) as pool:
        for _ in pool.map(make, todo):
            pass
    print('done', flush=True)
