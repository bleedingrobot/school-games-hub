import { expect, it } from 'vitest';
import { MAX_PODS, POD_HOLDS, SHIPS } from '../../../shared/trader/config';
import { fillHold, holdBoxes, holdViewBox, podPlaces, POD, SHIP_HOLDS } from './holdLayout';

it('gives every ship one box per hold inside its painting, pods clamped above and below, and shows a planned trade', () => {
  expect(SHIP_HOLDS).toHaveLength(SHIPS.length);
  SHIPS.forEach((ship, i) => {
    const s = SHIP_HOLDS[i];
    expect(s.cols * s.rows, ship.name).toBeGreaterThanOrEqual(ship.holds);
    expect(s.deck[0] >= 0 && s.deck[2] <= s.w && s.deck[3] <= s.h, ship.name).toBe(true);
    for (let pods = 0; pods <= MAX_PODS; pods++) {
      const boxes = holdBoxes(i, pods);
      expect(boxes).toHaveLength(ship.holds + pods * POD_HOLDS);
      const [x, y, w, h] = holdViewBox(i, pods);
      for (const b of boxes) expect(b.x >= x && b.y >= y && b.x + b.w <= x + w && b.y + b.h <= y + h, `${ship.name} ${pods} pods`).toBe(true);
    }
    const [above, below] = podPlaces(i, 2);
    expect(above.y + POD.body[1] * above.scale).toBeLessThan(s.hull[0]);
    expect(below.y + POD.body[0] * below.scale).toBeGreaterThan(s.hull[1]);
  });

  // Goods fill in order, each good's boxes numbered; a planned sale fades, a planned buy shows faintly; when selling
  // makes the room for buying, only what you'll have after the trade is shown.
  const cargo = [2, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  const short = (f: ReturnType<typeof fillHold>) => f.map((x) => `${x.good}${x.kind[0]}${x.n}`);
  expect(short(fillHold(cargo, 10))).toEqual(['0h0', '0h1', '3h0']);
  expect(short(fillHold(cargo, 10, [1, 0, 0, 1, 0, 0, 0, 0, 0, 2]))).toEqual(['0h0', '0s1', '3h0', '9b0', '9b1']);
  expect(short(fillHold(cargo, 3, [0, 0, 0, 1, 0, 0, 0, 0, 0, 2]))).toEqual(['3h0', '9b0', '9b1']);
});
