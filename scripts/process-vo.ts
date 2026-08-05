/**
 * Voiceover cleanup and loudness normalisation.
 *
 *   npm run process-vo <slug>
 *   npm run process-vo <slug> --highs -4 --denoise
 *   npm run process-vo <slug> --dry          # measure, change nothing
 *
 * Reads public/videos/<slug>/vo.raw.wav and writes vo.wav, which is what
 * `retime` transcribes and what `<Stage audioSrc>` plays.
 *
 * NON-DESTRUCTIVE, and that matters more than it sounds. On the first run, if
 * there is no vo.raw.* but there is a vo.wav, the recording is copied to
 * vo.raw.wav and everything works from that copy forever after. Without this,
 * a second run would compress an already-compressed file and a third would
 * make it audibly worse, with no way back short of re-recording.
 *
 * The chain, in order, and why each link is where it is:
 *
 *   highpass 80Hz   Room rumble, aircon, desk knocks, and the low thump of a
 *                   plosive. None of it is speech and all of it makes the
 *                   compressor duck for reasons you cannot hear. First, so
 *                   nothing downstream reacts to it.
 *   afftdn          Optional broadband noise reduction. Off by default —
 *                   denoisers cost you air and presence, and a quiet room
 *                   doesn't need one.
 *   acompressor     3:1 at -18dB. Evens out the difference between a leaned-in
 *                   line and a leaned-back one, which is most of what makes
 *                   amateur VO sound amateur.
 *   deesser         AFTER the compressor on purpose. Compression raises
 *                   sibilance along with everything else, so de-essing first
 *                   means de-essing a problem that hasn't happened yet.
 *   treble shelf    The "bring the highs down" control. Gentle by default.
 *   loudnorm        Two-pass EBU R128 to -16 LUFS, -1.5 dBTP.
 *   alimiter        Safety net for inter-sample peaks.
 *
 * -16 LUFS is the target because these go to phone speakers over music.
 * Instagram normalises toward roughly -14 and will turn a hotter file down;
 * mixing the voice at -16 leaves headroom for the bed underneath without the
 * platform squashing the result.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error(
    'usage: npm run process-vo <slug> ' +
      '[--bass 0] [--mid 0] [--midf 900] [--highs -2.5] [--deess 0.35]\n' +
      '                              [--hpf 80] [--lufs -16] [--pad 0.3] [--trim 0.7]\n' +
      '                              [--denoise] [--dry] [--adopt] [--reprocess]',
  );
  process.exit(1);
}

const args = process.argv.slice(3);

/**
 * Per-video settings, from the `vo:` block in projects/<slug>/beats.yaml.
 *
 * A voice needs different treatment in different rooms, and the settings that
 * make one recording sound right are a property of that recording — not of this
 * script. Passing them as flags means the only record of them is your shell
 * history, so re-running the chain months later silently gives you the defaults
 * and a voice that sounds wrong for reasons nobody can reconstruct.
 *
 * Precedence: CLI flag > beats.yaml > the default in this file.
 */
type VoConfig = Record<string, number | boolean | undefined>;

const loadVoConfig = (): VoConfig => {
  const path = join(process.cwd(), 'projects', slug, 'beats.yaml');
  if (!existsSync(path)) {
    return {};
  }
  const doc = parse(readFileSync(path, 'utf8')) as { vo?: VoConfig } | null;
  return doc?.vo ?? {};
};

const cfg = loadVoConfig();

/**
 * Settings passed as flags exist only in shell history. Once they are the ones
 * that sound right they belong in beats.yaml, beside the video they describe —
 * otherwise the next run of this script quietly reverts them and the reason the
 * voice sounded right is gone.
 */
