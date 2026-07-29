/**
 * Remove flubbed takes marked with a clap.
 *
 *   npm run cut <slug>            # report only
 *   npm run cut <slug> --write    # also write vo.cut.wav
 *
 * The convention: when you fluff a line, clap once, pause, and say it again.
 * A clap means "throw away what I just said" — everything from the previous
 * silence up to and including the clap goes.
 *
 * Why a marker rather than inference. The alternative is aligning the
 * transcript against the script and looking for a span covered twice, which
 * works and is a great deal of machinery for a problem that a hand gesture
 * solves exactly. Inference also fails in the case that matters most: a retake
 * whose wording drifted is precisely the retake the aligner is least sure
 * about. A clap is not ambiguous.
 *
 * Why not spectral flux. The obvious idea is to reuse the onset detector from
 * analyse-music, and it does not work — every syllable of speech is a spectral
 * onset, so it fires hundreds of times a take and the clap is not
 * distinguishable in the list. What actually separates a clap from speech is
 * that it is SHORT, LOUD and ALONE: a sub-half-second burst near the take's
 * peak with silence both sides. Speech does not do that.
 *
 * Non-destructive. It writes vo.cut.wav and never touches vo.wav, and the
 * default is to report and write nothing at all, because a false positive here
 * deletes a sentence you meant to keep.
 */
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { decode, durationOf, findSilences, peakOf, soundingSpans, type Span } from './audio';

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('usage: npm run cut <slug> [--write] [--gap 0.45] [--peak 0.5] [--max 0.45]');
  process.exit(1);
}
const args = process.argv.slice(3);
const WRITE = args.includes('--write');
const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(`--${name}`);
  const v = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(v) ? v : fallback;
};

/**
 * Shortest pause that counts as a boundary.
 *
 * This is the granularity of the whole edit: a clap discards back to the last
 * boundary, so a long value throws away more than the flubbed sentence and a
 * short one can put a boundary inside a phrase and cut mid-thought. Just under
 * half a second is about where a breath between sentences sits.
 */
const GAP = flag('gap', 0.45);
/** Fraction of the take's peak a burst must reach to be a clap. */
const PEAK = flag('peak', 0.5);
/** Longest a burst may be and still be a clap rather than a word. */
const MAX = flag('max', 0.45);
/** Taper at each splice. Long enough to kill a click, short enough to be unheard. */
const FADE = 0.015;

/*
  Operates on the RAW take, and runs BEFORE process-vo rather than after it.

  Two reasons, one measured and one structural. Measured: two-pass loudnorm to
  -16 LUFS lifts the room tone with everything else, and in a finished vo.wav
  the pauses sit around -20dB — silencedetect at -38dB finds nothing at all,
  so there are no boundaries to splice at. The same file before processing has
  fifteen. Structural: a clap is the loudest thing in the take by a wide
  margin, so leaving it in means loudnorm measures it and the true-peak limiter
  works around it. The audio you keep is quieter than it should be because of
  audio you are about to throw away.
*/
const mediaDir = join(process.cwd(), 'public', 'videos', slug);
const raw = join(mediaDir, 'vo.raw.wav');
// First run: process-vo has not adopted the recording yet, so raw may not exist.
const input = existsSync(raw) ? raw : join(mediaDir, 'vo.wav');
const output = join(mediaDir, 'vo.cut.wav');

if (!existsSync(input)) {
  console.error(`No vo.raw.wav or vo.wav in ${mediaDir}. Record a voiceover first.`);
  process.exit(1);
}

const total = durationOf(input);
const samples = decode(input);
const silences = findSilences(input, GAP);
const sounding = soundingSpans(silences, total);

let takePeak = 0;
for (let i = 0; i < samples.length; i++) {
  const v = Math.abs(samples[i]!);
  if (v > takePeak) {
    takePeak = v;
  }
}

const secs = (n: number): string => `${n.toFixed(2)}s`;

const markers: number[] = [];
sounding.forEach((span, i) => {
  const length = span.end - span.start;
  if (length > MAX) {
    return;
  }
  const peak = peakOf(samples, span);
  if (peak < takePeak * PEAK) {
    return;
  }
  markers.push(i);
});

