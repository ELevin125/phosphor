import { describe, expect, it } from 'vitest';
import { makeSpace } from './space';

/**
 * The world-to-pixel mapping every scene is drawn through. A bug here does not
 * crash — it produces a picture that is subtly wrong about the thing being
 * explained, which is the worst failure this project has.
 */
describe('makeSpace', () => {
  const unitWorld = { x: [0, 10] as const, y: [0, 10] as const };

  it('puts world origin at the bottom-left, because y points up', () => {
    const s = makeSpace(unitWorld, 100, 100);
    // World (0,0) is the bottom of the box, not the top. Getting this backwards
    // flips every diagram vertically and still looks like a plausible picture.
    expect(s.project([0, 0])).toEqual({ x: 0, y: 100 });
    expect(s.project([0, 10])).toEqual({ x: 0, y: 0 });
  });

  it('maps the far corner to the far corner', () => {
    const s = makeSpace(unitWorld, 100, 100);
    expect(s.project([10, 10])).toEqual({ x: 100, y: 0 });
  });

  it('scales lengths by the same factor it scales positions', () => {
    const s = makeSpace(unitWorld, 200, 200);
    expect(s.u(1)).toBe(20);
    expect(s.project([1, 0]).x).toBe(20);
  });

  it('never distorts — a circle must not become an ellipse', () => {
    // A wide box around a square world: the scale is set by the tighter axis.
    const s = makeSpace(unitWorld, 400, 100);
    expect(s.u(10)).toBe(100);
    // One world unit is the same number of pixels horizontally and vertically.
    const dx = s.project([1, 0]).x - s.project([0, 0]).x;
    const dy = s.project([0, 0]).y - s.project([0, 1]).y;
    expect(dx).toBeCloseTo(dy);
  });

  it('centres the fitted world in the leftover space', () => {
    const s = makeSpace(unitWorld, 400, 100);
    // 100px of fitted content in a 400px box leaves 150px each side.
    expect(s.project([0, 0]).x).toBeCloseTo(150);
    expect(s.project([10, 0]).x).toBeCloseTo(250);
  });

  it('handles a non-zero world origin', () => {
    const s = makeSpace({ x: [-5, 5], y: [-5, 5] }, 100, 100);
    expect(s.project([0, 0])).toEqual({ x: 50, y: 50 });
    expect(s.project([-5, -5])).toEqual({ x: 0, y: 100 });
  });

  it('handles a non-square world', () => {
    const s = makeSpace({ x: [0, 20], y: [0, 10] }, 200, 200);
    // Width is the binding axis: 200/20 = 10 px per unit.
    expect(s.u(1)).toBe(10);
    // The 10-unit-tall world occupies 100px, centred vertically.
    expect(s.project([0, 0]).y).toBeCloseTo(150);
  });
});
