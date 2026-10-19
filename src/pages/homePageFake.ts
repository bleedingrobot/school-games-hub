/**
 * For tests: a pretend Supabase that answers the home page's and the lobby's old separate requests and their one new request each
 * (my_home_page, lobby) from the same made-up games, the way the database does (each list in the same order, with the same
 * limits). Everything sent is written down in `sent`. Use it with
 * vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase()).
 */

type Row = Record<string, unknown>;

export interface World {
  /** What the database's row rules let the pupil see, table by table (already in the shape the page asks for). */
  tables: Record<string, Row[]>;
  /** Answers of the jobs, by name. */
  jobs: Record<string, unknown>;
  me: string;
  /** Every request fails. */
  down?: boolean;
  /** Just these requests fail (rpc names or tables). */
  failing?: string[];
  /** These rpc requests never answer, as on a very slow connection. */
  waiting?: string[];
  /** my_home_page leaves out these parts (as an older answer would). */
  missing?: string[];
}

export const sent: string[] = [];
let world: World = { tables: {}, jobs: {}, me: 'me' };

export function setWorld(next: World) {
  world = next;
  sent.length = 0;
}

const DOWN = { data: null, error: { message: 'down' } };

/** A table read: the filters, order and limit the page uses. */
function read(table: string) {
  let rows = [...(world.tables[table] ?? [])];
  let single = false;
  const answer = () => (world.down || world.failing?.includes(table) ? DOWN : { data: single ? (rows[0] ?? null) : rows, error: null });
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, value: unknown) => ((rows = rows.filter((r) => r[col] === value)), chain),
    in: (col: string, values: unknown[]) => ((rows = rows.filter((r) => values.includes(r[col]))), chain),
    order: (col: string, opts?: { ascending?: boolean }) => (
      (rows = rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (opts?.ascending === false ? -1 : 1))), chain
    ),
    limit: (n: number) => ((rows = rows.slice(0, n)), chain),
    maybeSingle: () => ((single = true), Promise.resolve(answer())),
    single: () => ((single = true), Promise.resolve(answer())),
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(answer()).then(ok, bad),
  };
  return chain;
}

const newest = (rows: Row[] = [], col: string, n: number) =>
  [...rows].sort((a, b) => String(b[col]).localeCompare(String(a[col]))).slice(0, n);
const finished = (rows: Row[] = []) => rows.filter((r) => r.status === 'finished');
const open = (rows: Row[] = []) => rows.filter((r) => r.status === 'waiting' || r.status === 'playing');

/** What my_home_page() answers for this world. */
export function homeAnswer(): Row {
  const t = world.tables;
  const friendRecent = newest(finished(t.mp_games), 'finished_at', 5);
  const friendOpen = newest(open(t.mp_games), 'created_at', 10);
  const others = [...friendRecent, ...friendOpen.filter((g) => g.status === 'playing')]
    .flatMap((g) => [g.first_player, g.second_player])
    .filter((id) => id && id !== world.me);
  const job = (name: string) => world.jobs[name] ?? null;
  const home: Row = {
    progress: job('my_progress'),
    botRecent: newest(t.bot_games, 'finished_at', 5),
    botStats: job('my_bot_game_stats') ?? [],
    friendRecent,
    friendStats: job('my_friend_game_stats') ?? [],
    friendOpen,
    players: (t.profiles ?? []).filter((p) => others.includes(p.id)),
    spaceRecent: newest(finished(t.space_games), 'finished_at', 5),
    spaceOpen: newest(open(t.space_games), 'created_at', 10),
    spaceStats: job('my_space_game_stats'),
    cardRecent: newest(finished(t.card_game_seats), 'updated_at', 5),
    cardOpen: newest(open(t.card_game_seats), 'updated_at', 10),
    cardStats: job('my_card_game_stats'),
    powerRecent: newest(finished(t.power_games), 'finished_at', 5),
    powerOpen: newest(open(t.power_games), 'created_at', 10),
    powerStats: job('my_power_game_stats'),
    movesLeft: job('my_moves_left'),
    myClass: job('my_class'),
    focus: job('my_maths_focus'),
    ladder: job('my_ladder'),
  };
  for (const part of world.missing ?? []) delete home[part];
  return home;
}

