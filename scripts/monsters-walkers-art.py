#!/usr/bin/env python3
"""
Walking characters and map props for Maths Monsters, painted on the gaming PC's ComfyUI (z-image-turbo). Runs on this computer only.
  python scripts/monsters-walkers-art.py looks [names]    the 24 pupil looks -> art/painted/walkers/<name>-{down,up,left,right}.webp
  python scripts/monsters-walkers-art.py people [names]   every portrait in art/painted/people -> walkers/
  python scripts/monsters-walkers-art.py props            chest, chest-open, gate -> art/painted/props/
  python scripts/monsters-walkers-art.py sheets           contact sheets in docs/monsters-art-test/
Skips files that exist (delete one to redo it). Paints down, up and right; left is right mirrored.
Change a bad one with SEEDS below (name/dir -> seed), delete its file and rerun.
Use ~/.cache/rembg-venv/bin/python (Pillow, numpy, scipy, rembg).
"""
import importlib.util, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('wa', ROOT / 'scripts/monsters-world-art.py')
wa = importlib.util.module_from_spec(spec); spec.loader.exec_module(wa)

PAINTED = ROOT / 'src/games/monsters/art/painted'
WALK, PROPS = PAINTED / 'walkers', PAINTED / 'props'
OUT = ROOT / 'docs/monsters-art-test'
RAW = Path.home() / '.cache/monsters-walkers'
SEED = 777
DENOISE = {'down': 0.7, 'up': 0.8, 'right': 0.8}
SEEDS = {}  # 'boy-03/right': 781 ...
DIRS = {'down': 'facing toward the viewer, we see the face', 'up': 'seen from directly behind, back view, facing away from the viewer, the back of the head and the backpack, no face visible',
        'right': 'side view in profile, walking to the right, the whole body turned to face the right edge of the picture, one leg forward, face in profile'}
STYLE = 'bright flat storybook illustration'
_sess = None

def cutout(raw):
    global _sess
    from rembg import new_session, remove
    _sess = _sess or new_session('isnet-general-use')
    cut = remove(Image.open(raw).convert('RGB'), session=_sess, alpha_matting=True)
    a = np.array(cut)
    lab, n = label(a[..., 3] > 20)
    if n > 1:  # drop floating specks and shadow blobs
        sizes = np.bincount(lab.ravel())[1:]
        for i, s in enumerate(sizes, 1):
            if s < sizes.max() * 0.04:
                a[lab == i, 3] = 0
    cut = Image.fromarray(a)
    return cut.crop(cut.getbbox())

def save_webp(im, path, limit):
    path.parent.mkdir(parents=True, exist_ok=True)
    for q in (92, 85, 78, 70, 60, 50):
        im.save(path, 'WEBP', quality=q, method=6)
        if path.stat().st_size < limit:
            return
    print('  WARNING over size', path.name, path.stat().st_size)

