/**
 * Machine QA. Renders sample frames, measures what actually landed on screen,
 * and reports every violation as text.
 *
 *   npm run check <slug>            # every composition for that project
 *   npm run check <composition-id>
 *   npm run check <id> --samples 40
 *   npm run check <id> --json       # machine-readable, for a wrapper
 *
 * This replaces the part of the QA loop that used to be "render a contact sheet
 * and look at the PNG". Overflow, safe areas, caption-band intrusion, collisions
 * and static holds are geometry — exact to compute, expensive and unreliable to
 * eyeball, and a 12-frame sheet samples one frame per 25 seconds of a 5-minute
 * video. See docs/DECISIONS.md#d009.
 *
 * What it deliberately does NOT check: whether the picture makes the point.
 * That is what the contact sheet is still for.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { withAliases } from './webpack-override';
import { getCompositions, openBrowser, renderStill } from '@remotion/renderer';
import { PROFILES, type Layout } from '../src/kit/layout';
import type { ProbeBox } from '../src/kit/Probe';
import { PROBE_PREFIX } from '../src/kit/Probe';

const ROOT = process.cwd();

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const JSON_OUT = args.includes('--json');
const flag = (name: string, fallback: number): number => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

if (!target) {
  console.error('usage: npm run check <slug|composition-id> [--samples N] [--json]');
  process.exit(1);
}

/**
 * How many frames to measure.
 *
 * 24 is a lot more than a contact sheet's 12 because each sample costs a still
 * render and some arithmetic rather than an image somebody has to read, so the
 * sampling rate is no longer limited by attention.
 */
const SAMPLES = flag('samples', 24);

/**
 * Slack, in px, before a bounds violation is reported.
 *
 * Not zero: antialiasing, sub-pixel text metrics and rounded borders all put a
 * glyph a pixel or two past its box, and a checker that fires on those gets
 * ignored, which is worse than one that misses a 2px overhang.
 */
const TOLERANCE = 4;

/**
 * Slack for scene geometry, which has inherently soft edges — a stroke is
 * centred on its path, so a 3px line is 1.5px past wherever you put it, and a
 * projected wireframe vertex lands wherever the maths says.
 */
const GRAPHIC_TOLERANCE = 24;

/** Fraction of the smaller element's area that must overlap to count. */
const OVERLAP_RATIO = 0.35;

/**
 * Seconds a frame may be pixel-identical to the previous sample before it reads
 * as a dead hold. Doubles as the engagement metric — see docs/FORMAT.md.
 */
const STATIC_HOLD_SECONDS = 20;

type Finding = {
  readonly kind: string;
  readonly frame: number;
  readonly seconds: number;
  readonly detail: string;
};

const rect = (b: ProbeBox) => ({
  left: b.x,
  top: b.y,
  right: b.x + b.width,
  bottom: b.y + b.height,
});

const overlapArea = (a: ProbeBox, b: ProbeBox): number => {
  const ra = rect(a);
  const rb = rect(b);
  const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
  const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
  return w > 0 && h > 0 ? w * h : 0;
};

/**
 * Every rule, applied to one measured frame.
 *
 * Each rule states the bound it checked in the message. A finding that says
 * "right edge 1104 > content.right 972" can be acted on without opening the
 * file; one that says "overflow" cannot.
 */
