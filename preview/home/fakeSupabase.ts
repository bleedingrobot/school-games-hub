/**
 * Preview only: stands in for src/lib/supabase (vite.home-preview.config.ts swaps it in), so the real site runs on made-up data in
 * the browser and never talks to the live server. A signed-in pupil with games of every kind; saving the avatar or theme is kept
 * in this page only.
 */
import { fakeSupabase, homeAnswer, setWorld, busyPupil } from '../../src/pages/homePageFake';
import { LADDER } from '../../shared/maths/ladder';
import { newStats } from '../../shared/maths/leitner';

// Profile card P12's child check: ?pupil=new (no avatar, no trophies), ?pupil=bronze (one bronze trophy) or ?pupil=gold (golds in two
// games, wearing the gold Dragon Head, and a typed name the teacher said Yes to). Leave it out for the usual busy pupil.
const PUPIL = new URLSearchParams(window.location.search).get('pupil');
let ME = {
  id: 'me',
  display_name: PUPIL === 'gold' ? 'Moana Star' : 'Speedy Otter 27',
  role: 'student',
  school_admin: false,
  avatar: (PUPIL === 'new' ? {} : PUPIL === 'gold' ? { kind: 'cat', bg: '#9b6bff', top: 'bow', pic: 'dm-first-five', picTier: 'gold' } : { kind: 'cat', bg: '#9b6bff', top: 'bow' }) as Record<string, string>,
};
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const secure = LADDER.filter((s) => s.built).slice(0, 4).flatMap((s) => s.keys.map((k) => ({ ...newStats(k), attempts: 3, correct: 3, box: 3 })));
const ladderInfo = { on: true, placed: 'done', placement: 'facts-10', furthest: null };
const focus = { source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: true, own: null, ladder: ladderInfo };

