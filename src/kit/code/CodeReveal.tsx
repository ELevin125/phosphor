import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBeat } from '../Beat';
import { CodePanel, defaultRowStyle, type RowStyle } from './CodePanel';
import { expandLineSpec } from './diff';
import { dedent, highlight, type CodeLang } from './highlighter';
import { useGestureStyle, type Gesture } from '../motion';
import { useTheme } from '../ThemeContext';

export type LineSpec = readonly (number | readonly [number, number])[];

export type CodeRevealProps = {
  readonly code: string;
  readonly lang: CodeLang;
  /** Filename shown in the panel header. */
  readonly title?: string;
  /**
   * 1-based lines to spotlight. Everything else dims.
   * Accepts single lines and inclusive ranges: `[2, [5, 7]]`.
   */
  readonly highlightLines?: LineSpec;
  /** `line` types the code on line by line; `all` fades the block in at once. */
  readonly revealBy?: 'line' | 'all';
  readonly showLineNumbers?: boolean;
  readonly delay?: number;
  /**
   * Frames the line-by-line reveal is spread over. Defaults to ~55% of the
   * beat, so a long beat types on slowly instead of snapping in and then
   * sitting on a dead static frame for four seconds.
   */
  readonly revealFrames?: number;
  /** Overrides the theme's gesture for the panel itself. */
  readonly gesture?: Gesture;
};

/** Share of a beat the reveal occupies when `revealFrames` isn't given. */
const REVEAL_SHARE = 0.55;

/**
 * A block of syntax-highlighted code.
 *
 * Highlighting is computed synchronously (see `code/highlighter.ts`), so this
 * is safe to mount on every frame with no `delayRender` cost.
 */
export const CodeReveal: React.FC<CodeRevealProps> = ({
  code,
  lang,
  title,
  highlightLines,
  revealBy = 'line',
  showLineNumbers = true,
  delay = 0,
  revealFrames,
  gesture,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { durationInFrames } = useBeat();

  const panelStyle = useGestureStyle('code', { delay, gesture, seed: title ?? 'code' });
  const lines = highlight(dedent(code), lang, theme.shikiTheme);
  const spotlight = expandLineSpec(highlightLines);

  const preset = theme.motion.enter;
  const span = revealFrames ?? Math.max(
    preset.durationInFrames,
    (durationInFrames - delay) * REVEAL_SHARE,
  );
  // Last line must still finish inside the span.
  const stagger =
    lines.length > 1
      ? Math.max(1, (span - preset.durationInFrames) / (lines.length - 1))
      : 0;

  const rowStyles: RowStyle[] = lines.map((_, i) => {
    const lineNumber = i + 1;
    const isSpotlit = spotlight === null || spotlight.has(lineNumber);

    const perLine =
      revealBy === 'all'
        ? spring({
            frame,
            fps,
            delay,
            durationInFrames: preset.durationInFrames,
            config: preset,
          })
        : spring({
            frame,
            fps,
            delay: delay + i * stagger,
            durationInFrames: preset.durationInFrames,
            config: preset,
          });

    const clamped = interpolate(perLine, [0, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const dimmed = isSpotlit ? 1 : theme.colors.dimOpacity;

    return {
      ...defaultRowStyle,
      opacity: clamped * dimmed,
      background: spotlight !== null && isSpotlit ? theme.colors.highlightBg : 'transparent',
      translateX: (1 - clamped) * (revealBy === 'line' ? 18 : 0),
    };
  });

  return (
    <CodePanel
      lines={lines}
      rowStyles={rowStyles}
      title={title}
      style={panelStyle}
      showLineNumbers={showLineNumbers}
      lineNumbers={lines.map((_, i) => i + 1)}
    />
  );
};