const inspect = (boxes: readonly ProbeBox[], layout: Layout, hasCaptions: boolean): string[] => {
  const out: string[] = [];
  const { content, safe, canvas, captionBandTop, captionBandBottom } = layout;

  for (const b of boxes) {
    const r = rect(b);
    // Naming the beat turns a bare frame number into somewhere to look.
    const where = b.beat ? `[${b.beat}] "${b.label}"` : `"${b.label}"`;

    /*
      Scene geometry gets a looser rule than text throughout.

      `Scene3D` draws with `overflow: visible` deliberately — clipping the SVG
      throws a line across the whole frame — so a wireframe edge a few pixels
      past a boundary is the system working. Text in the same place is clipped
      or covered by platform UI, which is not. Strokes are centred on their path
      too, so a 3px line is always 1.5px past wherever it was put.

      Without this split, gimbal-lock reported 60 findings, 59 of them the same
      wireframe doing exactly what it was written to do.
    */
    const slack = b.ink === 'graphic' ? GRAPHIC_TOLERANCE : TOLERANCE;

    // Off-canvas is the worst case and reads as clipped text, so it is reported
    // on its own rather than as another content-box overflow.
    if (r.right > canvas.width + TOLERANCE || r.left < -TOLERANCE) {
      out.push(`off-canvas   ${where} x ${r.left}..${r.right} outside 0..${canvas.width}`);
      continue;
    }

    if (b.role === 'caption') {
      if (r.top < captionBandTop - slack || r.bottom > captionBandBottom + slack) {
        out.push(
          `caption-band ${where} y ${r.top}..${r.bottom} outside band ${captionBandTop}..${captionBandBottom}`,
        );
      }
      continue;
    }

    // Content in the band is the failure the band exists to prevent: captions
    // landing on top of code.
    if (hasCaptions && r.bottom > captionBandTop + slack && r.top < captionBandBottom) {
      out.push(`in-caption-band ${where} y ${r.top}..${r.bottom} enters band at ${captionBandTop}`);
      continue;
    }

    if (r.top < safe.top - slack) {
      out.push(`safe-top     ${where} y ${r.top} above safe top ${safe.top}`);
    }
    if (r.bottom > canvas.height - safe.bottom + slack) {
      out.push(
        `safe-bottom  ${where} y ${r.bottom} below safe bottom ${canvas.height - safe.bottom}`,
      );
    }

    if (b.ink === 'graphic') {
      continue;
    }

    if (r.right > content.right + TOLERANCE) {
      out.push(`overflow-x   ${where} right ${r.right} > content.right ${content.right}`);
    }
    if (r.left < content.left - TOLERANCE) {
      out.push(`overflow-x   ${where} left ${r.left} < content.left ${content.left}`);
    }
  }

  /*
    Collisions, between text leaves only.

    Nested elements overlap by construction — a panel contains its own label —
    so a pair is only considered when neither is an ancestor of the other. Depth
    equality is a cheap proxy for that and costs a few missed cousins, which is
    the right trade against reporting every panel as colliding with its contents.

    Both elements must also be essentially opaque. `CodeDiff` stacks the before
    and after lines in the same position and cross-fades between them, so
    mid-transition "struct" genuinely does sit on top of "class" at 95% overlap
    — which is the effect working, not a bug. Without this the checker reported
    four findings on a video that has nothing wrong with it.
  */
  const text = boxes.filter((b) => !b.label.startsWith('<') && b.opacity > 0.9);
  for (let i = 0; i < text.length; i += 1) {
    for (let j = i + 1; j < text.length; j += 1) {
      const a = text[i];
      const b = text[j];
      if (!a || !b || a.depth !== b.depth) {
        continue;
      }
      const area = overlapArea(a, b);
      if (area === 0) {
        continue;
      }
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (area / smaller > OVERLAP_RATIO) {
        out.push(
          `collision    "${a.label}" overlaps "${b.label}" by ${Math.round((area / smaller) * 100)}%`,
        );
      }
    }
  }

  return out;
};

/**
 * Hides the probe payload from the terminal.
 *
 * Remotion echoes page console output itself, in addition to handing it to
 * `onBrowserLog`, so every sample would dump a few kilobytes of JSON over the
 * report. Filtering at the stream is the only place to catch it — the log is
 * already on its way out by the time the callback runs.
 */
const withProbeOutputHidden = <T,>(fn: () => Promise<T>): Promise<T> => {
  const streams = [process.stdout, process.stderr] as const;
  const originals = streams.map((s) => s.write.bind(s));

  streams.forEach((stream, i) => {
    const original = originals[i];
    if (!original) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matching write's overloads exactly is not worth it here.
    stream.write = ((chunk: any, ...rest: any[]): boolean =>
      String(chunk).includes(PROBE_PREFIX) ? true : original(chunk, ...rest)) as typeof stream.write;
  });

  const restore = (): void => {
    streams.forEach((stream, i) => {
      const original = originals[i];
      if (original) {
        stream.write = original;
      }
    });
  };

  return fn().then(
    (v) => {
      restore();
      return v;
    },
    (e: unknown) => {
      restore();
      throw e;
    },
  );
};

