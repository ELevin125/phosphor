import React, { createContext, useContext } from 'react';
import { DEFAULT_PROFILE, PROFILES, type Layout, type ProfileName } from './layout';

/**
 * Whether the frame reserves its caption band.
 *
 * Lives here rather than in Beat.tsx, where it started, because the content box
 * depends on both this and the profile — and a hook that reads one from here
 * and the other from Beat.tsx would have Beat.tsx importing this file while
 * this file imports Beat.tsx. Both are layout questions; they belong together.
 */
export const LayoutContext = createContext<{ readonly captionBand: boolean }>({
  captionBand: true,
});

/**
 * The active layout profile.
 *
 * Answers "what shape is the frame, and where may content go in it" — which
 * every geometric component needs and none of them used to ask, because until
 * now there was only one answer.
 *
 * Defaults to portrait rather than throwing when there is no provider. A
 * component rendered outside a `Stage` — in a test, or in the studio's
 * component preview — should lay out as it always has rather than crash, and
 * portrait is what every existing video is.
 */
const ProfileContext = createContext<Layout>(PROFILES[DEFAULT_PROFILE]);

export const LayoutProvider: React.FC<{
  readonly profile: ProfileName;
  readonly children: React.ReactNode;
}> = ({ profile, children }) => (
  <ProfileContext.Provider value={PROFILES[profile]}>{children}</ProfileContext.Provider>
);

/**
 * The resolved bounds for the current profile.
 *
 * Prefer this over importing `CONTENT` / `CANVAS` / `CAPTION_BAND_*` directly.
 * Those are the portrait profile as module constants, and a component that
 * reads them is pinned to a 1080x1920 frame no matter what it is rendered in.
 */
export const useLayout = (): Layout => useContext(ProfileContext);

/**
 * The rectangle this beat's visuals may occupy, caption band accounted for.
 *
 * Six components were each computing
 *
 *     (captionBand ? CONTENT.bottom : CAPTION_BAND_BOTTOM) - CONTENT.top
 *
 * from the module constants — the same expression, six times, every one of them
 * pinned to a 1080x1920 frame. That is the whole content-box rule, so it is
 * stated once here and read from the profile.
 *
 * `bottom` extends over the caption band when the band is off, which is the
 * point of the conditional: a video without burned-in captions has no reason to
 * leave a strip of empty frame at the bottom.
 */
export const useContentBox = (): {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly bottom: number;
} => {
  const { content, captionBandBottom } = useLayout();
  const { captionBand } = useContext(LayoutContext);
  const bottom = captionBand ? content.bottom : captionBandBottom;
  return {
    top: content.top,
    left: content.left,
    width: content.width,
    height: bottom - content.top,
    bottom,
  };
};
