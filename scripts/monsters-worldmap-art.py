#!/usr/bin/env python3
"""
Storybook world map for the Maths Monsters Menu. Runs on this computer only; paints on the gaming PC's ComfyUI.
  python scripts/monsters-worldmap-art.py guide            colour layout guide -> raw folder
  python scripts/monsters-worldmap-art.py gen              paint candidates (img2img of the guide)
  python scripts/monsters-worldmap-art.py pick N           candidate N -> src/games/monsters/world/assets/world-map.webp
  python scripts/monsters-worldmap-art.py sheet            contact sheet -> docs/monsters-art-test/world-map-candidates.png
Raw files go to $WORLDMAP_RAW. Use ~/.cache/rembg-venv/bin/python.
"""
import importlib.util, os, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get('WORLDMAP_RAW', ROOT / '.worldmap-raw'))
OUTF = ROOT / 'src/games/monsters/world/assets/world-map.webp'
SHEET = ROOT / 'docs/monsters-art-test/world-map-candidates.png'
W, H, MAXKB = 1280, 800, 220
spec = importlib.util.spec_from_file_location('wa', ROOT / 'scripts/monsters-world-art.py')
wa = importlib.util.module_from_spec(spec); spec.loader.exec_module(wa)

STYLE = 'hand-painted, soft painterly brush strokes, bright cheerful colours, polished cosy RPG game art, friendly for children'
PROMPT = ('A storybook overview world map of a fantasy island in a blue sea, New Zealand flavour, seen from high above at a slight tilt, ' + STYLE + '. '
  'Small cosy seaside town with red roofs in the centre of the island. Green native forest with big kauri trees and ferns on the west. '
  'Sandy beach with rock pools on the south coast. Friendly smoking volcano with orange lava streams in the east. '
  'Snowy white mountains in the north. Dark hills with a cave mouth and blue glowing specks in the far west. '
  'Bigger harbour city with a wharf, ships and stone buildings in the southeast. Misty hidden valley with steaming hot springs in the far east. '
  'Small separate tropical island with a turquoise lagoon in the far south-west. Icy hollow in the far north with green aurora lights in the sky. '
  'Brown dirt paths joining the town to the other places. Blue sea around, no words, no letters, no text, no labels, no border, no frame.')

def P(x, y): return (x / 100 * W, y / 100 * H)

def guide():
    RAW.mkdir(parents=True, exist_ok=True)
    land = Image.new('L', (W, H), 0); d = ImageDraw.Draw(land)
    def el(cx, cy, rx, ry, c=255):
        x, y = P(cx, cy); rx, ry = rx / 100 * W, ry / 100 * H
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=c)
    for a in [(50, 56, 33, 26), (27, 62, 17, 17), (22, 38, 13, 16), (46, 28, 17, 16), (64, 14, 13, 10), (78, 40, 15, 20),
              (88, 24, 9, 15), (74, 76, 17, 14), (44, 82, 15, 10), (60, 38, 18, 15)]: el(*a)
    el(12, 88, 7, 8)
    land = land.filter(ImageFilter.GaussianBlur(10)).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(3))
    im = Image.new('RGB', (W, H), (40, 120, 190)); im.paste((120, 190, 90), mask=land)
    d = ImageDraw.Draw(im)
    def blob(cx, cy, rx, ry, col):
        x, y = P(cx, cy); rx, ry = rx / 100 * W, ry / 100 * H
        layer = Image.new('L', (W, H), 0); ImageDraw.Draw(layer).ellipse([x - rx, y - ry, x + rx, y + ry], fill=255)
        layer = layer.filter(ImageFilter.GaussianBlur(14)); im.paste(col, mask=layer)
    blob(27, 68, 10, 11, (30, 100, 45))      # kauri
    blob(42, 86, 9, 4, (235, 215, 150))      # beach
    blob(44, 24, 11, 9, (235, 240, 245))     # snow
    blob(40, 20, 6, 6, (150, 155, 165))
    blob(76, 46, 8, 10, (140, 70, 40))       # volcano
    blob(76, 43, 3, 3, (255, 130, 30))
    blob(18, 38, 8, 9, (60, 60, 75))         # cave hills
    blob(18, 40, 2, 2.5, (20, 20, 30))
    blob(74, 80, 9, 9, (150, 150, 155))      # city
    blob(79, 87, 5, 3, (40, 100, 170))      # harbour water
    blob(88, 22, 6, 9, (170, 200, 180))      # steam valley
    blob(64, 8, 8, 6, (190, 225, 240))       # ice hollow
    blob(64, 3, 9, 3, (80, 220, 140))        # aurora glow
    blob(12, 88, 5, 5, (80, 205, 200))       # lagoon
    blob(50, 60, 5, 6, (190, 70, 60))        # town
    x0, y0 = P(50, 60)
    for t in [(27, 68), (42, 86), (76, 46), (44, 24), (18, 38), (74, 80)]:
        d.line([(x0, y0), P(*t)], fill=(170, 125, 80), width=9)
    im = im.filter(ImageFilter.GaussianBlur(2))
    im.save(RAW / 'guide.png'); print(RAW / 'guide.png')

CANDS = [(1, 0.70, 7101), (2, 0.78, 7102), (3, 0.65, 7103), (4, 0.74, 7104)]
def gen():
    nm = wa.upload(RAW / 'guide.png')
    for n, den, seed in CANDS:
        dst = RAW / f'cand-{n}.png'
        if dst.exists(): continue
        latent = {'l': {'class_type': 'LoadImage', 'inputs': {'image': nm}},
                  's': {'class_type': 'ImageScale', 'inputs': {'image': ['l', 0], 'upscale_method': 'lanczos', 'width': W, 'height': H, 'crop': 'disabled'}},
                  '7': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['s', 0], 'vae': ['3', 0]}}}
        wa.run(wa.base(PROMPT, seed, den, latent), dst); print(dst, den, flush=True)

def pick(n):
    im = Image.open(RAW / f'cand-{n}.png').convert('RGB').resize((W, H), Image.LANCZOS)
    OUTF.parent.mkdir(parents=True, exist_ok=True)
    for q in (88, 82, 76, 70, 64, 58, 50, 42):
        im.save(OUTF, 'WEBP', quality=q, method=6)
        if OUTF.stat().st_size <= MAXKB * 1000: break
    print(OUTF, OUTF.stat().st_size, q)

def sheet():
    cw, ch = 640, 400
    out = Image.new('RGB', (cw * 2 + 30, ch * 2 + 30), (128, 128, 128))
    for i, (n, *_ ) in enumerate(CANDS):
        out.paste(Image.open(RAW / f'cand-{n}.png').convert('RGB').resize((cw, ch)), (10 + (i % 2) * (cw + 10), 10 + (i // 2) * (ch + 10)))
    SHEET.parent.mkdir(parents=True, exist_ok=True); out.save(SHEET); print(SHEET)

if __name__ == '__main__':
    c = sys.argv[1]
    {'guide': guide, 'gen': gen, 'sheet': sheet}.get(c, lambda: pick(sys.argv[2]))()
