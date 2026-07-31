import { describe, expect, it } from 'vitest';
import {
  applyMat3,
  axisAngle,
  eulerFrom,
  eulerMat,
  IDENTITY3,
  mulMat3,
  quatFromEuler,
  quatMat,
  rotX,
  rotY,
  rotZ,
  slerp,
  wrapDeg,
  type Euler,
  type Vec3,
} from './project';

/**
 * The 3D maths behind `gimbal-lock`, and the clearest case in the repo of code
 * whose bugs produce a confident, wrong picture rather than an error. The video
 * asserts that Euler angles jump while the object does not — if the maths is
 * wrong, the video is a lie told fluently.
 */

const closeVec = (a: Vec3, b: Vec3, digits = 9): void => {
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i] ?? NaN, digits));
};

describe('rotation matrices', () => {
  it('rotates about Y by 90 degrees, sending +X to -Z', () => {
    closeVec(applyMat3(rotY(90), [1, 0, 0]), [0, 0, -1]);
  });

  it('rotates about X by 90 degrees, sending +Y to +Z', () => {
    closeVec(applyMat3(rotX(90), [0, 1, 0]), [0, 0, 1]);
  });

  it('rotates about Z by 90 degrees, sending +X to +Y', () => {
    closeVec(applyMat3(rotZ(90), [1, 0, 0]), [0, 1, 0]);
  });

  it('leaves a vector alone under identity', () => {
    closeVec(applyMat3(IDENTITY3, [1, 2, 3]), [1, 2, 3]);
  });

  it('composes in the order the arguments are written', () => {
    const composed = mulMat3(rotY(90), rotX(90));
    closeVec(applyMat3(composed, [0, 1, 0]), applyMat3(rotY(90), applyMat3(rotX(90), [0, 1, 0])));
  });
});

describe('wrapDeg', () => {
  it('leaves angles already in range alone', () => {
    expect(wrapDeg(90)).toBe(90);
    expect(wrapDeg(-90)).toBe(-90);
  });

  it('wraps past a full turn', () => {
    expect(wrapDeg(450)).toBeCloseTo(90);
    expect(wrapDeg(-450)).toBeCloseTo(-90);
  });

  /*
    The bug this function exists for: atan2 chooses between -180 and +180 on the
    sign of a numerically-zero argument, and IEEE has both +0 and -0 — so half a
    turn strobed between "-180" and "180" while nothing moved.
  */
  it('gives half a turn exactly one name', () => {
    expect(wrapDeg(180)).toBe(180);
    expect(wrapDeg(-180)).toBe(180);
    expect(wrapDeg(540)).toBe(180);
  });
});

describe('eulerMat / eulerFrom', () => {
  it('round-trips an ordinary orientation', () => {
    const e: Euler = [30, 20, 10];
    const back = eulerFrom(eulerMat(e));
    back.forEach((v, i) => expect(v).toBeCloseTo(e[i] ?? NaN, 6));
  });

  it('round-trips through the matrix even when the angles differ', () => {
    // Near the singularity the triple is not unique, so the ANGLES may differ —
    // but the orientation they describe must not. This is the property the
    // video actually depends on.
    const e: Euler = [40, 90, 25];
    const m = eulerMat(e);
    const round = eulerMat(eulerFrom(m));
    m.forEach((v, i) => expect(v).toBeCloseTo(round[i] ?? NaN, 6));
  });

  it('collapses yaw and roll into one axis at pitch 90 — the whole subject', () => {
    // At pitch 90 the yaw ring and the roll ring lie in the same plane, so
    // adding to one is indistinguishable from subtracting from the other. If
    // this ever stops holding, the video's central claim is false.
    const a = eulerMat([50, 90, 0]);
    const b = eulerMat([30, 90, -20]);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i] ?? NaN, 9));
  });

  it('uses Unity order, so it is pitch that degenerates and not yaw', () => {
    const a = eulerMat([90, 40, 0]);
    const b = eulerMat([90, 20, 20]);
    // Yaw at 90 is an ordinary orientation: these must NOT be equal.
    expect(a.some((v, i) => Math.abs(v - (b[i] ?? 0)) > 1e-6)).toBe(true);
  });
});

describe('quaternions', () => {
  it('agrees with the matrix path for the same Euler triple', () => {
    const e: Euler = [35, 62, -18];
    const viaMatrix = eulerMat(e);
    const viaQuat = quatMat(quatFromEuler(e));
    viaMatrix.forEach((v, i) => expect(v).toBeCloseTo(viaQuat[i] ?? NaN, 9));
  });

  it('slerp returns its endpoints exactly', () => {
    const a = quatFromEuler([0, 0, 0]);
    const b = quatFromEuler([90, 0, 0]);
    quatMat(slerp(a, b, 0)).forEach((v, i) => expect(v).toBeCloseTo(quatMat(a)[i] ?? NaN, 9));
    quatMat(slerp(a, b, 1)).forEach((v, i) => expect(v).toBeCloseTo(quatMat(b)[i] ?? NaN, 9));
  });

  it('slerp takes the short way round', () => {
    // The guard beat's claim: one axis, one angle, no detour. A slerp that went
    // the long way would show 270 degrees of travel for a 90 degree turn.
    const a = quatFromEuler([0, 0, 0]);
    const b = quatFromEuler([90, 0, 0]);
    expect(axisAngle(slerp(a, b, 1)).angle).toBeCloseTo(90, 6);
  });

  it('reports zero rotation for the identity', () => {
    expect(axisAngle(quatFromEuler([0, 0, 0])).angle).toBeCloseTo(0, 9);
  });

  it('moves monotonically along the arc', () => {
    const a = quatFromEuler([0, 0, 0]);
    const b = quatFromEuler([120, 0, 0]);
    const angles = [0.25, 0.5, 0.75].map((t) => axisAngle(slerp(a, b, t)).angle);
    expect(angles[0]).toBeLessThan(angles[1] ?? 0);
    expect(angles[1]).toBeLessThan(angles[2] ?? 0);
  });
});
