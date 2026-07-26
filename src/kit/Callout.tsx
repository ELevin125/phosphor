import React from 'react';
import { useGestureStyle, type Gesture } from './motion';
import { PanelDecor } from './PanelDecor';
import { useSurfaceStyle } from './surface';
import { useTheme } from './ThemeContext';

export type CalloutTone = 'accent' | 'positive' | 'negative' | 'neutral';

export type CalloutProps = {
  readonly children: React.ReactNode;
  readonly tone?: CalloutTone;
  /** Small label on the accent bar, e.g. "GOTCHA". */
  readonly label?: string;
  readonly delay?: number;
  /** Renders at heading size — for the one line you want people to remember. */
  readonly big?: boolean;
  /** Overrides the theme's callout gesture. */
  readonly gesture?: Gesture;
};

/**
 * The "read this bit" element: a punchline, a gotcha, or a rule.
 * Visually louder than a Box, and deliberately limited to short text.
 */
const colorFor = (theme: ReturnType<typeof useTheme>, tone: CalloutTone): string =>
  tone === 'positive'
    ? theme.colors.positive
    : tone === 'negative'
      ? theme.colors.negative
      : tone === 'neutral'
        ? theme.colors.textMuted
        : theme.colors.accent;

export const Callout: React.FC<CalloutProps> = ({
  children,
  tone = 'accent',
  label,
  delay = 0,
  big = false,
  gesture,
}) => {
  const theme = useTheme();
  const style = useGestureStyle('callout', { delay, gesture, seed: label ?? 'callout' });
  const surface = useSurfaceStyle({ borderColor: colorFor(theme, tone), strongShadow: true });

  const color = colorFor(theme, tone);

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'row',
        gap: 28,
        alignItems: 'stretch',
        ...surface,
        padding: 34,
        width: '100%',
      }}
    >
      <PanelDecor seed={label ?? 'callout'} />
      <div
        style={{
          width: 10,
          borderRadius: theme.shape.radiusSm,
          background: color,
          boxShadow: tone === 'accent' ? theme.shape.glow : 'none',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        {label ? (
          <div
            style={{
              fontFamily: theme.type.body,
              fontSize: theme.type.size.label,
              fontWeight: 700,
              letterSpacing: theme.type.letterSpacing.label,
              textTransform: theme.type.labelTransform,
              color,
            }}
          >
            {label}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: big ? theme.type.display : theme.type.body,
            fontSize: big ? theme.type.size.heading : theme.type.size.body,
            fontWeight: big ? theme.type.weightDisplay : 600,
            lineHeight: big ? theme.type.lineHeight.tight : theme.type.lineHeight.normal,
            letterSpacing: big
              ? theme.type.letterSpacing.display
              : theme.type.letterSpacing.body,
            color: theme.colors.text,
            textWrap: 'balance',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
