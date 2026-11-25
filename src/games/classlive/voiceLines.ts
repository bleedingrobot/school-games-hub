/**
 * Everything Class Live says on the projector, read by Bella (af_bella) like every game. No pupils' names (names are
 * shown, never spoken). iPads stay silent. Clips go in public/voice/classlive/, made with scripts/voice-clips.py classlive.
 *
 * Each moment has a few takes, said in turn (`next`), so nothing is said the same way twice running (James, 24 Nov 2026:
 * more variety in the sounds).
 */
import { CLASH_HOWTO, CLASH_LINES } from './clashVoice';

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
  guessTime: ["Time's up! Now read the six riddles and pick the one that fits the picture.", 'Pens down! Which riddle fits the picture? Pick one on your device.', "Time to guess! Read the riddles and choose the one that matches."],
  allGuessed: ['Everyone has picked! Let us see the picture!', 'All the guesses are in! Here comes the picture!', 'Everyone has chosen. Time for the big reveal!'],
  guessed: ['Someone has guessed the picture!', 'A good guess! Someone got it!', 'We have a right guess!'],
  reveal: ["Here's the picture!", 'Ta-da! Here it is!', "Let's see the whole picture!"],
  timeUp: ["Time's up! Well done, everyone!", "That's time! Great work, everyone!", "Time's up! What a team!"],
  allHeads: ['Everyone reached the head! Amazing!', 'The whole class made it to the head!', 'All the way to the top, everyone! Brilliant!'],
  finished: ['Well done, everyone!', 'Great work, everyone!', 'What a team! Well done!'],
  // Four Corners
  startCorners: ['Here we go! When the countdown starts, run to a corner!', 'Four Corners is on! Pick a corner and run!', 'Off we go! Get to a corner before the dice rolls.'],
  runNow: ['Run to a corner!', 'Go go go! Find a corner!', 'Quick, pick a corner!'],
  hurry: ['Hurry, hurry! Nearly out of time!', 'Quick, the countdown is nearly over!', 'Get to a corner, now!'],
  rollDice: ['Here comes the dice!', 'Time to roll the dice!', 'The dice is rolling!'],
  cornerRed: ['The red corner!', 'It is the red corner!', 'Red! The red corner!'],
  cornerBlue: ['The blue corner!', 'It is the blue corner!', 'Blue! The blue corner!'],
  cornerGreen: ['The green corner!', 'It is the green corner!', 'Green! The green corner!'],
  cornerYellow: ['The yellow corner!', 'It is the yellow corner!', 'Yellow! The yellow corner!'],
  twoCorners: ['Two corners this time!', 'Twist! Two corners are out!', 'Oh no, two corners at once!'],
  lucky: ['A lucky roll! Everyone in a corner is safe!', 'Lucky! Nobody is caught this time!', 'What luck! Every corner is safe!'],
  nobodyCaught: ['Nobody was caught! Brilliant!', 'Everyone got away that time!', 'Not one pupil caught! Well done!'],
  lotsCaught: ['Oh no, lots of pupils off to jail!', 'Whoops! A big crowd is going to jail!', 'Clang! So many in jail this time!'],
  shieldSaved: ['A shield saved someone!', 'Phew! A shield kept someone safe!', 'Shield to the rescue!'],
  escape: ['Someone answered their way out of jail!', 'A great escape from jail!', 'Out of jail! Well done!'],
  powerOn: ['A power-up is switched on!', 'Power-up activated!', 'Someone switched on a power-up!'],
  mech_snow_items: ["Power-ups have appeared! Grab one, then answer a question in a corner to switch it on."],
  mech_snow_storm: ["Watch out, a blizzard! It slows you down."],
  mech_snow_teleport: ["Look, ice portals! Step on one and you pop out of the other."],
  mech_snow_ice: ["Careful, ice patches! You will slide."],
  mech_snow_fog: ["Here comes the snow fog! You will not see everyone near the end."],
  mech_snow_roller: ["Look out for the giant snowball! It will bump you aside."],
  mech_snow_hole: ["Mind the cracked ice in the middle! Go round it."],
  mech_snow_gate: ["The frozen gate will shut one corner just before the end!"],
  mech_snow_twist: ["Twist! Sometimes two corners are picked, and sometimes it is a lucky roll."],
  mech_jungle_items: ["Power-ups are hiding in the jungle! Grab one, then answer a question in a corner to switch it on."],
  mech_jungle_storm: ["Watch out, a sandstorm! It slows you down."],
  mech_jungle_teleport: ["Look, vine swings! Step on one and you pop out of the other."],
  mech_jungle_ice: ["Careful, mud slides! You will slide."],
  mech_jungle_fog: ["Here comes the jungle mist! You will not see everyone near the end."],
  mech_jungle_roller: ["Look out for the rolling boulder! It will bump you aside."],
  mech_jungle_hole: ["Mind the quicksand in the middle! Go round it."],
  mech_jungle_gate: ["The temple door will shut one corner just before the end!"],
  mech_jungle_twist: ["Twist time! Sometimes two corners are picked, and sometimes it is a lucky roll."],
  mech_castle_items: ["Power-ups are floating around the castle! Grab one, then answer a question in a corner to switch it on."],
  mech_castle_storm: ["Watch out, a ghost mist! It slows you down."],
  mech_castle_teleport: ["Look, magic mirrors! Step on one and you pop out of the other."],
  mech_castle_ice: ["Careful, slippery moss! You will slide."],
  mech_castle_fog: ["Here comes the spooky fog! You will not see everyone near the end."],
  mech_castle_roller: ["Look out for the rolling barrel! It will bump you aside."],
  mech_castle_hole: ["Mind the collapsed floor in the middle! Go round it."],
  mech_castle_gate: ["The portcullis will shut one corner just before the end!"],
  mech_castle_twist: ["A twist! Sometimes two corners are picked, and sometimes it is a lucky roll."],
  mech_space_items: ["Power-ups are drifting in space! Grab one, then answer a question in a corner to switch it on."],
  mech_space_storm: ["Watch out, a meteor storm! It slows you down."],
  mech_space_teleport: ["Look, warp pads! Step on one and you pop out of the other."],
  mech_space_ice: ["Careful, zero-g zones! You will slide."],
  mech_space_fog: ["Here comes the nebula cloud! You will not see everyone near the end."],
  mech_space_roller: ["Look out for the rolling asteroid! It will bump you aside."],
  mech_space_hole: ["Mind the black hole in the middle! Go round it."],
  mech_space_gate: ["The airlock will shut one corner just before the end!"],
  mech_space_twist: ["Twist alert! Sometimes two corners are picked, and sometimes it is a lucky roll."],
  // Colour Clash (clashVoice.ts)
  ...CLASH_LINES,
} as const;

