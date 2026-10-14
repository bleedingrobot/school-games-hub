// Builds each server function into a single index.ts file, so it can be deployed with the
// Supabase CLI or pasted straight into the Supabase dashboard's function editor.
// Run from the project folder with: npm run build:functions   (a test fails if index.ts is out of date)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const versionOf = (name) => (pkg.dependencies[name] ?? '').replace(/^[\^~]/, '');

// Libraries come from npm when the function runs, at the same versions the website uses.
const LIBRARIES = ['chess.js', '@supabase/supabase-js'];

export const FUNCTIONS = ['save-bot-game'];

export async function buildFunction(name) {
  const bundle = await rolldown({
    input: `supabase/functions/${name}/entry.ts`,
    external: LIBRARIES,
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
  for (const name of FUNCTIONS) {
    writeFileSync(`supabase/functions/${name}/index.ts`, await buildFunction(name));
    console.log(`Built supabase/functions/${name}/index.ts`);
  }
}
