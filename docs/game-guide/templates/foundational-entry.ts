// Template from src/teacher/foundational/config.ts (the `lizard` entry) and src/data/foundational.ts.
// A junior game needs all four lines so it shows on the teacher's Progress tab (docs/game-guide/2-steps-and-progress.md).

// 1. src/teacher/foundational/config.ts, in GAMES. A name for every step; `order` lists the saved values from lowest to
//    highest step (only differs from 1..top when the game saves other numbers, as Hop does).
<id>: { name: '<Short name>', levelWord: 'step', levels: { 1: '<Step 1 name>', 2: '<Step 2 name>', 3: '<Step 3 name>' }, top: 3, order: [1, 2, 3] },

// 2. src/data/foundational.ts: add '<id>' to GAME_IDS, where its maths fits in the learning order.

// 3. src/teacher/progress/state.ts: games that move up on good goes go in GOOD_TO_PASS, taking the number from the
//    game's own config; games that move up when a step's facts are Secure go in STEP_KEYS.
import { GOOD_TO_PASS as <ID>_GOOD } from '../../../shared/<id>/config';
//    <id>: <ID>_GOOD,

// 4. src/teacher/progress/progress.test.tsx: one case that the game gets a column, the right step shows, and a pupil
//    one good go short shows "nearly".
