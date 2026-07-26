# Remotion API cheatsheet — verified against remotion@4.0.499

Every signature below was read out of the shipped `.d.ts` files in
`node_modules`, not from the docs site. Versions in this project:

| package | version |
|---|---|
| `remotion`, `@remotion/*` | `4.0.499` |
| `react` / `react-dom` | `19.2.8` |
| `shiki` / `@shikijs/*` | `4.3.1` |
| `typescript` | `5.9.3` |
| node | `22.23.1` (vendored in `.tooling/`) |

> TypeScript 7.0.2 is published as `latest` but is **not** used here — Remotion
> 4.0.499's types are not validated against it. Stay on 5.9.x.

---

## The things that actually bite

### 1. `interpolate` extrapolates past your range by default

```ts
interpolate(frame, [0, 20], [0, 1])            // at frame 100 -> 5, not 1
interpolate(frame, [0, 20], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
})                                              // what you almost always want
```

Defaults are `'extend'` on both sides. `inputRange` and `outputRange` must be
the same length, and a per-segment `easing` array must be `inputRange.length - 1`.

Full option set (from `no-react/interpolate.d.ts`):
`extrapolateLeft`, `extrapolateRight`, `easing`, `output` (`'linear' | 'perceptual-scale'`),
`posterize`.

### 2. `spring` applies its options in a fixed order

```ts
spring({
  frame, fps,
  config?: Partial<{ damping; mass; stiffness; overshootClamping }>,
  from?, to?, durationInFrames?, durationRestThreshold?, delay?, reverse?,
}): number
```

Order of operations is **duration stretch → reverse → delay**. Two consequences:

- `durationRestThreshold` does nothing unless `durationInFrames` is set.
- `delay` shifts the whole curve; you do **not** subtract it from `frame` yourself.

Defaults: `damping: 10`, `mass: 1`, `stiffness: 100`, `overshootClamping: false`.
Springs overshoot past `to` and settle back unless clamped.

### 3. `<Sequence>` shifts `useCurrentFrame()` for its children

Inside `<Sequence from={30}>`, children see frame `0` when the composition is at
frame `30`. This is why kit components never need to know their absolute offset.

Props (`Sequence.d.ts`): `from` (default `0`), `durationInFrames` (default
`Infinity`), `name`, `layout` (`'absolute-fill' | 'none'`), `premountFor`,
`postmountFor`, `trimBefore`, `freeze`, `showInTimeline`, `hidden`, `style`,
`className`.

`layout="none"` removes the wrapping absolutely-positioned div.

### 4. `Easing` is a class of statics, not a module of functions

```ts
import { Easing } from 'remotion';
interpolate(f, [0, 1], [0, 1], { easing: Easing.inOut(Easing.cubic) });
```
Available: `linear ease quad cubic poly sin circle exp elastic back bounce
bezier step0 step1 spring`, plus wrappers `in out inOut`.

### 5. Async work needs `delayRender` — so avoid async work

```ts
const handle = delayRender('why');
await something();
continueRender(handle);
```
The component tree is re-evaluated **every frame**. Anything async runs ~1000+
times per render and can produce different output per frame. This project
sidesteps it entirely for syntax highlighting — see `references/kit.md`.

`@remotion/google-fonts`' `loadFont()` uses `delayRender` internally, which is
correct and desirable, but only call it **once per theme** (the kit guards this
with a module-level `Set`).

### 6. `@remotion/captions` — note the capitalisation

`createTikTokStyleCaptions` has a capital **T** in both "Tik" and "Tok".
Getting this wrong is the single most common import error here.

```ts
type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;   // nullable
  confidence: number | null;    // nullable
};

createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds }): { pages: TikTokPage[] }
parseSrt({ input }): { captions: Caption[] }
serializeSrt({ lines: Caption[][] }): string
// also exported: ensureMaxCharactersPerLine({ captions, maxCharsPerLine })
```

