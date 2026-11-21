import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { speak, stopSpeaking, useReadAloud } from './speech';

describe('useReadAloud default', () => {
  beforeEach(() => localStorage.clear());

  it('is off unless a game asks for on; a saved choice always wins; blocked sound waits for a tap', async () => {
    expect(renderHook(() => useReadAloud()).result.current.on).toBe(false);
    expect(renderHook(() => useReadAloud({ defaultOn: true })).result.current.on).toBe(true);
    localStorage.setItem('sgh-read-aloud', 'false');
    expect(renderHook(() => useReadAloud({ defaultOn: true })).result.current.on).toBe(false);
    localStorage.setItem('sgh-read-aloud', 'true');
    expect(renderHook(() => useReadAloud()).result.current.on).toBe(true);

    // When the browser blocks sound (a story that opens by itself), the clip plays on the first tap instead of going quiet.
    const plays: string[] = [];
    let blocked = true;
    class FakeAudio extends EventTarget {
      constructor(public src: string) {
        super();
      }
      play() {
        plays.push(this.src);
        if (blocked) return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
        return Promise.resolve();
      }
      pause() {}
    }
    const real = globalThis.Audio;
    globalThis.Audio = FakeAudio as unknown as typeof Audio;
    try {
      speak('Hello there.', 'voice/test/');
      await Promise.resolve();
      await Promise.resolve();
      expect(plays).toEqual(['voice/test/hello-there.mp3']);
      blocked = false;
      window.dispatchEvent(new Event('pointerdown'));
      expect(plays).toEqual(['voice/test/hello-there.mp3', 'voice/test/hello-there.mp3']);
      // Only once: a second tap doesn't say it again.
      window.dispatchEvent(new Event('pointerdown'));
      expect(plays).toHaveLength(2);
    } finally {
      stopSpeaking();
      globalThis.Audio = real;
    }
  });
});
