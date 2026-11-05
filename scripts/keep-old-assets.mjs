#!/usr/bin/env node
/**
 * Keeps the last version's game files online for a while after each publish.
 *
 * Every publish gives changed files new names (index-Ab12.js) and GitHub Pages throws the old ones away. A page that
 * was already open (or a stale copy GitHub's cache hands out for a minute or two after a publish) still asks for the
 * old names when a pupil opens a game, and Safari says "Importing a module script failed". On 6 Nov 2026 two juniors
 * signing in with their QR badges hit exactly that: a publish went live while they were starting.
 *
 * So the built site carries a list, assets-manifest.json, of every file under assets/ and when it stopped being used.
 * Before each publish this script reads the live list, downloads from the live site each file the new build dropped,
 * and puts it back in dist/ until it has been unused for KEEP_HOURS. Unchanged files keep their names, so only the
 * few files a publish changed are carried over.
 *
 * Usage (after `npm run build`): node scripts/keep-old-assets.mjs [dist] [live site url]
 * It never fails the publish: if the live site can't be read, it just writes a fresh list and says so.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const KEEP_HOURS = 48;
export const MANIFEST = 'assets-manifest.json';
const SITE = 'https://bleedingrobot.github.io/school-games-hub/';

/**
 * What the new list holds, and which old files to fetch back.
 * @param {Record<string, string | null> | null} live the live list: path -> when it stopped being used (null = in use)
 * @param {string[]} built the paths under assets/ in the new build
 * @param {number} now
 * @returns {{ manifest: Record<string, string | null>, fetch: string[] }}
 */
export function planKeep(live, built, now, keepHours = KEEP_HOURS) {
  /** @type {Record<string, string | null>} */
  const manifest = {};
  for (const path of built) manifest[path] = null;
  const fetch = [];
  for (const [path, retired] of Object.entries(live ?? {})) {
    if (path in manifest || !isAssetPath(path)) continue;
    const since = retired ? Date.parse(retired) : now;
    if (!Number.isFinite(since) || now - since >= keepHours * 3_600_000) continue;
    manifest[path] = new Date(since).toISOString();
    fetch.push(path);
  }
  return { manifest, fetch: fetch.sort() };
}

/** Only plain paths inside assets/: the list comes off the web, so never let it write anywhere else. */
export function isAssetPath(path) {
  return typeof path === 'string' && path.startsWith('assets/') && !path.split('/').some((p) => p === '..' || p === '' || p === '.');
}

async function listFiles(dir, root = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full, root)));
    else out.push(relative(root, full).split('\\').join('/'));
  }
  return out;
}

async function main() {
  const dist = process.argv[2] ?? 'dist';
  const site = (process.argv[3] ?? SITE).replace(/\/?$/, '/');
  const built = (await listFiles(join(dist, 'assets'))).map((p) => `assets/${p}`);

  let live = null;
  try {
    const response = await fetch(`${site}${MANIFEST}?at=${Date.now()}`);
    if (response.ok) live = await response.json();
    else console.log(`No ${MANIFEST} on the live site yet (${response.status}): starting a fresh list.`);
  } catch (error) {
    console.log(`::warning::Couldn't read the live ${MANIFEST} (${error}): starting a fresh list.`);
  }

  const { manifest, fetch: wanted } = planKeep(live, built, Date.now());
  let kept = 0;
  for (const path of wanted) {
    try {
      const response = await fetch(`${site}${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const target = join(dist, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
      kept++;
    } catch (error) {
      console.log(`::warning::Couldn't keep ${path}: ${error}`);
      delete manifest[path];
    }
  }
  await writeFile(join(dist, MANIFEST), JSON.stringify(manifest, null, 0));
  console.log(`${built.length} files in this build; kept ${kept} from earlier publishes for up to ${KEEP_HOURS} hours.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
