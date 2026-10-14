/**
 * Tiny move and capture sounds, made in the browser (no sound files to download).
 * Only played when the student has switched sound on with the mute button.
 */
let context: AudioContext | null = null;

function tone(frequency: number, duration: number, volume: number, type: OscillatorType) {
  try {
    context ??= new AudioContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.6, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // No sound available on this device. That's fine.
  }
}

/** 'alert' is check in chess, and a new king in checkers. */
export type GameSound = 'move' | 'capture' | 'alert' | 'win' | 'end';

export function playSound(sound: GameSound) {
  switch (sound) {
    case 'move':
      return tone(520, 0.08, 0.15, 'triangle');
    case 'capture':
      return tone(240, 0.16, 0.25, 'square');
    case 'alert':
      tone(700, 0.1, 0.15, 'triangle');
      return setTimeout(() => tone(900, 0.12, 0.15, 'triangle'), 110);
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 0.18, 'triangle'), i * 120));
      return;
    case 'end':
      return tone(330, 0.3, 0.18, 'sine');
  }
}
