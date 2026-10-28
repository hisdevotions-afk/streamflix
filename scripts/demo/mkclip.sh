#!/bin/bash
# mkclip.sh <image> <runtime_minutes> <out.mkv>
# 150 s of slow push-in with grain at 24 fps, then the last frame held at 1 fps for the rest of the runtime.
set -e
img=$1; mins=$2; out=$3; tmp=$(mktemp -d)
A=150; B=$(( mins*60 - A ))
enc="-c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -profile:v high -level 4.0 -c:a aac -b:a 64k -ar 48000 -ac 2"
ffmpeg -v error -loop 1 -framerate 24 -i "$img" -f lavfi -i anullsrc=r=48000:cl=stereo -t $A \
  -vf "scale=2560:-2,crop=2560:1440,zoompan=z='1+0.12*on/($A*24)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=24,noise=alls=7:allf=t,eq=saturation=1.05" \
  $enc -shortest "$tmp/a.mkv" -y
ffmpeg -v error -sseof -0.1 -i "$tmp/a.mkv" -frames:v 1 "$tmp/last.png" -y
ffmpeg -v error -loop 1 -framerate 1 -i "$tmp/last.png" -f lavfi -i anullsrc=r=48000:cl=stereo -t $B -r 1 $enc -shortest "$tmp/b.mkv" -y
printf "file '%s'\nfile '%s'\n" "$tmp/a.mkv" "$tmp/b.mkv" > "$tmp/list.txt"
ffmpeg -v error -f concat -safe 0 -i "$tmp/list.txt" -c copy "$out" -y
rm -rf "$tmp"
