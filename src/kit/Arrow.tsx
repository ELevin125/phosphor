import React from 'react';
import { interpolate } from 'remotion';
import { useReveal } from './motion';
import { useTheme } from './ThemeContext';

export type ArrowDirection = 'down' | 'up' | 'left' | 'right';

export type ArrowProps = {
  readonly direction?: ArrowDirection;
  /** Length along the arrow's axis, in px. */
  readonly length?: number;
  readonly tone?: 'accent' | 'positive' | 'negative' | 'muted';
  /** Optional short word rendered beside the arrow. */
  readonly label?: string;
  readonly delay?: number;
};

const ROTATION: Record<ArrowDirection, number> = {
  down: 0,
  up: 180,
  left: 90,
  right: -90,
};

/**
 * A connector between two ideas. Draws itself on with a stroke-dash reveal
 * rather than fading, so it reads as "this leads to that".
 */
export const Arrow: React.FC<ArrowProps> = ({
  direction = 'down',
  length = 120,
  tone = 'accent',
  label,
  delay = 0,
}) => {
  const theme = useTheme();
  const progress = useReveal({ delay, preset: 'enter' });

  const color =
    tone === 'positive'
      ? theme.colors.positive
      : tone === 'negative'
        ? theme.colors.negative
        : tone === 'muted'
          ? theme.colors.textMuted
          : theme.colors.accent;

  const width = 48;
  const headSize = 22;
  const shaftLength = length - headSize;
  const drawn = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        alignSelf: 'center',
      }}
    >
      <svg
        width={width}
        height={length}
        viewBox={`0 0 ${width} ${length}`}
        style={{ transform: `rotate(${ROTATION[direction]}deg)`, overflow: 'visible' }}
      >
        <line
          x1={width / 2}
          y1={0}
          x2={width / 2}
          y2={shaftLength}
          stroke={color}
          strokeWidth={theme.shape.borderWidth >= 4 ? 8 : 5}
          strokeLinecap="round"
          strokeDasharray={shaftLength}
          strokeDashoffset={shaftLength * (1 - drawn)}
        />
        <polygon
          points={`${width / 2 - headSize / 1.6},${shaftLength} ${width / 2 + headSize / 1.6},${shaftLength} ${width / 2},${length}`}
          fill={color}
          opacity={interpolate(drawn, [0.6, 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}
        />
      </svg>

      {label ? (
        <span
          style={{
            opacity: drawn,
            fontFamily: theme.type.body,
            fontSize: theme.type.size.label,
            fontWeight: 700,
            letterSpacing: theme.type.letterSpacing.label,
            textTransform: theme.type.labelTransform,
            color,
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
};
