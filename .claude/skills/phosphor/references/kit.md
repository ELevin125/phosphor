# The kit — component reference

`src/kit` is the complete set of components a video may use. **Video files
compose kit primitives and nothing else.** No inline styles, no `<div>`s, no
hardcoded colours or pixel positions in `projects`.

If a video needs something the kit lacks: **add it to the kit first**, with
tokens from the theme, then use it.

---

## Structure of a video file

```tsx
export const Video: React.FC<VideoProps> = ({ theme, debug }) => (
  <Stage beats={BEATS} theme={theme} debug={debug}
         audioSrc={AUDIO_SRC} captions={CAPTIONS}>
    <Beat id="hook">
      <TitleCard kicker="C#" title="This does nothing." />
    </Beat>
    <Beat id="setup">
      <CodeReveal code={SAMPLE} lang="csharp" title="Player.cs" />
    </Beat>
  </Stage>
);
```

That is the whole shape. `Beat` ids must match `beats.yaml`; timing is looked
up, never written in TSX.

---

## Layout law (`kit/layout.ts`)

Canvas 1080x1920. These are enforced by `Stage`/`Beat`, not left to videos.

| region | bounds | rule |
|---|---|---|
| top safe | y 0–230 (12%) | platform UI — keep empty |
| content box | x 108–972, y 230–1336 | **the only place visuals may go** |
| caption band | y 1360–1536 | **captions only**, nothing else enters |
| bottom safe | y 1536–1920 (20%) | platform UI — keep empty |
| right rail | x 972–1080 | like/comment/share — content box stops here |

`GUTTER` (108) is deliberately equal to `SAFE.right`, which is what keeps the
content box both symmetric and clear of the action rail. Lower the gutter and
content starts colliding with platform UI in the lower third.

`<Stage debug>` draws all of these. Render a debug contact sheet whenever you
change layout.

---

## Components

### `<Stage>`
The shell. Background, fonts, audio, captions, safe-area overlay, beat timeline.
```
theme?: 'neon' | 'paper' | 'brut'   beats: BeatTiming[]
audioSrc?: string | null            captions?: Caption[] | null
debug?: boolean
```

### `<Beat id align?>`
One beat. Duration comes from the beats table by `id`. Fades itself out at the
end so beats never hard-cut. `align`: `center` (default) | `top` | `bottom`.

### `<TitleCard>`
`title`, `kicker?`, `subtitle?`, `align?`, `delay?`.
Opening statement or section break. Kicker/title/subtitle stagger automatically.

### `<CodeReveal>`
The workhorse.
```
code: string          lang: 'csharp'|'typescript'|'python'|'javascript'
title?: string        highlightLines?: [2, [5, 7]]   // 1-based, ranges allowed
revealBy?: 'line'|'all'   showLineNumbers?: boolean
delay?: number        revealFrames?: number
```
- `highlightLines` spotlights those lines and dims everything else to 28%.
- The reveal spreads over ~55% of the beat by default, so a long beat types on
  gradually instead of snapping in and holding a dead frame. Override with
  `revealFrames`.
- Font size **auto-fits**: the longest line always fits the panel (floor 22px).
  You do not need to hand-tune code length, but see the caveats below.

### `<CodeDiff>`
Morphs one code state into another.
```
before: string  after: string  lang: ...  title?: string
holdFrames?: number   // frames to hold on `before` first, default 20
```
Unchanged lines hold position, removed lines fade then collapse, added lines
expand then fade in — driven by an LCS line diff matched on trimmed text, so
re-indentation doesn't read as a rewrite. Best when the change is small; a
near-total rewrite reads as noise, so use two `CodeReveal`s instead.

### `<Callout>`
The "read this" element. `tone`: `accent`|`positive`|`negative`|`neutral`,
`label?`, `big?`, `delay?`. `big` renders at heading size in the display face —
use it for the payoff line, once per video.

