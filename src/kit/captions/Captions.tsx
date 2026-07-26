import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTION_BAND, CAPTION_BAND_TOP, GUTTER, CANVAS } from '../layout';
import { useTheme } from '../ThemeContext';
import type { Phrase } from './phrases';

/**
 * Burned-in captions, locked to the reserved band.
 *
 * The band is the ONLY place captions may render, and nothing else may render
 * inside it — that contract is what stops captions landing on top of code.
 */
export const Captions: React.FC<{ readonly phrases: readonly Phrase[] }> = ({
  phrases,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const nowMs = (frame / fps) * 1000;

  const active = phrases.find((p) => nowMs >= p.startMs && nowMs < p.endMs);
  if (!active) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: CAPTION_BAND_TOP,
        left: GUTTER,
        width: CANVAS.width - GUTTER * 2,
        height: CAPTION_BAND.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: theme.type.body,
          fontSize: theme.type.size.caption,
          fontWeight: theme.captions.weight,
          lineHeight: 1.18,
          color: theme.captions.color,
          background: theme.captions.bg,
          /*
            A bordered panel rather than a tint behind the words. The band sits
            directly under a busy diagram, and a translucent wash reads as part
            of the scene — the border is what makes it a separate surface the
            text belongs to. Taken from the theme's own shape tokens so every
            theme keeps its own corner and hairline treatment.
          */
          border: `${theme.shape.borderWidth}px solid ${theme.colors.border}`,
          borderRadius: theme.captions.radius,
          padding: `${theme.captions.paddingY + 8}px ${theme.captions.paddingX + 12}px`,
          boxShadow: theme.shape.shadow,
          letterSpacing: theme.captions.letterSpacing,
          textTransform: theme.captions.textTransform,
          textShadow: theme.captions.textShadow,
          textAlign: 'center',
          textWrap: 'balance',
          maxWidth: '100%',
        }}
      >
        {active.text}
      </div>
    </div>
  );
};
