#!/usr/bin/env python3
"""
Round 2 painted-map test (docs/monsters-art-test/round2/). Runs on this computer only; paints on the gaming PC's ComfyUI.
  python scripts/monsters-world-parts.py legend      material legend + ASCII map from the Tiled file
  python scripts/monsters-world-parts.py gen [name]  paint textures + sprites (skips ones already made; delete a file to redo it)
  python scripts/monsters-world-parts.py compose     ground, full map, above layer, grid check
  python scripts/monsters-world-parts.py unify [d]   low-denoise img2img pass over the composed map
  python scripts/monsters-world-parts.py compare
Use ~/.cache/rembg-venv/bin/python (Pillow, numpy, scipy, rembg).
"""
import importlib.util, json, sys, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, zoom

ROOT = Path(__file__).resolve().parent.parent
R2 = ROOT / 'docs/monsters-art-test/round2'
OLD = ROOT / 'docs/monsters-art-test'
S = 64
spec = importlib.util.spec_from_file_location('wa', ROOT / 'scripts/monsters-world-art.py')
wa = importlib.util.module_from_spec(spec); spec.loader.exec_module(wa)

# ---------- 1. classify ----------
M = json.load(open(ROOT / 'shared/monsters/maps/kauri-bush.json'))
W, H = M['width'], M['height']
L = {l['name']: l['data'] for l in M['layers'] if 'data' in l}
def classify():
    """One material per square. Returns dict name->list of (x, y)."""
    out = {k: [] for k in ['path', 'water', 'long', 'tree', 'tall', 'bush', 'sign', 'flower', 'house_grey', 'house_red']}
    for i in range(W * H):
        x, y = i % W, i // W
        g, w, gr = L['ground'][i], L['walls'][i], L['grass'][i]
        if g >= 13: out['path'].append((x, y))
        if g == 3: out['flower'].append((x, y))
        if gr == 267: out['long'].append((x, y))
        if w == 265: out['water'].append((x, y))
        elif w == 29: out['tree'].append((x, y))
        elif w == 5: out['tall'].append((x, y))
        elif w == 6: out['bush'].append((x, y))
        elif w == 84: out['sign'].append((x, y))
        elif w in (49,50,51,61,62,63,77,78,80,89,90): out['house_grey'].append((x, y))
        elif w in (53,54,55,65,66,67,73,74,76,85): out['house_red'].append((x, y))
    return out
def legend():
    c = classify()
    sym = {'path': '=', 'water': '~', 'long': '"', 'tree': 'T', 'tall': '!', 'bush': 'o', 'sign': 'S', 'flower': '*', 'house_grey': 'G', 'house_red': 'R'}
    grid = [['.'] * W for _ in range(H)]
    for k in ['long', 'path', 'flower', 'water', 'tree', 'bush', 'sign', 'house_grey', 'house_red', 'tall']:
        for x, y in c[k]: grid[y][x] = sym[k]
    for x, y in c['tall']:
        pass
    print('legend: . meadow  = path  " long grass  ~ water  T border/small tree  ! tall tree base(+top tile above)  o bush  S sign  * flowers  G grey-roof house  R red-roof house')
    print('walls gid 5 = tall tree top (blocked), 17 = its base. Props sit on top of grass/long grass.')
    for k, v in c.items(): print(f'{k:11s} {len(v)}')
    print('\n'.join(''.join(r) for r in grid))

# ---------- 2. paint parts ----------
STYLE = 'hand-painted, soft painterly brush strokes, bright cheerful colours, polished modern cosy top-down RPG game art, friendly for children'
TEX = {
 'tex-grass': f'seamless tileable top-down texture of a lush bright green meadow lawn, short soft grass blades with subtle light and dark patches, {STYLE}, flat even lighting, no objects, no flowers, no shadows',
 'tex-path': f'seamless tileable top-down texture of a warm tan sandy dirt path, small pebbles and gentle scuffs, {STYLE}, flat even lighting, no objects, no grass',
 'tex-water': f'seamless tileable top-down texture of clear bright blue pond water, soft ripples and light sparkles, {STYLE}, flat even lighting, no objects',
 'tex-long': f'seamless tileable top-down texture of dense tall wild grass, deep dark green, thick tufts of long blades in several shades of dark green, darker and richer than a lawn, {STYLE}, flat even lighting, no objects, no flowers',
}
SPR = {}
TREE = 'one single New Zealand native bush tree, {kind}, seen from a high three-quarter top-down view, whole tree with a short trunk visible at the bottom, hand-painted polished cosy RPG game sprite, bright friendly colours, soft shading, isolated on a plain flat pure white background, no ground, no shadow, no text'
for n, kind in [('tree-a', 'a rounded kauri tree with a dense leafy dome canopy of layered green foliage'),
                ('tree-b', 'a tall slim kauri tree with a tufted conical canopy of layered green foliage'),
                ('tree-c', 'a ponga silver tree fern with a crown of long arching feathery fronds')]:
    SPR[n] = (TREE.format(kind=kind), 768, 1024)
