import { Config } from '@remotion/cli/config';
import { withAliases } from './scripts/webpack-override';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

/**
 * The alias list itself lives in scripts/webpack-override.ts, because
 * `npm run check` bundles programmatically and never reads this file. Keeping
 * one copy is what stops the two bundlers disagreeing about how to resolve
 * `@projects`.
 */
Config.overrideWebpackConfig(withAliases);

export {};
