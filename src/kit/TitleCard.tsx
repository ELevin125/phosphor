import React from 'react';
import { useGestureStyle, type Gesture } from './motion';
import { useTheme } from './ThemeContext';

export type TitleCardProps = {
  readonly title: string;
  /** Small line above the title. Good for the topic or a category. */
  readonly kicker?: string;
  /** Supporting line under the title. Keep it short. */
  readonly subtitle?: string;
  readonly align?: 'left' | 'center';
  readonly delay?: number;
  /** Overrides the theme's title gesture. */
  readonly gesture?: Gesture;
};

/**
 * The opening statement of a video, or a section break.
 * Type sizes, weights and motion all come from the theme, so the same title
 * reads as a terminal, a textbook, or a poster depending on the theme.
 */
export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  kicker,
  subtitle,
  align = 'left',
  delay = 0,
  gesture,
}) => {
  const theme = useTheme();
  // Three separate gestures, not one applied to a block. The kicker and
  // subtitle use the theme's small-text gesture while the title gets the loud
  // one, so a title lands in three distinct movements instead of sliding in as
  // a single lump.
  const kickerStyle = useGestureStyle('label', { delay, seed: 'kicker' });
  const titleStyle = useGestureStyle('title', { delay: delay + 2, gesture, seed: 'title' });
  const subtitleStyle = useGestureStyle('label', { delay: delay + 6, seed: 'subtitle' });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
      }}
    >
      {kicker ? (
        <div
          style={{
            ...kickerStyle,
            fontFamily: theme.type.body,
            fontSize: theme.type.size.label,
            fontWeight: 700,
            letterSpacing: theme.type.letterSpacing.label,
            textTransform: theme.type.labelTransform,
            color: theme.colors.accent,
          }}
        >
          {kicker}
        </div>
      ) : null}

      <h1
        style={{
          ...titleStyle,
          margin: 0,
          fontFamily: theme.type.display,
          fontSize: theme.type.size.title,
          fontWeight: theme.type.weightDisplay,
          lineHeight: theme.type.lineHeight.tight,
          letterSpacing: theme.type.letterSpacing.display,
          color: theme.colors.text,
          textWrap: 'balance',
        }}
      >
        {title}
      </h1>

      {subtitle ? (
        <div
          style={{
            ...subtitleStyle,
            fontFamily: theme.type.body,
            fontSize: theme.type.size.subtitle,
            fontWeight: theme.type.weightBody,
            lineHeight: theme.type.lineHeight.normal,
            color: theme.colors.textMuted,
            textWrap: 'balance',
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
