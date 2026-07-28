/**
 * Runs a video's pipeline, skipping stages whose inputs have not changed.
 *
 *   npm run build <slug> [--force] [--dry]
 *
 * The pipeline is a DAG with undeclared dependencies, and the failure mode is
 * silent: re-record the voiceover, forget to retime, and you get a finished
 * video with captions from the previous take. Nothing errors. This exists so
 * the ordering is enforced by something that cannot forget it.
 *
 *   vo.raw.wav ──process-vo──> vo.wav ──retime──> captions.json + beat durations
 *                                                        │
 *                              beats.yaml ──build-beats──┴──> beats.generated.ts
 *                                                                    │
 *                                                    sync ──> registry.generated.ts
 *
 * Staleness is mtime-based, with one exception. beats.yaml is both an input to
 * process-vo (the `vo:` block) and an output of retime (the durations), so
 * comparing its mtime would re-run the audio chain after every retime, forever.
 * The `vo:` block is therefore hashed instead, and only a real change to those
 * settings re-runs the chain.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('usage: npm run build <slug> [--force] [--dry]');
  process.exit(1);
}

const args = process.argv.slice(3);
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');

const ROOT = process.cwd();
const projectDir = join(ROOT, 'projects', slug);
const mediaDir = join(ROOT, 'public', 'videos', slug);

if (!existsSync(projectDir)) {
  console.error(`No ${projectDir}. Projects live in projects/<slug>/.`);
  process.exit(1);
}

const beatsYaml = join(projectDir, 'beats.yaml');
if (!existsSync(beatsYaml)) {
  console.error(`No beats.yaml in ${projectDir}.`);
  process.exit(1);
}

const rawWav = join(mediaDir, 'vo.raw.wav');
const wav = join(mediaDir, 'vo.wav');
const captions = join(projectDir, 'captions.json');
const generated = join(projectDir, 'beats.generated.ts');
const statePath = join(projectDir, '.build-state.json');

/** mtime in ms, or 0 when the file does not exist — a missing output is stale. */
const mtime = (p: string): number => (existsSync(p) ? statSync(p).mtimeMs : 0);

const sha = (v: unknown): string =>
  createHash('sha1').update(JSON.stringify(v ?? null)).digest('hex').slice(0, 12);

type Doc = {
  vo?: unknown;
  corrections?: unknown;
  beats?: readonly { id?: string; vo?: string }[];
};
const doc = (): Doc => (parse(readFileSync(beatsYaml, 'utf8')) as Doc | null) ?? {};

/** Hash of just the `vo:` block, so retime's duration rewrites do not count. */
const voHash = (): string => sha(doc().vo);

/**
 * Hash of retime's *alignment key* — every beat's id and narration, plus the
 * corrections map.
 *
 * mtime cannot stand in for this. beats.yaml is rewritten by retime itself, so
 * it is always newer than captions.json and comparing the two would either
 * re-transcribe forever or (as it did) never re-transcribe at all. Durations
 * are excluded for the same reason: retime writes them.
 *
 * This matters because rewriting a `vo` line is the documented fix when the
 * read drifted from the script, and skipping retime after it is the exact
 * silent failure this script exists to prevent — captions and beat boundaries
 * that describe a script nobody read aloud.
 */
const scriptHash = (): string => {
  const d = doc();
  return sha([(d.beats ?? []).map((b) => [b.id ?? '', b.vo ?? '']), d.corrections]);
};

type State = { voSettings?: string; voScript?: string };
const state: State = existsSync(statePath)
  ? (JSON.parse(readFileSync(statePath, 'utf8')) as State)
  : {};

const run = (label: string, script: string, scriptArgs: string[]): void => {
  console.log(`\n▸ ${label}`);
  if (DRY) {
    console.log(`  (dry) would run: ${script} ${scriptArgs.join(' ')}`);
    return;
  }
  const r = spawnSync(
    process.execPath,
    [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(ROOT, 'scripts', script), ...scriptArgs],
    { stdio: 'inherit', cwd: ROOT },
  );
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed — stopping.`);
    process.exit(r.status ?? 1);
  }
};

const skip = (label: string, why: string): void => {
  console.log(`· ${label} — ${why}`);
};

// ---------------------------------------------------------------- process-vo

const hasVo = existsSync(rawWav) || existsSync(wav);
const settingsNow = voHash();

if (!hasVo) {
  skip('process-vo', 'no recording yet');
} else {
  // First run: only vo.wav exists, and process-vo will adopt it as vo.raw.wav.
  const source = existsSync(rawWav) ? rawWav : wav;
  const settingsChanged = state.voSettings !== undefined && state.voSettings !== settingsNow;
  const stale = mtime(wav) < mtime(source) || !existsSync(rawWav);

  if (FORCE || stale || settingsChanged) {
    const why = settingsChanged ? 'vo settings changed' : 'recording is newer';
    console.log(`  (${FORCE ? 'forced' : why})`);
    run('process-vo', 'process-vo.ts', [slug]);
  } else {
    skip('process-vo', 'vo.wav is up to date');
  }
}

// -------------------------------------------------------------------- retime

const scriptNow = scriptHash();

if (!existsSync(wav)) {
  skip('retime', 'no vo.wav to transcribe');
} else {
  const scriptChanged = state.voScript !== undefined && state.voScript !== scriptNow;
  if (FORCE || mtime(captions) < mtime(wav) || scriptChanged) {
    if (scriptChanged) {
      console.log('  (narration changed)');
    }
    run('retime', 'retime.ts', [slug]);
  } else {
    skip('retime', 'captions are up to date');
  }
}

// --------------------------------------------------------------- build-beats
// retime runs build-beats itself, so this only fires when retime was skipped
// and beats.yaml was edited by hand.

if (FORCE || mtime(generated) < mtime(beatsYaml)) {
  run('build-beats', 'build-beats.ts', [slug]);
} else {
  skip('build-beats', 'timings are up to date');
}

// ---------------------------------------------------------------------- sync
// Cheap and depends on everything above, so it always runs.

run('sync', 'sync-projects.ts', []);

// ------------------------------------------------------------------ captions
// Reports only; it never fails the build. Caption phrasing is judged by reading
// the phrases, and a 30-frame contact sheet samples far too little of a 50-
// phrase video to catch a bad break — so the check has to happen here, where it
// is unavoidable, rather than in a QA step someone can forget.

if (existsSync(captions)) {
  run('captions', 'captions.ts', [slug]);
}

if (!DRY) {
  // Re-hashed rather than reusing `scriptNow`: retime rewrites beats.yaml, and
  // storing the pre-run hash would make the next build think the narration had
  // changed again.
  writeFileSync(
    statePath,
    JSON.stringify({ voSettings: settingsNow, voScript: scriptHash() }, null, 2),
  );
}

console.log(`\n✓ ${slug} is built.`);
console.log(`  preview:  npm run studio`);
console.log(`  stills:   ./scripts/contact-sheet.sh ${slug}-<theme>`);
console.log(`  render:   ./scripts/render.sh ${slug}`);
