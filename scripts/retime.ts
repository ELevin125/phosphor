/**
 * Re-times a video against its recorded voiceover, with a review gate.
 *
 *   npm run retime <slug>            transcribe, then STOP for review
 *   npm run retime <slug> --apply    accept the reviewed transcript, re-time
 *   npm run retime <slug> --force    re-transcribe, discarding review edits
 *
 * The gate exists because the caption text IS the transcript. Whatever whisper
 * hears is burned into the finished video, and the errors it makes are not the
 * ones you would guess: on a clean take of gimbal-lock, medium.en got "Euler"
 * and "quaternion" right and lost a "that's" and an "in". Every residual
 * mistake measured across this repo is a short function word — a/the, and/in,
 * up/on, the/their — which no larger model fixes, because the information is
 * not in the audio. It is in the person who read the script.
 *
 * So the pipeline stops and asks. Stage one transcribes and writes
 * `transcript.md`; a human fixes the words; stage two re-attaches the timings
 * and carries on. Timings are re-derived by alignment rather than by position,
 * so edits cannot desynchronise the captions — words may be added, removed,
 * merged or split freely.
 *
 * Stage one:
 *   1. Converts public/videos/<slug>/vo.wav to the 16kHz mono WAV whisper.cpp
 *      requires (it will not accept anything else).
 *   2. Transcribes it with token-level timestamps.
 *   3. Writes projects/<slug>/transcript.md   -> the words, for review.
 *      Writes projects/<slug>/.transcript.json -> the timings, cached.
 *   4. Reports which words are worth a second look.
 *
 * Stage two:
 *   5. Re-attaches timings to the reviewed words.
 *   6. Writes projects/<slug>/captions.json   -> real burned-in captions.
 *   7. Rewrites the `duration` of every beat in beats.yaml from where that
 *      beat's narration actually lands in the audio.
 *   8. Re-runs build-beats.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from '@remotion/install-whisper-cpp';
import type { Caption } from '@remotion/captions';
import { parse, parseDocument } from 'yaml';
import { align, norm, type Step } from './align';

// Pinned: token-level timestamps are version-sensitive in whisper.cpp.
const WHISPER_VERSION = '1.5.5';
/**
 * medium.en, and deliberately not larger.
 *
 * large-v3 was measured against this take: it fixed four words ("we're", "in
 * stuff like", "3D", "visualise") and broke two ("the description", "their
 * heavy lifting"), for 1.7x the time and 2x the disk. large-v3-turbo cannot run
 * at all — whisper.cpp 1.5.5's --dtw only knows presets up to `large.v3`, and
 * unpinning it would move the token-level timestamps this pipeline stands on.
 *
 * The review gate below is what a bigger model was supposed to buy, and it
 * catches the errors a bigger model cannot.
 */
const WHISPER_MODEL = 'medium.en';
const WHISPER_PATH = join(process.cwd(), '.tooling', 'whisper.cpp');

/**
 * Below this, whisper was guessing — flag the word for review.
 *
 * These are the decoder's own token probabilities, so the threshold is not a
 * quality judgement, just a place to draw the line on "it wasn't sure".
 */
const UNSURE = 0.5;

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('usage: npm run retime <slug> [--apply] [--force]');
  process.exit(1);
}
const args = process.argv.slice(3);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');

const videoDir = join(process.cwd(), 'projects', slug);
const wav = join(process.cwd(), 'public', 'videos', slug, 'vo.wav');
const yamlPath = join(videoDir, 'beats.yaml');
const reviewPath = join(videoDir, 'transcript.md');
const cachePath = join(videoDir, '.transcript.json');

/** A spoken word with its own timing. Never invented — always from the audio. */
type Word = {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
};

type Cache = {
  /** What whisper heard, before any review. The timing source. */
  readonly heard: readonly Word[];
  /** Hash of the transcript.md this run generated, to detect later edits. */
  readonly generated: string;
};

