/**
 * Preview only: stands in for src/lib/supabase (vite.teacher-preview.config.ts swaps it in) so the real site runs as a TEACHER on
 * made-up data with no network. ?scene=noclass | student | signedout picks another scene. Everything here is invented.
 */
import { GAME_IDS } from '../../src/data/foundational';
import { ALL_SWITCH_COLUMNS } from '../../src/data/games';
import { LADDER } from '../../shared/maths/ladder';
import { newStats } from '../../shared/maths/leitner';
import { busyPupil, newPupil, fakeSupabase, setWorld, homeAnswer } from '../../src/pages/homePageFake';

const SCENE = new URLSearchParams(window.location.search).get('scene') ?? 'teacher';
type Row = Record<string, unknown>;
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
const hex = (n: number) => (n * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(4);

export const unknownRpcs: string[] = [];
(window as unknown as { __unknownRpcs: string[] }).__unknownRpcs = unknownRpcs;

// ---- The made-up class ------------------------------------------------------------------------------------------------------
const CLASS_ID = 'room12';
const PEOPLE: [string, string, string | null][] = [
  ['s1', 'Speedy Otter 27', 'Ava Kingi'], ['s2', 'Brave Kiwi 8', 'Leo Smith'], ['s3', 'Calm Tui 3', 'Mia Patel'],
  ['s4', 'Lucky Weka 9', 'Noah Brown'], ['s5', 'Happy Ruru 4', 'Isla Wilson'], ['s6', 'Swift Kea 12', 'Ethan Tane'],
  ['s7', 'Jolly Fox 6', 'Zoe Nguyen'], ['s8', 'Bold Tiger 2', 'Jack Walker'], ['s9', 'Sunny Seal 15', 'Ruby Ngata'],
  ['s10', 'Clever Owl 21', 'Oliver Chen'],
];
const GROUP_OF: Record<string, string> = { s1: 'g1', s2: 'g1', s3: 'g1', s4: 'g1', s5: 'g2', s6: 'g2', s7: 'g2', s8: 'g2' };
const avatar = (n: number) => ({ kind: ['cat', 'dog', 'fox', 'owl'][n % 4], bg: ['#9b6bff', '#ff9b6b', '#6bd6ff', '#6bff9b'][n % 4] });
const GROUPS = [
  { id: 'g1', name: 'Kea', warpCode: 'TQ7HX', warpMode: 'ask', members: 4 },
  { id: 'g2', name: 'Tūī', warpCode: 'DW3NR', warpMode: 'ask', members: 4 },
];
const members = PEOPLE.map(([id, name, real], i) => ({
  id, name, realName: real, avatar: avatar(i), hidden: false, joinedAt: ago(60 * 24 * (40 - i)),
  group: GROUP_OF[id] ? (GROUP_OF[id] === 'g1' ? 'Kea' : 'Tūī') : null, groupId: GROUP_OF[id] ?? null,
}));
const AUTO = { source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: true, own: null, ladder: { on: true, placed: 'done', placement: 'facts-10', furthest: null } };
const classDetail = {
  id: CLASS_ID, name: 'Room 12', schoolYear: 2026, yearLevel: 4, archived: false, warpCode: 'KM4TP', warpMode: 'ask',
  members, groups: GROUPS, teachers: [{ id: 'me', name: 'Sneaky Dragon 28', realName: 'Sam Teacher' }],
};
const classSummary = { id: CLASS_ID, name: 'Room 12', school_year: 2026, year_level: 4, archived: false, warp_code: 'KM4TP', warp_mode: 'ask', members: 10, teaching: true, groups: 2, waiting: 2 };
const warpRequests = [
  { id: 'r1', class_id: CLASS_ID, class_name: 'Room 12', group_name: null, student_name: 'Fast Gecko 14', asked_at: ago(12) },
  { id: 'r2', class_id: CLASS_ID, class_name: 'Room 12', group_name: 'Kea', student_name: 'Quiet Moa 5', asked_at: ago(35) },
];
const events = [
  { id: 1, at: ago(20), kind: 'joined', student_name: 'Sunny Seal 15', group_name: null },
  { id: 2, at: ago(90), kind: 'joined-group', student_name: 'Clever Owl 21', group_name: 'Tūī' },
  { id: 3, at: ago(60 * 26), kind: 'added', student_name: 'Jolly Fox 6', group_name: null },
  { id: 4, at: ago(60 * 50), kind: 'joined', student_name: 'Bold Tiger 2', group_name: 'Kea' },
];
const unassigned = [
  { id: 'u1', display_name: 'Gentle Bee 3', real_name: 'Harper Jones', avatar: avatar(1) },
  { id: 'u2', display_name: 'Mighty Ant 9', real_name: 'Lucas Ward', avatar: avatar(2) },
];
const schoolTeachers = [{ id: 't2', display_name: 'Wise Heron 11', real_name: 'Priya Singh' }];

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const week = (i: number) => ({ shown: 40 + i * 9, skipped: i % 4 === 0 ? 9 : 2 });
const overview = {
  students: PEOPLE.map(([id, name, real], i) => ({
    id, name, realName: real, avatar: avatar(i), hidden: false, games: 12 + i * 5, points: 60 + i * 23,
    lastPlayed: ago(30 + i * 400), lastActive: ago(10 + i * 300), ...week(i), focus: i === 2 ? { ...AUTO, source: 'teacher-class', skills: ['times-2'], onlyThese: false, endsAt: ago(-60 * 24) } : AUTO,
  })),
};
const studentCard = (id: string) => {
  const i = Math.max(0, PEOPLE.findIndex((p) => p[0] === id));
  const [, name, real] = PEOPLE[i];
  return { id: PEOPLE[i][0], name, realName: real, avatar: avatar(i), role: 'student', hidden: false, classes: [{ id: CLASS_ID, name: 'Room 12' }], focus: AUTO, week: week(i) };
};
const built = LADDER.filter((l) => l.built);
const mapStudents = PEOPLE.map(([id, name, real], i) => ({
  id, name, realName: real,
  ladder: { on: true, placed: 'done', placement: built[0].id, furthest: built[Math.min(built.length - 1, 3 + i * 2)].id },
  settings: {},
  facts: built.slice(0, 2 + i * 2).flatMap((sk, k) => sk.keys.map((key) => ({
    ...newStats(key), attempts: 6, correct: 5 + ((i + k) % 2), avgMs: 3000 + 400 * ((i + k) % 5), box: Math.min(4, 1 + ((i * 3 + k) % 5)),
    lastSeen: Date.now() - 86_400_000 * (1 + (k % 6)), quickDays: [],
  }))),
}));
const skillMap = { class: { id: CLASS_ID, name: 'Room 12', yearLevel: 4, auto: true }, students: mapStudents };
const people = PEOPLE.map(([id, name, real], i) => ({
  id, display_name: name, real_name: real, avatar: avatar(i), role: 'student', hidden: false, bot_games: 8 + i, friend_games: 4 + i,
  points: 60 + i * 23, last_played: ago(30 + i * 400), joined: ago(60 * 24 * 40),
}));

// ---- Settings: every game switched on --------------------------------------------------------------------------------------------
const settingsRow: Row = {
  id: 1, students_choose_focus: true, maths_auto: true, multiplayer_enabled: true, space_reactions: true, space_maths: 'choose',
  question_skips: 'on', question_skip_mode: 'on', monsters_enabled: true, lord_enabled: true, clans_enabled: true,
};
for (const c of ALL_SWITCH_COLUMNS) settingsRow[c] = true;
Object.assign(settingsRow, {
  gem_keep_mode: 'calm', gem_keep_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], gem_keep_multiple_choice: false,
  clans_year_band: 'auto', clans_topics: ['add', 'times'], clans_tables: [2, 3, 4, 5, 10], clans_fights_per_day: 3, clans_season: 1,
  lord_forest_per_day: 10, lord_season_start: new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10), lord_paused_since: null, lord_topics: ['add', 'times'],
  monsters_topics: ['add', 'times'], marble_maths: 'choose', marble_rescue: true, mine_maths: 'choose', toonflap_maths: 'choose', toonflap_read_time: 4,
  trader_jumps: 3, trader_loans: true, trader_maths: 'choose', archery_duels: true, beanstalk_dots: true, hop_labels: true, isles_races: true,
  discount_days: [], unlimited_days: [], training_first: true, clan_raids_enabled: true, clan_typed_names: false, non_maths_games: true,
  trader_forge: true, trader_forge_typing: false,
  hop_help: true, korora_help: true, lizard_help: true, orderup_help: true, parrot_help: true, pigeon_help: true, pipi_help: true, robin_help: true,
  swamphen_help: true, tui_help: true, weka_help: true,
});

