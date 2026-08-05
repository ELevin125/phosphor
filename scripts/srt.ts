/**
 * Writes an SRT subtitle sidecar from the word timings retime already produced.
 *
 *   npm run srt <slug>
 *
 * Long-form ships without burned-in captions (docs/FORMAT.md), which would
 * otherwise mean shipping with no captions at all — YouTube's auto-captions are
 * measurably worse than a transcript that has already been read and corrected
 * by a human at the review gate. The word timings are sitting in captions.json;
 * this is nearly free accessibility.
 *
 * Phrases are grouped with the KIT's own grouper, so the sidecar breaks in the
 * same places the burned-in captions would. Writing a second, simpler grouper
 * here would drift from it, and the phrasing work in phrases.ts — sentence
 * snapping, function-word costs, lean-back words — is the part worth reusing.
 *
 * Output: out/<slug>/deliver/<slug>.srt, next to the video it belongs to.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Caption } from '@remotion/captions';
import { PROFILES } from '../src/kit/layout';
import { phrasesFromCaptions, type Phrase } from '../src/kit/captions/phrases';

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('usage: npm run srt <slug>');
  process.exit(1);
}

const ROOT = process.cwd();
const projectDir = join(ROOT, 'projects', slug);
const captionsPath = join(projectDir, 'captions.json');

if (!existsSync(captionsPath)) {
  console.error(
    `No ${captionsPath}.\n` +
      `An SRT comes from the transcript, so record a voiceover and run\n` +
      `  npm run build ${slug}\n` +
      `first.`,
  );
  process.exit(1);
}

/**
 * SRT wants `HH:MM:SS,mmm` — comma, not the period WebVTT uses. Players are
 * inconsistent about forgiving the wrong one, so it is worth being exact.
 */
const stamp = (ms: number): string => {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const milli = clamped % 1000;
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
};

const captions = JSON.parse(readFileSync(captionsPath, 'utf8')) as Caption[];
if (captions.length === 0) {
  console.error(`${captionsPath} is empty.`);
  process.exit(1);
}

/*
  Beat boundaries split phrases, so no subtitle spans a cut. Optional: a project
  that has captions.json but no built timings still gets a usable sidecar, just
  without the beat-aware splits.
*/
const generated = join(projectDir, 'beats.generated.ts');
let boundariesMs: number[] = [];
let maxChars = PROFILES.portrait.captionMaxChars;

if (existsSync(generated)) {
  const src = readFileSync(generated, 'utf8');
  const fps = Number(src.match(/export const FPS[^=]*=\s*(\d+(?:\.\d+)?)/)?.[1] ?? 30);
  const profile = src.match(/export const PROFILE[^=]*=\s*"(\w+)"/)?.[1];
  if (profile === 'landscape' || profile === 'portrait') {
    maxChars = PROFILES[profile].captionMaxChars;
  }
  // Cumulative beat ends, in ms — the same list Stage builds for the burned-in
  // captions, derived from the same generated durations.
  const durations = [...src.matchAll(/durationInFrames:\s*(\d+)/g)].map((m) => Number(m[1]));
  let frames = 0;
  boundariesMs = durations.map((d) => {
    frames += d;
    return (frames / fps) * 1000;
  });
}

const phrases: Phrase[] = phrasesFromCaptions(captions, boundariesMs, maxChars);

const srt = phrases
  .map((p, i) => `${i + 1}\n${stamp(p.startMs)} --> ${stamp(p.endMs)}\n${p.text}\n`)
  .join('\n');

const outDir = join(ROOT, 'out', slug, 'deliver');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${slug}.srt`);
writeFileSync(outPath, srt);

const runtime = phrases[phrases.length - 1]?.endMs ?? 0;
console.log(`✓ out/${slug}/deliver/${slug}.srt`);
console.log(`  ${phrases.length} cues over ${(runtime / 1000).toFixed(1)}s`);
