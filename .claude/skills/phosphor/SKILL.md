---
name: phosphor
description: Plan, script and animate short-form programming explainer videos (Instagram Reels / YouTube Shorts) with Remotion. Use when asked to make a video, short, or reel about a programming concept, or to edit/re-time an existing one in this project.
---

# Phosphor — programming explainers

Vertical 1080x1920 @ 30fps. Two kinds: **explainers** (35-50s, usually
narrated) and **showcases** (footage with a label, as long as the clip). The
user records any voiceover themselves, so the script is a deliverable, not an
internal artifact.

All paths below are relative to the repository root.

## Read first

- `references/remotion-api.md` — version-exact API. **Read before writing any
  Remotion code.** Do not guess the API from memory; 4.0.499 has renames and
  gotchas documented there.
- `references/kit.md` — the components a video may use.
- `references/style.md` — theme contract, caption rules, composition rules.
- `references/script-format.md` — script and `beats.yaml` format.

## Environment

Node 22+ is required. If the machine has no system Node, vendor it under
`.tooling/` — every script in `scripts/` puts that directory on `PATH` itself.
When running `npm`/`npx` directly against a vendored copy, from the repo root:

```bash
export PATH="$PWD/.tooling/node-v22.23.1-linux-x64/bin:$PATH"
```

---

# The workflow has two phases with a hard stop between them

## Phase 0 — what kind of video is this?

**Ask this before anything else.** Not every video teaches something, and
assuming it does produces hooks, misconception research and payoff lines for a
clip that just wanted a label on it.

| | **educational** | **showcase** |
|---|---|---|
| purpose | teach a concept | show something off |
| structure | hook → build → payoff | one held idea |
| text | narration or per-beat lines | often a single static label |
| runtime | 35-50s narrated, 18-40s silent | as long as the footage |
| research | misconceptions, where people get stuck | none |
| `beats.yaml` | `type: educational` (default) | `type: showcase` |

If the request is "make a short about X", it is probably educational. If it is
"here is footage of my game, put a title on it", it is a showcase — and
**everything in Phase 1 below about research and misconceptions does not
apply.** A showcase script is a layout sketch and the exact text, nothing more.

When in doubt, ask. It is one question and it changes the entire deliverable.

## Phase 0.5 — scene-first, or panels?

**Default to scene-first. Panels are the exception and need a reason.**

A *scene* is one continuous space in world units — objects, positions, real
values changing over time — with text anchored into it (`Tag`, `Readout`,
`CodeTag`, `Statement`). A *panel stack* is `TitleCard` / `Box` / `Callout` /
`CodeReveal` in a centred column.

The test, and it is not a soft one:

> **Cover the captions. Does the picture still make the point?**
>
> If the visual only restates the words, it is a slide, and no theme, palette or
> transition will rescue it. A `Box` containing the words "a throwaway copy",
> under narration saying the method got a throwaway copy, carries **zero**
> information. That is the failure mode this whole section exists to prevent.

