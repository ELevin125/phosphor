/**
 * Needleman-Wunsch global alignment over word lists.
 *
 * Used twice in the pipeline, for the same underlying reason: two versions of
 * the same speech need to be matched up without assuming they agree word for
 * word.
 *
 *   script    <-> transcript   which beat each spoken word belongs to
 *   reviewed  <-> transcript   which timing each edited word inherits
 *
 * Counting words off from the start does not work for either. Say four extra
 * words early on and every later boundary lands four words out, permanently,
 * because nothing ever re-syncs. Insertions, deletions and substitutions all
 * cost something here, the best overall path wins, and a deviation is absorbed
 * where it happens instead of shifting everything after it.
 *
 * Roughly 200x200 cells at this scale — free.
 */

/**
 * One step along the alignment path.
 *
 * Both indices set is a pair (a match if the words are equal, a substitution if
 * not); one side `null` is a gap — a word present in one list and absent from
 * the other.
 */
export type Step = {
  readonly a: number | null;
  readonly b: number | null;
};

const MATCH = 2;
const MISMATCH = -1;
const GAP = -1;

/** Compare on letters and digits only — whisper attaches punctuation to words. */
export const norm = (w: string): string => w.toLowerCase().replace(/[^a-z0-9]/g, '');

export const align = (a: readonly string[], b: readonly string[]): Step[] => {
  const n = a.length;
  const m = b.length;
  const W = m + 1;
  const dp = new Int32Array((n + 1) * W);
  const tb = new Uint8Array((n + 1) * W); // 0 diagonal, 1 skip a, 2 skip b

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
      const diag = dp[(i - 1) * W + (j - 1)]! + (a[i - 1] === b[j - 1] ? MATCH : MISMATCH);
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

  const path: Step[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const dir = i === 0 ? 2 : j === 0 ? 1 : tb[i * W + j]!;
    if (dir === 0) {
      path.push({ a: i - 1, b: j - 1 });
      i--;
      j--;
    } else if (dir === 1) {
      path.push({ a: i - 1, b: null });
      i--;
    } else {
      path.push({ a: null, b: j - 1 });
      j--;
    }
  }
  path.reverse();
  return path;
};