// ---- Student scenes use the home page's own fake -------------------------------------------------------------------------------
const PROFILE_TEACHER = { id: 'me', display_name: 'Sneaky Dragon 28', role: 'teacher', school_admin: false, avatar: {} };
const PROFILE_STUDENT = { id: 'me', display_name: 'Speedy Otter 27', role: 'student', school_admin: false, avatar: { kind: 'cat', bg: '#9b6bff' } };
const profile = SCENE === 'student' ? PROFILE_STUDENT : PROFILE_TEACHER;

const world = SCENE === 'student' ? newPupil() : busyPupil();
world.tables.profiles = [profile];
world.tables.app_settings = [settingsRow];
world.tables.name_words = [{ kind: 'adjective', word: 'Speedy' }, { kind: 'animal', word: 'Otter' }];
if (SCENE === 'student') {
  world.jobs.my_class = { className: null, groupName: null, waitingFor: null };
  world.jobs.my_maths_focus = AUTO;
}
setWorld(world);
const base = fakeSupabase().supabase;

const ok = (data: unknown) => Promise.resolve({ data, error: null });
let requests = [...warpRequests];

const answers: Record<string, (a: Row) => unknown> = {
  my_school_info: () => ({ id: 1, name: 'Douglas Park School', admin: false }),
  teacher_classes: () => (SCENE === 'noclass' ? [] : [classSummary]),
  teacher_class_detail: () => classDetail,
  teacher_unassigned_students: () => unassigned,
  teacher_school_teachers: () => schoolTeachers,
  teacher_class_events: () => events,
  teacher_warp_requests: () => (SCENE === 'noclass' ? [] : requests),
  teacher_class_badges: () => PEOPLE.map(([id, name, real], i) => ({ player: id, display_name: name, real_name: real, code: hex(i + 7) })),
  teacher_class_settings: () => settingsRow,
  teacher_class_overview: () => overview,
  teacher_student_card: (a) => studentCard(String(a.student)),
  teacher_students: () => people,
  teacher_student_detail: () => ({ points: 120, games: [], recent: [] }),
  teacher_maths_focuses: () => [],
  teacher_class_skill_map: () => skillMap,
  teacher_maths_focus_history: () => [],
  teacher_student_ladder: () => mapStudents[0].ladder,
  lord_school_season: () => ({ start: ago(60 * 24 * 20).slice(0, 10), pausedSince: null, number: 1, dayOfSeason: 21, daysLeft: 15, startsIn: null, canChange: true }),
  class_years: () => [],
  teacher_foundational_class: () => Object.fromEntries(PEOPLE.map(([id], i) => [id, Object.fromEntries(GAME_IDS.map((g, k) => [g, {
    daysDone: 2 + ((i + k) % 7), lastDay: day(i % 3), level: g === 'beanstalk' ? null : 1 + ((i + k) % 4), good: (i + k) % 3, since: day(1 + ((i * k) % 4) + (i === 3 && k < 3 ? 6 : 0)),
    recent: [{ d: day(i % 3), m: (i + k) % 3, t: 8, l: 1 + ((i + k) % 4), f: 6, ms: 2400 }], moves: [],
  }]).filter((_, k) => (i + k) % 5 !== 4))])),
  teacher_quick_looks_class: () => Object.fromEntries(PEOPLE.slice(0, 7).map(([id], i) => [id, { q: { f: 2 + (i % 5), p: 1, g: 1 }, sessions: 4 + i, recent: { answered: 30 + i * 4, correct: 24 + i * 3 }, last30: 8 + i, lastDay: day(i % 4) }])),
  teacher_progress_other_games: () => PEOPLE.flatMap(([id], i) => ['isles', 'diamond', 'archery'].map((game, k) => ({ student: id, game, value: 3 + i + k, at: ago(60 * (i + k)) }))),
  teacher_name_requests: () => [],
  teacher_new_trophies: () => [],
  teacher_question_skips: () => [],
  teacher_student_years: () => [],
  teacher_isles_halls: () => [],
  teacher_robin_class: () => ({ players: 8, feasts: 31 }),
  teacher_pipi_class: () => ({ players: 7, pearls: 24 }),
  teacher_beanstalk_class: () => ({ players: 9, eggs: 18 }),
  teacher_korora_class: () => ({ players: 6, fish: 22 }),
  teacher_tui_class: () => ({ players: 5, nests: 14 }),
  teacher_weka_class: () => ({ players: 6, baskets: 19 }),
  teacher_parrot_class: () => ({ players: 4, bells: 11 }),
  teacher_hop_class: () => ({ players: 7, jars: 16 }),
  teacher_lizard_class: () => ({ players: 4, prizes: 9 }),
  teacher_pigeon_class: () => ({ players: 5, prizes: 12 }),
  teacher_swamphen_class: () => ({ players: 3, prizes: 6 }),
  teacher_diamond_class: () => ({ players: 9, pastFive: 5, found: 41 }),
  teacher_toonflap_class: () => ({ players: 8, levels: 52, golds: 11 }),
  teacher_lord_class: () => ({ season: { number: 1, start: ago(60 * 24 * 20).slice(0, 10), daysLeft: 15 }, players: 9, thisSeason: 9, levels: [9, 9, 8, 7, 6, 5, 4, 2, 1, 0, 0, 0], hardest: [], refusals: [], hall: [] }),
  teacher_monster_class: () => ({ players: 8, badges: [8, 6, 4, 2, 1, 0], topics: [], hardest: [], refusals: [] }),
  teacher_clan_maths_class: () => ({ players: 8, kinds: [], hardest: [] }),
  teacher_gem_keep_class: () => ({ players: 9, levels: 60 }),
  teacher_orderup_class: () => ({ pupils: PEOPLE.slice(0, 6).map(([id], i) => ({ student: id, passed: 2 + i, at: ago(60 * i), stuck: i === 4, week: 1 + i, slip: null })), slips: [] }),
  teacher_glyph_class: () => ({ players: PEOPLE.slice(0, 5).map(([id], i) => ({ student: id, passed: 1 + i, walls: 3 + i, lastPlayed: ago(120 * i), stuckTemple: null, stuckDays: null })), hardest: [] }),
  teacher_isles_class: () => ({ students: PEOPLE.slice(0, 8).map(([id, name], i) => ({ id, name, islandName: null, spots: 5 + i, lighthouse: i % 3, turns: 10 + i * 3, worth: 40 + i * 12, lastPlayed: ago(90 * i) })), hall: [] }),
  teacher_game_sets: () => [],
  teacher_settings_changes: () => [],
  teacher_facts_checks: () => [],
  teacher_page_away: () => [],
  teacher_create_class: () => CLASS_ID,
  teacher_reset_warp_code: () => 'KM4TP',
  // Student side: Class Warp.
  warp_preview: (a) => (String(a.typed).toUpperCase() === 'KM4TP' ? { status: 'found', kind: 'class', name: 'Room 12', className: 'Room 12', leaving: null, alreadyIn: false, ask: true } : { status: 'nope' }),
  warp_join: (a) => (String(a.typed).toUpperCase() === 'KM4TP' ? { status: 'waiting', name: 'Room 12' } : { status: 'nope' }),
  my_class: () => ({ className: null, groupName: null, waitingFor: null }),
  my_maths_focus: () => AUTO,
  my_ladder: () => ({ facts: [], settings: {}, focus: AUTO }),
};