const main = async (): Promise<void> => {
  const qaBase = join(ROOT, 'out');

  console.log('› bundling...');
  const serveUrl = await bundle({
    entryPoint: join(ROOT, 'src', 'index.ts'),
    onProgress: () => undefined,
    webpackOverride: withAliases,
  });

  const comps = await getCompositions(serveUrl);
  const matches = comps.filter((c) => c.id === target || c.id.startsWith(`${target}-`));

  if (matches.length === 0) {
    console.error(`error: no composition matching '${target}'. Available:`);
    for (const c of comps) {
      console.error(`  ${c.id}`);
    }
    process.exit(1);
  }

  const browser = await openBrowser('chrome');
  const report: Record<string, Finding[]> = {};
  let total = 0;

  for (const comp of matches) {
    const findings: Finding[] = [];
    const profileName = comp.width > comp.height ? 'landscape' : 'portrait';
    const layout = PROFILES[profileName];

    const slug = comp.id.replace(/-gizmo$/, '');
    const tmp = join(qaBase, slug, 'qa', '.check');
    mkdirSync(tmp, { recursive: true });

    console.log(`\n› ${comp.id} — ${SAMPLES} samples across ${comp.durationInFrames} frames`);

    let hasCaptions = false;
    const hashes: { frame: number; hash: string }[] = [];

    for (let i = 0; i < SAMPLES; i += 1) {
      // Interval midpoints, so a sample never lands on frame 0 of a fade.
      const frame = Math.floor((i + 0.5) * (comp.durationInFrames / SAMPLES));
      const seconds = Number((frame / comp.fps).toFixed(1));
      const still = join(tmp, `${i}.png`);

      let boxes: ProbeBox[] = [];
      await withProbeOutputHidden(() =>
        renderStill({
          composition: comp,
          serveUrl,
          output: still,
          frame,
          inputProps: { measure: true },
          puppeteerInstance: browser,
          imageFormat: 'png',
          overwrite: true,
          logLevel: 'error',
          onBrowserLog: (log) => {
            const at = log.text.indexOf(PROBE_PREFIX);
            if (at >= 0) {
              boxes = JSON.parse(log.text.slice(at + PROBE_PREFIX.length)) as ProbeBox[];
            }
          },
        }),
      );

      if (boxes.some((b) => b.role === 'caption')) {
        hasCaptions = true;
      }

      hashes.push({
        frame,
        hash: createHash('sha1').update(readFileSync(still)).digest('hex'),
      });

      for (const detail of inspect(boxes, layout, hasCaptions)) {
        findings.push({ kind: detail.split(/\s+/)[0] ?? 'unknown', frame, seconds, detail });
      }
      process.stderr.write('.');
    }
    process.stderr.write('\n');

    /*
      Static holds. Consecutive samples that are pixel-identical mean nothing
      moved for at least the gap between them — a dead beat, which at long-form
      length is the difference between a video that holds and one that does not.
    */
    for (let i = 1; i < hashes.length; i += 1) {
      const prev = hashes[i - 1];
      const cur = hashes[i];
      if (!prev || !cur || prev.hash !== cur.hash) {
        continue;
      }
      const gap = (cur.frame - prev.frame) / comp.fps;
      if (gap >= STATIC_HOLD_SECONDS) {
        findings.push({
          kind: 'static-hold',
          frame: prev.frame,
          seconds: Number((prev.frame / comp.fps).toFixed(1)),
          detail: `static-hold  nothing changed for ${gap.toFixed(1)}s (f${prev.frame}–f${cur.frame})`,
        });
      }
    }

    rmSync(tmp, { recursive: true, force: true });
    report[comp.id] = findings;
    total += findings.length;

    if (findings.length === 0) {
      console.log(`  ✓ clean`);
    } else {
      /*
        Grouped by kind and subject, not by the exact message.

        A panel that overflows is measured at slightly different coordinates on
        every frame it is animating, so grouping on the full string produced one
        line per frame — 60 findings for what was really two problems. The
        coordinates of the first occurrence are kept, because those are what you
        need to act on; the count says how long it persisted.
      */
      const groups = new Map<string, Finding[]>();
      for (const f of findings) {
        const key = `${f.kind}::${f.detail.match(/"([^"]*)"/)?.[1] ?? f.detail}`;
        const list = groups.get(key) ?? [];
        list.push(f);
        groups.set(key, list);
      }
      for (const group of groups.values()) {
        const first = group[0];
        if (!first) {
          continue;
        }
        const at =
          group.length === 1
            ? `f${first.frame} (${first.seconds}s)`
            : `${group.length} samples from f${first.frame} (${first.seconds}s)`;
        console.log(`  ✗ ${first.detail}  — ${at}`);
      }
    }
  }

  await browser.close({ silent: true });

  if (JSON_OUT) {
    const path = join(qaBase, 'check.json');
    writeFileSync(path, JSON.stringify(report, null, 2));
    console.log(`\n› wrote ${path}`);
  }

  console.log(
    total === 0
      ? `\n✓ ${matches.length} composition${matches.length === 1 ? '' : 's'} clean`
      : `\n✗ ${total} finding${total === 1 ? '' : 's'}`,
  );

  // Non-zero on findings so this can gate a build or a commit hook.
  process.exit(total === 0 ? 0 : 1);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
