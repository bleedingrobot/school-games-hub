// Rebuilds only supabase/functions/bond-match/index.ts (npm run build:functions rebuilds every function,
// including the stale monster/index.ts, which must be left alone).
import { writeFileSync } from 'node:fs';
import { buildFunction } from './build-functions.mjs';

writeFileSync('supabase/functions/bond-match/index.ts', await buildFunction('bond-match'));
console.log('Built supabase/functions/bond-match/index.ts');
