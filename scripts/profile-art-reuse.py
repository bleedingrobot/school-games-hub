#!/usr/bin/env python3
"""
Two earned profile pictures reuse paintings the hub already has (docs/PROFILE-ART-PLAN.md, section 3): the painted cut-out
is placed, with a soft shadow, in the middle of a painted glow backdrop. Run after `game_art.py profile tidy`:

  ~/.cache/rembg-venv/bin/python scripts/profile-art-reuse.py
"""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/avatar/art/pictures'
# picture, the painted cut-out, the backdrop, how much of the square the cut-out's longer side takes
PLACED = [
    ('heart-diamond', 'src/games/diamond/art/paint/book/heartDiamond.webp', 'backdrop-pink', 0.66),
    ('rainbow-toon', 'src/games/toonflap/art/flyers/rainbow-up.webp', 'backdrop-gold', 0.74),
]

for name, cut_path, backdrop, share in PLACED:
    back = Image.open(OUT / f'{backdrop}.webp').convert('RGBA')
    cut = Image.open(ROOT / cut_path).convert('RGBA')
    cut = cut.crop(cut.getbbox())
    scale = back.width * share / max(cut.size)
    cut = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)
    spot = ((back.width - cut.width) // 2, (back.height - cut.height) // 2)
    shadow = Image.new('RGBA', back.size, (0, 0, 0, 0))
    shadow.paste((10, 6, 40, 150), (spot[0], spot[1] + back.height // 40), cut.getchannel('A'))
    back.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(back.width // 50)))
    back.alpha_composite(cut, spot)
    for size, suffix in ((512, ''), (160, '-small')):
        img = back.convert('RGB')
        img.thumbnail((size, size), Image.LANCZOS)
        img.save(OUT / f'{name}{suffix}.webp', 'WEBP', quality=86, method=6)
        print(f'  {name}{suffix}.webp  {img.width}x{img.height}')
