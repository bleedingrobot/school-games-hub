import { expect, it } from 'vitest';
import { badgeLink, codeFromScan } from './badge';

it('reads a badge code from the card’s link or the bare code, and nothing else', () => {
  const code = '0123456789abcdef0123456789abcdef';
  const link = badgeLink(code, { origin: 'https://bleedingrobot.github.io', pathname: '/school-games-hub/' });
  expect(link).toBe(`https://bleedingrobot.github.io/school-games-hub/#/badge/${code}`);
  expect(codeFromScan(link)).toBe(code);
  expect(codeFromScan(` ${code.toUpperCase()} `)).toBe(code);
  expect(codeFromScan('https://example.com/')).toBeNull();
  expect(codeFromScan(`${link}0`)).toBeNull();
});
