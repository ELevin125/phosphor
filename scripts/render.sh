#!/usr/bin/env bash
#
# Renders finished MP4s.
#
#   ./scripts/render.sh value-vs-reference-gizmo             # numbered render
#   ./scripts/render.sh value-vs-reference-gizmo --deliver   # also mark final
#
# Output: out/<slug>/renders/<id>-NNN.mp4
#
# Renders are NUMBERED, never overwritten. A re-render that clobbered the
# previous one is how `flow-field-gizmo (Copy 2).mp4` came to exist -- the good
# take had already been replaced, so it got rescued by hand. See
# docs/DECISIONS.md#d008.
#
# `--deliver` additionally copies the render to out/<slug>/deliver/<id>.mp4,
# which is the one file per video that gets uploaded. That directory is the only
# thing in out/ worth looking at.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

COMP="${1:-}"
if [ -z "$COMP" ]; then
  echo "usage: render.sh <composition-id> [--deliver] [remotion flags...]" >&2
  exit 1
fi
shift

DELIVER=0
EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --deliver) DELIVER=1; shift ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

ensure_bundle

if [ -z "$(comp_duration "$COMP")" ]; then
  echo "error: composition '$COMP' not found. Available:" >&2
  comp_list | awk 'NF > 3 {print "  " $1}' >&2
  exit 1
fi

SLUG="$(slug_of "$COMP")"
RENDERS="$(out_dir "$SLUG" renders)"
INDEX="$(next_render_index "$RENDERS" "$COMP")"
OUT="$RENDERS/${COMP}-${INDEX}.mp4"

echo "› rendering $COMP -> out/$SLUG/renders/${COMP}-${INDEX}.mp4"
npx remotion render "$BUNDLE_DIR" "$COMP" "$OUT" \
  --codec=h264 \
  --crf=18 \
  --log=error \
  ${EXTRA[@]+"${EXTRA[@]}"}

echo "✓ out/$SLUG/renders/${COMP}-${INDEX}.mp4"

if [ "$DELIVER" = "1" ]; then
  DELIVER_DIR="$(out_dir "$SLUG" deliver)"
  cp "$OUT" "$DELIVER_DIR/${COMP}.mp4"
  echo "✓ out/$SLUG/deliver/${COMP}.mp4  (upload this one)"
fi
