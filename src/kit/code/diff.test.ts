import { describe, expect, it } from 'vitest';
import { diffLines, expandLineSpec } from './diff';

/**
 * `CodeDiff` is the one component whose output nobody can eyeball — a wrong row
 * mapping shows a line as added when it moved, which reads as a plausible diff
 * and is simply false. That is the class of bug a video ships with.
 */
describe('diffLines', () => {
  const statuses = (before: string[], after: string[]) =>
    diffLines(before, after).map((r) => r.status);

  it('reports identical input as all-same', () => {
    expect(statuses(['a', 'b'], ['a', 'b'])).toEqual(['same', 'same']);
  });

  it('ignores indentation, so a re-indent is not a rewrite', () => {
    expect(statuses(['foo();'], ['    foo();'])).toEqual(['same']);
  });

  it('finds the insertion rather than rewriting the tail', () => {
    // The naive answer is remove+add for every line from the insert onward.
    expect(statuses(['a', 'c'], ['a', 'b', 'c'])).toEqual(['same', 'add', 'same']);
  });

  it('finds the deletion rather than rewriting the tail', () => {
    expect(statuses(['a', 'b', 'c'], ['a', 'c'])).toEqual(['same', 'remove', 'same']);
  });

  it('handles an empty before as all additions', () => {
    expect(statuses([], ['a', 'b'])).toEqual(['add', 'add']);
  });

  it('handles an empty after as all removals', () => {
    expect(statuses(['a', 'b'], [])).toEqual(['remove', 'remove']);
  });

  it('keeps indices pointing at the right source line', () => {
    const rows = diffLines(['keep', 'drop'], ['keep', 'new']);
    const keep = rows.find((r) => r.status === 'same');
    const drop = rows.find((r) => r.status === 'remove');
    const added = rows.find((r) => r.status === 'add');

    expect(keep).toMatchObject({ beforeIndex: 0, afterIndex: 0 });
    // A removed row has no line in `after`, and vice versa. Rendering either
    // from the wrong array is an out-of-bounds read at best.
    expect(drop).toMatchObject({ beforeIndex: 1, afterIndex: -1 });
    expect(added).toMatchObject({ beforeIndex: -1, afterIndex: 1 });
  });

  it('never loses or invents a line', () => {
    const before = ['a', 'b', 'c', 'd'];
    const after = ['a', 'x', 'c', 'y', 'z'];
    const rows = diffLines(before, after);

    expect(rows.filter((r) => r.status !== 'add')).toHaveLength(before.length);
    expect(rows.filter((r) => r.status !== 'remove')).toHaveLength(after.length);
  });
});

describe('expandLineSpec', () => {
  it('returns null for nothing, so callers can skip dimming entirely', () => {
    expect(expandLineSpec(undefined)).toBeNull();
    expect(expandLineSpec([])).toBeNull();
  });

  it('expands ranges inclusively at both ends', () => {
    // Off-by-one here silently drops the last highlighted line.
    expect([...(expandLineSpec([[4, 6]]) ?? [])]).toEqual([4, 5, 6]);
  });

  it('mixes singles and ranges, de-duplicating overlaps', () => {
    expect([...(expandLineSpec([1, [4, 6], 5]) ?? [])].sort((a, b) => a - b)).toEqual([1, 4, 5, 6]);
  });
});
