// Migration numbers across every branch, so two game sessions never take the same one
// (docs/GAME_DEVELOPMENT_GUIDE.md, section 3). Run from the project folder:
//   node scripts/migration-numbers.mjs          the next free number, and any number used twice
// It reads the branches this computer knows about, so run `git fetch` first.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** '20261019000200_maths_auto.sql' → '20261019000200', or null for anything that isn't a migration. */
export function versionOf(file) {
  const m = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
  return m ? m[1] : null;
}

/**
 * Numbers used by more than one migration. `files` is [{ branch, file }]. The same file on several branches is one
 * migration (a branch that merged main has main's files), so only different file names count.
 * Returns [{ version, files: [{ file, branches }] }].
 */
export function clashes(files) {
  const byVersion = new Map();
  for (const { branch, file } of files) {
    const version = versionOf(file);
    if (!version) continue;
    const names = byVersion.get(version) ?? new Map();
    names.set(file, [...(names.get(file) ?? []), branch]);
    byVersion.set(version, names);
  }
  return [...byVersion]
    .filter(([, names]) => names.size > 1)
    .map(([version, names]) => ({ version, files: [...names].map(([file, branches]) => ({ file, branches })) }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * The next free number: today's date (New Zealand) with counter 000100, or 100 past the highest number on any branch if
 * that is today or later. Numbers sort as text, so a new file always comes after every file that exists.
 */
export function nextVersion(files, today = new Date()) {
  let top = '';
  for (const { file } of files) {
    const version = versionOf(file);
    if (version && version > top) top = version;
  }
  const date = today.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }).replaceAll('-', '');
  const fresh = `${date}000100`;
  if (top < fresh) return fresh;
  return `${top.slice(0, 8)}${String(Number(top.slice(8)) + 100).padStart(6, '0')}`;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** Every migration file on every local and remote branch. */
export function allBranchFiles() {
  const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes').split('\n').filter((b) => b && !b.endsWith('/HEAD') && b !== 'origin');
  const files = [];
  for (const branch of branches) {
    const listed = git('ls-tree', '--name-only', `${branch}:supabase/migrations`).split('\n');
    for (const file of listed) if (versionOf(file)) files.push({ branch, file });
  }
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = allBranchFiles();
  const found = clashes(files);
  if (found.length === 0) console.log('No number is used twice.');
  for (const { version, files: same } of found) {
    console.log(`${version} is used ${same.length} times:`);
    for (const { file, branches } of same) console.log(`  ${file}  (${branches.join(', ')})`);
  }
  console.log(`Next free number: ${nextVersion(files)}`);
}
