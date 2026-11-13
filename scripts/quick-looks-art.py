#!/usr/bin/env python3
"""
Paints the Quick looks garden art (step Q.A2 of docs/QUICK-LOOKS-ART-PLAN.md; names in src/subitising/art/README.md) in
ComfyUI on James's gaming PC, in the clay look of the painted home card (scripts/quick-looks-card-art.py: Dot the
ladybird in a yellow scarf). Runs on a computer that can reach ComfyUI on Tailscale, never in the site build.

  python3 scripts/quick-looks-art.py paint OUT_DIR [names] [--tries 3]   # OUT_DIR/q/<name>-<try>.png
  python3 scripts/quick-looks-art.py list
  python3 scripts/quick-looks-art.py scene7 OUT_DIR OUT_DIR/q/garden-scene-1.png   # seven beds, from a painted try
  python3 scripts/quick-looks-art.py bedless OUT_DIR    # the picked scene with its beds taken away (the game draws them)
  ~/.cache/rembg-venv/bin/python scripts/quick-looks-art.py tidy PICKS.json OUT_DIR   # {name: try or "other-name-try"} -> src/subitising/art/

Same graph and seeds as scripts/weka-art.py (Z-Image Turbo, 8 steps, 1.5x second pass). Positive wording only, and no
writing in any picture. Plants and the ladybird are painted on white and cut out with rembg. Every plant sits on the same
small soil mound: tidy scales each cut-out so its mound is the same width and puts the mound's foot at the same place on a
512 x 512 canvas, so all 35 plants line up in the beds.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'subitising' / 'art'

_spec = importlib.util.spec_from_file_location('weka_art', ROOT / 'scripts' / 'weka-art.py')
weka = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(weka)

STYLE = weka.STYLES['b']
AGE = weka.AGE
SPRITE = weka.SPRITE

# One soil mound for every plant, the same words every time, seen from the front at the same low angle.
MOUND = ('standing in one small low smooth rounded dome of dark brown clay soil with a softly textured surface, the mound wide and shallow at the bottom '
         'of the picture, seen straight from the front at eye level, soft light from the upper left, ')

# Steps 0 to 4: seed, sprout, leafy, bud, in flower.
STEPS = [
    'one plump seed resting on top of the soil, nothing growing yet',
    'a tiny green sprout with two little round leaves just poking up out of the soil',
    'a small young leafy green plant, a few healthy leaves, no flowers yet',
    'a taller leafy plant with closed green flower buds, about to bloom',
]

PLANTS = {
    1: ('daisy', 'a clump of white daisies in full bloom, white petals with sunny yellow middles, green leaves'),
    2: ('tulip', 'three bright red tulips in full bloom on straight green stems, long smooth green leaves'),
    3: ('sunflower', 'one tall sunflower in full bloom, a big yellow flower with a brown middle, a sturdy green stem and big leaves'),
    4: ('lavender', 'a rounded lavender bush in full bloom, many purple lavender flower spikes, soft grey-green leaves'),
    5: ('kowhai', 'a small young New Zealand kowhai tree in full bloom, a slim brown trunk, clusters of bright yellow drooping bell-shaped flowers, fine fern-like leaves'),
    6: ('harakeke', 'a New Zealand harakeke flax plant, a fan of long upright sword-shaped dark green leaves, with tall dark red-brown flower stalks rising above holding small red flowers'),
    7: ('pohutukawa', 'a small young New Zealand pohutukawa tree in full bloom, a short brown trunk, rounded dark green leaves, covered in fluffy bright crimson red brush flowers'),
}
# The bud step names the plant so the leaves look right.
BUD = {
    1: 'a leafy daisy plant with three thin green stems, each topped with one tiny tight closed bud, the buds small smooth green balls like peas',
    2: 'tulip leaves with three closed green and red tulip buds on straight stems',
    3: 'a tall green stem with big green leaves and one big round closed bud at the top, the bud a tight green ball wrapped in pointed green leaves',
    4: 'a small rounded lavender bush with grey-green leaves and pale green flower spikes not yet open',
    5: 'a small young New Zealand kowhai tree, a slim brown trunk, fine fern-like leaves, small green buds',
    6: 'a New Zealand harakeke flax plant, a fan of long upright sword-shaped dark green leaves, short green flower stalks starting',
    7: 'a small young New Zealand pohutukawa tree, a short brown trunk, rounded dark green leaves, small round green buds',
}
# Leafy: all green (naming the flower here made the model paint it in bloom).
LEAFY = {
    1: 'a small low rosette of rounded green leaves, all green leaves, short and bushy',
    2: 'a few long smooth upright green leaves, all green leaves',
    3: 'a short green stem with four big heart-shaped green leaves, all green leaves',
    4: 'a small low tuft of thin grey-green leaves, all green leaves',
    5: 'a little seedling, a thin green stem with fine feathery fern-like green leaves, all green leaves',
    6: 'a small fan of upright sword-shaped green leaves, all green leaves',
    7: 'a little seedling, a short brown stem with rounded dark green leaves, all green leaves',
}

LADYBIRD = ('Dot, a cute round little ladybird made of clay, shiny red shell with big black spots, a happy face with big eyes, '
            'wearing a little knitted yellow scarf, standing on two little legs, ')


# Step 0 is the same for every plant (they all start as a seed), painted once and used seven times.
SEED = ('One small low smooth rounded dome of dark brown clay soil with a softly textured surface, wide and shallow, with one '
        'little plump pale brown seed pressed into the very top, a bare smooth mound, seen straight from the front at eye level, '
        'soft light from the upper left, the whole mound visible.')


def plant_words(stage: int, step: int) -> str:
    if step == 0 and stage == 0:
        return SEED + SPRITE
    if step == 0:
        what = STEPS[0]
    elif step == 1:
        what = STEPS[1]
    elif step == 2:
        what = LEAFY[stage]
    elif step == 3:
        what = BUD[stage]
    else:
        what = PLANTS[stage][1]
    return f'A single garden plant in a children\'s game, {what}, {MOUND}the whole plant and mound visible.' + SPRITE


PICTURES: dict[str, tuple[str, tuple[int, int]]] = {
    'garden-scene': (
        'A sunny cottage garden at the foot of a soft green hill, a calm pale blue sky with a few fluffy clouds across the '
        'top half, a low white wooden picket fence across the middle, a light gravel path, and along the bottom third a long '
        'straight row of seven small empty wooden raised garden beds filled with dark brown soil, all the same size, evenly '
        'spaced side by side, seen from the front. Wide landscape background for a children\'s game, calm and uncluttered.' + AGE,
        (1088, 608)),
    **{f'plant-{s}-{k}': (plant_words(s, k), weka.SQUARE) for s in PLANTS for k in range(5)},
    'seed': (plant_words(0, 0), weka.SQUARE),
    # The game draws a bed under each plant itself (it lays the plants out in its own row), so the scene has none.
    'bed': ('One small empty raised garden bed made of clay, a chunky box shape about twice as wide as it is tall with deep sides, '
            'seen straight on from the front and slightly above, its long front side facing the viewer flat and level, '
            'the front made of smooth light tan clay wooden planks running across, a flat even top of dark brown clay soil '
            'showing just above the front edge, nothing growing in it.'
            + SPRITE, (1216, 832)),
    'friend-happy': (LADYBIRD + 'cheering with both arms up high, a big open happy smile, tiny sparkles around, the whole ladybird.' + SPRITE, weka.SQUARE),
    'friend-calm': (LADYBIRD + 'standing calmly with a gentle kind encouraging smile, one arm raised in a small friendly wave, the whole ladybird.' + SPRITE, weka.SQUARE),
}


def paint(out: Path, names: list[str], tries: int):
    """Weka's painter, with a longer wait per picture (the PC is slow while something else uses its graphics card)."""
    weka.PICTURES = PICTURES
    weka.STYLES = {'q': STYLE}
    sleep = weka.time.sleep
    weka.time = type('slow_time', (), {'sleep': staticmethod(lambda s: sleep(s * 6))})
    weka.paint(out, names, 'q', tries)


