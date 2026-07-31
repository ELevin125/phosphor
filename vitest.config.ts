import { defineConfig } from 'vitest/config';

/**
 * Tests cover the pure functions whose bugs are silent — the ones that produce
 * a confident, wrong picture rather than an error. Components are not tested:
 * rendering them proves they render, which `npm run check` already establishes
 * against the real frame.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'out/**',
      // Vendored whisper.cpp ships its own suite, which needs a native addon
      // built and is nothing to do with this project.
      '.tooling/**',
      // User data. A project's own code is theirs, and a checkout has none.
      'projects/**',
    ],
  },
});