console.log(`cut: ${slug}`);
console.log(
  `  ${secs(total)} of audio, ${sounding.length} segments, ` +
    `${silences.length} pauses over ${GAP}s, peak ${takePeak.toFixed(3)}`,
);

if (markers.length === 0) {
  console.log('  no clap markers found — nothing to cut.');
  process.exit(0);
}

/*
  A clap discards the segment before it as well as itself. Two claps in a row
  mean the retake was fluffed too, so each one takes another segment back —
  handled by walking the markers in order and dropping both indices, since a
  second marker's "previous segment" is the first marker, already dropped.
*/
const dropped = new Set<number>();
for (const i of markers) {
  dropped.add(i);
  let prev = i - 1;
  while (prev >= 0 && dropped.has(prev)) {
    prev--;
  }
  if (prev >= 0) {
    dropped.add(prev);
  }
}

/*
  Turn the dropped segments into ranges to CUT, then keep the complement.

  Keeping the sounding spans and concatenating those instead is the obvious
  implementation and it is wrong: it drops every pause in the take along with
  the flub, jamming sentences together for the whole recording. The first
  version did exactly that and shortened a 61s test to 52s while only meaning
  to remove 0.36s. Only the marked ranges may go; everything else, silence
  included, has to survive untouched.

  Adjacent dropped segments merge across the silence between them, because the
  gap between a flubbed line and the clap that cancels it is part of the flub.
*/
type Cut = { start: number; end: number };
const cuts: Cut[] = [];
sounding.forEach((span, i) => {
  if (!dropped.has(i)) {
    return;
  }
  const last = cuts[cuts.length - 1];
  if (last && dropped.has(i - 1)) {
    last.end = span.end;
  } else {
    cuts.push({ start: span.start, end: span.end });
  }
});

let removed = 0;
for (const c of cuts) {
  removed += c.end - c.start;
  console.log(`  - cut  ${secs(c.start)} -> ${secs(c.end)}  (${secs(c.end - c.start)})`);
}

const keep: Span[] = [];
let cursor = 0;
for (const c of cuts) {
  if (c.start > cursor) {
    keep.push({ start: cursor, end: c.start });
  }
  cursor = c.end;
}
if (cursor < total) {
  keep.push({ start: cursor, end: total });
}

console.log(
  `  removing ${secs(removed)} in ${cuts.length} cut${cuts.length === 1 ? '' : 's'}, ` +
    `leaving ${secs(total - removed)}`,
);

if (!WRITE) {
  console.log('\n  report only — pass --write to produce vo.cut.wav.');
  process.exit(0);
}

/*
  Each kept span is trimmed out with a short taper at both ends and the pieces
  are concatenated. A splice that lands on a non-zero sample is an audible
  click, and one that lands mid-word is worse — trimming only at silence
  boundaries is what makes this safe, and the taper covers the rest.
*/
const parts = keep.map(
  (s, i) =>
    `[0:a]atrim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},` +
    `asetpts=PTS-STARTPTS,` +
    `afade=t=in:st=0:d=${FADE},` +
    `afade=t=out:st=${Math.max(0, s.end - s.start - FADE).toFixed(3)}:d=${FADE}[k${i}]`,
);
const filter =
  `${parts.join(';')};${keep.map((_, i) => `[k${i}]`).join('')}concat=n=${keep.length}:v=0:a=1[out]`;

const filterPath = join(mediaDir, '.cut-filter.txt');
writeFileSync(filterPath, filter);

const r = spawnSync(
  'ffmpeg',
  ['-y', '-v', 'error', '-i', input, '-filter_complex_script', filterPath, '-map', '[out]', output],
  { stdio: 'inherit' },
);
rmSync(filterPath, { force: true });
if (r.status !== 0) {
  console.error('\n  ffmpeg failed — vo.cut.wav not written.');
  process.exit(1);
}

console.log(`\n  ✓ ${output} (${secs(durationOf(output))})`);
console.log('    Listen to it, then move it over vo.raw.wav and re-run `npm run build`,\n    which re-processes and re-transcribes from the shortened take.');
