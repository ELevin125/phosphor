import React, { useContext } from 'react';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop } from './Backdrop';
import { BeatProvider, type BeatTiming } from './Beat';
import { useContentBox } from './LayoutProfile';
import { quantise } from './motion';
import { useTheme } from './ThemeContext';

/**
 * Gap between board cells, in px.
 *
 * Wide enough that two cells are never mistaken for one layout, narrow enough
 * that the neighbouring cell is visibly there at the edge of frame mid-move —
 * which is the entire point of the board.
 */
const BOARD_GAP = 100;

export type NodeProps = {
  /** Must match a beat id. The camera flies here when that beat starts. */
  readonly id: string;
  /** Cell coordinates on the board. Negative values are fine. */
  readonly col: number;
  readonly row: number;
  /**
   * Camera zoom while this node is focused. `1` fills the frame with the cell;
   * `0.5` pulls back far enough to hold this cell and its neighbours at once —
   * use it for the payoff shot where the whole board is the point.
   */
  readonly zoom?: number;
  readonly children: React.ReactNode;
};

/**
 * One cell of the board. A marker component: `<Board>` reads its props and does
 * the positioning, so nothing is ever placed by hand in a video file.
 */
export const Node: React.FC<NodeProps> = ({ children }) => <>{children}</>;

const isNode = (c: React.ReactNode): c is React.ReactElement<NodeProps> =>
  React.isValidElement(c);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export type BoardProps = {
  readonly beats: readonly BeatTiming[];
  readonly children: React.ReactNode;
};

/**
 * The spatial alternative to `<Timeline>`.
 *
 * Instead of each beat replacing the last full-screen, every beat owns a cell
 * on one large board and the camera flies between them. Content that has
 * already appeared stays where it was put, dimmed, so the video accumulates a
 * structure the viewer can see rather than a sequence of slides they have to
 * remember.
 *
 * That difference is the whole reason this exists: a stack of beats always
 * reads as a presentation, because "replace everything, then replace it again"
 * is what a presentation *is*. A camera move implies the two things are
 * related and near each other, which is usually the actual claim being made.
 *
 * Board lives OUTSIDE any `<Sequence>` so `useCurrentFrame()` here is the
 * composition frame — the camera has to know about beats it is not inside.
 */
export const Board: React.FC<BoardProps> = ({ beats, children }) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const frame = quantise(useCurrentFrame(), theme.motion.stepFrames);

  const box = useContentBox();
  const { width, height } = box;

  const starts = new Map<string, number>();
  let offset = 0;
  for (const beat of beats) {
    starts.set(beat.id, offset);
    offset += beat.durationInFrames;
  }

  const nodes = React.Children.toArray(children)
    .filter(isNode)
    .map((child) => {
      const start = starts.get(child.props.id);
      if (start === undefined) {
        throw new Error(
          `<Node id="${child.props.id}"> has no matching beat. Add it to beats.yaml and re-run 'npm run build-beats'.`,
        );
      }
      const beat = beats.find((b) => b.id === child.props.id);
      return {
        ...child.props,
        start,
        duration: beat?.durationInFrames ?? 0,
        key: child.key ?? child.props.id,
      };
    })
    .sort((a, b) => a.start - b.start);

  const first = nodes[0];
  if (!first) {
    return null;
  }

  const centreOf = (n: { col: number; row: number }) => ({
    x: n.col * (width + BOARD_GAP) + width / 2,
    y: n.row * (height + BOARD_GAP) + height / 2,
  });

  // The last node whose beat has begun is the one the camera is on.
  let current = first;
  let previous = first;
  for (const n of nodes) {
    if (frame >= n.start && n.start >= current.start) {
      previous = current;
      current = n;
    }
  }

  // One spring per move, restarted at each beat boundary. Overshoot in the
  // camera preset is what makes the move feel like a game camera catching up
  // with a target rather than a slide easing across.
  const travel = spring({
    frame: frame - current.start,
    fps,
    durationInFrames: theme.motion.camera.durationInFrames,
    config: {
      damping: theme.motion.camera.damping,
      mass: theme.motion.camera.mass,
      stiffness: theme.motion.camera.stiffness,
      overshootClamping: theme.motion.camera.overshootClamping,
    },
  });

  const from = centreOf(previous);
  const to = centreOf(current);
  const camX = lerp(from.x, to.x, travel);
  const camY = lerp(from.y, to.y, travel);
  const zoom = lerp(previous.zoom ?? 1, current.zoom ?? 1, travel);
  const { stars } = theme.backdrop;

  return (
    <>
      {/*
        The board owns its own backdrop, because the backdrop has to know where
        the camera is. Stars drift against the camera at a fraction of its
        speed, which is the only thing that makes a pan read as depth instead
        of as the content sliding across a still image.
      */}
      <Backdrop starOffset={{ x: -camX * stars.parallax, y: -camY * stars.parallax }} />

      <AbsoluteFill
        style={{
          top: box.top,
          left: box.left,
          width,
          height,
          /*
            Clipped to the content box, which is the whole reason the layout law
            exists. Without this the cell above the camera hangs down into the
            caption band mid-move and captions render on top of it. The clip
            edge reads as a viewport looking onto a larger board — which is
            what it is — rather than as content being cut off.
          */
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${width / 2}px, ${height / 2}px) scale(${zoom}) translate(${-camX}px, ${-camY}px)`,
            transformOrigin: '0 0',
          }}
        >
          {nodes.map((n) => {
            const focused = n.id === current.id;
            return (
              <Sequence key={n.key} name={n.id} from={n.start} layout="none">
                <div
                  style={{
                    position: 'absolute',
                    left: n.col * (width + BOARD_GAP),
                    top: n.row * (height + BOARD_GAP),
                    width,
                    height,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 32,
                    // Everything already said stays legible but stops
                    // competing. Reuses the same token that dims inactive code
                    // lines, so a theme only tunes "de-emphasised" in one place.
                    opacity: focused ? 1 : theme.colors.dimOpacity,
                  }}
                >
                  {/*
                    Nodes are not inside a <Beat>, but components still need to
                    know how long their beat lasts. Overlap is zero here: the
                    board never cross-fades, it moves.
                  */}
                  <BeatProvider
                    value={{ id: n.id, durationInFrames: n.duration, overlap: 0, start: n.start }}
                  >
                    {n.children}
                  </BeatProvider>
                </div>
              </Sequence>
            );
          })}
        </div>
      </AbsoluteFill>
    </>
  );
};
