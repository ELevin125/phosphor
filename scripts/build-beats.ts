/**
 * beats.yaml -> beats.generated.ts
 *
 * Keeps timing in one editable place. Run after any edit to a beats.yaml:
 *   npm run build-beats            # all videos
 *   npm run build-beats <slug>     # one video
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const VIDEOS_DIR = join(process.cwd(), 'projects');

type RawBeat = { id: string; duration: number; vo: string };
type VideoType = 'educational' | 'showcase';
type RawFile = {
  slug: string;
  title: string;
  fps?: number;
  silent?: boolean;
  /** `showcase` = showing something off, not teaching it. No runtime target. */
  type?: VideoType;
  beats: RawBeat[];
};

const build = (slug: string): void => {
  const dir = join(VIDEOS_DIR, slug);
  const yamlPath = join(dir, 'beats.yaml');
  if (!existsSync(yamlPath)) {
    return;
  }

  const doc = parse(readFileSync(yamlPath, 'utf8')) as RawFile;
  const fps = doc.fps ?? 30;

  const seen = new Set<string>();
  for (const b of doc.beats) {
    if (seen.has(b.id)) {
      throw new Error(`${slug}: duplicate beat id "${b.id}"`);
    }
    seen.add(b.id);
    if (!b.vo || b.vo.trim() === '') {
      throw new Error(
        `${slug}: beat "${b.id}" has no vo line` +
          (doc.silent ? ' (in a silent video, vo holds the on-screen text)' : ''),
      );
    }
  }

  const beats = doc.beats.map((b) => ({
    id: b.id,
    durationInFrames: Math.round(b.duration * fps),
    vo: b.vo.trim(),
  }));

  const total = beats.reduce((s, b) => s + b.durationInFrames, 0);
  const seconds = total / fps;

  // A showcase runs as long as its footage does -- there is no script to pace,
  // so a runtime target would be meaningless. Explainers are paced by speech
  // (35-50s) or, when silent, by reading speed (18-40s).
  if (doc.type !== 'showcase') {
    const [lo, hi] = doc.silent ? [18, 40] : [35, 50];
    if (seconds < lo || seconds > hi) {
      console.warn(
        `  ! ${slug}: ${seconds.toFixed(1)}s is outside the ${lo}-${hi}s target` +
          `${doc.silent ? ' (silent)' : ''}.`,
      );
    }
  }

  // Real word timings, if the VO has been transcribed by `npm run retime`.
  const captionsPath = join(dir, 'captions.json');
  const captions = existsSync(captionsPath)
    ? (JSON.parse(readFileSync(captionsPath, 'utf8')) as unknown[])
    : [];

  // The voiceover, if it has been recorded and placed in public/.
  const audioRel = `videos/${slug}/vo.wav`;
  const hasAudio = existsSync(join(process.cwd(), 'public', audioRel));

  const out = `// GENERATED FROM beats.yaml -- do not edit by hand.
// Run 'npm run build-beats' after changing beats.yaml.
import type { BeatTiming } from '@kit';
import type { Caption } from '@remotion/captions';

export const FPS = ${fps};
export const TITLE = ${JSON.stringify(doc.title)};

export const BEATS: readonly BeatTiming[] = ${JSON.stringify(beats, null, 2)} as const;

export const TOTAL_FRAMES = ${total}; // ${seconds.toFixed(1)}s

export const SILENT = ${doc.silent ? true : false};
export const VIDEO_TYPE = ${JSON.stringify(doc.type ?? 'educational')};

/** Path inside public/, or null until a vo.wav exists. */
export const AUDIO_SRC: string | null = ${hasAudio ? JSON.stringify(audioRel) : 'null'};

/** Empty until 'npm run retime' transcribes the VO; captions fall back to beat text. */
export const CAPTIONS: readonly Caption[] = ${JSON.stringify(captions)} as Caption[];
`;

  writeFileSync(join(dir, 'beats.generated.ts'), out);
  console.log(`  ok ${slug}: ${beats.length} beats, ${total} frames (${seconds.toFixed(1)}s)`);
};

const arg = process.argv[2];
const slugs = arg
  ? [arg]
  : readdirSync(VIDEOS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

console.log('build-beats:');
for (const slug of slugs) {
  build(slug);
}
