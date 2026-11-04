import { afterEach, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase';
import { badgeLink, codeFromScan, signInWithBadge } from './badge';
import { FriendlyError } from './profile';

const CODE = '0123456789abcdef0123456789abcdef';

afterEach(() => vi.restoreAllMocks());

it('reads a badge code from the card’s link or the bare code, and nothing else', () => {
  const link = badgeLink(CODE, { origin: 'https://bleedingrobot.github.io', pathname: '/school-games-hub/' });
  expect(link).toBe(`https://bleedingrobot.github.io/school-games-hub/#/badge/${CODE}`);
  expect(codeFromScan(link)).toBe(CODE);
  expect(codeFromScan(` ${CODE.toUpperCase()} `)).toBe(CODE);
  expect(codeFromScan('https://example.com/')).toBeNull();
  expect(codeFromScan(`${link}0`)).toBeNull();
});

function fakeSignIn(savedUser: string | null) {
  const order: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ key: 'k' }), { status: 200 }));
  vi.spyOn(supabase.auth, 'initialize').mockImplementation(async () => {
    order.push('initialize');
    return { error: null };
  });
  vi.spyOn(supabase.auth, 'verifyOtp').mockImplementation(async () => {
    order.push('verify');
    return { data: { user: { id: 'pupil' }, session: {} }, error: null } as never;
  });
  vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
    data: { session: savedUser ? { user: { id: savedUser } } : null },
    error: null,
  } as never);
  return order;
}

it('waits for the sign-in code to start up before using the badge, then checks the sign-in was kept', async () => {
  const order = fakeSignIn('pupil');
  await expect(signInWithBadge(CODE)).resolves.toBe('pupil');
  expect(order).toEqual(['initialize', 'verify']);
});

it('says so when the sign-in wasn’t kept on this device', async () => {
  fakeSignIn(null);
  await expect(signInWithBadge(CODE)).rejects.toBeInstanceOf(FriendlyError);
});
