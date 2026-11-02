#!/usr/bin/env python3
"""
Paints every outdoor Maths Monsters map in the round 2 style James chose (docs/MONSTERS-QUESTS-PLAN.md, Q.6).
Runs on this computer; the painting happens in ComfyUI on James's gaming PC.

  python scripts/monsters-map-paint.py parts [name]   paint the textures and sprites the maps need (skips ones already made)
  python scripts/monsters-map-paint.py map <id>|all   build a painted map from its paint plan
  python scripts/monsters-map-paint.py sheet          a contact sheet of every part

Each map's plan (scripts/monster-maps/paint-plans/<id>.json, written by `node scripts/make-monster-maps.mjs`) says
which squares are path and long grass and what stands where. A map becomes two pictures in
src/games/monsters/art/painted/maps/: <id>.webp (the ground with everything that never changes) and <id>-above.webp
(tree tops and roofs, drawn over the walkers). Every square stays exactly where the game expects it: 64 px a square.
Use ~/.cache/rembg-venv/bin/python (Pillow, numpy, scipy, rembg).
"""
import importlib.util, json, sys, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter, zoom

ROOT = Path(__file__).resolve().parent.parent
PARTS = ROOT / 'docs/monsters-art/map-parts'
PLANS = ROOT / 'scripts/monster-maps/paint-plans'
OUT = ROOT / 'src/games/monsters/art/painted/maps'
S = 64
OUTDOOR = ['harbour-town', 'kauri-bush', 'shell-beach', 'fire-mountain', 'snowy-peaks', 'glowworm-caves', 'harbour-city', 'steam-valley', 'lagoon-isle', 'aurora-hollow']

spec = importlib.util.spec_from_file_location('wa', ROOT / 'scripts/monsters-world-art.py')
wa = importlib.util.module_from_spec(spec); spec.loader.exec_module(wa)