function suggestPersist(): void {
  const passed = args
    .map((a, i) => ({ a, next: args[i + 1] }))
    // Actions, not settings. `--reprocess: true` in a beats.yaml would be
    // meaningless at best and would re-adopt on every run at worst.
    .filter(({ a }) => a.startsWith('--') && !['--dry', '--adopt', '--reprocess'].includes(a))
    .map(({ a, next }) => {
      const name = a.slice(2);
      const numeric = next !== undefined && !next.startsWith('--') && Number.isFinite(Number(next));
      return { name, value: numeric ? Number(next) : true };
    })
    .filter(({ name, value }) => cfg[name] !== value);

  if (passed.length === 0) {
    return;
  }

  console.log('\n  not in beats.yaml yet — persist to reproduce this next time:');
  console.log('\n    vo:');
  for (const { name, value } of passed) {
    console.log(`      ${name}: ${value}`);
  }
}

const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) {
    const fromYaml = cfg[name];
    if (typeof fromYaml === 'number') {
      return fromYaml;
    }
    return fallback;
  }
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v)) {
    console.error(`--${name} needs a number`);
    process.exit(1);
  }
  return v;
};

/** High-shelf gain in dB. Negative cuts. */
const HIGHS = flag('highs', -2.5);
/** De-esser intensity, 0..1. 0 disables. */
const DEESS = flag('deess', 0.35);
const LUFS = flag('lufs', -16);
/**
 * Silence prepended, in seconds.
 *
 * A take that starts on the first syllable has nowhere for the video to
 * breathe, gives whisper no room to settle before the first word, and cannot
 * be faded in. Cheaper to add here than to re-record.
 */
const PAD = flag('pad', 0.3);
/**
 * Longest silence to leave inside the take, in seconds. 0 disables trimming.
 *
 * A take has two kinds of gap in it and they need opposite treatment. The
 * breaths and beats between sentences are performance and must survive. The
 * dead air — the run-up before you start, the pause where you lost your place,
 * the tail after the last word — is not, and leaving it in means every beat
 * after it is timed around nothing happening.
 *
 * 0.7s keeps the former and cuts the latter.
 */
const TRIM = flag('trim', 0.7);
/**
 * Low-shelf gain in dB at 200Hz — chest and body.
 *
 * The cure for a thin voice. A close mic that is not that close, or any source
 * that has already been high-passed somewhere upstream, loses the fundamental
 * and leaves you with all articulation and no weight.
 */
const BASS = flag('bass', 0);
/**
 * Peaking gain in dB in the midrange. Negative cuts.
 *
 * Where to put it is a measurement, not a preset. "Nasal" is conventionally
 * 800Hz-1.2kHz, but a voice can read as nasal purely from having no bottom
 * octave, in which case there is no peak there to cut and scooping it just
 * makes the voice small. Measure octave bands first and aim at whatever is
 * actually sticking out.
 */
const MID = flag('mid', 0);
/** Centre frequency for --mid. */
const MIDF = flag('midf', 900);
/** High-pass corner in Hz. Drop it if the voice is low-pitched and thin. */
const HPF = flag('hpf', 80);
const DENOISE = args.includes('--denoise') || cfg.denoise === true;
/** CLI-only: an action, not a setting, so it has no place in beats.yaml. */
const DRY = args.includes('--dry');
/** vo.wav is a NEW RECORDING: archive the current raw and adopt it. */
const ADOPT = args.includes('--adopt');
/** vo.wav is old OUTPUT: discard it and rebuild from vo.raw.wav. */
const REPROCESS = args.includes('--reprocess');

const dir = join(process.cwd(), 'public', 'videos', slug);
const raw = join(dir, 'vo.raw.wav');
const out = join(dir, 'vo.wav');

if (!existsSync(dir)) {
  console.error(`No ${dir}. Record the voiceover and save it there first.`);
  process.exit(1);
}

