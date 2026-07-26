import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useBeatStart } from '../Beat';

export type SimSpec<S> = {
  /** State at t = 0. Must be pure. */
  readonly init: () => S;
  /**
   * One simulation step. `dt` is `1 / hz` — the same fixed timestep the sim
   * would get in an engine, not the video's frame time.
   */
  readonly step: (state: S, dt: number, i: number) => S;
  /**
   * Simulation rate in steps per second, INDEPENDENT of the video's fps.
   *
   * This is the whole reason the hook exists rather than keyframing motion by
   * hand: to show that a per-frame update behaves differently at 30 and at 144
   * updates a second, the sim has to actually run at 30 and at 144 while the
   * video renders at 30. Faking it would be drawing the conclusion instead of
   * demonstrating it.
   */
  readonly hz: number;
  /** Seconds to wait before the sim starts. */
  readonly delay?: number;
  /**
   * What `t = 0` means.
   *
   * `video` (the default) — composition time, so the simulation keeps running
   *   across beat boundaries. Beats then change only the annotations, and the
   *   scene reads as one continuous thing rather than a series of slides that
   *   each happen to contain a diagram. This is almost always what you want.
   * `beat` — restarts at each beat. Only for a beat that demonstrates a
   *   mechanism from a known starting state.
   */
  readonly time?: 'video' | 'beat';
};

/**
 * Runs a deterministic simulation and returns its state at the current frame.
 *
 * Recomputed from t = 0 on every frame, deliberately. Remotion evaluates the
 * component tree independently per frame and may render frames out of order or
 * in parallel, so carrying state between frames would desynchronise; replaying
 * from the start is the only approach that gives identical output whichever
 * frame is asked for first. A few thousand float ops per frame is nothing next
 * to the cost of rasterising one.
 */
/** Composition time by default; beat-relative when the spec asks for it. */
const simSeconds = <S,>(
  frame: number,
  start: number,
  fps: number,
  spec: SimSpec<S>,
): number => {
  const offset = (spec.time ?? 'video') === 'video' ? start : 0;
  return (frame + offset) / fps - (spec.delay ?? 0);
};

export const useSim = <S,>(spec: SimSpec<S>): S => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = useBeatStart();

  const t = Math.max(0, simSeconds(frame, start, fps, spec));
  const steps = Math.floor(t * spec.hz);
  const dt = 1 / spec.hz;

  let state = spec.init();
  for (let i = 0; i < steps; i++) {
    state = spec.step(state, dt, i);
  }
  return state;
};

/**
 * The same simulation sampled at every step up to now — for trails and ghosts.
 *
 * `stride` keeps the returned array manageable when `hz` is high: a 144 Hz sim
 * six seconds in has 864 states, and drawing all of them as ghosts is a smear
 * rather than a visualisation.
 */
export const useSimHistory = <S,>(
  spec: SimSpec<S> & {
    readonly stride?: number;
    /**
     * Maximum samples returned, oldest dropped first.
     *
     * Required once sims run on composition time: by the fifth beat a trail
     * holds twenty seconds of history and stops being a trail at all — it is
     * just a filled shape. A rolling window keeps it reading as "where this
     * thing has just been".
     */
    readonly keep?: number;
  },
): S[] => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = useBeatStart();

  const t = Math.max(0, simSeconds(frame, start, fps, spec));
  const steps = Math.floor(t * spec.hz);
  const dt = 1 / spec.hz;
  const stride = Math.max(1, spec.stride ?? 1);

  const out: S[] = [];
  let state = spec.init();
  out.push(state);
  for (let i = 0; i < steps; i++) {
    state = spec.step(state, dt, i);
    if ((i + 1) % stride === 0) {
      out.push(state);
    }
  }
  return spec.keep !== undefined && out.length > spec.keep ? out.slice(-spec.keep) : out;
};
