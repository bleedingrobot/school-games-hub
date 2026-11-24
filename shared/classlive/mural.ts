/**
 * Mystery Mural (docs/CLASSLIVE-PLAN.md section 4): a hidden painting under a grid of tiles. Every right answer from a
 * pupil's own maths focus (way A, marked on the server) flips one tile at random (James, 24 Nov 2026: pupils no longer
 * pick; smaller tiles and many more pictures make it harder). As the picture appears, pupils guess what it is. Pure rules (the questions are the server's job).
 */

export const COLS = 18;
export const ROWS = 12;
export const TILES = COLS * ROWS;
/** One marked answer every this many ms per pupil (no speed bonus; same as Class Showdown). */
export const ANSWER_GAP_MS = 4000;
/** Guessing opens once this share of the tiles is flipped. */
export const GUESS_FROM = 0.15;
/** A pupil may guess again after this many more tiles have flipped. */
export const GUESS_EVERY = 40;
/** How many picture choices a guess offers. */
export const CHOICES = 6;

/** The pictures (painted later; drawn stand-ins until then), with the words a guess shows. */
export const PICTURES = {
  whale: 'A whale',
  volcano: 'A volcano',
  castle: 'A castle',
  rocket: 'A rocket',
  kiwi: 'A kiwi',
  dragon: 'A dragon',
  lighthouse: 'A lighthouse',
  octopus: 'An octopus',
  treehouse: 'A treehouse',
  pirate: 'A pirate ship',
  elephant: 'An elephant',
  penguin: 'A penguin',
  giraffe: 'A giraffe',
  lion: 'A lion',
  panda: 'A panda',
  dinosaur: 'A dinosaur',
  unicorn: 'A unicorn',
  robot: 'A robot',
  balloon: 'A hot air balloon',
  train: 'A steam train',
  submarine: 'A submarine',
  helicopter: 'A helicopter',
  snowman: 'A snowman',
  pyramid: 'A pyramid',
  windmill: 'A windmill',
  cupcake: 'A cupcake',
  icecream: 'An ice cream',
  pizza: 'A pizza',
  sunflower: 'A sunflower',
  cactus: 'A cactus',
  butterfly: 'A butterfly',
  beehive: 'A beehive',
  turtle: 'A sea turtle',
  shark: 'A shark',
  owl: 'An owl',
  frog: 'A frog',
  tractor: 'A tractor',
  fireengine: 'A fire engine',
  guitar: 'A guitar',
  pumpkin: 'A pumpkin',
} as const;
export type Picture = keyof typeof PICTURES;

/**
 * A riddle for each picture, shown (and read by Bella) once guessing opens instead of a list of the answers with
 * thumbnails (James, 24 Nov 2026: the list made it too easy; a cryptic clue, not a description).
 */
