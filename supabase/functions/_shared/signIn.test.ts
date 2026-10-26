import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { userIdFromToken } from './signIn';

// The real Supabase library, talking to a pretend sign-in service, with real signed tokens:
// newer-style ones signed with an ES256 key pair (what the project uses after the switch in the
// dashboard) and older-style ones that only the sign-in service can check.

const URL_BASE = 'https://test.supabase.co';
const PUPIL = '11111111-1111-4111-8111-111111111111';
const NOW_S = () => Math.floor(Date.now() / 1000);

type Keys = { privateKey: CryptoKey; jwk: JsonWebKey & { kid: string; alg: string } };

async function makeKeys(kid: string): Promise<Keys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, jwk: { ...jwk, kid, alg: 'ES256', key_ops: ['verify'] } };
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const part = (value: object) => b64url(new TextEncoder().encode(JSON.stringify(value)));

async function signed(keys: Keys, payload: object, kid = keys.jwk.kid): Promise<string> {
  const head = `${part({ alg: 'ES256', typ: 'JWT', kid })}.${part(payload)}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(head));
  return `${head}.${b64url(new Uint8Array(sig))}`;
}

/** An older-style token: shared-secret signed, so only the sign-in service can say if it's real. */
function legacy(payload: object): string {
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.${b64url(new Uint8Array(32))}`;
}

const pupil = (extra: object = {}) => ({ sub: PUPIL, role: 'authenticated', aud: 'authenticated', exp: NOW_S() + 3600, ...extra });

/** The pretend sign-in service: the public keys, and "who is this?" for tokens it knows. */
function service(published: () => Keys['jwk'][], known: Set<string> = new Set()) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const path = url.replace(URL_BASE, '');
    calls.push(path);
    if (path === '/auth/v1/.well-known/jwks.json') return Response.json({ keys: published() });
    if (path === '/auth/v1/user') {
      const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '') ?? '';
      if (known.has(token)) return Response.json({ id: PUPIL, aud: 'authenticated', role: 'authenticated' });
      return Response.json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' }, { status: 403 });
    }
    return new Response('not found', { status: 404 });
  });
  const admin = createClient(URL_BASE, 'server-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetch as typeof globalThis.fetch },
  });
  return { userIdFor: userIdFromToken(admin.auth), calls, fetch };
}

let current: Keys;
let other: Keys;
beforeAll(async () => {
  current = await makeKeys('key-1');
  other = await makeKeys('key-1'); // same name, different key: a forger's
});

describe('checking a sign-in token', () => {
  it("knows a real pupil, and refuses expired, changed, forged, non-pupil and junk tokens", async () => {
    const { userIdFor } = service(() => [current.jwk]);
    expect(await userIdFor(await signed(current, pupil()))).toBe(PUPIL);

    const [head, , sig] = (await signed(current, pupil())).split('.');
    const changed = `${head}.${part(pupil({ sub: '22222222-2222-4222-8222-222222222222' }))}.${sig}`;
    const refused = [
      await signed(current, pupil({ exp: NOW_S() - 1 })), // expired
      changed, // someone else pretending to be the pupil
      await signed(other, pupil()), // someone else's key under the project's key name
      await signed(current, { role: 'anon', exp: NOW_S() + 3600 }),
      await signed(current, { role: 'service_role', exp: NOW_S() + 3600 }),
      legacy(pupil()), // an older-style token the sign-in service doesn't know
      'a.b.c',
    ];
    for (const token of refused) expect(await userIdFor(token)).toBeNull();
  });
});
