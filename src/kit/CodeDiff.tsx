import React from 'react';
import { interpolate } from 'remotion';
import { CodePanel, defaultRowStyle, type RowStyle } from './code/CodePanel';
import { diffLines } from './code/diff';
import { dedent, highlight, type CodeLang } from './code/highlighter';
import { useGestureStyle, useReveal } from './motion';
import { useTheme } from './ThemeContext';

export type CodeDiffProps = {
  readonly before: string;
  readonly after: string;
  readonly lang: CodeLang;
  readonly title?: string;
  /**
   * Frames to hold on `before` before the morph starts. Give the viewer time
   * to actually read the original.
   */
  readonly holdFrames?: number;
  readonly delay?: number;
};

/**
 * Morphs one code state into another.
 *
 * Unchanged lines stay put and slide to their new position; removed lines
 * collapse and fade; added lines expand in. Because the row heights animate
 * rather than the container re-flowing, the shared lines track continuously
 * instead of jumping.
 */
export const CodeDiff: React.FC<CodeDiffProps> = ({
  before,
  after,
  lang,
  title,
  holdFrames = 20,
  delay = 0,
}) => {
  const theme = useTheme();
  const panelStyle = useGestureStyle('code', { delay, seed: title ?? 'diff' });

  const beforeSrc = dedent(before);
  const afterSrc = dedent(after);
  const beforeLines = highlight(beforeSrc, lang, theme.shikiTheme);
  const afterLines = highlight(afterSrc, lang, theme.shikiTheme);

  const rows = diffLines(beforeSrc.split('\n'), afterSrc.split('\n'));

  // The panel appears first, then the morph runs after `holdFrames`.
  const appear = useReveal({ delay, preset: 'enter' });
  const morph = useReveal({ delay: delay + holdFrames, preset: 'soft' });

  const lines = rows.map((row) =>
    row.status === 'add'
      ? afterLines[row.afterIndex]!
      : beforeLines[row.beforeIndex]!,
  );

  const rowStyles: RowStyle[] = rows.map((row) => {
    if (row.status === 'same') {
      return { ...defaultRowStyle, opacity: appear };
    }

    if (row.status === 'remove') {
      // Fade the text out first, then collapse the space it occupied.
      const fade = interpolate(morph, [0, 0.45], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const collapse = interpolate(morph, [0.35, 1], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return {
        ...defaultRowStyle,
        opacity: appear * fade,
        heightScale: collapse,
        background: theme.colors.diffRemoveBg,
        marker: theme.colors.negative,
        markerGlyph: '-',
        translateX: (1 - fade) * -24,
      };
    }

    // Added: open the space first, then fade the text in.
    const expand = interpolate(morph, [0.25, 0.8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const fadeIn = interpolate(morph, [0.55, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return {
      ...defaultRowStyle,
      opacity: fadeIn,
      heightScale: expand,
      background: theme.colors.diffAddBg,
      marker: theme.colors.positive,
      markerGlyph: '+',
      translateX: (1 - fadeIn) * 24,
    };
  });

  return (
    <CodePanel
      lines={lines}
      rowStyles={rowStyles}
      title={title}
      style={panelStyle}
      showLineNumbers={false}
    />
  );
};
