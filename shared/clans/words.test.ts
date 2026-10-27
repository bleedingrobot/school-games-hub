import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { MEMBER_NAMES, TYPED_NAME_MAX, checkTypedName, memberNameFrom } from './words';

describe('made-up hero names', () => {
  it.each([
    ['wren', 'Wren'],
    ['  te   ahi ', 'Te Ahi'],
    ["o'neil", "O'Neil"],
    ['jo-jo', 'Jo-Jo'],
    ['McKenzie', 'McKenzie'],
  ])('takes %j as %j', (typed, tidied) => {
    expect(checkTypedName(typed)).toEqual({ ok: true, name: tidied });
  });

  it.each(['Bob', 'Poppy', 'Cassius', 'Dickens', 'Grape', 'Hellen', 'Titus', 'Sasha', 'Nazira', 'Shelley'])(
    'does not refuse the ordinary name %s',
    (name) => expect(checkTypedName(name).ok).toBe(true),
  );

  it.each(['Fuuuck', 'FUCK', 'shitty', 'Boob', 'Poooop', 'Bum', 'Butt Face', 'Mr Poo', 'Stupid', 'Hitler', 'Nazi'])('refuses %s', (name) => {
    expect(checkTypedName(name)).toEqual({ ok: false, say: 'Please pick a kinder name.' });
  });

  it.each(['', ' ', 'A', 'Bob99', 'Bob!', 'Ann  Marie Lee', 'Jo--Jo', 'x'.repeat(TYPED_NAME_MAX + 1), 7, null])('refuses the shape of %j', (raw) => {
    expect(checkTypedName(raw).ok).toBe(false);
  });

  it('keeps list names as they are, and only takes others when the teacher allows it', () => {
    expect(memberNameFrom('Wren', false)).toEqual({ ok: true, name: 'Wren' });
    expect(memberNameFrom('Zoe', false).ok).toBe(false);
    expect(memberNameFrom('zoe', true)).toEqual({ ok: true, name: 'Zoe' });
  });

  it('every list name would pass the check too', () => {
    for (const name of MEMBER_NAMES) expect(checkTypedName(name)).toEqual({ ok: true, name });
  });

  it("matches the database's copy of the list (teacher_list_hero_names swaps made-up names for these)", () => {
    const dir = 'supabase/migrations';
    const sql = readdirSync(dir).filter((f) => f.endsWith('_clans_typed_names.sql')).map((f) => readFileSync(`${dir}/${f}`, 'utf8'))[0];
    const listed = /array\[(.*?)\]::text\[\]/s.exec(sql)![1].split(',').map((n) => n.trim().replace(/^'|'$/g, ''));
    expect(listed).toEqual(MEMBER_NAMES);
  });
});
