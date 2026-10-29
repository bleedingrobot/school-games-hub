import { describe, expect, it } from 'vitest';
import { courseAccent, courseArt, courseGradient } from './courseArt';

describe('courseArt', () => {
  it('has Boulder Beach pictures', () => {
    const art = courseArt('boulder-beach');
    expect(art?.card).toBeTruthy();
    expect(art?.small).toBeTruthy();
  });
  it('gives null for a course with no picture, and never for inherited names', () => {
    expect(courseArt('no-such-course')).toBeNull();
    expect(courseArt('toString')).toBeNull();
  });
  it('makes a gradient and an accent colour from the palette', () => {
    expect(courseGradient('glacier-run')).toMatch(/^linear-gradient\(.*#[0-9a-f]{6}.*#[0-9a-f]{6}/);
    expect(courseAccent('glacier-run')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
