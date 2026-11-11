import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_SCANS_PER_MINUTE, MAX_WRONG_PER_MINUTE, makeHandler, type Services } from './handler';

// The badge sign-in function's tests: a good card signs in its own pupil only; anything else signs nobody in.

const GOOD = '0123456789abcdef0123456789abcdef';

function setup(over: Partial<Services> = {}) {
  const keysFor: string[] = [];
  const handler = makeHandler({
    now: () => 0,
    emailForBadge: async (code) => (code === GOOD ? 'ava.k@school.test' : null),
    signInKeyFor: async (email) => {
      keysFor.push(email);
      return `key-for-${email}`;
    },
    ...over,
  });
  const send = async (body: unknown, ip = '1.2.3.4') => {
    const res = await handler(new Request('https://x/badge', {
      method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, string> };
  };
  return { handler, send, keysFor };
}

it('gives a sign-in key for a good badge, and nothing for a wrong, replaced or junk one', async () => {
  const { send, keysFor } = setup();
  expect(await send({ code: GOOD.toUpperCase() })).toEqual({ status: 200, body: { key: 'key-for-ava.k@school.test' } });
  expect((await send({ code: 'f'.repeat(32) })).status).toBe(404);
  expect((await send({ code: "' or 1=1 --" })).status).toBe(400);
  expect((await send({})).status).toBe(400);
  expect(keysFor).toEqual(['ava.k@school.test']);
});

it('answers the browser’s pre-check and refuses anything but POST', async () => {
  const { handler } = setup();
  expect((await handler(new Request('https://x/badge', { method: 'OPTIONS' }))).status).toBe(204);
  expect((await handler(new Request('https://x/badge', { method: 'GET' }))).status).toBe(405);
});

it('says sign-in is busy when the lookup or the key fails, and signs nobody in', async () => {
  expect((await setup({ emailForBadge: async () => 'busy' }).send({ code: GOOD })).status).toBe(503);
  const { send } = setup({ signInKeyFor: async () => 'busy' });
  expect(await send({ code: GOOD })).toEqual({ status: 503, body: { error: 'Sign-in is busy. Try again in a minute.' } });
});

it('lets a whole school sign in at once from one internet address', async () => {
  const { send } = setup();
  for (let i = 0; i < 200; i++) expect((await send({ code: GOOD })).status).toBe(200);
  for (let i = 200; i < MAX_SCANS_PER_MINUTE; i++) await send({ code: GOOD });
  expect((await send({ code: GOOD })).status).toBe(429);
  expect((await send({ code: GOOD }, '5.6.7.8')).status).toBe(200);
});

it('slows down an address that keeps trying wrong codes, but not good cards before that', async () => {
  const { send, keysFor } = setup();
  for (let i = 0; i < MAX_WRONG_PER_MINUTE; i++) expect((await send({ code: 'f'.repeat(32) })).status).toBe(404);
  expect((await send({ code: 'f'.repeat(32) })).status).toBe(429);
  expect((await send({ code: GOOD })).status).toBe(429);
  expect((await send({ code: GOOD }, '5.6.7.8')).status).toBe(200);
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
