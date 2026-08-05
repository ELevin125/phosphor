import { describe, expect, it } from 'vitest';
import { PROFILES } from './layout';

/**
 * The layout law, pinned. These bounds are the reason content does not end up
 * under a platform's own UI, and they are quoted in the README, the skill and
 * docs/ARCHITECTURE.md — so a change here that nobody meant should fail loudly
 * rather than ship a video with a username over it.
 */
describe('profiles', () => {
  it('derives portrait from its inputs', () => {
    const p = PROFILES.portrait;
    expect(p.canvas).toEqual({ width: 1080, height: 1920 });
    expect(p.content).toMatchObject({ top: 230, bottom: 1336, left: 108, right: 972 });
    expect(p.captionBandTop).toBe(1360);
    expect(p.captionBandBottom).toBe(1536);
  });

  it('derives landscape from its inputs', () => {
    const p = PROFILES.landscape;
    expect(p.canvas).toEqual({ width: 1920, height: 1080 });
    expect(p.content).toMatchObject({ top: 48, bottom: 848, left: 96, right: 1824 });
    expect(p.captionBandTop).toBe(872);
    expect(p.captionBandBottom).toBe(984);
  });

  it('keeps the portrait gutter equal to the action rail', () => {
    // Lower the gutter and content starts colliding with the like/comment
    // buttons in the lower third. They are equal on purpose.
    const p = PROFILES.portrait;
    expect(p.gutter).toBe(p.safe.right);
  });

  it('burns captions in for portrait but not landscape', () => {
    expect(PROFILES.portrait.usesCaptions).toBe(true);
    expect(PROFILES.landscape.usesCaptions).toBe(false);
  });

  it('gives landscape 936px of height once the band is reclaimed', () => {
    /*
      The whole point of captionless landscape. `content.bottom` is the
      with-captions figure; switching captions off extends the box to
      captionBandBottom, which is where the bottom safe area starts.
    */
    const p = PROFILES.landscape;
    const withCaptions = p.content.bottom - p.content.top;
    const without = p.captionBandBottom - p.content.top;
    expect(withCaptions).toBe(800);
    expect(without).toBe(936);
    expect(without / withCaptions).toBeCloseTo(1.17, 2);
  });

  it('never lets the content box overlap the caption band', () => {
    for (const p of Object.values(PROFILES)) {
      expect(p.content.bottom).toBeLessThanOrEqual(p.captionBandTop);
      expect(p.content.top).toBeGreaterThanOrEqual(p.safe.top);
    }
  });

  it('leaves the bottom safe area clear in both profiles', () => {
    for (const p of Object.values(PROFILES)) {
      expect(p.captionBandBottom).toBeLessThanOrEqual(p.canvas.height - p.safe.bottom);
    }
  });
});
