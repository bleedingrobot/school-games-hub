/**
 * Mystery Mural (docs/CLASSLIVE-PLAN.md section 4): a hidden painting under a grid of tiles. Every right answer from a
 * pupil's own maths focus (way A, marked on the server) earns a flip; the pupil picks which tile to flip on their device.
 * As the picture appears, pupils guess what it is. Pure rules (the questions are the server's job).
 */

export const COLS = 12;
export const ROWS = 8;
export const TILES = COLS * ROWS;
/** Flips a pupil can save up before using them. */
export const MAX_FLIPS = 3;
/** One marked answer every this many ms per pupil (no speed bonus; same as Class Showdown). */
export const ANSWER_GAP_MS = 4000;
/** Guessing opens once this share of the tiles is flipped. */
export const GUESS_FROM = 0.15;
/** A pupil may guess again after this many more tiles have flipped. */
export const GUESS_EVERY = 20;
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
export const guessOpen = (g: MuralGame) => flipped(g) >= Math.ceil(TILES * GUESS_FROM);

/** May this pupil guess now? */
export function canGuess(g: MuralGame, pupil: string): boolean {
  const m = mineOf(g, pupil);
  if (m.gotIt || g.revealed || !guessOpen(g)) return false;
  return m.guessedAt < 0 || flipped(g) - m.guessedAt >= GUESS_EVERY;
}

/** Is it time for this pupil's next marked answer? (ms to wait, 0 when now) */
export const waitFor = (g: MuralGame, pupil: string, t: number) => Math.max(0, mineOf(g, pupil).lastAt + ANSWER_GAP_MS - t);

/** A marked answer (the server has marked it): a right one earns a flip. */
export function answered(g: MuralGame, pupil: string, right: boolean, t: number): { ok: true } | { ok: false; reason: 'too_soon' } {
  const m = mineOf(g, pupil);
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered++;
  if (right) {
    m.right++;
    m.flips = Math.min(MAX_FLIPS, m.flips + 1);
  }
  return { ok: true };
}

/** A pupil flips a tile (using one of their flips). */
export function flip(g: MuralGame, pupil: string, tile: unknown, t: number): { ok: true; events: MuralEvent[] } | { ok: false; reason: 'no_flips' | 'taken' | 'bad_tile' | 'revealed' } {
  const m = mineOf(g, pupil);
  if (g.revealed) return { ok: false, reason: 'revealed' };
  if (!Number.isInteger(tile) || (tile as number) < 0 || (tile as number) >= TILES) return { ok: false, reason: 'bad_tile' };
  if (m.flips < 1) return { ok: false, reason: 'no_flips' };
  if (g.tiles[tile as number]) return { ok: false, reason: 'taken' };
  const wasOpen = guessOpen(g);
  g.tiles[tile as number] = pupil;
  m.flips--;
  m.tiles++;
  const events: MuralEvent[] = [{ type: 'flip', t, pupil, tile: tile as number }];
  if (!wasOpen && guessOpen(g)) events.push({ type: 'guess_open', t });
  if (flipped(g) === TILES) {
    g.revealed = true;
    events.push({ type: 'reveal', t });
  }
  return { ok: true, events };
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

/** A pretend pupil's flip: next to tiles already flipped (they're curious about the edges of what they can see). */
export function pretendTile(g: MuralGame, random: () => number): number | null {
  const free = g.tiles.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return null;
  const near = free.filter((i) => [i - 1, i + 1, i - COLS, i + COLS].some((j) => j >= 0 && j < TILES && g.tiles[j]));
  const from = near.length && random() < 0.6 ? near : free;
  return from[Math.floor(random() * from.length) % from.length];
}
