import type { Caption } from '@remotion/captions';
import type { BeatTiming } from '../Beat';

/**
 * A caption phrase, held on screen for its whole duration.
 *
 * Deliberately NOT word-by-word karaoke: next to syntax-highlighted code a
 * word-popping caption is visual noise competing with the thing the viewer is
 * supposed to be reading. Phrases change ~2x/second at most.
 */
export type Phrase = {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
};

/**
 * Phrase length in words.
 *
 * `TARGET` is what the cost function pulls toward; the bounds are what it will
 * accept to avoid a bad break. Six and seven are allowed but expensive, so a
 * long phrase only happens when every shorter option would split a clause.
 */
const MAX_WORDS = 7;

/**
 * Characters a phrase may reach before it stops fitting the band.
 *
 * The band is 864px wide less ~34px of padding a side, at a 48px caption face —
 * about 34 lowercase characters a line over two lines. Three themes render
 * captions uppercase, which is roughly 15% wider, so the cap is set for the
 * worst case rather than the common one. A caption that overflows its band is a
 * worse failure than one that breaks a word early.
 */
const MAX_CHARS = 52;

/**
 * Words that must not be left stranded at the end of a phrase.
 *
 * All of them point forward at something: an article without its noun, a
 * preposition without its object, an auxiliary without its verb. Ending a
 * caption on one is the single most obvious way for a subtitle to look broken,
 * because the viewer reads a complete line that visibly is not one.
 */
const FUNCTION_WORDS = new Set([
  // determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any', 'every',
  'each', 'no', 'another', 'both', 'either', 'neither',
  // possessives
  'my', 'your', 'our', 'their', 'its', 'his', 'her',
  // pronouns that lean on what follows
  'i', 'we', 'you', 'they', 'he', 'she', 'it',
  // prepositions
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'into', 'onto', 'with',
  'without', 'about', 'over', 'under', 'across', 'through', 'between', 'against',
  'during', 'before', 'after', 'up', 'down', 'out', 'off',
  // conjunctions
  'and', 'or', 'but', 'so', 'as', 'if', 'than', 'because', 'while', 'when',
  'where', 'whether', 'though', 'although', 'since', 'unless',
  // auxiliaries and copulas
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did',
  'has', 'have', 'had', 'will', 'would', 'can', 'could', 'shall', 'should',
  'may', 'might', 'must', 'let',
  // degree words that modify what comes next
  'not', 'very', 'just', 'more', 'most', 'less', 'too', 'quite', 'really',
]);

/**
 * Particles that attach BACKWARD, to the word before them.
 *
 * The mirror of `FUNCTION_WORDS`, and needed for the same reason: "Enemy health
 * ends" / "up with four listeners" splits a phrasal verb across two captions,
 * and reading the break cost off the preceding word alone can never see it,
 * because "ends" is a perfectly good word to stop on.
 *
 * Priced just below a stranded function word, not equal to it: most of these
 * are also ordinary prepositions that open a phrase quite happily ("up the
 * stairs"), and a split particle is milder than a caption ending on "and".
 */
const LEANS_BACK = new Set([
  'up', 'down', 'out', 'off', 'over', 'through', 'away', 'back', 'apart',
  'along', 'around', 'aside', 'ahead', 'together', 'not', "n't", 'anyway',
  'instead', 'though', 'too', 'either', 'else',
]);

