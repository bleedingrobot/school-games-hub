/**
 * Everything Class Live says on the projector, read by Bella (af_bella) like every game. No pupils' names (names are
 * shown, never spoken). iPads stay silent. Clips go in public/voice/classlive/, made with scripts/voice-clips.py classlive.
 *
 * Each moment has a few takes, said in turn (`next`), so nothing is said the same way twice running (James, 24 Nov 2026:
 * more variety in the sounds).
 */
export const VOICE_FOLDER = 'voice/classlive/';

export const LINES = {
  joinNow: ['Join Class Live now!', 'Come and join in, everyone!', 'Grab your device and join the game!'],
  startStars: ['Here we go! If we know this fact, what else do we know?', 'Star Web is on! How many facts can we find from this one?', 'Off we go! Use this fact to find lots more.'],
  startSerpent: ['Here we go! Work along the chain and wake the serpent!', 'The serpent is sleeping. Work along the chain to wake it!', 'Off we go! Climb the serpent one sum at a time.'],
  startMural: ['Here we go! Answer questions to flip the tiles!', 'A mystery picture is hiding. Answer questions to flip the tiles!', 'Off we go! Every right answer flips a tile.'],
  armLit: ['An arm of the star web is lit!', 'Another arm lights up!', 'Look, a new arm is glowing!'],
  creature: ['Look! The sky creature is here!', 'Every arm is lit! Here comes the sky creature!', 'Wow! The sky creature has arrived!'],
  supernova: ['Supernova! What a lot of facts!', 'Supernova! The whole sky is shining!', 'Boom! A supernova of facts!'],
  awake: ['The serpent is waking up!', 'Wake up, serpent! It is opening its eyes!', 'Rumble! The serpent is awake!'],
  head: ['Someone reached the head of the serpent!', 'We made it to the head of the serpent!', 'All the way to the head! Brilliant!'],
  guessOpen: ['Guessing is open! What could it be?', 'You can guess now! What is the picture?', 'Time to guess! What do you think it is?'],
  guessed: ['Someone has guessed the picture!', 'A good guess! Someone got it!', 'We have a right guess!'],
  reveal: ["Here's the picture!", 'Ta-da! Here it is!', "Let's see the whole picture!"],
  timeUp: ["Time's up! Well done, everyone!", "That's time! Great work, everyone!", "Time's up! What a team!"],
  finished: ['Well done, everyone!', 'Great work, everyone!', 'What a team! Well done!'],
} as const;

export type LineKey = keyof typeof LINES;

const turn: Partial<Record<LineKey, number>> = {};
/** The next take of a line, in turn (the first take first). */
export function next(key: LineKey): string {
  const takes = LINES[key];
  const n = turn[key] ?? 0;
  turn[key] = n + 1;
  return takes[n % takes.length];
}

export const allVoiceLines = (): string[] => Object.values(LINES).flat();
