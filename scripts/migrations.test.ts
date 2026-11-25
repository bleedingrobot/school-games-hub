import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain script, with no type file
import { clashes, nextVersion, versionOf } from './migration-numbers.mjs';

describe('migration numbers', () => {
  it('no two migrations on this branch share a number (a fresh database copy would refuse them)', () => {
    const files: string[] = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
    const versions = files.map((f) => versionOf(f));
    expect(versions.filter((v) => v === null), 'every file is named <14 digits>_<name>.sql').toEqual([]);
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const file of files) {
      const version = versionOf(file)!;
      if (seen.has(version)) twice.push(`${seen.get(version)} and ${file}`);
      seen.set(version, file);
    }
    expect(twice).toEqual([]);
  });

  it('finds the same number used by two different files, but not one file on two branches', () => {
    const found = clashes([
      { branch: 'main', file: '20261019000200_maths_auto.sql' },
      { branch: 'bond-match', file: '20261019000200_maths_auto.sql' },
      { branch: 'bond-match', file: '20261019000200_bond_match.sql' },
      { branch: 'marble', file: '20261019000800_lobby.sql' },
      { branch: 'main', file: '20261019000800_lobby.sql' },
      { branch: 'main', file: 'README.md' },
    ]);
    expect(found).toEqual([
      {
        version: '20261019000200',
        files: [
          { file: '20261019000200_maths_auto.sql', branches: ['main', 'bond-match'] },
          { file: '20261019000200_bond_match.sql', branches: ['bond-match'] },
        ],
      },
    ]);
  });

  it('the next number is the time now in New Zealand to the second, after every number on any branch', () => {
    const files = [
      { branch: 'main', file: '20261018002700_maths_focus.sql' },
      { branch: 'main', file: '20261019000800_lobby.sql' },
      { branch: 'marble', file: '20261019000900_marble.sql' },
    ];
    // 20 Oct 2026 11:00:05 in New Zealand is still 19 Oct in UTC.
    expect(nextVersion(files, new Date('2026-10-19T22:00:05Z'))).toBe('20261020110005');
    // Something already numbered later than now: one past it.
    expect(nextVersion([...files, { branch: 'x', file: '20261020120000_x.sql' }], new Date('2026-10-19T22:00:05Z'))).toBe('20261020120001');
    // Just after midnight in New Zealand (hour 00, not 24).
    expect(nextVersion(files, new Date('2026-10-20T11:00:09Z'))).toBe('20261021000009');
  });
});
