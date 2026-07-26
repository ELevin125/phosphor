import React from 'react';
import { useTheme } from '../ThemeContext';
import { highlight, type CodeLang } from '../code/highlighter';
import { useTone, type Tone } from './draw';
import { Layer, useSpace, useSpaceOrNull } from './Scene';
import type { Vec2 } from './space';

export type Anchor = 'above' | 'below' | 'left' | 'right';

const anchorTransform = (anchor: Anchor): string => {
  switch (anchor) {
    case 'above':
      return 'translate(-50%, -100%)';
    case 'below':
      return 'translate(-50%, 0)';
    case 'left':
      return 'translate(-100%, -50%)';
    case 'right':
      return 'translate(0, -50%)';
  }
};

export type TagProps = {
  /** World point the label belongs to. It follows, every frame. */
  readonly at: Vec2;
  readonly anchor?: Anchor;
  /** Gap between the point and the label, in px. */
  readonly gap?: number;
  readonly tone?: Tone;
  readonly children: React.ReactNode;
  readonly opacity?: number;
  /** Renders in the mono face — for identifiers and values. */
  readonly mono?: boolean;
};

/**
 * A label stuck to a world point.
 *
 * The difference between this and a caption in a box is that a Tag MOVES with
 * the thing it names. A viewer never has to work out which object "the slow
 * one" refers to, because the words are travelling with it. That single
 * property removes most of the need for panels.
 */
export const Tag: React.FC<TagProps> = ({
  at,
  anchor = 'above',
  gap,
  tone = 'text',
  children,
  opacity = 1,
  mono = false,
}) => {
  const theme = useTheme();
  const { draw, type, colors } = theme;
  const space = useSpace();
  const color = useTone(tone);
  const p = space.project(at);
  const g = gap ?? draw.dotRadius * 1.8;

  const dx = anchor === 'left' ? -g : anchor === 'right' ? g : 0;
  const dy = anchor === 'above' ? -g : anchor === 'below' ? g : 0;

  const boxed = draw.tagStyle === 'boxed';
  const bracket = draw.tagStyle === 'bracket';

  return (
    <>
      {/* A leader line, so a label placed clear of the action still reads as
          belonging to its point rather than floating near it. */}
      {bracket ? (
        <Layer opacity={opacity}>
          <line
            x1={p.x}
            y1={p.y}
            x2={p.x + dx}
            y2={p.y + dy}
            stroke={color}
            strokeWidth={draw.strokeWidth}
            opacity={0.6}
          />
        </Layer>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: p.x + dx,
          top: p.y + dy,
          transform: anchorTransform(anchor),
          opacity,
          fontFamily: mono ? type.mono : type.body,
          fontSize: type.size.label,
          fontWeight: mono ? type.weightMono : 700,
          letterSpacing: type.letterSpacing.label,
          textTransform: type.labelTransform,
          color,
          whiteSpace: 'nowrap',
          background: boxed ? colors.bgAlt : 'transparent',
          border: bracket ? `${draw.strokeWidth}px solid ${color}` : 'none',
          borderWidth: bracket ? `0 0 ${draw.strokeWidth}px 0` : undefined,
          padding: boxed ? '6px 14px' : bracket ? '0 0 4px 0' : 0,
          borderRadius: boxed ? theme.shape.radiusSm : 0,
        }}
      >
        {children}
      </div>
    </>
  );
};

export type ReadoutProps = {
  readonly at: Vec2;
  readonly value: number;
  /** Decimal places. */
  readonly digits?: number;
  readonly unit?: string;
  readonly label?: string;
  readonly tone?: Tone;
  readonly anchor?: Anchor;
};

/**
 * A live number attached to a point.
 *
 * Tabular figures are not optional here: with proportional digits the readout
 * changes width as it counts and jitters horizontally, which draws the eye to
 * the wrong thing entirely.
 */
export const Readout: React.FC<ReadoutProps> = ({
  at,
  value,
  digits = 2,
  unit,
  label,
  tone = 'accent',
  anchor = 'right',
}) => {
  const { type } = useTheme();
  const color = useTone(tone);

  return (
    <Tag at={at} anchor={anchor} tone={tone} mono>
      <span style={{ fontVariantNumeric: 'tabular-nums', color }}>
        {label ? (
          <span style={{ opacity: 0.7, marginRight: 10, fontSize: type.size.label * 0.9 }}>
            {label}
          </span>
        ) : null}
        {value.toFixed(digits)}
        {unit ? <span style={{ opacity: 0.7 }}>{unit}</span> : null}
      </span>
    </Tag>
  );
};

export type StatementProps = {
  readonly children: React.ReactNode;
  /** World point to hang it from. Defaults to the middle of the scene. */
  readonly at?: Vec2;
  readonly tone?: Tone;
  readonly opacity?: number;
};

