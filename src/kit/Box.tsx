import React from 'react';
import { useGestureStyle, type Gesture, type MotionPreset } from './motion';
import { PanelDecor } from './PanelDecor';
import { useSurfaceStyle } from './surface';
import { useTheme } from './ThemeContext';

export type BoxTone = 'surface' | 'accent' | 'positive' | 'negative' | 'plain';

export type BoxProps = {
  /** Optional small label across the top of the box. */
  readonly label?: string;
  readonly tone?: BoxTone;
  readonly children: React.ReactNode;
  readonly delay?: number;
  readonly preset?: MotionPreset;
  /** Overrides the theme's panel gesture. Reach for this rarely. */
  readonly gesture?: Gesture;
  /** Grow to fill the space a row/column gives it. */
  readonly grow?: boolean;
  readonly align?: 'left' | 'center';
  /** Render the body in the mono face — for type names and identifiers. */
  readonly mono?: boolean;
};

/**
 * A themed panel. The generic container for anything that isn't code — use it
 * rather than styling a `<div>` in a video file.
 */
const accentColorFor = (theme: ReturnType<typeof useTheme>, tone: BoxTone): string =>
  tone === 'accent'
    ? theme.colors.accent
    : tone === 'positive'
      ? theme.colors.positive
      : tone === 'negative'
        ? theme.colors.negative
        : theme.colors.border;

export const Box: React.FC<BoxProps> = ({
  label,
  tone = 'surface',
  children,
  delay = 0,
  preset,
  gesture,
  grow = false,
  align = 'left',
  mono = false,
}) => {
  const theme = useTheme();
  const style = useGestureStyle('panel', { delay, preset, gesture, seed: label ?? 'box' });
  const surface = useSurfaceStyle({ borderColor: accentColorFor(theme, tone) });

  const accentColor = accentColorFor(theme, tone);

  return (
    <div
      style={{
        ...style,
        flexGrow: grow ? 1 : 0,
        flexBasis: grow ? 0 : 'auto',
        minWidth: 0,
        ...(tone === 'plain'
          ? { background: 'transparent', border: 'none', boxShadow: 'none' }
          : surface),
        padding: 36,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
      }}
    >
      {tone === 'plain' ? null : <PanelDecor seed={label ?? 'box'} />}
      {label ? (
        <div
          style={{
            fontFamily: theme.type.body,
            fontSize: theme.type.size.label,
            fontWeight: 700,
            letterSpacing: theme.type.letterSpacing.label,
            textTransform: theme.type.labelTransform,
            color: tone === 'surface' ? theme.colors.textMuted : accentColor,
          }}
        >
          {label}
        </div>
      ) : null}

      <div
        style={{
          fontFamily: mono ? theme.type.mono : theme.type.body,
          fontSize: theme.type.size.body,
          fontWeight: mono ? theme.type.weightMono : theme.type.weightBody,
          lineHeight: theme.type.lineHeight.normal,
          letterSpacing: theme.type.letterSpacing.body,
          color: theme.colors.text,
          width: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Lays boxes out side by side inside the content box. */
export const Row: React.FC<{
  readonly children: React.ReactNode;
  readonly gap?: number;
  readonly align?: 'stretch' | 'center';
}> = ({ children, gap = 28, align = 'stretch' }) => (
  <div style={{ display: 'flex', flexDirection: 'row', gap, alignItems: align, width: '100%' }}>
    {children}
  </div>
);

/** Stacks children vertically with themed spacing. */
export const Stack: React.FC<{
  readonly children: React.ReactNode;
  readonly gap?: number;
}> = ({ children, gap = 28 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, width: '100%' }}>
    {children}
  </div>
);