/*
  Establish the untouched original, and re-establish it whenever a new take
  lands.

  `raw` is the only thing ever read and `out` is disposable, so settings can be
  re-tried freely. Two things can go wrong and they pull in opposite directions:

    - Process the OLD take over the top of a newly dropped-in vo.wav, and a
      recording is destroyed with no error and nothing to recover it from.
    - Adopt our OWN output as the raw, and the "original" becomes a processed
      file — every later run then compresses and normalises an already
      compressed and normalised take, and the true original is gone.

  This used to test `out` newer than `raw`, which cannot tell them apart: this
  script READS raw and WRITES out, so out is always newer after a normal run.
  The 1-second tolerance was far short of the time it takes to encode a
  100-second file, so the second run on any project adopted its own output. It
  went unnoticed only because build.ts tracks a content stamp and normally
  prevents a second run — until a project turned up without a state file, and
  then this fired and cost a real recording (recovered from the archive copy).

  So identity, not mtime, and when identity is unknown this REFUSES rather than
  guessing. A wrong guess is unrecoverable in one direction; a prompt costs a
  couple of seconds.
*/
const stateFile = join(dir, '.vo-state.json');

/** Identity of a file as content-ish: size plus mtime. Same idea as build.ts. */
const stampOf = (p: string): string =>
  existsSync(p) ? `${Math.round(statSync(p).mtimeMs)}:${statSync(p).size}` : '';

const readState = (): { output?: string } => {
  if (!existsSync(stateFile)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8')) as { output?: string };
  } catch {
    return {};
  }
};

/** Archives the current raw before anything replaces it. */
const archiveRaw = (): string => {
  // Local time, not ISO: these sit next to the recordings and get read by a
  // human deciding which take is which.
  const when = new Date(statSync(raw).mtimeMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
    `-${pad(when.getHours())}${pad(when.getMinutes())}`;
  const keep = join(dir, `vo.raw.${stamp}.wav`);
  copyFileSync(raw, keep);
  return keep.split('/').pop() ?? keep;
};

if (!existsSync(raw)) {
  if (!existsSync(out)) {
    console.error(`No vo.raw.wav or vo.wav in ${dir}.`);
    process.exit(1);
  }
  copyFileSync(out, raw);
  console.log('› first run — kept your recording as vo.raw.wav');
} else if (existsSync(out)) {
  const recorded = readState().output;
  const now = stampOf(out);

  if (recorded === now) {
    // vo.wav is exactly what this script last produced. Nothing to adopt.
  } else if (ADOPT || (recorded !== undefined && recorded !== now)) {
    const kept = archiveRaw();
    copyFileSync(out, raw);
    console.log('› new take — adopted vo.wav as vo.raw.wav');
    console.log(`  previous take kept at ${kept}`);
  } else if (!REPROCESS) {
    console.error(
      `Cannot tell what vo.wav is in ${dir}.\n\n` +
        `There is no record of this script producing it, so it is either a new\n` +
        `take you dropped in, or output from before this check existed.\n` +
        `Guessing wrong either destroys a recording or corrupts the original,\n` +
        `so pick one:\n\n` +
        `  npm run process-vo ${slug} -- --adopt\n` +
        `      vo.wav is a NEW RECORDING. Archive the current raw and adopt it.\n\n` +
        `  npm run process-vo ${slug} -- --reprocess\n` +
        `      vo.wav is old OUTPUT. Discard it and rebuild from vo.raw.wav.\n`,
    );
    process.exit(1);
  }
}

// --- silence trimming --------------------------------------------------------

type Span = { readonly start: number; readonly end: number };

const durationOf = (path: string): number => {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  );
  return Number(out.trim());
};

/** Silences longer than `min` seconds, from ffmpeg's own detector. */
const findSilences = (path: string, min: number): Span[] => {
  const log = ffmpegStderr([
    '-v', 'info',
    '-i', path,
    '-af', `silencedetect=noise=-38dB:d=${min}`,
    '-f', 'null', '-',
  ]);
  const spans: Span[] = [];
  let start: number | null = null;
  for (const line of log.split('\n')) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (s) {
      start = Number(s[1]);
    }
    const e = /silence_end:\s*([\d.]+)/.exec(line);
    if (e && start !== null) {
      spans.push({ start, end: Number(e[1]) });
      start = null;
    }
  }
  return spans;
};

