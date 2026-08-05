import { describe, expect, it } from 'vitest';

import { phrasesFromCaptions } from './phrases';

/**
 * Word timings, evenly spaced. The grouper only reads `text`; the timings exist
 * so `phrasesFromCaptions` can find the beat boundaries and so the returned
 * phrases have something to report.
 */
const words = (sentence: string, msPerWord = 400) =>
  sentence.split(' ').map((text, i) => ({
    text,
    startMs: i * msPerWord,
    endMs: (i + 1) * msPerWord,
    timestampMs: i * msPerWord,
    confidence: 1,
  }));

const textsOf = (sentence: string, boundaries: readonly number[] = []) =>
  phrasesFromCaptions(words(sentence), boundaries).map((p) => p.text);

describe('negations are never stranded', () => {
  /*
    The regression this file exists for. `second-listener` shipped with a
    caption reading "a very good solution," alone on screen for a second and a
    half over the naive code, while the voice said "this is NOT a very good
    solution" — so a muted viewer read the opposite of the argument at the
    moment it was being made. Awkward breaks are a taste question; this one made
    the video say something false.
  */
  it('keeps "not" with what it negates', () => {
    const out = textsOf('Now this is not a very good solution, so instead it does one line.');
    expect(out.some((t) => /^a very good solution/.test(t))).toBe(false);
    expect(out.some((t) => /^not a very good solution/.test(t))).toBe(true);
  });

  it('never ends a phrase on a negation', () => {
    const cases = [
      'The thing about this approach is that it does not scale past a few thousand agents.',
      'You really should never call this from inside a physics callback in Unity.',
      'It turns out the compiler cannot prove that the loop terminates at all here.',
    ];
    for (const sentence of cases) {
      for (const phrase of textsOf(sentence)) {
        const last = phrase.split(' ').pop()!.toLowerCase().replace(/[^a-z']/g, '');
        expect(last, `stranded "${last}" in "${phrase}"`).not.toMatch(
          /^(not|n't|no|never|none|nothing|without|cannot|can't|won't|don't|doesn't|isn't)$/,
        );
      }
    }
  });
});

describe('beat boundaries', () => {
  /*
    A conjunction before a beat split belongs to the beat it opens, not the one
    it happens to be timed into. The grouper cannot fix this on its own — a word
    can only be grouped inside the segment it was given — so the repair happens
    at the split.
  */
  it('pushes a trailing conjunction into the next beat', () => {
    const sentence = 'the exact same script that we use across players and the enemies and when it hits zero on an enemy you want particles';
    // Boundary timed onto "when": the "and" before it lands in the first beat.
    const boundary = sentence.split(' ').indexOf('when') * 400;
    const out = textsOf(sentence, [boundary]);
    expect(out.some((t) => /\band$/.test(t))).toBe(false);
    expect(out.some((t) => /^and when it hits/.test(t))).toBe(true);
  });

  it('leaves a boundary that already sits on a full stop alone', () => {
    const sentence = 'we recycle the enemy back into our pooling solution. So the obvious thing is to put it in the health component';
    const boundary = sentence.split(' ').indexOf('So') * 400;
    const out = textsOf(sentence, [boundary]);
    // "So" opens a sentence here, so `unstrandConnectives` must defer to the
    // sentence snap and NOT drag it back across the split.
    expect(out.some((t) => /pooling solution\.$/.test(t))).toBe(true);
    expect(out.some((t) => /solution\. So/.test(t))).toBe(false);
  });
});

describe('phrase shape', () => {
  it('never emits a single-word phrase', () => {
    const out = textsOf('So every enemy in here has a health component and it is the exact same script that we are using across players and the enemies');
    for (const phrase of out) {
      expect(phrase.split(' ').length, `one-word phrase "${phrase}"`).toBeGreaterThan(1);
    }
  });

  it('keeps every word, in order', () => {
    const sentence = 'and this is the exact same list, same nodes, same memory, nothing reallocated, nothing freed, doing the exact same walk.';
    expect(textsOf(sentence).join(' ')).toBe(sentence);
  });
});
