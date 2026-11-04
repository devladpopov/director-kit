#!/usr/bin/env bash
# Turns the clips from record-guide.mjs into what docs/GUIDE.md embeds:
#   step-N.gif (inline on GitHub), director-kit-guide.mp4 (all steps, optional background music).
# Usage: bash docs/guide/build.sh [music.mp3]
set -euo pipefail

MUSIC="${1:+$(realpath "$1")}"
cd "$(dirname "$0")"

for f in step-*.webm; do
  n="${f%.webm}"
  # GitHub renders inline GIFs up to ~10 MB, keep each under 3 MB: retry with fewer frames and a smaller width.
  for opt in "6 960" "4 960" "4 800" "3 720"; do
    set -- $opt
    ffmpeg -v error -y -i "$f" -vf "fps=$1,scale=$2:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" "$n.gif"
    [ "$(stat -c %s "$n.gif")" -lt 3000000 ] && break
  done
  echo "$n.gif $(du -h "$n.gif" | cut -f1)"
done

# One video: concat the steps, re-encode once.
ls step-*.webm | sort -V | sed "s/.*/file '&'/" > concat.txt
ffmpeg -v error -y -f concat -safe 0 -i concat.txt -c:v libx264 -pix_fmt yuv420p -crf 23 -r 25 -an guide-video.mp4
rm concat.txt
if [ -n "$MUSIC" ]; then
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 guide-video.mp4)
  fade=$(awk "BEGIN{print $d-3}")
  ffmpeg -v error -y -i guide-video.mp4 -stream_loop -1 -i "$MUSIC" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k \
    -af "volume=-14dB,afade=t=in:d=1.5,afade=t=out:st=$fade:d=3" -t "$d" -movflags +faststart director-kit-guide.mp4
  rm guide-video.mp4
else
  mv guide-video.mp4 director-kit-guide.mp4
fi
echo "director-kit-guide.mp4 $(du -h director-kit-guide.mp4 | cut -f1)"
