/**
 * Runs a video's pipeline, skipping stages whose inputs have not changed.
 *
 *   npm run build <slug> [--force] [--dry] [--no-check] [--samples N]
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
import { decideProcessVo, decideTranscribe } from './vo-state';

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('usage: npm run build <slug> [--force] [--dry] [--no-check] [--samples N]');
  process.exit(1);
}

const args = process.argv.slice(3);
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');
/** Skips the slowest stage for the tight edit loop. */
const NO_CHECK = args.includes('--no-check');
const samplesAt = args.indexOf('--samples');
const CHECK_SAMPLES = samplesAt >= 0 && args[samplesAt + 1] ? Number(args[samplesAt + 1]) : 24;

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

type State = { voSettings?: string; voScript?: string; voOutput?: string };
const state: State = existsSync(statePath)
  ? (JSON.parse(readFileSync(statePath, 'utf8')) as State)
  : {};

/**
 * Record what this run has actually done, so the next one does not redo it.
 *
 * Called at every point the build legitimately STOPS, not only when it reaches
 * the end — which is the distinction that was missing and it cost a loop no
 * amount of re-running could escape:
 *
 *   transcript gate exits without writing state
 *     -> next run still holds the previous build's voOutput
 *     -> `newTake` is true, so process-vo runs and rewrites vo.wav
 *     -> vo.wav is now newer than transcript.md
 *     -> needsTranscribe is true, so it transcribes and stops at the gate again
 *
 * A pause for human review is a successful outcome. process-vo and transcribe
 * both really completed, and refusing to record that is what makes them repeat.
 * A genuine stage FAILURE still exits without writing, which is correct — there
 * the work did not happen.
 *
 * `scriptHash()` is re-read rather than reusing `scriptNow`: retime rewrites
 * beats.yaml, so storing the pre-run hash would make the next build think the
 * narration had changed again.
 */
const remember = (): void => {
  if (DRY) return;
  writeFileSync(
    statePath,
    JSON.stringify(
      { voSettings: settingsNow, voScript: scriptHash(), voOutput: voStamp() },
      null,
      2,
    ),
  );
};

/**
 * `fatal: false` runs a stage for its report and carries on regardless.
 *
 * The reporting stages exit non-zero to be useful on their own — `check`
 * returns 1 when it finds anything, so it can gate a commit hook — but a
 * finding is not a reason to abandon a build that has already done the
 * expensive work. Treating it as one would just teach everyone to pass
 * `--no-check`.
 */
const run = (
  label: string,
  script: string,
  scriptArgs: string[],
  { fatal = true }: { fatal?: boolean } = {},
): number => {
  console.log(`\n▸ ${label}`);
  if (DRY) {
    console.log(`  (dry) would run: ${script} ${scriptArgs.join(' ')}`);
    return 0;
  }
  const r = spawnSync(
    process.execPath,
    [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(ROOT, 'scripts', script), ...scriptArgs],
    { stdio: 'inherit', cwd: ROOT },
  );
  const status = r.status ?? 1;
  if (status !== 0 && fatal) {
    console.error(`\n✗ ${label} failed — stopping.`);
    process.exit(status);
  }
  return status;
};

const skip = (label: string, why: string): void => {
  console.log(`· ${label} — ${why}`);
};

// ---------------------------------------------------------------- process-vo

const hasVo = existsSync(rawWav) || existsSync(wav);
const settingsNow = voHash();

/**
 * Identity of vo.wav as a string, so a file the pipeline did not write can be
 * told apart from the one it did.
 *
 * mtime alone cannot do this. process-vo READS vo.raw.wav and WRITES vo.wav, so
 * its own output is always newer than its input — "vo.wav is newer, so it must
 * be a new recording" is true for a dropped-in take and equally true one second
 * after a normal run, which would re-process forever.
 */
const voStamp = (): string =>
  existsSync(wav) ? `${Math.round(mtime(wav))}:${statSync(wav).size}` : '';

