import React, { useContext } from 'react';
import { CAPTION_BAND_BOTTOM, CONTENT } from './layout';
import { LayoutContext } from './Beat';
import { SceneHeight } from './scene/Scene';
import { useTheme } from './ThemeContext';

export type VersusProps = {
  readonly top: React.ReactNode;
  readonly bottom: React.ReactNode;
  readonly topLabel?: string;
  readonly bottomLabel?: string;
  readonly gap?: number;
  /** 0..1 — the lower half wipes up into place. 1 shows both immediately. */
  readonly reveal?: number;
  readonly dimTop?: number;
  readonly dimBottom?: number;
};

/**
 * Two halves of the frame running the same thing two ways.
 *
 * The layout behind every "these two behave differently" claim — with and
 * without hitstop, `Lerp` against `SmoothDamp`, a flow field against per-agent
 * A*, encirclement against a queue. It is stacked rather than side by side
 * because the frame is 1080x1920: two columns give each version a 432px-wide
 * strip, which is narrower than most things worth comparing.
 *
 * The difference from `Compare` is what goes inside. `Compare` takes two clips
 * and frames them as two panels being presented. `Versus` takes arbitrary
 * children — two scenes, two sims, two clips — so the comparison can be *live*
 * rather than pre-rendered. That matters: the honest way to show that two
 * systems diverge is to run both and let them, and a hand-animated divergence
 * is an assertion with extra steps.
 *
 * Labels sit inside each half rather than on the seam, because unlike `Peel`
 * these are two separate pictures rather than one picture with its skin pulled
 * back, and a label on the seam would belong to neither.
 */
export const Versus: React.FC<VersusProps> = ({
  top,
  bottom,
  topLabel,
  bottomLabel,
  gap = 28,
  reveal = 1,
  dimTop = 0,
  dimBottom = 0,
}) => {
  const { colors, type, shape } = useTheme();
  const { captionBand } = useContext(LayoutContext);

  const full = (captionBand ? CONTENT.bottom : CAPTION_BAND_BOTTOM) - CONTENT.top;
  const half = (full - gap) / 2;

  const chip = (text: string, color: string): React.ReactNode => (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 2,
        padding: '8px 18px',
        borderRadius: shape.radiusSm,
        background: colors.bg,
        border: `${shape.borderWidth}px solid ${color}`,
        color,
        fontFamily: type.mono,
        fontSize: type.size.label,
        fontWeight: type.weightMono,
        letterSpacing: type.letterSpacing.label,
        textTransform: type.labelTransform,
      }}
    >
      {text}
    </div>
  );

  const pane = (
    y: number,
    body: React.ReactNode,
    label: string | undefined,
    color: string,
    dim: number,
    clip?: string,
  ): React.ReactNode => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        height: half,
        opacity: 1 - dim,
        clipPath: clip,
      }}
    >
      {label ? chip(label, color) : null}
      {/*
        Each half publishes its own height so a `Scene` inside takes the pane's
        size rather than the content box's. Without it both scenes would draw at
        full height and overlap into one another, which looks like a z-order bug
        rather than a layout one and is correspondingly confusing to debug.
      */}
      <SceneHeight.Provider value={half}>{body}</SceneHeight.Provider>
    </div>
  );

  return (
    <>
      {pane(0, top, topLabel, colors.accent, dimTop)}
      {pane(
        half + gap,
        bottom,
        bottomLabel,
        colors.accentAlt,
        dimBottom,
        // Clipped from the bottom so the lower half grows down out of the gap.
        // Clipping from the top makes it grow up off the frame edge instead,
        // leaving a widening hole that reads as a loading error.
        reveal < 1 ? `inset(0 0 ${(1 - reveal) * 100}% 0)` : undefined,
      )}
    </>
  );
};
