export type Player = 'X' | 'O';
export type Cell = Player | null;
export type PowerId = 'double-trouble' | 'body-swap' | 'freeze-ray' | 'board-wipe';
export type RoundStatus = 'active' | 'X' | 'O' | 'draw';

/** A square the named player may not place on until the end of their next turn. */
export interface Freeze {
  square: number;
  blockedFor: Player;
}

export interface PowerClashState {
  /** 9 squares, 0 top-left, reading left to right. */
  board: Cell[];
  active: Player;
  status: RoundStatus;
  /** The three powers each player picked for the match. */
  loadout: Record<Player, PowerId[]>;
  /** Powers already spent this match. */
  used: Record<Player, PowerId[]>;
  frozen: Freeze[];
  /** The power played this turn, if any (at most one). */
  powerThisTurn: PowerId | null;
  /** Symbols the active player may still place this turn (2 after Double Trouble). */
  placesLeft: number;
  /** Winning line squares once the round is won. */
  line: number[] | null;
}

export type Action =
  | { type: 'use-power'; power: PowerId; targets: number[] }
  | { type: 'place'; square: number }
  /** Only legal when every empty square is frozen for the player to move. */
  | { type: 'skip' };

export type PlayResult =
  | { ok: true; state: PowerClashState; events: GameEvent[] }
  | { ok: false; reason: string };

/** What happened, for the screen to animate. The engine has already decided the outcome. */
export type GameEvent =
  | { kind: 'place'; player: Player; square: number }
  | { kind: 'double-trouble'; player: Player }
  | { kind: 'body-swap'; player: Player; squares: [number, number] }
  | { kind: 'freeze'; player: Player; square: number }
  | { kind: 'wipe'; player: Player; square: number }
  | { kind: 'skip'; player: Player }
  | { kind: 'thaw'; square: number }
  | { kind: 'win'; player: Player; line: number[] }
  | { kind: 'draw' };
