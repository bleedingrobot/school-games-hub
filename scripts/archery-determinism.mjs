// Proves Archery Challenge's rules give exactly the same numbers in Node, Chromium and WebKit.
// Run from the project folder: PLAYWRIGHT_DIR=/path/to/folder/with/playwright node scripts/archery-determinism.mjs
// (Playwright isn't a project dependency. WebKit needs `npx playwright install webkit` and its system libraries.)
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const dir = mkdtempSync(join(tmpdir(), 'archery-det-'));
const bundle = await rolldown({ input: join(process.cwd(), 'shared/archery/determinism.ts'), logLevel: 'silent' });
await bundle.write({ file: join(dir, 'det.js'), format: 'iife', name: 'Det' });
await bundle.close();
const code = readFileSync(join(dir, 'det.js'), 'utf8');

const nodeMod = await import(pathToFileURL(join(dir, 'det.js')).href).catch(() => null);
void nodeMod;
const run = new Function(`${code}; return Det;`);
const nodeReport = run().determinismReport();
const nodePrint = run().fingerprint(nodeReport);
console.log(`node      ${nodePrint}  (${nodeReport.split('\n').length} lines)`);

const root = process.env.PLAYWRIGHT_DIR;
if (!root) {
  console.log('Set PLAYWRIGHT_DIR to also check the browsers.');
  process.exit(0);
}
const pw = createRequire(join(root, 'x.js'))('playwright');
const execs = { chromium: process.env.CHROMIUM_PATH, webkit: process.env.WEBKIT_PATH };
let bad = 0;
for (const name of ['webkit', 'chromium']) {
  try {
    const browser = await pw[name].launch(execs[name] ? { executablePath: execs[name] } : {});
    const page = await browser.newPage();
    const out = await page.evaluate(([src]) => {
      const d = new Function(`${src}; return Det;`)();
      const report = d.determinismReport();
      return { print: d.fingerprint(report), report };
    }, [code]);
    const same = out.report === nodeReport;
    console.log(`${name.padEnd(9)} ${out.print}  ${same ? 'identical' : 'DIFFERENT'}`);
    if (!same) {
      bad++;
      const a = nodeReport.split('\n');
      const b = out.report.split('\n');
      const i = a.findIndex((l, k) => l !== b[k]);
      console.log(' first difference at line', i, '\n node:', a[i], '\n', name + ':', b[i]);
    }
    await browser.close();
  } catch (e) {
    console.log(`${name.padEnd(9)} could not run: ${String(e.message).split('\n')[0]}`);
    bad++;
  }
}
process.exit(bad ? 1 : 0);
