import React from 'react';
import { Graph, type GraphEdge, type GraphNode } from './Graph';
import type { Tone } from './draw';
import type { Vec2 } from './space';

export type FanoutNode = {
  readonly label: string;
  /** Centre of the node box, in world units. */
  readonly at: Vec2;
  readonly tone?: Tone;
  /** 0..1 reveal for the box and its label. */
  readonly opacity?: number;
};

export type FanoutProps = {
  /** The component every edge joins. */
  readonly source: {
    readonly label: string;
    readonly at: Vec2;
    readonly tone?: Tone;
    readonly opacity?: number;
  };
  readonly nodes: readonly FanoutNode[];
  /**
   * Which way the edges point, from `+1` (outward — the source calls each node,
   * so it must hold a reference to every one) to `-1` (inward — each node
   * subscribes, and the source knows none of them).
   */
  readonly direction?: number;
  /** Per-edge draw-on, 0..1, or one number for all of them. */
  readonly reveal?: readonly number[] | number;
  /**
   * A signal travelling every edge, 0..1 along its length, or null.
   *
   * Runs source-to-node regardless of `direction`: a subscribed listener still
   * receives the call, and animating the pulse backwards down an inbound edge
   * would say the opposite of what happens at runtime. `direction` is about who
   * holds the reference; the pulse is about who gets invoked.
   */
  readonly pulse?: number | null;
  readonly edgeTone?: Tone;
};

/**
 * One source and the things wired to it — a star, in explicit world positions.
 *
 * A thin arrangement over `<Graph>`, kept as its own name because the star case
 * is the common one and stating a hub plus its listeners is a great deal more
 * readable at the call site than hand-building a node list where every edge
 * repeats the same `from`.
 *
 * Positions are supplied rather than solved. A fan of four reads best arranged
 * by hand around the shape of the frame, and a ring solver would produce a worse
 * arrangement that is harder to override — for a hub-and-spokes picture the
 * arrangement IS part of the argument.
 */
export const Fanout: React.FC<FanoutProps> = ({
  source,
  nodes,
  direction = 1,
  reveal = 1,
  pulse = null,
  edgeTone = 'muted',
}) => {
  const revealAt = (i: number): number =>
    typeof reveal === 'number' ? reveal : (reveal[i] ?? 1);

  const graphNodes: GraphNode[] = [
    {
      id: '__source',
      label: source.label,
      at: source.at,
      tone: source.tone ?? 'accent',
      opacity: source.opacity ?? 1,
      active: true,
    },
    ...nodes.map((n, i) => ({
      id: `n${i}`,
      label: n.label,
      at: n.at,
      tone: n.tone,
      opacity: n.opacity ?? 1,
    })),
  ];

  const graphEdges: GraphEdge[] = nodes.map((_, i) => ({
    from: '__source',
    to: `n${i}`,
    reveal: revealAt(i),
  }));

  return (
    <Graph
      nodes={graphNodes}
      edges={graphEdges}
      layout={{ kind: 'free' }}
      direction={direction}
      pulse={pulse}
      edgeTone={edgeTone}
    />
  );
};
