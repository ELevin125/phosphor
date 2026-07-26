export type DiffStatus = 'same' | 'add' | 'remove';

export type DiffRow = {
  readonly status: DiffStatus;
  /** Index into the `before` lines, or -1 for added rows. */
  readonly beforeIndex: number;
  /** Index into the `after` lines, or -1 for removed rows. */
  readonly afterIndex: number;
};

/**
 * Line-level diff via a longest-common-subsequence table.
 *
 * Lines are matched on their trimmed text, so a pure re-indent doesn't read as
 * a rewrite. Inputs are short (a screen of code), so the O(n*m) table is fine.
 */
export const diffLines = (
  before: readonly string[],
  after: readonly string[],
): DiffRow[] => {
  const a = before.map((l) => l.trim());
  const b = after.map((l) => l.trim());
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ status: 'same', beforeIndex: i, afterIndex: j });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      rows.push({ status: 'remove', beforeIndex: i, afterIndex: -1 });
      i++;
    } else {
      rows.push({ status: 'add', beforeIndex: -1, afterIndex: j });
      j++;
    }
  }

  while (i < n) {
    rows.push({ status: 'remove', beforeIndex: i, afterIndex: -1 });
    i++;
  }
  while (j < m) {
    rows.push({ status: 'add', beforeIndex: -1, afterIndex: j });
    j++;
  }

  return rows;
};

/**
 * Expands `[1, [4, 6]]` into `{1, 4, 5, 6}`. Line numbers are 1-based, matching
 * what you'd read off an editor gutter.
 */
export const expandLineSpec = (
  spec: readonly (number | readonly [number, number])[] | undefined,
): Set<number> | null => {
  if (!spec || spec.length === 0) {
    return null;
  }
  const out = new Set<number>();
  for (const entry of spec) {
    if (typeof entry === 'number') {
      out.add(entry);
    } else {
      for (let n = entry[0]; n <= entry[1]; n++) {
        out.add(n);
      }
    }
  }
  return out;
};
