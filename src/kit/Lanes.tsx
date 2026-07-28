import React from 'react';
import { toneColor, type Tone } from './scene/draw';
import { useTheme } from './ThemeContext';

/** A single stamped event on a lane. */
export type LaneTick = {
  /** Position along the lane, 0..1. */
  readonly at: number;
  /**
   * `live` — this tick did work that mattered.
   * `idle` — it ran and produced the same answer as the one before it.
   *
   * The distinction is the whole point: a frequency argument is unwinnable on a
   * spatial diagram, because "sixty times a second" can only be pulsed and
   * hoped for. Here it is a row of marks you can count, and waste is a colour
   * rather than a claim.
   */
  readonly tone?: 'live' | 'idle';
  /** 0..1, for staggering marks in rather than having the row appear at once. */
  readonly opacity?: number;
};

/** A filled interval on a lane — work occupying time, rather than an instant. */
export type LaneSpan = {
  readonly from: number;
  readonly to: number;
  readonly tone?: Tone;
  readonly label?: string;
  readonly opacity?: number;
};

export type Lane = {
  /** Left-hand caption, e.g. `Update`. */
  readonly label?: string;
  /** Right-hand figure, e.g. `60 / s`. */
  readonly readout?: string;
  readonly ticks?: readonly LaneTick[];
  readonly spans?: readonly LaneSpan[];
  /**
   * How far behind this lane is, as a span in 0..1.
   *
   * Drawn as a bracket under the track, because staleness is a *duration* — the
   * gap between when something changed and when the answer caught up — and a
   * duration on a time axis is a length, not a number.
   */
  readonly lag?: { readonly from: number; readonly to: number; readonly note?: string } | null;
  readonly dim?: number;
};

export type LanesProps = {
  readonly lanes: readonly Lane[];
  /**
   * A vertical rule across every lane at 0..1, or null.
   *
   * This is what makes multiple lanes worth having: "the coroutine resumes on
   * the frame after the one that yielded" is a claim about two lanes at ONE
   * instant, and without a shared playhead the viewer has to measure it by eye.
   */
  readonly playhead?: number | null;
  /** Height of each lane's track in px. */
  readonly trackHeight?: number;
  readonly gap?: number;
  /**
   * Draws a backing panel behind the strip.
   *
   * Needed whenever lanes share the frame with a diagram: mono labels at label
   * size over a lit grid are unreadable, and the lanes are the register carrying
   * the argument at that moment, so they have to win.
   */
  readonly panel?: boolean;
  readonly dim?: number;
};

/**
 * Parallel time tracks: N rows, one mark or span per event, over a shared span
 * of time.
 *
 * Deliberately NOT in `scene/` — this is not world space. A scene is a place and
 * this is a clock, and the videos that argue about both stack them. That split
 * is what stops a grid being asked to carry a claim about frequency.
 *
 * Multiple lanes is the whole reason this is not just `Ruler`. Nearly every
 * timing argument in a game engine is a claim about **two clocks at once** —
 * `Update` against `FixedUpdate`, a coroutine against the frame that resumes it,
 * a job thread against the main thread waiting on it, physics against render.
 * One lane can only ever show a rate; two can show a relationship.
 *
 * Renders as a single SVG rather than a div per tick: sixty marks a second is
 * the cheap end of what this gets asked to draw, and a component that turns
 * every mark into a positioned DOM node stops being usable exactly when the
 * argument needs it most.
 */
