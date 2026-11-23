/**
 * Everything Class Live says on the projector, read by Bella (af_bella) like every game. No pupils' names (names are
 * shown, never spoken). iPads stay silent. Clips go in public/voice/classlive/, made with scripts/voice-clips.py classlive.
 */
export const VOICE_FOLDER = 'voice/classlive/';

export const LINES = {
  joinNow: 'Join Class Live now!',
  startStars: 'Here we go! If we know this fact, what else do we know?',
  startSerpent: 'Here we go! Work along the chain and wake the serpent!',
  startMural: 'Here we go! Answer questions to flip the tiles!',
  armLit: 'An arm of the star web is lit!',
  creature: 'Look! The sky creature is here!',
  supernova: 'Supernova! What a lot of facts!',
  awake: 'The serpent is waking up!',
  head: 'Someone reached the head of the serpent!',
  guessOpen: 'Guessing is open! What could it be?',
  guessed: 'Someone has guessed the picture!',
  reveal: "Here's the picture!",
  timeUp: "Time's up! Well done, everyone!",
  finished: 'Well done, everyone!',
} as const;

export const allVoiceLines = (): string[] => Object.values(LINES);
