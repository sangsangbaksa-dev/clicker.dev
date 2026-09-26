# Region entry intros

Played every time the player travels into a region (`RegionDef.intro`), including the return to Core Mine
and the arrival in a new world line after rebirth (Core Mine video, `WORLD LINE #NNN · 진입`).
The caption reads `NEW REGION · 첫 진입` on the first visit, `REGION · 진입` afterwards and `HOME · 귀환` for Core Mine.
The BGM is baked into the video's audio track, so the game BGM goes silent while it plays.

| Region | Video | BGM source |
|---|---|---|
| Core Mine | `public/clicker/region/core_chamber_intro.mp4` | `core_chamber_intro_bgm.wav` — C-major pad, core heartbeat, rising chimes |
| Signal Relay | `public/clicker/region/signal_relay_intro.mp4` | `signal_relay_intro_bgm.wav` — 120 BPM pulse, A-minor relay blips |
| Phase Vault | `public/clicker/region/phase_vault_intro.mp4` | `phase_vault_intro_bgm.wav` — D-minor drone, FM bell chimes |
| Storm Spire | `public/clicker/region/storm_spire_intro.mp4` | `storm_spire_intro_bgm.wav` — E-minor pad, rain, thunder on 5 flashes |
| Deep Fault | `public/clicker/region/deep_fault_intro.mp4` | `deep_fault_intro_bgm.wav` — sub rumble, tectonic booms |
| Drone Foundry | `public/clicker/region/drone_foundry_intro.mp4` | `drone_foundry_intro_bgm.wav` — 128 BPM machine groove, anvil clanks |

Storm Spire, Deep Fault and Drone Foundry had no art of their own, so they reuse mine plates with a
colour grade (violet storm / molten red / amber industrial). The same grade is baked into their stage
backgrounds `public/clicker/bg/region_{storm_spire,deep_fault,drone_foundry}.jpg`.
Storm flashes (1.4/3.2/4.9/6.1/7.3 s) and Fault tremors (1.2/3.4/5.0/6.4/7.4 s) are timed to the BGM hits.

- 9 s · 1280×720 · 30 fps · H.264 crf 22–25 + AAC 160k
- Picture: region background (`public/clicker/bg/region_*.png`) with a slow ease-in-out dolly,
  fade in/out, grain and vignette. Relay flickers on the 2 Hz signal beat; Vault breathes on a 4 s cycle.
- BGM: `python3 generate_intro_bgm.py` (numpy) → the WAVs.

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

Storm Spire / Deep Fault / Drone Foundry (grades and time expressions):

```
STORM_GRADE=colorchannelmixer=rr=0.55:rg=0.1:rb=0.35:gg=0.6:gb=0.25:bb=1.15:br=0.15,eq=contrast=1.12:saturation=1.1
FAULT_GRADE=colorchannelmixer=rr=1.2:rg=0.55:rb=0.2:gr=0.2:gg=0.3:gb=0.1:br=0.05:bg=0.05:bb=0.15,eq=contrast=1.15:saturation=1.35:gamma=0.95
FOUNDRY_GRADE=colorchannelmixer=rr=1.15:rg=0.2:gg=0.85:gr=0.1:bb=0.45,eq=contrast=1.08:saturation=0.9

storm:   mine_interior_hitech_v1.png, zoompan z=1→1.45 rising, grade, eq brightness = 0.55·Σ exp(-10·(t−flash)),
         noise 5, crf 25
fault:   mine_interior_mineral_ore_v2.png, zoompan to 1360×765 then crop 1280×720 with x/y shake
         30·sin(41t)/18·sin(53t+1) scaled by Σ exp(-3·(t−boom)), grade, crf 24
foundry: mine_scene_core_chamber_v1.png, zoompan z=1.3→1.15 panning left→right, grade,
         drawbox scanner bar y=mod(340t, 900)−90 (14 px, #ffc266 @ 0.55), 2.13 Hz beat pulse, crf 24
```

Core Mine (home return) — pull back from the core with a heartbeat glow every 1.1 s, matching the BGM:

```
ffmpeg -loop 1 -framerate 30 -t 9 -i region_core_chamber.png -i core_chamber_intro_bgm.wav -filter_complex "
[0]scale=3840:2160:flags=lanczos,zoompan=z='1.5-0.5*(1-cos(PI*on/270))/2':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,
eq=eval=frame:brightness='0.06*exp(-9*abs(mod(t-1.2+1.1,1.1)))*gte(t,1.1)':contrast=1.06:saturation=1.15,
colorbalance=rh=0.05:bh=-0.04,noise=alls=5:allf=t,vignette=PI/4.5,
fade=t=in:st=0:d=1.4,fade=t=out:st=7.7:d=1.3,format=yuv420p[v]"
-map "[v]" -map 1:a -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 160k -movflags +faststart -t 9 core_chamber_intro.mp4
```
