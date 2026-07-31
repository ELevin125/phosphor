# Visual style rules

## The theme contract

Every colour, font, size, radius, shadow and spring preset lives in
`src/theme/<name>.ts` behind the `Theme` interface in `src/theme/types.ts`.

**No component may hardcode a visual value.** If you type a hex code, a px font
size, or a spring config anywhere in `src/kit` or `projects`, it is a bug —
add a token instead.

This rule still holds with only one theme shipping. It is what keeps visual
values in one editable place, and it is the reason a second theme would be a
new file rather than a hunt through the kit.

## Backdrop and glass

Two token groups exist purely to support frosted-glass themes:

- **`backdrop`** — what gets painted behind every beat (`css` gradients, `grain`,
  or an `image` from `public/` with `imageBlur`, plus a darkening `veil`).
- **`glass`** — `enabled`, `blurPx`, `saturate`, and the `hairline` colour for
  the bright top edge.

**`backdrop-filter: blur()` over a flat colour produces nothing.** Glass only
reads as glass when there is texture behind it to smear. That is why glass
themes ship layered gradients plus film grain, and why `grain` is not merely
decorative — it gives the blur high-frequency detail to work with and stops
large gradients banding at h264 bitrates.

Verified: `backdrop-filter` **does** render correctly in Remotion's headless
Chrome. It is safe to rely on.

Panel styling lives in **one** place, `kit/surface.ts` (`useSurfaceStyle`).
Box, Callout and CodePanel all consume it. Add a surface treatment there, never
in the three components separately, or the frost breaks at the seams.

### Using an image backdrop

Set `backdrop.image` to a path inside `public/` — e.g. a blurred still from the
gameplay footage a video is about. Keep `imageBlur` high (30-50px): a legible
image behind code is a *worse* result than an abstract wash, because it competes
for attention with the thing the viewer is meant to read. Raise `veil` if
contrast suffers.

## The theme

One: **gizmo**. Engine-viewport structure in a deep-space palette — viewport
grid, square corners, mono throughout, star gold and lilac on charcoal. The
violet is a TINT on charcoal, not the subject: a saturated indigo turns a whole
1080x1920 frame purple and fights any footage placed on it.

There were ten. Nine shipped zero videos, and each new token in `types.ts` cost
ten hand-written blocks to add — a tax paid on every visual feature, for
variants nobody used. **Do not add a theme to solve a design problem in one
video.** Change gizmo, or add a token.

The lesson worth keeping from the nine: if a theme feels safe, it is. Grit
comes from specifics — a real light source with falloff, visible grain,
borderless panels, ornament that serves no function, motion with actual mass, a
deliberate in-joke, or genuine signal degradation. That applies to gizmo's
tokens now rather than to a choice between skins.

If a second theme is ever genuinely wanted: copy `gizmo.ts`, change the tokens,
register it in `src/theme/index.ts`, and **register its Shiki theme** in
`kit/code/highlighter.ts` — themes are loaded eagerly, so an unregistered one
throws `Theme \`x\` not found` at render.

## CRT and low-resolution (`crt`)

**gizmo sets `enabled: false`, so none of this currently renders.** The tokens
and `kit/Crt.tsx` are kept because the effect is genuinely hard to get right and
was working; the notes below are what it cost to learn. Split deliberately in
two:

- **Content filter** (`pixelSize`, `posterizeLevels`) — an SVG filter applied to
  the whole content layer, so text is *genuinely* pixelated and colour-crushed.
  `feFlood` + `feComposite` + `feTile` is the only way to mosaic live DOM;
  CSS `image-rendering` only affects bitmaps.
- **Overlays** (`scanlineOpacity`, `apertureOpacity`, `vignette`) — drawn on top
  and deliberately *not* filtered. A pixelated scanline is just a blurry one.

Two things learned tuning it:

1. **Posterising a broad gradient produces giant hard-edged discs**, which read
   as a rendering fault. Keep backdrops nearly flat under a quantiser, and
   raise `backdrop.grain` — noise before the quantiser is dithering, which is
   exactly how the hardware coped.
2. **`pixelSize: 3` starts eating code** ("struct" renders closer to "struot").
   2 is the readable ceiling for anything with code in it; go higher only for
   footage-led videos.

## Motion character

Beyond spring configs, three tokens change how a theme *moves*:

- **`stepFrames`** — quantises every spring input to N-frame steps. `3` gives
  the choppy ~10fps look of a console dropping frames. Applied at the spring
  input so position, scale and opacity step together; quantising only opacity
  looks like a bug.
- **`jitterPx`** — constant sub-pixel wobble (PS1 had no subpixel precision).
  Seeded on the step index, so it holds still for a step instead of vibrating.
- **`transition`** — `fade` cross-dissolves; `wipe` sweeps a hard edge with a
  bright leading bar.

**Sliding and fading are the safe options and read as corporate.** Setting
`travelPx: 0` and `enterScale: 0.7` makes things punch in by *scaling* instead.
That single swap does more to change the feel than any colour choice.

