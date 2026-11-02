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
 'tex-water': f'seamless tileable top-down painted texture of calm turquoise blue pond water, soft organic curved ripple lines and a few light sparkles, smooth continuous surface, {STYLE}, no tiles, no grid, no squares, no objects',
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
SPR['house-red'] = (f'a cosy small cottage with a red tiled roof, seen straight from the front from a slightly raised view like a storybook, symmetrical, flat front wall facing us, wooden plank walls, three small windows in a row along the front, no door, {STYLE}, isolated on a plain flat pure white background, no ground, no shadow, no text, no people', 768, 1024)
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


# ---------- 3. compose ----------
def smooth(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def noise(h, w, scale, seed):
    rng = np.random.default_rng(seed)
    n = rng.random((h // scale + 3, w // scale + 3))
    n = zoom(n, scale, order=3)[:h, :w]
    return (n - n.mean()) / (n.std() + 1e-6)
def fbm(h, w, seed):
    return 0.65 * noise(h, w, 56, seed) + 0.35 * noise(h, w, 26, seed + 1)
def tex(name, h, w, ox=0, oy=0, scale=0.62):
    t = Image.open(R2 / f'tex-{name}.png').convert('RGB')
    t = t.resize((int(t.width * scale), int(t.height * scale)), Image.LANCZOS)
    a = np.asarray(t, np.float32)
    ys = (np.arange(h) + oy) % a.shape[0]; xs = (np.arange(w) + ox) % a.shape[1]
    return a[ys][:, xs]
def square_mask(cells, grow=0.0, blur=11, wob=0.2, seed=1):
    """Soft, wobbly mask (0..1) at 64 px a square from a list of (x, y) squares."""
    m = np.zeros((H, W), np.float32)
    for x, y in cells: m[y, x] = 1
    m = np.pad(m, 2, mode='edge')[2:-2, 2:-2] if False else m
    big = np.kron(m, np.ones((S, S), np.float32))
    pad = 40
    big = np.pad(big, pad, mode='edge')
    f = gaussian_filter(big, blur)
    f = f + wob * fbm(*f.shape, seed) * 0.5 + grow
    return smooth((f - 0.5) / 0.12 + 0.5)[pad:-pad, pad:-pad]
def blend(base, layer, m, shade=None):
    return base * (1 - m[..., None]) + layer * m[..., None]

def rim(m, width=14):
    """0 in the middle of a mask, 1 at its edge (for darker rims)."""
    d = __import__('scipy.ndimage', fromlist=['x']).distance_transform_edt(m > 0.5)
    return 1 - smooth(d / width)

def ground(c):
    h, w = H * S, W * S
    img = tex('grass', h, w, 100, 50)
    img = img * (0.97 + 0.06 * noise(h, w, 80, 5)[..., None] * 0.5)  # gentle large-scale colour drift
    longm = square_mask(c['long'], blur=14, wob=0.5, seed=11)
    pathm = square_mask(c['path'], blur=14, wob=0.38, seed=21)
    wx, wy = [v for v in zip(*c['water'])]
    water_cells = c['water']
    waterm = square_mask(water_cells, grow=0.06, blur=15, wob=0.45, seed=31)
    # long grass: darker tufts, dark edge so it reads clearly
    lg = tex('long', h, w, 300, 200, 0.33)
    lg = lg * 0.9
    rl = rim(longm, 9)[..., None]
    img = blend(img, lg * (1 - 0.18 * rl), longm)
    # soft shadow of the grass edge onto the meadow
    sh = gaussian_filter(longm, 7)
    img = img * (1 - 0.12 * (sh * (1 - longm))[..., None])
    # path
    pt = tex('path', h, w, 40, 70, 0.7)
    pt = pt * (1 + 0.05 * noise(h, w, 30, 9)[..., None])
    rp = rim(pathm, 13)[..., None]
    pt = pt * (1 - 0.20 * rp) + np.array([255, 235, 190], np.float32) * 0.0
    ps = gaussian_filter(pathm, 6)
    img = img * (1 - 0.18 * (ps * (1 - pathm))[..., None])
    img = blend(img, pt, pathm)
    # pond: shore ring of earth, deeper blue towards the middle
    sh2 = gaussian_filter(waterm, 9)
    shore = np.clip(sh2 * 1.0 - waterm * 0.9, 0, 1) ** 1.0
    img = img * (1 - 0.35 * shore[..., None]) + np.array([120, 90, 50], np.float32) * 0.35 * shore[..., None] * 0.6
    wt = tex('water', h, w, 20, 20, 0.5)
    rw = rim(waterm, 22)[..., None]
    wt = wt * (1 - 0.30 * rw) + np.array([20, 70, 140], np.float32) * 0.0
    foam = (np.clip(rim(waterm, 4) - rim(waterm, 2) * 0, 0, 1) * 0.5)[..., None]
    wt = wt * (1 - foam * 0.6) + 255 * foam * 0.6
    img = blend(img, wt, waterm)
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))

def load_sprite(name):
    return Image.open(R2 / f'{name}.png').convert('RGBA')
def fit(im, w=None, h=None):
    if h: w = round(im.width * h / im.height)
    else: h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)