### `<Box>` / `<Row>` / `<Stack>`
Generic themed panel plus layout helpers.
`label?`, `tone?`, `mono?`, `grow?`, `align?`, `delay?`, `from?`.
`mono` renders the body in the code face — for type names and identifiers.

### `<Clip>` / `<Compare>`
Gameplay footage.
```
Clip:    src (path in public/)  label?  startAt?  objectPosition?  aspect?  tone?
Compare: top: ClipProps   bottom: ClipProps   gap?
```
- Uses `OffthreadVideo`, so **the contact sheet still works on video beats** —
  it pulls exact frames via ffmpeg. Never swap this for `Html5Video`.
- Audio is always muted; game audio under narration is never wanted.
- `startAt` offsets into the source so successive beats show different moments
  instead of replaying the opening every time.
- `aspect` locks the panel ratio. **Use it for a clip shown alone** — letting a
  16:9 source fill a tall panel crops it to a ribbon. A square (`aspect={1}`)
  fills a vertical frame far better than 4:3.
- `objectPosition` biases the crop when the action sits off-centre.

Footage must be pre-processed: editor chrome cropped off, converted to the
composition fps, audio stripped. See `references/style.md`.

### `<Arrow>`
Connector. `direction`, `length`, `tone`, `label?`, `delay?`.
Draws on with a stroke-dash reveal rather than fading.

---

## Motion

Never write a transform by hand. Use:
- `useEnterStyle({ delay, from, preset })` → `{ opacity, transform }`
- `useReveal({ delay, preset })` → `0..1`
- `useStagger(index, base)` → a themed per-item delay

`preset` is `'enter' | 'pop' | 'soft'`; each theme defines its own spring config
**and** duration for all three, so swapping themes changes motion character and
pacing, not just colour.

---

## Why syntax highlighting is synchronous

`kit/code/highlighter.ts` uses `createHighlighterCoreSync` with
`createJavaScriptRegexEngine()` (no WASM to await) and eagerly-registered
languages and themes.

This matters: Remotion re-evaluates the tree **every frame**. Async highlighting
would mean a `delayRender`/`continueRender` round trip 1000+ times per render
and risks tokens differing between frames. Results are additionally memoised by
`code + lang + theme`.

To add a language: import it in that file, add it to `langs`, and extend the
`CodeLang` union. To add a Shiki theme: import it, add it to `themes`, and point
a theme's `shikiTheme` at it.

## Auto-fit caveat

`fitCodeSize` assumes a **0.6em mono advance width** (true for JetBrains Mono
and IBM Plex Mono). Any mono face added to a theme must match, or the fit will
be wrong. Long lines shrink the *whole block*, so one 90-character line drags
every other line down to the 22px floor — prefer wrapping the sample yourself.

---

# The scene system

The scene-first vocabulary. Prefer this over panels for anything that is about
behaviour rather than text — see Phase 0.5 in SKILL.md.

## `<Scene world={{ x: [a, b], y: [c, d] }}>`

A drawing surface in **world units**. Fits the world box into the content box
without distorting it (uniform scale on both axes — a circle must never render
as an ellipse because the scene was stretched to fill the frame).

`y` points **up**. The flip to screen coordinates happens in one place.

Scene fills its parent, which is already the content box. It takes the content
box's *size* from the layout law and its *position* from `<Beat>`.

**Use the vertical.** `world={{ x: [-3.4, 3.4], y: [-0.2, 9.6] }}` fills a
1080x1920 frame. A wide, short world letterboxes itself into a band across the
middle and looks exactly like a slide with a picture on it.

## Simulation

```ts
const state = useSim({ init, step, hz });                  // state now
const history = useSimHistory({ init, step, hz, stride, keep }); // for trails
```

- `hz` is a **real update rate**, independent of the video's 30fps. Running one
  sim at 30 and another at 144 is how you demonstrate frame-rate dependence
  rather than assert it.
- Recomputed from t=0 every frame on purpose — Remotion renders frames out of
  order and in parallel, so state carried between frames would desynchronise.
