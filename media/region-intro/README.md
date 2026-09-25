# Region first-visit intros

Played once per save the first time the player enters a region (`RegionDef.intro`).
The BGM is baked into the video's audio track, so the game BGM goes silent while it plays.

| Region | Video | BGM source |
|---|---|---|
| Signal Relay | `public/clicker/region/signal_relay_intro.mp4` | `signal_relay_intro_bgm.wav` — 120 BPM pulse, A-minor relay blips |
| Phase Vault | `public/clicker/region/phase_vault_intro.mp4` | `phase_vault_intro_bgm.wav` — D-minor drone, FM bell chimes |

- 9 s · 1280×720 · 30 fps · H.264 crf 22 + AAC 160k
- Picture: region background (`public/clicker/bg/region_*.png`) with a slow ease-in-out dolly,
  fade in/out, grain and vignette. Relay flickers on the 2 Hz signal beat; Vault breathes on a 4 s cycle.
- BGM: `python3 generate_intro_bgm.py` (numpy) → the two WAVs.

Render (ffmpeg), Signal Relay:

```
ffmpeg -loop 1 -framerate 30 -t 9 -i region_signal_relay.png -i signal_relay_intro_bgm.wav -filter_complex "
[0]scale=3840:2160:flags=lanczos,zoompan=z='1+0.55*(1-cos(PI*on/270))/2':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+ih*0.02*on/270':d=1:s=1280x720:fps=30,
eq=eval=frame:brightness='0.05*pow(max(0,sin(2*PI*2*t)),8)*gte(t,2)':contrast=1.08:saturation=1.25,
hue=h='8*sin(2*PI*t/9)',noise=alls=7:allf=t,vignette=PI/4.5,
fade=t=in:st=0:d=1.2,fade=t=out:st=7.9:d=1.1,format=yuv420p[v]"
-map "[v]" -map 1:a -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 160k -movflags +faststart -t 9 signal_relay_intro.mp4
```

Phase Vault:

```
ffmpeg -loop 1 -framerate 30 -t 9 -i region_phase_vault.png -i phase_vault_intro_bgm.wav -filter_complex "
[0]scale=3840:2160:flags=lanczos,zoompan=z='1+0.38*(1-cos(PI*on/270))/2':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-ih*0.015*on/270':d=1:s=1280x720:fps=30,
eq=eval=frame:brightness='-0.02+0.04*sin(2*PI*t/4)':gamma_b='1.05+0.08*sin(2*PI*t/4)':saturation=1.2,
noise=alls=5:allf=t,gblur=sigma='0.6',vignette=PI/4,
fade=t=in:st=0:d=1.8,fade=t=out:st=7.6:d=1.4,format=yuv420p[v]"
-map "[v]" -map 1:a -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 160k -movflags +faststart -t 9 phase_vault_intro.mp4
```
