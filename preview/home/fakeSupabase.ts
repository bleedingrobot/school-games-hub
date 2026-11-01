/**
 * Preview only: stands in for src/lib/supabase (vite.home-preview.config.ts swaps it in), so the real site runs on made-up data in
 * the browser and never talks to the live server. A signed-in pupil with games of every kind; saving the avatar or theme is kept
 * in this page only.
 */
import { fakeSupabase, homeAnswer, setWorld, busyPupil } from '../../src/pages/homePageFake';
import { LADDER } from '../../shared/maths/ladder';
import { newStats } from '../../shared/maths/leitner';

let ME = { id: 'me', display_name: 'Speedy Otter 27', role: 'student', school_admin: false, avatar: { kind: 'cat', bg: '#9b6bff', top: 'bow' } as Record<string, string> };
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const secure = LADDER.filter((s) => s.built).slice(0, 4).flatMap((s) => s.keys.map((k) => ({ ...newStats(k), attempts: 3, correct: 3, box: 3 })));
const ladderInfo = { on: true, placed: 'done', placement: 'facts-10', furthest: null };
const focus = { source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: true, own: null, ladder: ladderInfo };

const world = busyPupil();
world.tables.app_settings = [{ ...world.tables.app_settings[0], bond_match_enabled: true, marble_enabled: true, gem_keep_enabled: true, trader_enabled: true }];
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
  points: 215, level: 3, levelStart: 125, nextLevelAt: 300, weekPoints: 48,
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
world.jobs.leaderboard = [];
setWorld(world);

const base = fakeSupabase().supabase;
const session = { user: { id: 'me' }, access_token: 'preview' };
type Listener = (event: string, s: unknown) => void;

export const supabase = {
  ...base,
  rpc: (name: string, args?: Record<string, unknown>) => {
    if (name === 'save_my_avatar') {
      updateMe({ ...(args?.avatar as Record<string, string>) });
      return Promise.resolve({ data: null, error: null });
    }
    if (name === 'my_home_page') return Promise.resolve({ data: homeAnswer(), error: null });
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
