/** World-space scene system: the scene-first alternative to stacked panels. */

export {
  Scene,
  Layer,
  useSpace,
  useSpaceOrNull,
  SceneInset,
  SceneHeight,
  type SceneProps,
} from './Scene';
export { makeSpace, type Vec2, type World, type Space } from './space';
export { useSim, useSimHistory, type SimSpec } from './useSim';
export { Field, type FieldProps, type FieldArrow } from './Field';
export { Strip, type StripProps, type StripCell, type StripPointer } from './Strip';
export { Plot, type PlotProps, type PlotCurve, type PlotPoint } from './Plot';
export { Fanout, type FanoutProps, type FanoutNode } from './Fanout';
export {
  Graph,
  type GraphProps,
  type GraphNode,
  type GraphEdge,
  type GraphLayout,
} from './Graph';
export {
  Grid,
  Dot,
  Trail,
  Vec,
  Measure,
  useTone,
  toneColor,
  type Tone,
  type DotProps,
  type TrailProps,
  type VecProps,
  type MeasureProps,
} from './draw';
export {
  Tag,
  Readout,
  CodeTag,
  Statement,
  type Anchor,
  type TagProps,
  type ReadoutProps,
  type CodeTagProps,
  type StatementProps,
} from './annotate';
