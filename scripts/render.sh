#!/usr/bin/env bash
#
# Renders finished MP4s.
#
#   ./scripts/render.sh value-vs-reference-neon     # one composition
#   ./scripts/render.sh value-vs-reference --themes # every theme of a video
#
# Output: out/<composition-id>.mp4
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "usage: render.sh <composition-id> | <slug> --themes" >&2
  exit 1
fi
shift

ALL_THEMES=0
EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --themes) ALL_THEMES=1; shift ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

ensure_bundle
mkdir -p "$ROOT/out"

render_one() {
  local id="$1"
  echo "› rendering $id"
  npx remotion render "$BUNDLE_DIR" "$id" "$ROOT/out/${id}.mp4" \
    --codec=h264 \
    --crf=18 \
    --log=error \
    ${EXTRA[@]+"${EXTRA[@]}"}
  echo "✓ out/${id}.mp4"
}

if [ "$ALL_THEMES" = "1" ]; then
  mapfile -t IDS < <(
    comp_list | awk -v slug="$TARGET" '$1 ~ "^" slug "-" {print $1}'
  )
  if [ "${#IDS[@]}" -eq 0 ]; then
    echo "error: no compositions matching '${TARGET}-*'" >&2
    exit 1
  fi
  for id in "${IDS[@]}"; do
    render_one "$id"
  done
else
  render_one "$TARGET"
fi
