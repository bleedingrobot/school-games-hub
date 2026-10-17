#!/usr/bin/env python3
"""
Makes src/games/monsters/world/assets/extra-tiles.png: the few map tiles Kenney's Tiny Town
does not have (water, long grass), drawn in Tiny Town's own colours so they match.
Run: python3 scripts/make-monster-extra-tiles.py     (needs Pillow)

Tiles (16 px each, left to right):  0 water A, 1 water B (the two animation frames), 2 long grass
"""
from PIL import Image

GRASS, GRASS_LIGHT, GRASS_DARK = (0x84, 0xC6, 0x69), (0x8B, 0xD8, 0x7D), (0x65, 0xA5, 0x56)
LEAF, OUTLINE = (0x47, 0x9F, 0x4A), (0x3F, 0x26, 0x31)
WATER, WATER_LIGHT, WATER_DEEP = (0x00, 0x9A, 0xDC), (0x76, 0xE4, 0xFF), (0x00, 0x7C, 0xB8)

img = Image.new('RGBA', (48, 16), (0, 0, 0, 0))
px = img.load()


def fill(ox, colour):
    for y in range(16):
        for x in range(16):
            px[ox + x, y] = colour + (255,)


def dot(ox, x, y, colour):
    if 0 <= x < 16 and 0 <= y < 16:
        px[ox + x, y] = colour + (255,)


def water(ox, shift):
    fill(ox, WATER)
    for row, (y, x0) in enumerate([(3, 1), (8, 7), (13, 3)]):
        x0 = (x0 + shift * 3) % 16
        for dx in range(5):  # a little wave: a light line with a deep shadow under it
            dot(ox, (x0 + dx) % 16, y, WATER_LIGHT)
            dot(ox, (x0 + dx + 1) % 16, y + 1, WATER_DEEP)
    for x, y in [(2, 11), (12, 2)] if shift == 0 else [(5, 12), (13, 6)]:
        dot(ox, x, y, WATER_LIGHT)


TUFT = [
    'L..L..L',
    'G.GLG.G',
    'GGGGGGG',
    '.DDDDD.',
]
TUFT_COLOURS = {'L': GRASS_LIGHT, 'G': LEAF, 'D': GRASS_DARK}


def long_grass(ox):
    fill(ox, GRASS)
    for x, y in [(1, 6), (14, 1), (9, 8)]:  # a few plain tufts, like the base tile
        dot(ox, x, y, GRASS_DARK)
        dot(ox, x + 1, y, GRASS_LIGHT)
    for tx, ty in [(0, 0), (9, 1), (4, 6), (11, 10), (0, 11)]:  # clumps of tall blades
        for dy, row in enumerate(TUFT):
            for dx, ch in enumerate(row):
                if ch != '.':
                    dot(ox, tx + dx, ty + dy, TUFT_COLOURS[ch])


water(0, 0)
water(16, 1)
long_grass(32)
img.save('src/games/monsters/world/assets/extra-tiles.png')
print('wrote extra-tiles.png')
