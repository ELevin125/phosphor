import React from 'react';
import { useContentBox } from './LayoutProfile';
import { SceneInset } from './scene/Scene';

export type SplitProps = {
  /** The strip pinned to the bottom of the content box. */
  readonly strip: React.ReactNode;
  readonly stripHeight?: number;
  /** Space between the main area and the strip. */
  readonly gap?: number;
  /** The main area — usually a `<Scene>`. */
  readonly children: React.ReactNode;
};

/**
 * Divides the content box into a main area and a strip beneath it.
 *
 * Exists for videos that argue about a *place* and a *rate* at the same time. A
 * grid cannot show "sixty times a second" — it can only pulse and hope you
 * count — so the frequency half of the argument needs its own picture, and the
 * two have to be on screen together for a claim like "each crossing fires
 * exactly one rebuild" to be visible rather than asserted.
 *
 * The strip cannot simply be a sibling in a flex column, because a `<Scene>`
 * takes its size from the layout law rather than from its parent and would draw
 * straight through it. So the reserved height is published on `SceneInset` and
 * the scene shortens itself by it — which also means a scene's world units stay
 * meaningful, just mapped into a shorter box.
 *
 * This is the one sanctioned way to subdivide the content box. Positioning a
 * strip by hand inside a video file is the thing the layout law exists to stop.
 */
export const Split: React.FC<SplitProps> = ({
  strip,
  stripHeight = 260,
  gap = 36,
  children,
}) => {
  const full = useContentBox().height;

  return (
    <SceneInset.Provider value={{ bottom: stripHeight + gap }}>
      {/*
        Children are wrapped in a box of the reduced height rather than left
        loose. A `<Scene>` shortens itself from the context above, but anything
        else a beat overlays on it — a floor grid, a scrim — is positioned
        `inset: 0` against its nearest positioned ancestor, and without this it
        would stretch over the strip and sit on top of the labels.
      */}
      <div style={{ position: 'absolute', inset: 0, height: full - stripHeight - gap }}>
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: full - stripHeight,
          height: stripHeight,
        }}
      >
        {strip}
      </div>
    </SceneInset.Provider>
  );
};
