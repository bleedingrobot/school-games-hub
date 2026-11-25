/**
 * Floor is Lava's Bella lines (docs/LAVA-PLAN.md), kept apart from voiceLines.ts so the Class Live games built side by
 * side don't edit the same lines. Spoken through the same folder (voice/classlive/); allVoiceLines() lists them too.
 */
import type { LavaMap, Pattern } from '../../../shared/classlive/lava';

export const LAVA_LINES = {
  startLava: ['Here we go! The floor is lava! Watch for the glowing tiles!', 'Floor is Lava is on! Stay off the glowing tiles!', 'Off we go! When a tile glows, get off it!'],
  lavaRun: ['Find a safe tile!', 'Off the glowing tiles, quick!', 'Move, move! Find solid rock!'],
  lavaHurry: ['Three seconds! Get off the glow!', 'Hurry! The floor is about to crack!', 'Quick, the tiles are going to break!'],
  lavaCrack: ['Crack! There goes the floor!', 'Rumble, crack, splash!', 'Down they go into the lava!'],
  lavaNobody: ['Everyone is safe! Brilliant footwork!', 'Nobody fell in! Amazing!', 'Not one splash! Well done!'],
  lavaLots: ['Splash! Lots of you are on the lava raft!', 'Oh no! A big splash into the lava!', 'So many on the raft! Answer to climb back!'],
  lavaBoots: ['Fire boots saved someone!', 'Those fire boots work! Safe on the lava!', 'Lava walker! Fire boots to the rescue!'],
  lavaClimb: ['Back on the floor!', 'Someone climbed off the raft!', 'Welcome back to the floor!'],
  lavaBuild: ['A new bridge!', 'Somebody built a bridge!', 'Brick by brick!'],
  lavaRescue: ['What a rescue!', 'Saved from the raft by a friend!', 'A kind rescue!'],
  lavaLate: ['Watch out! More tiles are glowing!', 'Aftershock! New tiles are glowing!', 'Look! The glow is spreading!'],
  pattern_patches: ['Glowing patches! Find the solid rock!'],
  pattern_rows: ['Stripes! Every other line is going to crack!'],
  pattern_checker: ['A checkerboard! Jump to the right squares!'],
  pattern_ring: ['Rings! A whole ring of the floor is glowing!'],
  pattern_cross: ['A giant cross is glowing! Get out of the middle lines!'],
  pattern_islands: ['Islands! Only a few small islands will stay up!'],
  pattern_wave: ['A wave of glow is sweeping across! Get out of its way!'],
  lava_items: ['Power-ups have appeared! Grab one, then answer a question to switch it on.'],
  lava_bubbles: ['Bubbles! They slow you down, so go round them.'],
  lava_crust: ['Slippery patches! You slide when you step on them.'],
  lava_fireball: ['A rolling fireball! It will knock you flying, maybe into the lava!'],
  lava_late: ['Watch out! Now some tiles start glowing late, near the end of the countdown.'],
} as const;

export type LavaLineKey = keyof typeof LAVA_LINES;

export const LAVA_HOWTO = [
  'Move your avatar with the joystick, or the arrow keys.',
  'When tiles glow, get off them! When the countdown ends, they crack and sink into the lava.',
  'Fall in, and you go on the lava raft. Wait for a friend to rescue you, or answer five questions to climb back.',
  'Answer questions to earn bricks. Use a brick to build a bridge over the lava, or two bricks to rescue a friend.',
  'Grab power-ups, then answer a question to switch them on. Stay up the most rounds to win!',
];

/** Each map's own welcome (for How to play). */
export const LAVA_MAP_SAY: Record<LavaMap, string> = {
  volcano: 'Today we are on Volcano Island.',
  dragon: "Today we are in the Dragon's Lair.",
  forge: 'Today we are in the Lava Forge.',
  planet: 'Today we are on the Lava Planet.',
};

const turn: Partial<Record<LavaLineKey, number>> = {};
/** The next take of a line, in turn. */
export function lavaLine(key: LavaLineKey): string {
  const takes = LAVA_LINES[key];
  const n = turn[key] ?? 0;
  turn[key] = n + 1;
  return takes[n % takes.length];
}
export const patternLine = (p: Pattern) => lavaLine(`pattern_${p}` as LavaLineKey);

export const allLavaLines = (): string[] => [...Object.values(LAVA_LINES).flat(), ...LAVA_HOWTO, ...Object.values(LAVA_MAP_SAY)];
