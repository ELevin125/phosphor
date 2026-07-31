#!/usr/bin/env bash
#
# Renders stills at fixed intervals and montages them into one labelled grid.
#
# This is the only way to check a scene without watching video, and it is a
# REQUIRED step after every scene edit -- see .claude/skills/phosphor/SKILL.md.
#
#   ./scripts/contact-sheet.sh value-vs-reference-gizmo
#   ./scripts/contact-sheet.sh value-vs-reference-gizmo --count 16 --debug
#
# Output: out/<slug>/qa/<id>[-debug].png
#
# This answers ONE question that arithmetic cannot: does the picture make the
# point? Everything mechanical -- overflow, collisions, safe areas, static holds
# -- is `npm run check`, which reports in text and is far cheaper to read. Run
# check first and reach for a sheet when it comes back clean.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

COMP="${1:-}"
if [ -z "$COMP" ]; then
  echo "usage: contact-sheet.sh <composition-id> [--count N] [--scale S] [--debug]" >&2
  exit 1
fi
shift

COUNT=12
SCALE=0.25
DEBUG=0
COLS=4

while [ $# -gt 0 ]; do
  case "$1" in
    --count) COUNT="$2"; shift 2 ;;
    --scale) SCALE="$2"; shift 2 ;;
    --cols)  COLS="$2";  shift 2 ;;
    --debug) DEBUG=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

ensure_bundle

DURATION="$(comp_duration "$COMP")"
if [ -z "$DURATION" ]; then
  echo "error: composition '$COMP' not found. Available:" >&2
  comp_list | awk 'NF > 3 {print "  " $1}' >&2
  exit 1
fi

FPS="$(comp_fps "$COMP")"
FPS="${FPS:-30}"

SUFFIX=""
PROPS='{"debug":false}'
if [ "$DEBUG" = "1" ]; then
  SUFFIX="-debug"
  PROPS='{"debug":true}'
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SLUG="$(slug_of "$COMP")"
OUT_DIR="$(out_dir "$SLUG" qa)"

echo "› ${COMP}: ${COUNT} stills across ${DURATION} frames"

for i in $(seq 0 $((COUNT - 1))); do
  # Sample at interval midpoints so we never land on frame 0 of a fade.
  FRAME=$(awk -v i="$i" -v n="$COUNT" -v d="$DURATION" \
    'BEGIN { printf "%d", (i + 0.5) * (d / n) }')
  SECS=$(awk -v f="$FRAME" -v fps="$FPS" 'BEGIN { printf "%.1f", f / fps }')
  LABEL=$(printf "f%04d  %ss" "$FRAME" "$SECS")

  # Render at FULL resolution and downscale afterwards, rather than using
  # --scale. Remotion's --scale changes the device pixel ratio, which silently
  # breaks effects that depend on pixel-level filter subregions (the CRT
  # mosaic filter renders completely blank at 0.25). A full-res render
  # downscaled by ImageMagick is always a faithful preview.
  npx remotion still "$BUNDLE_DIR" "$COMP" "$TMP/$(printf '%03d' "$i").png" \
    --frame="$FRAME" \
    --image-format=png \
    --props="$PROPS" \
    --log=error

  # Stash the label alongside the image for montage to pick up.
  echo "$LABEL" > "$TMP/$(printf '%03d' "$i").txt"
  printf '.' >&2
done
echo >&2

# Montage with a label under each tile.
ARGS=()
for f in "$TMP"/*.png; do
  ARGS+=(-label "$(cat "${f%.png}.txt")" "$f")
done

# Downscale here instead of at render time. Width comes from the composition,
# not a constant -- landscape is 1920 wide, and scaling it as though it were
# 1080 produces tiles at half the intended size.
WIDTH="$(comp_width "$COMP")"
TILE_W=$(awk -v s="$SCALE" -v w="${WIDTH:-1080}" 'BEGIN { printf "%d", w * s }')

OUT="$OUT_DIR/${COMP}${SUFFIX}.png"
montage "${ARGS[@]}" \
  -tile "${COLS}x" \
  -geometry "${TILE_W}x+8+8" \
  -background '#1b1b1b' \
  -fill '#e8e8e8' \
  -pointsize 16 \
  "$OUT"

# Title bar so a sheet is identifiable once it's out of the terminal.
convert "$OUT" \
  -background '#1b1b1b' -fill '#ffffff' -pointsize 22 \
  label:"$COMP  |  ${DURATION}f @ ${FPS}fps  |  $(date '+%H:%M:%S')" \
  +swap -gravity Center -append "$OUT"

echo "✓ out/$SLUG/qa/$(basename "$OUT")"
identify -format '  %wx%h\n' "$OUT"
