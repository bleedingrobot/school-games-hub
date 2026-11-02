#!/usr/bin/env python3
"""
Walking characters and map props for Maths Monsters, painted on the gaming PC's ComfyUI (z-image-turbo). Runs on this computer only.
  python scripts/monsters-walkers-art.py looks [names]    the 24 pupil looks -> art/painted/walkers/<name>-{down,up,left,right}.webp
  python scripts/monsters-walkers-art.py people [names]   every portrait in art/painted/people -> walkers/
  python scripts/monsters-walkers-art.py props            chest, chest-open, gate -> art/painted/props/
  python scripts/monsters-walkers-art.py sheets           contact sheets in docs/monsters-art-test/
Each character is painted once as a turnaround sheet (front, side walking right, back in one picture), so all
its views are the same person; the sheet is cut in three and left is right mirrored. Who they are and what they
wear comes from scripts/monsters-walkers.json (name -> [who, what]), written from the portraits.
Skips characters whose four files exist (delete them to redo). Change a bad one with SEEDS below (name -> seed).
Use ~/.cache/rembg-venv/bin/python (Pillow, numpy, scipy, rembg).
"""
import importlib.util, json, sys
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
STYLE = 'bright flat storybook illustration'  # the props
SEED = 11
SEEDS = {'nurse-joy': 12, 'surfer-tui': 12}  # first tries came out see-through
TURN = ('a character turnaround sheet for a cosy top-down RPG game: the same {who} drawn three times side by side in one row, '
        'on the left a front view facing the viewer, in the middle a side view in profile walking towards the right, on the right a back view facing away from the viewer. '
        '{what}. Each figure full body from head to shoes, cute small proportions with a slightly large head, the same clothes and colours in all three, '
        'hand-painted, soft painterly brush strokes, bright cheerful colours, polished modern cosy RPG game art, evenly spaced, plain flat pure white background')
LOOKS = json.loads((ROOT / 'scripts/monsters-walkers.json').read_text()) if (ROOT / 'scripts/monsters-walkers.json').exists() else {}
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

def walker(name):
    files = {d: WALK / f'{name}-{d}.webp' for d in ('down', 'right', 'up', 'left')}
    if all(p.exists() for p in files.values()):
        return
    if name not in LOOKS:
        print('  no description for', name); return
    RAW.mkdir(parents=True, exist_ok=True)
    who, what = LOOKS[name]
    raw = RAW / f'{name}-turn.png'
    latent = {'7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': 1536, 'height': 640, 'batch_size': 1}}}
    wa.run(wa.base(TURN.format(who=who, what=what), SEEDS.get(name, SEED), 1.0, latent), raw)
    sheet = Image.open(raw).convert('RGB')
    third = sheet.width // 3
    for k, d in enumerate(('down', 'right', 'up')):
        part = RAW / f'{name}-{d}.png'
        sheet.crop((k * third, 0, (k + 1) * third, sheet.height)).save(part)
        img = fit_walker(cutout(part))
        save_webp(img, files[d], 40000)
        if d == 'right':
            save_webp(img.transpose(Image.FLIP_LEFT_RIGHT), files['left'], 40000)
    print('made', name, flush=True)

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
            walker(n)
    elif cmd == 'people':
        for n in rest or people_names():
            walker(n)
    elif cmd == 'props':
        props()
    elif cmd == 'sheets':
        sheets()
