/**
 * The theme token contract.
 *
 * Every visual value a kit component renders MUST come from here. If you find
 * yourself typing a hex code, a px size, or a spring config inside `src/kit`
 * or `projects`, it belongs in this interface instead.
 *
 * Swapping themes is a one-line change in `src/theme/index.ts` (or the
 * `theme` prop on a composition).
 */

/** A Remotion `spring()` config plus the frame budget the motion should take. */
export type SpringPreset = {
  readonly damping: number;
  readonly mass: number;
  readonly stiffness: number;
  readonly overshootClamping: boolean;
  /** Stretches the spring to exactly this many frames via `durationInFrames`. */
  readonly durationInFrames: number;
};

export type ThemeColors = {
  /** Page background. */
  readonly bg: string;
  /** Secondary background, used for banding / alternate panels. */
  readonly bgAlt: string;
  /** Card and panel fill that sits on top of `bg`. */
  readonly surface: string;
  /** Fill for the code panel specifically. */
  readonly codeBg: string;
  /** Hairline / panel border. */
  readonly border: string;
  /** Primary body and heading text. */
  readonly text: string;
  /** De-emphasised text (labels, secondary lines, dimmed code). */
  readonly textMuted: string;
  /** Primary brand accent — the colour the eye should land on first. */
  readonly accent: string;
  /** Secondary accent, for contrast against `accent`. */
  readonly accentAlt: string;
  /** Semantic: additions, correct answers. */
  readonly positive: string;
  /** Semantic: removals, gotchas, "this is the bug". */
  readonly negative: string;
  /** Row tint behind an added diff line. */
  readonly diffAddBg: string;
  /** Row tint behind a removed diff line. */
  readonly diffRemoveBg: string;
  /** Row tint behind a highlighted (not diffed) code line. */
  readonly highlightBg: string;
  /**
   * Opacity of de-emphasised code lines when `highlightLines` is used.
   * Translucent glass panels need a higher floor than opaque ones or the
   * dimmed lines disappear into the backdrop entirely.
   */
  readonly dimOpacity: number;
};

/**
 * Type sizes as multiples of the profile's base size.
 *
 * These were absolute px, "at 1080x1920", and that is what actually blocked
 * landscape. An 88px title is 4.6% of a 1920-tall frame and 8.1% of a 1080-tall
 * one, so the same theme in the other profile produced type a third too large —
 * with nothing anywhere to say so. The bounds arithmetic in `layout.ts` was
 * already profile-aware; the type was not.
 *
 * A theme describing proportion rather than pixels is also the right division:
 * "the title is 2.2 times body" is a design decision, and "body is 40px" is a
 * fact about the frame. See docs/DECISIONS.md#d010.
 */
export type TypeScale = {
  readonly title: number;
  readonly subtitle: number;
  readonly heading: number;
  readonly body: number;
  readonly code: number;
  readonly label: number;
  readonly caption: number;
};

export type ThemeTypography = {
  /** Big statements: titles, callouts. */
  readonly display: string;
  /** Everything that is prose. */
  readonly body: string;
  /** Code, and only code. */
  readonly mono: string;
  readonly weightDisplay: number;
  readonly weightBody: number;
  readonly weightMono: number;
  /** Ratios against the profile's `typeBase`. Resolved to px by `ThemeProvider`. */
  readonly scale: TypeScale;
  readonly lineHeight: {
    readonly tight: number;
    readonly normal: number;
    readonly code: number;
  };
  readonly letterSpacing: {
    readonly display: string;
    readonly body: string;
    readonly label: string;
  };
  /** Applied to labels/eyebrow text. */
  readonly labelTransform: 'uppercase' | 'none';
};

export type ThemeShape = {
  readonly radiusSm: number;
  readonly radiusMd: number;
  readonly radiusLg: number;
  readonly borderWidth: number;
  /** Box shadow for raised surfaces. Full CSS value. */
  readonly shadow: string;
  /** A stronger shadow for the element currently being emphasised. */
  readonly shadowStrong: string;
  /** Glow applied to accent elements. Use `'none'` for flat themes. */
  readonly glow: string;
};

/**
 * CRT / low-resolution treatment applied over the whole frame.
 *
 * Split in two on purpose: `pixelSize` and `posterizeLevels` are an SVG filter
 * applied to the CONTENT (so text really is quantised), while scanlines,
 * aperture grille, vignette and dither are overlays drawn ON TOP and left
 * unfiltered — a pixelated scanline is just a blurry scanline.
 */
export type ThemeCrt = {
  readonly enabled: boolean;
  /** Mosaic block size in px. 0 disables. */
  readonly pixelSize: number;
  /** Colour steps per channel, mimicking 15-bit output. 0 disables. */
  readonly posterizeLevels: number;
  /** Horizontal scanline darkening, 0..1. */
  readonly scanlineOpacity: number;
  /** Scanline period in px. */
  readonly scanlineHeight: number;
  /** Vertical RGB phosphor stripe strength, 0..1. */
  readonly apertureOpacity: number;
  /** Corner darkening, 0..1. */
  readonly vignette: number;
  /** Ordered-dither noise strength, 0..1. */
  readonly ditherOpacity: number;
};

