import { focusResultAnswers } from '../../../shared/maths/focusResults';
import type { FactAnswer } from '../../../shared/maths/leitner';

/** The one thing of the database client this needs, so a test can stand in for it. */
export type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>;

/**
 * Adds a batch of answers to the results of the maths focuses running for the student (stage F.8). Call it only for a batch the
 * records took for the first time (record_fact_answers says 0 for one it has seen), so a retry never counts twice. It never
 * throws and never blocks saving: the answers are already saved, and a problem here is only logged (the code, never who).
 */
export async function countForFocuses(rpc: Rpc, player: string, pack: string, answers: readonly FactAnswer[], from: string): Promise<void> {
  try {
    const rows = focusResultAnswers(answers, pack);
    if (rows.length === 0) return;
    const { error } = await rpc('add_maths_focus_results', { player, answers: rows });
    if (error) console.error(`${from}: focus results not counted (${error.code ?? 'unknown'})`);
  } catch {
    console.error(`${from}: focus results not counted`);
  }
}