if (!hasVo) {
  skip('process-vo', 'no recording yet');
} else {
  // The decision itself lives in vo-state.ts, where it is unit tested — the
  // failures it guards are silent, and every stage exits 0 either way.
  const decision = decideProcessVo({
    force: FORCE,
    hasRaw: existsSync(rawWav),
    wavMtime: mtime(wav),
    rawMtime: mtime(rawWav),
    lastOutput: state.voOutput,
    outputNow: voStamp(),
    lastSettings: state.voSettings,
    settingsNow,
  });

  const settingsChanged = decision.why === 'settings';
  const newTake = decision.why === 'new-take';
  const unknown = decision.why === 'unknown';

  if (decision.run) {
    const why = settingsChanged
      ? 'vo settings changed'
      : newTake
        ? 'new take dropped in'
        : 'recording is newer';
    console.log(`  (${FORCE ? 'forced' : why})`);
    run('process-vo', 'process-vo.ts', [slug]);
  } else if (unknown) {
    skip('process-vo', 'no record of the last run — assuming vo.wav is current');
    console.log(`    (--force to process it anyway)`);
  } else {
    skip('process-vo', 'vo.wav is up to date');
  }
}

// -------------------------------------------------------------------- retime

const scriptNow = scriptHash();
const review = join(projectDir, 'transcript.md');

/*
  Retime is two stages with a human in the middle, so the build stops rather
  than runs through.

  The caption text is the transcript, burned into the finished video, and the
  mistakes whisper makes are function words a bigger model cannot fix. Stage one
  writes transcript.md and halts; stage two accepts it. A build that transcribed
  and carried straight on would put words nobody checked on screen, which is the
  failure this gate exists to catch.
*/
if (!existsSync(wav)) {
  skip('retime', 'no vo.wav to transcribe');
} else {
  const scriptChanged = state.voScript !== undefined && state.voScript !== scriptNow;
  const needsTranscribe = decideTranscribe({
    force: FORCE,
    reviewMtime: mtime(review),
    wavMtime: mtime(wav),
    lastScript: state.voScript,
    scriptNow,
  });

  if (needsTranscribe) {
    if (scriptChanged) {
      console.log('  (narration changed)');
    }
    run('transcribe', 'retime.ts', [slug, ...(FORCE ? ['--force'] : [])]);
    if (!DRY) {
      // Before the exit, or re-running lands back here forever. See `remember`.
      remember();
      console.log('\n⏸  Build paused for transcript review.');
      console.log('   Check the words above, fix any that are wrong in');
      console.log(`   projects/${slug}/transcript.md, then run this again.`);
      process.exit(0);
    }
  } else if (mtime(captions) < mtime(review)) {
    run('retime --apply', 'retime.ts', [slug, '--apply']);
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
  run('captions', 'captions.ts', [slug], { fatal: false });
}

// ----------------------------------------------------------------------- srt
// A subtitle sidecar from the same word timings. Long-form burns no captions
// in, so without this it would ship with none at all — and YouTube's automatic
// ones are worse than a transcript a human has already corrected at the gate.
// Costs milliseconds, so it runs whenever there is a transcript to build from.

if (existsSync(captions)) {
  run('srt', 'srt.ts', [slug]);
}

// --------------------------------------------------------------------- check
/*
  Machine QA. Reports only — like `captions`, it never fails the build.

  Here rather than left to a QA step because the failure it catches is one you
  cannot see while building and will not think to look for: text a few pixels
  into the action rail, a beat that holds for twenty seconds, a panel that
  overflows only between frames 400 and 460.

  It renders stills, so it is the slowest stage by a wide margin. `--no-check`
  skips it for the tight edit loop; the closing hint below then says so, because
  a skipped check that nobody mentions is the same as no check at all.
*/
let checkFindings = 0;
if (!NO_CHECK && existsSync(generated)) {
  checkFindings = run('check', 'check.ts', [slug, '--samples', String(CHECK_SAMPLES)], {
    fatal: false,
  });
}

remember();

console.log(`\n✓ ${slug} is built.`);
if (NO_CHECK) {
  console.log(`  ! check was skipped — run 'npm run check ${slug}' before rendering`);
} else if (checkFindings !== 0) {
  console.log(`  ! check found something above — fix it before rendering`);
}
console.log(`  preview:  npm run studio`);
console.log(`  stills:   ./scripts/contact-sheet.sh ${slug}-gizmo`);
console.log(`  render:   ./scripts/render.sh ${slug}-gizmo --deliver`);
