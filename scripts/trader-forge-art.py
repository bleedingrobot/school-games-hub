#!/usr/bin/env python3
"""
Tidies James's Star Forge paintings (~/dragon-art-inbox/trader-forge-art, plan in docs/TRADER-SYSTEM-ART-PLAN.md) into the
.webp files the 3D viewer loads (src/games/trader/forge/art/paint/<group>/..., names and sizes from
src/games/trader/forge/viewer/types.ts). Runs on a Mac or server only, never in the site build.
Needs Pillow and numpy, and rembg for the technology cut-outs (on this server it's in ~/.cache/rembg-venv).

  ~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py                 # everything still missing
  ~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py planets clouds  # just these groups
  ~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py --force suns    # make them again even if they're there
  ~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py --sheets DIR    # contact sheets of the inbox, to check by eye
  ~/.cache/rembg-venv/bin/python scripts/trader-forge-art.py --missing       # which pictures are not painted yet

Groups: planets clouds suns skies rings moons night postcards tech buttons.
What each group makes (a "-hd" copy is the big one the Incredible level loads in full screen):
  planets/<kind>-<surface>.webp 1024x512 and -hd 4096x2048, plus -normal and -normal-hd (bump maps made from a height map:
      inbox heights/<name>.png if the PC made one with Depth Anything, otherwise from the picture's own light and dark)
  clouds/<kind>.webp 1024x512 and -hd 4096x2048 (white on black; anything near black is made exactly black)
  suns/<kind>.webp 1024x512 and -hd 2048x1024        night/<kind>.webp 1024x512 and -hd 4096x2048
  skies/<n>.webp 2048x1024 and -hd 8192x4096         moons/<n>.webp 1024x512 and -hd 2048x1024
  rings/<kind>.webp 2048x64 (one line from the inside edge to the outside edge, see-through where the painting is black)
  postcards/<life>-<creature>.webp 1600 wide        buttons/<group>-<key>.webp 512x512
  buttons/surface-<kind>-<n>.webp and buttons/sky-<n>.webp are not painted: they are cut from the middle of the planet and sky maps
  tech/<name>.webp  cut-outs 512 long (white removed), textures 1024x1024 (edges blended so they repeat), glows with black made see-through
Wide maps have their left and right edges blended so they never show a seam as they turn.
The -hd copies are made from the painted size by a careful upscale (and a little film grain so it doesn't look smeared); if
the PC painted them bigger (--hd-model in trader-forge-art-gen.py) the bigger picture is used as it is.
A file that's already there is skipped, so a run that stops part-way can just be started again.
"""
from __future__ import annotations

import importlib.util
import zlib
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'games' / 'trader' / 'forge' / 'art' / 'paint'
INBOX = Path(os.environ.get('TRADER_FORGE_INBOX', Path.home() / 'dragon-art-inbox' / 'trader-forge-art'))
PICKS_FILE = ROOT / 'docs' / 'trader-forge-art' / 'picks.json'  # optional: {"planets-desert-2": {"even": true}}

# The same names the painter uses: one place for them (scripts/trader-forge-art-gen.py).
_spec = importlib.util.spec_from_file_location('trader_forge_art_gen', Path(__file__).with_name('trader-forge-art-gen.py'))
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)
PICTURES = gen.PICTURES
GROUPS = tuple(gen.GROUPS)

# Sizes (width, height). Change a number here and run with --force to make them again at another size.
SIZE = {
    'planets': ((1024, 512), (4096, 2048)),
    'clouds': ((1024, 512), (4096, 2048)),
    'suns': ((1024, 512), (2048, 1024)),
    'night': ((1024, 512), (4096, 2048)),
    'skies': ((2048, 1024), (8192, 4096)),
    'moons': ((1024, 512), (2048, 1024)),
}
RING_SIZE = (2048, 64)
POSTCARD_W = 1600
BUTTON = 512
CUT_LONG = 512
TEXTURE = 1024
QUALITY = {'planets': 80, 'clouds': 78, 'suns': 80, 'night': 78, 'skies': 80, 'moons': 80, 'rings': 85, 'postcards': 74, 'buttons': 78, 'tech': 82}
HD_QUALITY = 70
NORMAL_QUALITY = 88
# How strong the bumps are on a normal map. Gas and ice giants have no ground, so they get almost none.
NORMAL_STRENGTH = {'gas': 0.25, 'icegiant': 0.2}
NORMAL_DEFAULT = 2.0
GRAIN = 2.2  # film grain added to an upscaled copy (levels out of 255)

