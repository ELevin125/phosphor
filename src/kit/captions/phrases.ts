import type { Caption } from '@remotion/captions';
import type { BeatTiming } from '../Beat';

/**
 * A caption phrase, held on screen for its whole duration.
 *
 * Deliberately NOT word-by-word karaoke: next to syntax-highlighted code a
 * word-popping caption is visual noise competing with the thing the viewer is
 * supposed to be reading. Phrases of 3-5 words change ~2x/second at most.
 */
export type Phrase = {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
};

const MIN_WORDS = 3;
const MAX_WORDS = 5;

/** Words that shouldn't be left stranded at the end of a phrase. */
const CLINGY = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'and', 'or',
  'but', 'for', 'as', 'by', 'that', 'this', 'your', 'you',
]);

const shouldBreakAfter = (word: string): boolean => /[.,;:!?]$/.test(word);

/**
 * Groups words into phrase blocks of 3-5 words, preferring to break on
 * punctuation and avoiding a trailing preposition/article.
 */
export const groupWords = <T extends { readonly text: string }>(
  words: readonly T[],
): T[][] => {
  const out: T[][] = [];
  let current: T[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    current.push(word);

    const atMax = current.length >= MAX_WORDS;
    const canBreak = current.length >= MIN_WORDS;
    const punctuated = shouldBreakAfter(word.text);
    const last = i === words.length - 1;

    // Don't end a phrase on a word that leans on the next one.
    const clingy = CLINGY.has(word.text.toLowerCase().replace(/[^a-z]/g, ''));

    if (last || atMax || (canBreak && punctuated && !clingy)) {
      out.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    out.push(current);
  }
  return out;
};

/**
 * Real captions, from whisper word timings. Each phrase is held from the start
 * of its first word to the end of its last.
 *
 * `boundariesMs` forces a phrase break at each beat start. Without it, phrases
 * pack five words at a time regardless of where sentences end — whisper emits
 * no punctuation for `shouldBreakAfter` to find — so a caption cheerfully runs
 * "in the way so now", carrying the tail of one sentence and the head of the
 * next while the picture behind it changes. Beats are already the sentence
 * units of the script, so their boundaries are the break points.
 */
export const phrasesFromCaptions = (
  captions: readonly Caption[],
  boundariesMs: readonly number[] = [],
): Phrase[] => {
  const segments: Caption[][] = [];
  let current: Caption[] = [];
  let next = 0;

  for (const caption of captions) {
    // Advance past any boundaries this word has already crossed, so a beat with
    // no words in it cannot strand the cursor.
    let broke = false;
    while (next < boundariesMs.length && caption.startMs >= boundariesMs[next]!) {
      next++;
      broke = true;
    }
    if (broke && current.length > 0) {
      segments.push(current);
      current = [];
    }
    current.push(caption);
  }
  if (current.length > 0) {
    segments.push(current);
  }

  return segments
    .flatMap((segment) => groupWords(segment))
    .map((group) => ({
      text: group.map((c) => c.text.trim()).join(' ').replace(/\s+/g, ' ').trim(),
      startMs: group[0]!.startMs,
      endMs: group[group.length - 1]!.endMs,
    }));
};

/**
 * Rough-cut captions, derived from the `vo` text on each beat before any audio
 * has been recorded. Time is split across the beat in proportion to word count,
 * which is close enough to read a contact sheet against.
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
