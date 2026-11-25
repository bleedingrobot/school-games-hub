/**
 * Mystery Mural (docs/CLASSLIVE-PLAN.md section 4): a hidden painting under a grid of tiles. Every right answer from a
 * pupil's own maths focus (way A, marked on the server) flips one tile at random (James, 24 Nov 2026: pupils no longer
 * pick; smaller tiles and many more pictures make it harder). Pupils work through the time flipping tiles (no guessing
 * on the way); then everyone gets one guess, picking from six riddles, and the picture is revealed (James, 24 Nov 2026).
 * Pure rules (the questions are the server's job).
 */

/** The old fixed grid: rooms saved before the grid scaled (and the size before a game starts) use it. */
export const COLS = 18;
export const ROWS = 12;
export const TILES = COLS * ROWS;
/** One marked answer every this many ms per pupil (no speed bonus; same as Class Showdown). */
export const ANSWER_GAP_MS = 4000;
/** How many riddles a guess offers (one is the picture's). */
export const CHOICES = 6;
/** How long the guessing lasts once the flipping is over (it ends sooner when everyone has picked). */
export const GUESS_MS = 45_000;
/**
 * Right answers a pupil gets a minute in a class that's doing well. Measured on the live game, 25 Nov 2026: a class of
 * 24 in a 2-minute mural got a median 5.2 and a top quarter 5.9 a minute; pupils on their own got 3.6 to 5.1 over 2 to 5
 * minutes. So 6 is a class doing well.
 */
export const RIGHT_PER_MIN = 6;
/**
 * The grid is sized when the game starts, from the players and the time, so a class doing well uncovers about this
 * much of the picture (James, 25 Nov 2026: a class of 25 found the fixed 216 tiles too easy; aim for about 75%).
 */
export const AIM = 0.75;
/** The most of the picture the class can uncover, however well they do. */
export const MAX_SHARE = 0.8;
/** The pace of an untimed game (the teacher ends it): as if it were 5 minutes. */
export const UNTIMED_PACE_MS = 5 * 60_000;
/** The grid keeps the painting's 3:2 shape; it is never coarser or finer than these. */
const MIN_ROWS = 6;
const MAX_ROWS = 40;

/** The grid for this many players and minutes (0: untimed, sized as 5 minutes). */
export function gridFor(players: number, lengthMin: number): { cols: number; rows: number } {
  const minutes = lengthMin > 0 ? lengthMin : UNTIMED_PACE_MS / 60_000;
  const target = (Math.max(1, players) * RIGHT_PER_MIN * minutes) / AIM;
  const rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(Math.sqrt(target / 1.5))));
  return { cols: Math.round(rows * 1.5), rows };
}

/** The game's grid (older rooms: 18 by 12). */
export const colsOf = (g: { cols?: number }) => g.cols ?? COLS;
export const rowsOf = (g: { rows?: number }) => g.rows ?? ROWS;

/** The most tiles a game of this many tiles can open. */
export const maxOpen = (tiles: number) => Math.floor(tiles * MAX_SHARE);
/**
 * How many tiles may be open by time t, in a game whose flipping lasts paceMs: a steady pace up to the most, so a
 * burst of right answers early on can't give the picture away (James, 24 Nov 2026). Right answers past the pace wait
 * in a queue and flip as the time goes on (fewest tiles first).
 */
export const openCap = (t: number, paceMs: number, tiles = TILES) => {
  const most = maxOpen(tiles);
  return Math.min(most, Math.ceil((most * Math.max(0, t)) / Math.max(1, paceMs)));
};

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
 * A riddle for each picture; six are shown at the end of the time (the right one and five others) instead of a list of the answers with
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
  /** Tiles flipped when they last guessed (-1: never). Kept for saved rooms. */
  guessedAt: number;
  guesses: number;
  /** Their place among the right guessers (1 = first), or 0. */
  gotIt: number;
  tiles: number;
  /** Their one guess, once the guessing starts. */
  pick?: Picture;
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
  /** 'flip' while the class answers (missing in older rooms), then 'guess' for the one guess each. */
  phase?: 'flip' | 'guess';
  /** When the guessing started (ms since the start). */
  guessFrom?: number;
  /** Right answers waiting for their tile (the pace holds them back), oldest first. */
  queue?: string[];
  /** The grid, set when the game starts (missing in older rooms: 18 by 12). */
  cols?: number;
  rows?: number;
}

export type MuralEvent =
  | { type: 'flip'; t: number; pupil: string; tile: number }
  | { type: 'guess_time'; t: number }
  | { type: 'picked'; t: number; pupil: string }
  | { type: 'guessed'; t: number; pupil: string; place: number }
  | { type: 'guess_open'; t: number }
  | { type: 'reveal'; t: number };

export function newMural(random: () => number, avoid: readonly string[] = []): MuralGame {
  const pool = PICTURE_IDS.filter((p) => !avoid.includes(p));
  const from = pool.length ? pool : PICTURE_IDS;
  const picture = from[Math.floor(random() * from.length) % from.length];
  const others = PICTURE_IDS.filter((p) => p !== picture).sort(() => random() - 0.5).slice(0, CHOICES - 1);
  const choices = [...others, picture].sort(() => random() - 0.5);
  return { kind: 'mural', picture, choices, tiles: Array(TILES).fill(''), solvers: [], revealed: false, mine: {}, phase: 'flip' };
}