/**
 * How a single element arrives on screen.
 *
 * Having a vocabulary of these — rather than one global entrance — is what
 * stops a video reading as a slide deck. A title that stamps, a panel that
 * bops and a code block that swipes open feel authored; the same slide-and-fade
 * on all three feels like a template.
 *
 * `fade`       opacity only, no movement.
 * `rise`/`drop` travel up from below / down from above.
 * `slideLeft`/`slideRight` travel in horizontally.
 * `pop`        scales up from small, overshooting past its size.
 * `bop`        scales up with a squash-and-stretch settle.
 * `stamp`      scales DOWN from oversized, slamming into place.
 * `unfold`     scaleY from zero, hinged at the top edge.
 * `swipe`      a clip-path edge sweeps the element open left to right.
 * `snap`       no interpolation at all: off, then on, with a one-step flash.
 */
export type Gesture =
  | 'fade'
  | 'rise'
  | 'drop'
  | 'slideLeft'
  | 'slideRight'
  | 'pop'
  | 'bop'
  | 'stamp'
  | 'unfold'
  | 'swipe'
  | 'snap';

/**
 * The gesture each kind of element uses by default.
 *
 * Assigning gestures by ROLE rather than per element is what keeps variety from
 * turning into noise: every title in every video of a theme arrives the same
 * way, so the variety is between element types, not between takes. A video may
 * still override one element when it has a reason to.
 */
export type ThemeGestures = {
  readonly title: Gesture;
  readonly panel: Gesture;
  readonly code: Gesture;
  readonly callout: Gesture;
  readonly label: Gesture;
  readonly media: Gesture;
};

export type ThemeMotion = {
  /** Default entrance for most elements. */
  readonly enter: SpringPreset;
  /** Punchier entrance for things that should feel like an impact. */
  readonly pop: SpringPreset;
  /** Slow, settled motion for backgrounds and large panels. */
  readonly soft: SpringPreset;
  /** Frames a cross-fade takes. */
  readonly fadeFrames: number;
  /** Per-item stagger, in frames, for lists and code lines. */
  readonly staggerFrames: number;
  /** How far elements travel on entrance, in px. */
  readonly travelPx: number;
  /** Scale an element starts at when it pops in. `1` disables scaling. */
  readonly enterScale: number;
  /**
   * Quantise animation to N-frame steps. `1` is smooth; `3` gives the choppy
   * ~10fps look of a console that could not hold 30. Applies to every spring,
   * so it changes the character of the whole theme rather than one component.
   */
  readonly stepFrames: number;
  /**
   * Constant sub-pixel wobble on panels, in px — PS1 vertex jitter, which had
   * no subpixel precision. Seeded, so it is identical on every re-render.
   */
  readonly jitterPx: number;
  /**
   * How one beat becomes the next.
   * `fade` — cross-dissolve. `wipe` — a hard edge sweeps the new beat in.
   */
  readonly transition: 'fade' | 'wipe';
  /** Default gesture per element role. See `Gesture`. */
  readonly gestures: ThemeGestures;
  /**
   * Frames the board camera takes to travel between beats, and how far it
   * overshoots. A short, slightly overshooting move reads as a game camera
   * snapping to a target; a long damped one reads as a corporate pan.
   */
  readonly camera: SpringPreset;
};

/**
 * How a theme DRAWS, as opposed to how it colours.
 *
 * This group exists because the first eight themes all looked like each other
 * with different paint. They were only ever varying fill, border, radius, font
 * and easing — every one of them still drew the identical picture, because the
 * kit only knew how to draw one picture.
 *
 * These tokens change the picture itself: whether a marker is a filled disc or
 * an open ring, whether history is drawn as stamped ghosts or a continuous
 * line, whether the space has a grid in it at all. A wireframe theme and an
 * inked theme built from the same scene should be unmistakable in a thumbnail.
 */
export type ThemeDraw = {
  /** Stroke weight for scene geometry, in px. */
  readonly strokeWidth: number;
  /** Marker radius, in px. */
  readonly dotRadius: number;
  /** `solid` — filled disc. `hollow` — open ring, engine-gizmo style. */
  readonly dotStyle: 'solid' | 'hollow';
  /**
   * How past states are drawn.
   * `ghosts` — a stamped copy of the marker per sample.
   * `line`   — a continuous polyline.
   * `dashes` — a dashed polyline, like a debug path.
   */
  readonly trailStyle: 'ghosts' | 'line' | 'dashes';
  /** Opacity of the oldest trail sample; newer samples fade up to full. */
  readonly trailFade: number;
  /** Background lattice inside a scene. */
  readonly gridStyle: 'none' | 'lines' | 'dots';
  readonly gridColor: string;
  /**
   * How a label attached to a world point is presented.
   * `plain` — text only. `boxed` — filled chip. `bracket` — a leader line and
   * a corner tick, the way an editor annotates a handle.
   */
  readonly tagStyle: 'plain' | 'boxed' | 'bracket';
  /** Arrowhead length in px, for `Vec`. */
  readonly arrowHead: number;
};

