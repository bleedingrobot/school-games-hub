// Connects the save-bot-game handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
import { FLUENT_DAYS, quickMsForPack, TOP_BOX } from '../../../shared/maths/config';
import { makePlaceSyncer } from '../../../shared/maths/syncPlace';
import { parseMathsSwitch } from '../../../shared/space/mathsSwitch';
import { stamper } from '../_shared/stamp';
import { handleSaveBotGame } from './handler';

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

const key = serverKey();
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** The database calls the ladder needs: the student's records and focus, and their furthest place. Placement is saved by gem-keep. */
const syncPlace = makePlaceSyncer({
  async loadContext(player) {
    const { data, error } = await admin.rpc('space_maths_context', { player });
    if (error) throw new Error(error.code ?? 'unknown');
    return (data as never) ?? null;
  },
  async savePlace(player, skill, rank) {
    const { error } = await admin.rpc('record_ladder_place', { player, skill, rank });
    if (error) throw new Error(error.code ?? 'unknown');
  },
  async savePlacementRow() {
    return false;
  },
}, Date.now, 0); // a game saves once, so there is nothing to space out

Deno.serve((request) =>
  handleSaveBotGame(request, {
    async userIdFor(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    async record(row) {
      const { error } = await admin.rpc('record_bot_game', row);
      if (!error) return 'saved';
      if (error.code === '54000') return 'too-many';
      console.error(`save-bot-game: database refused the game (${error.code})`);
      return 'refused';
    },
    async recordSpace(row) {
      const { error } = await admin.rpc('record_space_bot_game', row);
      if (!error) return 'saved';
      if (error.code === '54000') return 'too-many';
      console.error(`save-bot-game: database refused a space game (${error.code})`);
      return 'refused';
    },
    async record101(row) {
      const { error } = await admin.rpc('record_101_bot_game', row);
      if (!error) return 'saved';
      if (error.code === '54000') return 'too-many';
      console.error(`save-bot-game: database refused a 101 game (${error.code})`);
      return 'refused';
    },
    async recordPowerClash(row) {
      const { error } = await admin.rpc('record_power_clash_bot_game', row);
      if (!error) return 'saved';
      if (error.code === '54000') return 'too-many';
      console.error(`save-bot-game: database refused a Power Clash game (${error.code})`);
      return 'refused';
    },
    async mathsSwitch(player) {
      // The switch of this student's class (or their school's default if they have no class).
      const { data, error } = await admin.rpc('settings_of', { player }).maybeSingle();
      if (error) throw new Error(error.code ?? 'unknown');
      return parseMathsSwitch((data as { space_maths?: string } | null)?.space_maths);
    },
    async recordAnswers(player, batchId, answers, pack = 'times-tables') {
      const { error } = await admin.rpc('record_fact_answers', {
        player, pack, batch_id: batchId, answers, quick_ms: quickMsForPack(pack), fluent_days: FLUENT_DAYS, top_box: TOP_BOX,
      });
      if (error) throw new Error(error.code ?? 'unknown');
      await syncPlace(player);
    },
    // One key for all the seeded games; the stamped text says which game (and student) it's for.
    stamp: stamper(key, 'space-seed'),
  }),
);