/** Letters only, so punctuation and case never affect a lookup. */
const key = (word: string): string => word.toLowerCase().replace(/[^a-z']/g, '');

const SENTENCE_END = /[.!?]["')\]]?$/;
const CLAUSE_END = /[,;:]["')\]]?$/;

/**
 * What it costs to end a phrase after `word`, given the `next` word.
 *
 * The numbers are ordinal, not physical — all that matters is that a full stop
 * beats a comma beats an arbitrary gap, and that stranding a function word
 * costs more than making a phrase one word too long.
 */
const breakCost = (word: string, next: string | undefined): number => {
  // End of a segment. The break is already forced, so it is free.
  if (next === undefined) {
    return 0;
  }
  if (SENTENCE_END.test(word)) {
    return 0;
  }
  if (CLAUSE_END.test(word)) {
    return 2;
  }
  if (FUNCTION_WORDS.has(key(word))) {
    return 14;
  }
  if (LEANS_BACK.has(key(next))) {
    return 11;
  }
  return 6;
};

/**
 * What it costs for a phrase to be `n` words long.
 *
 * Flat-bottomed at four. One-word phrases are all but forbidden: they flash on
 * screen for a few frames and read as a glitch, which is what the old greedy
 * grouping produced at the end of every beat.
 */
const lengthCost = (n: number): number => {
  switch (n) {
    case 1:
      return 60;
    case 2:
      return 14;
    case 3:
      return 3;
    case 4:
      return 0;
    case 5:
      return 1;
    case 6:
      return 6;
    default:
      return 18;
  }
};

/**
 * Splits words into phrases by minimising total cost over the whole run.
 *
 * Global rather than greedy, and that is the entire point. Greedy chunking cuts
 * every fifth word regardless of what that word is, then leaves whatever is
 * left over as a final phrase — which is how a caption ends on "and" 40% of the
 * time and why single-word phrases appeared at the end of most beats.
 *
 * Scoring every possible split instead lets the algorithm spend a little
 * length cost to buy a much better break, so a clause stays whole and the
 * remainder gets absorbed rather than stranded. The run is one beat long, so
 * the O(n * MAX_WORDS) table is trivially small.
 */
export const groupWords = <T extends { readonly text: string }>(
  words: readonly T[],
): T[][] => {
  const count = words.length;
  if (count === 0) {
    return [];
  }

  const text = words.map((w) => w.text.trim());
  // Prefix sums, so the rendered width of any candidate phrase is O(1).
  const chars = new Int32Array(count + 1);
  // ...and so is the number of sentence ends strictly inside it.
  const stops = new Int32Array(count + 1);
  for (let i = 0; i < count; i++) {
    chars[i + 1] = chars[i]! + text[i]!.length + 1;
    stops[i + 1] = stops[i]! + (SENTENCE_END.test(text[i]!) ? 1 : 0);
  }

  const best = new Float64Array(count + 1).fill(Number.POSITIVE_INFINITY);
  const from = new Int32Array(count + 1).fill(-1);
  best[0] = 0;

  for (let end = 1; end <= count; end++) {
    for (let start = Math.max(0, end - MAX_WORDS); start < end; start++) {
      if (!Number.isFinite(best[start]!)) {
        continue;
      }
      const n = end - start;
      // A single word is always legal, or a very long word could make a
      // segment unsplittable and leave the whole table at infinity.
      if (n > 1 && chars[end]! - chars[start]! - 1 > MAX_CHARS) {
        continue;
      }
      /*
        Sentence ends anywhere but the final word of the phrase.

        This is the defect by name: a caption reading "a tenth of a cell. and"
        carries the end of one sentence and the start of the next, so the
        viewer reads a full stop and then keeps going. Ending ON the stop is
        free; carrying it in the middle is the most expensive thing here,
        because no amount of length awkwardness is worse than a caption that
        visibly spans two sentences.
      */
      const straddles = stops[end - 1]! - stops[start]!;
      const cost =
        best[start]! +
        lengthCost(n) +
        straddles * 30 +
        breakCost(text[end - 1]!, text[end]);
      if (cost < best[end]!) {
        best[end] = cost;
        from[end] = start;
      }
    }
  }

  const out: T[][] = [];
  for (let end = count; end > 0; end = from[end]!) {
    out.push(words.slice(from[end]!, end));
  }
  return out.reverse();
};

/**
 * Nudges each beat split onto the nearest sentence boundary, up to two words.
 *
 * A beat boundary is stored as a duration in `beats.yaml` — seconds to two
 * decimals — and read back as `round(duration * fps)` frames converted to
 * milliseconds. That round trip moves the boundary by up to half a frame, and
 * whisper's word timings are contiguous, so a word beginning exactly on the
 * boundary lands on whichever side the rounding happens to put it.
 *
 * When it lands wrong the symptom is specific and was visible in all three
 * videos: the first word of the new sentence gets timed into the OLD beat, so
 * the beat's final caption reads "into our pooling solution. So". Snapping to
 * the sentence fixes it at the source instead of asking the phrase grouper to
 * cope with a boundary that is a word out.
 *
 * Only ever moves the split ACROSS words that are already spoken adjacently, so
 * no timing is invented — the word changes which caption group it belongs to,
 * never when it appears.
 */
const snapToSentences = (
  captions: readonly Caption[],
  splits: readonly number[],
): number[] => {
  const endsSentence = (i: number): boolean =>
    i >= 0 && i < captions.length && SENTENCE_END.test(captions[i]!.text.trim());

  const snapped = splits.map((split) => {
    // Nearest first, so a boundary already sitting on a full stop never moves.
    for (const offset of [0, -1, 1, -2, 2]) {
      const candidate = split + offset;
      if (candidate > 0 && candidate < captions.length && endsSentence(candidate - 1)) {
        return candidate;
      }
    }
    return split;
  });

  // Two boundaries less than four words apart can cross while snapping. Sorting
  // keeps the segments in order; `splitAt` drops any that collapse to nothing.
  return snapped.sort((a, b) => a - b);
};

/** Cuts a flat word list into segments at the given indices. */
const splitAt = <T>(items: readonly T[], splits: readonly number[]): T[][] => {
  const out: T[][] = [];
  let start = 0;
  for (const split of splits) {
    if (split > start) {
      out.push(items.slice(start, split));
      start = split;
    }
  }
  if (start < items.length) {
    out.push(items.slice(start));
  }
  return out;
};

/**
 * Real captions, from whisper word timings. Each phrase is held from the start
 * of its first word to the end of its last.
 *
 * `boundariesMs` forces a phrase break at each beat start, so no caption spans
 * two beats — a phrase carrying the tail of one sentence and the head of the
 * next while the picture behind it changes reads as a mistake even when the
 * words are right. Beats are the sentence units of the script, so their
 * boundaries are already the correct break points.
 *
 * Within a beat the split is chosen by `groupWords`, which needs punctuation to
 * do its best work. Whisper emits some, and `retime` stamps the script's own
 * punctuation onto every word it can align — that pass is what turns a run of
 * bare tokens into something with clause structure to break on.
 */
export const phrasesFromCaptions = (
  captions: readonly Caption[],
  boundariesMs: readonly number[] = [],
): Phrase[] => {
  // Word indices where a new beat starts.
  const splits: number[] = [];
  let next = 0;
  captions.forEach((caption, i) => {
    // Advance past any boundaries this word has already crossed, so a beat with
    // no words in it cannot strand the cursor.
    let broke = false;
    while (next < boundariesMs.length && caption.startMs >= boundariesMs[next]!) {
      next++;
      broke = true;
    }
    if (broke && i > 0) {
      splits.push(i);
    }
  });

  const segments = splitAt(captions, snapToSentences(captions, splits));

  const phrases = segments
    .flatMap((segment) => groupWords(segment))
    .map((group) => ({
      text: group.map((c) => c.text.trim()).join(' ').replace(/\s+/g, ' ').trim(),
      startMs: group[0]!.startMs,
      endMs: group[group.length - 1]!.endMs,
    }));

  return bridgeGaps(phrases);
};

/**
 * Extends each phrase toward the next one so the band never blinks empty.
 *
 * Whisper's word timings are contiguous inside a run, but a real pause between
 * beats leaves a hole — 620ms of it in `every-frame` — and `Captions` shows
 * nothing while `nowMs` sits in that hole. Dropping the caption for two thirds
 * of a second and bringing it back is far more distracting than holding the
 * last line a moment longer.
 *
 * Capped, because a long silence is usually a deliberate beat change and a
 * caption left hanging over the new picture is its own kind of wrong.
 */
const HOLD_MS = 400;

const bridgeGaps = (phrases: readonly Phrase[]): Phrase[] =>
  phrases.map((p, i) => {
    const following = phrases[i + 1];
    if (!following) {
      return p;
    }
    const gap = following.startMs - p.endMs;
    return gap <= 0 ? p : { ...p, endMs: p.endMs + Math.min(gap, HOLD_MS) };
  });

/**
 * Rough-cut captions, derived from the `vo` text on each beat before any audio
 * has been recorded. Time is split across the beat in proportion to word count,
 * which is close enough to read a contact sheet against.
 *
 * These are the BEST-phrased captions in the pipeline, because the `vo` lines
 * are written prose with full punctuation. Everything the retime pass does is
 * an attempt to get back to this quality once real timings replace the guess.
 */
export const phrasesFromBeats = (
  beats: readonly BeatTiming[],
  fps: number,
): Phrase[] => {
  const out: Phrase[] = [];
  let frameOffset = 0;

  for (const beat of beats) {
    const beatStartMs = (frameOffset / fps) * 1000;
    const beatDurationMs = (beat.durationInFrames / fps) * 1000;
    frameOffset += beat.durationInFrames;

    const words = beat.vo.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      continue;
    }

    const groups = groupWords(words.map((text) => ({ text })));
    const totalWords = words.length;
    let wordsSoFar = 0;

    for (const group of groups) {
      const startMs = beatStartMs + (wordsSoFar / totalWords) * beatDurationMs;
      wordsSoFar += group.length;
      const endMs = beatStartMs + (wordsSoFar / totalWords) * beatDurationMs;
      out.push({ text: group.map((g) => g.text).join(' '), startMs, endMs });
    }
  }

  return out;
};
