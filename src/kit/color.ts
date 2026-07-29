/**
 * Colour operations on theme tokens.
 *
 * Themes hand out opaque hex strings, but almost every scene needs one of them
 * at partial alpha — a wall fill, a scrim, a trail that fades. Doing that at
 * the point of use means either a hardcoded `rgba(...)` literal, which is the
 * one thing videos are not allowed to contain, or a local copy of the function
 * below. Three videos had the local copy.
 */

/**
 * A theme hex colour at a given alpha.
 *
 * Takes `#rrggbb` — the form every theme token is written in. Shorthand
 * (`#abc`) is not accepted rather than silently mis-parsed, because a colour
 * that comes out wrong by a factor of sixteen is far harder to spot in a
 * render than one that fails immediately.
 */
export const rgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  if (h.length !== 6) {
    throw new Error(`rgba() needs a #rrggbb colour, got "${hex}".`);
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
