# STATUS

Where the project actually is. Rewritten freely — this doc has no historical
value, and if it disagrees with reality, reality wins.

**Last updated:** 2026-07-31

## In one paragraph

Short-form works and has shipped ten videos. The engine was reviewed on
2026-07-31 and Phases 1 and 2 of the resulting plan are **done**: machine QA,
output hygiene, tests, a linter, one theme, profile-resolved typography, and a
tiered kit. Long-form (up to 5 minutes, landscape, no burned-in captions) is
**designed but unbuilt**, and gated behind a one-chapter pilot rather than being
built speculatively.

## What works

- **Short-form, end to end.** Script → record → process → transcribe → review →
  retime → build → check → render. Ten shipped videos.
- **The voiceover pipeline.** Offline throughout; nothing is ever uploaded.
  Needleman–Wunsch alignment means improvising during the read is survivable.
- **Machine QA.** `npm run check` catches geometry violations as text.
- **Discovery.** Adding a video never touches engine code.

## Done on 2026-07-31

**Phase 1 — tooling**
- `npm run check` — headless layout validator. Measures every painted element at
  24 sampled frames; reports overflow, off-canvas, collisions, safe-area
  violations, caption-band intrusion and static holds as text, naming the beat.
- `out/` restructured to `out/<slug>/{qa,renders,deliver}`. Renders are numbered
  and never overwritten. `npm run clean` added. Old contents were **moved, not
  deleted**, to `out/_legacy/` — safe to delete once reviewed.
- eslint + vitest added. 48 tests over `diff.ts`, `space.ts`, `project.ts`,
  `align.ts` and the type scale. The linter immediately found five dead imports,
  two of which were leftovers from the unfinished layout migration.

**Phase 2 — architecture**
- **Themes: ten → one.** Only `gizmo` survives. Four projects repointed.
- **Type is profile-resolved.** Themes declare ratios; profiles supply the base
  (40px portrait, 32px landscape). This is what actually unblocks landscape.
- **Layout migration finished.** The module-level portrait constants are gone.
- **Kit tiered** frame / primitive / narrow, with a rule of three for promotion.
- Theme cross-product machinery (`PHOSPHOR_THEMES`, `render.sh --themes`) removed.
- Skill docs rewritten to match: they had drifted badly and were describing a
  theme API that had not existed for a long time.

**Verification:** `npm run typecheck`, `npm run lint`, `npm run test` (48
passing), and `npm run check` clean on `value-vs-reference` and `gimbal-lock`.

## Known-unverified

- **`typeBase: 32` for landscape is a guess.** Reasoned, but no landscape video
  exists to check it against. First thing to validate in the pilot.
- **The landscape profile has never rendered anything.** Bounds arithmetic is
  right; nothing has exercised it.
- **`check`'s collision rule is the least-proven.** It survived calibration
  against two videos. Expect to tune `OVERLAP_RATIO` when a third disagrees.
- **`kit/Crt.tsx` and the glass code paths are dead in practice** — gizmo sets
  both `enabled: false`. Kept deliberately; the effects worked and were hard to
  get right.
- `npm audit` reports a high-severity DoS advisory in `brace-expansion`, a
  transitive dev-only dependency. Not fixable without a forced major bump; no
  untrusted input reaches it.

## Not built

Everything long-form. Specifically:

| | status |
|---|---|
| chapters (`chapters:` in beats.yaml, per-chapter preview compositions) | designed, not built |
| shot list (`shots.md` between script and TSX) | designed, not built |
| coupled code+scene component (sim step drives the highlighted line) | designed, not built |
| SRT sidecar from existing word timings | designed, not built |
| landscape profile without a caption band | designed, not built |
| per-beat file split for large videos | designed, not built |

**These are deliberately gated.** See [D007](DECISIONS.md#d007): the risk in
long-form is not per-shot animation quality, which the shorts demonstrate. It is
coherence across ~40 beats, editorial judgement across 5 minutes, and 6× the
volume. Building the machinery before making one chapter would be specifying
from estimates rather than evidence.

## Next

1. **One chapter.** ~60 seconds, landscape, no captions, one hero sim revisited
   three times, one coupled code/scene shot, one full-screen statement. A real
   topic, intended for publication, so the editorial pressure is genuine.

   Predictions written down in advance, so the pilot is falsifiable:
   - the coupled code/scene component takes 2–3 passes to be readable at 1920×1080;
   - the first sim revisit feels like a repeat rather than a development, and
     needs an explicit "what is new here" per revisit;
   - the first hero sim gets over-built relative to what ends up on screen.

2. **Then** decide whether to build the long-form machinery, using a real cost
   number rather than an estimate.

3. Only then, a long-form design doc.

## Open questions for the user

- Topic for the pilot chapter.
- Whether `out/_legacy/` can be deleted.