const world = busyPupil();
world.tables.app_settings = [{ ...world.tables.app_settings[0], bond_match_enabled: true, marble_enabled: true, gem_keep_enabled: true, trader_enabled: true, diamond_enabled: true }];
world.tables.profiles = [...(world.tables.profiles ?? []), ME];
// The "This season" strip: Clan Quest season 1. Change the day with ?day=N in the address (1 to 35).
const day = Math.min(35, Math.max(1, Number(new URLSearchParams(window.location.search).get('day')) || 24));
// The Dragon Maths strip: the same school date, and a level 7 hero (?level=N to change it).
const lordStart = new Date(Date.now() + 13 * 3_600_000 - (day - 1) * 86_400_000).toISOString().slice(0, 10);
const lordLevel = Math.min(12, Math.max(1, Number(new URLSearchParams(window.location.search).get('level')) || 7));
const moves = world.jobs.my_moves_left as { lord?: object | null };
world.jobs.my_moves_left = {
  ...moves,
  lord: { day: lordStart, forestLeft: 5, arenaLeft: 3, masterTried: false, masterExtra: 0, forestPerDay: 10, ...moves.lord, level: lordLevel, exp: 0 },
  season: { number: 1, day, daysLeft: 36 - day, clockOn: true },
  lordSeason: { start: lordStart, on: true },
};
/** A change to my profile: a new row each time, as the database would send, so the page sees it changed. */
function updateMe(avatar: Record<string, string>) {
  ME = { ...ME, avatar };
  world.tables.profiles = world.tables.profiles.map((p) => (p.id === 'me' ? ME : p));
}
world.tables.name_words = [
  { kind: 'adjective', word: 'Speedy' }, { kind: 'adjective', word: 'Brave' },
  { kind: 'animal', word: 'Otter' }, { kind: 'animal', word: 'Kiwi' },
];
world.jobs.my_progress = {
  points: 215, weekPoints: 48,
  games: [
    { game: 'chess', rank: { rank: 'silver', next: 'gold', progress: 0.4, gamesNeeded: null, ratedGames: 6 }, weekRatingChange: 5 },
    { game: 'checkers', rank: { rank: 'bronze', next: 'silver', progress: 0.7, gamesNeeded: null, ratedGames: 4 }, weekRatingChange: 2 },
  ],
  achievements: [
    { id: 'chess-first-win', game: 'chess', name: 'First win', emoji: '🏆', measure: 'wins', goal: 1, progress: 1, earnedAt: ago(3) },
    { id: 'chess-games-10', game: 'chess', name: 'Play 10 games', emoji: '🔟', measure: 'games', goal: 10, progress: 7, earnedAt: null },
    { id: 'checkers-first-win', game: 'checkers', name: 'First win', emoji: '🏁', measure: 'wins', goal: 1, progress: 1, earnedAt: ago(1) },
    { id: 'checkers-crown-5', game: 'checkers', name: 'Crown 5 kings', emoji: '👑', measure: 'crowns', goal: 5, progress: 2, earnedAt: null },
    { id: 'checkers-gold', game: 'checkers', name: 'Reach Gold', emoji: '🥇', measure: 'rank', goal: 2, progress: 1, earnedAt: null },
    { id: 'space-first', game: 'space', name: 'Dock first', emoji: '🚀', measure: 'firsts', goal: 1, progress: 1, earnedAt: ago(5) },
  ],
  recent: [{ id: 'b1', points: 3 }, { id: 'f1', points: 5 }],
};
world.jobs.my_maths_focus = focus;
world.jobs.my_ladder = { facts: secure, settings: {}, focus };
// How points work: the server's points rules, made up.
world.jobs.progress_rules = {
  bot: { 'very-easy': { lost: 1, drawn: 2, won: 3 }, easy: { lost: 2, drawn: 3, won: 5 }, medium: { lost: 3, drawn: 5, won: 8 } },
  friend: { lost: 4, drawn: 6, won: 8 },
  botDailyCap: 40, pairDailyLimit: 5, achievementPoints: 10, levels: [0, 50, 125, 225, 350, 500, 675, 875, 1100, 1350],
  ratingK: 20, weeklyMinGames: 3, allTimeMinGames: 5, improvedMinGames: 3, championMinGames: 15,
};
// The leaderboard (profile card P6): made-up classmates with their favourite trophies beside their names.
world.jobs.leaderboard = [
  { place: 1, display_name: 'Brave Kiwi 7', avatar: {}, rank: 'gold', points: 64, games: 12, is_me: false },
  { place: 2, display_name: 'Speedy Otter 27', avatar: {}, rank: 'silver', points: 48, games: 9, is_me: true },
  { place: 3, display_name: 'Calm Tui 3', avatar: {}, rank: 'bronze', points: 31, games: 7, is_me: false },
  { place: 4, display_name: 'Lively Lynx 5', avatar: {}, rank: 'bronze', points: 12, games: 3, is_me: false },
];
// My games (dashboard plan D2): what this made-up pupil plays most, and their class.
world.jobs.my_top_games = { mine: ['dragon-maths', 'archery', 'diamond', 'isles'], classGames: ['dragon-maths', 'archery', 'isles', 'clan-quest'] };
// The trophy cabinet (profile card P5): made-up trophies. ?trophies=0 shows an empty cabinet; ?new=1 shows the
// "New trophy!" moment on the first hub page.
const params = new URLSearchParams(window.location.search);
const win = (season: number, days: number) => ({ season, year: 2026, at: ago(days), detail: {} });
const cup = (id: string, game: string, name: string, how: string, tier: string, wins: ReturnType<typeof win>[], kind = 'trophy', repeat = 'season') => ({
  id, game, name, how, kind, repeat, art: null, tier, count: wins.length, firstAt: wins[0].at, lastAt: wins[wins.length - 1].at, isNew: false, wins,
});
const GOLD_PUPIL = [
  cup('dm-first-five', 'dragon-maths', 'Dragon Head', 'Be one of the first five in the school to slay the dragon in a season.', 'gold', [win(1, 40), win(2, 20), win(3, 2)], 'picture'),
  cup('isles-all', 'isles', 'Island Hopper', 'Light every island in Sky Isles.', 'gold', [win(1, 30), win(2, 12), win(3, 2)]),
  cup('cq-clan-win', 'clan-quest', 'Clan Champion', 'Be in the clan that tops Clan Quest at the end of a season.', 'silver', [win(2, 8), win(3, 1)]),
];
const BRONZE_PUPIL = [cup('isles-all', 'isles', 'Island Hopper', 'Light every island in Sky Isles.', 'bronze', [win(3, 1)])];
const TROPHIES = params.get('trophies') === '0' || PUPIL === 'new' ? [] : PUPIL === 'bronze' ? BRONZE_PUPIL : PUPIL === 'gold' ? GOLD_PUPIL : [
  cup('dm-first-five', 'dragon-maths', 'Dragon Head', 'Be one of the first five in the school to slay the dragon in a season.', 'silver', [win(1, 40), win(2, 3)], 'picture'),
  cup('dm-slayer', 'dragon-maths', 'Dragon Slayer', 'Slay the dragon in Dragon Maths.', 'gold', [win(1, 42), win(2, 5), win(3, 1), win(4, 0)]),
  cup('cq-clan-win', 'clan-quest', 'Clan Champion', 'Be in the clan that tops Clan Quest at the end of a season.', 'bronze', [win(2, 8)]),
  cup('isles-all', 'isles', 'Island Hopper', 'Light every island in Sky Isles.', 'gold', [win(1, 30), win(2, 12), win(3, 2)]),
  cup('chess-gold', 'chess', 'Chess Gold', 'Reach a gold rank in chess.', 'bronze', [win(0, 6)], 'trophy', 'once'),
];
let favourites = PUPIL ? [] : ['dm-slayer'];
world.jobs.my_trophies = {
  season: 3,
  trophies: TROPHIES,
  next: [
    { id: 'trader-forge', game: 'trader', name: 'Star Forge', how: 'Build the whole solar system in Star Trader.', kind: 'picture', repeat: 'season', art: null },
    { id: 'archery-bull', game: 'archery', name: 'Bullseye Ace', how: 'Hit five bullseyes in a row in Archery.', kind: 'trophy', repeat: 'season', art: null },
    { id: 'hub-regular', game: 'hub', name: 'Season Regular', how: 'Play on 15 different school days in one season.', kind: 'trophy', repeat: 'season', art: null },
    { id: 'diamond-gems', game: 'diamond', name: 'Gem Hoard', how: 'Fill the whole gem wall in Diamond Drop.', kind: 'trophy', repeat: 'season', art: null },
  ],
  favourites,
};
/** My trophy count and favourite three (profile card P6), as trophy_shelves and the home page send them. */
const myShelf = () => ({
  count: TROPHIES.length,
  favourites: favourites.map((id) => TROPHIES.find((t) => t.id === id)).filter((t) => t)
    .map((t) => ({ id: t!.id, game: t!.game, kind: t!.kind, name: t!.name, tier: t!.tier })),
});
const OTHERS: Record<string, unknown> = {
  'Brave Kiwi 7': { count: 6, favourites: [
    { id: 'isles-all', game: 'isles', kind: 'trophy', name: 'Island Hopper', tier: 'gold' },
    { id: 'cq-clan-win', game: 'clan-quest', kind: 'trophy', name: 'Clan Champion', tier: 'silver' },
    { id: 'dm-first-five', game: 'dragon-maths', kind: 'picture', name: 'Dragon Head', tier: 'bronze' },
  ] },
  'Calm Tui 3': { count: 1, favourites: [{ id: 'chess-gold', game: 'chess', kind: 'trophy', name: 'Chess Gold', tier: 'bronze' }] },
};
/** Two-game rewards (profile card P10): Board Master half lit, Double Slayer won. */
const half = (trophy: string, game: string, name: string, held: boolean) => ({ trophy, game, name, held });
const PAIRS = [
  { id: 'pair-double-slayer', name: 'Double Slayer', how: '', kind: 'picture', within: 'season', won: true,
    halves: [half('dm-slayer', 'dragon-maths', 'Slayer\'s Sword', true), half('clan-tooth', 'clan-quest', 'Monster Tooth', true)] },
  { id: 'pair-board-master', name: 'Board Master', how: '', kind: 'picture', within: 'year', won: false,
    halves: [half('chess-knight', 'chess', 'Champion\'s Knight', true), half('checkers-king', 'checkers', 'Champion\'s King', false)] },
  { id: 'pair-treasure-keeper', name: 'Treasure Keeper', how: '', kind: 'picture', within: 'year', won: false,
    halves: [half('isles-lighthouse', 'isles', 'Sky Lighthouse', true), half('diamond-heart', 'diamond', 'Heart Diamond', false)] },
];
/** The Leaderboard's Hall of fame (P10). Calm Tui 3's own name stays hidden: "A classmate". */
const HALL = {
  season: 3,
  dragon: [
    { season: 2, slayers: [
      { place: 1, name: 'Brave Kiwi 7', avatar: null }, { place: 2, name: ME.display_name, avatar: null }, { place: 3, name: null, avatar: null },
    ] },
    { season: 1, slayers: [{ place: 1, name: 'Calm Tui 3', avatar: null }] },
  ],
  pictures: [
    { trophy: 'pair-double-slayer', title: 'Double Slayer', game: 'hub', tier: 'bronze', name: ME.display_name, avatar: null, at: '2026-11-10T01:00:00Z' },
    { trophy: 'hub-allrounder', title: 'All-rounder', game: 'hub', tier: 'bronze', name: 'Brave Kiwi 7', avatar: null, at: '2026-11-08T01:00:00Z' },
    { trophy: 'pair-board-master', title: 'Board Master', game: 'hub', tier: 'bronze', name: null, avatar: null, at: '2026-11-06T01:00:00Z' },
  ],
};
let seasonNote = params.get('note') === '0' || PUPIL === 'new' ? null : { season: 3 };

