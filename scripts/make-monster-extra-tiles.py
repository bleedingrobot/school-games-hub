#!/usr/bin/env python3
"""
Makes src/games/monsters/world/assets/extra-tiles.png: the map tiles Kenney's Tiny Town and
Tiny Dungeon do not have (water, lava, sand, snow, cave rock, long grass for every area, palms,
boulders...), drawn in the packs' own colours so they match. Snow pines and the snow bush are
Tiny Town's own pine and bush with the greens swapped for snow colours.
Run: python3 scripts/make-monster-extra-tiles.py     (needs Pillow)

Tiles (16 px each, left to right; a map's tile number is 265 + the number below):
  0 water A   1 water B (the two animation frames)   2 long grass
  3 sand   4 beach grass (long)   5 snow   6 snow grass (long)
  7 lava A   8 lava B (animation frames)   9 ash   10 ember grass (long)
  11 cave floor   12 glow moss (long)   13 cave wall
  14 snow pine top   15 snow pine trunk   16 snow pine (one tile)   17 snow bush
  18 boulder   19 dark boulder   20 stalagmite   21 crystal   22 palm top   23 palm trunk
  24 sand path   25 snow path   26 ash path   27 cave path   28 cobbles   29 ice
"""
from PIL import Image

TOWN = 'src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png'


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


GRASS, GRASS_LIGHT, GRASS_DARK, LEAF = rgb('84c669'), rgb('8bd87d'), rgb('65a556'), rgb('479f4a')
OUT, NAVY = rgb('3f2631'), rgb('262b44')
SAND_L, SAND, SAND_D, PEACH = rgb('fec99c'), rgb('eaa56c'), rgb('cf8254'), rgb('fcbc8f')
YEL, GOLD, ORANGE, RED, RED_D = rgb('fee761'), rgb('fdbe53'), rgb('e38628'), rgb('e84537'), rgb('c34b35')
BROWN, BROWN_D = rgb('bd6c4a'), rgb('763b36')
GREY_L, GREY, GREY_D, SLATE = rgb('c0cbdc'), rgb('8b9bb4'), rgb('5a6988'), rgb('52607c')
WHITE, SNOW = rgb('ffffff'), rgb('e4edf9')
WATER, WATER_LIGHT, WATER_DEEP = rgb('009adc'), rgb('76e4ff'), rgb('007cb8')
TEAL, TEAL_L, TEAL_D = rgb('43e1b3'), rgb('69ffd4'), rgb('25956a')
PINK = rgb('f28462')

COUNT = 30
img = Image.new('RGBA', (16 * COUNT, 16), (0, 0, 0, 0))
px = img.load()


