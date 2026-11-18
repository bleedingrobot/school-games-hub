import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';

/** Fired when the database says "you're not signed in", so the page can check who (if anyone) still is. */
export const SIGNED_OUT_REPLY = 'hub:signed-out-reply';

/**
 * Every request, plus a look at the answer: a 401 from the database means this page has no session any more
 * (another Safari tab signed out, or Back brought an old page back) even if it still shows a pupil.
 */
async function watchfulFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (response.status === 401 && url.includes('/rest/v1/')) window.dispatchEvent(new Event(SIGNED_OUT_REPLY));
  return response;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: watchfulFetch },
});