- `time: 'video'` (default) runs on **composition** time, so a scene keeps
  running across beat boundaries. `time: 'beat'` restarts it.
- `keep` caps trail length. Without it, a trail on composition time holds twenty
  seconds of history by the last beat and stops being a trail.

## Drawables

| component | what it is |
|---|---|
| `<Grid step>` | background lattice; makes motion measurable |
| `<Dot at tone size glow>` | a marker at a world point |
| `<Trail points tone>` | history — ghosts, line or dashes per theme |
| `<Vec from to tone dashed>` | arrow with a proper head |
| `<Measure from to label offset>` | dimension line; `offset` is perpendicular |
| `<Layer>` | a raw SVG layer, for geometry the kit lacks |

Ghost spacing is itself data: even spacing means constant speed, bunching means
deceleration. That is invisible in any still frame of the object alone.

## `<Field cols rows fills arrows arrowOpacity panel>`

A grid of cells with optional fills and per-cell direction arrows. The primitive
behind any grid-based algorithm: flow fields, A* frontiers, influence maps, fog
of war.

- Cell `(x, z)` occupies world square `[x, x+1] x [z, z+1]`, so the scene uses
  `world={{ x: [0, cols], y: [0, rows] }}` and **every other drawable shares
  those coordinates** — an agent at world `(6.5, 8.5)` is standing in the middle
  of cell `(6, 8)` with no conversion anywhere.
- `fills` and `arrows` are flat row-major arrays (`z * cols + x`), not
  callbacks, so the whole field is one memoisable value.
- Everything renders into **one** `<Layer>`. Composing a field out of `<Vec>`
  would give each cell its own SVG root — 208 of them for a 13x16 grid.
- `panel` (default on) draws an opaque backing. Not decoration: `gizmo`'s
  backdrop is a 64px lattice and a field at any other cell pitch beats against
  it into moire that reads as a rendering bug.

Drawing a crowd on a field, use one `<Layer>` of `<circle>`s rather than a
`<Dot>` per agent, for the same reason.

**Tinting cells is the easiest thing to overdo.** On a dense arena almost every
open cell is near a wall, so a "cells near walls cost more" overlay at padding 3
tints 98% of the floor and the frame just changes colour. Measure the coverage
before picking the number — at padding 1 it tinted 46% *and* re-routed more of
the field.

## Annotations

| component | what it is |
|---|---|
| `<Tag at anchor tone>` | a label that **follows** its world point |
| `<Readout at value digits unit label>` | a live number, tabular figures |
| `<CodeTag code emphasise at>` | **one line** of code, no panel chrome |
| `<Statement at>` | the one line worth remembering, as type not a card |

A `Tag` moves with the thing it names, so the viewer never has to work out which
object "the slow one" refers to. That property removes most of the need for
panels.

`CodeTag` auto-shrinks to fit the scene — a truncated line of code is worse than
a small one, because the part that falls off the edge is always the part the
video is about. Anything longer than a line or two belongs in `CodeReveal`, and
needing `CodeReveal` inside a scene usually means the beat is doing too much.

## `<Peel top bottom topLabel bottomLabel revealFrames>`

Two clips butted together against one lit seam, badges on the seam in the two
accent colours.

Use it over `Compare` when the two clips are the **same scene rendered two
ways**. `Compare` sets two panels with a gap, which reads as two things being
presented; `Peel` removes the gap and the panel edges so the pair reads as one
frame with its skin pulled back — which is the actual claim.

Two things it handles that are easy to get wrong by hand:

- The lower band is clipped from the **bottom**, so it grows downward out of the
  seam. Clipping from the top makes it grow up off the bottom edge of the frame,
  leaving a widening gap under the seam that reads as a loading error.
- Badges over live footage need their own contrast — a tight dark halo plus a
  wide soft shadow, and a scrim hugging the seam. A single shadow either haloes
  or sinks, never both, and a hot yellow badge over sunlit yellow terrain needs
  both. Both clips play from t=0 throughout: the reveal is a mask, never a delay.
