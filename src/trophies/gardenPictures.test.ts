import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRIENDS as beanstalk } from '../../shared/beanstalk/progress';
import { FRIENDS as hop } from '../../shared/hop/progress';
import { FRIENDS as korora } from '../../shared/korora/progress';
import { FRIENDS as lizard } from '../../shared/lizard/progress';
import { FRIENDS as parrot } from '../../shared/parrot/config';
import { FRIENDS as pigeon } from '../../shared/pigeon/progress';
import { FRIENDS as pipi } from '../../shared/pipi/progress';
import { FRIENDS as robin } from '../../shared/robin/config';
import { FRIENDS as swamphen } from '../../shared/swamphen/progress';
import { FRIENDS as tui } from '../../shared/tui/progress';
import { FRIENDS as weka } from '../../shared/weka/progress';
import { GARDEN_FRIENDS, GARDEN_PICTURES } from '../avatar/gardenPictures';

describe('early-years friend pictures (card P9)', () => {
  // The server gives prize k the picture at place (k - 1) % n of the game's picture rows by sort, so a list out of step with
  // a game's FRIENDS would give a child the wrong friend.
  it('match each game\'s friends, in order, in the browser and the migration, and every friend has a painting', () => {
    const games = { beanstalk, hop, pipi, korora, weka, tui, lizard, parrot, pigeon, robin, swamphen };
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261112002500_garden_trophies.sql'), 'utf8');
    for (const [game, friends] of Object.entries(games)) {
      expect(GARDEN_FRIENDS[game].friends).toEqual([...friends]);
      const rows = [...sql.matchAll(new RegExp(`\\(\\d+, '${game}', (\\d+), '([a-z]+)'`, 'g'))];
      expect(rows.map((r) => r[2])).toEqual([...friends]);
      expect(rows.map((r) => Number(r[1]))).toEqual(friends.map((_, i) => i + 1));
    }
    expect(Object.keys(GARDEN_PICTURES)).toHaveLength(62);
    expect(Object.entries(GARDEN_PICTURES).filter(([, p]) => !p.art).map(([id]) => id)).toEqual([]);
  });
});
