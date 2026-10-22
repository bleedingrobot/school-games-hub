import { describe, expect, it } from 'vitest';
import { dragVector, KeyTracker, screenToCode } from './controls';

describe('screenToCode', () => {
  it('turns the screen round to the grid', () => {
    expect(screenToCode(0, 1)).toBe(8); // up the screen = north-west on the grid
    expect(screenToCode(1, 0)).toBe(2); // right = north-east
    expect(screenToCode(0, -1)).toBe(4); // down = south-east
    expect(screenToCode(-1, 0)).toBe(6); // left = south-west
  });
  it('diagonals on the screen are straight along the grid', () => {
    expect(screenToCode(1, 1)).toBe(1); // up+right = north
    expect(screenToCode(1, -1)).toBe(3); // right+down = east
    expect(screenToCode(-1, -1)).toBe(5); // down+left = south
    expect(screenToCode(-1, 1)).toBe(7); // left+up = west
  });
  it('no push is no input', () => {
    expect(screenToCode(0, 0)).toBe(0);
  });
});

describe('KeyTracker', () => {
  it('combines keys, cancels opposites and ignores other keys', () => {
    const k = new KeyTracker();
    expect(k.press('KeyQ')).toBe(false);
    expect(k.press('ArrowUp')).toBe(true);
    expect(k.vector()).toEqual([0, 1]);
    k.press('KeyD');
    expect(k.vector()).toEqual([1, 1]);
    k.press('ArrowDown');
    expect(k.vector()).toEqual([1, 0]);
    k.release('ArrowDown');
    k.release('ArrowUp');
    k.release('KeyD');
    expect(k.any).toBe(false);
    k.press('KeyA');
    k.clear();
    expect(k.vector()).toEqual([0, 0]);
  });
});

describe('dragVector', () => {
  it('has a dead zone and flips y', () => {
    expect(dragVector(3, 3, 14)).toBeNull();
    expect(dragVector(0, -30, 14)).toEqual([0, 30]);
  });
});