def scene7(out: Path, base: Path, tries: int):
    """The model paints six beds when asked for seven, so: cover the beds of a painted try (base) with grass, draw seven
    plain beds where the stand-in scene puts them (Scene.tsx: 6 units in, 2.5 apart, of 160), and paint again from that
    (image to image) -> OUT_DIR/q/garden-scene7-<n>.png. The painting helper is Clan Quest's village one."""
    from PIL import Image, ImageDraw, ImageFilter
    spec = importlib.util.spec_from_file_location('cv_art', ROOT / 'scripts' / 'clans-village-art.py')
    cv = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cv)
    im = Image.open(base).convert('RGB')
    w, h = im.size
    s = w / 160
    d = ImageDraw.Draw(im)
    d.rectangle((0, int(0.70 * h), w, h), fill=im.getpixel((w // 2, h - 20)))
    bw = (160 - 12 - 6 * 2.5) / 7
    for i in range(7):
        x0 = (6 + i * (bw + 2.5)) * s
        top, bot = int(h * 0.76), int(h * 0.93)
        d.rounded_rectangle((x0, top, x0 + bw * s, bot), radius=12, fill=(190, 130, 70), outline=(120, 78, 35), width=6)
        d.rounded_rectangle((x0 + 10, top + 8, x0 + bw * s - 10, top + 45), radius=8, fill=(92, 62, 38))
    init = out / 'garden-init-7.png'
    im.filter(ImageFilter.GaussianBlur(2)).save(init)
    words = STYLE + PICTURES['garden-scene'][0]
    for n in range(1, tries + 1):
        cv.run(out / 'q' / f'garden-scene7-{n}.png', words, PICTURES['garden-scene'][1], init, 0.55 + 0.05 * (n - 1))


def bedless(out: Path, tries: int):
    """The current garden-scene.webp with its beds taken away: the grass below the fence is refilled row by row from its
    plain edges, painted over lightly (image to image), and only that bottom part kept, so the sky, hills and fence stay
    exactly the same -> OUT_DIR/q/garden-bedless-<n>.png (1600x900)."""
    import numpy as np
    from PIL import Image, ImageFilter
    spec = importlib.util.spec_from_file_location('cv_art', ROOT / 'scripts' / 'clans-village-art.py')
    cv = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cv)
    src = Image.open(ART / 'garden-scene.webp').convert('RGB')
    w, h = src.size
    px = np.asarray(src).astype(float)
    y0 = int(0.735 * h)
    edge = np.concatenate([px[:, :40], px[:, -40:]], axis=1)
    fill = px.copy()
    rng = np.random.default_rng(7)
    for y in range(y0, h):
        fill[y, :] = np.median(edge[y], axis=0) + rng.normal(0, 2.5, (w, 3))
    filled = Image.fromarray(fill.clip(0, 255).astype('uint8'))
    init = out / 'garden-bedless-init.png'
    filled.filter(ImageFilter.GaussianBlur(1.5)).save(init)
    words = STYLE + PICTURES['garden-scene'][0].split(', and along the bottom third')[0] + (
        ', and along the bottom third a wide open stretch of smooth plain clay grass. Wide landscape background for a '
        "children's game, calm and uncluttered." + AGE)
    mask = Image.new('L', (w, h), 0)
    m = np.zeros((h, w), dtype='uint8')
    m[y0 - 30:] = 255
    mask = Image.fromarray(m).filter(ImageFilter.GaussianBlur(14))
    for n in range(1, tries + 1):
        raw = out / 'q' / f'garden-bedless-raw-{n}.png'
        cv.run(raw, words, (1088, 608), init, 0.28 + 0.07 * (n - 1))
        painted = Image.open(raw).convert('RGB').resize((w, h), Image.LANCZOS)
        Image.composite(painted, src, mask).save(out / 'q' / f'garden-bedless-{n}.png')


def tidy(picks_file: Path, inbox: Path):
    import numpy as np
    from PIL import Image
    from rembg import new_session, remove
    from scipy.ndimage import binary_fill_holes
    picks = json.loads(picks_file.read_text())
    session = new_session('isnet-general-use')

    def save(img, name: str, size: int, q: int):
        im = img.copy()
        im.thumbnail((size, size), Image.LANCZOS)
        out = ART / f'{name}.webp'
        im.save(out, 'WEBP', quality=q, method=6)
        print(f'  {out.relative_to(ROOT)}  {im.width}x{im.height}  {out.stat().st_size // 1024} KB', flush=True)

    def cut(src: Image.Image) -> Image.Image:
        rgb = src.convert('RGB')
        px = np.asarray(remove(rgb, session=session, alpha_matting=True)).copy()
        hole = binary_fill_holes(px[..., 3] > 128) & (px[..., 3] <= 128)
        px[hole, :3] = np.asarray(rgb)[hole]
        px[hole, 3] = 255
        return Image.fromarray(px, 'RGBA')

    for name, t in picks.items():
        # A pick is a try number, or another picture's try by name ("seed-2": every plant's step 0 is the one seed).
        src = Image.open(inbox / 'q' / (f'{t}.png' if isinstance(t, str) else f'{name}-{t}.png'))
        if name == 'garden-scene':
            img = src.convert('RGB').resize((1600, 900), Image.LANCZOS)
            save(img, name, 1600, 78)
            save(img, f'{name}-small', 800, 74)
            continue
        c = cut(src)
        a = np.asarray(c)[..., 3] > 40
        ys, xs = np.where(a)
        top, bottom = ys.min(), ys.max()
        if name == 'bed':
            # Trimmed tight and 512 wide, so the game can stretch it under a plant.
            box = c.crop((xs.min(), top, xs.max() + 1, bottom + 1))
            box = box.resize((512, round(box.height * 512 / box.width)), Image.LANCZOS)
            save(box, name, 512, 84)
            save(box, f'{name}-small', 256, 82)
            continue
        if name.startswith('plant-'):
            # The mound: the widest row in the bottom eighth of the cut-out. Every mound ends up 300 px wide, its foot at
            # y 500, centred; a plant too tall for that is shrunk to fit (only the trees).
            band = range(max(top, bottom - (bottom - top) // 8 - 4), bottom + 1)
            widest = max(band, key=lambda y: a[y].sum())
            row = np.where(a[widest])[0]
            mound_w, mound_cx = row.max() - row.min(), (row.max() + row.min()) / 2
            scale = min(300 / mound_w, 490 / (bottom - top + 1))
            foot_x, foot_y = 256, 500
        else:
            mound_cx = (xs.min() + xs.max()) / 2
            scale = min(480 / (xs.max() - xs.min() + 1), 480 / (bottom - top + 1))
            foot_x, foot_y = 256, 496
        big = c.resize((round(c.width * scale), round(c.height * scale)), Image.LANCZOS)
        canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        canvas.alpha_composite(big, (round(foot_x - mound_cx * scale), round(foot_y - bottom * scale)))
        save(canvas, name, 512, 84)
        save(canvas, f'{name}-small', 256, 82)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['list']:
        print('\n'.join(PICTURES))
    elif a[:1] == ['paint'] and len(a) >= 2:
        tries = 3
        if '--tries' in a:
            i = a.index('--tries')
            tries = int(a[i + 1])
            del a[i:i + 2]
        paint(Path(a[1]).expanduser(), a[2:] or list(PICTURES), tries)
    elif a[:1] == ['scene7'] and len(a) == 3:
        scene7(Path(a[1]).expanduser(), Path(a[2]).expanduser(), 3)
    elif a[:1] == ['bedless'] and len(a) == 2:
        bedless(Path(a[1]).expanduser(), 3)
    elif a[:1] == ['tidy'] and len(a) == 3:
        tidy(Path(a[1]).expanduser(), Path(a[2]).expanduser())
    else:
        sys.exit(__doc__)
