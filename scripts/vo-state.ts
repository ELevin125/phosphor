/**
 * The audio chain's staleness decisions, as pure functions.
 *
 * Extracted from `build.ts` so they can be tested, because the failure they
 * guard is invisible from outside: every stage exits 0, every file is written,
 * and the only symptom is work being repeated or — far worse — skipped. See
 * `vo-state.test.ts`, which encodes the loop this file was pulled out to fix.
 *
 * Deliberately takes plain values rather than reading the filesystem, so a test
 * can describe a situation instead of building one.
 */

export type VoInputs = {
  readonly force: boolean;
  /** `vo.raw.wav` exists. */
  readonly hasRaw: boolean;
  readonly wavMtime: number;
  readonly rawMtime: number;
  /** Identity of the `vo.wav` this pipeline last produced, if it recorded one. */
  readonly lastOutput: string | undefined;
  /** Identity of the `vo.wav` on disk now. */
  readonly outputNow: string;
  readonly lastSettings: string | undefined;
  readonly settingsNow: string;
};

export type VoDecision = {
  readonly run: boolean;
  /**
   * Why, for the log — or why not. `unknown` is the one case that neither runs
   * nor is confidently up to date, and it says so rather than guessing.
   */
  readonly why: 'forced' | 'settings' | 'new-take' | 'stale' | 'unknown' | 'current';
};

/**
 * Whether `process-vo` needs to run.
 *
 * A `vo.wav` that does not match the one this pipeline last produced is a new
 * take dropped in by hand, and it must be processed before anything downstream
 * reads it — the silence trim changes the file's LENGTH, so transcribing an
 * unprocessed take puts every caption out by the trim.
 */
export const decideProcessVo = (i: VoInputs): VoDecision => {
  if (i.force) return { run: true, why: 'forced' };

  const settingsChanged = i.lastSettings !== undefined && i.lastSettings !== i.settingsNow;
  if (settingsChanged) return { run: true, why: 'settings' };

  const newTake = i.lastOutput !== undefined && i.lastOutput !== i.outputNow;
  if (newTake) return { run: true, why: 'new-take' };

  const stale = !i.hasRaw || i.wavMtime < i.rawMtime;
  if (stale) return { run: true, why: 'stale' };

  /*
    No record of a previous run — a project built before this tracking existed,
    or one whose state was deleted.

    This used to RUN process-vo "to establish the stamp", which was backwards
    and cost a recording: process-vo's own new-take detection then had nothing
    to compare against either, and adopted its own output as the raw original.
    Assume an existing vo.wav is current and say so; if that guess is wrong the
    fix is --force and the cost is one re-run. See docs/DECISIONS.md#d012.
  */
  if (i.lastOutput === undefined) return { run: false, why: 'unknown' };

  return { run: false, why: 'current' };
};

export type TranscribeInputs = {
  readonly force: boolean;
  readonly reviewMtime: number;
  readonly wavMtime: number;
  readonly lastScript: string | undefined;
  readonly scriptNow: string;
};

/**
 * Whether the transcript needs regenerating.
 *
 * `reviewMtime < wavMtime` is the load-bearing comparison, and it is why the
 * state has to be written when the build PAUSES at the review gate and not only
 * when it finishes: re-running process-vo rewrites vo.wav, which makes it newer
 * than a transcript that is in fact current, which asks for another transcript.
 */
export const decideTranscribe = (i: TranscribeInputs): boolean =>
  i.force ||
  i.reviewMtime < i.wavMtime ||
  (i.lastScript !== undefined && i.lastScript !== i.scriptNow);
