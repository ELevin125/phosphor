import path from 'node:path';

/**
 * Import aliases for the bundler.
 *
 * Remotion's bundler does not read `paths` out of tsconfig.json, so the
 * `@kit` / `@theme` / `@projects` aliases have to be mirrored for webpack or
 * imports fail at bundle time while the editor happily resolves them.
 *
 * This lives in its own module because there are now two bundlers: the CLI,
 * which reads remotion.config.ts, and `scripts/check.ts`, which calls
 * `bundle()` programmatically and never sees that file. When the two had
 * separate copies, `npm run check` failed to resolve every project import — the
 * aliases existed, just not for it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- webpack's config type is not exported by Remotion.
export const withAliases = (current: any): any => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: {
      ...current.resolve?.alias,
      '@kit': path.resolve(process.cwd(), 'src/kit/index.ts'),
      '@theme': path.resolve(process.cwd(), 'src/theme/index.ts'),
      '@projects': path.resolve(process.cwd(), 'projects'),
    },
  },
});
