"""Makes the four round pictures for the Dragon Maths season road (src/games/lord/art/timeline/) from the game's own paintings.

Run from the repo root: python3 scripts/lord-timeline-art.py  (needs Pillow). Each picture is 192 x 192 webp; the page cuts it round.
"""
from PIL import Image, ImageFilter

ART = 'src/games/lord/art/'
OUT = ART + 'timeline/'
SIZE = 192


def scene(name, cx, cy, side):
    """A square from a scene painting, centred on (cx, cy) of the 800 x 450 copy, `side` pixels across."""
    im = Image.open(f'{ART}scenes/{name}-800.webp').convert('RGB')
    h = side // 2
    return im.crop((cx - h, cy - h, cx + h, cy + h)).resize((SIZE, SIZE), Image.LANCZOS)


def figure_on(back, figure, box, scale, dx=0, dy=0):
    """A cut-out figure (with see-through edges) over a softened backdrop. `box` is the part of the figure to show."""
    back = back.filter(ImageFilter.GaussianBlur(1.5))
    fig = Image.open(ART + figure).convert('RGBA').crop(box)
    w = int(fig.width * scale)
    fig = fig.resize((w, int(fig.height * scale)), Image.LANCZOS)
    back.paste(fig, ((SIZE - w) // 2 + dx, SIZE - fig.height + dy), fig)
    return back


def save(im, name):
    im.save(f'{OUT}{name}.webp', 'WEBP', quality=82, method=6)


save(scene('forest-1', 150, 300, 300), 'stage-forest')
save(figure_on(scene('training', 560, 230, 380), 'masters/high-master-orrin.webp', (0, 0, 246, 236), 0.74, dy=2), 'stage-masters')
save(figure_on(scene('lair', 560, 300, 300), 'dragon/scorchtail.webp', (0, 0, 789, 720), 0.27, dx=4, dy=-4), 'stage-dragon')
save(scene('hall', 540, 200, 300), 'stage-new-season')
