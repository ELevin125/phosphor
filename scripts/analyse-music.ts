/**
 * Offline beat analysis for the music library.
 *
 *   npm run analyse-music              # every track missing an analysis
 *   npm run analyse-music lofi-01      # one track
 *   npm run analyse-music --force      # redo everything
 *
 * Reads public/music/<name>.(mp3|wav|m4a|ogg), writes
 * public/music/<name>.analysis.json. Nothing here touches the network and
 * nothing sends audio anywhere — ffmpeg decodes to raw samples, the rest is
 * arithmetic in this file.
 *
 * What comes out, and why each piece exists:
 *
 *   tempo      BPM. Mostly informational, but it is what turns "start 12.4s in"
 *              into "start on a downbeat".
 *   beats[]    Every beat position in seconds.
 *   downbeats[]  Every fourth beat — the bar lines. Starting playback anywhere
 *              else makes a track sound like it was clipped, because the ear
 *              hears the first strong hit as beat one and then the real beat
 *              one arrives in the wrong place.
 *   energy[]   Per-bar loudness, normalised 0..1. Used to skip intros: a lofi
 *              track that opens on four bars of vinyl crackle should not be
 *              what a nine-second reel starts on.
 *   entries[]  Downbeats that are BOTH bar-aligned and in a loud enough part of
 *              the track to drop into cold. This is the list the video picks a
 *              random start from.
 *
 * The DSP is deliberately plain: STFT -> spectral flux -> autocorrelation for
 * tempo -> comb filter for phase. It is not going to beat librosa on breakcore.
 * On lofi, synthwave and vapourwave — steady tempo, clear kick — it is fine,
 * and it costs no dependencies and no install step.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';

const MUSIC_DIR = join(process.cwd(), 'public', 'music');
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.opus']);

// Analysis rate. 22.05kHz keeps everything below ~11kHz, which is far above
// where kick and snare energy lives, and halves the work.
const SR = 22050;
const FFT_SIZE = 1024;
const HOP = 256;                     // ~11.6ms per frame
const FRAME_RATE = SR / HOP;         // ~86 frames/sec

const MIN_BPM = 60;
const MAX_BPM = 180;
const BEATS_PER_BAR = 4;

/** Loudness (0..1) a bar must reach before it is a candidate cold-start point. */
const ENTRY_ENERGY = 0.55;

// --- decode -----------------------------------------------------------------

/**
 * Integrated loudness, EBU R128.
 *
 * The one number in here that is absolute rather than relative. `energy[]` is
 * normalised against the track's own loudest bar, which says where the track
 * is busy but nothing at all about how loud it is next to a voice — and every
 * track that comes off a stock-music site is mastered near the ceiling, so a
 * fixed `volume` multiplier lands somewhere different for each one. Measured
 * once here so the kit can position a bed against the voiceover instead of
 * against a number somebody picked by ear on one track and never revisited.
 *
 * Computed with ffmpeg's own R128 meter rather than from `samples`, because
 * gating a loudness measurement properly is a specification, not a mean.
 */
const integratedLoudness = (path: string): number => {
  // spawnSync, not execFileSync: the R128 summary goes to stderr, and
  // execFileSync only hands back stdout.
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', path, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  // Tolerant of the `[Parsed_ebur128_0 @ 0x…]` prefixes ffmpeg puts on the
  // lines between the heading and the figure.
  const m = /Integrated loudness:[\s\S]{0,200}?I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/.exec(r.stderr ?? '');
  if (!m) {
    throw new Error(`Could not read integrated loudness from ffmpeg for ${path}.`);
  }
  return Math.round(Number(m[1]) * 10) / 10;
};

/** Mono f32 PCM at SR, straight out of ffmpeg. */
const decode = (path: string): Float32Array => {
  const raw = execFileSync(
    'ffmpeg',
    [
      '-v', 'error',
      '-i', path,
      '-ac', '1',
      '-ar', String(SR),
      '-f', 'f32le',
      '-',
    ],
    // Tracks are minutes long, not hours; 512MB of headroom is plenty and the
    // default 1MB pipe buffer is not.
    { maxBuffer: 512 * 1024 * 1024 },
  );
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
};

// --- FFT --------------------------------------------------------------------

/**
 * In-place iterative radix-2 FFT. `re`/`im` are length FFT_SIZE.
 *
 * Written out rather than pulled in because it is thirty lines and the
 * alternative is a dependency that has to survive every future npm install.
 */
