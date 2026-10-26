import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error: a plain script, with no type file
import { buildFunction, FUNCTIONS } from './build-functions.mjs';

// monster/index.ts is deliberately left as deployed, out of date with the code, until its next deploy.
const LEFT_AS_DEPLOYED = ['monster'];

it('every deployable function file is up to date with the code (run `npm run build:functions -- <name>` if this fails)', async () => {
  const stale: string[] = [];
  for (const name of (FUNCTIONS as string[]).filter((n) => !LEFT_AS_DEPLOYED.includes(n))) {
    if (readFileSync(`supabase/functions/${name}/index.ts`, 'utf8') !== (await buildFunction(name))) stale.push(name);
  }
  expect(stale).toEqual([]);
}, 120_000);
