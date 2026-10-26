#!/usr/bin/env python3
"""
Tidies James's Clan Quest pictures (~/dragon-art-inbox/clans-art, plan in docs/CLANS-ART-PLAN.md) into small WebP
files the game uses (src/games/clans/art.ts). Runs on the server only, never in the site build.
Needs Pillow and numpy, and rembg for the cut-outs (pip install "rembg[cpu]"; on this server it's in ~/.cache/rembg-venv).

  ~/.cache/rembg-venv/bin/python scripts/clans-art.py                 # everything still missing
  ~/.cache/rembg-venv/bin/python scripts/clans-art.py monsters items  # just these groups
  ~/.cache/rembg-venv/bin/python scripts/clans-art.py --force scenes  # make them again even if they're there
  ~/.cache/rembg-venv/bin/python scripts/clans-art.py --sheets        # contact sheets of the results, to check by eye

Every picture except the members was made twice; docs/clans-art/default-picks.json says which copy is used.
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
ART = ROOT / 'src' / 'games' / 'clans' / 'art'
INBOX = Path(os.environ.get('CLANS_ART_INBOX', Path.home() / 'dragon-art-inbox' / 'clans-art'))
PICKS = json.loads((ROOT / 'docs' / 'clans-art' / 'default-picks.json').read_text())

# Inbox prefix -> (folder in the game, how tall a cut-out is kept, or None for a wide picture).
GROUPS = {
    'member': ('members', 720), 'monster': ('monsters', 400), 'item': ('items', 200), 'troop': ('troops', 200),
    'building': ('buildings', 200), 'banner': ('banners', 240), 'scene': ('scenes', None), 'quest': ('quests', None),
    'kingdom': ('kingdoms', None),
}
MEMBER_SMALL = 200


def slug(name: str) -> str:
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', name.lower()))


def save(img: Image.Image, out: Path, quality: int):
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=quality, method=6)
    print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB', flush=True)


def fit_width(img: Image.Image, width: int) -> Image.Image:
    return img if img.width <= width else img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def fit_height(img: Image.Image, height: int) -> Image.Image:
    return img if img.height <= height else img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def trim(img: Image.Image, pad=6, min_alpha=40) -> Image.Image | None:
    a = np.asarray(img)[..., 3] > min_alpha
    if a.sum() < 400:
        return None
    ys, xs = np.where(a)
    return img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(img.width, xs.max() + pad + 1), min(img.height, ys.max() + pad + 1)))


_session = None


def cut_out(src: Path) -> Image.Image:
    """The figure on its painted background, cut out with rembg and trimmed to the figure."""
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session('isnet-general-use')
    img = trim(remove(Image.open(src).convert('RGB'), session=_session, alpha_matting=True))
    if img is None:
        raise SystemExit(f'{src.name}: nothing left after cutting out')
    return img


def jobs(groups: set[str]):
    """(source file, folder, name in the game) for every picture the game uses."""
    for f in sorted(INBOX.glob('*.png')):
        prefix, rest = f.stem.split('-', 1)
        if prefix not in GROUPS or GROUPS[prefix][0] not in groups:
            continue
        if prefix == 'member':  # dwarf-knight-female-2: all four looks are used
            yield f, 'members', rest
            continue
        name, copy = rest.rsplit('-', 1)
        if PICKS.get(f'{prefix}-{name}', {}).get('copy', 1) == int(copy):
            yield f, GROUPS[prefix][0], name


def outputs(folder: str, name: str) -> list[Path]:
    extra = '-small' if folder == 'members' else '-800' if GROUPS_BY_FOLDER[folder] is None else None
    return [ART / folder / f'{name}.webp'] + ([ART / folder / f'{name}{extra}.webp'] if extra else [])


GROUPS_BY_FOLDER = {folder: height for folder, height in GROUPS.values()}


def make(job):
    src, folder, name = job
    height = GROUPS_BY_FOLDER[folder]
    if height is None:  # a wide painting: 1600 wide and an 800 copy for phones
        img = Image.open(src).convert('RGB')
        save(fit_width(img, 1600), ART / folder / f'{name}.webp', 72)
        save(fit_width(img, 800), ART / folder / f'{name}-800.webp', 70)
        return
    img = cut_out(src)
    save(fit_height(img, height), ART / folder / f'{name}.webp', 80)
    if folder == 'members':
        save(fit_height(img, MEMBER_SMALL), ART / folder / f'{name}-small.webp', 78)


def sheets(out_dir: Path):
    """Contact sheets of every cut-out on a dark and a light square, to check the edges by eye."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for folder, height in GROUPS_BY_FOLDER.items():
        files = sorted(f for f in (ART / folder).glob('*.webp') if not re.search(r'-(small|800)$', f.stem))
        if not files or height is None:
            continue
        cell, cols = 220, 8
        for page in range(0, len(files), cols * 4):
            chunk = files[page:page + cols * 4]
            rows = (len(chunk) + cols - 1) // cols
            sheet = Image.new('RGB', (cols * cell, rows * (cell + 16)), (40, 40, 44))
            draw = ImageDraw.Draw(sheet)
            for i, f in enumerate(chunk):
                x, y = (i % cols) * cell, (i // cols) * (cell + 16)
                bg = (24, 25, 27) if (i // cols) % 2 == 0 else (225, 220, 205)
                sheet.paste(bg, (x + 2, y + 2, x + cell - 2, y + cell - 2))
                img = Image.open(f).convert('RGBA')
                img.thumbnail((cell - 12, cell - 12))
                sheet.paste(img, (x + (cell - img.width) // 2, y + (cell - img.height) // 2), img)
                draw.text((x + 4, y + cell), f.stem[:34], fill=(230, 230, 230))
            path = out_dir / f'{folder}-{page // (cols * 4) + 1}.jpg'
            sheet.save(path, quality=82)
            print(path)


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--sheets' in args:
        sheets(Path(args[args.index('--sheets') + 1]) if len(args) > args.index('--sheets') + 1 else ROOT / 'dist-clans-art-sheets')
        sys.exit()
    force = '--force' in args
    groups = {a for a in args if not a.startswith('--')} or set(GROUPS_BY_FOLDER)
    unknown = groups - set(GROUPS_BY_FOLDER)
    if unknown:
        sys.exit(f'Unknown groups: {", ".join(sorted(unknown))}. Use: {", ".join(GROUPS_BY_FOLDER)}')
    todo = [j for j in jobs(groups) if force or not all(p.exists() for p in outputs(j[1], j[2]))]
    print(f'{len(todo)} pictures to make', flush=True)
    workers = int(os.environ.get('CLANS_ART_WORKERS', '2'))
    with ProcessPoolExecutor(workers) as pool:
        for _ in pool.map(make, todo):
            pass
    print('done', flush=True)
