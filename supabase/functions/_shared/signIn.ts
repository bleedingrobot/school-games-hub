import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Who owns this sign-in token? Null if it's missing, expired, fake or not a signed-in user's.
 *
 * With the project's newer sign-in keys, the token's signature is checked right here against the
 * project's public keys (fetched once and kept for 10 minutes), with no trip to the sign-in
 * service. With the older shared secret (or a token signed with a key we don't know), the library
 * asks the sign-in service instead, exactly as `getUser` did. So this works the same before and
 * after the keys are switched in the Supabase dashboard; it only gets cheaper after.
 */
export function userIdFromToken(auth: Pick<SupabaseClient['auth'], 'getClaims'>) {
  return async (token: string): Promise<string | null> => {
    try {
      const { data, error } = await auth.getClaims(token);
      const claims = error ? null : data?.claims;
      // Only a signed-in user's token: never the site's public key or the server's own key.
      if (!claims || claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !claims.sub) return null;
      return claims.sub;
    } catch {
      return null;
    }
  };
}
