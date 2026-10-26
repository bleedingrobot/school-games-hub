// Builds each server function into a single index.ts file, so it can be deployed with the
// Supabase CLI or pasted straight into the Supabase dashboard's function editor.
// Run from the project folder with: npm run build:functions   (a test fails if index.ts is out of date)
// or, for just some: npm run build:functions -- lord clans
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const versionOf = (name) => (pkg.dependencies[name] ?? '').replace(/^[\^~]/, '');

// Libraries come from npm when the function runs, at the same versions the website uses.
const LIBRARIES = ['chess.js', '@supabase/supabase-js'];

export const FUNCTIONS = ['save-bot-game', 'multiplayer', 'space-game', 'card-game', 'gem-keep', 'power-clash', 'monster', 'lord', 'clans', 'training', 'marble', 'bond-match', 'mine', 'archery', 'kingdom'];

export async function buildFunction(name) {
  const bundle = await rolldown({
    input: `supabase/functions/${name}/entry.ts`,
    external: LIBRARIES,
    // The libraries do nothing just by being loaded, so a function that doesn't use one
    // (space-game never touches chess.js) doesn't load it.
    treeshake: { moduleSideEffects: (_id, external) => !external },
    logLevel: 'silent',
  });
  const { output } = await bundle.generate({ format: 'esm', comments: { legal: true, annotation: false, jsdoc: true } });
  await bundle.close();
  let code = output[0].code;
  for (const lib of LIBRARIES) {
    code = code.replaceAll(`from "${lib}"`, `from "npm:${lib}@${versionOf(lib)}"`);
  }
  return (
    `// GENERATED FILE: don't edit. Edit supabase/functions/${name}/handler.ts (and shared/),\n` +
    `// then run \`npm run build:functions\`. Deploy this file as the "${name}" function.\n\n` +
    code
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Name the functions to build only those (npm run build:functions -- lord clans); with none, every function in FUNCTIONS.
  // Build only your own: rebuilding every one rewrites monster/index.ts, which is deliberately left as deployed.
  const named = process.argv.slice(2);
  const unknown = named.filter((name) => !/^[a-z0-9-]+$/.test(name) || !existsSync(`supabase/functions/${name}/entry.ts`));
  if (unknown.length) {
    console.error(`No such function: ${unknown.join(', ')} (each needs supabase/functions/<name>/entry.ts)`);
    process.exit(1);
  }
  for (const name of named.length ? named : FUNCTIONS) {
    writeFileSync(`supabase/functions/${name}/index.ts`, await buildFunction(name));
    console.log(`Built supabase/functions/${name}/index.ts`);
  }
}
