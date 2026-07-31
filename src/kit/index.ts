/**
 * The kit, in three tiers.
 *
 * The old rule here was "if a video needs something the kit lacks, add it to
 * the kit first — never build anything in `projects`". Measured against what
 * actually got built, that rule failed in both directions at once: `Stage` and
 * `Beat` have 12 and 11 users, a scene core has 4-6 each, and TWENTY-PLUS
 * exports below have one or two — while every project separately defines 12 to
 * 43 local components anyway (flow-field: 43, in 1094 lines).
 *
 * So the rule pushed one-offs into shared code without preventing the bespoke
 * work, and the kit became a museum of single-user components that every future
 * session has to read past. See docs/DECISIONS.md#d011.
 *
 * The replacement is a tier and a rule of three:
 *
 *   FRAME      the shell every video sits in. Stable, high bar to change.
 *   PRIMITIVE  parameterised mechanisms — a thing you feed data, not a
 *              finished picture.
 *   NARROW     shared, but currently one or two videos use it. Do not extend
 *              these; if you need something adjacent, build it locally.
 *
 * **Bespoke scene composition belongs in `projects/<slug>/`, and that is not a
 * failure.** Promotion into this file requires a THIRD user, not a first. Two
 * videos wanting something similar is a coincidence; three is an abstraction.
 *
 * The layout law is not negotiable in any tier: no component hardcodes a visual
 * value, and nothing positions itself outside the content box.
 */

// --- FRAME -------------------------------------------------------------------
// Every video uses all of this. Changing it changes every video.

export { Stage, type StageProps } from './Stage';
export {
  Beat,
  Timeline,
  totalDuration,
  useBeat,
  useBeatProgress,
  useBeatSeconds,
  useBeatStart,
  type BeatTiming,
  type BeatProps,
} from './Beat';
export { useTheme } from './ThemeContext';
export { SPACE, space, PROFILES, DEFAULT_PROFILE, type Layout, type ProfileName } from './layout';
export { LayoutProvider, useLayout, useContentBox } from './LayoutProfile';
export { Music, pickEntry, type MusicSpec } from './Music';
export type { Phrase } from './captions/phrases';

// --- PRIMITIVE ---------------------------------------------------------------
// Mechanisms, not pictures. These take data and are meant to be reused.

export * from './scene';
export * from './scene3';
export { Split, type SplitProps } from './Split';
export { CodeReveal, type CodeRevealProps, type LineSpec } from './code/CodeReveal';
export { CodeDiff, type CodeDiffProps } from './code/CodeDiff';
export type { CodeLang } from './code/highlighter';
export { Callout, type CalloutProps, type CalloutTone } from './Callout';
export { Box, Row, Stack, type BoxProps, type BoxTone } from './Box';
export { TitleCard, type TitleCardProps } from './TitleCard';
export { Clip, Compare, Peel, type ClipProps, type CompareProps, type PeelProps } from './Clip';
export {
  ramp,
  useEnterStyle,
  useGestureStyle,
  useReveal,
  useStagger,
  type From,
  type Gesture,
  type GestureRole,
  type MotionPreset,
} from './motion';
export { rgba } from './color';

// --- NARROW ------------------------------------------------------------------
// One or two videos each. Kept because they work and because `projects/` is
// gitignored with no undo (docs/DECISIONS.md#d001), so evicting them would risk
// breaking shipped videos for no functional gain.
//
// Do NOT extend these, and do not reach for one because it is the closest thing
// on the shelf. If what you need is a variation, build it in the project.

export { Lanes, Ruler, type LanesProps, type Lane, type LaneTick, type LaneSpan, type RulerProps, type RulerTick } from './Lanes';
export { Arrow, type ArrowProps, type ArrowDirection } from './Arrow';
export { Versus, type VersusProps } from './Versus';
export { Board, Node, type NodeProps } from './Board';
