// Turns a built preview folder (dist-preview-clans) into ONE html fragment (CSS, JS and pictures inline),
// the shape the Artifact page wants. Usage: node scripts/inline-preview.mjs <dist folder> <out file>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
const assets = join(dir, 'assets');
const files = readdirSync(assets);
const js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');
const page = `<title>Clan Quest</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=swap">
<style>
:root { --page: #05050c; color-scheme: dark; }
body { background: var(--page); color: #e4e4f0; padding-block: 8px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024).toFixed(0)} KB`);
