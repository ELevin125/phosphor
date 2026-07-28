# The kit — component reference

`src/kit` is the complete set of components a video may use. **Video files
compose kit primitives and nothing else.** No inline styles, no `<div>`s, no
hardcoded colours or pixel positions in `projects`.

If a video needs something the kit lacks: **add it to the kit first**, with
tokens from the theme, then use it.

---

## Which primitive for which claim

**Read this at Phase 0.5, before deciding how a beat looks.** Work from the
*shape of the claim*, not from the topic. Two videos about completely different
subjects usually want the same picture.

| The claim is about… | Reach for | Examples |
|---|---|---|
| a place, and things moving in it | `Scene` + `Dot`/`Trail`/`Vec` | steering, spawn patterns, aggro radius |
| a grid-based algorithm | `Field` | flow fields, A* frontiers, influence maps, fog of war |
| **how often** something happens | `Lanes` (or `Ruler` for one rate) | update frequency, hitstop gating, cost per second |
| **two clocks at once** | `Lanes` + `playhead` | `Update` vs `FixedUpdate`, coroutines, jobs vs main thread |
| **who depends on whom** | `Graph` / `Fanout` | events vs direct calls, DI, assembly refs, singletons |
| **structure or states** | `Graph` (`ring` / `rows`) | FSMs, behaviour trees, scene hierarchy, dependency layers |
| **adjacency in memory** | `Strip` | pools, arrays, stacks, ring buffers, AoS vs SoA, cache lines |
| a **curve** or a **trade-off** | `Plot` | easing, damage falloff, difficulty ramp, cost vs staleness |
| **two things behaving differently** | `Versus` | with/without hitstop, `Lerp` vs `SmoothDamp`, two sims |
| genuinely **3D** space | `Scene3D` + `Wire*` | transforms, gimbal lock, frustums, colliders, XZ-plane |
| the **shape of an API** | `CodeReveal` / `CodeDiff` | signatures, a rewrite, a branch appearing |
| one line worth remembering | `Statement` | the payoff beat |
| the real thing | `Clip bleed` / `Peel` | hooks, outros, before/after footage |

Three rules that come out of using these:

- **A claim about frequency cannot be made on a spatial diagram.** A grid can
  only pulse and hope you count. If the sentence contains "per second" or "every
  frame", it needs `Lanes`.
- **A claim about dependency direction is invisible in code.**
  `_camera.ShakeAt(...)` and `Died += ...` are both one line. Draw it.
- **`Strip` is not `Field`.** A `Field` cell is a *place* an agent can stand; a
  `Strip` cell is an *index*, and the gap between two is a stride. Drawing a
  heap as a room is a category error the viewer will feel without naming.

**Reserve `Scene3D` for claims that are genuinely spatial.** A 3D picture of a
2D idea is worse than the 2D one. It also has no occlusion — everything draws,
with distant edges faded — so it cannot express "the wall hides the enemy".

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
Clip:    src (path in public/)  label?  startAt?  startSeconds?  bleed?
         objectPosition?  aspect?  tone?
