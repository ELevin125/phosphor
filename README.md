# Phosphor

A toolkit for building short-form explainers — the vertical
1080×1920 videos that go on Reels and Shorts — as code rather than as a timeline
in an editor.

It is built on [Remotion](https://remotion.dev), so a video is a React
component. What Phosphor adds on top is the boring, repetitive part of making a
lot of them: a themed component kit, a world-unit scene system, offline audio
processing for voiceovers, beat detection for music, and automatic re-timing of
the whole video against a recording of you actually reading the script.

> **Status:** built for one person's workflow and generalised afterwards.
> It works, but expect rough edges outside the paths described here.

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
src/kit/      the component library — scenes, captions, code panels, music
src/theme/    ten themes; no component may hardcode a visual value
scripts/      the pipeline (audio, timing, music analysis, QA, render)
projects/     your videos — gitignored, see below
public/       your voiceovers, footage and music — gitignored
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
  beats.yaml        # slug, theme, and one entry per beat
  script.md         # the script you read aloud
  Video.tsx         # exports `Video`, takes { theme, debug }
```

Then:

```bash
npm run build-beats my-video   # beats.yaml -> generated timings
npm run studio
```

Registration is automatic — `npm run sync` scans `projects/` and writes
`src/registry.generated.ts`, and it runs ahead of `studio`, `render` and
`typecheck`. You never edit `src/Root.tsx` to add a video.

## The voiceover pipeline

This is the part that saves the most time, and it never sends audio anywhere.

1. Record yourself reading `script.md`. Save it to
   `public/videos/<slug>/vo.wav`.
2. `npm run process-vo <slug>` — high-pass, compression, de-essing, silence
   trimming, and two-pass EBU R128 normalisation to −16 LUFS. Non-destructive:
   your recording is kept as `vo.raw.wav` and every run works from that copy, so
   settings can be re-tried freely.
3. `npm run retime <slug>` — transcribes locally with whisper.cpp, then aligns
   the script against the transcript with Needleman–Wunsch and rewrites every
   beat duration from the real word timings.

The alignment step is why improvising is survivable. If you paraphrase a line,
the mismatch is absorbed locally instead of desynchronising every beat after it,
and your actual words — not the script's — become the burned-in captions. It
prints a fidelity score; below ~75% means the script and the recording have
genuinely diverged.

Tune the audio by **measuring**, not by reaching for a preset. Octave-band
levels will tell you whether "nasal" is a midrange peak to cut or, far more
often, a missing bottom octave to lift.

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

You cannot watch a video while building it. `scripts/contact-sheet.sh` renders
stills at fixed intervals and montages them into one labelled grid in
`out/contact-sheets/`.

```bash
./scripts/contact-sheet.sh <slug>-<theme> [--count N] [--debug]
./scripts/render.sh <slug>
```

`--debug` overlays the platform safe areas and the caption band.

## Layout

| region | bounds |
|---|---|
| top safe (platform UI) | y 0–230 |
| content box | x 108–972, y 230–1336 |
| caption band | y 1360–1536 |
| bottom safe | y 1536–1920 |
| right action rail | x 972–1080 |

Content may only occupy the content box; captions only the band. Those bounds
exist because Instagram and YouTube both overlay their own UI, and anything
outside them will be covered by a username or a row of buttons.

## Themes

Ten, in `src/theme/`, all implementing the token interface in
`src/theme/types.ts`. They vary palette, type **and motion character** — a theme
controls how things move, not just what colour they are.

Each project names its theme in `beats.yaml`. To compare one video across every
theme at once:

```bash
PHOSPHOR_THEMES=1 npm run studio
```

**No component may hardcode a visual value.** A hex code or a px font size
anywhere in `src/kit` or `projects` is a bug; add a token instead.

## Licence

MIT — see [LICENSE](LICENSE).

This covers the code only. Any music, footage or recordings you add are yours,
and are governed by their own licences.