This project does **not** use `createTikTokStyleCaptions` — it groups words into
held 3-5 word phrases instead (see `kit/captions/phrases.ts` and the rationale
in `references/style.md`).

### 7. `@remotion/install-whisper-cpp`

```ts
installWhisperCpp({ version, to, printOutput?, signal? })
downloadWhisperModel({ model, folder, printOutput?, onProgress?, signal? })
transcribe({
  inputPath, whisperPath, whisperCppVersion, model, tokenLevelTimestamps,
  modelFolder?, translateToEnglish?, language?, splitOnWord?, onProgress?, ...
})
toCaptions({ whisperCppOutput }): { captions: Caption[] }
```

Models: `tiny tiny.en base base.en small small.en medium medium.en
large-v1 large-v2 large-v3 large-v3-turbo`.

**The audio must be 16kHz mono PCM WAV.** whisper.cpp rejects anything else:

```bash
ffmpeg -y -i vo.wav -ar 16000 -ac 1 -c:a pcm_s16le vo-16k.wav
```

`toCaptions` requires `TranscriptionJson<true>` — i.e. you must have passed
`tokenLevelTimestamps: true`, or it will not typecheck.

### 8. `<Audio>`: `startFrom` / `endAt` were renamed

Use `trimBefore` / `trimAfter`. The old names still exist but are deprecated.

`remotion` exports `Audio` (used here) and `Html5Audio`; `@remotion/media`
additionally exports a newer `Audio`/`Video` pair. For a plain VO wav the
`remotion` one is fine and is the stable choice.

### 9. Composition dimensions vs `calculateMetadata`

`<Composition>` requires **either** explicit `width`/`height`/`fps`/`durationInFrames`,
**or** a `calculateMetadata` function that returns them. Mixing them partially
is a type error. This project passes them explicitly from the generated beats.

---

## CLI

```bash
# arg order: <serve-url|entry> [<composition-id>] [<output>]
npx remotion still  <bundle> <comp-id> out.png --frame=120 --scale=0.25 --image-format=png
npx remotion render <bundle> <comp-id> out.mp4 --codec=h264 --crf=18
npx remotion bundle src/index.ts --out-dir=out/.bundle
npx remotion compositions <bundle>
npx remotion studio
```

- `still` supports `--frame`, `--scale` (0 < s ≤ 16), `--image-format`,
  `--jpeg-quality`, `--props`, `--log`. There is **no** `--width` / `--height`.
- **`--scale` changes the device pixel ratio, and that silently breaks effects
  that depend on pixel-level SVG filter subregions.** The `ps1` CRT mosaic
  filter renders *completely blank* at `--scale=0.25` while being perfect at
  `1`. `contact-sheet.sh` therefore renders full-resolution stills and
  downscales with ImageMagick instead — slower, but a preview that lies is
  worse than no preview.
- **Bundle once, then pass the bundle directory** as the serve-url to every
  subsequent `still`/`render`. Passing `src/index.ts` re-bundles each time,
  which makes a 12-frame contact sheet ~12x slower than it needs to be.
- `npx remotion compositions` prints its table at log level **info**, so
  `--log=error` suppresses the very output you are trying to parse. Filter the
  rows instead. Columns are: `<id> <fps> <width>x<height> <durationInFrames> (<sec>)`.

## Config

`remotion.config.ts` only affects the CLI, never `renderMedia()`.

Remotion's bundler does **not** read `paths` from `tsconfig.json`. The `@kit`
and `@theme` aliases are mirrored in `Config.overrideWebpackConfig` — if you add
an alias to `tsconfig.json`, add it there too or the editor will resolve it
while the bundle fails.

## Environment notes

- Node is vendored at `.tooling/node-v22.23.1-linux-x64/`; `scripts/lib.sh`
  puts it on `PATH`. There is no system Node on this machine.
- Remotion downloads its own Chrome Headless Shell (~92MB) on first render into
  its cache. It is not in the repo.
- `ffmpeg`, `montage` and `convert` (ImageMagick 6) are system-installed and are
  what the contact sheet relies on.
