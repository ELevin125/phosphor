import React, { createContext, useContext } from 'react';
import { AbsoluteFill } from 'remotion';

import { useContentBox } from '../LayoutProfile';
import { makeSpace, type Space, type World } from './space';

const SpaceContext = createContext<Space | null>(null);

/** The space, or null outside a scene. For components that work in both. */
export const useSpaceOrNull = (): Space | null => useContext(SpaceContext);

export const useSpace = (): Space => {
  const space = useContext(SpaceContext);
  if (!space) {
    throw new Error('Scene drawables must be rendered inside a <Scene>.');
  }
  return space;
};

export type SceneProps = {
  /** The rectangle of world space to show. */
  readonly world: World;
  readonly children: React.ReactNode;
};

/**
 * A drawing surface in world units.
 *
 * The scene fills the legal content box, so a video never positions it. Its
 * children are drawables (`Dot`, `Vec`, `Trail`…) and annotations (`Tag`,
 * `Readout`, `CodeTag`) that place themselves from world coordinates.
 *
 * Every drawable renders its own absolutely-positioned layer rather than
 * sharing one `<svg>`. That costs a few extra nodes and buys ordinary DOM
 * z-ordering, so "draw the trail behind the dot" is just "write it first" —
 * and it lets HTML annotations and SVG geometry interleave freely, which one
 * shared `<svg>` would not allow without `foreignObject`.
 */
/**
 * Height reserved at the bottom of the content box by a `<Split>`.
 *
 * A scene sizes itself from the layout law rather than from its parent, so a
 * strip sharing the frame with it cannot simply be a sibling in a flex column —
 * the scene would draw straight through it. `<Split>` publishes the reserved
 * height here and the scene shortens itself by it.
 */
export const SceneInset = createContext<{ readonly bottom: number }>({ bottom: 0 });

/**
 * An exact height handed down by a parent that has already subdivided the frame
 * — currently `<Versus>`, which gives each half a fixed pane.
 *
 * Kept here beside `SceneInset` so every rule about how tall a scene gets lives
 * in one file. It overrides rather than adjusts: `SceneInset` says "the content
 * box, less this much", which is still relative to the layout law, whereas a
 * pane's height has already been decided and any further arithmetic against
 * `CONTENT` would just undo it.
 */
export const SceneHeight = createContext<number | null>(null);

export const Scene: React.FC<SceneProps> = ({ world, children }) => {
  const { bottom: inset } = useContext(SceneInset);
  const fixed = useContext(SceneHeight);
  const box = useContentBox();
  const width = box.width;
  const height = fixed ?? box.height - inset;
  const space = makeSpace(world, width, height);

  /*
    Positioned at 0,0 — NOT at CONTENT.top/left.

    A Scene always lives inside a <Beat> (or a board <Node>), and those have
    already placed themselves at the content box. Offsetting again pushed the
    whole diagram 230px down, which put the bottom of every scene inside the
    caption band and behind the captions. It only takes the content box's SIZE
    from the layout law; its position comes from its parent.
  */
  return (
    <AbsoluteFill style={{ top: 0, left: 0, width, height }}>
      <SpaceContext.Provider value={space}>{children}</SpaceContext.Provider>
    </AbsoluteFill>
  );
};

/** A full-scene SVG layer. Drawables use this so they all share one convention. */
export const Layer: React.FC<{
  readonly children: React.ReactNode;
  readonly opacity?: number;
}> = ({ children, opacity }) => {
  const space = useSpace();
  return (
    <svg
      width={space.width}
      height={space.height}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity }}
      aria-hidden
    >
      {children}
    </svg>
  );
};
