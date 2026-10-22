/**
 * The database reads a student's maths records by pack, and some of its functions list the packs by name
 * (`f.pack in ('times-tables', ...)`). That list has to match `FOCUS_PACKS`: a new pack the games save under but the
 * database leaves out would be asked but never read back. This test fails when the two drift apart, so a new pack
 * comes with the migration that adds it to those functions.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOCUS_PACKS } from './ladder';

const DIR = resolve('supabase/migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

/** Every function definition in the migrations, oldest first: its name, the file it is in and its text. */
function definitions() {
  const out: { name: string; file: string; body: string }[] = [];
  for (const file of files) {
    const sql = readFileSync(resolve(DIR, file), 'utf8');
    const starts = [...sql.matchAll(/create (?:or replace )?function\s+(?:public\.)?(\w+)/gi)];
    starts.forEach((m, i) => out.push({ name: m[1], file, body: sql.slice(m.index, starts[i + 1]?.index ?? sql.length) }));
  }
  return out;
}

const PACK_LIST = /\bpack\s+in\s*\(([^)]*)\)/gi;
const HAS_PACK_LIST = /\bpack\s+in\s*\(/i;
const packsIn = (list: string) => [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('the packs the database reads', () => {
  const defs = definitions();
  const latest = new Map<string, { file: string; body: string }>();
  for (const d of defs) latest.set(d.name, d);
  const listed = [...latest].filter(([, d]) => HAS_PACK_LIST.test(d.body));

  it('finds the functions that list them', () => {
    expect(listed.map(([name]) => name).sort()).toEqual(expect.arrayContaining(['my_gem_keep', 'space_maths_context']));
  });

  for (const [name, d] of listed) {
    it(`${name} (${d.file}) reads exactly the packs the games keep records in`, () => {
      for (const m of d.body.matchAll(PACK_LIST)) expect([...packsIn(m[1])].sort()).toEqual([...FOCUS_PACKS].sort());
    });
  }
});