const sha = (s: string): string => createHash('sha1').update(s).digest('hex').slice(0, 12);

const readYaml = () => {
  const doc = parseDocument(readFileSync(yamlPath, 'utf8'));
  const plain = parse(readFileSync(yamlPath, 'utf8')) as {
    beats: { id: string; vo: string }[];
    corrections?: Record<string, string>;
  };
  return { doc, plain };
};

/**
 * The script, one entry per word, tagged with the beat it belongs to.
 *
 * Punctuation is carried alongside rather than in the word, because it is
 * stamped onto the transcript separately — whisper punctuates unreliably
 * (`every-frame` came back with 4 sentence ends where the script has 17) and
 * the caption grouper needs sentences to break on.
 */
type ScriptToken = { readonly word: string; readonly beat: number; readonly punct: string };

const scriptTokens = (beats: readonly { vo: string }[]): ScriptToken[] => {
  const out: ScriptToken[] = [];
  beats.forEach((beat, i) => {
    for (const token of beat.vo.trim().split(/\s+/)) {
      const word = norm(token);
      if (word) {
        out.push({
          word,
          beat: i,
          punct: /([.,;:!?]+)["')\]]?$/.exec(token)?.[1] ?? '',
        });
      }
    }
  });
  return out;
};

// ============================================================ stage one

/**
 * Rejoin whisper's sub-word tokens into whole words.
 *
 * Token-level output splits "doesn't" into "doesn" + "'t", and " Flood" +
 * "ful". Each fragment is a caption in its own right, so the phrase grouper can
 * end a line on "doesn" and open the next with "'t" — which is exactly what
 * showed up on screen. whisper marks a new word with a LEADING SPACE, so a
 * token starting with a letter and no leading space is the tail of the previous
 * one.
 *
 * The first fragment keeps the start time, the last carries the end time.
 */
const mergeTokens = (captions: readonly Caption[]): { words: Word[]; joined: number } => {
  const words: Word[] = [];
  for (const caption of captions) {
    const text = caption.text.trim();
    const prev = words[words.length - 1];

    const contraction = /^['’]/.test(text);
    // A token that is nothing but punctuation, which renders as a floating
    // comma with a space in front of it.
    const punctuation = text !== '' && /^[^\p{L}\p{N}]+$/u.test(text);
    // "1,000" arrives as "1" + "," + "000"; without this it reads "1 , 000".
    const thousands = prev !== undefined && /[,.]$/.test(prev.text) && /^\d+$/.test(text);
    const continuation =
      prev !== undefined && !/^\s/.test(caption.text) && /^[\p{L}\p{N}]/u.test(text);

    if (prev && (contraction || punctuation || thousands || continuation)) {
      prev.text += text;
      prev.endMs = caption.endMs;
      continue;
    }
    if (text === '') {
      continue;
    }
    words.push({
      text,
      startMs: caption.startMs,
      endMs: caption.endMs,
      confidence: caption.confidence,
    });
  }
  return { words, joined: captions.length - words.length };
};

/**
 * Fix words whisper reliably gets wrong, before they reach the review.
 *
 * Still worth having alongside the gate: a systematic mishearing is better
 * fixed once in beats.yaml than by hand on every take. Applied AFTER merging,
 * because the thing needing correction is often a whole word that only exists
 * once its sub-word tokens have been joined ("Floodful" is " Flood" + "ful").
 *
 * A key may be several words, which is what makes an ambiguous word fixable:
 * "for" cannot be corrected globally, but "flood for" -> "flood fill" can. Word
 * counts must match, so each merged word keeps its own timing and no timestamp
 * is ever invented.
 */
const applyCorrections = (words: Word[], corrections: Record<string, string>): number => {
  const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9']/g, '');
  let fixed = 0;

  for (const [wrong, right] of Object.entries(corrections)) {
    const from = wrong.trim().split(/\s+/);
    const to = right.trim().split(/\s+/);
    if (from.length !== to.length) {
      throw new Error(
        `correction "${wrong}" -> "${right}" changes word count ` +
          `(${from.length} to ${to.length}). Each word carries its own timing, ` +
          `so a replacement must have the same number of words.`,
      );
    }
    const want = from.map(key);

    for (let i = 0; i + want.length <= words.length; i++) {
      if (!want.every((w, k) => key(words[i + k]!.text) === w)) {
        continue;
      }
      for (let k = 0; k < want.length; k++) {
        words[i + k]!.text = to[k]!;
      }
      fixed += want.length;
    }
  }
  return fixed;
};

/**
 * Stamp the script's punctuation onto the transcript, but only where the
 * alignment is clean ACROSS the mark — the next scripted word must also be the
 * next spoken word.
 *
 * A matching word on its own is not enough. The script reads "a full flood
 * fill." and the take carried straight on into "flood fill calculation
 * happening every frame"; "fill" matches, so a naive transfer closes a sentence
 * in the middle of one, and the caption ships reading "full flood fill.
 * calculation". Requiring the following pair to be adjacent too means a take
 * that diverged after this word simply gets no mark, which is the right way to
 * be wrong: a missed break costs a slightly worse line, an invented full stop
 * costs a typo in a burned-in caption.
 */
const stampPunctuation = (words: Word[], script: readonly ScriptToken[], path: readonly Step[]): number => {
  const pairs = path.filter(
    (s): s is { a: number; b: number } =>
      s.a !== null && s.b !== null && script[s.a]!.word === norm(words[s.b]!.text),
  );
  let stamped = 0;
  for (let k = 0; k < pairs.length; k++) {
    const { a, b } = pairs[k]!;
    const { punct } = script[a]!;
    if (!punct) {
      continue;
    }
    const next = pairs[k + 1];
    const clean = a === script.length - 1 || (next !== undefined && next.a === a + 1 && next.b === b + 1);
    if (!clean) {
      continue;
    }
    if (/[.,;:!?]["')\]]?\s*$/.test(words[b]!.text)) {
      continue;
    }
    words[b]!.text = words[b]!.text.replace(/\s+$/, '') + punct;
    stamped++;
  }
  return stamped;
};

/** Which beat each spoken word belongs to, from the script alignment. */
const beatOf = (
  path: readonly Step[],
  script: readonly ScriptToken[],
  heardCount: number,
): number[] => {
  const owner = new Array<number>(heardCount).fill(-1);
  for (const step of path) {
    if (step.a !== null && step.b !== null) {
      owner[step.b] = script[step.a]!.beat;
    }
  }
  // A word the script never matched belongs to whichever beat surrounds it.
  let last = 0;
  for (let i = 0; i < owner.length; i++) {
    if (owner[i]! < 0) {
      owner[i] = last;
    } else {
      last = owner[i]!;
    }
  }
  return owner;
};

/** Wrap prose so the review file is readable and diffs stay small. */
const wrap = (text: string, width = 78): string => {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line !== '' && line.length + 1 + word.length > width) {
      out.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') {
    out.push(line);
  }
  return out.join('\n');
};

const buildReview = (
  words: readonly Word[],
  owner: readonly number[],
  beats: readonly { id: string }[],
): string => {
  const lines = [
    `<!--`,
    `  Generated by \`npm run retime ${slug}\`.`,
    ``,
    `  Fix any word whisper got wrong, then run:`,
    ``,
    `      npm run retime ${slug} --apply`,
    ``,
    `  This text becomes the burned-in captions verbatim, punctuation and`,
    `  capitalisation included. Timings are re-derived from the audio by`,
    `  alignment, not by counting, so words may be added, removed, merged or`,
    `  split freely without desynchronising anything.`,
    ``,
    `  The headings are only for reading. Beat boundaries are re-derived from`,
    `  beats.yaml on apply, so moving a word across one changes nothing.`,
    `-->`,
    ``,
    `# ${slug} — what whisper heard`,
    ``,
  ];
  beats.forEach((beat, i) => {
    const text = words
      .filter((_, w) => owner[w] === i)
      .map((w) => w.text)
      .join(' ')
      .replace(/\s+([.,;:!?])/g, '$1');
    lines.push(`## ${beat.id}`, ``, wrap(text), ``);
  });
  return lines.join('\n');
};

/** The words out of a review file, ignoring the comment header and headings. */
const readReview = (md: string): string[] =>
  md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^#.*$/gm, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const stageOne = async (): Promise<void> => {
  const { plain } = readYaml();

  if (existsSync(reviewPath) && existsSync(cachePath) && !FORCE) {
    const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as Cache;
    if (sha(readFileSync(reviewPath, 'utf8')) !== cache.generated) {
      console.error(`${reviewPath} has been edited since it was generated.`);
      console.error('Re-transcribing would discard those edits.\n');
      console.error(`  npm run retime ${slug} --apply    keep them, carry on`);
      console.error(`  npm run retime ${slug} --force    discard them, transcribe again`);
      process.exit(1);
    }
  }

  await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
  await downloadWhisperModel({ model: WHISPER_MODEL, folder: WHISPER_PATH });

  // whisper.cpp only accepts 16kHz mono PCM. This is a working file, so it goes
  // in qa/ where `npm run clean` will take it — it was previously dropped at
  // out/ root, where five of them accumulated at ~2.5 MB each.
  const qa = join(process.cwd(), 'out', slug, 'qa');
  mkdirSync(qa, { recursive: true });
  const wav16 = join(qa, `${slug}-16k.wav`);
  execFileSync('ffmpeg', ['-y', '-i', wav, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav16], {
    stdio: 'ignore',
  });

  console.log('› transcribing...');
  const result = await transcribe({
    inputPath: wav16,
    whisperPath: WHISPER_PATH,
    whisperCppVersion: WHISPER_VERSION,
    model: WHISPER_MODEL,
    tokenLevelTimestamps: true,
  });

  const { captions } = toCaptions({ whisperCppOutput: result });
  const { words, joined } = mergeTokens(captions);
  const fixed = applyCorrections(words, plain.corrections ?? {});

  const script = scriptTokens(plain.beats);
  const path = align(
    script.map((t) => t.word),
    words.map((w) => norm(w.text)),
  );
  const stamped = stampPunctuation(words, script, path);
  const owner = beatOf(path, script, words.length);

  const md = buildReview(words, owner, plain.beats);
  writeFileSync(reviewPath, md);
  writeFileSync(
    cachePath,
    JSON.stringify({ heard: words, generated: sha(md) } satisfies Cache, null, 2),
  );

  console.log(
    `✓ transcript.md (${words.length} words` +
      `${fixed > 0 ? `, ${fixed} corrected` : ''}` +
      `${joined > 0 ? `, ${joined} tokens rejoined` : ''}` +
      `${stamped > 0 ? `, ${stamped} punctuated from the script` : ''})`,
  );

  // ---- what to look at ---------------------------------------------------

  const matched = path.filter(
    (s) => s.a !== null && s.b !== null && script[s.a]!.word === norm(words[s.b]!.text),
  ).length;
  const fidelity = script.length > 0 ? (matched / script.length) * 100 : 0;
  console.log(`› alignment: ${matched}/${script.length} script words matched (${fidelity.toFixed(0)}%)`);

  /*
    Two independent reasons to doubt a word, and they catch different things.
    Low confidence is whisper telling you it guessed. A mismatch against the
    script is the script telling you it expected something else — which is the
    signal that actually caught "ring that left to line up", a word whisper was
    perfectly confident about and still got wrong.
  */
  type Suspect = { readonly i: number; readonly why: string };
  const suspects: Suspect[] = [];
  const scriptAt = new Map<number, string>();
  for (const step of path) {
    if (step.b === null) {
      continue;
    }
    if (step.a === null) {
      suspects.push({ i: step.b, why: 'not in the script' });
      continue;
    }
    const want = script[step.a]!.word;
    const got = norm(words[step.b]!.text);
    if (want !== got) {
      scriptAt.set(step.b, want);
      suspects.push({ i: step.b, why: `script says "${want}"` });
    }
  }
  words.forEach((w, i) => {
    if (w.confidence !== null && w.confidence < UNSURE && !scriptAt.has(i)) {
      suspects.push({ i, why: `unsure (${w.confidence.toFixed(2)})` });
    }
  });
  suspects.sort((a, b) => a.i - b.i);

  if (suspects.length === 0) {
    console.log('› nothing flagged — it matched the script throughout.');
  } else {
    console.log(`\n› ${suspects.length} word${suspects.length === 1 ? '' : 's'} worth checking:\n`);
    for (const { i, why } of suspects) {
      const context = words
        .slice(Math.max(0, i - 4), i + 5)
        .map((w, k) => (Math.max(0, i - 4) + k === i ? `[${w.text}]` : w.text))
        .join(' ');
      const at = (words[i]!.startMs / 1000).toFixed(1);
      console.log(`  ${at.padStart(6)}s  ${why.padEnd(24)} ${context}`);
    }
  }

  console.log(`\n⏸  review ${reviewPath.replace(process.cwd() + '/', '')}, then:`);
  console.log(`     npm run retime ${slug} --apply`);
};

// ============================================================ stage two

/**
 * Give every reviewed word a timing taken from the audio.
 *
 * Matched and substituted words inherit the timing of the word they align to.
 * The two gap cases are where the care is needed, and both come up in practice:
 *
 *   deleted   whisper heard a word the reviewer removed. Its span is absorbed
 *             into the previous word rather than dropped, so no silence opens
 *             up in the middle of a phrase.
 *   inserted  the reviewer added a word whisper missed ("that's" for "that"
 *             split in two). It has no audio of its own, so the surrounding
 *             span is shared out by character length — the only honest guess,
 *             and it keeps the caption monotonic.
 */
const retime = (edited: readonly string[], heard: readonly Word[]): Word[] => {
  const path = align(edited.map(norm), heard.map((w) => norm(w.text)));
  const out: Word[] = [];
  /** Reviewed words still waiting for a span, because they had no match. */
  let pending: number[] = [];

  const flush = (untilMs: number | null): void => {
    if (pending.length === 0) {
      return;
    }
    const prev = out[out.length - 1 - pending.length];
    const from = prev ? prev.endMs : 0;
    const to = untilMs ?? (prev ? prev.endMs + 400 * pending.length : 400 * pending.length);
    const total = pending.reduce((n, i) => n + Math.max(1, out[i]!.text.length), 0);
    let at = from;
    for (const i of pending) {
      const share = ((to - from) * Math.max(1, out[i]!.text.length)) / total;
      out[i]!.startMs = Math.round(at);
      out[i]!.endMs = Math.round(at + share);
      at += share;
    }
    pending = [];
  };

  for (const step of path) {
    if (step.a === null) {
      // Reviewer deleted this word — fold its span into what came before.
      const last = out[out.length - 1];
      if (last && pending.length === 0) {
        last.endMs = Math.max(last.endMs, heard[step.b!]!.endMs);
      }
      continue;
    }
    const text = edited[step.a]!;
    if (step.b === null) {
      out.push({ text, startMs: 0, endMs: 0, confidence: null });
      pending.push(out.length - 1);
      continue;
    }
    const source = heard[step.b]!;
    flush(source.startMs);
    out.push({
      text,
      startMs: source.startMs,
      endMs: source.endMs,
      confidence: source.confidence,
    });
  }
  flush(null);

  // Alignment is monotonic, but absorbing a deletion can push an end past the
  // next start. Captions that overlap render as two phrases at once.
  for (let i = 1; i < out.length; i++) {
    if (out[i]!.startMs < out[i - 1]!.endMs) {
      out[i - 1]!.endMs = out[i]!.startMs;
    }
  }
  return out;
};

const stageTwo = (): void => {
  if (!existsSync(reviewPath) || !existsSync(cachePath)) {
    console.error(`No reviewed transcript for ${slug}.`);
    console.error(`Run \`npm run retime ${slug}\` first.`);
    process.exit(1);
  }

  const { doc, plain } = readYaml();
  const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as Cache;
  const md = readFileSync(reviewPath, 'utf8');
  const edited = readReview(md);

  const words = retime(edited, cache.heard);
  const changed = sha(md) !== cache.generated;

  const captions: Caption[] = words.map((w) => ({
    text: w.text,
    startMs: w.startMs,
    endMs: w.endMs,
    timestampMs: w.startMs,
    confidence: w.confidence,
  }));
  writeFileSync(join(videoDir, 'captions.json'), JSON.stringify(captions, null, 2));
  console.log(
    `✓ captions.json (${captions.length} words` +
      `${changed ? `, reviewed — ${cache.heard.length} heard` : ', unedited'})`,
  );

  // ---- beat boundaries ---------------------------------------------------

  const script = scriptTokens(plain.beats);
  const path = align(
    script.map((t) => t.word),
    words.map((w) => norm(w.text)),
  );

  const lastWord = new Array<number>(plain.beats.length).fill(-1);
  let matched = 0;
  for (const step of path) {
    if (step.a === null || step.b === null) {
      continue;
    }
    const token = script[step.a]!;
    if (lastWord[token.beat]! < step.b) {
      lastWord[token.beat] = step.b;
    }
    if (token.word === norm(words[step.b]!.text)) {
      matched++;
    }
  }

  const fidelity = script.length > 0 ? (matched / script.length) * 100 : 0;
  console.log(`› alignment: ${matched}/${script.length} script words matched (${fidelity.toFixed(0)}%)`);
  if (fidelity < 75) {
    console.warn(
      '  ! heavy deviation from the script. Timings are still aligned, but the\n' +
        '    vo lines no longer describe what was said — worth updating them.',
    );
  }

  let prevEndMs = 0;
  plain.beats.forEach((beat, i) => {
    const idx = lastWord[i]!;
    if (idx < 0) {
      console.warn(`  ! beat "${beat.id}" never matched the audio — leaving as is`);
      return;
    }
    const endMs = words[idx]!.endMs;
    // Last beat gets a beat of silence to breathe on the payoff.
    const paddedEnd = i === plain.beats.length - 1 ? endMs + 500 : endMs;
    // Boundaries can only move forward; an out-of-order match would otherwise
    // produce a negative duration and a video that fails to render.
    const durationSec = Math.max(0.1, (paddedEnd - prevEndMs) / 1000);
    prevEndMs = Math.max(prevEndMs, paddedEnd);

    const rounded = Math.round(durationSec * 100) / 100;
    const was = (doc.getIn(['beats', i, 'duration']) as number | undefined) ?? 0;
    const delta = rounded - was;
    doc.setIn(['beats', i, 'duration'], rounded);
    console.log(
      `  ${beat.id.padEnd(12)} ${rounded.toFixed(2)}s  ` +
        `(${delta >= 0 ? '+' : ''}${delta.toFixed(2)} vs estimate)`,
    );
  });

  writeFileSync(yamlPath, doc.toString());
  console.log('✓ beats.yaml re-timed');

  execFileSync(
    process.execPath,
    [
      join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join(process.cwd(), 'scripts', 'build-beats.ts'),
      slug,
    ],
    { stdio: 'inherit' },
  );
};

// ============================================================ entry

if (APPLY) {
  stageTwo();
} else {
  if (!existsSync(wav)) {
    console.error(`No voiceover at ${wav}`);
    console.error('Record it, save it there, then run this again.');
    process.exit(1);
  }
  stageOne().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
