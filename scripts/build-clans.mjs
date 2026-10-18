// Rebuilds only supabase/functions/clans/index.ts (npm run build:functions rebuilds every function).
import { writeFileSync } from 'node:fs';
import { buildFunction } from './build-functions.mjs';

writeFileSync('supabase/functions/clans/index.ts', await buildFunction('clans'));
console.log('Built supabase/functions/clans/index.ts');
