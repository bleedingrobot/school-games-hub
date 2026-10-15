/**
 * Tiny move and capture sounds, made in the browser (no sound files to download).
 * Only played when the student has switched sound on with the mute button.
 */
let context: AudioContext | null = null;

/** One note that slides from `frequency` to `frequency * slide` (0.6 is a gentle drop). */
function tone(frequency: number, duration: number, volume: number, type: OscillatorType, slide = 0.6) {
  try {
    context ??= new AudioContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * slide, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // No sound available on this device. That's fine.
  }
}

/**
 * 'alert' is check in chess, and a new king in checkers. 'dice' to 'cosmic' are for
 * Wormholes & Black Holes; 'flick', 'tap' and 'knock' are for 101.
 */
export type GameSound =
  | 'move'
  | 'capture'
  | 'alert'
  | 'win'
  | 'end'
  | 'dice'
  | 'hop'
  | 'wormhole'
  | 'black-hole'
  | 'item'
  | 'zap'
  | 'shield'
  | 'cosmic'
  | 'flick'
  | 'tap'
  | 'knock';

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
    case 'dice':
      // A quick rattle: four short clicks.
      [0, 50, 105, 165].forEach((ms, i) => setTimeout(() => tone(300 + i * 60, 0.04, 0.12, 'square', 0.9), ms));
      return;
    case 'hop':
      return tone(660, 0.05, 0.07, 'triangle', 1.3);
    case 'wormhole':
      // Up and away.
      return tone(260, 0.55, 0.16, 'sine', 4);
    case 'black-hole':
      // Down the drain.
      return tone(520, 0.7, 0.18, 'sawtooth', 0.2);
    case 'item':
      [880, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.12, 0.12, 'triangle', 1), i * 70));
      return;
    case 'zap':
      return tone(1200, 0.18, 0.12, 'square', 0.3);
    case 'shield':
      tone(440, 0.3, 0.14, 'sine', 1.5);
      return setTimeout(() => tone(660, 0.25, 0.12, 'sine', 1.5), 90);
    case 'cosmic':
      [392, 523, 659].forEach((f, i) => setTimeout(() => tone(f, 0.35, 0.12, 'sine', 1.02), i * 140));
      return;
    case 'flick':
      // A card slid off a pile.
      return tone(900, 0.06, 0.08, 'triangle', 1.6);
    case 'tap':
      // A card put down.
      return tone(330, 0.07, 0.14, 'triangle', 0.7);
    case 'knock':
      // Knock knock.
      tone(180, 0.09, 0.3, 'square', 0.5);
      return setTimeout(() => tone(180, 0.09, 0.3, 'square', 0.5), 170);
  }
}
