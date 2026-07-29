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
2. **Pick the slug and run `npm run new <slug>` before writing anything.** This
   creates `projects/<slug>/` and `public/videos/<slug>/`. The second one is the
   point: the user needs somewhere to paste the recording and any footage the
   moment the script is approved, and making them mkdir it by hand is friction
   at exactly the wrong moment. Do this even if the script may still change —
   an empty folder costs nothing.
3. Write `projects/<slug>/script.md` in the format in
   `references/script-format.md`: hook, the confusion section, beats table,
   clean narration block, delivery notes.
4. Narration is written **to be read aloud in the user's voice** — one gamedev
   talking to another, mid-thought. **Read the narration section of
   `references/script-format.md` before writing a single line.** It is worked
   from real recorded delivery, and the default failure is writing prose that is
   correct, tidy, and sounds like bullet points being recited. Beats open on
   connectives ("So", "Now", "The thing is"), sentences run long with commas,
   and it is always "we", never "you".
5. **Count the words and divide by 3.1 to get each beat's duration.** Do not set
   durations by feel — it is wrong every time, and being wrong by 2× is normal.
   Put the word count in the beats table so the arithmetic stays visible.

   3.1 w/s is measured, not assumed: 679 words over 216.9s of finished audio
   across the three recorded videos (3.05, 2.96, 3.40). This figure was 2.6
   until it was checked, which over-estimated every beat by about 20%.
6. Total runtime **35-50 seconds**. Silent explainers target 18-40s; showcases
   have no target. Note that every educational video actually shipped runs
   68-75s, so this range describes an intention rather than the practice — if
   the longer cut is the one you want, change the range rather than quietly
   overrunning it every time.

For a **showcase**, `script.md` is just: a layout sketch, the exact on-screen
text, and an explicit list of what is deliberately NOT in the video. Do not
invent explanatory beats the user did not ask for.

## Phase 1.5 — self-review, before the script is shown

The script is the one gate that cannot be re-run cheaply: everything downstream
is built from whatever gets waved through, and review cost grows with length
while attention does not. So the script gets reviewed **before** it is handed
over, not instead of.

**1. Run `npm run script <slug>`.** It checks what arithmetic can see — sections
present, word counts against durations, runtime, beat-length variation, beats
opening on a connective, "you" in the narration. Fix every `x` before going on.
Nothing in it has an opinion about whether the script is any good.

**2. Then review it yourself, against these six.** Write the answers out — a
review that produces no text is a rubber stamp with extra steps.

1. **Can every beat be shown?** For each beat, name the picture. A beat whose
   narration has no picture is a text panel, which is the one thing this
   architecture exists to avoid. This is the check that matters most and the
   one most easily skipped, because a beat can read beautifully and be
   unanimatable.
2. **Is there a turn?** A moment where the obvious answer is demonstrated
   wrong. Without one the video is "five things about X", which is precisely
   what generated content reads like. Point at the beat where it happens.
3. **Does it open on a claim, not a preamble?** The hook must not describe what
   the video will cover.
4. **Is it concrete?** Real API names, real numbers, a real failure. Generic
   phrasing here becomes generic animation later.
5. **Does it end with a guardrail?** When the video argues for a technique, the
   last beat says when *not* to use it. `second-listener`'s "don't
   overcomplicate it" is its strongest beat and inoculates against the
   cargo-culting the rest of the video would otherwise cause.
6. **Is the pacing deliberate?** At short-form length, uniform beats are fine.
   Past ~90s, uniform beat lengths are the clearest sign nobody made an
   editorial decision — long-form needs a held beat and a fast one.

**3. A failed review means rewriting, not annotating.** If 1, 2 or 5 fails,
revise the script and run the review again. Do not hand over a script with the
review attached as a list of known problems — that moves the work onto the user
and defeats the phase. Hand over what survived.

**4. Show the review with the script.** Two or three sentences on what was
checked and what changed as a result. The user is approving a script, and what
was already ruled out is part of what they are approving.

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
npm run build <slug>   # process-vo -> retime -> build-beats -> sync
```
Then run the QA loop again — real timings expose holds the estimate hid.

`npm run build` knows the pipeline's dependency order and skips stages whose
inputs have not changed. **Prefer it over running the stages by hand** — the
failure mode it prevents is silent: re-record, forget to retime, and you get a
finished video captioned from the previous take with no error anywhere.
`--force` rebuilds everything, `--dry` shows the plan.

`process-vo` is non-destructive: it keeps the original as `vo.raw.wav` and works
from that copy forever after, so settings can be re-tried freely. Tune it by
**measuring the voice**, not by reaching for a preset — octave-band levels tell
you whether "nasal" is a midrange peak to cut or (far more often) a missing
bottom octave to lift.

**Settings belong in the `vo:` block of `beats.yaml`, not in flags.** Flags
override the block and are for experimenting; once a setting is right, write it
into the yaml or the next run reverts it. Available: `bass`, `mid`, `midf`,
`highs`, `deess`, `hpf`, `lufs`, `pad`, `trim`, `denoise`. `--dry` is CLI-only.

`retime` aligns script to transcript with Needleman-Wunsch, so improvising is
survivable — it prints a fidelity score. **Below ~75% means the `vo` lines no
longer describe what was said: rewrite them from the transcript and re-run**,
which tightens every boundary. Words whisper reliably mishears go in a
`corrections:` map in `beats.yaml`, because burned-in captions show the error
and hand-editing `captions.json` does not survive the next run.

`retime` also stamps the script's punctuation onto the transcript, so the
caption grouper can break on sentences instead of counting words. **Run
`npm run captions` after every retime** — it scores phrasing in milliseconds and
catches breaks a 30-frame contact sheet never samples. See `references/style.md`.

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
      Phrasing is checked separately by `npm run captions`, not by eye — a sheet
      samples too few frames to catch a bad break.
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
npm run script [slug]                            # Phase 1.5 script self-review
npm run build-beats [slug]                       # beats.yaml -> generated ts
npm run retime <slug>                            # re-time from recorded VO
npm run captions [slug]                          # caption phrasing report
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
