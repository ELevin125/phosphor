import React from 'react';
import { Audio, interpolate, random, staticFile, useVideoConfig } from 'remotion';
import { TRACKS } from '../music.generated';

export type MusicSpec = {
  /** Track id — the filename in `public/music/` without its extension. */
  readonly track: string;
  /**
   * Seed for the random entry point.
   *
   * The whole reason this exists: reusing one track across videos should not
   * sound like reusing one track. Same seed always picks the same bar, so a
   * render is reproducible; change it — or just pass the video slug, which is
   * the default — and the track comes in somewhere else entirely.
   */
  readonly seed?: string;
  /**
   * How far the bed sits under the voiceover, in dB. Higher is quieter.
   *
   * This replaced a raw 0..1 `volume`, which was the wrong dial and shipped a
   * video with music roughly twelve decibels too loud. Stock-music tracks are
   * mastered near the ceiling — both synthwave tracks here land at -8 LUFS
   * against a -16 LUFS voice — so a fixed multiplier means the bed's real
   * level depends on how hot the mastering engineer ran that particular file.
   * Expressed as a distance from the voice, the same number sounds the same
   * under every track, which is the only thing the caller ever actually wants.
   */
  readonly under?: number;
  /**
   * Escape hatch: a final linear trim on top of the computed gain, for a track
   * whose measured loudness lies about how present it feels. Not a level.
   */
  readonly trim?: number;
  readonly fadeIn?: number;
  readonly fadeOut?: number;
  /** Pin the start, in seconds. Overrides the random pick. */
  readonly startAt?: number;
};

/**
 * Pick a bar to come in on.
 *
 * Constrained twice over. It has to be a downbeat, because dropping in
 * mid-bar makes the ear hear the first hit as beat one and then trip over the
 * real one; and it has to be somewhere loud, because a lofi track that opens
 * on four bars of vinyl crackle is not what a forty-second reel starts on.
 * `entries` in the analysis is the list that already satisfies both.
 */
export const pickEntry = (
  track: string,
  seed: string,
  videoSeconds: number,
): number => {
  const analysis = TRACKS[track];
  if (!analysis) {
    throw new Error(
      `Unknown music track "${track}". ` +
        `Put it in public/music/ and run \`npm run analyse-music\`.`,
    );
  }

  // Enough track left to cover the whole video, or the music stops mid-sentence.
  const fits = analysis.entries.filter((t) => analysis.duration - t >= videoSeconds);
  const pool = fits.length > 0 ? fits : analysis.entries;
  if (pool.length === 0) {
    return 0;
  }

  const i = Math.floor(random(`${seed}:${track}`) * pool.length);
  return pool[Math.min(i, pool.length - 1)] ?? 0;
};

/**
 * Loudness every voiceover is normalised to — see `--lufs` in process-vo.ts.
 * Not a guess: the audio chain enforces it, so a bed can be placed against it.
 */
const VOICE_LUFS = -16;

/**
 * Closest a bed may sit to the voice before it stops being a bed.
 *
 * The check exists because the failure is silent in every cheap way of
 * looking at the video. A contact sheet has no sound, a typecheck has no
 * opinion, and the render succeeds either way — the first honest signal is a
 * person listening to a finished mp4, which is the most expensive place in
 * the pipeline to discover a one-line mistake. Twelve decibels is generous;
 * a bed people describe as "extremely loud" was sitting at seven.
 */
const MIN_SEPARATION = 12;

/**
 * Linear gain that puts `track` `under` dB below the narration.
 *
 * Throws rather than clamping. A caller who asks for a bed level that would
 * bury the voice has made a mistake they cannot hear from any of the checks
 * that run before rendering, and quietly correcting it to something sensible
 * would hide the mistake in the one place it is still cheap to find.
 */
export const bedGain = (track: string, under: number, trim = 1): number => {
  if (under < MIN_SEPARATION) {
    throw new Error(
      `Music "${track}" asked to sit ${under}dB under the voice; ` +
        `the floor is ${MIN_SEPARATION}dB. Below that the bed competes with the ` +
        `narration instead of supporting it.`,
    );
  }

  const analysis = TRACKS[track];
  if (!analysis) {
    throw new Error(
      `Unknown music track "${track}". ` +
        `Put it in public/music/ and run \`npm run analyse-music\`.`,
    );
  }

  /*
    Older analyses predate the loudness measurement. Falling back to a default
    would reintroduce exactly the guesswork this replaced, so it asks for the
    one command that fixes it instead.
  */
  if (typeof analysis.lufs !== 'number') {
    throw new Error(
      `Music track "${track}" has no measured loudness. ` +
        `Run \`npm run analyse-music\` to remeasure the library.`,
    );
  }

  return 10 ** ((VOICE_LUFS - under - analysis.lufs) / 20) * trim;
};

/**
 * Background music, entering on a bar rather than at the top of the file.
 *
 * Deliberately no ducking against the voiceover. Sidechaining to speech needs
 * the VO envelope at render time and gets audibly wrong the moment the
 * narration is re-recorded; a fixed low bed mixed under a normalised voice is
 * both more predictable and what these actually sound like on a phone speaker.
 */
export const Music: React.FC<MusicSpec> = ({
  track,
  seed,
  under = 18,
  trim = 1,
  fadeIn = 0.6,
  fadeOut = 1.5,
  startAt,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const videoSeconds = durationInFrames / fps;
  const start = startAt ?? pickEntry(track, seed ?? track, videoSeconds);

  const analysis = TRACKS[track];
  const src = analysis ? analysis.track : `${track}.mp3`;
  const volume = bedGain(track, under, trim);

  const fadeInFrames = Math.round(fadeIn * fps);
  const fadeOutFrames = Math.round(fadeOut * fps);

  return (
    <Audio
      src={staticFile(`music/${src}`)}
      trimBefore={Math.round(start * fps)}
      volume={(f) =>
        interpolate(
          f,
          [
            0,
            fadeInFrames,
            Math.max(fadeInFrames, durationInFrames - fadeOutFrames),
            durationInFrames,
          ],
          [0, volume, volume, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
      }
    />
  );
};
