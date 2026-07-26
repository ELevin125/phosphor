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
  /** 0..1, sitting under narration. */
  readonly volume?: number;
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
  volume = 0.22,
  fadeIn = 0.6,
  fadeOut = 1.5,
  startAt,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const videoSeconds = durationInFrames / fps;
  const start = startAt ?? pickEntry(track, seed ?? track, videoSeconds);

  const analysis = TRACKS[track];
  const src = analysis ? analysis.track : `${track}.mp3`;

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
