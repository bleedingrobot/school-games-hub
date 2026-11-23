/**
 * Everything the Class Showdown announcer says on the projector (docs/SHOWDOWN-PLAN.md, section 7).
 * iPads stay silent. Every line is read by Bella (Kokoro af_bella, like every game): the clips are in public/voice/showdown/,
 * made with scripts/voice-clips.py showdown; voiceLines.test.ts checks every line has one.
 */
import { BOSSES } from '../../../shared/showdown/bosses';
export const VOICE_FOLDER = 'voice/showdown/';

export const ANNOUNCER = {
  joinNow: 'Join now!',
  fight: 'Three, two, one, fight!',
  windUp: 'The boss is winding up! Shield up!',
  held: 'Shield held!',
  broke: 'The shield broke!',
  weakSpot: 'Weak spot!',
  golden: 'Golden question!',
  phase: 'The boss is changing!',
  thirty: 'Thirty seconds!',
  beaten: 'The boss is beaten!',
  timeUp: "Time's up!",
  soClose: 'So close!',
} as const;

/** Gold Rush says these in place of the boss lines. */
export const GOLD_RUSH_LINES = {
  joinNow: 'Grab your pickaxe! Join now!',
  start: 'Dig, dig, dig!',
  caveIn: 'Cave-in! Prop up the roof!',
  held: 'The roof holds!',
  broke: 'Cave-in!',
  lode: 'Mother lode! Double gold!',
  phase: 'The mountain rumbles!',
  done: 'You dug it all out!',
} as const;

export const allVoiceLines = (): string[] => [...Object.values(ANNOUNCER), ...Object.values(GOLD_RUSH_LINES), ...BOSSES.map((b) => b.roar)];
