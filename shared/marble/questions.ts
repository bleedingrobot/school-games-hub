/**
 * Making and marking the questions of a Marble Rush run (docs/MARBLE-PLAN.md, section 7). The server makes the list when a
 * run starts, keeps it where students can't read it, and marks every answer against it.
 *
 * Questions come from the shared focus system, as in Mission Control: `makeSpacePack` -> `makeFocusPack`, so a teacher's
 * focus, a student's own pick or the whole ladder (auto) all decide what the gates, pit stops and rescues ask.
 * The code now lives in shared/maths/serverQuestions.ts, which Clan Quest's Battle Cry uses too.
 */
export { makeRunQuestions, markQuestion, sameAnswer, type MathsContext } from '../maths/serverQuestions';
