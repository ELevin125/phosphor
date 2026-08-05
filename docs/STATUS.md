# STATUS

Where the project actually is. Rewritten freely — this doc has no historical
value, and if it disagrees with reality, reality wins.

**Last updated:** 2026-08-05

## In one paragraph

Short-form works and has shipped ten videos. The engine was reviewed on
2026-07-31 and Phases 1 and 2 of the resulting plan are **done**: machine QA,
output hygiene, tests, a linter, one theme, profile-resolved typography, and a
tiered kit. Long-form (up to 5 minutes, landscape, no burned-in captions) is
**designed but unbuilt**, and gated behind a one-chapter pilot rather than being
built speculatively.

The open problem is no longer the engine. Four uploads were measured on
2026-08-04 and the videos are well-built and under-watched — see
[RETENTION.md](RETENTION.md). The tooling now enforces what it can of that.

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

## Done on 2026-08-01

- **SRT sidecar** (`npm run srt`). Reuses the kit's own phrase grouper, so cues
  break where burned-in captions would. 63 cues over 98.2s on cache-locality.
- **Captions are a profile property.** `usesCaptions` — true portrait, false
  landscape — so a landscape video cannot silently lose 136px by forgetting
  `showCaptions={false}`. Seven new tests pin both profiles' geometry.
- **`check` and `srt` wired into `build.ts`** as report-only stages, with
  `--no-check` for the tight edit loop and a warning in the summary when it is
  skipped. Reporting stages no longer abort a build on findings.
- **Fixed an unrecoverable-action bug in `process-vo`** — see
  [D012](DECISIONS.md#d012). It adopted its own output as the untouched
  original. Found by triggering it; no data lost.
- `npm run check` swept all eleven shipped videos. Ten clean; the eleventh was a
  false-positive class (board layout), now exempted.

**Verification:** typecheck, lint, 55 tests, full `npm run build cache-locality`
green through every stage.

### Later on 2026-08-01 — `second-listener` review pass

Reviewed the shipped portrait cut frame by frame. The engine was fine; three of
the findings were defects in the kit that every video inherits.

- **Arrowheads had their own line running through them** — see
  [D015](DECISIONS.md#d015). Present in every `Graph`/`Fanout` diagram ever
  rendered.
- **Captions could invert the narration** — see [D013](DECISIONS.md#d013). A
  muted viewer read "a very good solution," while the voice said it was not one.
- **Beat boundaries stranded conjunctions** — see [D014](DECISIONS.md#d014).
  Six of seven beats ended on a dangling "and".
- `src/kit/captions/phrases.test.ts` added, 6 tests. **61 tests total.**
- Video-local: the outward fan now persists as a band above the code through
  beats 3–5 instead of vanishing for twenty-five seconds, so the reversal
  reverses something the viewer has been looking at; the reversal was retimed
  onto "and then it shuts up", the line it dramatises, from two and a half
  seconds after it. The player's listener said `_dead = true` while the code
  said `EndRun()`. The code panel's top edge is pinned across beats 3–5 so the
  signature holds still while the body changes.

**Verification:** typecheck, lint, 61 tests, `npm run check second-listener`
clean, re-rendered and reviewed at 1080×1920 / 68.6s.

**Found while sweeping, NOT caused by this work and NOT fixed** — both are in
already-shipped videos and neither uses `Graph`:
- `every-frame` — 10 findings in beat `howfar`, a `<rect>` at x −1620..2700.
- `flow-field` — 6 findings in beat `arrows`, `ROUTE COST` overflowing the
  content box to the right.

## Done on 2026-08-05

Four uploads were measured on Instagram and the findings written up in
[RETENTION.md](RETENTION.md). The engine work below is what came out of it.

- **The 2.6 words/sec figure was still live** in
  `references/script-format.md` — the file the script-writing phase actually
  reads. SKILL.md and `script-check.ts` had both been corrected to 3.1 and this
  had not, which is the direct cause of every shipped short running 68-75s
  against a 40-50s target. Runtime figures across SKILL.md moved to 40-50s.
- **`script-check` enforces the four retention rules a regex can see** — the
  runtime ceiling, hook length, a sequel reference in beat 1, and whether any
  beat boundary falls where a second loop would have to open. The first three
  fire on `every-frame`, which is the video they were derived from. The
  onset rules are about pixels and stayed out.
- **Short-form rules are gated on `profile`**, not runtime, so the landscape
  pilot is not told to cut its 278s to 50.
- **Projects can be archived.** `archived: true` in beats.yaml retires a shipped
  video from the sweep; it still renders, still registers, and is still reviewed
  when named. Nine shipped videos archived. The sweep went from ~40 warnings to
  4, all on the active pilot — every archived script was written at 2.6 w/s and
  tripped the rate check on every single beat.
- **CI added** — lint, test, typecheck on push and PR. Deliberately not `check`
  or `script`, which read gitignored user data and would pass vacuously.
- `"type": "module"` added to package.json, silencing an eslint warning on every
  run. `phosphorSrc.zip` (246MB, untracked, unignored) deleted.

**Verification:** typecheck, lint, 61 tests, `npm run script` sweep and against
named archived projects. CI itself is unverified — it has never run.

**Considered and rejected:** decoupling `pretypecheck` from `analyse-music`.
That coupling is correct — `analyse-music` writes `src/music.generated.ts`,
which `Music.tsx` imports, so a typecheck genuinely needs it.

**Still not fixed:** the geometry findings in `every-frame` (10, beat `howfar`)
and `flow-field` (6, beat `arrows`), below. Both videos are now archived, which
is the decision to leave them: they have shipped, and the findings are recorded
here if either is ever recut.

## Known-unverified

- **`typeBase: 32` holds up in contact sheets** but has not been watched at
  size. Downgraded from "guess" — it is no longer blocking anything.
- **Chapter markers are untested.** The pilot deliberately has none: two
  chapters inside 98s did not want a title card. Unknown whether five acts do.
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
| ~~SRT sidecar~~ | **built** — `npm run srt`, wired into build |
| ~~landscape profile without a caption band~~ | **built** — profiles declare `usesCaptions` |
| ~~coupled code+scene~~ | **built**, video-local in cache-locality |
| per-beat file split for large videos | designed, not built |

**These are deliberately gated.** See [D007](DECISIONS.md#d007): the risk in
long-form is not per-shot animation quality, which the shorts demonstrate. It is
coherence across ~40 beats, editorial judgement across 5 minutes, and 6× the
volume. Building the machinery before making one chapter would be specifying
from estimates rather than evidence.

## Next

1. **The pilot: `cache-locality`, chapters 1–2, landscape.** Decided 2026-08-01.
   Audio already exists (98.6s, ten beats, already split `race-*` / `mem-*`), so
   no recording is needed. Shot list written and approved:
   `projects/cache-locality/shots.md`.

   Predictions written down in advance, so the pilot is falsifiable:
   - the coupled code/scene component takes 2–3 passes to be readable at 1920×1080;
   - the first sim revisit feels like a repeat rather than a development;
   - ~~the first hero sim gets over-built~~ — **already disproven**, `sim.ts`
     exists at the right size and needs no new work;
   - `typeBase: 32` will be too small for these label-dense shots.

2. **Then** decide whether to build the long-form machinery, using a real cost
   number rather than an estimate.

3. Only then, a long-form design doc.

## Open questions for the user

- None outstanding. `out/_legacy/` is being kept.