/** What lobby() answers for this world: the four lobby jobs' lists, my open games, and the other players in them. */
export function lobbyAnswer(): Row {
  const t = world.tables;
  const friendOpen = newest(open(t.mp_games), 'created_at', 10);
  const spaceOpen = newest(open(t.space_games), 'created_at', 10);
  const cardOpen = newest(open(t.card_game_seats), 'updated_at', 10);
  const powerOpen = newest(open(t.power_games), 'created_at', 10);
  const others = [
    ...friendOpen.flatMap((g) => [g.first_player, g.second_player]),
    ...spaceOpen.flatMap((g) => [g.seat1, g.seat2, g.seat3, g.seat4]),
    ...cardOpen.flatMap((s) => (s.info as { players: unknown[] }).players),
    ...powerOpen.flatMap((g) => [g.seat1, g.seat2]),
  ].filter((id) => id && id !== world.me);
  const job = (name: string) => world.jobs[name] ?? [];
  return {
    friendLobby: job('lobby_games'),
    spaceLobby: job('space_lobby_games'),
    cardLobby: job('card_lobby_games'),
    powerLobby: job('power_lobby_games'),
    friendOpen,
    spaceOpen,
    cardOpen,
    powerOpen,
    players: (t.profiles ?? []).filter((p) => others.includes(p.id)),
  };
}

function rpc(name: string) {
  sent.push(`rpc ${name}`);
  const data = name === 'my_home_page' ? homeAnswer() : name === 'lobby' ? lobbyAnswer() : (world.jobs[name] ?? null);
  const answer = () => (world.down || world.failing?.includes(name) ? DOWN : { data, error: null });
  const reply = () => (world.waiting?.includes(name) ? new Promise<never>(() => {}) : Promise.resolve(answer()));
  return {
    maybeSingle: reply,
    single: reply,
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => reply().then(ok, bad),
  };
}

