#!/usr/bin/env node
/**
 * Wraps the built Maths Monsters test page into ONE html file (script, styles and pictures all
 * inside), so it can be shared or published as a single page.
 * Run: npm run monsters:single   ->  dist-preview-monsters/maths-monsters-test-page.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist-preview-monsters/', import.meta.url).pathname;
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const file = (href) => readFileSync(join(dir, href.replace(/^\.\//, '')), 'utf8');

html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (_m, src) => `<script type="module">${file(src).replace(/<\/script/g, '<\\/script')}</script>`);
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_m, href) => `<style>${file(href)}</style>`);
// A module script must run after the page body exists: move it to the end of <body>.
const script = html.match(/<script type="module">[\s\S]*<\/script>/)[0];
html = html.replace(script, () => '').replace('</body>', () => `${script}\n</body>`);
const out = join(dir, 'maths-monsters-test-page.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
