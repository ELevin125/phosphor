# Script and beat format

## `script.md` — the Phase 1 deliverable

This is what gets shown for approval. It is markdown because iterating on
markdown is cheap and iterating on animation code is not.

Required sections:

1. **Title + metadata** — concept, total runtime, language.
2. **Hook (first 2 seconds)** — the exact opening line, plus one sentence on
   why it earns the next two seconds.
3. **Where people actually get confused** — the research payload. Not "what is
   X" but the specific misconceptions, the wrong mental model people hold, and
   what makes the confusion persist. This section is what makes the video worth
   making; if it is thin, the video will be generic.
4. **Beats table** — `#`, `id`, `dur`, `narration`, `visual`.
5. **Narration, clean** — the numbered lines only, nothing else. This is the
   block that actually gets read into a microphone, so it must be readable
   without visual notes interleaved.
6. **Delivery notes** — where to pause, what to land on, what to underplay.

## Writing the narration

The voice is **plain and direct**. It is a developer explaining something to
another developer, not a presenter.

Do:
- Short declarative sentences. Full stops over commas.
- Concrete nouns — `Vector3`, `struct`, `the method`. Not "this concept".
- State the surprising thing flatly and let it be surprising.
- Write contractions where they'd be spoken ("it's", "doesn't").

Don't:
- "Have you ever wondered...", "Let's dive in", "But here's the crazy part"
- "In this video I'm going to show you" — just show it.
- Rhetorical questions used as filler.
- Hype adjectives: *insane, mind-blowing, game-changing, powerful*.
- Sign-offs, "smash that follow", or any call to action.

## Timing

- **~2.6 words/sec** is the estimate for the rough cut.
- Total runtime is **hard-capped at 35-50 seconds**. Outside that range,
  `build-beats` prints a warning — cut a beat rather than shave every beat.
- A beat should be one idea. If a beat's `vo` needs a semicolon, it's two beats.
- Beats under ~2.5s feel clipped; beats over ~7s need visual movement inside
  them or they read as a freeze.

## `beats.yaml`

```yaml
slug: value-vs-reference
theme: midnight          # the theme this video ships in; registration is automatic
title: Why your struct didn't change
lang: csharp
fps: 30

# Optional. Voiceover chain settings for THIS recording — see SKILL.md.
# CLI flags to process-vo override these.
vo:
  bass: 6
  hpf: 65

# Optional. Extra compositions from the same timings with a different
# component, for comparing two layouts frame for frame.
variants:
  - id: board            # -> composition `value-vs-reference-board-midnight`
    component: VideoBoard

beats:
  - id: hook               # matches <Beat id="hook">, must be unique
    duration: 4.3          # SECONDS. Regenerate with: npm run build-beats
    vo: This method takes ten health off your player. It does nothing.
    visual:                # documents intent; Video.tsx implements it
      component: TitleCard
      props:
        title: This does nothing.
```

- `vo` exists **from day one**, before any audio. It drives the rough-cut
  captions, and it is the alignment key when re-timing against real audio.
- `visual` is documentation, not executed config. The TSX is the implementation;
  keeping it hand-written is what makes it tweakable.
- `id` is the contract between the yaml and the TSX. A `<Beat>` whose id is not
  in the yaml throws at render with a message telling you to run `build-beats`.

- `theme` names one of the themes in `src/theme/`. Nothing else registers the
  video — `npm run sync` reads this.

Regenerate after every edit:
```bash
npm run build-beats value-vs-reference
```

## Re-timing against the recorded VO

```bash
# 1. save the recording to public/videos/<slug>/vo.wav
npm run build value-vs-reference     # process-vo, retime, build-beats, sync
```

`npm run build` runs only the stages whose inputs changed, so it is safe to run
at any point. To drive a single stage directly:

```bash
npm run retime value-vs-reference
```

This converts to 16kHz mono, transcribes with whisper `medium.en` at token
level, writes `captions.json`, rewrites each beat's `duration` from where its
narration actually lands, and re-runs `build-beats`.

Beats are matched to audio by **word count** — the script walks the word stream
consuming as many words as each beat's `vo` contains. If the read drifted from
the script, fix the `vo` lines to match what was actually said, then re-run.
The script warns if it runs out of audio before it runs out of beats.

After re-timing, **run the contact sheet again** — real timings change which
frames are static and can expose holds that the estimate hid.
