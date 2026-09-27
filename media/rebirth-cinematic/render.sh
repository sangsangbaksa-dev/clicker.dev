#!/usr/bin/env bash
# Renders the five worldline rebirth cinematics into public/clicker/rebirth/.
#   FFMPEG=/path/to/ffmpeg media/rebirth-cinematic/render.sh [slug]
# 9.8 s · 1280×720 · 30 fps: collapse (0–2.6 s) → void tear (2.6–4.3 s) → white flash →
# the transcendence hall graded to the worldline colour with its stamp rising in the light.
set -euo pipefail
cd "$(dirname "$0")/../.."
FF="${FFMPEG:-ffmpeg}"
M=media/rebirth-cinematic
P=public/clicker
[ -f "$M/rebirth_bgm.wav" ] || python3 "$M/generate_bgm.py" "$M/rebirth_bgm.wav"
[ -d "$M/keyed" ] || node "$M/key_stamps.mjs"

m() { python3 -c "print(round($1, 3))"; }

render() {
  local slug="$1"
  # blend runs in RGB (gbrp): in YUV its screen mode would also add the chroma planes and turn everything pink.
  # Tint: the hall's luminance recoloured to the worldline colour, with 25% of the original kept.
  read -r cr cg cb <<<"$2"
  local k=0.75 o=0.25
  local grade="colorchannelmixer=rr=$(m "$o+$k*0.3*$cr"):rg=$(m "$k*0.59*$cr"):rb=$(m "$k*0.11*$cr"):gr=$(m "$k*0.3*$cg"):gg=$(m "$o+$k*0.59*$cg"):gb=$(m "$k*0.11*$cg"):br=$(m "$k*0.3*$cb"):bg=$(m "$k*0.59*$cb"):bb=$(m "$o+$k*0.11*$cb"),eq=saturation=1.25"
  "$FF" -y -hide_banner -loglevel error \
    -loop 1 -framerate 30 -t 2.6 -i "$P/rebirth/rebirth_collapse_shared_v1.png" \
    -loop 1 -framerate 30 -t 1.7 -i "$P/rebirth/rebirth_void_tear_shared_v1.png" \
    -loop 1 -framerate 30 -t 5.5 -i "$P/bg/transcendence_room_base.png" \
    -loop 1 -framerate 30 -t 5.5 -i "$P/rebirth/rebirth_particles_shared_v1.png" \
    -loop 1 -framerate 30 -t 5.5 -i "$M/keyed/stamp_${slug}.png" \
    -i "$M/rebirth_bgm.wav" \
    -filter_complex "
[0]scale=3840:2160:flags=lanczos,
 zoompan=z='1+0.95*pow(on/78,2.2)':x='iw/2-iw/zoom/2+iw/zoom*0.006*sin(on*1.9)*on/78':y='ih/2-ih/zoom/2+ih/zoom*0.006*cos(on*2.3)*on/78':d=1:s=1472x828:fps=30,
 rotate='0.22*pow(t/2.6,2)',crop=1280:720,
 eq=eval=frame:gamma=1.45:brightness='0.04-0.35*pow(max(0,(t-1.9)/0.7),2)':contrast=1.2:saturation=1.4,
 fade=t=in:st=0:d=0.5,setsar=1,format=yuv420p[a];
[1]scale=3840:2160:flags=lanczos,
 zoompan=z='1+2.2*pow(on/51,1.8)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1280x720:fps=30,
 tmix=frames=4,
 eq=eval=frame:gamma=1.4:brightness='-0.25+0.3*min(1,t/0.4)+1.1*pow(max(0,(t-1.15)/0.55),2)':contrast=1.25:saturation=1.5,
 setsar=1,format=yuv420p[b];
[2]scale=3840:2160:flags=lanczos,
 zoompan=z='1.38-0.3*(1-pow(1-on/165,3))':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2-ih/zoom*0.04*(1-on/165)':d=1:s=1280x720:fps=30,
 ${grade},eq=eval=frame:contrast=1.08:brightness='0.05*sin(2*PI*t/2.2)*gte(t,1.5)',format=gbrp[hall];
[3]scale=1664:936,crop=1280:720:192:'108+100*t',format=rgba,colorchannelmixer=aa=0.75,format=gbrp[sparks];
[4]format=rgba,split[s1][s2];
[s2]scale=640:640,gblur=sigma=40,colorchannelmixer=rr=2:gg=2:bb=2:aa=2[glow];
[s1]scale=640:640[mark];
[glow][mark]overlay=0:0,
 scale=w='430*(1+0.9*exp(-max(0,t-0.3)*4.5))*(1+0.015*sin(2*PI*t/2.2))':h=-1:eval=frame,
 fade=t=in:st=0.3:d=0.55:alpha=1[stamp];
[hall][sparks]blend=all_mode=screen:shortest=1[hs];
[hs][stamp]overlay=x='(W-w)/2':y='H*0.41-h/2':eval=frame:shortest=1,
 fade=t=in:st=0:d=0.8:color=white,fade=t=out:st=4.75:d=0.75,setsar=1,format=yuv420p[c];
[a][b][c]concat=n=3:v=1:a=0,noise=alls=6:allf=t,vignette=PI/4.6,format=yuv420p[v]" \
    -map "[v]" -map 5:a -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 160k -movflags +faststart -t 9.8 \
    "$P/rebirth/rebirth_${slug}.mp4"
  echo "$P/rebirth/rebirth_${slug}.mp4"
}

declare -A GRADE=(
  [directive_pulse]="0.35 0.85 1.45"
  [aurelia_grid]="1.45 1.05 0.35"
  [resonance_protocol]="1.15 0.5 1.45"
  [volatile_core]="1.55 0.55 0.25"
  [adaptive_architect]="0.3 1.3 1.05"
)
for slug in ${1:-directive_pulse aurelia_grid resonance_protocol volatile_core adaptive_architect}; do
  render "$slug" "${GRADE[$slug]}"
done
