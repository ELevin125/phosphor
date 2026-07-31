import { describe, expect, it } from 'vitest';
import { align, norm } from './align';

/**
 * Needleman–Wunsch alignment of the script against the transcript. This is what
 * makes improvising survivable: a paraphrase is absorbed locally instead of
 * desynchronising every beat after it.
 *
 * A regression here does not throw. It shifts caption timings by a word or two
 * and nobody notices until the finished video is watched.
 */
const words = (s: string): string[] => s.split(' ').map(norm);

/**
 * Index pairs that were aligned to each other.
 *
 * Note this includes SUBSTITUTIONS, not just equal words — a step with both
 * indices set means "these two positions correspond", which is exactly what a
 * paraphrase produces and exactly what makes the timings survive one. Two gaps
 * score -2 against a substitution's -1, so the algorithm prefers to pair
 * unrelated words rather than skip both, and that is the correct behaviour.
 */
const aligned = (a: string, b: string) =>
  align(words(a), words(b))
    .filter((s) => s.a !== null && s.b !== null)
    .map((s) => [s.a, s.b]);

/** Aligned pairs where the words are actually the same. */
const identical = (a: string, b: string) => {
  const wa = words(a);
  const wb = words(b);
  return align(wa, wb)
    .filter((s) => s.a !== null && s.b !== null && wa[s.a] === wb[s.b])
    .map((s) => [s.a, s.b]);
};

describe('norm', () => {
  it('strips punctuation, which whisper attaches to words', () => {
    expect(norm('Hello,')).toBe('hello');
    expect(norm("don't")).toBe('dont');
    expect(norm('90-degree')).toBe('90degree');
  });

  it('keeps digits, because numbers carry meaning in these scripts', () => {
    expect(norm('Vector3')).toBe('vector3');
  });
});

describe('align', () => {
  it('matches identical sequences one to one', () => {
    expect(aligned('the cat sat', 'the cat sat')).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it('accounts for every element of both inputs exactly once', () => {
    const steps = align(words('a b c'), words('a x c d'));
    expect(steps.filter((s) => s.a !== null).map((s) => s.a)).toEqual([0, 1, 2]);
    expect(steps.filter((s) => s.b !== null).map((s) => s.b)).toEqual([0, 1, 2, 3]);
  });

  it('absorbs a paraphrase locally instead of shifting everything after it', () => {
    // The whole point: one substituted word must not desync the tail.
    const m = identical('we pass it in so the method', 'we pass it through so the method');
    expect(m).toContainEqual([0, 0]);
    expect(m).toContainEqual([4, 4]);
    expect(m).toContainEqual([6, 6]);
  });

  it('recovers alignment after an inserted word', () => {
    const m = identical('the cat sat', 'the big cat sat');
    // "cat" and "sat" still find their partners, just one index later.
    expect(m).toContainEqual([1, 2]);
    expect(m).toContainEqual([2, 3]);
  });

  it('recovers alignment after a dropped word', () => {
    const m = identical('the big cat sat', 'the cat sat');
    expect(m).toContainEqual([2, 1]);
    expect(m).toContainEqual([3, 2]);
  });

  it('handles an empty side without losing the other', () => {
    expect(align([], words('a b'))).toEqual([
      { a: null, b: 0 },
      { a: null, b: 1 },
    ]);
    expect(align(words('a b'), [])).toEqual([
      { a: 0, b: null },
      { a: 1, b: null },
    ]);
  });

  it('pairs unrelated text positionally but matches none of it', () => {
    // Unrelated words still get paired — a substitution beats two gaps — but
    // none of the pairs are equal. That gap between "aligned" and "identical"
    // is exactly what the fidelity score measures, and what dropping below
    // ~75% is telling you about the read.
    expect(aligned('alpha beta gamma', 'xxx yyy zzz')).toHaveLength(3);
    expect(identical('alpha beta gamma', 'xxx yyy zzz')).toEqual([]);
  });
});