/**
 * The one line worth remembering, set as type rather than as a component.
 *
 * The scene-first replacement for `Callout`. A Callout wraps the sentence in a
 * bordered panel with an accent bar and a shadow, which is three pieces of
 * chrome asserting "this is important" around a sentence that already says so.
 * Here the words are the graphic: display face, large, sitting directly in the
 * scene next to whatever it is a statement about.
 */
export const Statement: React.FC<StatementProps> = ({
  children,
  at,
  tone = 'text',
  opacity = 1,
}) => {
  const { type } = useTheme();
  // Usable outside a scene: a statement is just type, and a footage-led video
  // wants one at the bottom without inventing a scene to hang it in. Without a
  // space it lays out in normal flow instead of positioning absolutely.
  const space = useSpaceOrNull();
  const color = useTone(tone);
  const p = space && at ? space.project(at) : null;

  return (
    <div
      style={{
        ...(space
          ? {
              position: 'absolute' as const,
              left: p ? p.x : space.width / 2,
              top: p ? p.y : space.height / 2,
              transform: 'translate(-50%, -50%)',
              width: space.width,
            }
          : { width: '100%' }),
        opacity,
        textAlign: 'center',
        fontFamily: type.display,
        fontSize: type.size.heading,
        fontWeight: type.weightDisplay,
        lineHeight: type.lineHeight.tight,
        letterSpacing: type.letterSpacing.display,
        color,
        textWrap: 'balance',
      }}
    >
      {children}
    </div>
  );
};

export type CodeTagProps = {
  /** One line of code. Not a file — if you need a file, use `CodeReveal`. */
  readonly code: string;
  readonly lang?: CodeLang;
  /** Anchored to a world point, or floated at the bottom of the scene. */
  readonly at?: Vec2;
  readonly anchor?: Anchor;
  /** Substring to spotlight — the token the whole video is about. */
  readonly emphasise?: string;
  readonly opacity?: number;
};

/**
 * A single line of code as an annotation on the scene.
 *
 * Deliberately not a panel: no titlebar, no line numbers, no chrome. The line
 * sits next to the thing it governs, so the viewer reads code and behaviour in
 * one glance instead of mapping between a slab of source and a picture of its
 * result. Anything longer than a line or two belongs in `CodeReveal`, and
 * needing `CodeReveal` in a scene-first video is usually a sign the beat is
 * carrying too much.
 */
export const CodeTag: React.FC<CodeTagProps> = ({
  code,
  lang = 'csharp',
  at,
  anchor = 'below',
  emphasise,
  opacity = 1,
}) => {
  const theme = useTheme();
  const { type, colors, shape, draw } = theme;
  const space = useSpace();
  const lines = highlight(code.trim(), lang, theme.shikiTheme);
  const tokens = lines[0]?.tokens ?? [];

  const p = at
    ? space.project(at)
    : { x: space.width / 2, y: space.height - draw.dotRadius * 2 };
  const transform = at ? anchorTransform(anchor) : 'translate(-50%, -100%)';

  /*
    Shrink to fit the scene rather than clipping.
    `1f - Mathf.Exp(-k * Time.deltaTime)` is 60-odd characters, which overruns
    1080px at any comfortable code size — and a truncated line of code is worse
    than a small one, because the part that falls off the edge is invariably
    the part the video is about. 0.6em is the advance width of every mono face
    the themes use.
  */
  const PADDING_X = 52;
  const natural = code.trim().length * type.size.code * 0.6 + PADDING_X;
  const fontSize =
    natural > space.width
      ? Math.max(20, ((space.width - PADDING_X) / (code.trim().length * 0.6)))
      : type.size.code;

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x,
        top: p.y,
        transform,
        opacity,
        fontFamily: type.mono,
        fontSize,
        fontWeight: type.weightMono,
        lineHeight: 1.4,
        whiteSpace: 'pre',
        background: colors.codeBg,
        padding: '14px 26px',
        borderRadius: shape.radiusSm,
        border: `${shape.borderWidth}px solid ${colors.border}`,
      }}
    >
      {tokens.map((token, i) => {
        const hit = emphasise !== undefined && token.content.includes(emphasise);
        return (
          <span
            key={i}
            style={{
              color: token.color,
              // The emphasised token keeps its syntax colour and gains a
              // highlight behind it. Recolouring it would fight the reader's
              // expectation of what that colour means.
              background: hit ? colors.highlightBg : undefined,
              boxShadow: hit ? `0 0 0 6px ${colors.highlightBg}` : undefined,
              borderRadius: hit ? 3 : undefined,
            }}
          >
            {token.content}
          </span>
        );
      })}
    </div>
  );
};
