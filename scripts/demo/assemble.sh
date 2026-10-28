#!/bin/bash
# Turns recorded scene folders into one 1080p30 video with short crossfades.
set -e
D=$(dirname "$0"); O=$D/out; X=0.45
enc="-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30"
for s in c0 s1 c1 s2 c2 s3 c3 m1 c4; do
  if [ "$s" = m1 ]; then
    # Phone mockup: screen at 432x936 with a 14px bezel, centered on the card ground.
    ffmpeg -v error -f concat -safe 0 -i $O/m1/list.txt -i $O/bg.png -filter_complex "
      [0:v]fps=30,scale=432:936,format=rgba,geq=lum='p(X,Y)':a='if(gt(abs(X-W/2),W/2-38)*gt(abs(Y-H/2),H/2-38), if(lte(hypot(abs(X-W/2)-(W/2-38),abs(Y-H/2)-(H/2-38)),38),255,0),255)'[scr];
      color=c=0x05040d:s=460x964,format=rgba,geq=lum='p(X,Y)':a='if(gt(abs(X-W/2),W/2-52)*gt(abs(Y-H/2),H/2-52), if(lte(hypot(abs(X-W/2)-(W/2-52),abs(Y-H/2)-(H/2-52)),52),255,0),255)'[bez];
      [1:v]scale=1920:1080,format=rgba[bg];
      [bg][bez]overlay=(W-w)/2:(H-h)/2:shortest=0[b1];
      [b1][scr]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p" $enc $O/$s.mp4 -y
  else
    ffmpeg -v error -f concat -safe 0 -i $O/$s/list.txt -vf "fps=30,scale=1920:1080,format=yuv420p" $enc $O/$s.mp4 -y
  fi
done
# xfade chain
inputs=""; filter=""; prev="0:v"; offset=0; i=0
for s in c0 s1 c1 s2 c2 s3 c3 m1 c4; do inputs="$inputs -i $O/$s.mp4"; done
durs=(); for s in c0 s1 c1 s2 c2 s3 c3 m1 c4; do durs+=($(ffprobe -v error -show_entries format=duration -of csv=p=0 $O/$s.mp4)); done
acc=${durs[0]}
for i in $(seq 1 8); do
  offset=$(python3 -c "print(round($acc-$X*$i,3))")
  filter="$filter[$prev][$i:v]xfade=transition=fade:duration=$X:offset=$offset[v$i];"
  prev="v$i"; acc=$(python3 -c "print($acc+${durs[$i]})")
done
ffmpeg -v error $inputs -filter_complex "${filter%;}" -map "[$prev]" $enc -movflags +faststart "$1" -y
ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"
