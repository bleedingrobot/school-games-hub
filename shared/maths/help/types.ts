/**
 * Help me on every ladder question (docs/plans/help-me/PLAN.md, James 26 Nov 2026). A help card teaches a way to get the
 * answer: a mental trick, a fact the pupil already knows, or the steps worked with the question's own numbers. It never
 * gives the answer: the last step always ends with "?" for the pupil to finish.
 *
 * Help is worked out from what the question shows (parts, prompt, choices), not from its record key, because a game's
 * server sends the browser only what it shows (PublicQuestion). So every helper reads the screen, like a pupil would.
 */

/** What a helper can see of a question: what the pupil sees. */
export interface HelpQuestion {
  parts: readonly string[];
  prompt?: string;
  choices?: readonly number[];
  choiceLabels?: readonly string[];
  figure?: unknown;
}

export interface HelpCard {
  /** Short name for the kind of help, kept with each helped answer for the teacher ("tables", "bonds-100"). */
  kind: string;
  /** The trick, in a few words: "Times 10, take away one lot". */
  title: string;
  /** Two to four short steps, using the question's own numbers. The last one ends with "?" (the pupil finishes it). */
  steps: string[];
}

export interface HelpContext {
  /** True if the pupil already has this fact secure ("mul:6x7"), so help can start from it. Leave out when unknown. */
  known?: (factKey: string) => boolean;
}

/** One kind of question: a card if it recognises the question, else null. */
export type Helper = (q: HelpQuestion, ctx: HelpContext) => HelpCard | null;
