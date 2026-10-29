import { describe, expect, it } from 'vitest';
import { COURSES } from '../../../shared/marble/courses';
import { lookFor } from './look';

describe('lookFor', () => {
  it('gives every real course the diorama look and a painted backdrop', () => {
    const real = COURSES.filter((c) => !!lookFor(c.def.id).backdrop || lookFor(c.def.id).diorama);
    expect(real.map((c) => c.def.id)).toEqual(expect.arrayContaining(['boulder-beach', 'crown-range', 'geyser-valley', 'glacier-run', 'windy-welly', 'alpine-crossing', 'wide-hill', 'gap-and-ice']));
    for (const c of real) {
      const look = lookFor(c.def.id);
      expect(look.diorama).toBe(true);
      expect(look.topPattern).not.toBe('none');
      expect(look.backdrop?.full).toBeTruthy();
      expect(look.backdrop?.small).toBeTruthy();
    }
    expect(lookFor('nope').diorama).toBe(false);
  });

  it('keeps Boulder Beach as it was', () => {
    const l = lookFor('boulder-beach');
    expect(l).toMatchObject({ topPattern: 'sand', wall: { base: 'planks', top: 'log', post: 'round' }, skyTop: 0x7fc4ec, skyBottom: 0xfdf0d5, sunColour: 0xffe2b0 });
    expect(l.ground).toBeUndefined();
    expect(l.wall.tint).toBeUndefined();
    expect(l.wall.snowy).toBeUndefined();
  });
});