let newOnes = params.get('new') ? [
  { id: 'dm-slayer', game: 'dragon-maths', name: 'Dragon Slayer', how: 'Slay the dragon in Dragon Maths.', kind: 'trophy', tier: 'gold', count: 4 },
  { id: 'dm-first-five', game: 'dragon-maths', name: 'Dragon Head', how: 'Be one of the first five in the school to slay the dragon in a season.', kind: 'picture', tier: 'silver', count: 2 },
] : [];
setWorld(world);

const base = fakeSupabase().supabase;
const session = { user: { id: 'me' }, access_token: 'preview' };
type Listener = (event: string, s: unknown) => void;

export const supabase = {
  ...base,
  rpc: (name: string, args?: Record<string, unknown>) => {
    if (name === 'save_my_avatar') {
      const avatar = { ...(args?.avatar as Record<string, string>) };
      // The server writes the ring itself.
      const worn = TROPHIES.find((t) => t.id === avatar.pic);
      if (worn) avatar.picTier = worn.tier;
      updateMe(avatar);
      return Promise.resolve({ data: null, error: null });
    }
    if (name === 'trophy_shelves') {
      const out: Record<string, unknown> = {};
      for (const n of (args?.names as string[]) ?? []) {
        if (n === ME.display_name) out[n] = myShelf();
        else if (OTHERS[n]) out[n] = OTHERS[n];
      }
      return Promise.resolve({ data: out, error: null });
    }
    if (name === 'my_home_page') {
      world.jobs.my_trophy_shelf = myShelf();
      world.jobs.my_season_note = seasonNote;
      return Promise.resolve({ data: homeAnswer(), error: null });
    }
    if (name === 'my_trophies') return Promise.resolve({ data: { ...(world.jobs.my_trophies as object), favourites }, error: null });
    if (name === 'my_trophy_pairs') return Promise.resolve({ data: PUPIL ? [] : PAIRS, error: null });
    if (name === 'my_name_status') {
      return Promise.resolve({
        data: { scrolls: 0, waiting: null, last: PUPIL === 'gold' ? { name: ME.display_name, status: 'approved', at: ago(2) } : null, canPickToday: true, typed: PUPIL === 'gold' },
        error: null,
      });
    }
    if (name === 'hall_of_fame') return Promise.resolve({ data: HALL, error: null });
    if (name === 'mark_season_note_seen') {
      seasonNote = null;
      return Promise.resolve({ data: null, error: null });
    }
    if (name === 'my_new_trophies') return Promise.resolve({ data: newOnes, error: null });
    if (name === 'mark_my_trophies_seen') {
      const n = newOnes.length;
      newOnes = [];
      return Promise.resolve({ data: n, error: null });
    }
    if (name === 'set_my_favourite_trophies') {
      favourites = ((args?.ids as string[]) ?? []).slice(0, 3);
      return Promise.resolve({ data: favourites, error: null });
    }
    return base.rpc(name);
  },
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (listener: Listener) => {
      setTimeout(() => listener('INITIAL_SESSION', session), 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signOut: async () => ({ error: null }),
    signInWithOAuth: async () => ({ error: null }),
    exchangeCodeForSession: async () => ({ error: null }),
  },
};

/** The preview's theme switcher saves the pupil's theme the way the profile page does. */
export function setPreviewTheme(theme: string) {
  const { theme: _old, ...rest } = ME.avatar;
  updateMe(theme === 'tidy' ? rest : { ...rest, theme });
}
export const previewTheme = () => ME.avatar.theme ?? 'tidy';
