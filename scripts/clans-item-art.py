#!/usr/bin/env python3
"""
Paints Clan Quest's class-line items (docs/CLANS-ITEMS-PLAN.md) in ComfyUI on James's gaming PC, and tidies the chosen
tries into the small cut-out WebP files the game uses (src/games/clans/art/items/). Runs on James's computer only, never
in the site build. `paint` needs only the standard library; `sheet` and `tidy` need Pillow, numpy and rembg
(~/.cache/rembg-venv, as for scripts/clans-art.py).

  python3 scripts/clans-item-art.py paint OUT_DIR [slugs] [--tries 2]       # OUT_DIR/<slug>-<try>.png
  ~/.cache/rembg-venv/bin/python scripts/clans-item-art.py sheet OUT_DIR    # OUT_DIR/sheets/*.jpg, every try labelled, to check by eye
  ~/.cache/rembg-venv/bin/python scripts/clans-item-art.py tidy OUT_DIR     # the picks in docs/clans-art/item-picks.json -> WebP

The words for each item are in docs/clans-art/item-descriptions.json. ComfyUI must be listening on Tailscale
(docs/CLANS-ART-PLAN.md, "If a picture needs remaking"). The graph is the one saved inside every Clans painting
(Z-Image Turbo, 8 steps, a 1.5x second pass); only the words and seeds change. Seeds are fixed, so a try can be painted
again exactly. Use only positive wording: this model draws whatever a prompt names, even after "no".
"""
from __future__ import annotations

import importlib.util
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESCRIPTIONS = json.loads((ROOT / 'docs' / 'clans-art' / 'item-descriptions.json').read_text())
PICKS = ROOT / 'docs' / 'clans-art' / 'item-picks.json'
ITEMS = ROOT / 'src' / 'games' / 'clans' / 'art' / 'items'

# Matches the first 34 item paintings: gritty and well used, muted earthy colours, worn metal and cloth.
STYLE = (
    'Gritty dark fantasy oil painting, painterly concept art with visible brushstrokes, moody low light, highly detailed. '
    'Weathered and well used, muted earthy colours, scratched worn metal, rust, frayed cloth and old leather. '
    'Suitable for children aged 8 to 12. A single fantasy game inventory item, the whole object in view. '
)
PLAIN = ' Centred, isolated on a plain flat dark grey background, empty space all around the edges.'


def load(name: str):
    """Another script in this folder, by file name (their names have dashes, so `import` can't reach them)."""
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), Path(__file__).with_name(f'{name}.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def paint(out: Path, slugs: list[str], tries: int):
    monster = load('clans-monster-art')  # its graph, ComfyUI calls and download are the same for every Clans painting
    out.mkdir(parents=True, exist_ok=True)
    for slug in slugs:
        for n in range(1, tries + 1):
            dest = out / f'{slug}-{n}.png'
            if dest.exists():
                continue
            seed = (sum(map(ord, slug)) * 7919 + n * 104729) % 2**32
            paint_one(monster, dest, STYLE + DESCRIPTIONS[slug] + PLAIN, seed)


def paint_one(monster, dest: Path, text: str, seed: int):
    job = monster.call('/prompt', {'prompt': monster.graph(text, seed, 1024, 1024)})['prompt_id']
    for _ in range(300):
        time.sleep(2)
        done = monster.call(f'/history/{job}').get(job)
        if done:
            break
    else:
        sys.exit(f'{dest.name}: ComfyUI took too long')
    img = next(i for o in done['outputs'].values() for i in o.get('images', []))
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
    with urllib.request.urlopen(f'{monster.COMFY}/view?{q}', timeout=60) as r:
        dest.write_bytes(r.read())
    print(f'  {dest.name}', flush=True)


def sheet(out: Path):
    from PIL import Image, ImageDraw
    tries = sorted(out.glob('*.png'))
    cell, cols, rows = 256, 6, 4
    (out / 'sheets').mkdir(exist_ok=True)
    for page in range(0, len(tries), cols * rows):
        chunk = tries[page:page + cols * rows]
        img = Image.new('RGB', (cols * cell, ((len(chunk) + cols - 1) // cols) * (cell + 20)), (40, 40, 44))
        draw = ImageDraw.Draw(img)
        for i, f in enumerate(chunk):
            x, y = (i % cols) * cell, (i // cols) * (cell + 20)
            pic = Image.open(f).convert('RGB')
            pic.thumbnail((cell - 8, cell - 8))
            img.paste(pic, (x + 4, y + 4))
            draw.text((x + 6, y + cell - 2), f.stem, fill=(255, 255, 140))
        dest = out / 'sheets' / f'items-{page // (cols * rows) + 1:02d}.jpg'
        img.save(dest, quality=82)
        print(f'  {dest}', flush=True)


def tidy(out: Path):
    art = load('clans-art')
    picks = json.loads(PICKS.read_text())
    for slug, n in picks.items():
        img = art.cut_out(out / f'{slug}-{n}.png')
        art.save(art.fit_height(img, 200), ITEMS / f'{slug}.webp', 80)


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) < 2 or args[0] not in ('paint', 'sheet', 'tidy'):
        sys.exit(__doc__)
    tries = 2
    if '--tries' in args:
        i = args.index('--tries')
        tries = int(args[i + 1])
        del args[i:i + 2]
    out = Path(args[1])
    if args[0] == 'paint':
        paint(out, args[2:] or list(DESCRIPTIONS), tries)
    elif args[0] == 'sheet':
        sheet(out)
    else:
        tidy(out)
