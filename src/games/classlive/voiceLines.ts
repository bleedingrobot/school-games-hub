import { allLavaLines } from './lavaVoice';
import { allRelayLines } from './relayLines';
/**
 * Everything Class Live says on the projector, read by Bella (af_bella) like every game. No pupils' names (names are
 * shown, never spoken). iPads stay silent. Clips go in public/voice/classlive/, made with scripts/voice-clips.py classlive.
 *
 * Each moment has a few takes, said in turn (`next`), so nothing is said the same way twice running (James, 24 Nov 2026:
 * more variety in the sounds).
 */
import { CLASH_HOWTO, CLASH_LINES } from './clashVoice';

import { GHOST_HOWTO, GHOST_LINES } from './ghostLines';
import { CREW_HOWTO, CREW_LINES } from './crewLines';

export const VOICE_FOLDER = 'voice/classlive/';

export const LINES = {
  ...GHOST_LINES,
  ...CREW_LINES,
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
  // Musical Thrones
  startThrones: ['Here we go! Dance while the music plays. When it stops, sit on a throne!', 'Musical Thrones is on! When the music stops, find a throne!', 'Off we go! Listen for the music to stop, then grab a throne.'],
  musicStop: ['Stop! Sit down!', 'The music has stopped! Find a throne!', 'Freeze! Grab a throne, quick!', 'Stop the music! Sit, sit, sit!'],
  fewerThrones: ['One fewer throne this time!', 'Look, there are fewer thrones now!', 'The thrones are disappearing!'],
  goldenThrone: ['A golden throne! It is worth three crowns.', 'Look for the golden throne! Three crowns!', 'There is a golden throne this round!'],
  allSeated: ['Everyone found a throne!', 'Not one left standing! Brilliant!', 'A throne for everyone this time!'],
  lotsStanding: ['Oh no, lots of royals left standing!', 'So many standing! Off to the courtyard!', 'Whoops! A big crowd without a throne!'],
  stoodUp: ['Anyone standing, off to the courtyard!', 'No throne? To the courtyard you go!', 'Those left standing go to the courtyard.'],
  steal: ['A throne has been stolen!', 'Sneaky! A crown thief struck!', 'Ooh, someone stole a throne!'],
  dancers: ['Great dancing on the tiles! Bonus crowns!', 'Dance tile bonus!', 'Nice moves on the dance floor!'],
  mimicWarn: ['Careful! Some thrones have little eyes. They bite!', 'Watch out for thrones with eyes. They are hungry!'],
  mimicChomp: ['Chomp! That throne was a mimic!', 'Oh no! A hungry throne!', 'Gobbled up by a mimic!'],
  courtBack: ['Someone answered their way back from the courtyard!', 'Back from the courtyard! Well done!', 'A royal return from the courtyard!'],
  newRound: ['The music is back on! Dance!', 'Here comes the music again!', 'Dance time! Keep moving!'],
  mt_castle_items: ["Power-ups have appeared in the castle hall! Grab one, then answer a question while the music plays to switch it on."],
  mt_castle_storm: ["Watch out for the sticky honey! It slows you down."],
  mt_castle_teleport: ["Look, a magic mirror! Step in one end and you pop out of the other."],
  mt_castle_ice: ["Careful, the polished floor! You will slide."],
  mt_castle_roller: ["Look out for the rolling barrel! It knocks you flying."],
  mt_ice_items: ["Power-ups have appeared in the ice palace! Grab one, then answer a question while the music plays to switch it on."],
  mt_ice_storm: ["Watch out for the blizzard! It slows you down."],
  mt_ice_teleport: ["Look, a ice portal! Step in one end and you pop out of the other."],
  mt_ice_ice: ["Careful, the ice patch! You will slide."],
  mt_ice_roller: ["Look out for the giant snowball! It knocks you flying."],
  mt_jungle_items: ["Power-ups have appeared in the temple! Grab one, then answer a question while the music plays to switch it on."],
  mt_jungle_storm: ["Watch out for the mud pool! It slows you down."],
  mt_jungle_teleport: ["Look, a vine swing! Step in one end and you pop out of the other."],
  mt_jungle_ice: ["Careful, the slippery leaves! You will slide."],
  mt_jungle_roller: ["Look out for the rolling boulder! It knocks you flying."],
  mt_pirate_items: ["Power-ups have appeared on the deck! Grab one, then answer a question while the music plays to switch it on."],
  mt_pirate_storm: ["Watch out for the sea spray! It slows you down."],
  mt_pirate_teleport: ["Look, a hatch! Step in one end and you pop out of the other."],
  mt_pirate_ice: ["Careful, the wet deck! You will slide."],
  mt_pirate_roller: ["Look out for the rolling cannonball! It knocks you flying."],
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
  // Shark Bay (Simon the shark)
  sharkStart: ['Here we go! Swim to a coloured quarter, or hide under a boat!', 'Shark Bay is on! Simon is hungry, so find a safe quarter!', 'Off we go! Keep off the jetty and watch out for Simon!'],
  sharkRun: ['Swim, swim, swim! Find a quarter!', 'Quick, Simon is coming! Pick a colour!', 'Go go go! Hide under a boat or pick a colour!'],
  sharkBoat: ['Hide under a boat!', 'A boat is a safe place to hide!', 'Get under a boat, quick!'],
  sharkHurry: ['Hurry, hurry! Simon is nearly here!', 'Quick, the shark is almost here!', 'Get to a safe place, now!'],
  sharkLeap: ['Look out! A fin is circling the bay!', 'Simon is swimming round and round!', 'Here comes the fin!'],
  sharkSpot: ['The lights are going out! Where will Simon snap?', 'The spotlight is searching for Simon!', 'Dark water! Where is the shark going to snap?'],
  sharkStrikeRed: ['Simon strikes Red!', 'Chomp! Simon bites the red quarter!', 'It is Red! Simon strikes Red!'],
  sharkStrikeYellow: ['Simon strikes Yellow!', 'Chomp! Simon bites the yellow quarter!', 'It is Yellow! Simon strikes Yellow!'],
  sharkStrikeGreen: ['Simon strikes Green!', 'Chomp! Simon bites the green quarter!', 'It is Green! Simon strikes Green!'],
  sharkStrikePurple: ['Simon strikes Purple!', 'Chomp! Simon bites the purple quarter!', 'It is Purple! Simon strikes Purple!'],
  sharkTwo: ['Two sharks! Simon has a friend!', 'Oh no, two sharks this time!', 'Twist! Two quarters are struck!'],
  sharkFull: ['Simon is full! Nobody is caught!', 'Simon has had enough! Everyone is safe!', 'Lucky! Simon is too full to bite!'],
  sharkBoated: ['The boats kept some pupils safe!', 'Phew! A boat saved some of you!', 'Safe under the boats!'],
  sharkCave: ['Oh no, off to the shark cave!', 'Splash! A crowd is going to the shark cave!', 'Into the cave you go!'],
  // Real-life Four Corners (docs/JAIL-PLAN.md): a pupil answered their way out at a jail station (names are shown, never said).
  backIn: ['You are back in the game!', 'Back in you go! Well done!', 'Free! Run back into the game!'],
  // Maths Mingle (docs/MINGLE-PLAN.md): the music stops and the call goes up; then the answer.
  mingleStop: ['Stop! Get into groups!', 'Freeze! Quick, make your groups!', 'The music has stopped! Into groups, everyone!'],
  mingleDance: ['Dance and mingle!', 'Music on! Keep moving!', 'Off you go! Mingle around the room!'],
  mingleLeft: ['Left over? Go to a station and answer your way back in!', 'No group? Off to a station, quick!', 'Anyone left over, head to a station!'],
  // Rocket Relay (docs/ROCKET-PLAN.md).
  rocketBoost: ['Boost!', 'Blast off! Great answer!', 'Up goes the rocket!', 'Whoosh! Another boost!'],
  rocketEnd: ['What a race! Great running and great maths!', 'Brilliant relay, everyone!', 'That was out of this world! Well done!'],
  // Stand Up If (docs/STAND-PLAN.md).
  standAllIn: ['Everyone is ready!', 'All locked in! Here we go!', 'Everyone has chosen!'],
  standCount: ['Three, two, one... stand up or sit down!', 'Ready? Three, two, one... go!', 'Three, two, one... show me!'],
  standReveal: ['Check your iPad! Were you right?', 'How did you go? Look at your iPad!', 'Sit down, everyone, and check your iPad!'],
  standEnd: ['What a game! Great thinking about those signs!', 'Brilliant! You are sign experts now!', 'Well done, everyone! Fantastic maths!'],
  mingleEnd: ['What a mingle! Great maths, everyone!', 'Brilliant moving and great maths!', 'That was fantastic. Well done, everyone!'],
} as const;

