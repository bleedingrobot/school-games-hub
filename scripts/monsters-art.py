#!/usr/bin/env python3
"""
Tidies James's Maths Monsters pictures (docs/prompts/maths-monsters-art.md, stage B) into small WebP files the game uses
(src/games/monsters/art/painted/). Runs on this computer only, never in the site build. Needs Python with Pillow, numpy,
scipy and rembg (pip install "rembg[cpu]", model cached in ~/.u2net), e.g. the venv in ~/.cache/rembg-venv.

  ~/.cache/rembg-venv/bin/python scripts/monsters-art.py                   # everything in the final folder that is new or changed
  ~/.cache/rembg-venv/bin/python scripts/monsters-art.py --force           # redo everything
  ~/.cache/rembg-venv/bin/python scripts/monsters-art.py monster-penguin-1 # redo just these slots (always redone)
  ~/.cache/rembg-venv/bin/python scripts/monsters-art.py --src DIR ...     # read the PNGs from another folder

The sources are ~/dragon-art-inbox/maths-monsters-final/<slot>.png, one figure on a flat white background:

  monster-<family>-<stage>[-shiny]  → monsters/<family>-<stage>[-shiny].webp  384 square, plus -small 128    cut out
  person-<name>                     → people/<name>.webp                     640 tall, plus -small 200 square head and shoulders, cut out
  avatar-<boy|girl>-NN              → looks/<boy|girl>-NN.webp               same as people
  scene-<map id or tower-N>         → scenes/<name>.webp                     1600 wide and -800, cropped to 16:9, not cut out
  badge-<type>, item-<id>           → badges/, items/                        256 square, cut out

Names become file names with the same rule as art/painted.ts (slug). A slot is skipped when all its outputs are newer
than its PNG, so the script can be run again whenever more pictures arrive. Pictures are done one at a time, because
rembg wants a lot of memory.
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'monsters' / 'art' / 'painted'
SRC = Path.home() / 'dragon-art-inbox' / 'maths-monsters-final'

# How each group is made: the folder, the size and whether it is cut out.
GROUPS = {'monster': 'monsters', 'person': 'people', 'avatar': 'looks', 'scene': 'scenes', 'badge': 'badges', 'item': 'items'}

# Pictures that rembg gets wrong, and what to do instead (found by looking at the contact sheets):
#   'flat'  the plain flood-fill from the edges (remove_background), which keeps white inside the outline
#   'union' rembg, plus anything the flood-fill says is not background (rembg ate a white belly or white antlers)
#   'plain' rembg without alpha matting (the matting blurred a thin outline away)
#   'glow'  rembg, plus see-through by how far each pixel is from white, so a flame's glow fades out instead of
#           ending in a hard pale disc
OVERRIDES: dict[str, str] = {
    'monster-remaindeer-2': 'union',  # rembg faded the icy tip of the right antler
    'person-wee-hana': 'glow',  # rembg dropped the whole torch flame
}


def slug(name: str) -> str:
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', name.lower()))


def save(img: Image.Image, group: str, name: str, quality=80):
    out = ART / group / f'{name}.webp'
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=quality, method=6)
    print(f'  {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB', flush=True)


def fit_width(img: Image.Image, width: int) -> Image.Image:
    if img.width <= width:
        return img
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def fit_height(img: Image.Image, height: int) -> Image.Image:
    if img.height <= height:
        return img
    return img.resize((round(img.width * height / img.height), height), Image.LANCZOS)


def square(img: Image.Image, size: int) -> Image.Image:
    """Shrinks a cut-out to fit a see-through square, centred."""
    scale = min(size / img.width, size / img.height, 1.0)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return out


def scene(img: Image.Image, name: str):
    """A battle background: 1600 and 800 wide, cropped to 16:9 (the same crop as Dragon Maths places)."""
    img = img.convert('RGB')
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


def flat_background(rgb: np.ndarray, tol=40.0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The background: everything joined to the edges that is close to the edge colour. Returns it, the distance and the colour."""
    from scipy import ndimage
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(edge, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    near = dist < tol
    # Grow from the edges through background-coloured pixels only (so white inside the outline stays).
    labels, _ = ndimage.label(near)
    edge_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    region = np.isin(labels, edge_labels[edge_labels > 0])
    return region, dist, bg


def remove_background(img: Image.Image, tol=40.0, soft=34.0) -> Image.Image:
    """Makes the flat background see-through (as in lord-art.py), with a soft, colour-unmixed edge."""
    rgb = np.asarray(img.convert('RGB')).astype(np.float32)
    region, dist, bg = flat_background(rgb, tol)
    alpha = np.where(region, 0.0, 1.0)
    # Soften the edge: pixels next to the background fade by how close they are to its colour, with the colour unmixed.
    ring = np.zeros_like(region)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2)):
        ring |= np.roll(np.roll(region, dy, 0), dx, 1)
    ring &= ~region
    alpha = np.where(ring, np.clip((dist - tol) / soft, 0.15, 1.0), alpha)
    a3 = alpha[..., None]
    unmixed = np.where(a3 > 0, (rgb - (1 - a3) * bg) / np.maximum(a3, 1e-3), rgb)
    return Image.fromarray(np.dstack([np.clip(unmixed, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')


_session = None


def rembg_cut(img: Image.Image, matting=True) -> Image.Image:
    """Cuts out the figure with rembg, the same model and settings as the Dragon Maths hero looks."""
    from rembg import new_session, remove
    global _session
    if _session is None:
        _session = new_session('isnet-general-use')
    return remove(img.convert('RGB'), session=_session, alpha_matting=matting)


def cut(img: Image.Image, how: str) -> Image.Image:
    if how == 'flat':
        return remove_background(img)
    out = rembg_cut(img, matting=how != 'plain')
    if how == 'union':
        # Put back whatever is inside the figure's outline: the flood-fill keeps white that isn't joined to the edges.
        region, _, _ = flat_background(np.asarray(img.convert('RGB')).astype(np.float32))
        keep = Image.fromarray((~region * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))
        a = np.maximum(np.asarray(out)[..., 3], np.asarray(keep))
        out = img.convert('RGBA')
        out.putalpha(Image.fromarray(a))
    elif how == 'glow':
        rgb = np.asarray(img.convert('RGB')).astype(np.float32)
        _, dist, bg = flat_background(rgb)
        glow = np.clip((dist - 12) / 90, 0, 1)
        a = np.maximum(np.asarray(out)[..., 3] / 255, glow)
        # Where the glow decides, unmix the white so it doesn't look milky on a dark background.
        a3 = a[..., None]
        unmixed = np.where((glow > np.asarray(out)[..., 3] / 255)[..., None], (rgb - (1 - a3) * bg) / np.maximum(a3, 1e-3), rgb)
        out = Image.fromarray(np.dstack([np.clip(unmixed, 0, 255), a * 255]).astype(np.uint8), 'RGBA')
    return out


def tidy(img: Image.Image, min_alpha=40, pad=6) -> Image.Image | None:
    """Drops loose specks (anything much smaller than the biggest piece) and trims to the figure."""
    from scipy import ndimage
    rgba = np.asarray(img).copy()
    solid = rgba[..., 3] > min_alpha
    labels, n = ndimage.label(solid)
    if n == 0:
        return None
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    keep = np.isin(labels, 1 + np.flatnonzero(sizes >= sizes.max() * 0.02))
    # Grow the kept pieces a little so their soft edges stay, then clear everything else.
    keep = ndimage.binary_dilation(keep, iterations=3)
    rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
    ys, xs = np.where(rgba[..., 3] > min_alpha)
    if len(xs) < 400:
        return None
    out = Image.fromarray(rgba, 'RGBA')
    return out.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(out.width, xs.max() + pad + 1), min(out.height, ys.max() + pad + 1)))


def head_and_shoulders(img: Image.Image) -> Image.Image:
    """A square from the top of a standing figure, centred on the head, for the talk box."""
    a = np.asarray(img)[..., 3] > 40
    side = round(img.height * 0.36)
    xs = np.where(a[: round(img.height * 0.12)])[1]
    cx = int(np.median(xs)) if len(xs) else img.width // 2
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    piece = img.crop((max(0, cx - side // 2), 0, min(img.width, cx - side // 2 + side), side))
    out.paste(piece, (max(0, side // 2 - cx), 0))
    return out


def outputs(slot: str) -> tuple[str, str, list[str]]:
    """The group folder, the file name and every file a slot makes."""
    kind, name = slot.split('-', 1)
    group = GROUPS[kind]
    name = slug(name)
    if group == 'scenes':
        names = [name, f'{name}-800']
    elif group in ('badges', 'items'):
        names = [name]
    else:
        names = [name, f'{name}-small']
    return group, name, [ART / group / f'{n}.webp' for n in names]


def make(src: Path):
    slot = src.stem
    group, name, _ = outputs(slot)
    print(f'{slot}', flush=True)
    img = Image.open(src)
    if group == 'scenes':
        scene(img, name)
        return
    img = img.convert('RGB')
    # Work at about 1024 px: plenty for the biggest copy (640), and rembg's matting is much quicker and lighter.
    img.thumbnail((1024, 1024), Image.LANCZOS)
    how = OVERRIDES.get(slot, 'rembg')
    fig = tidy(cut(img, how))
    if fig is None:
        print(f'  ! nothing left after cutting out ({how})', flush=True)
        return
    if group == 'monsters':
        save(square(fig, 384), group, name)
        save(square(fig, 128), group, f'{name}-small')
    elif group in ('people', 'looks'):
        save(fit_height(fig, 640), group, name)
        save(square(head_and_shoulders(fig), 200), group, f'{name}-small')
    else:
        save(square(fig, 256), group, name)


def stale(src: Path) -> bool:
    files = outputs(src.stem)[2]
    return not all(f.exists() and f.stat().st_mtime > src.stat().st_mtime for f in files)


if __name__ == '__main__':
    args = sys.argv[1:]
    force = '--force' in args
    args = [a for a in args if a != '--force']
    if '--src' in args:
        i = args.index('--src')
        SRC = Path(args[i + 1]).expanduser()
        del args[i:i + 2]
    if any(a.startswith('-') for a in args):
        sys.exit(__doc__)
    if args:
        todo = [SRC / f'{a}.png' for a in args]
        missing = [str(p) for p in todo if not p.exists()]
        if missing:
            sys.exit(f'Not found: {", ".join(missing)}')
    else:
        todo = [p for p in sorted(SRC.glob('*.png')) if p.stem.split('-', 1)[0] in GROUPS and (force or stale(p))]
    print(f'{len(todo)} to do', flush=True)
    for src in todo:
        make(src)