const fft = (re: Float64Array, im: Float64Array): void => {
  const n = re.length;

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k]!;
        const aIm = im[i + k]!;
        const bRe = re[i + k + len / 2]! * curRe - im[i + k + len / 2]! * curIm;
        const bIm = re[i + k + len / 2]! * curIm + im[i + k + len / 2]! * curRe;

        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe;
        im[i + k + len / 2] = aIm - bIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
};

// --- onset envelope ---------------------------------------------------------

/**
 * Spectral flux: how much the spectrum GREW between consecutive frames.
 *
 * Only increases count. A note ending is a big spectral change and not an
 * onset, so counting the drop as well would put a beat at the end of every
 * sustained pad.
 */
const onsetEnvelope = (samples: Float32Array): Float32Array => {
  const frames = Math.max(0, Math.floor((samples.length - FFT_SIZE) / HOP));
  const flux = new Float32Array(frames);

  const window = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));
  }

  const bins = FFT_SIZE / 2;
  let prev = new Float64Array(bins);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);

  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[off + i]! * window[i]!;
      im[i] = 0;
    }
    fft(re, im);

    const mag = new Float64Array(bins);
    let sum = 0;
    for (let b = 0; b < bins; b++) {
      // Log magnitude: percussive transients sit tens of dB above the noise
      // floor, and on a linear scale a quiet track's beats barely register.
      mag[b] = Math.log1p(Math.hypot(re[b]!, im[b]!));
      const diff = mag[b]! - prev[b]!;
      if (diff > 0) {
        sum += diff;
      }
    }
    flux[f] = sum;
    prev = mag;
  }

  return flux;
};

/** Subtract a local moving average so a loud section doesn't dominate a quiet one. */
const normaliseEnvelope = (flux: Float32Array): Float32Array => {
  const win = Math.round(FRAME_RATE * 0.4);
  const out = new Float32Array(flux.length);
  for (let i = 0; i < flux.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - win); j < Math.min(flux.length, i + win); j++) {
      sum += flux[j]!;
      n++;
    }
    out[i] = Math.max(0, flux[i]! - (n > 0 ? sum / n : 0));
  }
  return out;
};

// --- tempo ------------------------------------------------------------------

/**
 * Autocorrelate the onset envelope and take the strongest lag in range.
 *
 * The octave trap: a 140 BPM track correlates just as well at 70, and half the
 * time better, because every beat is also an every-other-beat. Preferring the
 * faster reading whenever the half-tempo score is close keeps synthwave from
 * being reported at 70 BPM and bars from coming out twice as long as they are.
 */
const estimateTempo = (env: Float32Array): number => {
  const minLag = Math.floor((60 / MAX_BPM) * FRAME_RATE);
  const maxLag = Math.ceil((60 / MIN_BPM) * FRAME_RATE);

  const score = new Float64Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < env.length; i++) {
      sum += env[i]! * env[i + lag]!;
    }
    // Longer lags overlap fewer samples; normalise or slow tempos always win.
    score[lag] = sum / (env.length - lag);
  }

  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (score[lag]! > score[bestLag]!) {
      bestLag = lag;
    }
  }

  const halfLag = Math.round(bestLag / 2);
  if (halfLag >= minLag && score[halfLag]! > score[bestLag]! * 0.7) {
    bestLag = halfLag;
  }

  return (60 * FRAME_RATE) / bestLag;
};

/**
 * Where beat one actually falls. Slide a comb of beat positions across one beat
 * period and keep the offset that lands on the most onset energy.
 */
const estimatePhase = (env: Float32Array, period: number): number => {
  let bestOffset = 0;
  let bestScore = -1;

  for (let offset = 0; offset < period; offset += 0.5) {
    let sum = 0;
    for (let t = offset; t < env.length; t += period) {
      sum += env[Math.round(t)] ?? 0;
    }
    if (sum > bestScore) {
      bestScore = sum;
      bestOffset = offset;
    }
  }

  return bestOffset;
};

/**
 * Which beat of the four starts a bar.
 *
 * Same comb trick one level up. Downbeats carry the kick, so the bar phase that
 * collects the most onset energy is the right one.
 */
const estimateBarPhase = (env: Float32Array, beatFrames: number[]): number => {
  let best = 0;
  let bestScore = -1;

  for (let phase = 0; phase < BEATS_PER_BAR; phase++) {
    let sum = 0;
    for (let i = phase; i < beatFrames.length; i += BEATS_PER_BAR) {
      sum += env[Math.round(beatFrames[i]!)] ?? 0;
    }
    if (sum > bestScore) {
      bestScore = sum;
      best = phase;
    }
  }

  return best;
};

