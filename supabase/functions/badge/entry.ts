// Connects the badge handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions -- badge` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
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

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    async emailForBadge(code) {
      const { data, error } = await admin.rpc('badge_sign_in', { badge_code: code });
      if (error) {
        console.error(`badge: lookup failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      return typeof data === 'string' && data ? data : null;
    },
    async signInKeyFor(email) {
      // A magic-link key made on the server and handed straight back: no email is sent.
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      const key = data?.properties?.hashed_token;
      if (error || !key) {
        console.error(`badge: sign-in key failed (${error?.code ?? error?.status ?? 'none'})`);
        return 'busy';
      }
      return key;
    },
  }),
);