/** Rocket Relay: a team reached the Moon, one clip per team (TEAM_WORDS order). */
export const ROCKET_MOON_LINES = ['Red team reached the Moon!', 'Blue team reached the Moon!', 'Green team reached the Moon!', 'Yellow team reached the Moon!', 'Purple team reached the Moon!', 'Orange team reached the Moon!'];

/** Stand Up If: the round's call, one clip per sign (said as a round starts). */
export const STAND_SIGN_LINES: Record<'>' | '<' | '≥' | '≤', string> = {
  '>': 'Stand up if your answer is greater than your number!',
  '<': 'Stand up if your answer is less than your number!',
  '≥': 'Stand up if your answer is greater than or equal to your number!',
  '≤': 'Stand up if your answer is less than or equal to your number!',
};

/** Maths Mingle: the answer, said once the scramble ends ("Groups of four!"), one clip per group size. */
export const MINGLE_SIZE_LINES: Record<number, string> = {
  2: 'Groups of two!', 3: 'Groups of three!', 4: 'Groups of four!', 5: 'Groups of five!', 6: 'Groups of six!', 7: 'Groups of seven!', 8: 'Groups of eight!',
};

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
  thrones: [
    'Move your royal avatar with the joystick, or the arrow keys.',
    'While the music plays, dance about. Stand on a glowing dance tile when it stops for a bonus crown.',
    'When the music stops, run and sit on a throne! There are fewer thrones every round.',
    'If you are left standing, go to the courtyard and answer three questions to come back. Three right in a row wins a crown thief scroll!',
    'A throne is one crown, a golden throne is three. The most crowns wins!',
  ],
  corners: [
    'Move your avatar with the joystick, or the arrow keys.',
    'Get to a corner before the countdown ends!',
    'Then the dice picks a corner. Anyone in that corner, or in no corner, goes to jail.',
    'In jail, answer three questions to come back.',
    'Grab power-ups on the map, then answer a question in a corner to switch them on. The most safe rounds wins!',
  ],
  // Real-life Four Corners (docs/JAIL-PLAN.md).
  jail: [
    'We are playing Four Corners for real, in the classroom!',
    'When the countdown starts, run to a corner. Freeze when it ends!',
    'Then the dice picks a corner. Anyone in that corner, or in no corner, is out.',
    'Out? Go to a jail station, tap your name, and answer the questions.',
    'Get them right and your name flashes up here. You are back in the game!',
  ],
  // Maths Mingle (docs/MINGLE-PLAN.md).
  mingle: [
    'Maths Mingle! When the music plays, dance and mingle around the room.',
    'When the music stops, the screen shows a sum. The answer is your group size!',
    'Quick, get into groups of that many before the countdown ends.',
    'Left over? Go to a station, tap your name, and answer the questions.',
    'Get them right and your name flashes up on the big screen. Back into the mingle you go!',
  ],
  // Stand Up If (docs/STAND-PLAN.md).
  stand: [
    'Stand Up If! Everyone plays on their own iPad.',
    'Your iPad gives you a question and your own number. The big screen shows the sign.',
    'Work out your answer, then check the sign. True for you? Tap Stand. Not true? Tap Sit.',
    'When the big screen counts down, everyone stands up or sits down for real, all at once!',
    'Then check your iPad. Get it right to keep your streak going. How many can you get in a row?',
  ],
  // Rocket Relay (docs/ROCKET-PLAN.md).
  rocket: [
    'Rocket Relay! Line up in your team at one end of the room.',
    'Your team iPad is at the other end. The big screen shows who runs next.',
    'Run to the iPad, tap I am here, and answer your question.',
    'A right answer boosts your rocket! Wrong? You get one more try.',
    'Then run back and tag the next runner. First rocket to the Moon wins!',
  ],
  clash: CLASH_HOWTO,
  shark: [
    'Swim your avatar with the joystick, or the arrow keys.',
    'The bay has four coloured quarters, and they slowly spin round!',
    'Get to a quarter before the countdown ends. Do not stay on the jetty!',
    'Simon the shark strikes a quarter. Anyone in it, or on the jetty, goes to the shark cave.',
    'Hide under a boat and you are safe, but boats only have a few seats! In the cave, answer three questions to swim back out.',
  ],
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
  ...HOWTO.stars, ...HOWTO.serpent, ...Object.values(HOWTO.serpentLevel), ...HOWTO.mural, ...HOWTO.corners, ...HOWTO.shark, ...GHOST_HOWTO, ...CREW_HOWTO, ...HOWTO.clash, ...HOWTO.thrones, ...HOWTO.jail, ...HOWTO.mingle, ...Object.values(MINGLE_SIZE_LINES), ...HOWTO.rocket, ...ROCKET_MOON_LINES, ...HOWTO.stand, ...Object.values(STAND_SIGN_LINES),
  ...allLavaLines(),
  ...allRelayLines(),
];