def shadow_for(w, h, cx, base, rx, ry, strength=0.34):
    """Soft elliptical shadow as an alpha layer on a w x h canvas."""
    a = Image.new('L', (w, h), 0)
    ImageDraw.Draw(a).ellipse((cx - rx, base - ry, cx + rx, base + ry), fill=int(255 * strength))
    return a.filter(ImageFilter.GaussianBlur(ry * 0.5))
def with_alpha_cut(sprite, cut_y):
    """(whole sprite, upper part only) where cut_y is in sprite pixels from its top; the upper part fades over 10 px."""
    a = np.asarray(sprite.getchannel('A'), np.float32)
    fade = smooth(1 - (np.arange(sprite.height) - cut_y) / 10)[:, None]
    up = sprite.copy(); up.putalpha(Image.fromarray((a * fade).astype(np.uint8)))
    return sprite, up

def compose(c, pupil=True):
    gimg = ground(c)
    gimg.save(R2 / 'kauri-bush-ground.png')
    h, w = H * S, W * S
    full = gimg.convert('RGBA')
    above = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    shadows = Image.new('L', (w, h), 0)
    items = []  # (base_y, kind, sprite, x_left, y_top, cut_y or None)
    rng = np.random.default_rng(7)
    trees = ['tree-a', 'tree-b', 'tree-c']
    def tree_sprite(i, x, y):
        return trees[(x * 7 + y * 13 + i) % 3]
    for i, (x, y) in enumerate(c['tree']):
        n = tree_sprite(i, x, y)
        sp = fit(load_sprite(n), h=96 if y == 0 else (104 if y == 19 else 118))
        if (x + y) % 2: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        base = y * S + 62
        items.append((base, sp, x * S + 32 - sp.width // 2, base - sp.height, sp.height - 44, ('ell', x * S + 32, base, 32, 9)))
    for i, (x, y) in enumerate(c['tall']):
        n = ['tree-b', 'tree-a', 'tree-b', 'tree-c', 'tree-a'][i % 5]
        sp = fit(load_sprite(n), h=210)
        base = (y + 1) * S + 62
        items.append((base, sp, x * S + 32 - sp.width // 2, base - sp.height, sp.height - 48, ('ell', x * S + 32, base, 36, 10)))
    for i, (x, y) in enumerate(c['bush']):
        sp = fit(load_sprite('bush-a' if i % 2 else 'bush-b'), w=84)
        base = y * S + 60
        items.append((base, sp, x * S + 32 - sp.width // 2, base - sp.height, sp.height - 24, ('ell', x * S + 32, base - 4, 32, 9)))
    for i, (x, y) in enumerate(c['sign']):
        sp = fit(load_sprite('sign-a' if i % 2 else 'sign-b'), w=58)
        y_ = y
        base = y * S + 58
        items.append((base + 1000, sp, x * S + 32 - sp.width // 2, base - sp.height, None, ('ell', x * S + 32, base - 2, 20, 6)))
    for i, (x, y) in enumerate(c['flower']):
        sp = fit(load_sprite('flowers-a' if rng.random() < .5 else 'flowers-b'), w=int(rng.integers(34, 48)))
        if rng.random() < .5: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        ox, oy = int(rng.integers(-8, 8)), int(rng.integers(-6, 6))
        base = y * S + 46 + oy
        items.append((base - 1000, sp, x * S + 32 - sp.width // 2 + ox, y * S + 46 + oy - sp.height // 2, None, None))
    gx = [x for x, _ in c['house_grey']]; gy = [y for _, y in c['house_grey']]
    rx_ = [x for x, _ in c['house_red']]; ry_ = [y for _, y in c['house_red']]
    for name, xs, ys, over in [('house-grey', gx, gy, 22), ('house-red', rx_, ry_, 20)]:
        fw = (max(xs) - min(xs) + 1) * S + over
        sp = fit(load_sprite(name), w=fw) if name == 'house-grey' else fit(load_sprite(name), w=fw + 24)
        base = (max(ys) + 1) * S + 4
        items.append((base, sp, min(xs) * S - over // 2, base - sp.height, int(sp.height * 0.62), ('rect', min(xs) * S + 6, base, (max(xs) - min(xs) + 1) * S - 4, 16)))
    items.sort(key=lambda t: t[0])
    for base, sp, x0, y0, cut, shd in items:
        if shd:
            if shd[0] == 'ell':
                _, cx, by, rx, ry = shd
                shadows = Image.fromarray(np.maximum(np.asarray(shadows), np.asarray(shadow_for(w, h, cx, by, rx, ry))))
            else:
                _, sx, by, rw, ry = shd
                a = Image.new('L', (w, h), 0); ImageDraw.Draw(a).rectangle((sx + 10, by - 8, sx + rw + 14, by + ry), fill=90)
                shadows = Image.fromarray(np.maximum(np.asarray(shadows), np.asarray(a.filter(ImageFilter.GaussianBlur(9)))))
    sh_rgba = Image.new('RGBA', (w, h), (25, 40, 20, 0)); sh_rgba.putalpha(shadows)
    full = Image.alpha_composite(full, sh_rgba)
    for base, sp, x0, y0, cut, shd in items:
        full.alpha_composite(sp, (x0, y0)) if x0 >= 0 and y0 >= 0 and x0 + sp.width <= w and y0 + sp.height <= h else paste_clipped(full, sp, x0, y0)
        if cut:
            _, up = with_alpha_cut(sp, cut)
            paste_clipped(above, up, x0, y0)
    nop = full.convert('RGB')
    nop.save(R2 / 'kauri-bush-full-nopupil.png')
    above.save(R2 / 'kauri-bush-above.png')
    if pupil: nop = add_pupil(nop)
    nop.save(R2 / 'kauri-bush-full.png')
    grid_check(nop)
    return nop

def paste_clipped(dst, sp, x0, y0):
    layer = Image.new('RGBA', dst.size, (0, 0, 0, 0)); layer.paste(sp, (x0, y0))
    if dst.mode == 'RGBA' and dst.getchannel('A').getextrema()[0] == 0:  # transparent canvas: keep existing pixels
        dst.alpha_composite(layer)
    else:
        dst.alpha_composite(layer)

def add_pupil(img, tile=(18, 9)):
    p = Image.open(OLD / 'pupil-a-down.png').convert('RGBA'); p = p.crop(p.getbbox()); p = fit(p, h=64)
    out = img.convert('RGBA'); x, y = tile
    base = y * S + 60
    a = shadow_for(out.width, out.height, x * S + 32, base - 2, 16, 5, 0.4)
    sh = Image.new('RGBA', out.size, (25, 40, 20, 0)); sh.putalpha(a)
    out = Image.alpha_composite(out, sh)
    out.alpha_composite(p, (x * S + 32 - p.width // 2, base - p.height))
    return out.convert('RGB')

def grid_check(img):
    out = img.convert('RGBA')
    ov = Image.new('RGBA', out.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for i in range(W * H):
        x, y = i % W, i // W
        box = (x * S, y * S, x * S + S - 1, y * S + S - 1)
        if L['walls'][i]: d.rectangle(box, fill=(255, 0, 0, 55))
        elif L['grass'][i]: d.rectangle(box, fill=(255, 220, 0, 45))
        elif L['ground'][i] >= 13: d.rectangle(box, fill=(0, 120, 255, 40))
    for x in range(W + 1): d.line((x * S, 0, x * S, H * S), fill=(255, 255, 255, 110))
    for y in range(H + 1): d.line((0, y * S, W * S, y * S), fill=(255, 255, 255, 110))
    Image.alpha_composite(out, ov).convert('RGB').save(R2 / 'grid-check.png')

def unify(denoise=0.3):
    nop = Image.open(R2 / 'kauri-bush-full-nopupil.png').convert('RGB')
    src = R2 / '_unify-in.png'; nop.save(src)
    w, h = nop.size; pw, ph = w // 16 * 16, h // 16 * 16
    nm = wa.upload(src)
    latent = {'l': {'class_type': 'LoadImage', 'inputs': {'image': nm}},
              's': {'class_type': 'ImageScale', 'inputs': {'image': ['l', 0], 'upscale_method': 'lanczos', 'width': pw, 'height': ph, 'crop': 'disabled'}},
              '7': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['s', 0], 'vae': ['3', 0]}}}
    text = ('Top-down overhead game map, polished hand-painted cosy RPG illustration, rich painterly brushwork, lush green meadow, dark green long grass patches, '
            'tan dirt paths, blue pond, native New Zealand bush trees, grey slate-roof stone cottage and red-roof cottage, wooden signs, bright friendly colours, no text, no characters')
    dest = R2 / 'kauri-bush-full-unified-nopupil.png'
    wa.run(wa.base(text, 4242, denoise, latent), dest)
    im = Image.open(dest).convert('RGB')
    if im.size != (w, h): im = im.resize((w, h), Image.LANCZOS)
    im.save(dest)
    add_pupil(im).save(R2 / 'kauri-bush-full-unified.png'); print('unified', denoise)

def compare():
    a = Image.open(OLD / 'kauri-bush-b-d50.png').convert('RGB')
    f = R2 / 'kauri-bush-full-unified.png'
    b = Image.open(f if f.exists() else R2 / 'kauri-bush-full.png').convert('RGB')
    w = 780; h = round(a.height * w / a.width)
    out = Image.new('RGB', (w * 2 + 8, h), 'white')
    out.paste(a.resize((w, h), Image.LANCZOS), (0, 0)); out.paste(b.resize((w, h), Image.LANCZOS), (w + 8, 0))
    out.save(R2 / 'compare.jpg', quality=88)

if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'legend': legend()
    elif c == 'gen': gen(*(sys.argv[2:3]))
    elif c == 'compose': compose(classify())
    elif c == 'unify': unify(float(sys.argv[2]) if len(sys.argv) > 2 else 0.3)
    elif c == 'compare': compare()