def noise(x, y, salt):
    return ((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) % 1000 / 1000


def put(ox, x, y, colour):
    if 0 <= x < 16 and 0 <= y < 16:
        px[ox + x, y] = colour + (255,)


def fill(ox, colour):
    for y in range(16):
        for x in range(16):
            put(ox, x, y, colour)


def speckle(ox, salt, colours, chance=0.07):
    """Scatters single pixels of the given colours over a tile (the same tile always gets the same ones)."""
    for y in range(16):
        for x in range(16):
            n = noise(x, y, salt)
            if n < chance:
                put(ox, x, y, colours[int(n / chance * len(colours)) % len(colours)])


def art(ox, rows, key):
    """Draws a picture from rows of letters ('.' = see-through)."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                put(ox, x, y, key[ch])


# ---- water, long grass (the originals) ----
def water(ox, shift):
    fill(ox, WATER)
    for y, x0 in [(3, 1), (8, 7), (13, 3)]:
        x0 = (x0 + shift * 3) % 16
        for dx in range(5):  # a little wave: a light line with a deep shadow under it
            put(ox, (x0 + dx) % 16, y, WATER_LIGHT)
            put(ox, (x0 + dx + 1) % 16, y + 1, WATER_DEEP)
    for x, y in [(2, 11), (12, 2)] if shift == 0 else [(5, 12), (13, 6)]:
        put(ox, x, y, WATER_LIGHT)


TUFT = ['L..L..L', 'G.GLG.G', 'GGGGGGG', '.DDDDD.']


def tufts(ox, light, mid, dark, spots=((0, 0), (9, 1), (4, 6), (11, 10), (0, 11))):
    for tx, ty in spots:  # clumps of tall blades
        for dy, row in enumerate(TUFT):
            for dx, ch in enumerate(row):
                if ch != '.':
                    put(ox, tx + dx, ty + dy, {'L': light, 'G': mid, 'D': dark}[ch])


def long_grass(ox):
    fill(ox, GRASS)
    for x, y in [(1, 6), (14, 1), (9, 8)]:  # a few plain tufts, like the base tile
        put(ox, x, y, GRASS_DARK)
        put(ox, x + 1, y, GRASS_LIGHT)
    tufts(ox, GRASS_LIGHT, LEAF, GRASS_DARK)


def ground_with_tufts(ox, base, specks, salt, light, mid, dark):
    fill(ox, base)
    speckle(ox, salt, specks, 0.06)
    tufts(ox, light, mid, dark)


def lava(ox, shift):
    fill(ox, RED)
    for y, x0 in [(2, 2), (7, 9), (12, 4)]:  # bright flowing streaks
        x0 = (x0 + shift * 4) % 16
        for dx in range(6):
            put(ox, (x0 + dx) % 16, y, GOLD)
            put(ox, (x0 + dx + 1) % 16, y + 1, ORANGE)
    for x, y in [(1, 5), (11, 13)] if shift == 0 else [(6, 6), (14, 11)]:
        put(ox, x, y, YEL)
        put(ox, x + 1, y, ORANGE)
    for x, y in [(13, 4), (3, 10)] if shift == 0 else [(2, 3), (12, 9)]:
        put(ox, x, y, RED_D)


def rock_block(ox):
    fill(ox, SLATE)
    for y in range(16):
        for x in range(16):
            n = noise(x // 2, y // 2, 13)
            if n < 0.25:
                put(ox, x, y, NAVY)
            elif n > 0.82:
                put(ox, x, y, GREY_D)
    for x in range(16):  # a lighter top edge and a dark bottom edge, so a row of them reads as a wall
        put(ox, x, 0, GREY)
        put(ox, x, 15, NAVY)
    for y in range(16):
        put(ox, 0, y, GREY_D)
        put(ox, 15, y, NAVY)


def recolour(tile, mapping):
    src = Image.open(TOWN).convert('RGBA')
    col, row = tile % 12, tile // 12
    t = src.crop((col * 16, row * 16, col * 16 + 16, row * 16 + 16))
    out = t.copy()
    p = out.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = p[x, y]
            if a and (r, g, b) in mapping:
                p[x, y] = mapping[(r, g, b)] + (255,)
    return out


SNOW_MAP = {GRASS: SNOW, LEAF: GREY, GRASS_DARK: GREY_L, GRASS_LIGHT: WHITE}


def paste(ox, tile):
    img.paste(tile, (ox, 0), tile)


BOULDER = [
    '................',
    '................',
    '................',
    '................',
    '......OOOO......',
    '....OOLLLLOO....',
    '...OLLLWWLLLO...',
    '..OLLLLWLLLLGO..',
    '..OLLLLLLLLGGO..',
    '.OLLLLLLLLGGGGO.',
    '.OLLLLLLGGGGGDO.',
    '.OGGGGGGGGGGDDO.',
    '..ODDDDDDDDDDO..',
    '...OOOOOOOOOO...',
    '................',
    '................',
]
STALAGMITE = [
    '................',
    '.......OO.......',
    '......OLLO......',
    '......OLLGO.....',
    '.....OLLLGO.....',
    '.....OLLLGGO....',
    '....OLLLGGGO....',
    '....OLLLGGGDO...',
    '...OLLLGGGGDO...',
    '..OOLLGGGGGDDO..',
    '.OLLLGGGGGGDDDO.',
    '.OLLGGGGGGGDDDO.',
    '..OODDDDDDDDDO..',
    '....OOOOOOOOO...',
    '................',
    '................',
]
CRYSTAL = [
    '................',
    '.........O......',
    '........OWO.....',
    '...O....OTO.....',
    '..OWO..OTLO.....',
    '..OTO..OTLO.....',
    '..OTLO.OTLDO....',
    '.OTTLO.OTLDO.OO.',
    '.OTTLDOOTLDOOWO.',
    '.OTLLDDOTLDDOTO.',
    '.OTLDDDOTLDDOTLO',
    '.OTDDDOOTDDDOTLO',
    '..OOOOOOOOOOOOO.',
    '................',
    '................',
    '................',
]
PALM_TOP = [
    '................',
    '....OO....OO....',
    '..OOGGO..OGGOO..',
    '.OGGLLGOOGLLGGO.',
    'OGLLGGGGGGGGLLGO',
    'OGGGGOOGGOOGGGGO',
    '.OOOOGGGGGGOOOO.',
    '....OGGLLGGO....',
    '...OGLGOOGLGO...',
    '..OGGO.OBO.OGGO.',
    '..OO...OBBO..OO.',
    '.......OBBO.....',
    '.......OBBO.....',
    '.......OBDO.....',
    '.......OBDO.....',
    '.......OBDO.....',
]
PALM_TRUNK = [
    '.......OBDO.....',
    '.......OBDO.....',
    '.......OBDO.....',
    '.......OBDO.....',
    '.......OBDO.....',
    '.......OBDO.....',
    '.......OBBDO....',
    '......OBBBDDO...',
    '.....OBDOOBDO...',
    '......OOO.OO....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
]


def cobbles(ox):
    fill(ox, GREY_L)
    for y in range(16):
        for x in range(16):
            if y % 8 == 0 or (x + (4 if (y // 8) % 2 else 0)) % 8 == 0:
                put(ox, x, y, GREY)
    speckle(ox, 28, [GREY, WHITE], 0.04)


def ice(ox):
    fill(ox, WATER_LIGHT)
    for x0, y0 in [(1, 3), (8, 9), (3, 13)]:
        for d in range(5):
            put(ox, x0 + d, y0 - d // 2, WHITE)
    speckle(ox, 29, [WHITE, SNOW], 0.05)


tiles = [
    lambda o: water(o, 0),
    lambda o: water(o, 1),
    long_grass,
    lambda o: (fill(o, SAND_L), speckle(o, 3, [SAND, PEACH, SAND, WHITE], 0.09)),
    lambda o: ground_with_tufts(o, SAND_L, [SAND, PEACH], 4, YEL, GRASS, LEAF),
    lambda o: (fill(o, SNOW), speckle(o, 5, [WHITE, GREY_L, WHITE], 0.1)),
    lambda o: ground_with_tufts(o, SNOW, [WHITE, GREY_L], 6, GREY_L, GREY, GREY_D),
    lambda o: lava(o, 0),
    lambda o: lava(o, 1),
    lambda o: (fill(o, SLATE), speckle(o, 9, [NAVY, GREY_D, NAVY, GREY], 0.1)),
    lambda o: ground_with_tufts(o, SLATE, [NAVY, GREY_D], 10, GOLD, ORANGE, RED_D),
    lambda o: (fill(o, NAVY), speckle(o, 11, [OUT, SLATE, OUT, GREY_D], 0.09)),
    lambda o: ground_with_tufts(o, NAVY, [OUT, SLATE], 12, TEAL_L, TEAL, TEAL_D),
    rock_block,
    lambda o: paste(o, recolour(4, SNOW_MAP)),
    lambda o: paste(o, recolour(16, SNOW_MAP)),
    lambda o: paste(o, recolour(28, SNOW_MAP)),
    lambda o: paste(o, recolour(5, SNOW_MAP)),
    lambda o: art(o, BOULDER, {'O': OUT, 'L': GREY_L, 'W': WHITE, 'G': GREY, 'D': GREY_D}),
    lambda o: art(o, BOULDER, {'O': OUT, 'L': GREY_D, 'W': GREY, 'G': SLATE, 'D': NAVY}),
    lambda o: art(o, STALAGMITE, {'O': OUT, 'L': GREY, 'G': GREY_D, 'D': SLATE}),
    lambda o: art(o, CRYSTAL, {'O': OUT, 'W': WHITE, 'T': TEAL_L, 'L': TEAL, 'D': TEAL_D}),
    lambda o: art(o, PALM_TOP, {'O': OUT, 'G': LEAF, 'L': GRASS_LIGHT, 'B': BROWN, 'D': BROWN_D}),
    lambda o: art(o, PALM_TRUNK, {'O': OUT, 'B': BROWN, 'D': BROWN_D}),
    lambda o: (fill(o, SAND), speckle(o, 24, [SAND_D, SAND_L, SAND_D], 0.1)),
    lambda o: (fill(o, GREY_L), speckle(o, 25, [GREY, SNOW, GREY], 0.1)),
    lambda o: (fill(o, GREY), speckle(o, 26, [GREY_D, GREY_L, GREY_D], 0.1)),
    lambda o: (fill(o, SLATE), speckle(o, 27, [GREY_D, NAVY, GREY], 0.1)),
    cobbles,
    ice,
]
assert len(tiles) == COUNT, len(tiles)
for i, draw in enumerate(tiles):
    draw(i * 16)

img.save('src/games/monsters/world/assets/extra-tiles.png')
print(f'wrote extra-tiles.png ({COUNT} tiles)')