# Technology pictures by how they are tidied.
TECH_CUT = {n for n in gen.TECH_CUT}
TECH_GLOW = {'gate-swirl', 'engine-flame', 'lane-glow'}
TECH_TILE = set(gen.TECH_TEX) - TECH_GLOW


def picks() -> dict:
    import json
    return json.loads(PICKS_FILE.read_text()) if PICKS_FILE.exists() else {}


def save(img: Image.Image, out: Path, quality: int, method: int = 6):
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'WEBP', quality=quality, method=method)
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
    """The object on its white background, cut out with rembg and trimmed to the object."""
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session('isnet-general-use')
    img = trim(remove(Image.open(src).convert('RGB'), session=_session, alpha_matting=True))
    if img is None:
        raise SystemExit(f'{src.name}: nothing left after cutting out')
    return img


def even_out(a: np.ndarray) -> np.ndarray:
    """Takes out light that changes from left to right (a lamp on one side, a darker edge), so a turning planet shows no
    bright or dark stripe. Only the big slow change goes; craters and patches stay. (From scripts/trader-art.py.)"""
    lum = a.mean(axis=2)
    cols = lum[lum.shape[0] // 6: -lum.shape[0] // 6].mean(axis=0)
    w = a.shape[1]
    sigma = w / 10
    x = np.arange(-3 * sigma, 3 * sigma + 1)
    kernel = np.exp(-x ** 2 / (2 * sigma ** 2))
    wide = np.convolve(np.tile(cols, 3), kernel / kernel.sum(), mode='same')[w:2 * w]
    return np.clip(a * (wide.mean() / np.maximum(wide, 1))[None, :, None], 0, 255)


def wrap_seam(a: np.ndarray, blend_frac=0.08, axis=1) -> np.ndarray:
    """Cross-fades the far end into the near end so the picture's two edges meet with no join, then drops the faded strip.
    axis 1: left and right (a planet map). axis 0: top and bottom (a repeating texture)."""
    if axis == 0:
        return wrap_seam(a.transpose(1, 0, 2), blend_frac, 1).transpose(1, 0, 2)
    w = a.shape[1]
    k = int(w * blend_frac)
    t = np.linspace(0, 1, k)[None, :, None]
    out = a[:, :w - k].copy()
    out[:, :k] = a[:, w - k:] * (1 - t) + a[:, :k] * t
    return out


def to_img(a: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8))


def resize_to(img: Image.Image, size: tuple[int, int], sharpen=False) -> Image.Image:
    """Down to a size with Lanczos; up to a size with Lanczos and a little unsharp so it doesn't look soft."""
    if img.size == size:
        return img
    out = img.resize(size, Image.LANCZOS)
    if size[0] > img.width:
        out = out.filter(ImageFilter.UnsharpMask(radius=2, percent=55, threshold=2)) if sharpen else out
    return out


def grain(img: Image.Image, amount: float = GRAIN, seed: int = 1) -> Image.Image:
    """Fine film grain in bands, so a big upscaled picture looks painted rather than smeared (and the memory stays small)."""
    rng = np.random.default_rng(seed)
    a = np.asarray(img.convert('RGB'))
    out = np.empty_like(a)
    for y in range(0, a.shape[0], 256):
        band = a[y:y + 256].astype(np.float32)
        band += rng.normal(0, amount, band.shape[:2] + (1,)).astype(np.float32)
        out[y:y + 256] = np.clip(band, 0, 255).round().astype(np.uint8)
    return Image.fromarray(out)