export const Lanes: React.FC<LanesProps> = ({
  lanes,
  playhead = null,
  trackHeight = 92,
  gap = 26,
  panel = false,
  dim = 0,
}) => {
  const { colors, type, shape } = useTheme();

  // A viewBox in lane space keeps `at` a plain 0..1 and lets the strip be laid
  // out by its parent without every tick needing to know the pixel width.
  const W = 1000;
  const pad = 6;

  const tickColor = (t: LaneTick['tone']) => (t === 'idle' ? colors.textMuted : colors.accent);

  return (
    <div
      style={{
        width: '100%',
        opacity: 1 - dim,
        ...(panel
          ? {
              background: colors.surface,
              border: `${shape.borderWidth}px solid ${colors.border}`,
              borderRadius: shape.radiusSm,
              padding: '18px 24px',
            }
          : {}),
        position: 'relative',
      }}
    >
      {lanes.map((lane, li) => (
        <div
          key={li}
          style={{
            opacity: 1 - (lane.dim ?? 0),
            marginTop: li === 0 ? 0 : gap,
          }}
        >
          {lane.label || lane.readout ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontFamily: type.mono,
                fontSize: type.size.label,
                letterSpacing: type.letterSpacing.label,
                textTransform: type.labelTransform,
                color: colors.textMuted,
                marginBottom: 10,
              }}
            >
              <span>{lane.label}</span>
              <span style={{ color: colors.text }}>{lane.readout}</span>
            </div>
          ) : null}

          <svg
            viewBox={`0 0 ${W} ${trackHeight}`}
            width="100%"
            height={trackHeight}
            preserveAspectRatio="none"
            style={{ display: 'block', overflow: 'visible' }}
          >
            {/* The track itself — the span of time being described. */}
            <line
              x1={0}
              y1={trackHeight - pad}
              x2={W}
              y2={trackHeight - pad}
              stroke={colors.border}
              strokeWidth={shape.borderWidth * 2}
            />

            {(lane.spans ?? []).map((s, i) => (
              <rect
                key={`s${i}`}
                x={s.from * W}
                y={pad}
                width={Math.max(0, (s.to - s.from) * W)}
                height={trackHeight - pad * 2}
                fill={toneColor(colors, s.tone ?? 'accent')}
                opacity={(s.opacity ?? 1) * 0.34}
                rx={shape.radiusSm * 0.5}
              />
            ))}

            {(lane.ticks ?? []).map((t, i) => {
              const o = t.opacity ?? 1;
              if (o <= 0) {
                return null;
              }
              return (
                <line
                  key={`t${i}`}
                  x1={t.at * W}
                  y1={pad}
                  x2={t.at * W}
                  y2={trackHeight - pad}
                  stroke={tickColor(t.tone)}
                  strokeWidth={3}
                  opacity={o}
                  // The viewBox is stretched to the strip's width, which would
                  // otherwise smear every mark horizontally.
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {lane.lag ? (
              <g>
                <rect
                  x={lane.lag.from * W}
                  y={pad}
                  width={Math.max(0, (lane.lag.to - lane.lag.from) * W)}
                  height={trackHeight - pad * 2}
                  fill={colors.accentAlt}
                  opacity={0.22}
                />
                <line
                  x1={lane.lag.to * W}
                  y1={pad}
                  x2={lane.lag.to * W}
                  y2={trackHeight - pad}
                  stroke={colors.accentAlt}
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : null}
          </svg>

          {lane.lag?.note ? (
            <div
              style={{
                fontFamily: type.mono,
                fontSize: type.size.label * 0.9,
                color: colors.accentAlt,
                marginTop: 8,
                textAlign: 'right',
              }}
            >
              {lane.lag.note}
            </div>
          ) : null}
        </div>
      ))}

      {/*
        The playhead spans every lane, so it is drawn over the stack rather than
        inside any one of them — a rule that stops at a lane boundary cannot
        make a claim about two lanes at the same instant.
      */}
      {playhead !== null ? (
        <div
          style={{
            position: 'absolute',
            top: panel ? 18 : 0,
            bottom: panel ? 18 : 0,
            left: `calc(${panel ? '24px + ' : ''}${playhead} * (100% - ${panel ? 48 : 0}px))`,
            width: 3,
            background: colors.accentAlt,
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
};

export type RulerTick = LaneTick;

export type RulerProps = {
  readonly ticks: readonly RulerTick[];
  readonly label?: string;
  readonly readout?: string;
  readonly lag?: { readonly from: number; readonly to: number; readonly note?: string } | null;
  readonly dim?: number;
  readonly trackHeight?: number;
  readonly panel?: boolean;
};

/**
 * One lane. Kept as its own name because "a ruler" is what a single-rate
 * argument is, and `<Lanes lanes={[{...}]}/>` reads like a workaround at the
 * call site.
 */
export const Ruler: React.FC<RulerProps> = ({
  ticks,
  label,
  readout,
  lag = null,
  dim = 0,
  trackHeight = 92,
  panel = false,
}) => (
  <Lanes
    lanes={[{ ticks, label, readout, lag }]}
    trackHeight={trackHeight}
    panel={panel}
    dim={dim}
  />
);