/** How to play (HowTo.tsx), read in order before a game. No numbers, so every line has a clip. */
export const HOWTO = {
  stars: [
    'We know one times fact.',
    'Use it to work out new facts. Turn it round, double, halve, times by ten, or add one more group.',
    'Send your fact. Each new one becomes a star on the big screen.',
    'Light up every arm of the web to bring out the sky creature!',
  ],
  serpent: [
    'Start at the stone. Do each sum along the serpent, one box at a time.',
    'Write each answer on your device. You get two tries.',
    'Every right answer moves your gem up the serpent.',
    'Right answers from the whole class wake the serpent. Reach the head, then keep going on the bonus tail!',
  ],
  serpentLevel: {
    sprout: 'Today it is the sprout serpent: adding and taking away small numbers.',
    leaf: 'Today it is the leaf serpent: adding and taking away, numbers up to one hundred.',
    green: 'Today it is the green serpent: adding and taking away.',
    jade: 'Today it is the jade serpent: adding and taking away, with times and share by two and ten.',
    gold: 'Today it is the gold serpent: all four, with times and share by two, five and ten.',
    amber: 'Today it is the amber serpent: all four, with times and share by two, three, four, five and ten.',
    ruby: 'Today it is the ruby serpent: all four, with times tables up to six, and numbers up to one thousand.',
    fire: 'Today it is the fire serpent: all four, with times tables up to twelve.',
  },
  mural: [
    'A mystery picture is hiding under the tiles.',
    'Answer maths questions on your device. Each right answer flips a tile, and you can see your tiles on your device.',
    'Keep answering until the time is up. The more tiles we flip, the more of the picture we see.',
    'Then read the six riddles and pick the one that fits the picture!',
  ],
  corners: [
    'Move your avatar with the joystick, or the arrow keys.',
    'Get to a corner before the countdown ends!',
    'Then the dice picks a corner. Anyone in that corner, or in no corner, goes to jail.',
    'In jail, answer three questions to come back.',
    'Grab power-ups on the map, then answer a question in a corner to switch them on. The most safe rounds wins!',
  ],
  clash: CLASH_HOWTO,
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

export const allVoiceLines = (): string[] => [
  ...Object.values(LINES).flat(),
  ...HOWTO.stars, ...HOWTO.serpent, ...Object.values(HOWTO.serpentLevel), ...HOWTO.mural, ...HOWTO.corners, ...HOWTO.clash,
];