def big_copy(img: Image.Image, size: tuple[int, int], seed: int) -> Image.Image:
    """The -hd copy: use the painted picture as it is when it is already big enough, otherwise a careful upscale plus grain."""
    if img.width >= size[0]:
        return resize_to(img, size)
    return grain(resize_to(img, size, sharpen=True), seed=seed)


# ---- Height and normal maps ----

def height_map(name: str, rgb: np.ndarray) -> np.ndarray:
    """A 0..1 height map the same shape as the wrapped picture: the PC's Depth Anything picture if there is one (mixed with a
    little of the picture's own detail), otherwise the picture's light and dark, softened, so bright ridges stand up."""
    h, w = rgb.shape[:2]
    lum = Image.fromarray(rgb.mean(axis=2).round().astype(np.uint8), 'L')
    fine = np.asarray(lum.filter(ImageFilter.GaussianBlur(max(1, w / 1200))), dtype=np.float32) / 255
    coarse = np.asarray(lum.filter(ImageFilter.GaussianBlur(w / 160)), dtype=np.float32) / 255
    own = 0.65 * fine + 0.35 * coarse
    depth_file = INBOX / 'heights' / f'{name}.png'
    if depth_file.exists():
        depth = Image.open(depth_file).convert('L')
        d = np.asarray(wrap_seam_img(depth).resize((w, h), Image.LANCZOS), dtype=np.float32) / 255
        return np.clip(0.6 * d + 0.4 * own, 0, 1)
    return own


