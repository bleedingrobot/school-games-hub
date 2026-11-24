import { describe, expect, it } from 'vitest';
import { speak, spokenLabel, spokenNotation } from './banded';

describe('Year 7-8 notation read aloud', () => {
  it('reads powers, roots, degrees and units', () => {
    expect(spokenNotation('10⁴')).toBe('10 to the power of 4');
    expect(spokenNotation('5²')).toBe('5 squared');
    expect(spokenNotation('2³')).toBe('2 cubed');
    expect(spokenNotation('10⁻²')).toBe('10 to the power of negative 2');
    expect(spokenNotation('√81')).toBe('the square root of 81');
    expect(spokenNotation('∛64')).toBe('the cube root of 64');
    expect(spokenNotation('?°')).toBe('? degrees');
    expect(spokenNotation('? cm²')).toBe('? square centimetres');
    expect(spokenNotation('2² × 3²')).toBe('2 squared × 3 squared');
  });
  it('leaves plain parts alone and works in a whole question', () => {
    expect(spokenLabel('3/4')).toBe(spokenLabel('3/4'));
    expect(speak(['10³', '=', '?'])).toBe('10 cubed equals what?');
  });
});
