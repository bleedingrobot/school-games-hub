import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeHandler } from './handler';

// The badge sign-in function's tests: a good card signs in its own pupil only; anything else signs nobody in.

const GOOD = '0123456789abcdef0123456789abcdef';

function setup() {
  const keysFor: string[] = [];
  const handler = makeHandler({
    now: () => 0,
    emailForBadge: async (code) => (code === GOOD ? 'ava.k@school.test' : null),
    signInKeyFor: async (email) => {
      keysFor.push(email);
      return `key-for-${email}`;
    },
  });
  const send = async (body: unknown, ip = '1.2.3.4') => {
    const res = await handler(new Request('https://x/badge', {
      method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, string> };
  };
  return { send, keysFor };
}

it('gives a sign-in key for a good badge, and nothing for a wrong, replaced or junk one', async () => {
  const { send, keysFor } = setup();
  expect(await send({ code: GOOD.toUpperCase() })).toEqual({ status: 200, body: { key: 'key-for-ava.k@school.test' } });
  expect((await send({ code: 'f'.repeat(32) })).status).toBe(404);
  expect((await send({ code: "' or 1=1 --" })).status).toBe(400);
  expect((await send({})).status).toBe(400);
  expect(keysFor).toEqual(['ava.k@school.test']);
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- badge` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('badge');
    expect(readFileSync(resolve('supabase/functions/badge/index.ts'), 'utf8')).toBe(built);
  });
});
