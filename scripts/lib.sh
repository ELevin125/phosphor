#!/usr/bin/env bash
# Shared setup for the render/QA scripts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The project ships its own Node so these scripts work without a system install.
LOCAL_NODE="$ROOT/.tooling/node-v22.23.1-linux-x64/bin"
if [ -d "$LOCAL_NODE" ]; then
  export PATH="$LOCAL_NODE:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found, and $LOCAL_NODE is missing." >&2
  exit 1
fi

ENTRY="src/index.ts"
BUNDLE_DIR="$ROOT/out/.bundle"

# Bundles the project once so repeated stills don't re-bundle every time.
# Rebuilds whenever any source file is newer than the bundle.
ensure_bundle() {
  local newest
  newest="$(find src remotion.config.ts package.json -type f -newer "$BUNDLE_DIR/index.html" 2>/dev/null | head -1 || true)"

  if [ ! -f "$BUNDLE_DIR/index.html" ] || [ -n "$newest" ]; then
    echo "› bundling..." >&2
    rm -rf "$BUNDLE_DIR"
    npx remotion bundle "$ENTRY" --out-dir="$BUNDLE_DIR" --log=error >/dev/null
  fi
}

# `remotion compositions` prints:  <id> <fps> <width>x<height> <durationInFrames> (<sec>)
# The table is emitted at log level `info`, so we cannot quiet the command --
# filter to just the data rows instead.
comp_list() {
  npx remotion compositions "$BUNDLE_DIR" 2>/dev/null \
    | awk '$2 ~ /^[0-9]+$/ && $3 ~ /^[0-9]+x[0-9]+$/ && $4 ~ /^[0-9]+$/'
}

# Prints durationInFrames for a composition id.
comp_duration() {
  comp_list | awk -v id="$1" '$1 == id {print $4}' | head -1
}

# Prints fps for a composition id.
comp_fps() {
  comp_list | awk -v id="$1" '$1 == id {print $2}' | head -1
}