# ---------- the parts ----------
STYLE = 'hand-painted, soft painterly brush strokes, bright cheerful colours, polished modern cosy top-down RPG game art, friendly for children'
# Positive words only: this model paints whatever a prompt names, even after "no" ("no grid" gave grids).
FLAT = 'flat even soft lighting, one even natural surface spreading all over, organic and irregular'
def texture(words, style=STYLE): return f'seamless tileable top-down texture of {words}, {style}, {FLAT}'
# The game-art words drew coins and smiley faces on bare stone, so plain rock and dark water use these instead.
NATURAL = 'painterly digital painting of real natural stone, soft brush strokes, muted natural colours'
# Textures repainted with a new seed after the first tries came out wrong.
RESEED = {'cavefloor': 900, 'rockwall': 900, 'cavewater': 900}
TEX = {
    # green bush and town
    'grass': texture('a lush bright green meadow lawn, short soft grass blades with subtle light and dark patches, no flowers'),
    'path': texture('a firm packed light-brown earth footpath with small scattered pebbles and crisp little stones, clear detail, dry and sunny, no grass'),
    'long': texture('dense tall wild grass, deep dark green, thick tufts of long blades in several shades of dark green, darker and richer than a lawn, no flowers'),
    'water': texture('calm turquoise blue pond water, soft organic curved ripple lines and a few light sparkles, smooth continuous surface, no tiles, no grid'),
    # beach
    'sand': texture('soft pale golden beach sand with gentle wind ripples and a few tiny shells'),
    'sandpath': texture('firm damp darker tan sand, smooth and packed, a walking track along a beach'),
    'dune': texture('tall green and golden dune grass, spiky marram grass tufts growing thickly in sand'),
    'sea': texture('clear shallow tropical sea water, bright turquoise and blue, soft wave ripples and sparkles, no tiles, no grid'),
    # snow
    'snow': texture('fresh clean white snow with soft pale blue shading and gentle drifts'),
    'snowpath': texture('a trodden snowy footpath, packed snow with footprints and a little grey grit, crisp detail'),
    'tussock': texture('thick frosty alpine tussock grass, pale green and silver blades dusted with snow'),
    'ice': texture('smooth glassy pale blue frozen lake ice with long thin white cracks and soft frosty swirls, organic and irregular'),
    # volcanic ash
    'ash': texture('dark grey volcanic ash ground, soft powdery ash scattered with small black pumice pebbles and thin glowing orange cracks'),
    'ashpath': texture('a winding reddish brown volcanic gravel track of small crunchy scoria pebbles, loose and irregular'),
    'scorched': texture('dry scorched orange and brown tussock grass, thick tufts, hot and dusty'),
    'lava': texture('flowing molten orange and yellow lava with swirling dark red crust and bright glowing rivers, liquid and irregular'),
    'hotwater': texture('steaming milky turquoise hot spring water with soft bubbles, no tiles, no grid'),
    # cave
    'cavefloor': texture('smooth dark slate grey cave ground, soft uneven damp stone with gentle blue-grey shading and fine sandy grit, all one grey stone', NATURAL),
    'cavepath': texture('a worn sandy-grey stone path through a cave, flat stepping slabs, crisp detail'),
    'moss': texture('thick soft cave moss in teal and green with tiny glowing blue dots, like glowworms'),
    'rockwall': texture('rough jagged dark grey cliff rock seen from above, layered slate ridges and deep shadowed crevices, all one grey stone', NATURAL),
    'cavewater': texture('dark still underground pool water, deep navy blue with soft pale blue ripple reflections, all one smooth liquid surface', NATURAL),
    # city
    'cobble': texture('a neat grey cobblestone street, rounded stones in tidy rows, crisp detail'),
}
SOLO = 'seen from a high three-quarter top-down view, hand-painted polished cosy RPG game sprite, bright friendly colours, soft shading, isolated on a plain flat pure white background, no ground, no shadow, no text, no people'
def tree(kind): return (f'one single {kind}, whole tree with a short trunk visible at the bottom, {SOLO}', 768, 1024)
def solo(thing, w=768, h=768): return (f'one single {thing}, {SOLO}', w, h)
SPR = {
    'tree-a': tree('New Zealand kauri tree with a rounded dense leafy dome canopy of layered green foliage'),
    'tree-b': tree('tall slim New Zealand kauri tree with a tufted conical canopy of layered green foliage'),
    'tree-d': tree('New Zealand pohutukawa tree with a wide rounded canopy of dark green leaves dotted with bright red flowers'),
    'tree-e': tree('New Zealand rimu tree with soft drooping weeping branches of fine green foliage'),
    'tree-f': tree('small round New Zealand karaka tree with glossy bright green leaves'),
    'bush-a': solo('round leafy green bush with a few tiny pink flowers'),
    'bush-b': solo('small round dark green native shrub, fluffy foliage'),
    'flax': solo('clump of New Zealand flax, harakeke, with long sword-shaped green leaves fanning out'),
    'nikau': tree('New Zealand nikau palm with a smooth ringed trunk and a neat crown of long green fronds'),
    'pine-snow': tree('snowy pine tree, dark green branches heavy with white snow'),
    'tall-snow': tree('tall snowy fir tree, a narrow cone of dark green branches covered in snow and icicles'),
    'bush-snow': solo('small round bush covered in white snow'),
    'rock-snow': solo('grey boulder with a cap of white snow'),
    'boulder-dark': solo('dark volcanic boulder, black and charcoal grey rough rock with a faint orange glow in its cracks'),
    'tree-autumn': tree('tree with bright orange and red autumn leaves'),
    'stalagmite': solo('tall pointy cave stalagmite of grey and blue stone', 768, 1024),
    'crystal': solo('cluster of glowing blue and purple cave crystals'),
    'house-red': solo('cosy small cottage with a red tiled roof, wooden plank walls, two small windows and a clear wooden front door in the middle of the front wall, the front wall facing us, symmetrical', 1024, 1024),
    'house-blue': solo('cosy small stone cottage with a blue-grey slate roof, stone walls, two small windows and a clear wooden front door in the middle of the front wall, the front wall facing us, symmetrical', 1024, 1024),
    'tower': solo('tall square stone tower with a pointed blue roof, a big arched wooden door at the bottom centre, small windows and a little flag on top, the front facing us, symmetrical', 1024, 1280),
    'sign-a': solo('small wooden signpost with a blank wooden board on a post, no writing'),
    'sign-b': solo('small wooden sign on two posts with a blank board, no writing'),
    'board': solo('wooden notice board on two posts with a little roof and a few blank paper notes pinned on it, no writing'),
    'fence': solo('short straight wooden fence, three posts with two rails, running left to right', 1024, 512),
    'flowers-a': solo('small cluster of yellow and white daisies with green leaves'),
    'flowers-b': solo('small cluster of pink and purple wildflowers with green leaves'),
    'nest-warm': solo('round bird nest of sticks and warm sand with steam rising, empty'),
    'nest-water': solo('round nest of soft green seaweed and shells, empty'),
    'nest-cold': solo('round nest scraped into snow, lined with white feathers, empty'),
    'monster-box': solo('small friendly storage machine like a big blue metal chest with a round glowing window and a handle'),
    'monster-book': solo('wooden reading stand holding a big open red book'),
}