export const CLUES: Record<Picture, string> = {
  whale: "I'm bigger than any dinosaur, yet my dinner is smaller than your fingernail.",
  volcano: 'I have a mouth but never eat. When I lose my temper, the whole island feels the heat.',
  castle: 'I wear a crown of stone teeth, and water hugs my feet to keep strangers out.',
  rocket: 'I count backwards before I leave, and I go out through the roof of the sky.',
  kiwi: 'I share my name with a fruit and a whole nation, but I can never fly to visit either.',
  dragon: "My breath could light your birthday candles, but you'll only meet me in a story.",
  lighthouse: 'I stand alone all night and wink at ships so they never bump the rocks.',
  octopus: 'Three hearts, blue blood, and more arms than I could ever need for a hug.',
  treehouse: 'A home with no ground floor, where the neighbours are birds and the walls grow leaves.',
  pirate: 'I fly bones on my flag, and my crew says "arr" instead of hello.',
  elephant: 'I never forget, I carry my own hose, and I wear my ears like giant fans.',
  penguin: "I wear a suit to every party, I can't fly, but I'm a champion at sliding on my tummy.",
  giraffe: 'I can lick my own ears and I eat my lunch from the top of the tree. My scarf would need to be very long.',
  lion: "I'm the king, but my crown is made of hair, and my wife does most of the hunting.",
  panda: "I'm a bear in black and white, and I spend half my day chewing a very tough salad.",
  dinosaur: "My big teeth are scary but my tiny arms can't reach my nose. You'll only find my bones today.",
  unicorn: "I'm a horse with a party hat that never comes off, and nobody has ever taken my photo.",
  robot: "I never get tired and never eat lunch, but if you pull my plug, I'll take a very long nap.",
  balloon: 'I go up when I get hot under my collar, and my passengers ride in a basket.',
  train: 'I huff and I puff along my two long lines, and I always stop at the station to let people in.',
  submarine: "I'm a boat that likes to hide, and I peek above the waves with one long eye.",
  helicopter: 'My hat spins so fast it lifts me up, and I can hover in one spot like a hummingbird.',
  snowman: 'My nose is a vegetable, my buttons are coal, and the sun is my only enemy.',
  pyramid: "Four triangles stand guard over a king who's been asleep for thousands of years.",
  windmill: 'I wave my four arms all day long, but I never say goodbye. The wind helps me make flour.',
  cupcake: 'I wear a paper skirt and a fluffy hat, and on your birthday I might hold a candle.',
  icecream: "I'm sweet and cold and I cry when the sun looks at me, so eat me quickly from my crunchy cone.",
  pizza: "I'm round, but you cut me into triangles. I come from Italy wearing cheese.",
  sunflower: 'My face follows the sun all day, and my seeds are a snack for birds and people.',
  cactus: "I never need a drink and I'm not a fan of hugs. I keep my water hidden in the desert.",
  butterfly: 'I was a hungry caterpillar before I slept in a little bed of silk. Now I taste with my feet.',
  beehive: 'A busy city with thousands of workers, one queen, and walls made of sweet golden hexagons.',
  turtle: 'I carry my home everywhere I swim, and I come back to the same beach to lay my eggs.',
  shark: 'I have rows and rows of teeth, I never stop swimming, and my fin says hello above the waves.',
  owl: "I can turn my head almost all the way round, and I'm wide awake while you're asleep. Who? Who?",
  frog: 'I started life with a tail and no legs, and now I catch flies with my tongue on a lily pad.',
  tractor: "My back wheels are bigger than my front ones, and I'm the strongest worker on the farm.",
  fireengine: "I'm red, I'm loud, I carry a ladder and a hose, and I rush to put the hot stuff out.",
  guitar: 'I have a neck but no head, six strings but no puppet, and I sing when you strum me.',
  pumpkin: "I'm a giant orange berry, and in a fairy tale I turned into a carriage.",
};
export const PICTURE_IDS = Object.keys(PICTURES) as Picture[];

export interface MuralMine {
  flips: number;
  right: number;
  answered: number;
  lastAt: number;
  /** Tiles flipped when they last guessed (-1: never). */
  guessedAt: number;
  guesses: number;
  /** Their place among the right guessers (1 = first), or 0. */
  gotIt: number;
  tiles: number;
}

export interface MuralGame {
  kind: 'mural';
  picture: Picture;
  /** The guess choices, in order (includes the picture). */
  choices: Picture[];
  /** Who flipped each tile ('' for not yet). */
  tiles: string[];
  /** Right guessers in order. */
  solvers: string[];
  revealed: boolean;
  mine: Record<string, MuralMine>;
}

export type MuralEvent =
  | { type: 'flip'; t: number; pupil: string; tile: number }
  | { type: 'guessed'; t: number; pupil: string; place: number }
  | { type: 'guess_open'; t: number }
  | { type: 'reveal'; t: number };

