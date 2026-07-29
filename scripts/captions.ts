/**
 * Caption phrasing report.
 *
 *   npm run captions                 # scorecard for every video
 *   npm run captions second-listener # scorecard plus every phrase
 *
 * Exists because caption breaks were being judged by scrubbing a render, which
 * is slow, samples badly, and gives no way to tell whether a change to the
 * grouper helped or just moved the problem. Everything here is derived from
 * captions.json and beats.yaml, so it runs in milliseconds and can be checked
 * before committing to a render.
 *
 * The four counts are the four ways a burned-in caption looks wrong:
 *
 *   dangling  ends on a word that points forward — "has a health component and"
 *   orphan    one or two words, on screen for a few frames; reads as a glitch
 *   particle  splits a phrasal verb — "Enemy health ends" / "up with four…"
 *   straddle  carries a full stop in the middle, so it spans two sentences
 *
 * `sentence` is the only one where higher is better: the share of phrases that
 * end where a sentence does.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { phrasesFromCaptions, type Phrase } from '../src/kit/captions/phrases';
import { PROFILES, type ProfileName } from '../src/kit/layout';

const PROJECTS = join(process.cwd(), 'projects');

/*
  Kept deliberately separate from the sets the grouper uses.

  A checker that shares its rules with the thing it checks can only ever report
  that the code did what the code does. These are the plain-English versions —
  if the grouper's tuning drifts away from them, that is a finding, not a bug in
  the report.
*/
const POINTS_FORWARD = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any', 'every',
  'my', 'your', 'our', 'their', 'its', 'his', 'her', 'i', 'we', 'you', 'they',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'into', 'with', 'about',
  'and', 'or', 'but', 'so', 'as', 'if', 'than', 'because', 'while', 'when',
  'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'has', 'have',
  'had', 'will', 'would', 'can', 'could', 'should', 'not', 'very', 'just',
]);

const LEANS_BACK = new Set([
  'up', 'down', 'out', 'off', 'over', 'through', 'away', 'back', 'along',
  'around', 'together', 'not', 'instead', 'though', 'too', 'else',
]);

const SENTENCE_END = /[.!?]["')\]]?$/;
const key = (w: string): string => w.toLowerCase().replace(/[^a-z']/g, '');

type Flags = {
  readonly dangling: boolean;
  readonly orphan: boolean;
  readonly particle: boolean;
  readonly straddle: boolean;
  readonly onSentence: boolean;
  readonly words: number;
};

const inspect = (phrase: Phrase, next: Phrase | undefined): Flags => {
  const words = phrase.text.split(/\s+/);
  const last = words[words.length - 1]!;
  const onSentence = SENTENCE_END.test(last);

  return {
    words: words.length,
    onSentence,
    // A sentence end is a legitimate place to stop even on "that" or "it".
    dangling: !onSentence && POINTS_FORWARD.has(key(last)),
    orphan: words.length <= 2,
    particle:
      !onSentence &&
      next !== undefined &&
      LEANS_BACK.has(key(next.text.split(/\s+/)[0]!)),
    straddle: words.slice(0, -1).some((w) => SENTENCE_END.test(w)),
  };
};

const boundaries = (doc: { fps?: number; beats: { duration: number }[] }): number[] => {
  const fps = doc.fps ?? 30;
  const out: number[] = [];
  let frames = 0;
  for (const beat of doc.beats) {
    frames += Math.round(beat.duration * fps);
    out.push((frames / fps) * 1000);
  }
  return out;
};

const report = (slug: string, verbose: boolean): boolean => {
  const dir = join(PROJECTS, slug);
  const captionsPath = join(dir, 'captions.json');
  const beatsPath = join(dir, 'beats.yaml');
  if (!existsSync(captionsPath) || !existsSync(beatsPath)) {
    return true;
  }

  const captions = JSON.parse(readFileSync(captionsPath, 'utf8'));
  const doc = parse(readFileSync(beatsPath, 'utf8'));
  // The band width is a property of the frame, so the report has to score
  // against the profile this video is actually authored for.
  const profile = (doc.profile ?? 'portrait') as ProfileName;
  const phrases = phrasesFromCaptions(
    captions,
    boundaries(doc),
    PROFILES[profile].captionMaxChars,
  );
  if (phrases.length === 0) {
    return true;
  }

  const flags = phrases.map((p, i) => inspect(p, phrases[i + 1]));
  const count = (pick: (f: Flags) => boolean): number => flags.filter(pick).length;

  const dangling = count((f) => f.dangling);
  const orphan = count((f) => f.orphan);
  const particle = count((f) => f.particle);
  const straddle = count((f) => f.straddle);
  const onSentence = count((f) => f.onSentence);
  const pct = (n: number): string => `${Math.round((n / phrases.length) * 100)}%`;

  if (verbose) {
    phrases.forEach((p, i) => {
      const f = flags[i]!;
      const marks = [
        f.dangling ? 'dangling' : '',
        f.orphan ? 'orphan' : '',
        f.particle ? 'particle' : '',
        f.straddle ? 'straddle' : '',
      ]
        .filter(Boolean)
        .join(' ');
      console.log(
        `  ${String(i).padStart(3)}  ${f.words}w  ${p.text.padEnd(46)}${marks ? `  <- ${marks}` : ''}`,
      );
    });
    console.log();
  }

  // Any of these on screen is a visible defect, so the bar is zero rather than
  // a percentage. Dangling breaks are the exception: some are unavoidable in a
  // long clause with nowhere good to stop.
  const clean = orphan === 0 && straddle === 0 && dangling <= Math.ceil(phrases.length * 0.12);

  console.log(
    `${clean ? '  ok' : '  ! '} ${slug.padEnd(20)} ${String(phrases.length).padStart(3)} phrases` +
      `   dangling ${String(dangling).padStart(2)} (${pct(dangling).padStart(3)})` +
      `   orphan ${orphan}   particle ${particle}   straddle ${straddle}` +
      `   ending a sentence ${pct(onSentence).padStart(3)}`,
  );
  return clean;
};

const arg = process.argv[2];
const slugs = arg
  ? [arg]
  : readdirSync(PROJECTS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

console.log('captions:');
let allClean = true;
for (const slug of slugs) {
  if (!report(slug, Boolean(arg))) {
    allClean = false;
  }
}
if (!allClean) {
  console.log('\n  ! rerun with a slug to see the offending phrases.');
}