def txt2img(text, w, h, seed, dest):
    latent = {'7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}}}
    wa.run(wa.base(text, seed, 1.0, latent), dest)

def tileable(im):
    """Offset by half, then cross-fade the original back in along the seams."""
    a = np.asarray(im.convert('RGB'), np.float32)
    h, w = a.shape[:2]
    r = np.roll(a, (h // 2, w // 2), (0, 1))
    xs, ys = np.arange(w), np.arange(h)
    bx = smooth(1 - np.abs(xs - w / 2) / 190)[None, :]
    by = smooth(1 - np.abs(ys - h / 2) / 190)[:, None]
    ex = smooth(np.minimum(xs, w - 1 - xs) / 230)[None, :]
    ey = smooth(np.minimum(ys, h - 1 - ys) / 230)[:, None]
    k = np.maximum(bx * ey, by * ex)[..., None]
    return Image.fromarray((a * k + r * (1 - k)).clip(0, 255).astype(np.uint8))

_session = None
def cutout(src, dest):
    global _session
    from rembg import new_session, remove
    _session = _session or new_session('isnet-general-use')
    cut = remove(Image.open(src).convert('RGB'), session=_session, alpha_matting=True)
    cut.crop(cut.getbbox()).save(dest)

def parts(only=None):
    PARTS.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    for i, (n, text) in enumerate(TEX.items()):
        d = PARTS / f'tex-{n}.png'
        if (only and only != n) or d.exists(): continue
        raw = PARTS / f'_raw-tex-{n}.png'
        txt2img(text, 1024, 1024, 100 + i + RESEED.get(n, 0), raw)
        tileable(Image.open(raw)).save(d); print(d.name, round(time.time() - t0), flush=True)
    for i, (n, (text, w, h)) in enumerate(SPR.items()):
        d = PARTS / f'{n}.png'
        if (only and only != n) or d.exists(): continue
        raw = PARTS / f'_raw-{n}.png'
        txt2img(text, w, h, 200 + i * 7, raw)
        cutout(raw, d); print(d.name, round(time.time() - t0), flush=True)

# ---------- the biomes: which part paints what ----------
BIOMES = {
    'green': {'ground': 'grass', 'path': 'path', 'long': 'long', 'water': 'water', 'trees': ['tree-a', 'tree-b', 'tree-d', 'tree-e', 'tree-f'], 'bush': ['bush-a', 'bush-b'], 'flowers': True},
    'city': {'ground': 'grass', 'path': 'cobble', 'long': 'long', 'water': 'sea', 'trees': ['tree-a', 'tree-d', 'tree-f'], 'bush': ['bush-a', 'bush-b'], 'flowers': True},
    'beach': {'ground': 'sand', 'path': 'sandpath', 'long': 'dune', 'water': 'sea', 'trees': ['nikau'], 'bush': ['flax', 'bush-b']},
    'snow': {'ground': 'snow', 'path': 'snowpath', 'long': 'tussock', 'water': 'ice', 'trees': ['pine-snow'], 'bush': ['bush-snow']},
    'ash': {'ground': 'ash', 'path': 'ashpath', 'long': 'scorched', 'water': 'hotwater', 'trees': ['tree-autumn'], 'bush': ['boulder-dark']},
    'cave': {'ground': 'cavefloor', 'path': 'cavepath', 'long': 'moss', 'water': 'cavewater', 'trees': ['stalagmite'], 'bush': ['crystal']},
}
# What each marked thing is drawn with: (parts to pick from, height in squares or None for a width, tiles tall it covers).
ONE = {'tree': None, 'bush': None, 'snowPine': ['pine-snow'], 'snowBush': ['bush-snow'], 'boulder': ['rock-snow'], 'boulderDark': ['boulder-dark'],
       'stalagmite': ['stalagmite'], 'crystal': ['crystal'], 'autumnSmall': ['tree-autumn'], 'sign': ['sign-a', 'sign-b'], 'board': ['board'],
       'box': ['monster-box'], 'book': ['monster-book'], 'nest-warm': ['nest-warm'], 'nest-water': ['nest-water'], 'nest-cold': ['nest-cold']}
TALL = {'bigTree': None, 'snowTree': ['tall-snow'], 'palm': ['nikau'], 'autumnTree': ['tree-autumn']}

# ---------- building a map ----------
def smooth(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def noise(h, w, scale, seed):
    n = np.random.default_rng(seed).random((h // scale + 3, w // scale + 3))
    n = zoom(n, scale, order=3)[:h, :w]
    return (n - n.mean()) / (n.std() + 1e-6)
def fbm(h, w, seed): return 0.65 * noise(h, w, 56, seed) + 0.35 * noise(h, w, 26, seed + 1)
_tex = {}
def tex(name, h, w, ox=0, oy=0, scale=0.62):
    key = (name, scale)
    if key not in _tex:
        t = Image.open(PARTS / f'tex-{name}.png').convert('RGB')
        _tex[key] = np.asarray(t.resize((int(t.width * scale), int(t.height * scale)), Image.LANCZOS), np.float32)
    a = _tex[key]
    return a[(np.arange(h) + oy) % a.shape[0]][:, (np.arange(w) + ox) % a.shape[1]]
def mask(cells, W, H, grow=0.0, blur=11, wob=0.2, seed=1):
    """A soft, slightly wobbly 0..1 mask at 64 px a square from a set of (x, y) squares."""
    m = np.zeros((H, W), np.float32)
    for x, y in cells: m[y, x] = 1
    big = np.pad(np.kron(m, np.ones((S, S), np.float32)), 40, mode='edge')
    f = gaussian_filter(big, blur) + wob * fbm(*big.shape, seed) * 0.5 + grow
    return smooth((f - 0.5) / 0.12 + 0.5)[40:-40, 40:-40]
def rim(m, width): return 1 - smooth(distance_transform_edt(m > 0.5) / width)
def blend(base, layer, m): return base * (1 - m[..., None]) + layer * m[..., None]
def rects(things, kind):
    return {(t['x'] + i, t['y'] + j) for t in things if t['kind'] == kind for j in range(t.get('h', 1)) for i in range(t.get('w', 1))}

def ground(plan, b):
    W, H = plan['width'], plan['height']
    h, w = H * S, W * S
    cells = lambda idx: {(i % W, i // W) for i in idx}
    img = tex(b['ground'], h, w, 100, 50)
    img = img * (0.97 + 0.03 * noise(h, w, 80, 5)[..., None])
    def area(cells_, name, seed, *, grow=0.06, blur=15, wob=0.45, rim_w=22, rim_k=0.30, shore=(120, 90, 50), foam=True, scale=0.5):
        nonlocal img
        if not cells_: return
        m = mask(cells_, W, H, grow=grow, blur=blur, wob=wob, seed=seed)
        s2 = gaussian_filter(m, 9)
        edge = np.clip(s2 - m * 0.9, 0, 1)
        img = img * (1 - 0.35 * edge[..., None]) + np.array(shore, np.float32) * 0.21 * edge[..., None]
        t = tex(name, h, w, 20, 20, scale) * (1 - rim_k * rim(m, rim_w)[..., None])
        if foam:
            f = (rim(m, 4) * 0.5)[..., None]
            t = t * (1 - f * 0.6) + 255 * f * 0.6
        img = blend(img, t, m)
    # long grass: darker tufts with a dark edge, so it reads clearly
    longm = mask(cells(plan['grass']), W, H, blur=14, wob=0.5, seed=11)
    img = blend(img, tex(b['long'], h, w, 300, 200, 0.33) * 0.9 * (1 - 0.18 * rim(longm, 9)[..., None]), longm)
    img = img * (1 - 0.12 * (gaussian_filter(longm, 7) * (1 - longm))[..., None])
    # paths: crisper than round 2 (less blur and wobble, a firmer edge)
    pathm = mask(cells(plan['paths']), W, H, blur=9, wob=0.25, seed=21)
    pt = tex(b['path'], h, w, 40, 70, 0.55) * (1 + 0.04 * noise(h, w, 30, 9)[..., None]) * (1 - 0.16 * rim(pathm, 10)[..., None])
    img = img * (1 - 0.18 * (gaussian_filter(pathm, 5) * (1 - pathm))[..., None])
    img = blend(img, pt, pathm)
    # ice is a floor you walk on; water, lava and rock walls are areas you can't
    area(rects(plan['things'], 'ice'), 'ice', 41, grow=0.0, blur=10, wob=0.2, rim_w=10, rim_k=0.15, shore=(200, 220, 240), foam=False)
    area(rects(plan['things'], 'water'), b['water'], 31)
    area(rects(plan['things'], 'lava'), 'lava', 51, rim_k=0.4, shore=(40, 20, 10), foam=False)
    area(rects(plan['things'], 'rock'), 'rockwall', 61, grow=0.08, blur=8, wob=0.3, rim_w=14, rim_k=-0.25, shore=(10, 15, 25), foam=False, scale=0.6)
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))

_spr = {}
def sprite(name):
    if name not in _spr: _spr[name] = Image.open(PARTS / f'{name}.png').convert('RGBA')
    return _spr[name]
def fit(im, w=None, h=None):
    if h: w = round(im.width * h / im.height)
    else: h = round(im.height * w / im.width)
    return im.resize((max(1, w), max(1, h)), Image.LANCZOS)
def shadow(w, h, cx, base, rx, ry, k=0.34):
    a = Image.new('L', (w, h), 0)
    ImageDraw.Draw(a).ellipse((cx - rx, base - ry, cx + rx, base + ry), fill=int(255 * k))
    return a.filter(ImageFilter.GaussianBlur(ry * 0.5))
def upper(sp, cut):
    """The part of a sprite above `cut` (px from its top), fading over 10 px: what stands in front of a walker."""
    a = np.asarray(sp.getchannel('A'), np.float32) * smooth(1 - (np.arange(sp.height) - cut) / 10)[:, None]
    up = sp.copy(); up.putalpha(Image.fromarray(a.astype(np.uint8))); return up

def paint_map(map_id):
    plan = json.load(open(PLANS / f'{map_id}.json'))
    b = BIOMES['city' if map_id == 'harbour-city' else plan['biome']]
    W, H = plan['width'], plan['height']
    h, w = H * S, W * S
    full = ground(plan, b).convert('RGBA')
    above = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    rng = np.random.default_rng(sum(map(ord, map_id)))
    items = []  # (base y, sprite, left, top, cut or None, shadow)
    pick = lambda names, i: names[(i * 7 + int(rng.integers(0, 97))) % len(names)]
    edge = lambda x, y: x in (0, W - 1) or y in (0, H - 1)
    for i, t in enumerate(plan['things']):
        k, x, y = t['kind'], t['x'], t['y']
        cx = x * S + 32
        if k in ONE or k.startswith('puzzle-'):
            names = ONE.get(k) or (b['trees'] if k == 'tree' else b['bush'] if k == 'bush' else ['sign-a', 'sign-b'])
            n = pick(names, i)
            treeish = k in ('tree', 'snowPine', 'autumnSmall', 'stalagmite')
            if treeish:
                ht = (88 if edge(x, y) else 112) + int(rng.integers(-10, 12))
                sp = fit(sprite(n), h=ht)
            elif k in ('sign', 'board') or k.startswith('puzzle-'): sp = fit(sprite(n), w=58 if k != 'board' else 70)
            else: sp = fit(sprite(n), w=int(76 + rng.integers(0, 14)))
            if rng.random() < 0.5 and k not in ('sign', 'board', 'box', 'book'): sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
            base = y * S + 60
            cut = sp.height - 40 if treeish else (sp.height - 24 if k in ('bush', 'snowBush') else None)
            items.append((base + (1000 if k in ('sign', 'board') else 0), sp, cx - sp.width // 2, base - sp.height, cut, (cx, base - 2, 30 if treeish else 24, 8)))
        elif k in TALL:
            names = TALL[k] or b['trees']
            sp = fit(sprite(pick(names, i)), h=200 + int(rng.integers(-12, 14)))
            if rng.random() < 0.5: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
            base = y * S + 62
            items.append((base, sp, cx - sp.width // 2, base - sp.height, sp.height - 48, (cx, base, 36, 10)))
        elif k in ('house', 'tower'):
            n = 'tower' if k == 'tower' else ('house-red' if t.get('roof') == 'red' else 'house-blue')
            tw, th = t['w'], t['h']
            sp = fit(sprite(n), w=tw * S + 20)
            base = (y + th) * S + 4
            items.append((base, sp, x * S - 10, base - sp.height, int(sp.height * 0.6), None))
        elif k == 'fence':
            for j in range(t['w']):
                sp = fit(sprite('fence'), w=S + 6)
                base = y * S + 52
                items.append((base, sp, (x + j) * S - 3, base - sp.height, None, None))
    # flowers on the green maps, where the tile map had them (ground tile 3)
    if b.get('flowers'):
        M = json.load(open(ROOT / f'shared/monsters/maps/{map_id}.json'))
        g = next(l['data'] for l in M['layers'] if l['name'] == 'ground')
        for i, v in enumerate(g):
            if v != 3: continue
            x, y = i % W, i // W
            sp = fit(sprite('flowers-a' if rng.random() < .5 else 'flowers-b'), w=int(rng.integers(34, 48)))
            ox, oy = int(rng.integers(-8, 8)), int(rng.integers(-6, 6))
            items.append((y * S - 1000, sp, x * S + 32 - sp.width // 2 + ox, y * S + 46 + oy - sp.height // 2, None, None))
    items.sort(key=lambda t: t[0])
    shadows = np.zeros((h, w), np.uint8)
    for *_, shd in items:
        if shd: shadows = np.maximum(shadows, np.asarray(shadow(w, h, *shd)))
    sh = Image.new('RGBA', (w, h), (25, 40, 20, 0)); sh.putalpha(Image.fromarray(shadows))
    full = Image.alpha_composite(full, sh)
    for _, sp, x0, y0, cut, _ in items:
        layer = Image.new('RGBA', (w, h), (0, 0, 0, 0)); layer.paste(sp, (x0, y0)); full.alpha_composite(layer)
        if cut:
            top = Image.new('RGBA', (w, h), (0, 0, 0, 0)); top.paste(upper(sp, cut), (x0, y0)); above.alpha_composite(top)
    OUT.mkdir(parents=True, exist_ok=True)
    full.convert('RGB').save(OUT / f'{map_id}.webp', quality=78, method=6)
    above.save(OUT / f'{map_id}-above.webp', quality=78, method=6)
    full.convert('RGB').save(PARTS / f'_map-{map_id}.png')
    print(map_id, (OUT / f'{map_id}.webp').stat().st_size // 1024, 'KB +', (OUT / f'{map_id}-above.webp').stat().st_size // 1024, 'KB', flush=True)

def sheet():
    names = [f'tex-{n}' for n in TEX] + list(SPR)
    have = [n for n in names if (PARTS / f'{n}.png').exists()]
    cols = 8; c = 200
    out = Image.new('RGB', (cols * c, ((len(have) + cols - 1) // cols) * (c + 20)), (120, 140, 120))
    d = ImageDraw.Draw(out)
    for i, n in enumerate(have):
        im = Image.open(PARTS / f'{n}.png').convert('RGBA'); im.thumbnail((c - 10, c - 10))
        x, y = (i % cols) * c, (i // cols) * (c + 20)
        out.paste(im, (x + 5, y + 5), im); d.text((x + 5, y + c), n, fill='white')
    out.save(ROOT / 'docs/monsters-art-test/map-parts-sheet.png'); print('sheet', len(have), 'of', len(names))

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'parts': parts(*(sys.argv[2:3]))
    elif cmd == 'map': [paint_map(m) for m in (OUTDOOR if sys.argv[2] == 'all' else sys.argv[2:])]
    elif cmd == 'sheet': sheet()
