import { FLUENT_DAYS, TOP_BOX, keptMs, quickMsForPack } from '../../../shared/maths/config';
import { groupByPack } from '../../../shared/maths/focus';
import type { FactAnswer } from '../../../shared/maths/leitner';
import { makePlaceSyncer } from '../../../shared/maths/syncPlace';
import { quickMsForKey, SLOW_KEYS } from '../../../shared/maths/slow';
import { isUntimed, UNTIMED_MS } from '../../../shared/maths/untimed';
import { countForFocuses } from './focusResults';

/** The one thing of the database client this needs, so a test can stand in for it. */
export type RpcWithData = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;

/** A UUID made from text: the same text always gives the same id, so a save sent twice is one batch. */
export async function batchIdFor(text: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`maths-answers:${text}`)));
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** `given` passes through only as a finite number or a string of at most 20 characters; anything else is left off. */
export function cleanGiven(a: FactAnswer): FactAnswer {
  const { given, ...rest } = a;
  const ok = (typeof given === 'number' && Number.isFinite(given)) || (typeof given === 'string' && given.length > 0 && given.length <= 20);
  return ok ? { ...rest, given } : rest;
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
 * save, such as the run's seed and the question's slot), each pack's own quick time, times kept to at most two
 * minutes (`keptMs`), and the running maths focuses'
 * results counted for a batch the records took for the first time, so a retry never counts twice.
 * It never throws: a problem is logged with its code (never who) and the game goes on.
 */
export async function recordMathsAnswers(
  rpc: RpcWithData,
  player: string,
  answers: readonly FactAnswer[],
  once: string,
  from: string,
  // A game that made its own batch ids before this helper existed keeps making them the same way, so a save sent again
  // after the switch still counts once.
  batchId: (once: string, pack: string) => Promise<string> = (o, pack) => batchIdFor(`${from}:${o}:${pack}`),
  // A game for young children can give its own quick time (shared/juniorQuick.ts) instead of each pack's own.
  quickMs?: number,
  // A right answer faster than this is saved but is not quick (S14, shared/juniorQuick.ts). Left out: no floor.
  minMs?: number,
): Promise<Recorded> {
  const result: Recorded = { saved: 0, failed: 0 };
  for (const [pack, all] of groupByPack(answers)) {
    // Untimed skills (shared/maths/untimed.ts) go in their own batch, where any right answer is quick.
    const untimed = all.filter((a) => isUntimed(a.key, pack));
    // Two-step types (shared/maths/slow.ts) go in a batch of their own too, with 12 seconds to be quick.
    const slow = all.filter((a) => !isUntimed(a.key, pack) && SLOW_KEYS.has(a.key));
    const timed = all.filter((a) => !isUntimed(a.key, pack) && !SLOW_KEYS.has(a.key));
    const groups = [[timed, 'timed'], [untimed, 'untimed'], [slow, 'slow']] as const;
    for (const [group, kind] of groups) {
      if (group.length === 0) continue;
      const untimedGroup = kind === 'untimed';
      const baseQuick = quickMs ?? quickMsForPack(pack);
      try {
        const { data, error } = await rpc('record_fact_answers', {
          player,
          pack,
          // The timed batch keeps the id it always had, so a save sent again after this change still counts once. The untimed
          // batch always gets its own id (a game's own batch ids may not name the pack).
          batch_id: kind === 'timed' ? await batchId(once, pack) : await batchIdFor(`${from}:${once}:${pack}:${kind}`),
          // Times as they are kept: at most two minutes (a pupil who wandered off isn't slow at the fact).
          answers: group.map((a) => ({ ...cleanGiven(a), ms: keptMs(a.ms) })),
          quick_ms: untimedGroup ? UNTIMED_MS : kind === 'slow' ? quickMsForKey(group[0].key, baseQuick) : baseQuick,
          fluent_days: FLUENT_DAYS,
          top_box: TOP_BOX,
          min_ms: minMs ?? 0,
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
  }
  if (result.saved > 0) await syncLadderPlace(rpc, player);
  return result;
}

/** When each student's place was last worked out, so a busy game reads their records at most every 30 seconds. */
const placeSyncedAt = new Map<string, number>();

/**
 * Moves a student's furthest place on the ladder forward after their answers are saved (shared/maths/syncPlace.ts), so every
 * game that saves answers keeps the place up to date, not only Gem Keep, Monsters and Space. It never throws; the database
 * only ever moves the place forward.
 */
export async function syncLadderPlace(rpc: RpcWithData, player: string, now = Date.now()): Promise<void> {
  const before = placeSyncedAt.get(player);
  if (before !== undefined && now - before < 30_000) return;
  if (placeSyncedAt.size > 5000) placeSyncedAt.clear();
  placeSyncedAt.set(player, now);
  const sync = makePlaceSyncer(
    {
      async loadContext(id) {
        const { data, error } = await rpc('space_maths_context', { player: id });
        if (error) throw new Error(error.code ?? 'unknown');
        return (data as never) ?? null;
      },
      async savePlace(id, skill, rank) {
        const { error } = await rpc('record_ladder_place', { player: id, skill, rank });
        if (error) throw new Error(error.code ?? 'unknown');
      },
      async savePlacementRow() {
        return false;
      },
    },
    () => now,
    0,
  );
  await sync(player);
}
