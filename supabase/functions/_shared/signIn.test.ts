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

describe('checking a sign-in token with the newer keys', () => {
  it("knows the pupil without asking the sign-in service, and fetches the public keys only once", async () => {
    const fresh = await makeKeys('key-fresh'); // not yet remembered by the library
    const { userIdFor, calls } = service(() => [fresh.jwk]);
    for (let i = 0; i < 3; i++) expect(await userIdFor(await signed(fresh, pupil({ iat: i })))).toBe(PUPIL);
    expect(calls).toEqual(['/auth/v1/.well-known/jwks.json']);
  });

  it('refuses an expired token', async () => {
    const { userIdFor, calls } = service(() => [current.jwk]);
    expect(await userIdFor(await signed(current, pupil({ exp: NOW_S() - 1 })))).toBeNull();
    expect(calls).toEqual([]);
  });

  it('refuses a token that was changed after signing (someone else pretending to be the pupil)', async () => {
    const { userIdFor } = service(() => [current.jwk]);
    const [head, , sig] = (await signed(current, pupil())).split('.');
    const changed = `${head}.${part(pupil({ sub: '22222222-2222-4222-8222-222222222222' }))}.${sig}`;
    expect(await userIdFor(changed)).toBeNull();
  });

  it("refuses a token signed with someone else's key under the project's key name", async () => {
    const { userIdFor } = service(() => [current.jwk]);
    expect(await userIdFor(await signed(other, pupil()))).toBeNull();
  });

  it("refuses a properly signed token that isn't a signed-in user's", async () => {
    const { userIdFor } = service(() => [current.jwk]);
    expect(await userIdFor(await signed(current, { role: 'anon', exp: NOW_S() + 3600 }))).toBeNull();
    expect(await userIdFor(await signed(current, { role: 'service_role', exp: NOW_S() + 3600 }))).toBeNull();
    expect(await userIdFor(await signed(current, pupil({ role: 'anon' })))).toBeNull();
    expect(await userIdFor(await signed(current, pupil({ role: undefined })))).toBeNull();
    expect(await userIdFor(await signed(current, pupil({ sub: '' })))).toBeNull();
    expect(await userIdFor(await signed(current, pupil({ sub: undefined })))).toBeNull();
  });

  it('asks the sign-in service about a key it has never heard of (and refuses if that says no)', async () => {
    const { userIdFor, calls } = service(() => [current.jwk]);
    expect(await userIdFor(await signed(current, pupil(), 'made-up-key'))).toBeNull();
    expect(calls).toContain('/auth/v1/user');
  });

  it('picks up a new key the project starts signing with, without waiting 10 minutes', async () => {
    const next = await makeKeys('key-2');
    let published = [current.jwk];
    const { userIdFor } = service(() => published);
    expect(await userIdFor(await signed(current, pupil()))).toBe(PUPIL);
    published = [current.jwk, next.jwk];
    expect(await userIdFor(await signed(next, pupil()))).toBe(PUPIL);
  });

  it("refuses (and doesn't crash) when the public keys can't be fetched", async () => {
    // A key not seen before: the library remembers keys it has fetched (for 10 minutes, across clients).
    const unseen = await makeKeys('key-unseen');
    const { userIdFor, fetch } = service(() => [unseen.jwk]);
    fetch.mockImplementation(async () => new Response('down', { status: 500 }));
    expect(await userIdFor(await signed(unseen, pupil()))).toBeNull();
  });
});

describe('checking a sign-in token with the older shared secret (before the switch, and for an hour after)', () => {
  it('asks the sign-in service, as before, and trusts its answer', async () => {
    const token = legacy(pupil());
    const { userIdFor, calls } = service(() => [current.jwk], new Set([token]));
    expect(await userIdFor(token)).toBe(PUPIL);
    expect(calls).toEqual(['/auth/v1/user']);
  });

  it('refuses a token the sign-in service says is not real', async () => {
    const { userIdFor } = service(() => [current.jwk]);
    expect(await userIdFor(legacy(pupil()))).toBeNull();
  });

  it("refuses the site's public key and the server's own key", async () => {
    const anonKey = legacy({ role: 'anon', exp: NOW_S() + 3600 });
    const serverKey = legacy({ role: 'service_role', exp: NOW_S() + 3600 });
    // Even if the sign-in service somehow answered for them.
    const { userIdFor } = service(() => [current.jwk], new Set([anonKey, serverKey]));
    expect(await userIdFor(anonKey)).toBeNull();
    expect(await userIdFor(serverKey)).toBeNull();
  });
});

describe('checking something that is not a token at all', () => {
  it('refuses rubbish without asking anyone', async () => {
    const { userIdFor, calls } = service(() => [current.jwk]);
    for (const junk of ['', 'abc', 'a.b.c', 'Bearer x', `${part({ alg: 'ES256' })}.not-json.x`]) expect(await userIdFor(junk)).toBeNull();
    expect(calls).toEqual([]);
  });
});