def wrap_seam_img(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    return to_img(wrap_seam(a)).convert('L')


def normal_map(height: np.ndarray, strength: float) -> Image.Image:
    """Tangent-space normal map from a height map (0..1). The left and right edges wrap, so a turning planet has no line."""
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    scale = strength * height.shape[1] / 256  # the same bumpiness at every size
    nx, ny, nz = -dx * scale, dy * scale, np.ones_like(height)
    n = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    return to_img(np.dstack([nx / n, ny / n, nz / n]) * 127.5 + 127.5)


# ---- Making one picture ----

def sources(groups: set[str]):
    """(key, source file) for every picture the game uses that has been painted."""
    for key, pic in PICTURES.items():
        if pic.group in groups:
            f = INBOX / pic.group / f'{pic.name}.png'
            if f.exists():
                yield key, f


def derived_sources(groups: set[str]):
    """The surface-<kind>-<n> and sky-<n> buttons, cut from the planet and sky maps (key 'derived/<button name>')."""
    if 'buttons' not in groups:
        return
    for pic in PICTURES.values():
        if pic.group == 'planets':
            f = INBOX / 'planets' / f'{pic.name}.png'
            if f.exists():
                yield f'derived/surface-{pic.name}', f
        elif pic.group == 'skies':
            f = INBOX / 'skies' / f'{pic.name}.png'
            if f.exists():
                yield f'derived/sky-{pic.name}', f


def outputs(key: str) -> list[Path]:
    if key.startswith('derived/'):
        return [ART / 'buttons' / f'{key[len("derived/"):]}.webp']
    pic = PICTURES[key]
    g, n = pic.group, pic.name
    base = ART / g
    if g == 'planets':
        return [base / f'{n}.webp', base / f'{n}-hd.webp', base / f'{n}-normal.webp', base / f'{n}-normal-hd.webp']
    if g in SIZE:
        return [base / f'{n}.webp', base / f'{n}-hd.webp']
    return [base / f'{n}.webp']


def load_map(src: Path, name: str, fix: bool) -> Image.Image:
    a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
    if fix and picks().get(f'{PICTURES[name].group}-{PICTURES[name].name}', {}).get('even'):
        a = even_out(a)
    return to_img(wrap_seam(a))


def make_derived(key: str, src: Path):
    """A square from the middle of a wide map (the lit middle for an eyeball world), as a button picture."""
    img = Image.open(src).convert('RGB')
    side = img.height
    x = (img.width - side) // 2
    save(img.crop((x, 0, x + side, side)).resize((BUTTON, BUTTON), Image.LANCZOS), outputs(key)[0], QUALITY['buttons'])


def make(job):
    key, src = job
    if key.startswith('derived/'):
        return make_derived(key, src)
    pic = PICTURES[key]
    g, n = pic.group, pic.name
    q = QUALITY[g]
    if g in SIZE:
        small, big = SIZE[g]
        img = load_map(src, key, fix=(g == 'planets'))
        if g == 'clouds':  # white on black: make the black exactly black so the gaps are clear
            a = np.asarray(img.convert('L'), dtype=np.float32)
            a = np.clip((a - 14) / (255 - 14), 0, 1) * 255
            img = Image.fromarray(a.round().astype(np.uint8)).convert('RGB')
        if g == 'night':  # lights on black
            a = np.asarray(img, dtype=np.float32)
            img = to_img(np.clip((a - 10) / (255 - 10), 0, 1) * 255)
        save(resize_to(img, small), ART / g / f'{n}.webp', q)
        hd = big_copy(img, big, seed=zlib.crc32(key.encode()) % 1000)
        save(hd, ART / g / f'{n}-hd.webp', HD_QUALITY, method=4)
        if g == 'planets':
            rgb = np.asarray(img, dtype=np.float32)
            h = height_map(n, rgb)
            strength = NORMAL_STRENGTH.get(n.rsplit('-', 1)[0], NORMAL_DEFAULT)
            for size, suffix in ((small, '-normal'), (big, '-normal-hd')):
                hs = np.asarray(Image.fromarray((h * 255).round().astype(np.uint8), 'L').resize(size, Image.LANCZOS), dtype=np.float32) / 255
                save(normal_map(hs, strength), ART / g / f'{n}{suffix}.webp', NORMAL_QUALITY, method=4)
    elif g == 'rings':
        # The painting is stripes running top to bottom: average down each column to one line from the inside edge to the outside.
        a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
        line = a.mean(axis=0)  # width x 3
        line = np.asarray(Image.fromarray(line[None].round().astype(np.uint8)).resize((RING_SIZE[0], 1), Image.LANCZOS), dtype=np.float32)[0]
        lum = line.max(axis=1)
        alpha = np.clip((lum - 12) / 60, 0, 1)  # black gaps see-through
        rgb = np.clip(line / np.maximum(alpha, 0.2)[:, None], 0, 255)  # colour at full strength where the ring is thin
        strip = np.dstack([np.repeat(rgb[None], RING_SIZE[1], axis=0), np.repeat((alpha * 255)[None], RING_SIZE[1], axis=0)[..., None]])
        save(Image.fromarray(strip.round().astype(np.uint8), 'RGBA'), ART / g / f'{n}.webp', q)
    elif g == 'postcards':
        save(fit_long(Image.open(src).convert('RGB'), POSTCARD_W), ART / g / f'{n}.webp', q)
    elif g == 'buttons':
        img = Image.open(src).convert('RGB')
        side = min(img.size)  # a square already, but make sure
        img = img.crop(((img.width - side) // 2, (img.height - side) // 2, (img.width + side) // 2, (img.height + side) // 2))
        save(img.resize((BUTTON, BUTTON), Image.LANCZOS), ART / g / f'{n}.webp', q)
    elif g == 'tech':
        if n in TECH_CUT:
            save(fit_long(cut_out(src), CUT_LONG), ART / g / f'{n}.webp', q)
        elif n in TECH_GLOW:
            a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
            alpha = np.clip((a.max(axis=2) - 10) / 90, 0, 1)
            rgba = np.dstack([a, alpha * 255]).round().astype(np.uint8)
            img = Image.fromarray(rgba, 'RGBA')
            bbox = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
            img = img.crop(bbox) if bbox else img
            save(fit_long(img, TEXTURE), ART / g / f'{n}.webp', q)
        else:
            a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
            a = wrap_seam(wrap_seam(a, 0.08, 1), 0.08, 0)
            save(to_img(a).resize((TEXTURE, TEXTURE), Image.LANCZOS), ART / g / f'{n}.webp', q)


# ---- Contact sheets, to check by eye ----

def sheets(out_dir: Path, groups: set[str]):
    """One picture per group of pictures, small, with names. Wide maps are shown twice side by side (the join is in the
    middle) so a seam can be seen; cut-outs on a dark and a light square."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for g in GROUPS:
        if g not in groups:
            continue
        items = list(sources({g}))
        if not items:
            continue
        wide = g in SIZE
        cell_w, cell_h, cols = (360, 90, 3) if wide else (256, 144 if g == 'postcards' else 256, 5 if g != 'rings' else 1)
        if g == 'rings':
            cell_w, cell_h = 900, 110
        rows = (len(items) + cols - 1) // cols
        for part in range(0, rows, 14):  # a sheet is at most 14 rows
            chunk = items[part * cols:(part + 14) * cols]
            sheet = Image.new('RGB', (cols * cell_w, ((len(chunk) + cols - 1) // cols) * (cell_h + 16)), (36, 36, 40))
            draw = ImageDraw.Draw(sheet)
            for i, (key, src) in enumerate(chunk):
                x, y = (i % cols) * cell_w, (i // cols) * (cell_h + 16)
                img = Image.open(src).convert('RGB')
                if wide:
                    half = to_img(wrap_seam(np.asarray(img, dtype=np.float32))).resize((cell_w // 2, cell_h), Image.LANCZOS)
                    sheet.paste(half, (x, y + 16))
                    sheet.paste(half, (x + cell_w // 2, y + 16))
                else:
                    img.thumbnail((cell_w - 4, cell_h))
                    sheet.paste(img, (x + 2, y + 16))
                draw.text((x + 4, y + 2), key, fill=(230, 230, 230))
            name = out_dir / (f'{g}.jpg' if rows <= 14 else f'{g}-{part // 14 + 1}.jpg')
            sheet.save(name, quality=82)
            print(name)


def missing(groups: set[str]):
    gone = [k for k, p in PICTURES.items() if p.group in groups and not (INBOX / p.group / f'{p.name}.png').exists()]
    print(f'{len(gone)} of {sum(1 for p in PICTURES.values() if p.group in groups)} pictures are not in the inbox yet.')
    for k in gone:
        print('  ', k)


if __name__ == '__main__':
    args = sys.argv[1:]
    groups = {a for a in args if not a.startswith('--') and not a.startswith('/')} or set(GROUPS)
    if '--sheets' in args:
        i = args.index('--sheets')
        d = Path(args[i + 1]) if len(args) > i + 1 and not args[i + 1].startswith('--') else ROOT / 'dist-trader-forge-sheets'
        groups = {a for a in args if a in GROUPS} or set(GROUPS)
        sheets(d, groups)
        sys.exit()
    unknown = groups - set(GROUPS)
    if unknown:
        sys.exit(f'Unknown groups: {", ".join(sorted(unknown))}. Use: {", ".join(GROUPS)}')
    if '--missing' in args:
        missing(groups)
        sys.exit()
    force = '--force' in args
    todo = [j for j in list(sources(groups)) + list(derived_sources(groups)) if force or not all(p.exists() for p in outputs(j[0]))]
    print(f'{len(todo)} pictures to make', flush=True)
    workers = int(os.environ.get('TRADER_ART_WORKERS', '2'))
    with ProcessPoolExecutor(workers) as pool:
        for _ in pool.map(make, todo):
            pass
    total = sum(f.stat().st_size for f in ART.rglob('*.webp')) // 2**20 if ART.exists() else 0
    big = sum(f.stat().st_size for f in ART.rglob('*-hd.webp')) // 2**20 if ART.exists() else 0
    print(f'done. {total} MB of paintings in {ART.relative_to(ROOT)} ({big} MB of that is the -hd copies).', flush=True)