function rpc(name: string, args: Row = {}) {
  if (name in answers && !(SCENE === 'student' && name === 'my_class' && false)) return ok(answers[name](args));
  if (name.startsWith('teacher_answer_warp')) {
    requests = requests.filter((r) => r.id !== args.request);
    return ok(null);
  }
  if (name === 'my_home_page') return ok(homeAnswer());
  const known = (base as unknown as { rpc: (n: string) => Promise<{ data: unknown; error: unknown }> }).rpc(name);
  return known.then((r) => {
    if (r.data === null) unknownRpcs.push(name);
    if (name.startsWith('teacher_')) return { data: name.startsWith('teacher_set') || name.startsWith('teacher_save') || name.startsWith('teacher_use') || name.startsWith('teacher_end') ? null : r.data, error: null };
    return r;
  });
}

const session = SCENE === 'signedout' ? null : { user: { id: 'me' }, access_token: 'preview' };
type Listener = (event: string, s: unknown) => void;

export const supabase = {
  ...base,
  rpc,
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (listener: Listener) => {
      setTimeout(() => listener('INITIAL_SESSION', session), 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signOut: async () => ({ error: null }),
    signInWithOAuth: async () => ({ error: null }),
    exchangeCodeForSession: async () => ({ error: null }),
    initialize: async () => ({ error: null }),
  },
};
