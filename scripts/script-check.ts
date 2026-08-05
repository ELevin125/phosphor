/**
 * Script self-review — the measurable half.
 *
 *   npm run script                  # every active project
 *   npm run script second-listener  # one, with the beat table (archived or not)
 *   npm run script --all            # including archived ones
 *
 * Phase 1 ends with a script being shown for approval, and approval is the one
 * gate in this pipeline that cannot be re-run cheaply — everything downstream
 * is built from what gets waved through. So the things that CAN be checked
 * mechanically should be, before a human is asked to read anything.
 *
 * This deliberately checks nothing about whether the script is any good. It
 * checks the things that are wrong in a way arithmetic can see: durations that
 * do not match their word counts, a runtime outside the target, sections
 * missing, narration that drifted between the table and the clean block, and
 * the four rules in docs/RETENTION.md that survive contact with a regex — the
 * runtime ceiling, hook length, a sequel reference in beat 1, and whether any
 * beat boundary falls where a second loop would have to open. The
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

/** Target runtime for an educational short. See docs/RETENTION.md#1. */
const RUNTIME_MIN = 40;
const RUNTIME_MAX = 50;

/**
 * Words in beat 1 before the hook stops being a premise and becomes a preamble.
 *
 * The best-performing hook shipped is flow-field's, at 21 words / 6.6s: a goal,
 * an actor, an obstacle, and a precisely shaped hole. Past roughly this the
 * setup is still arriving when the drop-off cliff does. See RETENTION.md#5.
 */
const HOOK_MAX_WORDS = 24;

/**
 * Temporal callbacks in beat 1.
 *
 * ~95% of a Reels audience is cold, so a sentence referring to a previous video
 * reads as *you missed something, this isn't for you*. It cost `every-frame` a
 * video whose body outperformed flow-field's. Restating the same fact without
 * the callback costs nothing. See RETENTION.md#4.
 *
 * Deliberately only the unambiguous temporal forms — "we built" is flagged by
 * nothing here, because "so we built a grid" is a perfectly good cold opening.
 */
const SEQUEL_REFERENCES =
  /\b(last time|previously|last video|the last (?:video|one)|if you (?:saw|watched)|remember when|carrying on from|part (?:one|two|three|\d))\b/i;

/**
 * Where a second loop has to be able to open. See RETENTION.md#7.
 *
 * Checked as "is there a beat boundary in this window" — which is a proxy, not
 * a reading. Nothing mechanical can tell whether a beat opens a new question or
 * continues an old one; what it CAN tell you is that with no boundary in the
 * window, nothing opens there at all.
 */
const SECOND_LOOP_MIN = 25;
const SECOND_LOOP_MAX = 30;

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

/**
 * Whether a project has been retired from the sweep — `archived: true` at the
 * top level of its beats.yaml.
 *
 * Shipped videos stay in the tree because they are the reference material: the
 * only worked examples of the format that exist. What they are not is code to
 * maintain. Every one of them was scripted against the old 2.6 w/s figure, so
 * every beat of every one of them trips the rate check — about forty warnings
 * that will never be actioned, burying the handful that would be.
 *
 * Archiving hides them from a sweep and nothing else. Naming one explicitly
 * still checks it, and `--all` still sweeps everything, because referring back
 * to them is the entire reason they are kept.
 */
type Meta = { readonly archived: boolean; readonly profile: string };

const meta = (slug: string): Meta => {
  const path = join(PROJECTS, slug, 'beats.yaml');
  if (!existsSync(path)) return { archived: false, profile: 'portrait' };
  const doc = parse(readFileSync(path, 'utf8')) as {
    archived?: boolean;
    profile?: string;
  } | null;
  return { archived: doc?.archived === true, profile: doc?.profile ?? 'portrait' };
};

const isArchived = (slug: string): boolean => meta(slug).archived;

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
    This comment used to say a failure here was "at least as likely to mean the
    target is stale as that the script is long". The measured uploads settled
    it the other way: the target was right and the practice was wrong. Reach is
    scored on the fraction of the video watched, so runtime is a denominator
    and a 73s cut takes a ~40% penalty before anything else is considered.

    Still soft rather than hard: a script can be knowingly long on its way to
    being cut, and this is read before a human hands it over, not by a gate.
    A short that trips it wants a beat removed, not every beat shaved.

    None of the short-form rules below apply to long-form, which is landscape,
    runs to five minutes by design, and is scored by nothing in RETENTION.md —
    that document is about a feed. The profile is the discriminator rather than
    the runtime, so a 95s portrait script is still told it is 95s long.
  */
  const short = meta(slug).profile !== 'landscape';
  if (short && (total < RUNTIME_MIN || total > RUNTIME_MAX)) {
    const over = total > RUNTIME_MAX;
    notes.push({
      level: '!',
      text:
        `runtime ${total.toFixed(1)}s is outside the ${RUNTIME_MIN}-${RUNTIME_MAX}s target` +
        (over
          ? ` — that is ${(RUNTIME_MAX / total * 100).toFixed(0)}% of the reach a ${RUNTIME_MAX}s cut would score. Cut a beat (RETENTION.md#1)`
          : ''),
    });
  }

  /*
    The retention rules that arithmetic can see. The rest of RETENTION.md — the
    first-frame onset law, the physical event on the drop-off cliff — is about
    what is on screen, so it belongs to `check.ts` or to a human, not here.
  */
  const first = beats[0];
  if (short && first) {
    if (first.words > HOOK_MAX_WORDS) {
      notes.push({
        level: '!',
        text: `hook is ${first.words} words (~${(first.words / WPS).toFixed(1)}s) — over ${HOOK_MAX_WORDS} the setup is still arriving at the drop-off (RETENTION.md#5)`,
      });
    }
    const sequel = SEQUEL_REFERENCES.exec(first.narration);
    if (sequel) {
      notes.push({
        level: 'x',
        text: `hook says "${sequel[0]}" — a cold audience hears "this isn't for you". State it as a fact, not a callback (RETENTION.md#4)`,
      });
    }
  }

  // Cumulative start time of each beat after the first, so "is there a boundary
  // in the window" is just a lookup.
  let elapsed = 0;
  const boundaries = beats.slice(0, -1).map((b) => (elapsed += b.dur));
  const opensSecondLoop = boundaries.some(
    (t) => t >= SECOND_LOOP_MIN && t <= SECOND_LOOP_MAX,
  );
  if (short && total > SECOND_LOOP_MAX && !opensSecondLoop) {
    notes.push({
      level: '!',
      text: `no beat starts between ${SECOND_LOOP_MIN}s and ${SECOND_LOOP_MAX}s — nothing can open a second loop there (RETENTION.md#7)`,
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

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const arg = argv.find((a) => !a.startsWith('--'));

const everything = (): string[] =>
  readdirSync(PROJECTS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

// An explicitly named project is always reviewed, archived or not.
const slugs = arg ? [arg] : everything().filter((s) => ALL || !isArchived(s));
const hidden = arg || ALL ? 0 : everything().length - slugs.length;

console.log('script:');
let allOk = true;
for (const slug of slugs) {
  if (!review(slug, Boolean(arg))) allOk = false;
}
if (hidden > 0) {
  console.log(`\n  ${hidden} archived project${hidden === 1 ? '' : 's'} skipped — --all to include them.`);
}
if (!allOk) {
  console.log('\n  x marks something to fix before showing the script.');
}
