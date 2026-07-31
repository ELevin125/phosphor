import React, { useLayoutEffect } from 'react';
import { continueRender, delayRender } from 'remotion';

/**
 * Measures what actually landed on screen and prints it for `npm run check`.
 *
 * This exists so that "does the text fit / is anything in the safe area / did
 * two things collide" stops being a question answered by rendering a PNG and
 * looking at it. Those are geometry, and geometry is cheap to check exactly and
 * expensive to check by eye — a contact sheet samples 12 frames of a 5-minute
 * video, which is one every 25 seconds. See docs/DECISIONS.md#d009.
 *
 * It runs only when the composition is given `measure: true`, so nothing here
 * touches a normal render.
 *
 * The channel back to node is `console.log`, which `renderStill` surfaces via
 * `onBrowserLog`. That is a public, supported API and it avoids reaching into
 * Remotion's internals for a page handle.
 */

/** One measured element. Coordinates are canvas pixels. */
export type ProbeBox = {
  /** Trimmed text content, or a tag description for non-text ink. */
  readonly label: string;
  /** `caption` when inside the caption band subtree, else `content`. */
  readonly role: 'caption' | 'content';
  /** The beat this element is inside, when it is inside one. */
  readonly beat: string | null;
  /**
   * What sort of ink this is.
   *
   * `text` is held to the full layout law — it is what gets clipped, what
   * collides, and what the content box exists to protect. `graphic` is scene
   * geometry, which `Scene3D` draws with `overflow: visible` on purpose; a
   * wireframe edge a few pixels past the gutter is not the same failure as a
   * code panel hanging off the frame, so it is only checked against the things
   * that genuinely destroy it — the canvas edge and the platform chrome.
   */
  readonly ink: 'text' | 'graphic';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Depth in the DOM, used to skip ancestor/descendant overlap pairs. */
  readonly depth: number;
  /**
   * Computed opacity. The collision rule needs it: a `CodeDiff` cross-fade
   * stacks the before and after lines in the same place on purpose, and while
   * both are part-transparent that is a transition, not a bug.
   */
  readonly opacity: number;
};

export const PROBE_PREFIX = 'PHOSPHOR_PROBE ';

/**
 * True when the element paints something the viewer can see.
 *
 * Layout wrappers are excluded deliberately: an `AbsoluteFill` covers the whole
 * frame by design, and reporting it as "outside the content box" every single
 * frame would bury the real findings. What counts as ink is a direct text node,
 * or a leaf that draws its own graphics.
 */
const inkOf = (el: Element): 'text' | 'graphic' | null => {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && (node.textContent ?? '').trim().length > 0) {
      return 'text';
    }
  }
  const tag = el.tagName.toLowerCase();
  if (tag === 'img' || tag === 'canvas' || tag === 'video') {
    return 'graphic';
  }
  // SVG shapes, but not the <svg> wrapper, which is usually a full-frame layer.
  if (['path', 'rect', 'circle', 'line', 'polygon', 'polyline', 'ellipse', 'text'].includes(tag)) {
    return 'graphic';
  }
  return null;
};

const describe = (el: Element): string => {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text.length > 0) {
    return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  return `<${el.tagName.toLowerCase()}>`;
};

const depthOf = (el: Element): number => {
  let d = 0;
  let cur: Element | null = el.parentElement;
  while (cur) {
    d += 1;
    cur = cur.parentElement;
  }
  return d;
};

const measure = (): ProbeBox[] => {
  const out: ProbeBox[] = [];
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const ink = inkOf(el);
    if (!ink) {
      continue;
    }
    // Decoration is randomised, may not render, and by rule carries no meaning
    // the viewer needs — so it is exempt from the layout law rather than
    // reported as breaking it every frame.
    if (el.closest('[data-phosphor="decor"]')) {
      continue;
    }
    const style = window.getComputedStyle(el);
    // Invisible ink is not ink. Fades legitimately pass through opacity 0 at a
    // beat boundary, and flagging those would make every transition a finding.
    const own = Number(style.opacity);
    if (style.display === 'none' || style.visibility === 'hidden' || own < 0.06) {
      continue;
    }

    /*
      Opacity is inherited multiplicatively down the tree, and the value that
      matters is what the viewer sees. A line at opacity 1 inside a panel fading
      at 0.4 is 40% visible, and treating it as fully opaque is what would make
      every cross-fade look like a collision.
    */
    let effective = own;
    let parent: Element | null = el.parentElement;
    while (parent) {
      effective *= Number(window.getComputedStyle(parent).opacity);
      parent = parent.parentElement;
    }
    if (effective < 0.06) {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
      continue;
    }
    out.push({
      label: describe(el),
      role: el.closest('[data-phosphor="caption"]') ? 'caption' : 'content',
      beat: el.closest('[data-phosphor-beat]')?.getAttribute('data-phosphor-beat') ?? null,
      ink,
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
      depth: depthOf(el),
      opacity: Number(effective.toFixed(3)),
    });
  }
  return out;
};

export const Probe: React.FC = () => {
  useLayoutEffect(() => {
    /*
      The still is not captured until every delayRender is resolved, so holding
      one here guarantees the measurement happens against the finished frame
      rather than a partially laid-out one.
    */
    const handle = delayRender('phosphor probe');
    // Two frames of slack so web fonts have swapped in. Measuring mid-swap
    // reports fallback-font widths, which are wrong in exactly the direction
    // that hides real overflow.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          console.log(PROBE_PREFIX + JSON.stringify(measure()));
        } finally {
          continueRender(handle);
        }
      });
    });
    return () => {
      continueRender(handle);
    };
  }, []);

  return null;
};
