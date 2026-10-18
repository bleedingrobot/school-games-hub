import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/multiplayer';
import { tidyWarpCode } from './classes';

describe('Class Warp codes', () => {
  it('are made the way game codes are: the database uses the same letters and length', () => {
    const migration = readFileSync('supabase/migrations/20261018002400_classes_and_warp.sql', 'utf8');
    expect(migration).toContain(`alphabet constant text := '${CODE_ALPHABET}';`);
    expect(migration).toContain(`for i in 1..${CODE_LENGTH} loop`);
    // The table refuses any other code, whatever made it.
    expect(migration.match(new RegExp(`\\^\\[${CODE_ALPHABET}\\]\\{${CODE_LENGTH}\\}\\$`, 'g'))).toHaveLength(2);
  });

  it('are tidied like game codes: any case, spaces and dashes are fine', () => {
    expect(tidyWarpCode('km4 tp')).toBe('KM4TP');
    expect(tidyWarpCode(' KM4-TP ')).toBe('KM4TP');
    expect(tidyWarpCode('KM4T')).toBeNull();
    expect(tidyWarpCode('AEIOU')).toBeNull();
    expect(tidyWarpCode('OOOOO')).toBeNull();
  });
});
