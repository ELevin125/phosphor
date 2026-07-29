/**
 * Audio primitives shared by the voiceover scripts.
 *
 * `process-vo` found silences to trim them; `cut` finds the same silences to
 * splice at them. Two copies of a boundary-finder that must agree about where
 * the boundaries are is exactly the kind of duplication that produces an edit
 * landing half a word early, so it lives here.
 *
 * Nothing in here loads audio into anything but a typed array — ffmpeg does the
 * decoding and the numbers come back as samples.
 */
import { execFileSync, spawnSync } from 'node:child_process';

/** Sample rate for analysis. Speech has nothing above 8kHz worth measuring. */
export const SR = 22050;

export type Span = { readonly start: number; readonly end: number };

export const durationOf = (path: string): number => {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  );
  return Number(out.trim());
};

/**
 * ffmpeg's own log output.
 *
 * Detectors like `silencedetect` report on stderr rather than stdout, and
 * ffmpeg exits non-zero often enough that `execFileSync` throwing on it loses
 * the very output being asked for.
 */
export const ffmpegStderr = (args: string[]): string => {
  const res = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.error) {
    throw res.error;
  }
  return res.stderr ?? '';
};

/** Mono f32 PCM at `SR`, straight out of ffmpeg. */
export const decode = (path: string): Float32Array => {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    // Takes are minutes long, and the default 1MB pipe buffer is not enough.
    { maxBuffer: 512 * 1024 * 1024 },
  );
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
};

/** Silences longer than `min` seconds, from ffmpeg's own detector. */
export const findSilences = (path: string, min: number, noiseDb = -38): Span[] => {
  const log = ffmpegStderr([
    '-v', 'info',
    '-i', path,
    '-af', `silencedetect=noise=${noiseDb}dB:d=${min}`,
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
 * The sounding stretches between silences — the complement of `findSilences`.
 *
 * A trailing silence that never ends (the detector only reports `silence_end`
 * when sound resumes) leaves the final segment open, so it is closed against
 * the file duration by the caller passing `total`.
 */
export const soundingSpans = (silences: readonly Span[], total: number): Span[] => {
  const out: Span[] = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start > cursor) {
      out.push({ start: cursor, end: s.start });
    }
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < total) {
    out.push({ start: cursor, end: total });
  }
  return out;
};

/** Peak absolute sample within a span, 0..1. */
export const peakOf = (samples: Float32Array, span: Span): number => {
  const from = Math.max(0, Math.floor(span.start * SR));
  const to = Math.min(samples.length, Math.ceil(span.end * SR));
  let peak = 0;
  for (let i = from; i < to; i++) {
    const v = Math.abs(samples[i]!);
    if (v > peak) {
      peak = v;
    }
  }
  return peak;
};
