import { FLUENT_DAYS, TOP_BOX, quickMsForPack } from '../../../shared/maths/config';
import { groupByPack } from '../../../shared/maths/focus';
import type { FactAnswer } from '../../../shared/maths/leitner';
import { countForFocuses } from './focusResults';

/** The one thing of the database client this needs, so a test can stand in for it. */
export type RpcWithData = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;

/** A UUID made from text: the same text always gives the same id, so a save sent twice is one batch. */
export async function batchIdFor(text: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`maths-answers:${text}`)));
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface Recorded {
  /** Answers the records took for the first time. */
  saved: number;
  /** Packs whose answers could not be saved (logged; the game goes on). */
  failed: number;
}

/**
 * Saves answers the server has marked, the one approved way (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.1 rule 6):
 * split by the pack that keeps each record, one batch per pack with an id made from `once` (something unique to this
 * save, such as the run's seed and the question's slot), each pack's own quick time, and the running maths focuses'
 * results counted for a batch the records took for the first time, so a retry never counts twice.
 * It never throws: a problem is logged with its code (never who) and the game goes on.
 */
export async function recordMathsAnswers(rpc: RpcWithData, player: string, answers: readonly FactAnswer[], once: string, from: string): Promise<Recorded> {
  const result: Recorded = { saved: 0, failed: 0 };
  for (const [pack, group] of groupByPack(answers)) {
    try {
      const { data, error } = await rpc('record_fact_answers', {
        player,
        pack,
        batch_id: await batchIdFor(`${from}:${once}:${pack}`),
        answers: group,
        quick_ms: quickMsForPack(pack),
        fluent_days: FLUENT_DAYS,
        top_box: TOP_BOX,
      });
      if (error) {
        result.failed++;
        console.error(`${from}: record answers failed (${error.code ?? 'unknown'})`);
        continue;
      }
      const saved = typeof data === 'number' ? data : 0;
      result.saved += saved;
      if (saved > 0) await countForFocuses(rpc, player, pack, group, from);
    } catch {
      result.failed++;
      console.error(`${from}: record answers failed`);
    }
  }
  return result;
}