// --- energy -----------------------------------------------------------------

/** RMS loudness per bar, normalised against the loudest bar. */
const barEnergy = (samples: Float32Array, downbeats: number[]): number[] => {
  const raw = downbeats.map((start, i) => {
    const end = downbeats[i + 1] ?? start + 2;
    const a = Math.floor(start * SR);
    const b = Math.min(samples.length, Math.floor(end * SR));
    let sum = 0;
    for (let j = a; j < b; j++) {
      sum += samples[j]! * samples[j]!;
    }
    return b > a ? Math.sqrt(sum / (b - a)) : 0;
  });

  const peak = Math.max(...raw, 1e-9);
  return raw.map((v) => v / peak);
};

// --- driver -----------------------------------------------------------------

export type MusicAnalysis = {
  /** Path relative to `public/music/`, e.g. `synthwave/neon.mp3`. */
  readonly track: string;
  /** Containing folder, or `null` at the top level. Doubles as a mood tag. */
  readonly genre: string | null;
  readonly duration: number;
  readonly tempo: number;
  /** Integrated loudness in LUFS. Absolute, unlike `energy`. */
  readonly lufs: number;
  readonly beats: number[];
  readonly downbeats: number[];
  readonly energy: number[];
  /** Downbeats loud enough to start a video on. See ENTRY_ENERGY. */
  readonly entries: number[];
  readonly analysedAt: string;
};

const analyse = (path: string): MusicAnalysis => {
  const samples = decode(path);
  const duration = samples.length / SR;

  const env = normaliseEnvelope(onsetEnvelope(samples));
  const tempo = estimateTempo(env);
  const period = (60 / tempo) * FRAME_RATE;
  const phase = estimatePhase(env, period);

  const beatFrames: number[] = [];
  for (let t = phase; t < env.length; t += period) {
    beatFrames.push(t);
  }

  const barPhase = estimateBarPhase(env, beatFrames);
  const beats = beatFrames.map((f) => f / FRAME_RATE);

  const downbeats: number[] = [];
  for (let i = barPhase; i < beats.length; i += BEATS_PER_BAR) {
    downbeats.push(beats[i]!);
  }

  const energy = barEnergy(samples, downbeats);

  /*
    A usable entry point needs three things, and the last one is the one that
    is easy to forget: enough track left after it to actually cover a video.
    Thirty seconds is longer than most of these run, and a start point with
    twenty seconds behind it means the music stops mid-sentence.
  */
  const TAIL = 30;
  const entries = downbeats.filter(
    (t, i) => (energy[i] ?? 0) >= ENTRY_ENERGY && t < duration - TAIL,
  );

  const rel = relative(MUSIC_DIR, path);
  const folder = dirname(rel);

  return {
    track: rel,
    genre: folder === '.' ? null : folder,
    duration,
    tempo: Math.round(tempo * 10) / 10,
    lufs: integratedLoudness(path),
    beats: beats.map((t) => Math.round(t * 1000) / 1000),
    downbeats: downbeats.map((t) => Math.round(t * 1000) / 1000),
    energy: energy.map((v) => Math.round(v * 1000) / 1000),
    entries: entries.map((t) => Math.round(t * 1000) / 1000),
    analysedAt: new Date().toISOString().slice(0, 10),
  };
};

const ANALYSIS_DIR = join(MUSIC_DIR, 'analysis');

/**
 * Every audio file under `public/music/`, at any depth.
 *
 * Subfolders are genres — `synthwave/`, `lofi/` — which is a nicer way to keep
 * a library than a flat pile, and gives a free mood tag. The `analysis/`
 * folder is skipped so its JSON never gets mistaken for a track.
 */
const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path !== ANALYSIS_DIR) {
        out.push(...walk(path));
      }
    } else if (AUDIO_EXT.has(extname(entry.name).toLowerCase())) {
      out.push(path);
    }
  }
  return out;
};

/** A track's handle in a video: its filename, no folder, no extension. */
const idOf = (path: string): string => basename(path, extname(path));

/**
 * Collect every analysis into one typed module.
 *
 * The alternative — fetching the JSON out of public/ at render time — means an
 * async load inside a component that Remotion renders thousands of times in
 * parallel, and a `delayRender` to go with it. Baking it in makes the entry
 * point a synchronous lookup, which is what it wants to be.
 */
