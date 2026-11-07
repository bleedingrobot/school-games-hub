/**
 * Game kit: mistakes that teach (docs/LEARNING-DESIGN.md rule 7, maths review R5, docs/plans/GAME-KIT-PLAN.md).
 * Lifted from Kiwi's Beanstalk. No game words here: each game passes its own kinds ('over', 'reverse', 'plus2'...) and
 * its own lines, and says which picture shows each kind (docs/kit/README.md has the bank of kinds).
 *
 * Three pieces:
 *  - wrong choices with a kind, and the check that no more than two choices share the right answer's "tell";
 *  - how far off a total is, and whether a tray holds a tempting near miss (the Beanstalk pair check);
 *  - the two-tap flow of one go as a small state machine: wrong tap 1 shows why, wrong tap 2 is "Let's look together",
 *    then the child tries again ("Now you try").
 */

// ---------------------------------------------------------------- wrong choices with a kind

/** A wrong choice and the mistake behind it. The kind picks the why-line and the picture. */
export interface Wrong<K extends string> {
  n: number;
  kind: K;
}

/** Tags each candidate with its kind. `kindOf` gives null for a right answer, which is dropped, as is a repeat. */
export function tagWrongs<K extends string>(candidates: readonly number[], kindOf: (n: number) => K | null): Wrong<K>[] {
  const seen = new Set<number>();
  return candidates.flatMap((n) => {
    const kind = kindOf(n);
    if (kind === null || seen.has(n)) return [];
    seen.add(n);
    return [{ n, kind }];
  });
}

/** How many of these choices (the right answer included, counted once) share the right answer's tell: same ending, same parity, same teen shape. */
export function sharingTell(answer: number, choices: readonly number[], tellOf: (n: number) => string | number | boolean): number {
  const tell = tellOf(answer);
  return [...new Set([answer, ...choices])].filter((n) => tellOf(n) === tell).length;
}

/** True when elimination by shape leaves a real choice: at most `max` (2) of the choices, the answer included, share its tell. */
export const atMostShareTell = (answer: number, choices: readonly number[], tellOf: (n: number) => string | number | boolean, max = 2): boolean =>
  sharingTell(answer, choices, tellOf) <= max;

// ---------------------------------------------------------------- how far off

/** How many units a total is from the target (0 is right; negative is under). A unit is 1, or 10 or 100 on the bigger sums. */
export const unitsOff = (total: number, target: number, unit = 1): number => (total - target) / unit;

/**
 * The size of a mistake: 'one' when a single unit off (the game says which kind that is, so it can tell a dot out from a
 * tens slip), 'over' or 'under' when two or more. Null when right.
 */
export function kindByUnits<K extends string>(units: number, kinds: { one: K; over: K; under: K }): K | null {
  if (units === 0) return null;
  if (Math.abs(units) === 1) return kinds.one;
  return units > 0 ? kinds.over : kinds.under;
}

/** True when two of the numbers on screen are one unit off the target: the tempting near miss every full tray has. */
export const hasNearMiss = (numbers: readonly number[], target: number, unit = 1): boolean =>
  numbers.some((x, i) => numbers.some((y, j) => j > i && Math.abs(x + y - target) === unit));

// ---------------------------------------------------------------- the two-tap flow

/**
 * Where a go is: 'free' (nothing wrong yet), 'why' (one wrong tap, the why-line is showing), 'look' ("Let's look
 * together" is playing, taps are off) and 'redo' ("Now you try": the same go again; wrong taps show why but never look again).
 */
export type GoPhase = 'free' | 'why' | 'look' | 'redo';
export interface GoState {
  phase: GoPhase;
  /** Wrong taps in this go. */
  wrong: number;
}
export const NEW_GO: GoState = { phase: 'free', wrong: 0 };

/** What happens in a go: a wrong tap, a right tap (the go is over), or the end of "Let's look together". */
export type GoEvent = 'wrong' | 'right' | 'lookDone';

/** Wrong taps in a go that stop the free taps and start "Let's look together". */
export const LOOK_AT = 2;

/** The next state of a go. Taps are not allowed during 'look'; the screen ignores them, and a stray wrong there changes nothing. */
export function stepGo(state: GoState, event: GoEvent, lookAt = LOOK_AT): GoState {
  switch (event) {
    case 'right':
      return NEW_GO;
    case 'lookDone':
      return state.phase === 'look' ? { ...state, phase: 'redo' } : state;
    case 'wrong':
      if (state.phase === 'look') return state;
      if (state.phase === 'redo') return { phase: 'redo', wrong: state.wrong + 1 };
      return state.wrong + 1 >= lookAt ? { phase: 'look', wrong: state.wrong + 1 } : { phase: 'why', wrong: state.wrong + 1 };
  }
}
