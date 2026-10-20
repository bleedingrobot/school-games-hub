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

  it('the next number is today in New Zealand, after every number on any branch', () => {
    const files = [
      { branch: 'main', file: '20261018002700_maths_focus.sql' },
      { branch: 'main', file: '20261019000800_lobby.sql' },
      { branch: 'marble', file: '20261019000900_marble.sql' },
    ];
    // 20 Oct 2026 11:00 in New Zealand is still 19 Oct in UTC.
    expect(nextVersion(files, new Date('2026-10-19T22:00:00Z'))).toBe('20261020000100');
    // Something already numbered today (or later): 100 past it.
    expect(nextVersion([...files, { branch: 'x', file: '20261020000300_x.sql' }], new Date('2026-10-19T22:00:00Z'))).toBe('20261020000400');
    // Late in the day in UTC is already tomorrow in New Zealand.
    expect(nextVersion(files, new Date('2026-10-20T12:00:00Z'))).toBe('20261021000100');
  });
});
