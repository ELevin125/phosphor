import { describe, expect, it } from 'vitest';
import { getTheme } from '../theme';
import { PROFILES } from './layout';
import { resolveTheme } from './ThemeContext';

describe('resolveTheme', () => {
  /*
    A regression pin, not a design statement.

    These are the exact pixel sizes gizmo shipped with before type became a
    ratio. Ten videos were authored, reviewed and rendered against them, so if
    this test fails the change has silently reflowed every finished short — and
    "the text moved a bit" is precisely the failure nobody notices until the
    video is on the internet.
  */
  it('reproduces the pre-existing portrait pixel sizes exactly', () => {
    const theme = resolveTheme(getTheme('gizmo'), PROFILES.portrait.typeBase);
    expect(theme.type.size).toEqual({
      title: 88,
      subtitle: 42,
      heading: 58,
      body: 40,
      code: 38,
      label: 30,
      caption: 48,
    });
  });

  it('scales the whole ramp for landscape without changing the proportions', () => {
    const portrait = resolveTheme(getTheme('gizmo'), PROFILES.portrait.typeBase);
    const landscape = resolveTheme(getTheme('gizmo'), PROFILES.landscape.typeBase);

    expect(landscape.type.size.body).toBe(32);
    // 2.2 x 32 = 70.4, rounded. Sub-pixel font sizes are not worth carrying.
    expect(landscape.type.size.title).toBe(70);

    /*
      The point of the change: a theme describes proportion, so the ratio
      between any two sizes survives the frame changing.

      To one decimal place, because rounding to whole pixels cannot preserve it
      exactly — 70/32 is 2.1875 against portrait's 2.2. That drift is the price
      of integer font sizes and it is worth paying; what would matter is a ratio
      that moved by a step, not by half a percent.
    */
    const ratio = (t: typeof portrait) => t.type.size.title / t.type.size.body;
    expect(ratio(landscape)).toBeCloseTo(ratio(portrait), 1);
  });

  it('leaves everything except sizes alone', () => {
    const spec = getTheme('gizmo');
    const theme = resolveTheme(spec, PROFILES.portrait.typeBase);
    expect(theme.colors).toBe(spec.colors);
    expect(theme.motion).toBe(spec.motion);
    expect(theme.type.scale).toBe(spec.type.scale);
  });

  it('rounds to whole pixels', () => {
    const theme = resolveTheme(getTheme('gizmo'), 33);
    for (const v of Object.values(theme.type.size)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