for n, kind in [('bush-a', 'a round leafy green bush with a few tiny pink flowers'), ('bush-b', 'a small round dark green native shrub, fluffy foliage')]:
    SPR[n] = (f'one single {kind}, seen from a high three-quarter top-down view, hand-painted polished cosy RPG game sprite, soft shading, isolated on a plain flat pure white background, no ground, no shadow, no text', 768, 768)
SPR['house-grey'] = (f'a cosy stone cottage with a grey slate roof, seen from a high three-quarter top-down view, symmetrical, wide roof with overhang, stone walls, four small wooden windows and a wooden front door at the bottom centre, {STYLE}, isolated on a plain flat pure white background, no ground, no shadow, no text, no people', 1024, 1024)
SPR['house-red'] = (f'a cosy small cottage with a red tiled roof, seen from a high three-quarter top-down view, symmetrical, wooden plank walls, three small windows along the front, no door, {STYLE}, isolated on a plain flat pure white background, no ground, no shadow, no text, no people', 768, 1024)
for n in 'ab':
    SPR[f'sign-{n}'] = (f'one single small wooden signpost with a blank wooden board on a post, no writing, seen from a high three-quarter top-down view, {STYLE}, isolated on a plain flat pure white background, no shadow, no text', 768, 768)
for n, c in [('a', 'yellow and white daisies'), ('b', 'pink and purple wildflowers')]:
    SPR[f'flowers-{n}'] = (f'a small cluster of {c} with green leaves, seen from above, {STYLE}, isolated on a plain flat pure white background, no shadow, no text', 768, 768)

def txt2img(text, w, h, seed, dest):
    latent = {'7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}}}
    wa.run(wa.base(text, seed, 1.0, latent), dest)

def tileable(im):
    """Offset by half, then cross-fade the original back in along the seam cross (and the shifted copy near the edges)."""
    a = np.asarray(im.convert('RGB'), np.float32)
    h, w = a.shape[:2]
    r = np.roll(a, (h // 2, w // 2), (0, 1))
    def smooth(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
    xs, ys = np.arange(w), np.arange(h)
    bx = smooth(1 - np.abs(xs - w / 2) / 190)[None, :]   # 1 on the vertical seam of r
    by = smooth(1 - np.abs(ys - h / 2) / 190)[:, None]
    ex = smooth(np.minimum(xs, w - 1 - xs) / 230)[None, :]  # 0 on the left/right edge of a (a's own seam)
    ey = smooth(np.minimum(ys, h - 1 - ys) / 230)[:, None]
    k = np.maximum(bx * ey, by * ex)[..., None]
    out = a * k + r * (1 - k)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

def cutout(src, dest):
    from rembg import new_session, remove
    cut = remove(Image.open(src).convert('RGB'), session=new_session('isnet-general-use'), alpha_matting=True)
    cut = cut.crop(cut.getbbox())
    cut.save(dest)

def gen(only=None):
    R2.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    for i, (n, t) in enumerate(TEX.items()):
        d = R2 / f'{n}.png'
        if (only and only != n) or d.exists(): continue
        raw = R2 / f'_raw-{n}.png'
        txt2img(t, 1024, 1024, 100 + i, raw)
        tileable(Image.open(raw)).save(d); print(d, round(time.time() - t0))
    for i, (n, (t, w, h)) in enumerate(SPR.items()):
        d = R2 / f'{n}.png'
        if (only and only != n) or d.exists(): continue
        raw = R2 / f'_raw-{n}.png'
        txt2img(t, w, h, 200 + i * 7, raw)
        cutout(raw, d); print(d, round(time.time() - t0))

if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'legend': legend()
    elif c == 'gen': gen(*(sys.argv[2:3]))
    else:
        import monsters_world_compose  # noqa