/** Sizes the grid for the class and the time, as the game starts (only while no tile is open). */
export function sizeMural(g: MuralGame, players: number, lengthMin: number): void {
  if (g.tiles.some(Boolean)) return;
  const { cols, rows } = gridFor(players, lengthMin);
  g.cols = cols;
  g.rows = rows;
  g.tiles = Array(cols * rows).fill('');
}

const mineOf = (g: MuralGame, pupil: string): MuralMine =>
  (g.mine[pupil] ??= { flips: 0, right: 0, answered: 0, lastAt: -1e12, guessedAt: -1, guesses: 0, gotIt: 0, tiles: 0 });

export const flipped = (g: MuralGame) => g.tiles.filter(Boolean).length;
export const guessing = (g: MuralGame) => g.phase === 'guess' && !g.revealed;
/** The tiles this pupil flipped. */
export const tilesOf = (g: MuralGame, pupil: string) => g.tiles.flatMap((x, i) => (x === pupil ? [i] : []));

/** May this pupil guess now? (Once, in the guessing.) */
export function canGuess(g: MuralGame, pupil: string): boolean {
  return guessing(g) && !g.mine[pupil]?.pick;
}

/** The flipping is over: everyone gets one guess. */
export function startGuessing(g: MuralGame, t: number): MuralEvent[] {
  if (g.phase === 'guess' || g.revealed) return [];
  g.phase = 'guess';
  g.queue = [];
  g.guessFrom = t;
  return [{ type: 'guess_time', t }];
}

/** Has the guessing run its time? */
export const guessingDone = (g: MuralGame, t: number) => guessing(g) && t >= (g.guessFrom ?? 0) + GUESS_MS;

/** Has every pupil in the room picked? */
export const allPicked = (g: MuralGame, order: readonly string[]) => order.length > 0 && order.every((id) => !!g.mine[id]?.pick);

/** Is it time for this pupil's next marked answer? (ms to wait, 0 when now) */
export const waitFor = (g: MuralGame, pupil: string, t: number) => Math.max(0, mineOf(g, pupil).lastAt + ANSWER_GAP_MS - t);

/** A marked answer (the server has marked it): a right one flips a tile at random. */
export function answered(g: MuralGame, pupil: string, right: boolean, t: number, random: () => number, paceMs = UNTIMED_PACE_MS): { ok: true; events: MuralEvent[] } | { ok: false; reason: 'too_soon' } {
  const m = mineOf(g, pupil);
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (!right) return { ok: true, events: paced(g, t, random, paceMs) };
  m.right++;
  if (g.revealed || g.phase === 'guess') return { ok: true, events: [] };
  (g.queue ??= []).push(pupil);
  return { ok: true, events: paced(g, t, random, paceMs) };
}

/** Flips the queued right answers' tiles, as many as the pace allows by now. */
export function paced(g: MuralGame, t: number, random: () => number, paceMs = UNTIMED_PACE_MS): MuralEvent[] {
  const events: MuralEvent[] = [];
  const cap = openCap(t, paceMs, g.tiles.length);
  while (g.queue?.length && flipped(g) < cap && g.phase !== 'guess' && !g.revealed) {
    // The waiting pupil with the fewest tiles goes first (the earliest of them), so every busy pupil keeps flipping.
    let at = 0;
    g.queue.forEach((id, i) => { if (mineOf(g, id).tiles < mineOf(g, g.queue![at]).tiles) at = i; });
    events.push(...flipRandom(g, g.queue.splice(at, 1)[0], t, random));
  }
  return events;
}

/** Flips one tile that isn't flipped yet, chosen at random, for this pupil. */
function flipRandom(g: MuralGame, pupil: string, t: number, random: () => number): MuralEvent[] {
  if (g.revealed || g.phase === 'guess') return [];
  const free = g.tiles.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return [];
  const tile = free[Math.floor(random() * free.length) % free.length];
  g.tiles[tile] = pupil;
  mineOf(g, pupil).tiles++;
  const events: MuralEvent[] = [{ type: 'flip', t, pupil, tile }];
  if (flipped(g) === g.tiles.length) events.push(...startGuessing(g, t));
  return events;
}

/** A pupil's one guess (a riddle's picture). Nobody is told if it's right until the reveal. */
export function guess(g: MuralGame, pupil: string, pick: unknown, t: number): { ok: true; events: MuralEvent[] } | { ok: false; reason: 'not_now' | 'bad_pick' } {
  if (!canGuess(g, pupil)) return { ok: false, reason: 'not_now' };
  if (typeof pick !== 'string' || !g.choices.includes(pick as Picture)) return { ok: false, reason: 'bad_pick' };
  const m = mineOf(g, pupil);
  m.pick = pick as Picture;
  m.guesses++;
  if (pick === g.picture) {
    g.solvers.push(pupil);
    m.gotIt = g.solvers.length;
  }
  return { ok: true, events: [{ type: 'picked', t, pupil }] };
}

/** The end of the guessing (time, everyone picked, or the teacher) shows the whole picture. */
export function reveal(g: MuralGame, t: number): MuralEvent[] {
  if (g.revealed) return [];
  g.revealed = true;
  return [{ type: 'reveal', t }];
}
