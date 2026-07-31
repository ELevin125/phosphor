import React from 'react';
import { Composition } from 'remotion';
import { PROFILES } from './kit';
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
 * Each project ships in one theme, named in its beats.yaml. There is one theme
 * (docs/DECISIONS.md#d002), so this is one composition per project.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {PROJECTS.map((p) => {
      // The canvas comes from the project's own profile, not a global
      // constant. A landscape video registered at 1080x1920 would render its
      // whole layout into the wrong frame, and nothing upstream would say so.
      const { canvas } = PROFILES[p.profile];
      return (
        <Composition
          key={`${p.base}-${p.theme}`}
          id={`${p.base}-${p.theme}`}
          component={p.component}
          durationInFrames={p.durationInFrames}
          fps={p.fps}
          width={canvas.width}
          height={canvas.height}
          defaultProps={{ theme: p.theme, debug: false }}
        />
      );
    })}
  </>
);