A wipe must **cover** rather than dissolve: the outgoing beat holds full opacity
for the whole overlap, and the overlap lasts as long as the sweep. Fading it as
well leaves a gap, because the incoming beat is still clipped to nothing at the
moment the outgoing one finishes fading. The bright leading edge is not
decoration — without it, a wipe between two similar layouts reads as tearing.

## Panel decoration (`decor`)

Ornament drawn on every panel by `kit/PanelDecor.tsx`. Two kinds:

- **`bounds`** — corner brackets and a coordinate readout on everything,
  including things that need no bounding box. **This is what gizmo uses**, in
  lilac so it never competes with the gold accent. The excess is the joke; do
  not "fix" it.
- **`stencil`** — small workshop-signage marks in a corner. Unused by gizmo. The
  `frequency` token keeps it occasional; at `1` it stops being ornament and
  starts being noise.

Marks are chosen with Remotion's **seeded** `random()`, never `Math.random` —
an unseeded pick would re-roll every frame and flicker for the entire render.

**Decoration must never carry meaning.** It is randomised and may not render.
Nothing the viewer needs goes in a decor slot.

### Japanese glyphs

Every Japanese webfont on Google Fonts is split into ~120 unicode-range chunks,
so pulling one in for a couple of ornamental katakana costs ~100 network
requests per render. That is why `decor.glyphs` is empty in gizmo. The token is
still honoured if you decide the trade is worth it.

## Working with gameplay footage

**Always pre-process source clips.** Screen recordings of the Unity editor
contain the menu bar, toolbar, window chrome and OS bar; none of that may reach
the frame. One ffmpeg pass crops to the Game view, matches fps and drops audio:

```bash
ffmpeg -i raw.mp4 -vf "crop=W:H:X:Y,scale=1280:-2,fps=30" \
  -an -c:v libx264 -crf 20 -pix_fmt yuv420p out.mp4
```

Find the crop by extracting one frame and measuring the Game view. Check both
clips — editor layouts differ between recordings.

Add `public/videos/**/*.mp4` to `.gitignore`; gameplay footage is large.

## Silent, text-only videos

Set `silent: true` in `beats.yaml` and pass `showCaptions={false}` to `<Stage>`.

- **Pacing is reading speed, not speech.** Target **18-40s**, not 35-50s. The
  same content that works narrated feels sluggish silent, because the viewer
  finishes each line long before the beat ends.
- Keep every line to **4-7 words** — readable in one glance.
- Use `<Callout big>` throughout. At body size the text is too small to carry a
  video where text *is* the message.
- With captions off, beats reclaim the caption band automatically, so the
  content box is taller. Nothing to configure.
- `vo` still holds the text — it is the on-screen line rather than narration.

## Beat transitions

Beats crossfade by overhanging their slot by `motion.fadeFrames` and fading out
during the overhang, while the next beat rises underneath.

This is not cosmetic. Without the overlap, the outgoing beat has finished fading
before the incoming one has sprung in, and **every cut flashes empty** — which
looks like a rendering bug and is invisible unless you sample a contact sheet
exactly on a beat boundary. Sample densely enough to land on boundaries.

## Captions

- **Phrase blocks of about four words, held for their full duration.** Never
  word-by-word karaoke: next to syntax-highlighted code, a word popping every
  200ms is visual noise competing with the thing the viewer is meant to read.
- Captions live in the reserved band and **never** over code.
- Before the VO exists, captions are derived from each beat's `vo` text, split
  proportionally across the beat. They are approximate but good enough to read
  a contact sheet against.

### Where phrases break

`groupWords` scores every possible split across a beat and takes the cheapest
whole set, rather than cutting every fifth word and leaving the remainder. Four
things are being avoided, and `npm run captions` counts all four:

| defect | looks like |
|---|---|
| dangling | ends on a word pointing forward — `has a health component and` |
| orphan | one or two words, gone in a few frames; reads as a glitch |
| particle | splits a phrasal verb — `Enemy health ends` / `up with four…` |
| straddle | carries a full stop mid-phrase, so it spans two sentences |

**Run `npm run captions` after any retime.** It reads `captions.json` and
`beats.yaml`, takes milliseconds, and is the only way to tell whether phrasing
changed for the better — a contact sheet samples 30 frames out of 2000 and will
not show you a bad break. `npm run captions <slug>` prints every phrase with its
defects marked.

Orphans and straddles should be zero. Dangling breaks should be under ~12%;
some are genuinely unavoidable in a long clause with nowhere good to stop.

**Punctuation is what makes this work, and it comes from the script.** whisper
punctuates unreliably — `every-frame` was transcribed with 4 sentence ends where
its script has 17 — so `retime` stamps the script's own punctuation onto every
word it can align, and only where the alignment is clean on both sides of the
mark. That punctuation is burned into the caption text, so a mark in the wrong
place is a visible typo rather than a bad line break. **This means well-punctuated
`vo:` lines directly improve the finished captions**, which is one more reason to
rewrite them from the transcript when the take drifts.

