# Phosphor

A toolkit for building programming explainers — the short vertical videos that
go on Reels and Shorts — as code rather than as a timeline in an editor.

It is built on [Remotion](https://remotion.dev), so a video is a React
component. What Phosphor adds on top is the boring, repetitive part of making a
lot of them: a themed component kit, a world-unit scene system, offline audio
processing for voiceovers, beat detection for music, automatic re-timing of the
whole video against a recording of you actually reading the script, and a
machine QA pass that measures the finished frame instead of asking you to squint
at it.

> **Status:** built for one person's workflow and generalised afterwards.
> Short-form works and has shipped. Landscape long-form is designed but
> unproven — see [docs/STATUS.md](docs/STATUS.md).

## Documentation

`docs/` is written to bring someone — or an agent — up to speed without reading
the source first:

| doc | answers |
|---|---|
| [FORMAT.md](docs/FORMAT.md) | what a Phosphor video *is* — editorial doctrine, the rules a video must satisfy |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | how the system is built — layers, pipeline, where to put a new thing |
| [DECISIONS.md](docs/DECISIONS.md) | why it is built that way, and what each decision cost |
| [STATUS.md](docs/STATUS.md) | what is done, what is unverified, what is next |

## How it's meant to be used

Phosphor is built to be driven by an agent. `.claude/skills/phosphor/` is a
[Claude Code](https://claude.com/claude-code) skill covering the whole workflow
— researching the topic, writing the script, building the animation, and the QA
loop that catches what you can't see while building.

The part that matters most is a hard stop: **the script is shown for approval
before any animation code is written.** Iterating on a script in markdown is
cheap; iterating on it in animation code is not.

You can use the npm scripts directly without any of that. But the kit on its own
is the smaller half of the system — it gives you the components, not the process.

## The idea

Most explainer videos are a slideshow with narration over the top. Phosphor is
opinionated against that. The rule it is built around:

> **Cover the captions. Does the picture still make the point?**

If the visual only restates the words, it is a slide. So the kit is weighted
towards *scenes* — a continuous space in world units with real values changing
over time — rather than panels of text. Where a concept is a simulation, you run
the simulation and let it produce the picture.

## How it fits together

```
src/kit/      the component library — frame, primitives, and a narrow tail
src/theme/    the token contract, and gizmo
scripts/      the pipeline (audio, timing, music analysis, QA, render)
docs/         format doctrine, architecture, decisions, status
projects/     your videos — gitignored, see below
public/       your voiceovers, footage and music — gitignored
out/<slug>/   qa/ (disposable), renders/ (numbered), deliver/ (upload this)
```

**The repo is the engine, not the videos.** A video lives in `projects/<slug>/`
and is user data: it stays on your machine or in your own private repo. Phosphor
discovers whatever projects are present and registers them automatically, so the
tracked tree is the same for everyone.

## Requirements

- Node 22+
- `ffmpeg` and `ffprobe` on `PATH` (all audio work is done offline)
- ImageMagick, for contact sheets

If the machine has no system Node you can vendor one under `.tooling/`; every
script in `scripts/` puts that directory on `PATH` itself.

## Getting started

```bash
npm install
npm run studio          # opens the Remotion studio
```

A fresh checkout has no projects, so the studio will be empty. If you are using
the skill, ask it for a video and it will produce all of this for you — the
layout below is what it writes, and what you need if you are building by hand.

A project is a directory with a `beats.yaml` (timing and narration) and a
`Video.tsx`:

```
projects/my-video/
  beats.yaml        # slug, theme, profile, and one entry per beat
  script.md         # the script you read aloud
  Video.tsx         # exports `Video`, takes { theme, debug }
```

Then:

```bash
npm run build my-video   # runs whatever the pipeline needs
npm run studio
```

`npm run build` is the one command worth remembering. It knows the pipeline's
dependency order and skips any stage whose inputs haven't changed, so it is
always safe to run and cheap when there is nothing to do. `--force` rebuilds
everything; `--dry` shows what it would do.

Registration is automatic — `npm run sync` scans `projects/` and writes
`src/registry.generated.ts`, and it runs ahead of `studio`, `render`, `check`
and `typecheck`. You never edit `src/Root.tsx` to add a video.

## The voiceover pipeline

This is the part that saves the most time, and it never sends audio anywhere.

1. Record yourself reading `script.md`. Save it to
   `public/videos/<slug>/vo.wav`.
2. `npm run build <slug>` — or the stages individually:

`npm run process-vo <slug>` does high-pass, compression, de-essing, silence
trimming, and two-pass EBU R128 normalisation to −16 LUFS. It is
non-destructive: your recording is kept as `vo.raw.wav` and every run works from
that copy, so settings can be re-tried freely.

`npm run retime <slug>` transcribes locally with whisper.cpp, then aligns the
script against the transcript with Needleman–Wunsch and rewrites every beat
duration from the real word timings.

**The build stops between transcribing and captioning.** Whisper's mistakes are
function words that no larger model reliably fixes, and the transcript becomes
the burned-in caption text — so it writes `transcript.md` and waits for you to
read it. That pause is deliberate.

The alignment step is why improvising is survivable. If you paraphrase a line,
the mismatch is absorbed locally instead of desynchronising every beat after it,
and your actual words — not the script's — become the burned-in captions. It
prints a fidelity score; below ~75% means the script and the recording have
genuinely diverged.

Tune the audio by **measuring**, not by reaching for a preset. Octave-band
levels will tell you whether "nasal" is a midrange peak to cut or, far more
often, a missing bottom octave to lift.

Settings live with the video, in a `vo:` block in its `beats.yaml`:

```yaml
vo:
  bass: 6     # low shelf at 200Hz — the cure for a thin voice
  hpf: 65     # high-pass corner
  mid: -2     # peaking cut...
  midf: 550   # ...centred here
```

CLI flags override the block, and `process-vo` prints any flag you passed that
isn't in it yet, so an experiment that worked can be made permanent. This
matters more than it looks: a chain tuned by flags alone exists only in your
shell history, and the next run months later silently gives you the defaults.

## Music

Drop tracks in `public/music/<genre>/`, describe them in `public/music/music.yaml`,
then `npm run analyse-music`. It does spectral-flux onset detection and
autocorrelation tempo estimation offline, with no dependencies, and picks entry
points that are both on a downbeat and inside a loud section of the track.

Videos then choose an entry point seeded by their slug, so reusing a track
across videos doesn't make them all sound like the same song.

`music.yaml` requires a licence and source URL per track. That is not
bureaucracy — "I found it on a royalty-free site" is not a licence you can point
at eight months later when a track gets claimed.

## QA

You cannot watch a video while building it. There are two checks, and they
answer different questions.

```bash
npm run check <slug>                          # geometry, as text
./scripts/contact-sheet.sh <slug>-gizmo       # stills, for judgement
```

**`npm run check` is the one to run first.** It renders sample frames with a
measurement probe mounted, walks the DOM, and reports every violation as text —
naming the beat:

```
✗ overflow-x [lock] "the numbers are the readout now" right 1104 > content.right 972
✗ static-hold  nothing changed for 22.4s (f680–f1352)
```

It covers text overflow, off-canvas clipping, collisions, safe-area violations,
caption-band intrusion and static holds. Exit code is non-zero when it finds
something, so it can gate a build.

The **contact sheet** is for the one question arithmetic cannot answer: does the
picture make the point? It montages stills into a labelled grid in
`out/<slug>/qa/`. `--debug` overlays the safe areas and the caption band.

Caption *phrasing* is a third thing again — `npm run captions` scores it in
milliseconds, because a 12-frame sheet samples far too little of a 50-phrase
video to catch a bad break.

```bash
npm run test        # unit tests over the maths that fails silently
npm run lint
npm run typecheck
npm run clean       # wipe out/<slug>/qa and the bundle
```

## Rendering

```bash
./scripts/render.sh <slug>-gizmo             # out/<slug>/renders/<id>-001.mp4
./scripts/render.sh <slug>-gizmo --deliver   # also copies to deliver/
```

Renders are **numbered, never overwritten** — a re-render cannot silently
replace a take you wanted. `deliver/` holds the one file per video that actually
gets uploaded, and is the only directory in `out/` worth looking at.

## Layout

Two profiles, derived from one function so they cannot drift in how they are
computed.

**portrait — 1080×1920** (Reels, Shorts)

| region | bounds |
|---|---|
| top safe (platform UI) | y 0–230 |
| content box | x 108–972, y 230–1336 |
| caption band | y 1360–1536 |
| bottom safe | y 1536–1920 |
| right action rail | x 972–1080 |

**landscape — 1920×1080** (YouTube long-form)

| region | bounds |
|---|---|
| top safe | y 0–48 |
| content box | x 96–1824, y 48–848 |
| caption band | y 872–984 |
| bottom safe | y 984–1080 |

Content may only occupy the content box; captions only the band. Those bounds
exist because the platforms overlay their own UI, and anything outside them will
be covered by a username or a row of buttons.

Read them with `useLayout()`. There are no module-level layout constants — a
component that imported one was pinned to a 1080×1920 frame no matter what it
was rendered into.

## Themes

One: `gizmo`, in `src/theme/`, implementing the token interface in
`src/theme/types.ts`. There were ten; nine shipped zero videos while taxing
every new token ten hand-written blocks, so they were cut. See
[D002](docs/DECISIONS.md#d002).

**No component may hardcode a visual value.** A hex code or a px font size
anywhere in `src/kit` or `projects` is a bug; add a token instead. This still
holds with one theme — it is what keeps visual values in one editable place.

Type sizes are **ratios**, not pixels. The theme says a title is 2.2× body; the
profile says body is 40px in portrait and 32px in landscape. Read the resolved
values from `useTheme().type.size`.

## Licence

MIT — see [LICENSE](LICENSE).

This covers the code only. Any music, footage or recordings you add are yours,
and are governed by their own licences.