def fit_walker(cut):
    s = min(88 / cut.height, 92 / cut.width)
    cut = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    out.paste(cut, ((96 - cut.width) // 2, 92 - cut.height), cut)
    return out

def paint_ref(refpath, text, seed, raw, denoise):
    src = Image.open(refpath).convert('RGBA')
    src.thumbnail((460, 460))  # whole figure small on a white square, so the model paints head to feet with room around
    ref = Image.new('RGB', (640, 640), 'white')
    ref.paste(src, ((640 - src.width) // 2, (640 - src.height) // 2), src)
    tmp = RAW / '_ref.png'
    ref.save(tmp)
    nm = wa.upload(tmp)
    w, h = ref.size[0] // 16 * 16, ref.size[1] // 16 * 16
    latent = {'l': {'class_type': 'LoadImage', 'inputs': {'image': nm}},
              's': {'class_type': 'ImageScale', 'inputs': {'image': ['l', 0], 'upscale_method': 'lanczos', 'width': w, 'height': h, 'crop': 'disabled'}},
              '7': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['s', 0], 'vae': ['3', 0]}}}
    wa.run(wa.base(text, seed, denoise, latent), raw)

def colour_name(rgb):
    import colorsys
    h, s_, v = colorsys.rgb_to_hsv(*[c / 255 for c in rgb]); h *= 360
    if v < 0.22: return 'black'
    if s_ < 0.18: return 'white' if v > 0.8 else ('light grey' if v > 0.55 else 'dark grey')
    shade = 'dark ' if v < 0.45 else ('light ' if v > 0.85 and s_ < 0.5 else '')
    if h < 15 or h >= 345: n = 'red'
    elif h < 40: n = 'brown' if v < 0.65 else 'orange'
    elif h < 65: n = 'yellow' if v > 0.6 else 'olive'
    elif h < 165: n = 'green'
    elif h < 200: n = 'teal'
    elif h < 255: n = 'blue'
    elif h < 295: n = 'purple'
    else: n = 'pink'
    return shade + n

def describe(refpath):
    """Main colours of hair, top and legs from the reference, so the prompt keeps them."""
    a = np.array(Image.open(refpath).convert('RGBA')); ys = np.where(a[..., 3] > 200)[0]
    y0, y1 = ys.min(), ys.max(); hgt = y1 - y0
    def band(f0, f1):
        b = a[y0 + int(hgt * f0):y0 + int(hgt * f1)]
        px = b[b[..., 3] > 200][:, :3]
        return colour_name(tuple(int(c) for c in np.median(px, axis=0))) if len(px) else 'grey'
    return f"{band(0.02, 0.1)} hair, a {band(0.3, 0.5)} top, {band(0.62, 0.8)} trousers or skirt"

def walker(name, refpath, adult):
    refpath0 = refpath
    RAW.mkdir(parents=True, exist_ok=True)
    WALK.mkdir(parents=True, exist_ok=True)
    who = ('a grown-up person, an adult, with the same age, face, hair, skin and clothes as the reference' if adult else
           f"a cheerful 9 year old {'boy' if name.startswith('boy') else 'girl'}, a school pupil, in the same clothes, same hairstyle and hair colour, same brown or light skin colour as the reference")
    desc = 'Colours to keep: ' + describe(refpath0)
    for d, words in DIRS.items():
        dest = WALK / f'{name}-{d}.webp'
        if d == 'right':
            todo = [dest, WALK / f'{name}-left.webp']
        else:
            todo = [dest]
        if all(p.exists() for p in todo):
            continue
        text = (f"{desc}. Tiny full-body game character sprite of {who}, {words}, standing, whole body visible from the top of the head to the shoes with white space all around, small in the picture, "
                f"seen from a high top-down three-quarter overhead angle, {STYLE}, plain flat white background, no text, no shadow")
        raw = RAW / f'{name}-{d}.png'
        if d != 'down' and (RAW / f'{name}-down.png').exists():
            refpath = RAW / f'{name}-down.png'  # re-pose the painted front view: keeps the clothes the same
        paint_ref(refpath, text, SEEDS.get(f'{name}/{d}', SEED), raw, DENOISE[d])
        img = fit_walker(cutout(raw))
        save_webp(img, dest, 40000)
        if d == 'right':
            save_webp(img.transpose(Image.FLIP_LEFT_RIGHT), WALK / f'{name}-left.webp', 40000)
        print('made', dest.name, flush=True)

def look_names():
    return [f'{b}-{i:02d}' for b in ('boy', 'girl') for i in range(1, 13)]

def people_names():
    return sorted(p.stem for p in (PAINTED / 'people').glob('*.webp') if not p.stem.endswith('-small'))

def props():
    PROPS.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    common = (f"A single game map prop for a top-down overhead game map, {STYLE}, clean simple shapes, flat vivid colours, soft shading, "
              "seen from a high three-quarter top-down angle, centred, plain flat white background, no text, no shadow, no ground")
    def txt2img(text, seed, raw, w=768, h=768):
        latent = {'7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}}}
        wa.run(wa.base(text, seed, 1.0, latent), raw)
    def fit(cut):
        s = min(124 / cut.width, 124 / cut.height)
        cut = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
        out = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        out.paste(cut, ((128 - cut.width) // 2, (128 - cut.height) // 2), cut)
        return out
    cs = SEEDS.get('chest', 5)
    raw = RAW / 'chest.png'
    if not (PROPS / 'chest.webp').exists() or not (PROPS / 'chest-open.webp').exists():
        txt2img(f"{common}. A closed wooden treasure chest with a rounded lid, brown planks and gold metal bands and a golden lock.", cs, raw)
        if not (PROPS / 'chest.webp').exists():
            save_webp(fit(cutout(raw)), PROPS / 'chest.webp', 60000); print('made chest')
    if not (PROPS / 'chest-open.webp').exists():
        # img2img kept the lid shut, so this is a pair: same seed, same words, only the lid changes
        text = (f"{common}. An open wooden treasure chest with the lid swung wide open and tilted back behind it, brown planks and gold metal bands, "
                "the inside of the chest is empty, bare wooden inside, no gold, no treasure.")
        raw2 = RAW / 'chest-open.png'
        txt2img(text, SEEDS.get('chest-open', cs), raw2)
        save_webp(fit(cutout(raw2)), PROPS / 'chest-open.webp', 60000); print('made chest-open')
    if not (PROPS / 'gate.webp').exists():
        raw3 = RAW / 'gate.png'
        txt2img(f"{common}. A short wooden post-and-rope fence section seen from the front, two stout wooden posts joined by a thick rope sagging between them, "
                "wide and low, blocking a path.", SEEDS.get('gate', 7), raw3, 768, 512)
        save_webp(fit(cutout(raw3)), PROPS / 'gate.webp', 60000); print('made gate')

def sheet(title, names, per_row, dest):
    cell, lab = 96, 12
    rows = (len(names) + per_row - 1) // per_row
    im = Image.new('RGB', (per_row * 4 * cell, rows * (cell + lab)), (110, 170, 90))
    dr = ImageDraw.Draw(im)
    for i, n in enumerate(names):
        x0, y0 = (i % per_row) * 4 * cell, (i // per_row) * (cell + lab)
        dr.text((x0 + 2, y0), n, fill=(0, 0, 0))
        for k, d in enumerate(('down', 'up', 'left', 'right')):
            p = WALK / f'{n}-{d}.webp'
            if p.exists():
                t = Image.open(p).convert('RGBA')
                im.paste(t, (x0 + k * cell, y0 + lab), t)
    im.save(dest); print(dest, im.size)

def sheets():
    sheet('looks', look_names(), 4, OUT / 'walkers-looks.png')
    sheet('people', people_names(), 4, OUT / 'walkers-people.png')
    names = ['chest', 'chest-open', 'gate']
    im = Image.new('RGB', (3 * 144, 144), (110, 170, 90))
    for i, n in enumerate(names):
        p = PROPS / f'{n}.webp'
        if p.exists():
            t = Image.open(p).convert('RGBA')
            im.paste(t, (i * 144 + 8, 8), t)
    im.save(OUT / 'props.png'); print(OUT / 'props.png')

if __name__ == '__main__':
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == 'looks':
        for n in rest or look_names():
            walker(n, PAINTED / 'looks' / f'{n}.webp', False)
    elif cmd == 'people':
        for n in rest or people_names():
            walker(n, PAINTED / 'people' / f'{n}.webp', True)
    elif cmd == 'props':
        props()
    elif cmd == 'sheets':
        sheets()