/**
 * The parts of the take worth keeping.
 *
 * Interior silences are shortened to `TRIM` rather than removed — cutting a
 * pause to zero jams two sentences together and sounds like a bad edit, which
 * is more distracting than the dead air was. The lead-in goes entirely (`PAD`
 * puts a controlled amount back) and the tail is capped at half a second.
 */
const keepRanges = (path: string, maxSilence: number): { keep: Span[]; cut: number } => {
  const total = durationOf(path);
  const silences = findSilences(path, maxSilence);
  const keep: Span[] = [];
  let cursor = 0;
  let cut = 0;

  for (const s of silences) {
    const leading = s.start <= 0.05;
    const trailing = s.end >= total - 0.05;
    const allowance = leading ? 0 : trailing ? 0.5 : maxSilence;
    if (s.end - s.start <= allowance) {
      continue;
    }

    const half = allowance / 2;
    const dropFrom = s.start + half;
    const dropTo = s.end - half;
    if (dropFrom > cursor) {
      keep.push({ start: cursor, end: dropFrom });
    }
    cut += dropTo - dropFrom;
    cursor = dropTo;
  }

  if (cursor < total) {
    keep.push({ start: cursor, end: total });
  }
  return { keep, cut };
};

/** Concatenate the keep-ranges into a new file. */
const writeTrimmed = (src: string, dest: string, keep: Span[]): void => {
  // Each atrim needs its own copy of the input pad, hence asplit.
  const labels = keep.map((_, i) => `s${i}`);
  const parts = [
    `[0:a]asplit=${keep.length}${labels.map((l) => `[${l}]`).join('')}`,
    ...keep.map(
      (span, i) =>
        `[${labels[i]}]atrim=start=${span.start.toFixed(3)}:end=${span.end.toFixed(3)},` +
        `asetpts=PTS-STARTPTS[t${i}]`,
    ),
    `${keep.map((_, i) => `[t${i}]`).join('')}concat=n=${keep.length}:v=0:a=1[out]`,
  ].join(';');

  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', src, '-filter_complex', parts, '-map', '[out]',
     '-c:a', 'pcm_s16le', dest],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
};

// --- measurement -------------------------------------------------------------

type Loudness = { i: number; lra: number; tp: number };

/**
 * Everything ffmpeg prints on stderr.
 *
 * Both the loudness summary and loudnorm's JSON go to stderr, not stdout —
 * stdout is reserved for piped media. `execFileSync` hands back stdout only,
 * so it has to be `spawnSync` here.
 */
const ffmpegStderr = (args: string[]): string => {
  const res = spawnSync('ffmpeg', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) {
    throw res.error;
  }
  return res.stderr ?? '';
};

/** EBU R128 integrated loudness, range and true peak. */
const measure = (path: string): Loudness => {
  const res = ffmpegStderr([
    '-v', 'info',
    '-i', path,
    '-af', `${MONO},ebur128=peak=true`,
    '-f', 'null', '-',
  ]);
  const tail = res.slice(res.lastIndexOf('Integrated loudness'));
  const num = (label: string): number => {
    const m = new RegExp(`${label}:\\s*(-?[\\d.]+|-inf)`).exec(tail);
    return m ? Number(m[1]) : NaN;
  };
  return { i: num('I'), lra: num('LRA'), tp: num('Peak') };
};

/** Loudness of the signal after an arbitrary filter chain, without writing it. */
const measureChain = (path: string, filters: string): Loudness => {
  const res = ffmpegStderr([
    '-v', 'info',
    '-i', path,
    '-af', `${filters},ebur128=peak=true`,
    '-f', 'null', '-',
  ]);
  const tail = res.slice(res.lastIndexOf('Integrated loudness'));
  const num = (label: string): number => {
    const m = new RegExp(`${label}:\\s*(-?[\\d.]+|-inf)`).exec(tail);
    return m ? Number(m[1]) : NaN;
  };
  return { i: num('I'), lra: num('LRA'), tp: num('Peak') };
};