export type ThemeCaptions = {
  readonly color: string;
  /** Background behind the caption block. Use `'transparent'` for none. */
  readonly bg: string;
  /** Colour of the word(s) currently being spoken, if emphasis is on. */
  readonly activeColor: string;
  readonly weight: number;
  readonly radius: number;
  readonly paddingX: number;
  readonly paddingY: number;
  readonly letterSpacing: string;
  readonly textTransform: 'uppercase' | 'none';
  /** Full CSS text-shadow, for legibility over busy backgrounds. */
  readonly textShadow: string;
  /** Emphasise the active phrase with `activeColor`. */
  readonly emphasiseActive: boolean;
};

/**
 * What gets painted behind every beat.
 *
 * This exists because of frosted glass: `backdrop-filter: blur()` over a flat
 * colour produces nothing at all. Glass only reads as glass when there is
 * texture behind it to smear, so a glass theme must ship a backdrop with real
 * tonal variation.
 */
export type ThemeBackdrop = {
  /** Full CSS `background` value. Layered gradients, painted behind everything. */
  readonly css: string;
  /** Film-grain overlay opacity, 0 disables. Keeps large gradients from banding. */
  readonly grain: number;
  /**
   * Optional image inside `public/` used instead of `css` — e.g. a still from
   * the gameplay footage the video is about. Null for a purely procedural look.
   */
  readonly image: string | null;
  /** Blur applied to `image` so it never competes with the code on top of it. */
  readonly imageBlur: number;
  /** Darkening veil over the backdrop. Raise it if text legibility suffers. */
  readonly veil: string;
  /**
   * Seeded starfield drawn over `css`. `count: 0` disables it.
   *
   * This exists because a gradient alone is inert — it gives the eye nothing to
   * hold on to while the camera moves, so a pan across it looks like a static
   * frame. Stars parallax at `parallax` x the camera's travel, which is what
   * makes a board move read as depth rather than as content sliding around.
   */
  readonly stars: {
    readonly count: number;
    readonly color: string;
    /** Share of stars drawn as four-point sparkles rather than round dots. */
    readonly sparkleRatio: number;
    readonly maxRadius: number;
    /** 0 = painted on the backdrop; 1 = moves with the content. */
    readonly parallax: number;
  };
};

/**
 * Ornament drawn on panels. Decoration only — it must never carry meaning the
 * viewer needs, because it is randomised and may not render at all.
 */
export type ThemeDecor = {
  /**
   * `stencil` — small workshop-signage marks in a panel corner.
   * `bounds`  — debug corner brackets and a coordinate readout.
   */
  readonly kind: 'none' | 'stencil' | 'bounds';
  /** Pool of marks for `stencil`. Picked deterministically per panel. */
  readonly glyphs: readonly string[];
  readonly color: string;
  readonly opacity: number;
  /** Font for the marks. Falls back to the theme mono face. */
  readonly fontFamily: string | null;
  /** 0..1 — share of panels that get a mark. Keeps `occasional` occasional. */
  readonly frequency: number;
};

/** Frosted-glass treatment for panels. */
export type ThemeGlass = {
  /** When false, panels use the flat `colors.surface` and no blur. */
  readonly enabled: boolean;
  readonly blurPx: number;
  /** Saturation boost behind the glass — real frosted glass intensifies colour. */
  readonly saturate: number;
  /** The bright 1px top edge that sells the effect. Full CSS colour. */
  readonly hairline: string;
};

/**
 * A theme as authored, before a frame is known.
 *
 * `ThemeSpec` is what a theme file exports; `Theme` is what components consume,
 * with `type.size` resolved into px for the active profile. The split is what
 * makes it impossible to read a size that has not been resolved.
 */
export type ThemeSpec = {
  readonly name: string;
  /** One line on the feel this theme is going for. Shown in the studio. */
  readonly description: string;
  readonly colors: ThemeColors;
  readonly type: ThemeTypography;
  readonly shape: ThemeShape;
  readonly backdrop: ThemeBackdrop;
  readonly glass: ThemeGlass;
  readonly decor: ThemeDecor;
  readonly crt: ThemeCrt;
  readonly draw: ThemeDraw;
  readonly motion: ThemeMotion;
  readonly captions: ThemeCaptions;
  /**
   * Name of the bundled Shiki theme used for syntax highlighting.
   * Must be one of the themes registered in `src/kit/code/highlighter.ts`.
   */
  readonly shikiTheme: string;
  /**
   * Loads the theme's webfonts. Called once by `<Stage>`; Remotion's
   * `delayRender` inside `loadFont` holds the render until fonts are ready.
   */
  readonly loadFonts: () => void;
};

/**
 * A theme resolved against a layout profile — what `useTheme()` returns.
 *
 * `type.size` is present here and only here, so a component cannot accidentally
 * read a ratio where it wanted pixels: the ratios live under `type.scale` and
 * the pixels under `type.size`, and only the resolved theme has the latter.
 */
export type Theme = Omit<ThemeSpec, 'type'> & {
  readonly type: ThemeTypography & {
    /** Font sizes in px for the active profile. */
    readonly size: TypeScale;
  };
};
