// Rebuilds only supabase/functions/lord/index.ts (npm run build:functions rebuilds every function).
import { writeFileSync } from 'node:fs';
import { buildFunction } from './build-functions.mjs';

writeFileSync('supabase/functions/lord/index.ts', await buildFunction('lord'));
console.log('Built supabase/functions/lord/index.ts');
