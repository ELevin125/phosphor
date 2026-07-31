# ARCHITECTURE — how the system is built

The technical design doc. What the pieces are, how data moves between them, and
where to put a new thing. For *why* any of it is this way, see
[DECISIONS.md](DECISIONS.md).

## Shape of the repo

```
src/kit/        the component library, in three tiers (see below)
src/theme/      the token contract, and gizmo — the one theme
src/Root.tsx    turns the generated registry into Remotion compositions
scripts/        the pipeline: audio, timing, music analysis, QA, render
docs/           this
projects/       your videos — gitignored user data
public/         your voiceovers, footage and music — gitignored
out/<slug>/     qa/ renders/ deliver/ — see "Output" below
```

**The repo is the engine, not the videos.** A video is `projects/<slug>/` plus
`public/videos/<slug>/`, both gitignored, so the tracked tree is identical for
everyone. This has a consequence worth internalising: **there is no undo under
`projects/`.** Git cannot restore it. Changes there are held to a higher bar
than changes to engine code.

## The three tiers of `src/kit`

| tier | contents | rule |
|---|---|---|
| **frame** | `Stage`, `Beat`, `layout`, `LayoutProfile`, `ThemeContext`, `Music`, captions | every video uses all of it |
| **primitive** | `Scene`, `Field`, `Plot`, `Graph`, `Strip`, `Split`, `Scene3D`, `useSim`, `CodeReveal`/`CodeDiff`, `Box`, `Callout`, `TitleCard`, `Clip` | parameterised mechanisms — fed data, not finished pictures |
| **narrow** | `Lanes`, `Arrow`, `Versus`, `Board` | one or two users. Do not extend |

Bespoke composition lives in `projects/<slug>/` and that is expected. Promotion
into the kit requires a **third** user. See [D011](DECISIONS.md#d011).

## Layout and theme resolution

Two things vary with the frame, and both are resolved through context rather
than imported as constants:

```
beats.yaml `profile:`  ─┐
                        ├─> PROFILES[name] ──> LayoutProvider ──> useLayout()
Root.tsx canvas size   ─┘                            │
                                                     ▼
                       theme.type.scale (ratios) + profile.typeBase
                                     └──> ThemeProvider ──> useTheme().type.size (px)
```

- **`useLayout()`** returns the resolved bounds — canvas, safe areas, content
  box, caption band. There are no module-level layout constants any more; a
  component that imported one was pinned to 1080x1920 whatever it rendered into.
- **`useTheme()`** returns a theme whose `type.size` is already in pixels for the
  active profile. Themes declare *ratios* (`type.scale`); the profile supplies
  the base. See [D010](DECISIONS.md#d010).
- **`useContentBox()`** is the rectangle a beat may occupy, caption band
  accounted for. It extends over the band when captions are off.

`Stage` throws if its `profile` prop disagrees with the composition's actual
canvas size, because those are set in two different files with no type tying
them together.

## The pipeline

```
vo.raw.wav ──process-vo──> vo.wav ──transcribe──> transcript.md
                                                       │ (human reviews)
                                                       ▼
                                    retime --apply ──> captions.json
                                                   └─> beat durations in beats.yaml
                                                              │
                          beats.yaml ──build-beats──> beats.generated.ts
                                                              │
                                       sync ──> src/registry.generated.ts
                                                              │
                                            Root.tsx ──> compositions
```

`npm run build <slug>` runs this in order and skips stages whose inputs have not
changed. **Prefer it over running stages by hand** — the failure it prevents is
silent (re-record, forget to retime, ship a video captioned from the previous
take). See [D005](DECISIONS.md#d005) for the staleness rules, which are subtler
than they look because `beats.yaml` is both an input and an output.

The build **stops** after transcription and requires a second invocation, so a
human sees the words before they are burned in. See [D006](DECISIONS.md#d006).

## QA

Two checks, different questions, run in this order:

| | `npm run check` | contact sheet |
|---|---|---|
| answers | is the geometry legal? | does the picture make the point? |
| output | text, naming the beat | a PNG someone must read |
| covers | overflow, off-canvas, collisions, safe areas, caption band, static holds | composition, emphasis, whether a diff resolved |
| cost | cheap | expensive |

`check` works by rendering sample frames with `measure: true` in the input
props, which mounts `kit/Probe.tsx`. The probe walks the DOM, measures every
painted element, and `console.log`s a JSON payload that `renderStill` hands back
through `onBrowserLog`. Node then applies the rules in `scripts/check.ts`.

Calibration details that matter, because they were all learned by getting false
positives:

- `data-phosphor="decor"` subtrees are exempt. Decoration is randomised and may
  not render, so by rule it carries nothing the viewer needs.
- `data-phosphor="caption"` marks the caption subtree, so captions can be
  required *inside* the band and everything else required *outside* it.
- `data-phosphor-beat` names the beat, so a finding says where to look.
- Graphics get 24px of slack against text's 4px: `Scene3D` draws with
  `overflow: visible` deliberately, and strokes are centred on their path.
- Collisions only count between elements that are both ~opaque, because
  `CodeDiff` stacks and cross-fades its before/after lines on purpose.

## Output

```
out/<slug>/qa/        contact sheets, probe stills, working files. Disposable.
out/<slug>/renders/   <id>-001.mp4, -002.mp4, … never overwritten.
out/<slug>/deliver/   <id>.mp4 — the one file to upload.
out/.bundle/          webpack bundle cache. Rebuilt when any input is newer.
```

`npm run clean [slug]` wipes `qa/` and the bundle; `--renders` also drops
numbered renders; `--all` includes `deliver/` too. See [D008](DECISIONS.md#d008).

**Scratch renders go in `qa/`.** The previous flat `out/` accumulated probe PNGs
at its root because nothing said where else to put them.

## Bundling

There are two bundlers and they must agree. The CLI reads `remotion.config.ts`;
`scripts/check.ts` calls `bundle()` programmatically and never sees that file.
The alias list (`@kit`, `@theme`, `@projects`) therefore lives in
`scripts/webpack-override.ts`, which both import. Remotion's bundler does not
read `paths` from tsconfig, so these have to be mirrored for webpack at all.

## Tests and lint

`npm run test` (vitest) covers the pure functions whose bugs are *silent* —
`diff.ts`, `space.ts`, `project.ts` (3D maths), `align.ts` (Needleman–Wunsch),
and the type-scale resolution. Components are not unit-tested; `npm run check`
verifies them against a real rendered frame, which is stronger.

`npm run lint` (eslint) is deliberately narrow: unused vars, floating promises,
`prefer-const`, `eqeqeq`. Not a style config.

One test is a **regression pin**: `ThemeContext.test.ts` asserts the exact
pixel sizes gizmo shipped with, so the ratio change cannot silently reflow ten
finished videos.

## Where to put a new thing

| you are adding | put it |
|---|---|
| a visual value (colour, size, radius, spring) | `src/theme/types.ts` + `gizmo.ts` |
| a bespoke scene for one video | `projects/<slug>/` |
| a mechanism a third video now needs | `src/kit`, primitive tier |
| a pipeline stage | `scripts/`, and wire it into `build.ts` |
| a QA rule that is geometry | `scripts/check.ts` |
| a decision worth remembering | [DECISIONS.md](DECISIONS.md) |
