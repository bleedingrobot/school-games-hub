/**
 * Invites by name (docs/plans/play-anyone/PLAN.md, section D, stage 4). A kid who's here is invited from the Lobby
 * (board_invite_send in the database). Their Yes comes to the game's own server function as
 * `{ action: 'invite', invite: <id> }`: it claims the invite (board_invite_take checks every rule again), makes a private
 * game for just the two of them with the inviter in seat 1, and says where it is (board_invite_made), which the inviter
 * hears live.
 */

/** The board games that can be played by invite. */
export type InviteGame = 'chess' | 'checkers' | '101' | 'space' | 'power-clash';

export interface InviteServices {
  /** Claims the invite for `player` (who it was sent to). The inviter and their choices, or null if it isn't there to take. */
  takeInvite(invite: number, player: string, game: InviteGame): Promise<{ from: string; setup: unknown } | null>;
  /** The game is made at `path`, or couldn't be (null). */
  inviteMade(invite: number, path: string | null): Promise<void>;
}

/** The invite id in a request, or null. */
export function inviteIdOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** What a kid sees when the invite has gone (answered, called off, run out, or a switch went off). */
export const INVITE_GONE = 'That invite has gone. Ask your friend to send another.';

interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

/** The two database steps, for a function's entry.ts. Logs say which step went wrong, never who. */
export function inviteServices(admin: RpcClient, name: string): InviteServices {
  return {
    async takeInvite(invite, player, game) {
      const { data, error } = await admin.rpc('board_invite_take', { invite, player, kind: game });
      if (error) console.error(`${name}: invite take failed (${error.code ?? 'unknown'})`);
      const row = Array.isArray(data) ? (data[0] as { seat_a?: unknown; setup?: unknown } | undefined) : undefined;
      return row && typeof row.seat_a === 'string' ? { from: row.seat_a, setup: row.setup ?? null } : null;
    },
    async inviteMade(invite, path) {
      const { error } = await admin.rpc('board_invite_made', { invite, made_path: path });
      if (error) console.error(`${name}: invite made failed (${error.code ?? 'unknown'})`);
    },
  };
}