export function fakeSupabase() {
  const channel = { on: () => channel, subscribe: () => channel, unsubscribe: async () => 'ok', send: async () => 'ok' };
  return {
    supabase: {
      rpc,
      from: (table: string) => (sent.push(`from ${table}`), read(table)),
      functions: { invoke: async (name: string) => (sent.push(`function ${name}`), { data: null, error: null }) },
      channel: () => channel,
      removeChannel: async () => 'ok',
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Made-up pupils
// ---------------------------------------------------------------------------

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
/** The switches: every game on. */
const SETTINGS = { monsters_enabled: true, lord_enabled: true, clans_enabled: true, multiplayer_enabled: true, space_maths: 'choose' };

const friendGame = (id: string, game: string, first: string, second: string | null, status: string, minutesAgo: number, winner: string | null = null) => ({
  id, game, code: status === 'waiting' ? 'KM4TP' : null, in_lobby: status === 'waiting', created_by: first, first_player: first, second_player: second,
  status, moves: [], version: 1, created_at: at(minutesAgo + 30), expires_at: at(-10), started_at: status === 'waiting' ? null : at(minutesAgo + 29),
  turn_started_at: null, draw_offer: null, first_draw_offers: 0, second_draw_offers: 0, first_offer_ply: null, second_offer_ply: null,
  winner, reason: status === 'finished' ? (winner ? 'checkmate' : 'stalemate') : null, counts_for_points: true,
  finished_at: status === 'finished' ? at(minutesAgo) : null, first_wants_rematch: false, second_wants_rematch: false, rematch_game: null,
});
const spaceGame = (id: string, status: string, minutesAgo: number, places: number[] | null) => ({
  id, code: null, in_lobby: false, host: 'me', seat1: 'me', seat2: 'ben', seat3: null, seat4: null, status, setup: {}, rockets: 2,
  seat_info: [{}, {}], version: 3, created_at: at(minutesAgo + 20), expires_at: at(-10), started_at: at(minutesAgo + 19),
  finished_at: status === 'finished' ? at(minutesAgo) : null, ending: status === 'finished' ? 'docked' : null, places, counts: null, rematch_game: null,
});
const cardSeat = (game: string, status: string, minutesAgo: number, places: number[] | null) => ({
  game, player: 'me', seat: 0, version: 4, status,
  info: { status, players: ['me', 'ben'], places, ending: status === 'finished' ? 'finished' : null, expiresAt: at(-10) },
  updated_at: at(minutesAgo),
});
const powerGame = (id: string, status: string, minutesAgo: number, extra: Row = {}) => ({
  id, code: null, in_lobby: false, host: 'me', seat1: 'me', seat2: 'ben', loadouts: [], status, version: 5, created_at: at(minutesAgo + 15),
  expires_at: at(-10), started_at: at(minutesAgo + 14), finished_at: status === 'finished' ? at(minutesAgo) : null,
  ending: status === 'finished' ? 'finished' : null, leaver: null, won: status === 'finished' ? [true, false] : null, counts: null, rematch_game: null,
  ...extra,
});

/** A pupil with games of every kind, more than the page shows, a classmate's name, a hidden one, moves left and a teacher's focus. */
export function busyPupil(): World {
  return {
    me: 'me',
    tables: {
      app_settings: [SETTINGS],
      bot_games: [
        { id: 'b1', game: 'chess', bot_level: 'easy', result: 'won', reason: 'checkmate', finished_at: at(1), place: null, card101Place: null },
        { id: 'b2', game: 'checkers', bot_level: 'medium', result: 'lost', reason: 'abandoned', finished_at: at(9), place: null, card101Place: null },
        { id: 'b3', game: 'space', bot_level: 'easy', result: 'won', reason: 'docked', finished_at: at(13), place: 2, card101Place: null },
        { id: 'b4', game: '101', bot_level: 'very-easy', result: 'won', reason: 'finished', finished_at: at(17), place: null, card101Place: 1 },
        { id: 'b5', game: 'chess', bot_level: 'very-easy', result: 'drawn', reason: 'stalemate', finished_at: at(300), place: null, card101Place: null },
        { id: 'b6', game: 'chess', bot_level: 'easy', result: 'won', reason: 'checkmate', finished_at: at(400), place: null, card101Place: null },
      ],
      mp_games: [
        friendGame('f1', 'chess', 'me', 'ben', 'finished', 3, 'first'),
        friendGame('f2', 'checkers', 'cat', 'me', 'finished', 11, 'first'),
        friendGame('f3', 'chess', 'ben', 'me', 'finished', 500, null),
        friendGame('f4', 'chess', 'ben', 'me', 'playing', 0),
        friendGame('f5', 'checkers', 'me', 'cat', 'playing', 0),
        friendGame('f6', 'chess', 'me', 'ben', 'playing', 0),
        friendGame('f7', 'chess', 'me', null, 'waiting', 0),
      ],
      profiles: [{ id: 'ben', display_name: 'Brave Kiwi 7', avatar: {} }],
      space_games: [spaceGame('s1', 'finished', 5, [1, 2]), spaceGame('s2', 'finished', 600, [2, 1]), spaceGame('s3', 'playing', 0, null)],
      card_game_seats: [cardSeat('c1', 'finished', 7, [2, 1]), cardSeat('c2', 'finished', 700, [1, 2]), cardSeat('c3', 'playing', 0, null)],
      power_games: [
        powerGame('p1', 'finished', 15, { ending: 'abandoned', leaver: 'ben', won: [true, false] }),
        powerGame('p2', 'finished', 800),
        powerGame('p3', 'playing', 0),
      ],
    },
    jobs: {
      my_progress: {
        points: 60, level: 2, levelStart: 50, nextLevelAt: 125, weekPoints: 60,
        games: [{ game: 'chess', rank: { rank: 'silver', next: 'gold', progress: 0.5, gamesNeeded: null, ratedGames: 3 }, weekRatingChange: 5 }],
        achievements: [
          { id: 'chess-first-win', game: 'chess', name: 'First win', emoji: '🏆', measure: 'wins', goal: 1, progress: 1, earnedAt: at(100) },
          { id: 'checkers-first-win', game: 'checkers', name: 'Checkers win', emoji: '🏁', measure: 'wins', goal: 1, progress: 0, earnedAt: null },
        ],
        recent: [{ id: 'b1', points: 3 }, { id: 'f1', points: 5 }],
      },
      my_bot_game_stats: [
        { game: 'chess', played: 3, won: 2, lost: 0, drawn: 1 },
        { game: 'checkers', played: 1, won: 0, lost: 1, drawn: 0 },
        { game: 'space', played: 1, won: 1, lost: 0, drawn: 0 },
      ],
      my_friend_game_stats: [
        { game: 'chess', played: 2, won: 1, lost: 0, drawn: 1 },
        { game: 'checkers', played: 1, won: 0, lost: 1, drawn: 0 },
      ],
      my_space_game_stats: { played: 2, firsts: 1 },
      my_card_game_stats: { played: 2, won: 1 },
      my_power_game_stats: { played: 1, won: 1 },
      my_moves_left: { lord: null, clans: { fightsLeft: 3, perDay: 5 } },
      my_class: { className: null, groupName: null, waitingFor: null },
      my_maths_focus: { source: 'teacher-class', skills: ['tables-6-9'], onlyThese: false, endsAt: at(-600), canChoose: true, own: null },
      my_ladder: null,
    },
  };
}

/** A brand-new pupil: no games, in a class, no focus. */
export function newPupil(): World {
  return {
    me: 'me',
    tables: { app_settings: [SETTINGS] },
    jobs: {
      my_progress: { points: 0, level: 1, levelStart: 0, nextLevelAt: 20, weekPoints: 0, games: [], achievements: [], recent: [] },
      my_bot_game_stats: [],
      my_friend_game_stats: [],
      my_space_game_stats: { played: 0, firsts: 0 },
      my_card_game_stats: { played: 0, won: 0 },
      my_power_game_stats: { played: 0, won: 0 },
      my_moves_left: { lord: null, clans: null },
      my_class: { className: 'Room 12', groupName: null, waitingFor: null },
      my_maths_focus: { source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: false, own: null },
      my_ladder: null,
    },
  };
}

/**
 * A pupil in a busy lobby: open games of every kind to join (two of them made at the same moment), and their own games of every
 * kind being played and waiting, one with hidden Cat (no name) and one waiting game past its time (not offered).
 */
export function busyLobby(): World {
  const tie = at(2);
  const late = { expires_at: at(5) };
  return {
    me: 'me',
    tables: {
      app_settings: [SETTINGS],
      mp_games: [
        friendGame('f4', 'chess', 'ben', 'me', 'playing', 0),
        friendGame('f5', 'checkers', 'me', 'cat', 'playing', 4),
        friendGame('f7', 'chess', 'me', null, 'waiting', 1),
        friendGame('f1', 'chess', 'me', 'ben', 'finished', 3, 'first'),
      ],
      space_games: [
        spaceGame('s3', 'playing', 0, null),
        { ...spaceGame('s4', 'waiting', 2, null), code: 'JKMNP', in_lobby: true, seat2: 'dan' },
        { ...spaceGame('s5', 'waiting', 6, null), host: 'ben', seat1: 'ben', seat2: 'me', ...late },
        spaceGame('s1', 'finished', 5, [1, 2]),
      ],
      card_game_seats: [
        cardSeat('c3', 'playing', 0, null),
        { game: 'c4', player: 'me', seat: 0, version: 1, status: 'waiting', updated_at: at(1),
          info: { status: 'waiting', host: 'me', code: 'CDFGH', players: ['me', null, null], wanted: 3, places: null, ending: null, expiresAt: at(-10) } },
        { game: 'c5', player: 'me', seat: 1, version: 2, status: 'waiting', updated_at: at(3),
          info: { status: 'waiting', host: 'fin', code: 'QRTVW', players: ['fin', 'me'], wanted: 4, places: null, ending: null, expiresAt: at(-10) } },
        cardSeat('c1', 'finished', 7, [2, 1]),
      ],
      power_games: [powerGame('p3', 'playing', 0), { ...powerGame('p4', 'waiting', 1), seat2: null, code: 'XY346', in_lobby: true }],
      profiles: [
        { id: 'ben', display_name: 'Brave Kiwi 7', avatar: {} },
        { id: 'dan', display_name: 'Calm Tui 3', avatar: {} },
        { id: 'fin', display_name: 'Lively Lynx 5', avatar: {} },
      ],
    },
    jobs: {
      lobby_games: [
        { id: 'o1', game: 'checkers', creator_name: 'Lively Lynx 5', creator_avatar: {}, open_side: 'second', created_at: at(1) },
        { id: 'o2', game: 'chess', creator_name: 'Calm Tui 3', creator_avatar: {}, open_side: 'first', created_at: tie },
        { id: 'o3', game: 'chess', creator_name: 'Brave Kiwi 7', creator_avatar: {}, open_side: 'second', created_at: at(9) },
      ],
      space_lobby_games: [
        { id: 'o4', creator_name: 'Calm Tui 3', creator_avatar: {}, players: 2, board: { id: 'nebula' }, mode: 'cosmic', created_at: at(3) },
      ],
      card_lobby_games: [
        { id: 'o5', creator_name: 'Brave Kiwi 7', creator_avatar: {}, players: 1, wanted: 3, target: 50, created_at: tie },
        { id: 'o6', creator_name: 'Lively Lynx 5', creator_avatar: {}, players: 2, wanted: 2, target: 101, created_at: at(8) },
      ],
      power_lobby_games: [{ id: 'o7', creator_name: 'Lively Lynx 5', creator_avatar: {}, created_at: at(4) }],
    },
  };
}
