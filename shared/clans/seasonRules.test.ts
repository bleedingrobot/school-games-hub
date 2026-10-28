import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { ACHIEVEMENTS } from './rewards';

const sql = readFileSync(resolve('supabase/migrations/20261029000400_clans_season_goals.sql'), 'utf8');
const rules = /function public\.clan_season_rules\(\)[^$]*\$\$ select jsonb_build_object\(([\s\S]*?)\) \$\$;/.exec(sql)?.[1] ?? '';

describe('the season rules in the database and in the game agree', () => {
  it('has the same season length, warning day, monster day and village reward', () => {
    const s = CONFIG.season;
    expect(rules).toContain(`'length', ${s.length}, 'warnFrom', ${s.warnFrom}, 'monsterFrom', ${s.monsterFrom}`);
    expect(rules).toContain(`'villageReward', jsonb_build_object('fame', ${s.villageReward.fame}, 'points', ${s.villageReward.points})`);
  });

  it('has the same top level for every building', () => {
    const b = CONFIG.empire.buildings;
    const names = Object.keys(b) as (keyof typeof b)[];
    const listed = /'maxLevels', jsonb_build_object\(([^)]*)\)/.exec(rules)?.[1] ?? '';
    const pairs = [...listed.matchAll(/'(\w+)', (\d+)/g)].map((m) => [m[1], Number(m[2])] as const);
    expect(pairs.length).toBe(names.length);
    for (const [name, max] of pairs) expect(b[name as keyof typeof b].max).toBe(max);
    expect(pairs.reduce((a, [, m]) => a + m, 0)).toBe(39);
  });

  // Sorted last in the database (9) although the game lists it before Loud and right.
  it('has the Master Builder achievement the game lists', () => {
    const a = ACHIEVEMENTS.find((x) => x.id === 'cq-master-builder');
    expect(a).toBeDefined();
    if (a) expect(sql).toContain(`('${a.id}', 'clan-quest', '${a.name}', '${a.emoji}', '${a.measure}', ${a.goal}, 9)`);
  });
});
