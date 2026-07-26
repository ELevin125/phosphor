/**
 * The complete set of components a video may use.
 *
 * If a video needs something that isn't exported here, add it to the kit
 * first — never position or style anything inside `projects`.
 */

export { Stage, type StageProps } from './Stage';
export { Beat, Timeline, totalDuration, useBeat, useBeatStart, type BeatTiming, type BeatProps } from './Beat';
export { Board, Node, type NodeProps } from './Board';

export { TitleCard, type TitleCardProps } from './TitleCard';
export { CodeReveal, type CodeRevealProps, type LineSpec } from './code/CodeReveal';
export { CodeDiff, type CodeDiffProps } from './code/CodeDiff';
export { Callout, type CalloutProps, type CalloutTone } from './Callout';
export { Arrow, type ArrowProps, type ArrowDirection } from './Arrow';
export { Box, Row, Stack, type BoxProps, type BoxTone } from './Box';
export { Clip, Compare, Peel, type ClipProps, type CompareProps, type PeelProps } from './Clip';
export { Music, pickEntry, type MusicSpec } from './Music';

export * from './scene';

export { useTheme } from './ThemeContext';
export {
  useEnterStyle,
  useGestureStyle,
  useReveal,
  useStagger,
  type From,
  type Gesture,
  type GestureRole,
  type MotionPreset,
} from './motion';

export { CANVAS, CONTENT, SAFE, CAPTION_BAND, GUTTER, SPACE, space } from './layout';
export type { CodeLang } from './code/highlighter';
export type { Phrase } from './captions/phrases';
