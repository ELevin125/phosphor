/**
 * Scaffolds the two directories a video needs.
 *
 *   npm run new <slug>
 *
 *   projects/<slug>/        code, script and timings — written during the build
 *   public/videos/<slug>/   your recording and footage — where you paste things
 *
 * The second one is the reason this exists. It has to be created before the
 * voiceover is recorded, which is before anything else in the pipeline runs, so
 * without this it is a manual mkdir at the exact moment you are least thinking
 * about directory layout.
 *
 * Deliberately does NOT create script.md or beats.yaml. The script is a Phase 1
 * deliverable that gets written and approved before any of the build exists, and
 * a stub file sitting there invites filling it in out of order.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const slug = process.argv[2];

if (!slug || slug.startsWith('-')) {
  console.error('usage: npm run new <slug>');
  console.error('   e.g. npm run new every-frame');
  process.exit(1);
}

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`"${slug}" is not a valid slug — lowercase, digits and single hyphens only.`);
  console.error('Composition ids are built from it, and the render scripts parse those.');
  process.exit(1);
}

const ROOT = process.cwd();
const projectDir = join(ROOT, 'projects', slug);
const mediaDir = join(ROOT, 'public', 'videos', slug);

const made: string[] = [];
const existed: string[] = [];

for (const dir of [projectDir, mediaDir]) {
  if (existsSync(dir)) {
    existed.push(dir);
  } else {
    mkdirSync(dir, { recursive: true });
    made.push(dir);
  }
}

/** A note in the media folder, so the expected filenames are visible from the file manager. */
const readme = join(mediaDir, 'README.md');
if (!existsSync(readme)) {
  writeFileSync(
    readme,
    `# ${slug} — media

Paste your recording and any footage into this folder.

## Voiceover

Save the raw recording as:

    vo.wav

Then run \`npm run build ${slug}\`. It cleans up and normalises the audio,
transcribes it locally, and re-times every beat from your actual delivery.

Your original is never modified — the first run copies it to \`vo.raw.wav\` and
works from that copy forever after, so audio settings can be re-tried freely.
Those settings live in the \`vo:\` block of \`projects/${slug}/beats.yaml\`,
not in command-line flags.

## Footage

Any filename; the script that needs it will say which. Game view only — no
editor chrome, no toolbar, no OS bar. If a clip needs cropping or re-encoding,
the ffmpeg one-liner is in the skill's \`references/style.md\`.

## Note

Nothing in this folder is tracked by git. It is yours.
`,
  );
  made.push(readme);
}

for (const p of made) {
  console.log(`  + ${p.replace(`${ROOT}/`, '')}`);
}
for (const p of existed) {
  console.log(`  · ${p.replace(`${ROOT}/`, '')} (already there)`);
}

console.log(`\n✓ ${slug} scaffolded.`);
console.log(`\n  paste recordings and footage into public/videos/${slug}/`);
console.log(`  the script goes in projects/${slug}/script.md, and gets approved before any build`);