export function newMural(random: () => number, avoid: readonly string[] = []): MuralGame {
  const pool = PICTURE_IDS.filter((p) => !avoid.includes(p));
  const from = pool.length ? pool : PICTURE_IDS;
  const picture = from[Math.floor(random() * from.length) % from.length];
  const others = PICTURE_IDS.filter((p) => p !== picture).sort(() => random() - 0.5).slice(0, CHOICES - 1);
  const choices = [...others, picture].sort(() => random() - 0.5);
  return { kind: 'mural', picture, choices, tiles: Array(TILES).fill(''), solvers: [], revealed: false, mine: {} };
}

const mineOf = (g: MuralGame, pupil: string): MuralMine =>
  (g.mine[pupil] ??= { flips: 0, right: 0, answered: 0, lastAt: -1e12, guessedAt: -1, guesses: 0, gotIt: 0, tiles: 0 });

export const flipped = (g: MuralGame) => g.tiles.filter(Boolean).length;
export const guessOpen = (g: MuralGame) => flipped(g) >= Math.ceil(g.tiles.length * GUESS_FROM);

/** May this pupil guess now? */
export function canGuess(g: MuralGame, pupil: string): boolean {
  const m = mineOf(g, pupil);
  if (m.gotIt || g.revealed || !guessOpen(g)) return false;
  return m.guessedAt < 0 || flipped(g) - m.guessedAt >= GUESS_EVERY;
}

/** Is it time for this pupil's next marked answer? (ms to wait, 0 when now) */
export const waitFor = (g: MuralGame, pupil: string, t: number) => Math.max(0, mineOf(g, pupil).lastAt + ANSWER_GAP_MS - t);

/** A marked answer (the server has marked it): a right one flips a tile at random. */
export function answered(g: MuralGame, pupil: string, right: boolean, t: number, random: () => number): { ok: true; events: MuralEvent[] } | { ok: false; reason: 'too_soon' } {
  const m = mineOf(g, pupil);
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (!right) return { ok: true, events: [] };
  m.right++;
  return { ok: true, events: flipRandom(g, pupil, t, random) };
}

/** Flips one tile that isn't flipped yet, chosen at random, for this pupil. */
function flipRandom(g: MuralGame, pupil: string, t: number, random: () => number): MuralEvent[] {
  if (g.revealed) return [];
  const free = g.tiles.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return [];
  const tile = free[Math.floor(random() * free.length) % free.length];
  const wasOpen = guessOpen(g);
  g.tiles[tile] = pupil;
  mineOf(g, pupil).tiles++;
  const events: MuralEvent[] = [{ type: 'flip', t, pupil, tile }];
  if (!wasOpen && guessOpen(g)) events.push({ type: 'guess_open', t });
  if (flipped(g) === g.tiles.length) {
    g.revealed = true;
    events.push({ type: 'reveal', t });
  }
  return events;
}

/** A pupil's guess. Wrong guesses are only told to the pupil. */
export function guess(g: MuralGame, pupil: string, pick: unknown, t: number): { ok: true; right: boolean; events: MuralEvent[] } | { ok: false; reason: 'not_now' | 'bad_pick' } {
  if (!canGuess(g, pupil)) return { ok: false, reason: 'not_now' };
  if (typeof pick !== 'string' || !g.choices.includes(pick as Picture)) return { ok: false, reason: 'bad_pick' };
  const m = mineOf(g, pupil);
  m.guessedAt = flipped(g);
  m.guesses++;
  if (pick !== g.picture) return { ok: true, right: false, events: [] };
  g.solvers.push(pupil);
  m.gotIt = g.solvers.length;
  return { ok: true, right: true, events: [{ type: 'guessed', t, pupil, place: m.gotIt }] };
}

/** The teacher (or the last tile) shows the whole picture. */
export function reveal(g: MuralGame, t: number): MuralEvent[] {
  if (g.revealed) return [];
  g.revealed = true;
  return [{ type: 'reveal', t }];
}
