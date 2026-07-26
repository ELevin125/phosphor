import React from 'react';
import { CONTENT } from '../layout';
import { PanelDecor } from '../PanelDecor';
import { useSurfaceStyle } from '../surface';
import { useTheme } from '../ThemeContext';
import { tokenFontStyle, type CodeLine } from './highlighter';

/**
 * Advance width of one character as a fraction of font size. JetBrains Mono
 * and IBM Plex Mono are both 0.6em; any mono face we add should be too.
 */
const MONO_ADVANCE = 0.6;

/** Never shrink code past this — below it, the code is unreadable on a phone. */
const MIN_CODE_SIZE = 22;

/** Horizontal padding inside the code panel. */
const PANEL_PAD_X = 28;

/**
 * Picks the largest font size at which the longest line still fits.
 *
 * Overflowing code is the single most common defect in these videos, and it is
 * invisible until you look at a rendered frame. Solving it here means no video
 * can produce a clipped line, whatever sample it passes in.
 */
export const fitCodeSize = (
  lines: readonly CodeLine[],
  preferredSize: number,
  gutterEm: number,
  availableWidth: number,
): number => {
  const maxChars = Math.max(1, ...lines.map((l) => l.text.length));
  const perChar = maxChars * MONO_ADVANCE + gutterEm;
  const fitted = (availableWidth - PANEL_PAD_X * 2) / perChar;
  return Math.max(MIN_CODE_SIZE, Math.min(preferredSize, Math.floor(fitted)));
};

/** Everything a single rendered code row needs to know about itself. */
export type RowStyle = {
  readonly opacity: number;
  readonly background: string;
  /** 0..1 — collapses the row's height, used by the diff morph. */
  readonly heightScale: number;
  readonly translateX: number;
  /** Colour of the left gutter marker, or null for none. */
  readonly marker: string | null;
  readonly markerGlyph: string;
};

export const defaultRowStyle: RowStyle = {
  opacity: 1,
  background: 'transparent',
  heightScale: 1,
  translateX: 0,
  marker: null,
  markerGlyph: '',
};

export type CodePanelProps = {
  readonly lines: readonly CodeLine[];
  readonly rowStyles: readonly RowStyle[];
  /** Filename or label shown in the panel header. Omit for no header. */
  readonly title?: string;
  /** Panel-level entrance style from `useEnterStyle`. */
  readonly style?: React.CSSProperties;
  readonly showLineNumbers?: boolean;
  /** Line numbers to print in the gutter, parallel to `lines`. */
  readonly lineNumbers?: readonly (number | null)[];
  /** Width the panel has to work with. Defaults to the full content box. */
  readonly availableWidth?: number;
};

/**
 * Renders highlighted lines inside a themed panel.
 *
 * Rows are absolutely stacked by accumulated height so a row can collapse to
 * zero without the browser reflowing text mid-animation — that reflow is what
 * makes naive diff animations jitter.
 */
export const CodePanel: React.FC<CodePanelProps> = ({
  lines,
  rowStyles,
  title,
  style,
  showLineNumbers = false,
  lineNumbers,
  availableWidth,
}) => {
  const theme = useTheme();
  const surface = useSurfaceStyle({ code: true });
  const gutterEm = showLineNumbers ? 2.6 : 1.2;
  // Shrink to fit rather than clip. See `fitCodeSize`.
  const fontSize = fitCodeSize(
    lines,
    theme.type.size.code,
    gutterEm,
    availableWidth ?? CONTENT.width,
  );
  const rowHeight = fontSize * theme.type.lineHeight.code;
  const gutterWidth = fontSize * gutterEm;

  let y = 0;
  const positioned = lines.map((line, i) => {
    const rs = rowStyles[i] ?? defaultRowStyle;
    const top = y;
    y += rowHeight * rs.heightScale;
    return { line, rs, top, index: i };
  });

  return (
    <div
      style={{
        ...style,
        ...surface,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <PanelDecor seed={title ?? 'code'} />
      {title ? (
        <div
          style={{
            padding: '18px 28px',
            borderBottom: `${theme.shape.borderWidth}px solid ${theme.colors.border}`,
            background: theme.colors.bgAlt,
            fontFamily: theme.type.mono,
            fontSize: theme.type.size.label,
            fontWeight: 600,
            letterSpacing: theme.type.letterSpacing.label,
            textTransform: theme.type.labelTransform,
            color: theme.colors.textMuted,
          }}
        >
          {title}
        </div>
      ) : null}

      <div
        style={{
          position: 'relative',
          height: y,
          padding: '28px 0',
          boxSizing: 'content-box',
          transition: 'none',
        }}
      >
        {positioned.map(({ line, rs, top, index }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top,
              left: 0,
              right: 0,
              height: rowHeight,
              display: 'flex',
              alignItems: 'center',
              opacity: rs.opacity,
              background: rs.background,
              transform: `translateX(${rs.translateX}px)`,
              // A collapsing row must not spill its text over its neighbours.
              clipPath: rs.heightScale < 1 ? `inset(0 0 ${(1 - rs.heightScale) * 100}% 0)` : undefined,
              paddingLeft: PANEL_PAD_X,
              paddingRight: PANEL_PAD_X,
              whiteSpace: 'pre',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: gutterWidth,
                flexShrink: 0,
                fontFamily: theme.type.mono,
                fontSize: fontSize * 0.8,
                color: rs.marker ?? theme.colors.textMuted,
                opacity: rs.marker ? 1 : 0.55,
                fontWeight: 700,
              }}
            >
              {rs.marker
                ? rs.markerGlyph
                : showLineNumbers
                  ? (lineNumbers?.[index] ?? '')
                  : ''}
            </span>

            <span
              style={{
                fontFamily: theme.type.mono,
                fontSize,
                fontWeight: theme.type.weightMono,
                lineHeight: theme.type.lineHeight.code,
                minWidth: 0,
              }}
            >
              {line.tokens.map((t, ti) => (
                <span key={ti} style={{ color: t.color, ...tokenFontStyle(t.fontStyle) }}>
                  {t.content}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
