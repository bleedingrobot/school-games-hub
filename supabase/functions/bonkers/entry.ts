// Connects the bonkers (Smash Quest) handler to Supabase. Edit handler.ts (or shared/bonkers/server.ts) for the logic, then
// run `npm run build:functions -- bonkers` to rebuild index.ts, the single file that actually gets deployed (never committed).
import { createClient } from '@supabase/supabase-js';
import { parseFocus } from '../../../shared/maths/focus';
import type { FactStats } from '../../../shared/maths/leitner';
import { unplayed, type BossState, type KeptAdventure, type Saved } from '../../../shared/bonkers/server';
import { isUnlimitedFor } from '../../../shared/unlimited';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';
import { makeHandler } from './handler';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

/** The server's own key. Supabase provides it automatically; it never leaves the server. */
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  return keys.default ?? Object.values(keys)[0] ?? '';
}

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Calls a database function: its answer, or 'busy'. Logs say which one and the error code, never who. */
async function call<T>(name: string, args: Record<string, unknown>): Promise<T | 'busy'> {
  const { data, error } = await admin.rpc(name, args);
  if (!error) return data as T;
  console.error(`bonkers: ${name} failed (${error.code ?? 'unknown'})`);
  return 'busy';
}

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    userIdFor: userIdFromToken(admin.auth),
    async settings(player) {
      // The switches of this pupil's class (or their school's default if they have no class).
      // Teachers trying it out always have unlimited adventures (their own row, not a class's).
      const [{ data, error }, who] = await Promise.all([
        admin.rpc('settings_of', { player }).maybeSingle(),
        admin.from('profiles').select('role, school:schools!profiles_school_id_fkey(hub_season_start, hub_season_days)').eq('id', player).maybeSingle(),
      ]);
      if (error || !data || who.error) {
        console.error(`bonkers: settings failed (${error?.code ?? 'none'})`);
        return null;
      }
      const row = data as { bonkers_enabled?: boolean; unlimited_days?: unknown };
      // "Unlimited today" is on while the class's unlimited_days names today's NZ date for Smash Quest.
      const me = who.data as { role?: string; school?: { hub_season_start?: string; hub_season_days?: number } | null } | null;
      const teacher = me?.role === 'teacher';
      // The school's season clock (the embed names profiles_school_id_fkey: schools.contact_teacher points back at
      // profiles, and an unnamed embed fails as ambiguous), for the home screen's boss timeline (Smash Quest's season is the hub season).
      const season = me?.school?.hub_season_start && me.school.hub_season_days ? { start: me.school.hub_season_start, days: me.school.hub_season_days } : null;
      return { enabled: teacher || row.bonkers_enabled === true, unlimited: teacher || isUnlimitedFor(row.unlimited_days, 'bonkers'), season };
    },
    async load(player) {
      const saved = await call<Saved | null>('bonkers_load', { player });
      return saved === 'busy' ? 'busy' : (saved ?? unplayed());
    },
    async maths(player) {
      const context = await call<{ facts: FactStats[]; settings: { enabledTables?: number[]; division?: boolean; missingFactor?: boolean | null }; focus?: unknown } | null>('space_maths_context', { player });
      if (context === 'busy' || !context) return 'busy';
      const { enabledTables, division, missingFactor } = context.settings ?? {};
      const focus = parseFocus(context.focus);
      return {
        facts: context.facts ?? [],
        // Anything odd counts as no focus: the questions are then the times-table step.
        ...(focus ? { focus } : {}),
        settings: { enabledTables, division, ...(typeof missingFactor === 'boolean' ? { missingFactor } : {}) },
      };
    },
    current: (player) => call<KeptAdventure | null>('bonkers_current', { player }),
    saveHero: (player, version, progress) => call<boolean>('bonkers_save', { player, version, progress }),
    start: (player, version, progress, kept) =>
      call<boolean>('bonkers_start', { player, version, progress, seed: kept.seed, quest: kept.adventure.quest.id, adventure: kept.adventure, questions: kept.questions }),
    mark: (player, seed, slot, mark) => call<boolean>('bonkers_mark', { player, seed, slot, mark }),
    finish: (player, seed, version, progress, result) => call<boolean>('bonkers_finish', { player, seed, version, progress, result }),
    async recordAnswers(player, once, answers) {
      // Saved the one approved way: per pack, each pack's own quick time, and counted for the teacher's focus results.
      await recordMathsAnswers((name, args) => admin.rpc(name, args), player, answers, once, 'bonkers');
    },
    async awardPoints(player, points, once) {
      const { error } = await admin.rpc('add_game_points', { player, game: 'bonkers', points, once });
      if (error) console.error(`bonkers: points failed (${error.code ?? 'unknown'})`);
    },
    async progressChanged(player) {
      const { error } = await admin.rpc('game_progress_changed', { player, game: 'bonkers' });
      if (error) console.error(`bonkers: achievements failed (${error.code ?? 'unknown'})`);
    },
    boss: (player, key, add, finishing) =>
      call<BossState | null>('bonkers_class_boss', { player, season: key.season, week: key.week, mega: key.mega, add, finishing }),
  }),
);