const report = (label: string, l: Loudness): void => {
  console.log(
    `  ${label.padEnd(9)} ${l.i.toFixed(1)} LUFS   range ${l.lra.toFixed(1)} LU   peak ${l.tp.toFixed(1)} dBTP`,
  );
};

// --- filter chain ------------------------------------------------------------

/*
  Collapse to mono before anything is measured or processed.

  EBU R128 weights and sums channels, so a stereo file reads roughly 3dB louder
  than the identical content in mono. Downmixing at the END — which is what
  `-ac 1` on the output does — meant every measurement was taken on the stereo
  signal and the written file landed 3 LU quieter than the numbers claimed.
  Voice is mono anyway; this makes the reading and the file agree.
*/
const MONO = 'aformat=channel_layouts=mono';

/** Everything tonal: cleanup and shaping, no level decisions. */
const tonalChain = (): string[] => {
  const links = [MONO, `highpass=f=${HPF}`];

  /*
    Corrective EQ goes BEFORE the compressor. A resonant peak the compressor can
    see is a peak it ducks the whole voice for — cutting it first means the
    compressor responds to the performance rather than to one honking frequency.
  */
  if (MID !== 0) {
    links.push(`equalizer=f=${MIDF}:width_type=q:w=1.1:g=${MID}`);
  }

  if (DENOISE) {
    // nr = reduction in dB, nf = assumed noise floor. Conservative: a heavier
    // setting starts eating consonants.
    links.push('afftdn=nr=12:nf=-45');
  }

  links.push('acompressor=threshold=-24dB:ratio=4:attack=5:release=120:makeup=4');

  if (DEESS > 0) {
    links.push(`deesser=i=${DEESS}:m=0.5:f=0.5`);
  }

  /*
    Tonal shaping goes AFTER the compressor, so a bass boost isn't something the
    compressor then works to undo.
  */
  if (BASS !== 0) {
    links.push(`bass=g=${BASS}:f=200:width_type=q:w=0.6`);
  }

  if (HIGHS !== 0) {
    // Shelf at 6kHz: sibilance and mic brightness live above it, the
    // intelligibility band (1-4kHz) is left alone.
    links.push(`treble=g=${HIGHS}:f=6000:width_type=q:w=0.7`);
  }

  return links;
};

/**
 * `level=disabled` is not optional on either limiter.
 *
 * alimiter auto-levels its output to 0dBFS by default, which silently undoes
 * whatever loudness work just happened and lands the file a couple of LU hot.
 * It took a measurement to notice, because nothing errors.
 */
const WORKING_LIMIT = 'alimiter=limit=0.84:level=disabled';   // -1.5 dBFS
const SAFETY_LIMIT = 'alimiter=limit=0.89:level=disabled';    // ~-1 dBTP

const chain = (push: number, loudnormArg: string): string =>
  [
    ...tonalChain(),
    ...(PAD > 0 ? [`adelay=delays=${Math.round(PAD * 1000)}:all=1`] : []),
    /*
      The crest-factor problem, and why this gain stage exists.

      Speech runs ~15-17dB between its average level and its peaks. Hitting
      -16 LUFS with a -1.5 dBTP ceiling needs that gap under about 14.5dB, so
      loudnorm in linear mode simply runs out of headroom and stops early —
      quietly, landing 3 LU short with no error.

      So the peaks get dealt with FIRST: push the signal up by however much the
      target is short, and let the limiter below absorb what that pushes past
      the ceiling. That is the limiter doing its actual job rather than sitting
      at the end as decoration, and it is what every podcast master does.
      loudnorm afterwards only has to make a small exact correction.
    */
    `volume=${push.toFixed(1)}dB`,
    WORKING_LIMIT,
    loudnormArg,
    SAFETY_LIMIT,
  ].join(',');

const LOUDNORM = `loudnorm=I=${LUFS}:TP=-1.5:LRA=11`;

/**
 * How hard the limiter is allowed to be leaned on.
 *
 * Past roughly 9dB, limiting speech stops being transparent and starts sounding
 * squashed and breathy. If a recording needs more than that, the answer is to
 * record it louder, not to process harder — so it warns instead.
 */
