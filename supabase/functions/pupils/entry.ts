// Connects the pupils handler to Supabase. Edit handler.ts for the logic, then run
// `npm run build:functions -- pupils` to rebuild index.ts, the single file that actually gets deployed.
import { createClient } from '@supabase/supabase-js';
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

/** The biggest Doc or Sheet export read: a class list is a few KB. */
const MAX_TEXT = 1024 * 1024;

Deno.serve(
  makeHandler({
    now: () => Date.now(),
    userIdFor: userIdFromToken(admin.auth),
    async mayCreate(teacher, emails) {
      const { data, error } = await admin.rpc('pupils_may_create', { teacher, emails });
      if (error) {
        console.error(`pupils: pupils_may_create failed (${error.code ?? 'unknown'})`);
        return 'busy';
      }
      return Array.isArray(data) ? (data as string[]) : [];
    },
    async createAccount(email) {
      // Email marked as checked, so a later Google sign-in with the same school email joins this account.
      const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (!error) return 'made';
      if (error.code === 'email_exists' || error.status === 422) return 'exists';
      console.error(`pupils: create failed (${error.code ?? error.status ?? 'unknown'})`);
      return 'failed';
    },
    async fetchText(url) {
      try {
        const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
        // A file that isn't shared sends Google's sign-in page instead.
        if (!response.ok || (response.headers.get('Content-Type') ?? '').includes('text/html')) return null;
        const text = await response.text();
        return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
      } catch {
        return null;
      }
    },
  }),
);
