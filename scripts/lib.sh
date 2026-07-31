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

# Everything the bundle is built from. Miss one and the QA loop silently
# inspects an old build — which is worse than no caching at all, because a
# contact sheet that lies is indistinguishable from a change that did nothing.
#
# `projects` is here because video code lives there, not under src. `public`
# because Remotion copies it into the bundle, so re-encoding a clip changes the
# output even though no code moved.
BUNDLE_INPUTS=(src projects public remotion.config.ts package.json)

# Bundles the project once so repeated stills don't re-bundle every time.
# Rebuilds whenever any input is newer than the bundle.
ensure_bundle() {
  local stamp="$BUNDLE_DIR/index.html"
  local newest=""

  if [ -f "$stamp" ]; then
    local existing=()
    for p in "${BUNDLE_INPUTS[@]}"; do
      [ -e "$p" ] && existing+=("$p")
    done
    newest="$(find "${existing[@]}" -type f -newer "$stamp" -print -quit 2>/dev/null || true)"
  fi

  if [ ! -f "$stamp" ] || [ -n "$newest" ]; then
    echo "› bundling${newest:+ (${newest} changed)}..." >&2
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

# Prints pixel width for a composition id. Contact sheets need it because the
# tile size is a fraction of the frame, and landscape is 1920 wide where
# portrait is 1080 -- assuming one of them makes the other's sheets useless.
comp_width() {
  comp_list | awk -v id="$1" '$1 == id {split($3, wh, "x"); print wh[1]}' | head -1
}

# Maps a composition id to the project it belongs to.
#
# Ids are `<slug>-gizmo` or `<slug>-<variant>-gizmo`, and a variant must land in
# the same directory as its parent -- `value-vs-reference-board-gizmo` is an
# alternate cut of `value-vs-reference`, not a project of its own. Matching the
# LONGEST project directory that prefixes the id gets both cases right without
# needing to know the variant names.
slug_of() {
  local id="$1" best=""
  local d
  for d in "$ROOT"/projects/*/; do
    [ -d "$d" ] || continue
    local name
    name="$(basename "$d")"
    case "$id" in
      "$name"-*|"$name")
        if [ "${#name}" -gt "${#best}" ]; then best="$name"; fi
        ;;
    esac
  done
  # Unknown ids still need somewhere to go rather than failing the render.
  echo "${best:-${id%-gizmo}}"
}

# out/<slug>/<kind>/ -- see docs/DECISIONS.md#d008.
#   qa/       contact sheets, probe stills, check output. Disposable.
#   renders/  numbered renders. Never overwritten.
#   deliver/  the one file per video that actually gets uploaded.
out_dir() {
  local dir="$ROOT/out/$1/$2"
  mkdir -p "$dir"
  echo "$dir"
}

# Next free NNN for a render, so a re-render never silently replaces a good take
# and never needs a hand-typed "(Copy 2)".
next_render_index() {
  local dir="$1" id="$2" n=1
  while [ -e "$dir/${id}-$(printf '%03d' "$n").mp4" ]; do
    n=$((n + 1))
  done
  printf '%03d' "$n"
}
