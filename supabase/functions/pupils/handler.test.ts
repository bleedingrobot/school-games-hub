import { describe, expect, it } from 'vitest';
import { MAX_REQUESTS_PER_MINUTE, emailsIn, exportUrlFor, makeHandler, type Services } from './handler';

// The "pupils" function: only signed-in teachers make accounts, only for the emails the database allows.

function setup(over: Partial<Services> = {}) {
  const created: string[] = [];
  const handler = makeHandler({
    now: () => 0,
    userIdFor: async (t) => (t === 'teacher-token' ? 'teacher-1' : null),
    mayCreate: async (_t, emails) => emails.filter((e) => e.endsWith('@school.test') && !e.startsWith('old')),
    createAccount: async (email) => {
      created.push(email);
      return email.startsWith('broken') ? 'failed' : 'made';
    },
    fetchText: async (url) => (url.includes('shared') ? 'Name,Email\nAva,Ava.K@school.test\nBen,ben@school.test' : null),
    ...over,
  });
  const send = async (body: unknown, token: string | null = 'teacher-token') => {
    const res = await handler(new Request('https://x/pupils', {
      method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { send, created };
}

describe('emailsIn', () => {
  it('finds each email once in pasted text, a sheet column or a doc', () => {
    expect(emailsIn('Ava.K@School.test; ben@school.test,\n ava.k@school.test\tnot-an-email ben@school.test.')).toEqual([
      'ava.k@school.test',
      'ben@school.test',
    ]);
    expect(emailsIn('"Name","Email"\n"Cara","cara-l@school.test"')).toEqual(['cara-l@school.test']);
  });
});

describe('exportUrlFor', () => {
  it('turns Doc and Sheet links into their plain-text exports, and nothing else', () => {
    expect(exportUrlFor('https://docs.google.com/document/d/abcdefghij1234/edit?tab=t.0')).toBe(
      'https://docs.google.com/document/d/abcdefghij1234/export?format=txt',
    );
    expect(exportUrlFor('https://docs.google.com/spreadsheets/d/abcdefghij1234/edit#gid=567')).toBe(
      'https://docs.google.com/spreadsheets/d/abcdefghij1234/export?format=csv&gid=567',
    );
    expect(exportUrlFor('https://evil.test/document/d/abcdefghij1234/edit')).toBeNull();
    expect(exportUrlFor('http://docs.google.com/document/d/abcdefghij1234/edit')).toBeNull();
    expect(exportUrlFor('not a link')).toBeNull();
  });
});

it('makes accounts only for the emails the database allows, for a signed-in teacher', async () => {
  const { send, created } = setup();
  expect(await send({ emails: ['ava.k@school.test', 'old.one@school.test', 'x@gmail.test', 'broken@school.test'] })).toEqual({
    status: 200,
    body: { made: ['ava.k@school.test'], failed: ['broken@school.test'] },
  });
  expect(created).toEqual(['ava.k@school.test', 'broken@school.test']);
});

it('refuses anyone not signed in, and makes nothing', async () => {
  const { send, created } = setup();
  expect((await send({ emails: ['ava.k@school.test'] }, null)).status).toBe(401);
  expect((await send({ emails: ['ava.k@school.test'] }, 'fake')).status).toBe(401);
  expect(created).toEqual([]);
});

it('refuses too many emails at once, and slows down a flood of requests', async () => {
  const { send } = setup();
  const many = Array.from({ length: 101 }, (_, i) => `p${i}@school.test`);
  expect((await send({ emails: many })).status).toBe(400);
  for (let i = 1; i < MAX_REQUESTS_PER_MINUTE; i++) await send({ emails: [] });
  expect((await send({ emails: [] })).status).toBe(429);
});

it('says busy when the database check fails, and makes nothing', async () => {
  const { send, created } = setup({ mayCreate: async () => 'busy' });
  expect((await send({ emails: ['ava.k@school.test'] })).status).toBe(503);
  expect(created).toEqual([]);
});

it('reads emails from a shared Google Doc or Sheet, and explains when it can’t', async () => {
  const { send } = setup();
  expect(await send({ link: 'https://docs.google.com/spreadsheets/d/shared123456/edit' })).toEqual({
    status: 200,
    body: { emails: ['ava.k@school.test', 'ben@school.test'] },
  });
  expect((await send({ link: 'https://docs.google.com/document/d/private1234/edit' })).status).toBe(422);
  expect((await send({ link: 'https://example.test/file' })).status).toBe(400);
});
