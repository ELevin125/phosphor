import { Config } from '@remotion/cli/config';
import path from 'node:path';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

/**
 * Remotion's bundler does not read `paths` out of tsconfig.json, so the
 * `@kit` / `@theme` aliases have to be mirrored here or imports fail at bundle
 * time (while the editor happily resolves them).
 */
Config.overrideWebpackConfig((current) => ({
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
}));

export {};