## Composition rules

- **One idea on screen at a time.** If a beat has a code panel and a callout,
  the callout arrives *after* the code, on a delay.
- **Spotlight, don't crowd.** Use `highlightLines` to dim the irrelevant rather
  than showing a shorter, less honest sample.
- **Motion must mean something.** An element enters when it becomes relevant.
  Nothing loops or drifts for decoration.
- **Nothing static for more than ~3 seconds.** If a beat's visual completes in
  0.5s and the beat is 6s, stagger the reveals across the beat. This is a
  documented QA failure, not a matter of taste.
- **Payoff once.** `<Callout big>` is the closing statement; using it twice
  spends the emphasis.

## Code samples

- Keep lines under ~45 characters. Auto-fit will shrink to fit, but one long
  line shrinks the *entire block* toward the 22px floor.
- Show the smallest program that exhibits the behaviour. Delete usings,
  namespaces, class wrappers, and anything not load-bearing.
- Prefer a one-token `CodeDiff` (`struct` → `class`) over a rewrite. The smaller
  the diff, the sharper the point.
- Real, runnable-looking code. No `// ...` elisions where the viewer needs to
  understand what's missing.

---

# Why the themes all looked the same (and what fixed it)

Kept because the diagnosis outlived the themes, and it is the reason the kit is
shaped the way it is.

The first eight themes were, honestly, one design with eight paint jobs. The
cause was not the theme system — it was that the kit could only draw **one
shape**: a rounded rectangle with a label and a body. `TitleCard`, `Box`,
`Callout`, `CodePanel` and `Compare` are all that rectangle in a centred column.
Varying fill, border, radius, font and easing cannot make two identical
compositions look different.

The general form: **a skin cannot rescue a weak vocabulary.** When a video looks
flat, the fix is a better picture, not a new token.

Two things changed:

1. **The scene system** (see `kit.md`) gave the kit a second vocabulary, where
   the picture is the explanation rather than a container for sentences.
2. **`theme.draw`** — a token group for how a theme *draws*, not how it colours.

## `theme.draw`

| token | effect |
|---|---|
| `strokeWidth` | geometry weight |
| `dotRadius`, `dotStyle` | filled disc vs open gizmo ring |
| `trailStyle` | `ghosts` \| `line` \| `dashes` |
| `trailFade` | opacity of the oldest sample |
| `gridStyle`, `gridColor` | `none` \| `lines` \| `dots` |
| `tagStyle` | `plain` \| `boxed` \| `bracket` (leader line) |
| `arrowHead` | arrowhead size |

These change the *picture*, not the paint. The same scene drawn with solid
markers, stamped ghosts and a faint dot lattice is a different image from one
drawn as hollow rings, dashed paths and coordinate brackets — and that is the
bar a theme has to clear before it earns a file.

gizmo spells every one of these out. There is no longer a `DEFAULT_DRAW`
fallback; a drawing style is a design decision, not a default.

# Gestures

`theme.motion.gestures` assigns an entrance per element **role** — `title`,
`panel`, `code`, `callout`, `label`, `media`. Variety between element *types*
rather than between takes: every title in a theme arrives the same way, but a
title, a panel and a code block arrive differently.

Available: `fade`, `rise`, `drop`, `slideLeft`, `slideRight`, `pop`, `bop`
(squash and stretch), `stamp` (oversized, slamming down), `unfold` (hinged at
the top), `swipe` (clip-path edge), `snap` (no interpolation, one-step flash).

Slow, elegant fading and sliding reads as corporate. Keep entrances short — 8 to
12 frames — and prefer scale and hard edges over long travel.

# Layouts

`<Stage layout>` picks how beats are arranged:

- `stack` (default) — each beat replaces the last. Correct when consecutive
  beats are genuinely unrelated.
- `board` — every beat owns a cell on one large board and the camera flies
  between them, earlier content staying visible and dimmed. The arrangement
  should carry meaning: put a fix directly below the bug, stack the two halves
  of a comparison in one column so the move between them is a single axis.

Board clips to the content box, so a neighbouring cell can never intrude into
the caption band. Set `zoom` below 1 on a node to pull back and show a cell
with its neighbours — the payoff shot a stack layout structurally cannot do.

# Colour on top of footage

Two hard-won rules from the you-vs-ai cuts:

1. **A badge over live footage needs a filled chip**, not bare type. Hot yellow
   over sunlit yellow terrain disappears; a solid background with a 1px border
   in the badge's own colour solves it outright, where shadows only mitigate it.
2. **When two panels are two views of the same thing, give their labels
   DIFFERENT tones.** Identical accents on both quietly implies the panels are
   the same kind of thing, which is the opposite of the point. Warm/cool splits
   read fastest — gold for the human view, lilac or cyan for the machine's.
