/**
 * Removes the disposable parts of out/.
 *
 *   npm run clean            # every project's qa/, plus the bundle
 *   npm run clean <slug>     # just that project
 *   npm run clean --renders  # also numbered renders (keeps deliver/)
 *   npm run clean --all      # everything including deliver/ -- asks first
 *
 * `deliver/` is never touched without `--all`, because it holds the file that
 * actually got uploaded and there is no other copy of it. Everything else in
 * out/ is reproducible from source in one command.
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'out');

const args = process.argv.slice(2);

const USAGE = `usage: npm run clean [slug] [--renders] [--all]

  (no args)   every project's qa/, plus the bundle
  <slug>      just that project
  --renders   also numbered renders (keeps deliver/)
  --all       everything including deliver/`;

if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

/*
  Unknown flags are refused rather than ignored. `npm run clean --help` used to
  match no flag, find no slug, and cheerfully delete every project's qa/ and the
  bundle — a destructive default reached by asking for documentation.
*/
const KNOWN = new Set(['--renders', '--all', '--help', '-h']);
const unknown = args.filter((a) => a.startsWith('-') && !KNOWN.has(a));
if (unknown.length > 0) {
  console.error(`unknown option: ${unknown.join(' ')}\n\n${USAGE}`);
  process.exit(1);
}

const RENDERS = args.includes('--renders');
const ALL = args.includes('--all');
const slug = args.find((a) => !a.startsWith('--'));

if (!existsSync(OUT)) {
  console.log('nothing to clean — no out/');
  process.exit(0);
}

/** Bytes freed, so the report says something concrete. */
const sizeOf = (p: string): number => {
  if (!existsSync(p)) {
    return 0;
  }
  const s = statSync(p);
  if (!s.isDirectory()) {
    return s.size;
  }
  return readdirSync(p).reduce((n, e) => n + sizeOf(join(p, e)), 0);
};

const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MB`;

let freed = 0;
const removed: string[] = [];

const wipe = (path: string, label: string): void => {
  if (!existsSync(path)) {
    return;
  }
  freed += sizeOf(path);
  rmSync(path, { recursive: true, force: true });
  removed.push(label);
};

// The bundle is a pure cache — ensure_bundle rebuilds it whenever an input is
// newer, so removing it only ever costs one re-bundle.
if (!slug) {
  wipe(join(OUT, '.bundle'), '.bundle');
}

const slugs = slug
  ? [slug]
  : readdirSync(OUT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);

for (const s of slugs) {
  const dir = join(OUT, s);
  if (!existsSync(dir)) {
    console.error(`no out/${s} — nothing to clean`);
    continue;
  }
  wipe(join(dir, 'qa'), `${s}/qa`);
  if (RENDERS || ALL) {
    wipe(join(dir, 'renders'), `${s}/renders`);
  }
  if (ALL) {
    wipe(join(dir, 'deliver'), `${s}/deliver`);
  }
}

if (removed.length === 0) {
  console.log('nothing to clean');
} else {
  for (const r of removed) {
    console.log(`  removed ${r}`);
  }
  console.log(`✓ freed ${mb(freed)}`);
  if (!RENDERS && !ALL) {
    console.log('  (--renders to drop numbered renders too, --all for deliver/)');
  }
}
