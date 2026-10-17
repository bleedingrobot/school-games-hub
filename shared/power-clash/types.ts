export type Player = 'X' | 'O';
/** A source of random numbers from 0 up to (not including) 1. */
export type Random = () => number;
export type Cell = Player | null;
export type PowerId =
  | 'body-swap'
  | 'freeze-ray'
  | 'board-wipe'
  | 'force-field'
  | 'portal-chaos'
  | 'wild-card'
  | 'time-heist';
export type RoundStatus = 'active' | 'X' | 'O' | 'draw';

/** A square the named player may not place on until the end of their next turn. */
export interface Freeze {
  square: number;
  blockedFor: Player;
}

/** A symbol its owner has protected until the owner's next turn starts. */
export interface Shield {
  square: number;
  owner: Player;
}

/** The parts of a round a Time Heist puts back: how things stood at the start of a turn. */
export interface TurnSnapshot {
  board: Cell[];
  frozen: Freeze[];
  shields: Shield[];
  used: Record<Player, PowerId[]>;
  /** True if that turn was itself a Time Heist (those can't be undone). */
  heist: boolean;
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
  /** Protected symbols (Force Field). */
  shields: Shield[];
  /** The power played this turn, if any (at most one). */
  powerThisTurn: PowerId | null;
  /** Symbols the active player may still place this turn (2 after a Wild Card bonus). */
  placesLeft: number;
  /** Winning line squares once the round is won. */
  line: number[] | null;
  /** Chaos Mode: a surprise after every third go. */
  chaos: boolean;
  /** Turns finished this round. */
  turns: number;
  /** How things stood when the turn that is being played began (becomes `rewind` when it ends). */
  turnStart: TurnSnapshot;
  /** The last finished turn, for Time Heist. Null at the start of a round and right after a Time Heist. */
  rewind: TurnSnapshot | null;
}

/** The random effects a Wild Card can have. */
export type WildEffect = 'bonus' | 'freeze' | 'swap' | 'remove';
/** The surprises Chaos Mode can bring. */
export type ChaosKind = 'earthquake' | 'frost-wave' | 'meteor' | 'lucky-star' | 'recharge';

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
  | { kind: 'bonus-move'; player: Player }
  | { kind: 'body-swap'; player: Player; squares: [number, number] }
  | { kind: 'freeze'; player: Player; square: number }
  | { kind: 'wipe'; player: Player; square: number }
  | { kind: 'force-field'; player: Player; square: number }
  /** The symbol on from[0] now sits on to[0], and the one on from[1] on to[1]. */
  | { kind: 'portal-chaos'; player: Player; from: [number, number]; to: [number, number] }
  /** The wheel landed on `effect`; the events after it show what it did. */
  | { kind: 'wild-card'; player: Player; effect: WildEffect }
  /** `board` is how the board looked before it rewound. */
  | { kind: 'time-heist'; player: Player; board: Cell[] }
  | { kind: 'skip'; player: Player }
  | { kind: 'thaw'; square: number }
  | { kind: 'shield-off'; square: number }
  /** A Chaos Mode surprise. `affects` is who it helps or hurts (the player about to move). */
  | { kind: 'chaos'; event: ChaosKind; affects: Player; squares: number[]; power?: PowerId }
  | { kind: 'win'; player: Player; line: number[] }
  | { kind: 'draw' };