Compare: top: ClipProps   bottom: ClipProps   gap?
```
- Uses `OffthreadVideo`, so **the contact sheet still works on video beats** —
  it pulls exact frames via ffmpeg. Never swap this for `Html5Video`.
- Audio is always muted; game audio under narration is never wanted.
- **`bleed` is what a footage-led beat wants.** Fills the content box, no panel,
  no border, no corner decor, and ignores `aspect`. A hook shot is not a figure
  presented on a surface — it is the picture.
- `startSeconds` over `startAt`: the latter is frames, and every video that used
  it wrote `13.5 * 30` with a comment explaining the 30.
- **`aspect` only when the clip shares the frame with something else.** Setting
  it on a lone clip is what caused the re-crop bug — two beats with different
  ratios letterbox the same footage into different-shaped boxes, and a shot that
  changes shape mid-cut reads as a rendering fault.
- `objectPosition` biases the crop when the action sits off-centre.

### `<Lanes>` / `<Ruler>`
Parallel time tracks. **Not** in `scene/` — a scene is a place, this is a clock.
```
Lanes: lanes: Lane[]  playhead?  trackHeight?  gap?  panel?  dim?
Lane:  label?  readout?  ticks?  spans?  lag?  dim?
Ruler: one lane, same props flattened
```
- `ticks` are instants (`tone: 'live' | 'idle'` — waste becomes a colour rather
  than a claim); `spans` are work occupying time; `lag` is a bracket, because
  staleness is a duration and a duration on a time axis is a length.
- `playhead` crosses **every** lane, which is the whole reason to have more than
  one: "the coroutine resumes on the frame after the one that yielded" is a
  claim about two lanes at one instant.
- `panel` whenever lanes share the frame with a diagram — mono labels over a lit
  grid are unreadable.

### `<Versus>`
Two halves of the frame running the same thing two ways.
```
top  bottom  topLabel?  bottomLabel?  gap?  reveal?  dimTop?  dimBottom?
```
Stacked, not columns — two columns give each version a 432px strip. Unlike
`Compare` it takes **arbitrary children**, so the comparison can be live: run
both sims and let them diverge, because a hand-animated divergence is an
assertion with extra steps. Each half publishes its height on `SceneHeight`, so
a `Scene` inside it sizes to the pane rather than the content box.

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

## `<Graph nodes edges layout direction pulse>` / `<Fanout>`

Nodes and directed edges — the primitive for **structure and dependency
direction**.

- `layout`: `{kind:'free'}` (every node carries `at`), `{kind:'ring', rx?, ry?}`
  (state machines, cycles — starts at the top, goes clockwise), or
  `{kind:'rows', rows: string[][]}` (hierarchies, dependency levels).
- `direction` runs `+1` (arrows point at `to`) through `-1` (point back at
  `from`), and **animating between them is an argument by itself**: the same
  dependencies pointing the other way is the difference between a direct call
  and an event. Heads slide *and* rotate, so it reads as arrows turning around
  rather than as a cut between two diagrams.
- `active` on a node draws it filled — the live state of a machine. Weight, not
  hue: a recoloured outline disappears once the diagram gets busy.
- `edges[].label` for transition conditions. Self-edges are skipped.
- `Fanout` is the star case: a hub plus its listeners, in explicit positions.
  Use it rather than a node list where every edge repeats the same `from`.

## `<Strip cells at cellWidth pointers label indexEvery>`

A 1-D run of cells with pointers into it — **contiguous memory**. See the
`Strip` vs `Field` rule above; they are not interchangeable.

`pointers` sit above by default, `below: true` underneath. Everything under the
strip (indices, caption) auto-clears the below-pointers.

## `<Plot xRange yRange curves points marker>`

Two axes, in **data space** — a curve is authored in seconds or damage or cells
and the plot maps it into the box, so resizing never means rescaling by hand.

- `curves` for anything tuned over a range; `reveal` draws one on progressively.
- `points` for a **trade-off space**, and this is the underused half. Three
  options plotted against cost and staleness say "pick one" in a way three
  numbers in a table never do. Labels flip inside near the right edge, because
  the most interesting option is usually the extreme one.

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

---

# Wireframe 3D (`src/kit/scene3`)

The scene system with a camera instead of a fit. Same contract: author in world
units, map to pixels once.

```tsx
<Scene3D camera={{ pos: [8, 6, -8], target: [0, 0, 0], fov: 38, fit: 8.6 }}>
  <WireTerrain size={12} cells={12} height={(x, z) => Math.sin(x) * 0.7} />
  <WireBox at={[-4, 0.9, 4]} size={1.6} tone="accent" />
  <WireSphere at={[4, 1.1, -4]} r={1.1} tone="accentAlt" />
  <Tag3 at={[4, 2.5, -4]}>collider</Tag3>
</Scene3D>
```

Right-handed, **y up** — Unity's convention, so a diagram is never a mirror of
the engine it describes.

## `fit` is the important prop

With `fit`, `pos` supplies only the viewing **direction** and the distance is
solved so a sphere of that radius around `target` stays in frame. Without it
every 3D beat starts by guessing a camera distance and re-rendering until the
geometry stops falling off the edge — exactly the hand-tuning the layout law
exists to abolish. On a 1080x1920 frame the *horizontal* extent is the binding
constraint, which is not the intuitive one.

## Primitives

`WireGrid` (flat XZ lattice) · `WireBox` · `WireSphere` · `WireTerrain`
(heightfield from a sampler) · `WireFrustum` (view volume — culling, near/far)
· `WireMesh` (any `{points, edges}`) · `Tag3` · `Dot3`.

`depthFade` does the job depth cueing does in a shaded render. Without it a
wireframe is genuinely ambiguous — the Necker cube, where the eye cannot tell
which face is nearer and flips between readings while you watch. **Orbiting the
camera slowly resolves it far better than any static shot.**

## Why not Three.js

Wireframes are lines, and lines take stroke width and colour from the theme like
everything else. A WebGL render takes its look from materials and lights
instead, so a 3D beat would arrive looking like it came from a different video.
It would also need a GL backend in the headless renderer: slower, and one driver
update from breaking.

**Limitation to state plainly: there is no occlusion.** Everything draws, with
distant edges faded. For a wireframe that is arguably correct — seeing the back
of the box is how you read its shape — but it cannot express "the wall hides the
enemy". That claim needs footage.

---

# Verifying the kit

`projects/kit-check/` is a visual smoke test, not a video: one beat per
primitive, captions off, no voiceover.

```bash
./scripts/contact-sheet.sh kit-check-gizmo --count 16 --cols 4
```

**Add a beat whenever a new primitive lands.** Typechecking proves the props
line up and says nothing about whether the picture is right — every defect found
while building `Lanes`/`Graph`/`Strip`/`Plot`/`Scene3D` (labels colliding,
geometry off the frame, text running off the right edge) compiled perfectly.
