// Opens a pupil's waiting Game Coins pouches (docs/QUEST-REWARDS-PLAN.md, stage 5). The SQL function does the adding;
// the game's edge function calls this right after its own load handling, with the version of the save it now holds.

/** What the database says an opened pouch did: the money added and the save's new version. */
export interface OpenedPouch {
  amount: number;
  version: number;
}

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;

/** Opens waiting pouches. Null means nothing to open, the save moved on, or it could not be done: the game just carries on. */
export async function openCoinPouches(rpc: Rpc, player: string, game: string, expectedVersion: number, perUnit = 1): Promise<OpenedPouch | null> {
  const { data, error } = await rpc('open_coin_pouches', { player, game, expected_version: expectedVersion, per_unit: perUnit });
  if (error) {
    console.error(`${game}: open_coin_pouches failed (${error.code ?? 'unknown'})`);
    return null;
  }
  const row = data as Partial<OpenedPouch> | null;
  if (!row || !Number.isInteger(row.amount) || !Number.isInteger(row.version) || (row.amount as number) <= 0) return null;
  return { amount: row.amount as number, version: row.version as number };
}
