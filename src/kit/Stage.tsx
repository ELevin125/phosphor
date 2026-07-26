import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, staticFile, useVideoConfig } from 'remotion';
import type { Caption } from '@remotion/captions';

import { getTheme, type Theme, type ThemeName } from '../theme';
import { Backdrop } from './Backdrop';
import { Board } from './Board';
import { CRT_FILTER_ID, CrtFilters, CrtOverlay } from './Crt';
import { LayoutContext, Timeline, type BeatTiming } from './Beat';
import { Music, type MusicSpec } from './Music';
import { Captions } from './captions/Captions';
import { phrasesFromBeats, phrasesFromCaptions } from './captions/phrases';
import {
  CANVAS,
  CAPTION_BAND,
  CAPTION_BAND_BOTTOM,
  CAPTION_BAND_TOP,
  CONTENT,
  GUTTER,
  SAFE,
} from './layout';
import { ThemeProvider } from './ThemeContext';

/** `loadFont` calls `delayRender` internally; only do it once per theme. */
const fontsLoaded = new Set<string>();
const ensureFonts = (theme: Theme) => {
  if (!fontsLoaded.has(theme.name)) {
    fontsLoaded.add(theme.name);
    theme.loadFonts();
  }
};

const DebugOverlay: React.FC<{ readonly captionBand: boolean }> = ({ captionBand }) => {
  const band = (
    style: React.CSSProperties,
    label: string,
    color: string,
  ): React.ReactNode => (
    <div style={{ position: 'absolute', ...style, background: `${color}22`, border: `2px dashed ${color}` }}>
      <span
        style={{
          position: 'absolute',
          left: 8,
          top: 6,
          font: '600 22px ui-monospace, monospace',
          color,
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 999 }}>
      {band({ top: 0, left: 0, width: CANVAS.width, height: SAFE.top }, 'SAFE TOP 12%', '#FF3B30')}
      {band(
        { top: CANVAS.height - SAFE.bottom, left: 0, width: CANVAS.width, height: SAFE.bottom },
        'SAFE BOTTOM 20%',
        '#FF3B30',
      )}
      {captionBand
        ? band(
            { top: CAPTION_BAND_TOP, left: 0, width: CANVAS.width, height: CAPTION_BAND.height },
            'CAPTION BAND',
            '#FFCC00',
          )
        : null}
      {band(
        {
          top: CONTENT.top,
          left: CONTENT.left,
          width: CONTENT.width,
          // Silent videos reclaim the caption band, so the box really is taller.
          height: (captionBand ? CONTENT.bottom : CAPTION_BAND_BOTTOM) - CONTENT.top,
        },
        'CONTENT BOX',
        '#34C759',
      )}
      {band(
        { top: 0, right: 0, width: SAFE.right, height: CANVAS.height },
        'RAIL',
        '#AF52DE',
      )}
    </AbsoluteFill>
  );
};

export type StageProps = {
  /** Theme name, or a Theme object. This is the one-line reskin. */
  readonly theme?: ThemeName;
  /** Timings for every beat, generated from beats.yaml. */
  readonly beats: readonly BeatTiming[];
  /** Path of the voiceover inside `public/`, e.g. `videos/slug/vo.wav`. */
  readonly audioSrc?: string | null;
  /**
   * Background music. Enters on a bar chosen from the track's analysis rather
   * than at 0:00, seeded so the choice is stable across renders but different
   * per video — the same track twice should not open the same way twice.
   */
  readonly music?: MusicSpec | null;
  /** Real word timings once the VO is transcribed. Falls back to beat text. */
  readonly captions?: readonly Caption[] | null;
  /**
   * Burned-in captions come from narration. A silent, text-only video has no
   * narration to caption, so the band is switched off and the beats get the
   * full content box.
   */
  readonly showCaptions?: boolean;
  /**
   * How beats are arranged.
   *
   * `stack` — each beat replaces the last, full-screen. Familiar, and correct
   *   when consecutive beats are genuinely unrelated.
   * `board` — every beat owns a cell on one large board and the camera flies
   *   between them, leaving earlier content visible and dimmed. Use it when
   *   the beats build on each other, which is most explainers.
   */
  readonly layout?: 'stack' | 'board';
  /** Draws safe areas, caption band and content box. */
  readonly debug?: boolean;
  readonly children: React.ReactNode;
};

/**
 * The shell every video sits in: background, fonts, audio, captions, safe-area
 * debugging, and the beat timeline. A video file should contain a `<Stage>`
 * and some `<Beat>`s, and nothing else structural.
 */
export const Stage: React.FC<StageProps> = ({
  theme: themeName,
  beats,
  audioSrc,
  music,
  captions,
  showCaptions = true,
  layout = 'stack',
  debug = false,
  children,
}) => {
  const theme = getTheme(themeName);
  const { fps } = useVideoConfig();
  ensureFonts(theme);

  /** Beat start times in ms — phrase breaks, so no caption spans two beats. */
  const boundariesMs = useMemo(() => {
    const out: number[] = [];
    let frames = 0;
    for (const beat of beats) {
      frames += beat.durationInFrames;
      out.push((frames / fps) * 1000);
    }
    return out;
  }, [beats, fps]);

  const phrases = useMemo(
    () =>
      captions && captions.length > 0
        ? phrasesFromCaptions(captions, boundariesMs)
        : phrasesFromBeats(beats, fps),
    [captions, beats, fps, boundariesMs],
  );

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
        <CrtFilters />

        {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
        {music ? <Music {...music} /> : null}

        {/* Content is quantised; the CRT overlay on top deliberately is not. */}
        <AbsoluteFill
          style={{
            filter: theme.crt.enabled ? `url(#${CRT_FILTER_ID})` : undefined,
          }}
        >
          {/*
            Board draws its own backdrop, because the starfield has to parallax
            against the camera. Drawing one here as well would sit a static sky
            underneath a moving one.
          */}
          {layout === 'board' ? null : <Backdrop />}

          <LayoutContext.Provider value={{ captionBand: showCaptions }}>
            {layout === 'board' ? (
              <Board beats={beats}>{children}</Board>
            ) : (
              <Timeline beats={beats}>{children}</Timeline>
            )}
          </LayoutContext.Provider>

          {showCaptions ? <Captions phrases={phrases} /> : null}
        </AbsoluteFill>

        <CrtOverlay />

        {debug ? <DebugOverlay captionBand={showCaptions} /> : null}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
