/**
 * Script self-review — the measurable half.
 *
 *   npm run script                  # every script.md
 *   npm run script second-listener  # one, with the beat table
 *
 * Phase 1 ends with a script being shown for approval, and approval is the one
 * gate in this pipeline that cannot be re-run cheaply — everything downstream
 * is built from what gets waved through. So the things that CAN be checked
 * mechanically should be, before a human is asked to read anything.
 *
 * This deliberately checks nothing about whether the script is any good. It
 * checks the things that are wrong in a way arithmetic can see: durations that
 * do not match their word counts, a runtime outside the target, sections
 * missing, narration that drifted between the table and the clean block. The
 * judgement half lives in SKILL.md Phase 1.5 and is written prose, because
 * "does this have a turn in it" is not something a regex gets to rule on.
 *
 * Nothing here fails a build. It is read by whoever is about to hand the script
 * over, which in practice is the agent that just wrote it.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const PROJECTS = join(process.cwd(), 'projects');

/**
 * Words per second used to turn a word count into a beat duration.
 *
 * Measured, not assumed. Across the three videos with a recorded voiceover —
 * 679 words over 216.9s of finished audio — the delivered rate is:
 *
 *   every-frame       230 words /  75.3s = 3.05 w/s
 *   flow-field        216 words /  73.0s = 2.96 w/s
 *   second-listener   233 words /  68.6s = 3.40 w/s
 *
 * SKILL.md still says to divide by 2.6, which over-estimates every beat by
 * about 20% and is why scripts written for 35-50s keep landing at 70.
 */
const WPS = 3.1;
/** Outside this, the duration was set by feel rather than by the arithmetic. */
const WPS_MIN = 2.7;
const WPS_MAX = 3.6;

/** Target runtime for an educational short. */
const RUNTIME_MIN = 35;
const RUNTIME_MAX = 50;

/**
 * Above this, uniform beat lengths start to read as generated rather than cut.
 *
 * Not applied to shorts. At 40 seconds every beat landing at 4-6s reads as
 * tight; at three minutes the same regularity is the single clearest tell that
 * nobody made an editorial decision about pacing.
 */
const PACING_MATTERS_ABOVE = 90;
const MIN_VARIATION = 0.18;

const REQUIRED = [
  'Hook',
  'Where people actually get confused',
  'Beats',
  'Narration, clean',
  'Delivery notes',
];

/** Beats should open mid-thought. See references/script-format.md. */
const CONNECTIVES = [
  'so', 'now', 'and', 'but', 'the thing is', 'except', 'which', 'because',
  'then', 'anyway', 'though', 'okay',
];

type Beat = {
  readonly n: string;
  readonly id: string;
  readonly words: number;
  readonly dur: number;
  readonly narration: string;
};

type Note = { readonly level: 'x' | '!'; readonly text: string };

const cells = (row: string): string[] =>
  row.split('|').slice(1, -1).map((c) => c.trim());

/**
 * Find the beats table by its column names, not by position.
 *
 * The scripts written so far do not agree on a column set — one has an extra
 * `reg`, one has no `words`, and two have unrelated tables that a positional
 * parser happily read as beats and reported nonsense about. Columns are located
 * by header, and `words` is derived from the narration when the table does not
 * carry it, since that is the number the arithmetic actually needs.
 */
