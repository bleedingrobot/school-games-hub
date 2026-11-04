#!/usr/bin/env python3
"""
Tidies the 40 Star Trader captains (painted by scripts/trader-captains-art-gen.py into ~/dragon-art-inbox/trader-captains)
into small square WebP portraits the game shows in a circle: src/games/trader/art/captains/<key>.webp, 256 x 256.
Runs on James's computer only, never in the site build. Needs Python with Pillow (the venv at ~/.cache/rembg-venv has it).

  ~/.cache/rembg-venv/bin/python scripts/trader-captains-art.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INBOX = Path.home() / 'dragon-art-inbox' / 'trader-captains'
OUT = ROOT / 'src' / 'games' / 'trader' / 'art' / 'captains'
SIZE = 256
KEYS = [f'{p}{i:02d}' for p in 'mf' for i in range(1, 21)]
# How much to trim from each edge first. m01 came out three times with a pale rounded frame round the picture; trimmed
# like this, the circle the game shows never reaches what is left of it.
TRIM = {'m01': 0.07}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key in KEYS:
        img = Image.open(INBOX / f'{key}.png').convert('RGB')
        cut = round(img.width * TRIM.get(key, 0.0))
        img = img.crop((cut, cut, img.width - cut, img.height - cut)).resize((SIZE, SIZE), Image.LANCZOS)
        path = OUT / f'{key}.webp'
        img.save(path, 'WEBP', quality=80, method=6)
        print(f'{path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
