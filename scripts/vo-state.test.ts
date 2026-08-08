import { describe, expect, it } from 'vitest';
import { decideProcessVo, decideTranscribe, type VoInputs } from './vo-state';

/**
 * A settled project: processed take, transcript current, state recorded.
 * Individual tests override only the field they are about.
 */
const settled: VoInputs = {
  force: false,
  hasRaw: true,
  wavMtime: 2000,
  rawMtime: 1000,
  lastOutput: '2000:5000',
  outputNow: '2000:5000',
  lastSettings: 'abc',
  settingsNow: 'abc',
};

describe('decideProcessVo', () => {
  it('leaves a settled project alone', () => {
    expect(decideProcessVo(settled)).toEqual({ run: false, why: 'current' });
  });

  it('processes a take dropped in by hand', () => {
    // Same path, different file — the stamp is what notices.
    const decision = decideProcessVo({ ...settled, outputNow: '9000:7777' });
    expect(decision).toEqual({ run: true, why: 'new-take' });
  });

  it('processes again when the vo settings change', () => {
    expect(decideProcessVo({ ...settled, settingsNow: 'xyz' }).why).toBe('settings');
  });

  it('processes when the raw take is newer than the processed one', () => {
    expect(decideProcessVo({ ...settled, rawMtime: 3000 }).why).toBe('stale');
  });

  /*
    D012. With no record of a previous run, the safe assumption is that the
    vo.wav present is current — running process-vo to "establish" the stamp is
    what once consumed an untouched original.
  */
  it('does NOT process when there is no record of a previous run', () => {
    const decision = decideProcessVo({ ...settled, lastOutput: undefined });
    expect(decision).toEqual({ run: false, why: 'unknown' });
  });

  it('still processes an unknown project when forced', () => {
    expect(decideProcessVo({ ...settled, lastOutput: undefined, force: true }).run).toBe(true);
  });
});

describe('decideTranscribe', () => {
  const current = {
    force: false,
    reviewMtime: 3000,
    wavMtime: 2000,
    lastScript: 's1',
    scriptNow: 's1',
  };

  it('leaves a current transcript alone', () => {
    expect(decideTranscribe(current)).toBe(false);
  });

  it('re-transcribes when the audio is newer than the transcript', () => {
    expect(decideTranscribe({ ...current, wavMtime: 4000 })).toBe(true);
  });

  it('re-transcribes when the narration changed', () => {
    expect(decideTranscribe({ ...current, scriptNow: 's2' })).toBe(true);
  });
});

/**
 * The regression this file exists for.
 *
 * Dropping in a new take used to make `npm run build` unable to reach the
 * transcript gate twice: the gate exited before writing state, so the next run
 * still held the previous build's stamp, re-ran process-vo, rewrote vo.wav, and
 * therefore needed another transcript. Forever.
 *
 * The fix is that a PAUSE records what it did. These two tests are the before
 * and after of that, written as the sequence rather than as a predicate, since
 * the bug was in the lifecycle and not in either decision on its own.
 */
describe('dropped-in take, across two runs', () => {
  const droppedIn: VoInputs = { ...settled, outputNow: '9000:7777' };

  it('run 1 processes the take and then wants a transcript', () => {
    expect(decideProcessVo(droppedIn).why).toBe('new-take');

    // process-vo has now rewritten vo.wav, so it is newer than the transcript.
    expect(
      decideTranscribe({
        force: false,
        reviewMtime: 1500,
        wavMtime: 9000,
        lastScript: 's1',
        scriptNow: 's1',
      }),
    ).toBe(true);
  });

  it('run 2 does neither, once the pause has been recorded', () => {
    // What `remember()` writes at the gate: the stamp process-vo just produced.
    const recorded: VoInputs = { ...droppedIn, lastOutput: '9000:7777' };

    expect(decideProcessVo(recorded)).toEqual({ run: false, why: 'current' });

    // vo.wav therefore is NOT rewritten, so the transcript stays the newer file
    // and the build falls through to `retime --apply` instead of looping.
    expect(
      decideTranscribe({
        force: false,
        reviewMtime: 9500,
        wavMtime: 9000,
        lastScript: 's1',
        scriptNow: 's1',
      }),
    ).toBe(false);
  });
});
