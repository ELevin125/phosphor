/**
 * Re-times a video against its recorded voiceover.
 *
 *   npm run retime <slug>
 *
 * 1. Converts public/videos/<slug>/vo.wav to the 16kHz mono WAV whisper.cpp
 *    requires (it will not accept anything else).
 * 2. Transcribes it with token-level timestamps.
 * 3. Writes projects/<slug>/captions.json    -> real burned-in captions.
 * 4. Rewrites the `duration` of every beat in beats.yaml from where that
 *    beat's narration actually lands in the audio.
 * 5. Re-runs build-beats.
 *
 * Beats are matched to audio by Needleman-Wunsch alignment between the script
 * and the transcript, so improvising is survivable -- a deviation is absorbed
 * where it happens instead of shifting every later boundary. It still prints a
 * fidelity score, and a low one means the `vo` lines no longer describe what
 * was actually said, which is worth fixing even though the timings are right.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from '@remotion/install-whisper-cpp';
import type { Caption } from '@remotion/captions';
import { parse, parseDocument } from 'yaml';

// Pinned: token-level timestamps are version-sensitive in whisper.cpp.
const WHISPER_VERSION = '1.5.5';
const WHISPER_MODEL = 'medium.en';
const WHISPER_PATH = join(process.cwd(), '.tooling', 'whisper.cpp');

const slug = process.argv[2];
if (!slug) {
  console.error('usage: npm run retime <slug>');
  process.exit(1);
}

const videoDir = join(process.cwd(), 'projects', slug);
const wav = join(process.cwd(), 'public', 'videos', slug, 'vo.wav');

if (!existsSync(wav)) {
  console.error(`No voiceover at ${wav}`);
  console.error('Record it, save it there, then run this again.');
  process.exit(1);
}

const main = async () => {
  await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
  await downloadWhisperModel({ model: WHISPER_MODEL, folder: WHISPER_PATH });

  // whisper.cpp only accepts 16kHz mono PCM.
  const wav16 = join(process.cwd(), 'out', `${slug}-16k.wav`);
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

  const yamlPath = join(videoDir, 'beats.yaml');
  const doc = parseDocument(readFileSync(yamlPath, 'utf8'));
  const plain = parse(readFileSync(yamlPath, 'utf8')) as {
    beats: { id: string; vo: string }[];
    corrections?: Record<string, string>;
  };

  const { captions } = toCaptions({ whisperCppOutput: result });

  /*
    Fix words whisper reliably gets wrong, before they reach the screen.

    These captions are burned in, so a mis-transcription is a visible typo in
    the finished video — "they all cause the same" instead of "cost". Editing
    captions.json by hand does not survive the next retime, so the corrections
    live in beats.yaml and are re-applied every run.

    Word-level and case-insensitive, applied to every occurrence. Deliberately
    not a phrase replacement: each caption token carries its own timestamp, and
    rewriting across token boundaries would mean inventing timings.
  */
  const corrections = plain.corrections ?? {};

  /*
    Re-join contractions into whole words BEFORE the captions are written.

    whisper's token-level output splits "doesn't" into "doesn" + "'t". Each
    fragment is a caption token in its own right, so the phrase grouper can
    happily end a line on "doesn" and open the next one with "'t" — which is
    exactly what showed up on screen. Merging here fixes the captions and the
    alignment at once, since both read this array.

    The first fragment keeps the start time, the last carries the end time.
  */
  const merged: Caption[] = [];
  for (const caption of captions) {
    const prev = merged[merged.length - 1];
    const text = caption.text.trim();

    const contraction = /^['\u2019]/.test(text);
    // A token that is nothing but punctuation, which renders as a floating
    // comma with a space in front of it.
    const punctuation = text !== '' && /^[^\p{L}\p{N}]+$/u.test(text);
    // "1,000" arrives as "1" + "," + "000"; without this it reads "1 , 000".
    const thousands =
      prev !== undefined && /[,.]$/.test(prev.text.trim()) && /^\d+$/.test(text);
    /*
      A sub-word continuation. whisper marks a new word with a LEADING SPACE, so
      a token that starts with a letter and has no leading space is the tail of
      the previous word: "flood" arrives as " Flood" + "ful". Without this the
      grouper treats them as two words and the caption reads "Flood ful".

      This is the general case of the contraction rule above, which is the same
      bug for tokens beginning with an apostrophe.
    */
    const continuation =
      prev !== undefined && !/^\s/.test(caption.text) && /^[\p{L}\p{N}]/u.test(text);

    if (prev && (contraction || punctuation || thousands || continuation)) {
      prev.text += text;
      prev.endMs = caption.endMs;
      continue;
    }
    merged.push({ ...caption });
  }
  const joined = captions.length - merged.length;   // contractions, stray punctuation, thousands

  /*
    Fix words whisper reliably gets wrong, before they reach the screen.

    These captions are burned in, so a mis-transcription is a visible typo in
    the finished video — "they all cause the same" instead of "cost". Editing
    captions.json by hand does not survive the next retime, so the corrections
    live in beats.yaml and are re-applied every run.

    Applied AFTER merging, because the thing needing correction is often a whole
    word that only exists once its sub-word tokens have been joined ("Floodful"
    is " Flood" + "ful").

    A key may be several words, which is what makes an ambiguous word fixable:
    "for" cannot be corrected globally, but "flood for" -> "flood fill" can.
    Word counts must match, so each merged word keeps its own timing and no
    timestamp is ever invented. Case-insensitive, punctuation-insensitive.
  */
  const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9']/g, '');
  let fixCount = 0;

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

    for (let i = 0; i + want.length <= merged.length; i++) {
      const hit = want.every((w, k) => key(merged[i + k]!.text) === w);
      if (!hit) {
        continue;
      }
      for (let k = 0; k < want.length; k++) {
        const cap = merged[i + k]!;
        /*
          The replacement is the WHOLE word, not just its letters, so stray
          punctuation whisper attached can be removed: "and be? Floodful" needs
          to become "and we flood", not "and we? flood". Write the punctuation
          into the correction if you want to keep it.

          The leading space is preserved separately — it is what joins words
          back into a line.
        */
        const lead = /^\s*/.exec(cap.text)?.[0] ?? '';
        cap.text = lead + to[k]!;
      }
      fixCount += want.length;
    }
  }

  // captions.json is written after the alignment below, which stamps the
  // script's punctuation onto the transcript.

  // --- re-time the beats -------------------------------------------------

  // Whisper emits punctuation attached to words; compare on letters only.
  const norm = (w: string): string => w.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Already whole words — contractions were rejoined before writing. The index
  // map is what lets the alignment write back into `merged`.
  const spokenIndex: number[] = [];
  const spoken: { readonly text: string; readonly endMs: number }[] = [];
  merged.forEach((c, i) => {
    if (c.text.trim() === '') {
      return;
    }
    spokenIndex.push(i);
    spoken.push({ text: c.text.trim(), endMs: c.endMs });
  });

  /*
    Align the script against the transcript, rather than counting words off it.

    The old version took the word count of each `vo` line and consumed that many
    words from the transcript. That only works if the read is word-perfect: say
    four extra words in beat 2 and every later boundary lands four words early,
    permanently, because nothing ever re-syncs. The failure is silent and gets
    worse toward the end of the video, which is the hardest place to notice it.

    Needleman-Wunsch global alignment handles it properly. Insertions,
    deletions and substitutions all cost something, the best overall path wins,
    and a deviation in one beat is absorbed locally instead of shifting
    everything after it. Roughly 200x200 cells here — free.
  */
  type ScriptToken = {
    readonly word: string;
    readonly beat: number;
    /** Trailing punctuation on the scripted word, e.g. "." on "the run." */
    readonly punct: string;
  };
  const script: ScriptToken[] = [];
  plain.beats.forEach((beat, i) => {
    for (const token of beat.vo.trim().split(/\s+/)) {
      const word = norm(token);
      if (word) {
        script.push({
          word,
          beat: i,
          punct: /([.,;:!?]+)["')\]]?$/.exec(token)?.[1] ?? '',
        });
      }
    }
  });
  const heard = spoken.map((c) => norm(c.text));

  const MATCH = 2;
  const MISMATCH = -1;
  const GAP = -1;
  const n = script.length;
  const m = heard.length;
  const W = m + 1;
  const dp = new Int32Array((n + 1) * W);
  const tb = new Uint8Array((n + 1) * W);   // 0 diagonal, 1 skip script, 2 skip heard

  for (let i = 1; i <= n; i++) {
    dp[i * W] = i * GAP;
    tb[i * W] = 1;
  }
  for (let j = 1; j <= m; j++) {
    dp[j] = j * GAP;
    tb[j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag =
        dp[(i - 1) * W + (j - 1)]! + (script[i - 1]!.word === heard[j - 1] ? MATCH : MISMATCH);
      const up = dp[(i - 1) * W + j]! + GAP;
      const left = dp[i * W + (j - 1)]! + GAP;

      let best = diag;
      let dir = 0;
      if (up > best) {
        best = up;
        dir = 1;
      }
      if (left > best) {
        best = left;
        dir = 2;
      }
      dp[i * W + j] = best;
      tb[i * W + j] = dir;
    }
  }

  /*
    Walk back: the last transcript word each beat owns is that beat's boundary.

    The same pass carries the script's PUNCTUATION onto the transcript, which is
    what lets the caption grouper break on sentences instead of counting words.
    whisper punctuates unreliably — `every-frame` was transcribed with 4
    sentence ends where the script has 17 — so without this the grouper has
    almost no structure to work with and falls back on length alone.

    This punctuation is BURNED INTO THE CAPTION TEXT, not just used as a hint,
    so a mark in the wrong place is a visible typo rather than a bad line break.
    That makes the guard below the important part of this pass.
  */
  const lastHeard = new Array<number>(plain.beats.length).fill(-1);
  let matched = 0;
  /** Exact script/transcript matches, collected in reverse by the walk. */
  const pairs: { readonly s: number; readonly h: number }[] = [];
  {
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      const dir = i === 0 ? 2 : j === 0 ? 1 : tb[i * W + j]!;
      if (dir === 0) {
        const token = script[i - 1]!;
        const b = token.beat;
        if (lastHeard[b]! < j - 1) {
          lastHeard[b] = j - 1;
        }
        if (token.word === heard[j - 1]) {
          matched++;
          pairs.push({ s: i - 1, h: j - 1 });
        }
        i--;
        j--;
      } else if (dir === 1) {
        i--;
      } else {
        j--;
      }
    }
  }
  pairs.reverse();

  /*
    Stamp the script's punctuation, but only where the alignment is clean ACROSS
    the mark — the next scripted word must also be the next spoken word.

    A matching word on its own is not enough. The script reads "a full flood
    fill." and the take carried straight on into "flood fill calculation
    happening every frame"; "fill" matches, so a naive transfer closes a
    sentence in the middle of one, and the caption ships reading "full flood
    fill. calculation". Requiring the following pair to be adjacent too means a
    take that diverged after this word simply gets no mark, which is the right
    way to be wrong: a missed break costs a slightly worse line, an invented
    full stop costs a typo in a burned-in caption.
  */
  let punctuated = 0;
  for (let k = 0; k < pairs.length; k++) {
    const { s, h } = pairs[k]!;
    const { punct } = script[s]!;
    if (!punct) {
      continue;
    }
    const next = pairs[k + 1];
    const clean = s === n - 1 || (next !== undefined && next.s === s + 1 && next.h === h + 1);
    if (!clean) {
      continue;
    }
    const cap = merged[spokenIndex[h]!]!;
    if (/[.,;:!?]["')\]]?\s*$/.test(cap.text)) {
      continue;
    }
    cap.text = cap.text.replace(/\s+$/, '') + punct;
    punctuated++;
  }

  writeFileSync(join(videoDir, 'captions.json'), JSON.stringify(merged, null, 2));
  console.log(
    `✓ captions.json (${merged.length} words` +
      `${fixCount > 0 ? `, ${fixCount} corrected` : ''}` +
      `${joined > 0 ? `, ${joined} tokens rejoined` : ''}` +
      `${punctuated > 0 ? `, ${punctuated} punctuated from the script` : ''})`,
  );

  const fidelity = n > 0 ? (matched / n) * 100 : 0;
  console.log(`› alignment: ${matched}/${n} script words matched (${fidelity.toFixed(0)}%)`);
  if (fidelity < 75) {
    console.warn(
      '  ! heavy deviation from the script. Timings are still aligned, but the\n' +
        '    vo lines no longer describe what was said — worth updating them.',
    );
  }

  let prevEndMs = 0;
  plain.beats.forEach((beat, i) => {
    const idx = lastHeard[i]!;
    if (idx < 0) {
      console.warn(`  ! beat "${beat.id}" never matched the audio — leaving as is`);
      return;
    }

    const endMs = spoken[idx]!.endMs;
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

  execFileSync(process.execPath, [
    join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    join(process.cwd(), 'scripts', 'build-beats.ts'),
    slug,
  ], { stdio: 'inherit' });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
