# FORMAT — what a Phosphor video is

The product design doc. This describes the videos, not the code. It is the
document to argue with when deciding whether something is worth building.

## The one rule

> **Cover the captions. Does the picture still make the point?**

If the visual only restates the words, it is a slide, and no theme, palette or
transition rescues it. A box containing the words "a throwaway copy", under
narration saying the method got a throwaway copy, carries **zero** information.

Everything below is downstream of this rule.

## Subject matter

Educational programming content, weighted toward game development. Concepts,
not tutorials — the aim is that someone understands *why* a thing behaves the
way it does, not that they can follow along and reproduce a result.

Shipped topics give the shape: value vs reference semantics, cache locality,
gimbal lock, frame-rate-dependent lerp, flow fields, delta time.

Topics that suit this format have **behaviour you can point at**: motion, state
over time, a spatial relationship, a before/after. Topics that are genuinely a
list of API names do not, and should not be forced into it.

## The two formats

|  | **short** | **long** |
|---|---|---|
| platform | Reels, Shorts | YouTube |
| frame | 1080×1920 portrait | 1920×1080 landscape |
| runtime | 35–50s target; **68–75s actual** | up to 5 minutes, hard ceiling |
| kind | explainer or showcase | educational deep dive only |
| structure | hook → build → payoff | chapters, each with its own arc |
| captions | burned in | **none** — SRT sidecar instead |
| narration | one take | one take, one file |
| status | **shipped, works** | **unproven** — see STATUS.md |

The short-form runtime figure is worth reading twice: every educational short
actually shipped runs 68–75s against a stated 35–50s target. The target
describes an intention, not the practice.

### Showcases

A short can be a showcase: footage with a label, as long as the clip. It has no
hook, no research, no payoff, and inventing explanatory structure for one is a
failure. Long-form is never a showcase.

## Narration

Written to be read aloud in the user's own voice — one gamedev talking to
another, mid-thought. The default failure is prose that is correct, tidy, and
sounds like bullet points being recited.

- Beats open on connectives: "So", "Now", "The thing is".
- Sentences run long, with commas.
- Always "we", never "you".
- **3.1 words per second.** Measured across 679 words and 216.9s of finished
  audio, not assumed. It was 2.6 until it was checked, which over-estimated
  every beat by ~20%.

The user records every voiceover. **The script is therefore a deliverable, not
an internal artifact**, and it gets approved before any animation code exists.
Iterating in markdown is cheap; iterating in animation code is not.

## Visual doctrine

**Scene-first is the default.** A *scene* is one continuous space in world
units, with real values changing over time and text anchored into it. A *panel
stack* is boxes of text in a centred column. Choosing panels for an explainer is
a decision that needs a stated reason.

- **Author in world units, never pixels.** Pixel coordinates only make sense
  relative to the frame, so the frame becomes the layout and you are back to a
  centred column.
- **Simulate, don't keyframe.** If the point is "these two behave differently",
  run both and let them differ. A hand-animated divergence is an assertion with
  extra steps.
- **Verify the claim numerically before trusting the picture.** Print the values
  the sim produces and check they show what the narration says. A wrong claim in
  narration costs a re-recording session.
- **Every movement needs an identifiable purpose.** The visual and the narration
  make the *same* point, so they reinforce rather than compete.

### The shot vocabulary (long-form)

Long-form cannot afford a bespoke simulation per beat — 40 beats of bespoke sim
is a week of work and a video that never gets a sequel. The resolution is that
cost and boredom have the same fix:

> **Build few sims. Return to them from new angles.**

3–4 hero sims per 5-minute video, each revisited 3–5 times with a different
camera, a different annotation layer, a zoom into one part, or a changed
parameter. One space the viewer learns to read beats thirty they re-orient in.

| shot type | cost | share of a 5-min video |
|---|---|---|
| hero sim (new) | 150–300 lines | 3–4 total |
| hero sim revisited | ~20 lines | the bulk of runtime |
| parameterised primitive | data only | frequent |
| coupled code + scene | snippet + spec | frequent |
| full-screen statement | ~free | emphasis beats only |
| the user's own footage | free to render | sparing |

**The anti-boredom rule:** no single visual state holds longer than ~20 seconds
without a change — camera move, new annotation, a value crossing a threshold, an
element entering. This is machine-checkable and `npm run check` enforces it.

### What does not go in a video

- **Decorative sprites, stock imagery, memes.** The "make it engaging" reflex
  produces exactly the generated-content texture this format exists to avoid.
- **Code as a slide.** Code earns screen time when it is *coupled* to a scene —
  the executing line highlighted in sync with what the simulation is doing. Code
  that merely sits there is a panel stack with syntax colouring.
- **Sourced footage, by default.** Generate assets programmatically instead; it
  is themed automatically and raises no licence question. The exception is the
  user's own game and editor footage, which is the one thing a simulation cannot
  do — it proves the phenomenon is real rather than a diagram someone drew.

Anything sourced rather than generated needs a licence and a source URL
recorded, the same discipline `public/music/music.yaml` already enforces for
tracks. "I found it on a royalty-free site" is not a licence you can point at
eight months later.

## Engagement, for long-form

What holds attention across five minutes, in order:

1. **Structure you can feel** — knowing where you are and why to continue. This
   is what chapters buy.
2. **Repeated tension and resolution.** Short-form needs one turn — a moment the
   obvious answer is shown wrong. Long-form needs roughly one per chapter.
3. **Pacing variation.** A held beat, then a fast one. Uniform beat lengths past
   ~90s are the clearest sign nobody made an editorial decision.
4. **The subject actually moving.**

Note that none of these are visual effects.

## Continuity

Within a chapter, mostly **do not transition**. Continuity is what makes five
minutes feel like one film rather than forty slides — hold the camera through
beat boundaries and change only the annotations. `gimbal-lock`'s orbit camera,
which never cuts across the whole video, is the model.

Save hard markers for chapter boundaries, where the viewer benefits from a
breath and a "you are here".

## Layout law

Content may only occupy the content box; captions only the caption band, where
captions exist at all. These bounds exist because the platforms overlay their
own UI, and anything outside them is covered by a username or a row of buttons.

Exact numbers live in `src/kit/layout.ts` and are derived, not typed in twice.
See ARCHITECTURE.md.

## Themes

One: `gizmo`. Engine-viewport structure in a deep-space palette. There were ten;
see DECISIONS.md#d002 for why there is now one.

**No component may hardcode a visual value.** A hex code or a px font size in
`src/kit` or `projects` is a bug — add a token instead. This still holds with a
single theme: it is what keeps visual values in one editable place.