const writeGenerated = (): void => {
  // A fresh checkout has no music at all — the library is user data. Write the
  // module anyway with an empty TRACKS, because src/kit/Music.tsx imports it
  // unconditionally and a missing file fails the build rather than the render.
  const files = existsSync(ANALYSIS_DIR)
    ? readdirSync(ANALYSIS_DIR).filter((f) => f.endsWith('.json'))
    : [];
  const entries = files.map((f) => {
    const name = basename(f, '.json');
    const data = JSON.parse(readFileSync(join(ANALYSIS_DIR, f), 'utf8')) as MusicAnalysis;
    return { name, data };
  });

  const body = entries
    .map(({ name, data }) => {
      // `beats` is every beat in a four-minute track — thousands of numbers
      // nothing reads at render time. Only what the kit uses gets baked in.
      const slim = {
        track: data.track,
        genre: data.genre,
        duration: data.duration,
        tempo: data.tempo,
        lufs: data.lufs,
        downbeats: data.downbeats,
        entries: data.entries,
      };
      return `  ${JSON.stringify(name)}: ${JSON.stringify(slim)},`;
    })
    .join('\n');

  const out = `/* GENERATED by scripts/analyse-music.ts — do not edit. */
export type TrackAnalysis = {
  readonly track: string;
  readonly genre: string | null;
  readonly duration: number;
  readonly tempo: number;
  /** Integrated loudness in LUFS, so a bed can be placed under a known voice. */
  readonly lufs: number;
  readonly downbeats: readonly number[];
  readonly entries: readonly number[];
};

export const TRACKS: Record<string, TrackAnalysis> = {
${body}
};

export type TrackName = keyof typeof TRACKS;
`;

  writeFileSync(join(process.cwd(), 'src', 'music.generated.ts'), out);
  console.log(`\n✓ src/music.generated.ts (${entries.length} tracks)`);
};

const main = (): void => {
  // Not an error: this runs as a pre-hook before the studio, and a checkout
  // with no music should still start. Write the empty module and stop.
  if (!existsSync(MUSIC_DIR)) {
    console.log(`· no ${MUSIC_DIR} — skipping music analysis`);
    writeGenerated();
    return;
  }

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));

  const tracks = walk(MUSIC_DIR).filter(
    (p) => only.length === 0 || only.includes(idOf(p)),
  );

  if (tracks.length === 0) {
    console.log(only.length > 0 ? `No track matching ${only.join(', ')}` : 'No tracks yet.');
    // Still write the module — an empty library is the normal state of a fresh
    // checkout, and src/kit/Music.tsx imports it unconditionally.
    if (only.length === 0) {
      writeGenerated();
    }
    return;
  }

  // Ids are filenames, so two tracks with the same name in different genre
  // folders would silently overwrite each other's analysis.
  const byId = new Map<string, string>();
  for (const p of tracks) {
    const clash = byId.get(idOf(p));
    if (clash) {
      console.error(`Duplicate track id "${idOf(p)}":\n  ${clash}\n  ${p}\nRename one.`);
      process.exit(1);
    }
    byId.set(idOf(p), p);
  }

  mkdirSync(ANALYSIS_DIR, { recursive: true });

  for (const file of tracks) {
    const name = idOf(file);
    const out = join(ANALYSIS_DIR, `${name}.json`);

    if (existsSync(out) && !force) {
      console.log(`· ${name} (already analysed, --force to redo)`);
      continue;
    }

    process.stdout.write(`› ${name} ... `);
    const result = analyse(file);
    writeFileSync(out, JSON.stringify(result, null, 2));
    console.log(
      `${result.tempo} bpm, ${result.downbeats.length} bars, ` +
        `${result.entries.length} entry points, ${result.duration.toFixed(1)}s`,
    );

    if (result.entries.length === 0) {
      console.warn(
        `  ! no entry points — track is quiet throughout, or shorter than 30s. ` +
          `Videos using it will start at 0.`,
      );
    }
  }

  writeGenerated();

  // A manifest row per track, so a licence is never left undocumented.
  const manifest = join(MUSIC_DIR, 'music.yaml');
  if (existsSync(manifest)) {
    const text = readFileSync(manifest, 'utf8');
    const undocumented = tracks.map(idOf).filter((n) => !text.includes(`id: ${n}`));
    if (undocumented.length > 0) {
      console.warn(`\n! Not in music.yaml: ${undocumented.join(', ')}`);
      console.warn('  Add a row with source + licence before publishing anything using them.');
    }
  }
};

main();
