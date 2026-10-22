import { describe, expect, it } from 'vitest';
import { makeLevel, RECIPES } from '../../../shared/mine/level';
import { USE_RANGE } from '../../../shared/mine/config';
import { doorAxis, layoutGate, PANEL_ARM, PANEL_TOUCH, panelTouched } from './gate';

const level = makeLevel(RECIPES[1]);
const door = level.doors.find((d) => d.gate)!;

describe('gate panels', () => {
  it('floats one panel per choice in front of the door, on the ship’s side, all within reach of a GRANT', () => {
    const axis = doorAxis(level, door);
    const ship = { px: door.x, py: door.y, pz: door.z };
    ship[(['px', 'py', 'pz'] as const)[axis]] -= 4;
    const layout = layoutGate(level, door, ship, [12, 13, 14, 15]);
    expect(layout.side).toBe(-1);
    expect(layout.panels.map((p) => p.value)).toEqual([12, 13, 14, 15]);
    const positions = new Set(layout.panels.map((p) => `${p.x},${p.y},${p.z}`));
    expect(positions.size).toBe(4);
    for (const p of layout.panels) {
      expect(Math.sqrt((p.x - door.x) ** 2 + (p.y - door.y) ** 2 + (p.z - door.z) ** 2)).toBeLessThan(USE_RANGE - 1);
      expect([p.x, p.y, p.z][axis] - [door.x, door.y, door.z][axis]).toBeLessThan(0); // on the ship’s side
    }
    // The other side when the ship is on the other side.
    const other = layoutGate(level, door, { px: door.x + (axis === 0 ? 4 : 0), py: door.y + (axis === 1 ? 4 : 0), pz: door.z + (axis === 2 ? 4 : 0) }, [1, 2, 3]);
    expect(other.side).toBe(1);
    expect(other.panels).toHaveLength(3);
  });

  it('keeps the panels apart so a ship in a five-block tunnel cannot touch two at once', () => {
    const layout = layoutGate(level, door, { px: door.x - 3, py: door.y, pz: door.z }, [1, 2, 3, 4]);
    for (const a of layout.panels) for (const b of layout.panels) if (a !== b) {
      expect(Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)).toBeGreaterThan(PANEL_TOUCH * 2);
    }
  });

  it('only counts a touch once the ship has been clear of that panel', () => {
    const layout = layoutGate(level, door, { px: door.x, py: door.y, pz: door.z - 4 }, [1, 2, 3, 4], 1);
    const armed = layout.panels.map(() => false);
    const onFirst = { px: layout.panels[0].x, py: layout.panels[0].y, pz: layout.panels[0].z };
    // Sitting on a panel the moment the gate appears does nothing.
    expect(panelTouched(layout.panels, armed, onFirst)).toBe(-1);
    // Move clear of everything, then touch the second panel.
    const p1 = layout.panels[1];
    const clear = { px: p1.x + PANEL_ARM + 3, py: p1.y, pz: p1.z };
    expect(panelTouched(layout.panels, armed, clear)).toBe(-1);
    expect(armed.every(Boolean)).toBe(true);
    expect(panelTouched(layout.panels, armed, { px: p1.x, py: p1.y, pz: p1.z })).toBe(1);
  });
});
