import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { QUEST_KINDS } from './kinds';

it('has two quests for every complex and easy maths game, each with a painting and a row in the database', () => {
  const ids = QUEST_KINDS.map((k) => k.id);
  expect(new Set(ids).size).toBe(ids.length);
  const perGame = new Map<string, number>();
  for (const k of QUEST_KINDS) perGame.set(k.card, (perGame.get(k.card) ?? 0) + 1);
  expect([...perGame.values()].every((n) => n === 2)).toBe(true);
  expect(perGame.size).toBe(15);

  const art = JSON.parse(readFileSync(join(__dirname, '../../docs/quests-art/config.json'), 'utf8')) as { pictures: { name: string }[] };
  const painted = new Set(art.pictures.map((p) => p.name));
  expect(ids.filter((id) => !painted.has(`quest-${id}`))).toEqual([]);

  const sql = readFileSync(join(__dirname, '../../supabase/migrations/20261118003100_class_quests_more.sql'), 'utf8');
  for (const k of QUEST_KINDS.filter((q) => q.rule !== 'turns')) {
    expect(sql).toContain(`('${k.id}', `);
    expect(sql).toMatch(new RegExp(`\('${k.id}', [^)]*'${k.rule}', '[a-z_]+', ${k.amount}\)`));
  }
});