Every movement on screen needs an identifiable purpose, and the visual and the
narration should make the *same* point so they reinforce rather than compete
(this is 3Blue1Brown's rule and it is the right one).

Reach for **scene-first** when the subject is behaviour, motion, state over
time, spatial relationships, or anything with a before/after you could point at.
That is most explainers.

Reach for **panels** when the subject genuinely is text: an API's shape, a
list of rules, a comparison of two names. And for showcases, where footage is
the content.

Practical rules for scenes:

- **Author in world units, never pixels.** Pixel coordinates only make sense
  relative to the frame, so the frame becomes the layout and you are back to a
  centred column.
- **Use the vertical.** The frame is 1080x1920. A landscape diagram in it wastes
  two thirds of the screen. Lanes run top-to-bottom, comparisons sit side by side.
- **Simulate, don't keyframe.** `useSim` runs a real update loop at a real rate.
  If the thing being explained is "these two behave differently", run both and
  let them differ — a hand-animated divergence is just an assertion with extra
  steps.
- **Sims run on composition time by default**, so a scene keeps running across
  beat boundaries and only the annotations change. `time: 'beat'` restarts one.
- **Verify the claim numerically** before trusting the picture. Print the values
  the sim produces and check they actually show what the narration says.

## Phase 1 — research and script

1. **Research the concept properly.** *(educational only — skip for a
   showcase.)* Not just the definition — find the common misconceptions, the wrong mental model people actually hold, and where the
   confusion persists. Search if the topic is unfamiliar. This research is what
   makes the video worth making.
2. Write `projects/<slug>/script.md` in the format in
   `references/script-format.md`: hook, the confusion section, beats table,
   clean narration block, delivery notes.
3. Narration is written **to be read aloud in the user's voice**: plain, direct,
   no presenter filler. See the do/don't list in `references/script-format.md`.
4. Total runtime **35-50 seconds**, estimated at ~2.6 words/sec. Silent
   explainers target 18-40s; showcases have no target.

For a **showcase**, `script.md` is just: a layout sketch, the exact on-screen
text, and an explicit list of what is deliberately NOT in the video. Do not
invent explanatory beats the user did not ask for.

### ⛔ STOP HERE

**Show the script and wait for approval. Do not write a single line of TSX
until the user approves it.**

**This applies to trivial videos too.** A one-beat showcase still gets a script
first. "It's simple" is not an exemption — a simple video is precisely where the
wrong framing is cheapest to catch and most likely to be assumed.

Expect edits — that's the point. Iterating in markdown is cheap; iterating in
animation code is not. Do not create `beats.yaml`, do not create `Video.tsx`,
do not touch the kit. If the user asks a clarifying question, answer it and
stay in Phase 1.

## Phase 2 — build (only after explicit approval)

1. Write `projects/<slug>/beats.yaml` from the approved script.
2. `npm run build-beats <slug>` → generates `beats.generated.ts`.
3. Write `projects/<slug>/Video.tsx` composing **kit components only**. It must
   export `Video` and take `{ theme, debug }`.
4. Set `theme:` in `beats.yaml`. Registration is automatic — `npm run sync`
   scans `projects/` and writes `src/registry.generated.ts`; never edit
   `src/Root.tsx` to add a video.
5. `npx tsc --noEmit`
6. **Run the QA loop below until clean.**

### After the VO is recorded

Save it to `public/videos/<slug>/vo.wav`, then:
```bash
npm run process-vo <slug>  # clean up + normalise to -16 LUFS
npm run retime <slug>      # transcribe, re-time beats, regenerate
```
Then run the QA loop again — real timings expose holds the estimate hid.

`process-vo` is non-destructive: it keeps the original as `vo.raw.wav` and works
from that copy forever after, so settings can be re-tried freely. Tune it by
**measuring the voice**, not by reaching for a preset — octave-band levels tell
you whether "nasal" is a midrange peak to cut or (far more often) a missing
bottom octave to lift. Flags: `--bass --mid --midf --highs --deess --hpf --pad
--denoise --dry`.

`retime` aligns script to transcript with Needleman-Wunsch, so improvising is
survivable — it prints a fidelity score. **Below ~75% means the `vo` lines no
longer describe what was said: rewrite them from the transcript and re-run**,
which tightens every boundary. Words whisper reliably mishears go in a
`corrections:` map in `beats.yaml`, because burned-in captions show the error
and hand-editing `captions.json` does not survive the next run.

### Music

Drop tracks in `public/music/<genre>/`, add a row to `public/music/music.yaml`
with source + licence, then `npm run analyse-music`. Pass
`music={{ track, seed, volume }}` to `<Stage>`. Entry points are downbeats in
loud parts of the track, picked by seed — so reusing one track across videos
does not sound like reusing one track.

---

# ⚠️ QA loop — mandatory, not optional

**You cannot watch video. After EVERY scene edit you MUST run the contact sheet
and actually read the output image.** A change is not done until a contact sheet
has been rendered and inspected since the last edit.

```bash
./scripts/contact-sheet.sh <slug>-<theme>                  # 12 stills
./scripts/contact-sheet.sh <slug>-<theme> --count 20 --cols 5
./scripts/contact-sheet.sh <slug>-<theme> --debug          # safe-area overlay
```

Then **read the PNG** at `out/contact-sheets/<id>.png` with the Read tool.

Check every sheet for:

- [ ] **Text overflow** — clipped code lines, truncated titles, text escaping a panel.
- [ ] **Overlapping elements** — anything colliding with anything else.
- [ ] **Safe areas** — nothing in the top 12%, bottom 20%, or right rail.
      Verify with `--debug` after any layout change.
- [ ] **Caption band** — captions inside it, nothing else inside it, never over code.
- [ ] **Static holds** — if two consecutive samples are identical and more than
      ~3s apart, the beat is dead. Stagger the reveals across the beat.
- [ ] **Mid-transition end states** — confirm a `CodeDiff` actually resolves to
      the `after` state; sample densely enough to catch it.

Fix and re-run until clean. **Only then tell the user it's done.** Never report
a scene as finished on the strength of a successful render — a render exits 0
with text hanging off the frame.

Verify every theme a video is registered for before calling it complete; motion
timing differs per theme, so a hold that's fine in `brut` can be dead in
`paper`. Footage-led videos are usually registered for one theme only.

---

# Commands

```bash
npm run studio                                   # interactive preview
npm run build-beats [slug]                       # beats.yaml -> generated ts
npm run retime <slug>                            # re-time from recorded VO
npx tsc --noEmit                                 # typecheck

./scripts/contact-sheet.sh <comp-id> [--count N] [--cols N] [--scale S] [--debug]
./scripts/render.sh <comp-id>                    # one MP4
./scripts/render.sh <slug> --themes              # every theme of a video
```

Composition ids are `<slug>-<theme>`, e.g. `value-vs-reference-neon`.
Themes: `cosmic` (default), `gizmo`, `debugview`, `ps1`, `garage`, `midnight`,
`nightdrive`, and `neon`/`paper`/`brut` (kept only as "too clean" comparison
points).

# Hard rules

1. **Never write TSX before the script is approved.**
2. **Never skip the contact sheet.** Read the image, don't just render it.
3. **Never hardcode a visual value** — colours, sizes, radii, shadows and
   springs come from the theme. See `references/style.md`.
4. **Never position by hand in a video file.** Compose kit primitives. If the
   kit lacks something, add it to the kit first.
5. **Never guess the Remotion API.** Check `references/remotion-api.md`; if it
   isn't there, read the `.d.ts` in `node_modules` and then add it to the
   reference.
6. Runtime follows the video type — see the Phase 0 table. 35-50s narrated,
   18-40s silent explainer, no target for a showcase.
7. **Establish the video type before writing the script**, and never invent
   explanatory structure the user did not ask for.
8. **The visual must carry information the narration does not.** Cover the
   captions; if the picture no longer makes the point, rebuild the beat. See
   Phase 0.5.
9. **Scene-first is the default.** Choosing a panel stack for an explainer is a
   decision that needs a stated reason.
