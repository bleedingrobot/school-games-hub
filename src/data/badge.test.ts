import { afterEach, expect, it, vi } from 'vitest';
import { badgeLink, codeFromScan} from './badge';

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