const parseBeats = (md: string): Beat[] => {
  const lines = md.split('\n').filter((l) => /^\|/.test(l));
  let cols: Record<string, number> | null = null;
  const out: Beat[] = [];

  for (const line of lines) {
    const c = cells(line);
    const lower = c.map((x) => x.toLowerCase());

    // A header is any row naming both an id and a narration column.
    if (lower.includes('id') && lower.includes('narration')) {
      cols = {};
      lower.forEach((name, i) => {
        cols![name] = i;
      });
      continue;
    }
    if (!cols) continue;
    if (/^[-: ]+$/.test(c.join(''))) continue;

    const id = c[cols['id']!]?.replace(/`/g, '') ?? '';
    const narration = c[cols['narration']!] ?? '';
    if (id === '' || narration === '') continue;

    const declared = cols['words'] !== undefined ? Number(c[cols['words']!]) : NaN;
    out.push({
      n: cols['#'] !== undefined ? (c[cols['#']!] ?? '?') : String(out.length + 1),
      id,
      words: Number.isFinite(declared) ? declared : words(narration),
      // Written as both `4.3` and `4.3s` across the scripts.
      dur: Number((c[cols['dur']!] ?? '').replace(/[^\d.]/g, '')),
      narration,
    });
  }
  return out;
};

/** The same beats, read from beats.yaml when script.md defers to it. */
const parseBeatsYaml = (dir: string): Beat[] => {
  const path = join(dir, 'beats.yaml');
  if (!existsSync(path)) return [];
  const doc = parse(readFileSync(path, 'utf8')) as {
    beats?: readonly { id?: string; duration?: number; vo?: string }[];
  } | null;
  return (doc?.beats ?? [])
    .filter((b) => (b.vo ?? '').trim() !== '')
    .map((b, i) => ({
      n: String(i + 1),
      id: b.id ?? '?',
      words: words(b.vo ?? ''),
      dur: b.duration ?? 0,
      narration: (b.vo ?? '').trim(),
    }));
};

/** Coefficient of variation — spread relative to the mean, so it is unitless. */
const variation = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 0;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return sd / mean;
};

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

const review = (slug: string, verbose: boolean): boolean => {
  const path = join(PROJECTS, slug, 'script.md');
  if (!existsSync(path)) return true;
  const md = readFileSync(path, 'utf8');
  const notes: Note[] = [];

  /*
    Showcases are a different deliverable and the format says so: a layout
    sketch, the exact on-screen text, and what is deliberately absent. They have
    no beats table and no narration to time, so holding them to the educational
    checks reports a pile of failures about sections that are correctly missing.
  */
  const kind = /\*\*Type:\*\*\s*(\w+)/i.exec(md)?.[1]?.toLowerCase() ?? 'educational';
  if (kind !== 'educational') {
    console.log(`  ok ${slug.padEnd(20)} ${kind} — no narration to check`);
    return true;
  }

  for (const section of REQUIRED) {
    if (!new RegExp(`^#{2,3} .*${section}`, 'im').test(md)) {
      notes.push({ level: 'x', text: `missing section: ${section}` });
    }
  }

  /*
    Some scripts carry the beats table; others say "full narration in
    beats.yaml" and leave it there. Both are fine, and beats.yaml is the better
    source anyway once a VO exists, because retime has overwritten the estimates
    with what was actually said.
  */
  let beats = parseBeats(md);
  let source = 'script.md';
  if (beats.length === 0) {
    beats = parseBeatsYaml(join(PROJECTS, slug));
    source = 'beats.yaml';
  }
  if (beats.length === 0) {
    console.log(`  x  ${slug.padEnd(20)} no beats in script.md or beats.yaml`);
    return false;
  }

  const total = beats.reduce((a, b) => a + b.dur, 0);
  const totalWords = beats.reduce((a, b) => a + b.words, 0);

  // Word count against the stated duration, per beat.
  for (const b of beats) {
    if (!Number.isFinite(b.words) || !Number.isFinite(b.dur) || b.dur <= 0) {
      notes.push({ level: 'x', text: `beat ${b.n} (${b.id}) has no usable words/dur` });
      continue;
    }
    const wps = b.words / b.dur;
    if (wps < WPS_MIN || wps > WPS_MAX) {
      notes.push({
        level: '!',
        text: `beat ${b.n} (${b.id}) runs at ${wps.toFixed(1)} w/s — ${b.words} words wants ${(b.words / WPS).toFixed(1)}s, not ${b.dur}s`,
      });
    }
    // The table's own narration is the thing being counted, so a mismatch
    // means the row was edited and the count was not.
    const actual = words(b.narration);
    if (Math.abs(actual - b.words) > 2) {
      notes.push({
        level: '!',
        text: `beat ${b.n} (${b.id}) says ${b.words} words, narration has ${actual}`,
      });
    }
  }

  /*
    Soft, not hard. SKILL.md states a 35-50s target and every educational video
    actually shipped runs 68-75s, so a failure here is at least as likely to
    mean the target is stale as that the script is long. Flagged so the
    discrepancy stays visible rather than being quietly normalised either way.
  */
  if (total < RUNTIME_MIN || total > RUNTIME_MAX) {
    notes.push({
      level: '!',
      text: `runtime ${total.toFixed(1)}s is outside the ${RUNTIME_MIN}-${RUNTIME_MAX}s target in SKILL.md`,
    });
  }

  // The header states a runtime; the table is what it is built from.
  const declared = Number(/\*\*Runtime:\*\*\s*([\d.]+)\s*s/i.exec(md)?.[1]);
  if (Number.isFinite(declared) && Math.abs(declared - total) > 5) {
    notes.push({
      level: '!',
      text: `header says ${declared}s, beats table totals ${total.toFixed(1)}s`,
    });
  }

  const cv = variation(beats.map((b) => b.dur));
  if (total > PACING_MATTERS_ABOVE && cv < MIN_VARIATION) {
    notes.push({
      level: '!',
      text: `beat lengths are metronomic (variation ${cv.toFixed(2)}) over ${total.toFixed(0)}s — long-form needs held beats and short ones`,
    });
  }

  const opens = beats.filter((b) =>
    CONNECTIVES.some((c) => b.narration.toLowerCase().replace(/^[^a-z]+/, '').startsWith(c)),
  ).length;
  if (opens < beats.length * 0.5) {
    notes.push({
      level: '!',
      text: `only ${opens}/${beats.length} beats open on a connective — reads as recited, not mid-thought`,
    });
  }

  // "We", never "you" — the narration is one gamedev talking to another.
  // Only the narration column: prose elsewhere in script.md addresses the
  // reader and is supposed to.
  const youInBeats = beats.reduce(
    (a, b) => a + (b.narration.match(/\byou(?:r|'re|'ve)?\b/gi) ?? []).length,
    0,
  );
  if (youInBeats > 0) {
    notes.push({ level: '!', text: `narration says "you" ${youInBeats}x — it is always "we"` });
  }

  if (verbose) {
    console.log(`\n  ${slug}`);
    for (const b of beats) {
      const wps = b.dur > 0 ? b.words / b.dur : 0;
      const flag = wps < WPS_MIN || wps > WPS_MAX ? ' <-' : '';
      console.log(
        `   ${b.n.padStart(2)} ${b.id.padEnd(14)} ${String(b.words).padStart(3)}w ` +
          `${b.dur.toFixed(1).padStart(5)}s ${wps.toFixed(1)} w/s${flag}`,
      );
    }
    console.log();
  }

  const hard = notes.filter((n) => n.level === 'x').length;
  const ok = hard === 0;
  console.log(
    `${ok ? '  ok' : '  x '} ${slug.padEnd(20)} ${String(beats.length).padStart(2)} beats  ` +
      `${totalWords} words  ${total.toFixed(1)}s  variation ${cv.toFixed(2)}  [${source}]`,
  );
  for (const n of notes) console.log(`       ${n.level}  ${n.text}`);
  return ok;
};

const arg = process.argv[2];
const slugs = arg
  ? [arg]
  : readdirSync(PROJECTS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

console.log('script:');
let allOk = true;
for (const slug of slugs) {
  if (!review(slug, Boolean(arg))) allOk = false;
}
if (!allOk) {
  console.log('\n  x marks something to fix before showing the script.');
}
