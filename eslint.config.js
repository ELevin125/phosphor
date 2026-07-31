import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Deliberately narrow.
 *
 * `tsc --noEmit` was the only automated check on 15k lines for a long time, and
 * it catches types rather than mistakes. What this adds is the small set of
 * rules that catch the failures this codebase can actually suffer — a floating
 * promise in a pipeline script, an unused export left behind by a refactor, a
 * `let` that should never be reassigned.
 *
 * It is NOT a style config. Formatting arguments cost time and change nothing
 * about whether a video renders correctly.
 */
export default tseslint.config(
  {
    // Generated files, vendored tooling and user data are not ours to lint.
    ignores: [
      'node_modules/**',
      'out/**',
      '.tooling/**',
      'projects/**',
      'src/*.generated.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files sit outside tsconfig's `include`, so the type-aware
          // rules have no program for them. They still get parsed and linted;
          // they just use the default project rather than failing outright.
          allowDefaultProject: ['eslint.config.js', 'vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused is usually a leftover, but an intentionally-ignored argument is
      // real and gets an underscore rather than a disable comment.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // The pipeline scripts are async and their failures must stop the build.
      // An unawaited promise here means a stage that reports success and did
      // nothing, which is the exact silent failure build.ts exists to prevent.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Node-side scripts talk to the filesystem and the console by definition.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
