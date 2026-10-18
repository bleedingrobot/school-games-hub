/** Connects Clan Quest to the live `clans` server function, with the student's sign-in. Nothing uses this until Clan Quest goes live. */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { makeClanServer, type ClanServer } from '../games/clans/remote';
import { supabase } from '../lib/supabase';

export function liveClanServer(): ClanServer {
  return makeClanServer({
    url: `${SUPABASE_URL}/functions/v1/clans`,
    apikey: SUPABASE_PUBLISHABLE_KEY,
    token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  });
}
