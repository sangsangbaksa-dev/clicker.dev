# Rebirth cinematics

Played full-screen when the player folds into a worldline (`rebirthCinematicFor` in
`src/data/clicker/rebirth-assets.ts`), through the same `ClickerCinematic` as the region intros.
The rebirth is applied when the video ends or is skipped.

| Worldline | Video | Grade |
|---|---|---|
| Directive Pulse (`focus_line`) | `public/clicker/rebirth/rebirth_directive_pulse.mp4` | blue |
| AURELIA Grid (`auto_line`) | `public/clicker/rebirth/rebirth_aurelia_grid.mp4` | gold |
| Resonance Protocol (`reso_line`) | `public/clicker/rebirth/rebirth_resonance_protocol.mp4` | violet |
| Volatile Core (`risk_line`) | `public/clicker/rebirth/rebirth_volatile_core.mp4` | ember |
| Adaptive Architect (`hybrid_line`) | `public/clicker/rebirth/rebirth_adaptive_architect.mp4` | teal |

- 9.8 s · 1280×720 · 30 fps · H.264 crf 23 + AAC 160k
- 0–2.6 s collapse plate: accelerating push into the void with shake and a slow twist.
- 2.6–4.3 s void-tear plate: warp rush with motion blur, blowing out to white.
- 4.3–9.8 s transcendence hall tinted to the worldline colour, pulling back while the stamp drops in
  (glow, settle, slow breathing) under rising sparks; the game shows the worldline name at 4.8 s.
- Soundtrack `rebirth_bgm.wav` (`generate_bgm.py`, numpy): sub rumble → FM riser → impact →
  D-major add9 pad with a bell arpeggio.
- Stamps: `public/clicker/stamp/*.png` are JPEGs with a baked checkerboard; `key_stamps.mjs` keys it
  out by saturation into `keyed/` (generated, not committed).

Render all five: `FFMPEG=/path/to/ffmpeg media/rebirth-cinematic/render.sh` (or pass one slug).
