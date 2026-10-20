#!/usr/bin/env python3
"""
Draws Marble Rush's six New Zealand courses and writes shared/marble/nzCourses.ts.

The courses are plain letters and digits (see shared/marble/course.ts); this script is only a
convenient way to draw them: you describe a track as "go 6 tiles, slope down 2, turn south ..." and it
paints the tiles, rails and heights, and lists the waypoints the reference bot follows. Run it from the
project folder:  python3 scripts/marble-courses.py
Then run `npm run marble:sim` to see the reference times and update the medals in the COURSES table below.
"""
import sys

HEAD = {'E': (1, 0), 'S': (0, 1), 'W': (-1, 0), 'N': (0, -1)}
DOWN = {'E': '>', 'S': 'v', 'W': '<', 'N': '^'}
UP = {'E': '<', 'S': '^', 'W': '>', 'N': 'v'}


class Track:
    def __init__(self, x, y, heading='E', width=5, level=20):
        self.x, self.y, self.h, self.w, self.lvl = x, y, heading, width, level
        self.grid = {}  # (x, y) -> [ch, level, rails]
        self.route = []
        self.reserved = set()  # cells of a gap: no rail may close them
        self.start = (x, y)
        self.gates = []  # answer gates (maths): see gate()
        self.next_door = 0
        self.trails = []  # number gems (maths): see gems()

    # painting helpers
    def _perp(self):
        dx, dy = HEAD[self.h]
        return (-dy, dx) if dx else (1, 0)

    def _cross(self, ch, lvl, width=None, rails=True, at=None, i=0):
        w = width or self.w
        r = w // 2
        px, py = self._perp()
        for off in range(-r, r + 1):
            cell = (self.x + px * off, self.y + py * off)
            c = ch
            if at and (i, off) in at:
                c = at[(i, off)]
            self.grid[cell] = [c, lvl, rails]
        if rails:
            for off in (-r - 1, r + 1):
                cell = (self.x + px * off, self.y + py * off)
                self.grid.setdefault(cell, ['=', 0, False])

    def _step(self, n=1):
        dx, dy = HEAD[self.h]
        self.x += dx * n
        self.y += dy * n

    def wp(self):
        self.route.append((self.x + 0.5, self.y + 0.5))

    # commands
    def go(self, n, ch='#', width=None, rails=True, at=None, every=3, stop=None):
        # stop=(i, 'k' or 'h'): row i, right across the track, is a question stop (1 s or half a second off).
        for i in range(n):
            self._cross(stop[1] if stop and i == stop[0] else ch, self.lvl, width, rails, at, i)
            if i % every == every - 1 or i == n - 1:
                self.wp()
            self._step()
        return self

    def down(self, n, width=None, rails=True, ch=None):
        for i in range(n):
            self._cross(ch or DOWN[self.h], self.lvl, width, rails)
            self.lvl -= 1
            self.wp()
            self._step()
        return self

    def up(self, n, width=None, rails=True):
        for i in range(n):
            self.lvl += 1
            self._cross(UP[self.h], self.lvl, width, rails)
            self.wp()
            self._step()
        return self

    def gap(self, n, width=None, rails=True):
        w = width or self.w
        r = w // 2
        px, py = self._perp()
        for i in range(n):
            for off in range(-r, r + 1):
                self.reserved.add((self.x + px * off, self.y + py * off))
            if rails:
                for off in (-r - 1, r + 1):
                    self.grid.setdefault((self.x + px * off, self.y + py * off), ['=', 0, False])
            self.wp()
            self._step()
        return self

    def turn(self, new, width=None, rails=True):
        """Fill the corner square, then face a new way. The corner square is centred on the cell we are about to paint."""
        w = width or self.w
        r = w // 2
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                self.grid[(self.x + dx, self.y + dy)] = ['#', self.lvl, rails]
        self.wp()
        self.h = new
        self._step(r + 1)
        return self

    def gate(self, k, lane_w=2, length=5, approach=3, rails=True):
        """An answer gate: a sign, a slow patch, then `k` tunnels side by side, each ending in a shortcut door.
        Which door is open is decided by the maths (shared/marble/maths.ts); a shut door makes the tunnel a dead end."""
        total = k * lane_w + (k - 1)
        o0 = -(total // 2)
        wide = total if total % 2 else total + 1
        px, py = self._perp()
        dx, dy = HEAD[self.h]

        def at(off, along=0):
            return (self.x + px * off + dx * along, self.y + py * off + dy * along)

        sign = (self.x, self.y)
        for i in range(approach):
            self._cross('m' if i >= approach - 2 else '#', self.lvl, wide, rails)
            self._step()
        # the middle of the slow patch's end: where a student chooses
        plaza = (self.x - dx + 0.5, self.y - dy + 0.5)
        self.route.append(plaza)
        after = len(self.route)
        tunnels = []
        for j in range(k):
            first = o0 + j * (lane_w + 1)
            tunnels.append({'off': first + (lane_w - 1) / 2, 'cells': [], 'door': self.next_door + j})
        self.next_door += k
        for i in range(length + 1):  # the last row is the doors
            for off in range(o0, o0 + total):
                j = (off - o0) // (lane_w + 1)
                inside = (off - o0) % (lane_w + 1)
                cell = at(off)
                if inside == lane_w:
                    self.grid[cell] = ['=', 0, False]
                elif i == length:
                    self.grid[cell] = [chr(65 + tunnels[j]['door']), self.lvl, rails]
                else:
                    self.grid[cell] = ['#', self.lvl, rails]
                    tunnels[j]['cells'].append(cell)
            self._step()
        for i in range(2):  # the lanes join again
            self._cross('#', self.lvl, wide, rails)
            self._step()
        self.wp()
        out = []
        for t in tunnels:
            def row(n, off=t['off']):
                # centre of lane row n (0 = first lane row)
                back = (length + 1 + 2) - n
                return (self.x - dx * back + 0.5 + px * off, self.y - dy * back + 0.5 + py * off)
            entry, mid, end, door = row(0), row(length // 2), row(length - 1), row(length)
            out.append({
                'cells': t['cells'], 'door': t['door'],
                'route': [entry, mid, end, door],
                'dead': [entry, mid, end, mid, entry],
            })
        self.gates.append({'sign': sign, 'after': after, 'tunnels': out})
        return self

    def gems(self, trail, offsets=(-1, 0, 1)):
        """A group of number gems across the track at the cell just painted (call it right after a go()). Groups with the same
        `trail` number share one question; the first group of a trail also puts the trail's sign five cells back."""
        px, py = self._perp()
        dx, dy = HEAD[self.h]
        cx, cy = self.x - dx, self.y - dy  # the cell just painted
        while len(self.trails) <= trail:
            self.trails.append(None)
        if self.trails[trail] is None:
            self.trails[trail] = {'sign': (cx - dx * 5, cy - dy * 5), 'groups': []}
        spots = [(cx + px * o + 0.5, cy + py * o + 0.5) for o in offsets]
        # the route goes through the cell's middle; the bot reaches out to the right gem from there
        self.trails[trail]['groups'].append({'after': len(self.route), 'spots': spots})
        return self

    def mark(self, dx, dy, ch):
        """Put a special tile at an offset from where we are (for bumpers and so on)."""
        cell = (self.x + dx, self.y + dy)
        if cell in self.grid:
            self.grid[cell][0] = ch


def finalize(track, finish_cells):
    g = track.grid
    # rails round every railed floor tile
    for (x, y), (ch, lvl, rails) in list(g.items()):
        if ch == '=' or not rails:
            continue
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                g.setdefault((x + dx, y + dy), ['=', 0, False])
    xs = [k[0] for k in g]
    ys = [k[1] for k in g]
    x0, x1, y0, y1 = min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1
    rows, hts = [], []
    for y in range(y0, y1 + 1):
        r = ''
        h = ''
        for x in range(x0, x1 + 1):
            c = g.get((x, y))
            if not c:
                r += '.'
                h += '0'
            else:
                r += c[0]
                h += '0' if c[0] in '=' else format(max(0, c[1]), 'x') if c[1] < 16 else chr(ord('a') + c[1] - 10)
        rows.append(r)
        hts.append(h)
    return rows, hts, (x0, y0)


def lvlchar(n):
    return '0123456789abcdefghijklmnopqrstuvwxyz'[n]


def build(track, finish_len=2):
    # start tile
    sx, sy = track.start
    track.grid[(sx, sy)][0] = 's'
    # finish: last cross-sections
    return track


def render(track):
    g = track.grid
    for (x, y), c in g.items():
        pass
    # rails
    for (x, y), (ch, lvl, rails) in list(g.items()):
        if ch == '=' or not rails:
            continue
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (x + dx, y + dy) not in track.reserved:
                    g.setdefault((x + dx, y + dy), ['=', 0, False])
    xs = [k[0] for k in g]
    ys = [k[1] for k in g]
    x0, x1, y0, y1 = min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1
    rows, hts = [], []
    for y in range(y0, y1 + 1):
        r, h = '', ''
        for x in range(x0, x1 + 1):
            c = g.get((x, y))
            if not c:
                r += '.'
                h += '0'
            else:
                r += c[0]
                h += '0' if c[0] == '=' else lvlchar(c[1])
        rows.append(r)
        hts.append(h)
    route = [(round(a - x0, 1), round(b - y0, 1)) for a, b in track.route]
    gates = []
    for g in track.gates:
        gates.append({
            'sign': (g['sign'][0] - x0, g['sign'][1] - y0), 'after': g['after'],
            'tunnels': [{
                'cells': [(cx - x0, cy - y0) for cx, cy in t['cells']], 'door': t['door'],
                'route': [(round(a - x0, 1), round(b - y0, 1)) for a, b in t['route']],
                'dead': [(round(a - x0, 1), round(b - y0, 1)) for a, b in t['dead']],
            } for t in g['tunnels']],
        })
    trails = []
    for tr in track.trails:
        if tr is None:
            continue
        trails.append({
            'sign': (tr['sign'][0] - x0, tr['sign'][1] - y0),
            'groups': [{'after': g['after'], 'spots': [(round(a - x0, 1), round(b - y0, 1)) for a, b in g['spots']]} for g in tr['groups']],
        })
    return rows, hts, route, gates, trails


# ----------------------------------------------------------------------------- the courses

def boulder_beach():
    t = Track(2, 2, 'E', width=5, level=22)
    t.go(5)
    t.mark(-5, 0, 's')
    t.down(3)
    t.go(5, at={(2, 1): 'b'})
    t.turn('S')
    t.go(3)
    t.down(3)
    t.go(2, ch='c')
    t.go(5, at={(2, 1): 'b'})
    t.turn('E')
    t.go(1)
    t.gate(2)          # the one tutorial gate
    t.go(2)
    t.down(4)
    t.go(4, stop=(1, 'k'))
    t.turn('S')
    t.go(2)
    t.down(3)
    t.go(3, at={(1, -1): 'b', (1, 1): 'b'})
    t.turn('E')
    t.go(5, stop=(2, 'h'))
    t.down(2)
    t.go(2, ch='f')
    return t


def crown_range():
    t = Track(2, 2, 'E', width=4, level=24)
    t.go(4)
    t.mark(-4, 0, 's')
    # hairpins: long straights joined by open-edged turns
    for k in range(3):
        t.go(10, at={(3, -1): 'b', (7, 1): 'b'} if k % 2 == 0 else {(3, 1): 'b', (7, -1): 'b'}, stop={1: (2, 'k'), 2: (5, 'h')}.get(k))
        t.down(2)
        if k == 1:
            t.go(2, ch='c')
            t.go(2)
        else:
            t.go(4)
        t.turn('S', rails=False)
        t.go(3, rails=False)
        t.turn('W' if k % 2 == 0 else 'E', rails=False)
        t.go(1)
        t.gate(2)
        t.go(1)
        t.down(2)
        t.go(2)
        t.turn('S', rails=False)
        t.go(3, rails=False, stop=(0, 'k') if k == 2 else None)  # the third question stop, after the last gate
        t.turn('E' if k % 2 == 0 else 'W', rails=False)
        if k == 2:
            break
    t.go(6)
    t.down(2)
    t.go(3, ch='f')
    return t


def geyser_valley():
    t = Track(2, 2, 'E', width=5, level=16)
    t.go(5)
    t.mark(-5, 0, 's')
    t.down(2)
    t.go(3, ch='m')
    t.go(2)
    t.go(1, ch='g', width=1)  # one geyser launches you over the first trench
    t.gap(3)
    t.go(3, ch='#')
    t.down(2)
    t.go(2, ch='c')
    t.go(3)          # (a turn paints over the two cells before it, so the checkpoint needs room)
    t.turn('S')
    t.go(1)
    t.down(2)
    t.go(2, stop=(0, 'k'))
    t.go(1, ch='g', width=3)
    t.gap(3, width=5)
    t.go(3)
    t.turn('E')
    t.go(1)
    t.gate(2)
    t.go(2, ch='m', stop=(1, 'h'))
    t.down(3)
    t.go(2, at={(0, 0): 'g'})
    t.gap(2)
    t.go(2)
    t.gate(3)
    t.go(1)
    t.down(2)
    t.go(3, ch='f')
    return t


def glacier_run():
    t = Track(2, 2, 'E', width=5, level=26)
    t.go(5, ch='i')
    t.mark(-5, 0, 's')
    t.go(4, ch='i')
    t.down(3, ch=None)
    t.go(4, ch='i')
    t.go(1, ch='j', width=5)
    t.gap(2)   # crevasse
    t.go(3, ch='i', stop=(0, 'k'))
    t.turn('S')
    t.go(1, ch='i')
    t.gate(2)
    t.go(1, ch='i')
    t.down(3)
    t.go(3, ch='i')
    t.go(2, ch='c')
    t.go(2, ch='i')
    t.go(1, ch='j', width=5)
    t.gap(2)
    t.go(3, ch='i')
    t.turn('E')
    t.go(3, ch='i', stop=(1, 'h'))
    t.down(2)
    t.go(1, ch='m')
    t.gate(3)
    t.go(2, ch='m')   # gravel and mud at the bottom
    t.gems(0)
    t.down(2)
    t.go(3, ch='m')
    t.gems(0)
    t.go(3, ch='m', at={(1, 1): 'b'})
    t.gems(0)
    t.go(2, ch='f')
    return t


def windy_welly():
    t = Track(2, 2, 'E', width=4, level=18)
    t.go(5)
    t.mark(-5, 0, 's')
    t.go(2, ch='e')           # the wharf: conveyor belts
    t.go(4, ch='e')
    t.go(1)
    t.gate(2)
    t.go(1)
    t.go(1, ch='q')           # a crane arm sweeps across
    t.go(3)
    t.gems(0)
    t.down(2)
    t.go(2, ch='c')
    t.go(2)
    t.turn('S')
    t.go(2, ch='o')
    t.go(5, ch='o')
    t.go(2, stop=(0, 'k'))
    t.go(1, ch='q')
    t.go(3)
    t.gems(0)
    t.down(3)
    t.go(2)
    t.turn('W')
    t.go(4, ch='w')           # a belt that carries you backwards: push hard
    t.go(1)
    t.gate(2)
    t.go(1)
    t.go(1, ch='q')
    t.go(3)
    t.gems(1)
    t.down(2)
    t.go(2, ch='c')
    t.go(2)
    t.turn('S')
    t.go(3)
    t.go(1, ch='q')
    t.go(5, ch='o', stop=(2, 'h'))
    t.turn('E')
    t.go(1)
    t.gate(2)
    t.go(1)
    t.down(2)
    t.go(3, ch='f')
    return t


def alpine_crossing():
    t = Track(2, 2, 'E', width=3, level=30)
    t.go(5)
    t.mark(-5, 0, 's')
    t.go(6, rails=False)
    t.gems(0)
    # the Devil's Staircase: steps down
    for _ in range(4):
        t.down(1, rails=False)
        t.go(2, rails=False)
    t.go(2, ch='c', rails=False)
    t.go(1, rails=False)
    t.gate(2, rails=False)
    t.go(1, rails=False)
    t.go(1, ch='t', rails=False)       # crumbling scoria
    t.go(2, rails=False, stop=(0, 'k'))
    t.go(1, ch='t', rails=False)
    t.go(2, rails=False)
    t.gems(0)
    t.go(1, rails=False)
    t.turn('S', rails=False)
    t.go(1, rails=False)
    t.gate(3, rails=False)
    t.go(2, rails=False)
    t.down(2, rails=False)
    t.go(2, rails=False)
    t.go(1, ch='t', rails=False)
    t.go(2, ch='c', rails=False)
    t.go(2, rails=False)
    t.turn('E', rails=False)
    t.go(4, rails=False)
    t.gems(1)
    t.go(1, rails=False)
    for _ in range(3):
        t.down(1, rails=False)
        t.go(2, rails=False)
    t.go(1, ch='t', rails=False)
    t.go(3, rails=False, stop=(1, 'h'))
    t.gems(1)
    t.down(2, rails=False)
    t.go(1, width=5)
    t.gate(2)                     # the Emerald Lakes
    t.go(2, ch='f', width=5)
    return t


def wide_hill():
    """Practice 1 (James, 20 Oct 2026: the first practice tracks were too short and had no maths). Wide, railed and gentle."""
    t = Track(2, 2, 'E', width=5, level=20)
    t.go(5)
    t.mark(-5, 0, 's')
    t.go(4)
    t.down(2)
    t.go(3, ch='m')    # a mud patch
    t.go(6, stop=(1, 'k'))
    t.turn('S')
    t.go(2)
    t.down(2)
    t.go(2, ch='c')
    t.go(4)
    t.turn('E')
    t.go(1)
    t.gate(2)
    t.go(2)
    t.down(2)
    t.go(4)
    t.turn('S')
    t.go(2)
    t.down(2)
    t.go(3, at={(1, 0): 'b'}, stop=(0, 'h'))
    t.turn('W')
    t.go(6)
    t.down(1)
    t.go(2, ch='f')
    return t


def gap_and_ice():
    """Practice 2: a jump pad over a small gap, an icy stretch and a bumper, all railed."""
    t = Track(2, 2, 'E', width=5, level=22)
    t.go(5)
    t.mark(-5, 0, 's')
    t.go(3)
    t.down(2)
    t.go(3)
    t.go(1, ch='j', width=5)
    t.gap(2)
    t.go(4, stop=(1, 'k'))
    t.turn('S')
    t.go(1)
    t.gate(2)
    t.go(1)
    t.down(2)
    t.go(2, ch='c')
    t.go(5, ch='i')    # ice
    t.go(3)
    t.turn('E')
    t.go(4, at={(2, 0): 'b'})
    t.go(3, stop=(1, 'h'))
    t.down(2)
    t.go(3)
    t.turn('S')
    t.go(5)
    t.down(1)
    t.go(2, ch='f')
    return t


# id, name, builder, medals (seconds), hard-mode seconds, wind
COURSES = [
    ('boulder-beach', 'Boulder Beach', boulder_beach, (0, 0, 0), 0, None),
    ('crown-range', 'Crown Range Zig-Zag', crown_range, (0, 0, 0), 0, None),
    ('geyser-valley', 'Geyser Valley', geyser_valley, (0, 0, 0), 0, None),
    ('glacier-run', 'Glacier Run', glacier_run, (0, 0, 0), 0, None),
    ('windy-welly', 'Windy Welly', windy_welly, (0, 0, 0), 0, (0, 1, 360, 70, 40, 8)),
    ('alpine-crossing', 'Alpine Crossing', alpine_crossing, (0, 0, 0), 0, (1, 0, 420, 80, 40, 6)),
    ('wide-hill', 'Wide Hill', wide_hill, (0, 0, 0), 0, None),
    ('gap-and-ice', 'Gap and Ice', gap_and_ice, (0, 0, 0), 0, None),
]


def medals_for(cid):
    try:
        import json
        return json.load(open('scripts/marble-medals.json'))[cid]
    except Exception:
        return None


def main():
    out = ["/**", " * The six New Zealand courses (docs/MARBLE-PLAN.md, section 3), as frozen literals.", " * Drawn by scripts/marble-courses.py; edit the script and run it again rather than editing these by hand.", " * Medal times come from scripts/marble-medals.json (set from each course's reference run).", " */", "import type { CourseDef } from './course';", ""]
    names = []
    for cid, name, builder, _m, _h, wind in COURSES:
        trk = builder()
        rows, hts, route, gates, trails = render(trk)
        med = medals_for(cid) or {'gold': 60, 'silver': 90, 'bronze': 140, 'hard': 120}
        const = ''.join(w.capitalize() for w in cid.split('-'))
        const = 'NZ_' + cid.upper().replace('-', '_')
        names.append(const)
        out.append(f"export const {const}: CourseDef = {{")
        out.append(f"  id: '{cid}',")
        out.append(f"  name: '{name}',")
        out.append("  rows: [")
        for r in rows:
            out.append(f"    '{r}',")
        out.append("  ],")
        out.append("  heights: [")
        for h in hts:
            out.append(f"    '{h}',")
        out.append("  ],")
        out.append("  route: [" + ', '.join(f"[{a}, {b}]" for a, b in route) + "],")
        gm = f", goldMaths: {med['goldMaths']}" if 'goldMaths' in med else ''
        out.append(f"  medals: {{ gold: {med['gold']}, silver: {med['silver']}, bronze: {med['bronze']}{gm} }},")
        out.append(f"  hardSeconds: {med['hard']},")
        if gates:
            out.append("  gates: [")
            for g in gates:
                out.append(f"    {{ sign: [{g['sign'][0]}, {g['sign'][1]}], after: {g['after']}, tunnels: [")
                for t in g['tunnels']:
                    cells = ', '.join(f"[{a}, {b}]" for a, b in t['cells'])
                    rt = ', '.join(f"[{a}, {b}]" for a, b in t['route'])
                    dd = ', '.join(f"[{a}, {b}]" for a, b in t['dead'])
                    out.append(f"      {{ door: {t['door']}, cells: [{cells}], route: [{rt}], dead: [{dd}] }},")
                out.append("    ] },")
            out.append("  ],")
        if trails:
            out.append("  gems: [")
            for tr in trails:
                out.append(f"    {{ sign: [{tr['sign'][0]}, {tr['sign'][1]}], groups: [")
                for g in tr['groups']:
                    spots = ', '.join(f"[{a}, {b}]" for a, b in g['spots'])
                    out.append(f"      {{ after: {g['after']}, spots: [{spots}] }},")
                out.append("    ] },")
            out.append("  ],")
        if wind:
            dx, dy, period, on, warn, force = wind
            out.append(f"  wind: {{ dx: {dx}, dy: {dy}, period: {period}, on: {on}, warn: {warn}, force: {force} }},")
        out.append("};")
        out.append("")
    out.append("export const NZ_COURSE_DEFS: readonly CourseDef[] = [" + ', '.join(names) + "];")
    open('shared/marble/nzCourses.ts', 'w').write('\n'.join(out) + '\n')
    print('wrote shared/marble/nzCourses.ts')


if __name__ == '__main__':
    main()
