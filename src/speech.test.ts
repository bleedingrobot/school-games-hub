import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useReadAloud } from './speech';

describe('useReadAloud default', () => {
  beforeEach(() => localStorage.clear());

  it('is off unless a game asks for on; a saved choice always wins', () => {
    expect(renderHook(() => useReadAloud()).result.current.on).toBe(false);
    expect(renderHook(() => useReadAloud({ defaultOn: true })).result.current.on).toBe(true);
    localStorage.setItem('sgh-read-aloud', 'false');
    expect(renderHook(() => useReadAloud({ defaultOn: true })).result.current.on).toBe(false);
    localStorage.setItem('sgh-read-aloud', 'true');
    expect(renderHook(() => useReadAloud()).result.current.on).toBe(true);
  });
});
