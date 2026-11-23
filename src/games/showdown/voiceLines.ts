/**
 * Everything the Class Showdown announcer says on the projector (docs/SHOWDOWN-PLAN.md, section 7).
 * iPads stay silent. Clips go in public/voice/showdown/, made with scripts/voice-clips.py showdown.
 * TODO: the voice-lines test comes with the clips via scripts/voice-clips.py showdown (clips aren't recorded yet).
 */
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

export const allVoiceLines = (): string[] => Object.values(ANNOUNCER);
