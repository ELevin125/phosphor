import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, staticFile, useVideoConfig } from 'remotion';
import type { Caption } from '@remotion/captions';

import { getTheme, type Theme, type ThemeName } from '../theme';
import { Backdrop } from './Backdrop';
import { Board } from './Board';
import { CRT_FILTER_ID, CrtFilters, CrtOverlay } from './Crt';
import { LayoutContext, Timeline, type BeatTiming } from './Beat';
import { LayoutProvider, useLayout } from './LayoutProfile';
import { DEFAULT_PROFILE, PROFILES, type ProfileName } from './layout';
import { Music, type MusicSpec } from './Music';
import { Captions } from './captions/Captions';
import { phrasesFromBeats, phrasesFromCaptions } from './captions/phrases';
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
  const {
    name,
    canvas: CANVAS,
    safe: SAFE,
    content: CONTENT,
    captionBand: CAPTION_BAND,
    captionBandTop: CAPTION_BAND_TOP,
    captionBandBottom: CAPTION_BAND_BOTTOM,
  } = useLayout();
  // Percentages are computed, not written into the label. They were hardcoded
  // as 12%/20% — the portrait figures — and stayed that way in landscape,
  // where they are 4%/9%. A debug overlay that misreports the layout law is
  // worse than none.
  const pct = (px: number): string => `${Math.round((px / CANVAS.height) * 100)}%`;
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
      {band({ top: 0, left: 0, width: CANVAS.width, height: SAFE.top }, `SAFE TOP ${pct(SAFE.top)}`, '#FF3B30')}
      {band(
        { top: CANVAS.height - SAFE.bottom, left: 0, width: CANVAS.width, height: SAFE.bottom },
        `SAFE BOTTOM ${pct(SAFE.bottom)}`,
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
      {/* The action rail is a portrait concept: there is no such overlay on a
          landscape player, so drawing one invents a constraint. */}
      {name === 'portrait'
        ? band(
            { top: 0, right: 0, width: SAFE.right, height: CANVAS.height },
            'RAIL',
            '#AF52DE',
          )
        : null}
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
  /**
   * Frame shape. `portrait` is 1080x1920 for Reels and Shorts; `landscape`
   * is 1920x1080 for long-form. Must match the profile the composition was
   * registered with — Root.tsx sizes the canvas from the same value.
   */
  readonly profile?: ProfileName;
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
  profile = DEFAULT_PROFILE,
  debug = false,
  children,
}) => {
  const theme = getTheme(themeName);
  const { fps, width, height } = useVideoConfig();

  /*
    The composition is sized from beats.yaml's `profile`; the layout law comes
    from this prop. They are set in two different files and there is no type
    that ties them together, so a landscape video whose Video.tsx forgets
    `profile={PROFILE}` renders a portrait layout into a 1920x1080 frame — a
    content box two thirds of the way up the screen, captions off the bottom,
    and not one thing upstream that complains.

    Cheap to check here because both numbers are already in hand, and the fix
    is always the same one line.
  */
  const expected = PROFILES[profile].canvas;
  if (width !== expected.width || height !== expected.height) {
    throw new Error(
      `Stage profile "${profile}" expects a ${expected.width}x${expected.height} canvas, ` +
        `but this composition is ${width}x${height}. ` +
        `Pass profile={PROFILE} from beats.generated to <Stage>, and set ` +
        `\`profile:\` in beats.yaml — they must name the same frame.`,
    );
  }
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
    <LayoutProvider profile={profile}>
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
    </LayoutProvider>
  );
};
