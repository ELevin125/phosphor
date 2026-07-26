/** World-space scene system: the scene-first alternative to stacked panels. */

export { Scene, Layer, useSpace, type SceneProps } from './Scene';
export { makeSpace, type Vec2, type World, type Space } from './space';
export { useSim, useSimHistory, type SimSpec } from './useSim';
export { Field, type FieldProps, type FieldArrow } from './Field';
export {
  Grid,
  Dot,
  Trail,
  Vec,
  Measure,
  useTone,
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
