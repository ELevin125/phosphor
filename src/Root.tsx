import React from 'react';
import { Composition } from 'remotion';
import { CANVAS } from './kit';
import { PROJECTS } from './registry.generated';

/**
 * Compositions are discovered, not declared.
 *
 * Projects live in projects/<slug>/ and are user data — gitignored, so the set
 * differs on every checkout and cannot be imported by name from here. `npm run
 * sync` scans that directory and writes src/registry.generated.ts; this file
 * only turns those rows into compositions.
 *
 * Ids are `<slug>-<theme>`, which render.sh and contact-sheet.sh both parse.
 * `--props='{"debug":true}'` overlays the safe areas on any of them.
 *
 * Each project ships in one theme, named in its beats.yaml. Run the studio with
 * PHOSPHOR_THEMES=1 to register every project against every theme instead —
 * that is the harness for choosing a look, and it multiplies the sidebar by ten.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {PROJECTS.map((p) => (
      <Composition
        key={`${p.base}-${p.theme}`}
        id={`${p.base}-${p.theme}`}
        component={p.component}
        durationInFrames={p.durationInFrames}
        fps={p.fps}
        width={CANVAS.width}
        height={CANVAS.height}
        defaultProps={{ theme: p.theme, debug: false }}
      />
    ))}
  </>
);