const MAX_PUSH = 9;

// --- run ---------------------------------------------------------------------

console.log(`› ${slug}`);
const before = measure(raw);
report('before', before);

/*
  Trim first, so every later measurement describes the audio that actually
  ships. Loudness measured across ten seconds of silence is not the loudness of
  the take.
*/
let source = raw;
if (TRIM > 0) {
  const { keep, cut } = keepRanges(raw, TRIM);
  if (cut > 0.05) {
    source = join(dir, 'vo.trimmed.wav');
    writeTrimmed(raw, source, keep);
    console.log(
      `› trimmed ${cut.toFixed(1)}s of dead air ` +
        `(${keep.length} segments kept, silences capped at ${TRIM}s)`,
    );
  } else {
    console.log('› no dead air to trim');
  }
}

/*
  Work out how much to lean on the limiter, from this recording rather than
  from a constant. Measure what the tonal chain alone produces, and the
  shortfall against the target is exactly the push needed.
*/
process.stdout.write('› measuring tonal stage ... ');
const tonal = measureChain(source, tonalChain().join(','));
const wanted = LUFS - tonal.i;
const push = Math.max(0, Math.min(MAX_PUSH, wanted));
console.log(`${tonal.i.toFixed(1)} LUFS → push ${push.toFixed(1)}dB into the limiter`);

if (wanted > MAX_PUSH) {
  console.warn(
    `  ! wants ${wanted.toFixed(1)}dB but capped at ${MAX_PUSH}dB. ` +
      `This take is very quiet — expect it to land short of ${LUFS} LUFS.`,
  );
}

if (DRY) {
  console.log('\n--dry: nothing written.');
  console.log(`  would apply: ${chain(push, LOUDNORM)}`);
  suggestPersist();
  process.exit(0);
}

/*
  Two-pass loudnorm. The single-pass version works off a running estimate and
  drifts — the start of the file gets a different gain than the end, which on
  a voiceover is audible as the level creeping. Pass one measures the whole
  file, pass two applies one constant correction.
*/
process.stdout.write('› pass 1 (measuring) ... ');
const pass1 = ffmpegStderr([
  '-v', 'info',
  '-i', source,
  // print_format belongs to loudnorm, so it has to go inside chain() — appended
  // to the finished string it lands on whatever filter happens to be last.
  '-af', chain(push, `${LOUDNORM}:print_format=json`),
  '-f', 'null', '-',
]);

const json = pass1.slice(pass1.lastIndexOf('{'), pass1.lastIndexOf('}') + 1);
const m = JSON.parse(json) as {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
};
console.log('done');

const measured =
  `${LOUDNORM}:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
  `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}` +
  `:offset=${m.target_offset}:linear=true`;

process.stdout.write('› pass 2 (writing)   ... ');
const tmp = join(dir, 'vo.processing.wav');
execFileSync(
  'ffmpeg',
  [
    '-v', 'error', '-y',
    '-i', source,
    '-af', chain(push, measured),
    '-ac', '1',
    '-ar', '48000',
    '-c:a', 'pcm_s16le',
    tmp,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
renameSync(tmp, out);
console.log('done');

const after = measure(out);
report('after', after);

const drift = Math.abs(after.i - LUFS);
if (drift > 1) {
  console.warn(
    `  ! landed ${drift.toFixed(1)} LU from the ${LUFS} target — ` +
      `usually means the recording is very quiet or heavily clipped.`,
  );
}

/*
  Record what we just produced, so the next run can tell this file apart from a
  take dropped in by hand. Without it the only signal is mtime, which is always
  "output is newer" and cost a recording once already.
*/
writeFileSync(stateFile, JSON.stringify({ output: stampOf(out) }, null, 2));

console.log(`\n✓ ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
console.log('  original untouched at vo.raw.wav — re-run with different flags any time.');

console.log(`\n  next: npm run retime ${slug}`);
suggestPersist();
