/**
 * Sky Dash Christmas (a pupil's idea, 26 Nov 2026: "Sky Dash is now like a rhythm dash, but Christmas edition"). In
 * December and January Sky Dash plays in Christmas Coast's look, and every wall you pass rings the next note of a jingly
 * tune with a beat, and the screen pulses on it, so a good dash plays the whole tune. Looks and sound only: the course,
 * the physics and the server's replay are exactly Sky Dash's.
 */
import { SEASONAL_LEVELS, inSeason } from '../../../shared/toonflap/levels';

/** Is it Sky Dash Christmas time (Christmas Coast's months) on NZ day `today`? */
export const christmasDash = (today: string): boolean => SEASONAL_LEVELS.some((l) => l.id === 'xmas' && inSeason(l, today));

/** Our own little tune (semitones above C5), one note a wall; it loops. */
const TUNE = [4, 7, 12, 7, 9, 7, 4, 0, 2, 4, 7, 4, 2, 0, 2, 7, 4, 7, 12, 14, 12, 9, 7, 4, 5, 4, 2, 4, 0, 2, 0, -5];

let context: AudioContext | null = null;

function note(semi: number, at: number, len: number, volume: number, type: OscillatorType) {
  if (!context) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(523.25 * Math.pow(2, semi / 12), at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(gain).connect(context.destination);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

/** Sleigh-bell shake: a short burst of bright noise. */
function bells(at: number, volume: number) {
  if (!context) return;
  const len = 0.12;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * len), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = context.createBufferSource();
  src.buffer = buffer;
  const hp = context.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const gain = context.createGain();
  gain.gain.value = volume;
  src.connect(hp).connect(gain).connect(context.destination);
  src.start(at);
}

/** The beat for wall number `wall` (1, 2, …): a bell note of the tune, a low thump and sleigh bells. */
export function playBeat(wall: number): void {
  try {
    context ??= new AudioContext();
    const now = context.currentTime;
    const semi = TUNE[(wall - 1) % TUNE.length];
    note(semi, now, 0.5, 0.16, 'sine');
    note(semi + 12, now, 0.25, 0.05, 'triangle');
    note(-24, now, 0.18, 0.22, 'sine');
    bells(now, 0.08);
    bells(now + 0.15, 0.05);
  } catch {
    // No sound on this device. That's fine.
  }
}
