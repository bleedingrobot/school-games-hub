# Building a Year 7-8 skill pack (cards Y4 to Y8)

For Claude. How each card's question types are built, so every card matches card Y3 (negative numbers). Read
`docs/plans/ladder-7-8/PLAN.md` sections 1, 3 and 9 first, then copy the shape of `shared/maths/skillPacks/integerSkills.ts`.

## The rule

James: "memory and fluency are the goals of games hub, not long drawn out working or hard questions". Every question is one
number to type or one of four choices to tap, answerable in about 8 seconds (12 for the two-step types). Small, friendly
numbers. No long methods.

## One file per card

`shared/maths/skillPacks/<name>Skills.ts` exports:

- `<NAME>_FAMILIES: Record<string, Family>`: one `oneKey(key, label, tags, size, roll, make)` per question type.
- `<NAME>_SKILL_KEYS`: `{ 'skill-id': ['type:key', ...] }`, in the order the skill asks them.
- `<NAME>_SLOW_KEYS: string[]`: the two-step types (they get 12 s to count as quick). One-step types are not listed.
- `<NAME>_LADDER: { id, label, stage, year, tags }[]`: one row per skill, in ladder order. `stage` is one of
  'integers' | 'place-value' | 'fractions-decimals-percentages' | 'algebra' | 'measurement-geometry' | 'data-chance'.
  `label` is the teacher-facing name (short, plain words). Also give a short name of 20 characters or fewer for each skill
  (`tiny`).

## Question rules (all checked by `shared/maths/y78.test.ts`)

- Keys match `^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$`, e.g. `pow:ten`, `prime:which`. Prefix unique to the card.
- `roll` returns numbers; `make(key, params)` rebuilds the same question from the same numbers every time, and returns null
  for numbers `roll` could never give (check every param with `isInt(n, lo, hi)`). `size` = the params count.
- A typed answer is a whole number or a decimal (set `input: 'decimal'` for decimals) and is never below zero (no minus key).
  Use `withMistakes(base, named)` with named common mistakes (each wrong choice must be a real slip a pupil makes, never
  random). It returns null when fewer than three distinct mistakes are left: roll again.
- Anything else (negative answers, fractions, "which is prime", true/false, comparisons, prime factor forms) is a pick
  question: `pick(base, rightLabel, namedLabels, { slot, salt })` from `pickKit.ts`, with `rollPick(r)` as the last two
  params and `goodPick(slot, salt)` checked. Exactly 4 distinct labels. Labels use "−" (U+2212) for minus.
- `parts` is the sum as shown, with exactly one blank: a part `?`, or `?` followed by `°`, `,` or `;` (e.g. `?°`).
  Units go in their own part after the blank when needed: `['3.5 km', '=', '?', 'm']`. Powers and roots use Unicode:
  `10⁴`, `2³`, `√81`, `∛64`, `10⁻²`, `cm²`, `m³`. Fractions as `3/4`.
- `prompt` (optional) is a short line above the sum when the sum alone doesn't say what to do ("Which is prime?").
- `spoken`: the question in words for read-aloud. Use `talk(parts)` from pickKit where it reads well; otherwise write it.
  It must not contain "−" (say "negative 4" / "minus").
- Angle and shape questions add `figure` (see `shared/maths/figure.ts`: triangle, line, point, crossing, right-angle,
  rectangle, triangle-area, parallelogram, trapezium, cuboid, prism, circle, polygon, compass). The parts must still say
  everything needed to answer: the picture is extra.
- `fact` on pick questions: the right answer in words, containing the right label ("53 is prime").
- Tags: placeholder NZC ids like `MS.Y7.NUM.NS.P1` (James fills real ones later).

## Testing your card

Write `shared/maths/y78/<name>.oracle.ts` exporting `oracle(key: string, parts: string[], prompt: string | undefined): number | null`
that works out the right answer from the screen text alone, with plain arithmetic, NOT by calling the generators. For a pick
question, return the value of the right label as a number (or null if the label isn't a number, e.g. "2² × 3²", and check
it some other way inside the oracle file's own small test if needed). `y78.test.ts` imports every oracle.

For a pick question whose right label isn't a number ("2² × 5", "4n + 1", "<"), add `shared/maths/y78/<name>.picks.ts`
exporting `PICK_CHECKS: Record<key, (parts, prompt, right, wrong) => void>` that checks the right label is right and every
wrong one is wrong, with plain arithmetic. Add the card's exports to `shared/maths/skillPacks/y78.ts`: that wires the
families, the ladder rows, the short names and the two-step keys everywhere.

Key prefixes must not clash with existing ones: `div:` is division facts (turned off with division), so divisibility is
`divis:`. Algebra parts (7y + 3, s², t) show full size with italic letters; a measure (9.1 km, 4 h 15 min) shows its numbers
big and its units small; a letter or unit straight after the blank goes in the blank's part (`?a`) or its own part.

Run: `npx vitest run shared/maths/y78.test.ts shared/maths/generated.test.ts` and `npx tsc -b`.
Screens: the preview at `npm run dev -- --config vite.ladder-cards-preview.config.ts` (port 5191),
`/preview/ladder-cards/?keys=a,b,c&seed=3` shows each type as pupils see it.

## Year 6 cards (docs/plans/ladder-y6/PLAN.md)

Same rules. Each Year 6 card is `shared/maths/skillPacks/y6<Name>.ts`, gathered by `skillPacks/y6.ts`; its rows say which skill
they go `after` (a run chains, each naming the one before). Oracles and pick checks live in `shared/maths/y6/`, and
`shared/maths/y78.test.ts` checks every Year 6 roll too, including that each part is 40 letters or fewer (the server refuses
longer parts, shared/gem-keep/save.ts).
