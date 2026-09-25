# Mine Enter — Door Walk v9 (SEAM=616 + 200@20 smoother)

**Pack:** `mine-enter-door-walk-v9-2026-09-24`  
**Date:** 2026-09-24 (KST)  
**Spec:** 200 frames · 20 fps · **10.0 s** · 1280×720 RGB PNG  
**Method:** Self-made PIL/OpenCV compositing only. No Cursor, Runway, or messaging.

## What changed vs v8

- **SEAM=616** from user neon-orange vertical line on closed-door markup
  (825×566 → median x≈397; resized 1280×720 modal≈615;
  formula 397/825×1280≈615.95). **Not 640.**
- Gap / equal L/R leaf travel from that seam (slightly left of hex geometric center).
- **Smoother:** 200@20 (double v8’s 100@10); timing fractions preserved.
- **Quality:** full-res LANCZOS composite; PNG frames; libx264 crf 14 preset slow;
  SFX muxed fresh from Waldusic path (v2 louder/heavier).

## Kept from v8

1. Interior — continuous mineral plate ~60% scale
2. Static hub shell — rock + cyan frame OUTSIDE hex; never translated/split
3. Door leaves only — hex plate split at SEAM, clipped to hex (through-gap feel)
4. Hex mask: HEX_CX/CY=640/350, HALF_W/H=210/195
5. 10.000s + full-length SFX; no settle/ore swap; f00 MAE≈0 vs closed door

## Timeline (proportions = v8 ×2)

| Phase | Frames | Time | Motion |
|---|---:|---:|---|
| Approach | f000–f030 | 1.55 s | Closed door, zoom ~1.00→1.12, slide=0 |
| Leaves part + push | f032–f090 | 2.95 s | Plate-only SEAM-out travel; gap grows |
| Cross threshold | f091–f140 | 2.50 s | Leaves hide under frame; aperture + dolly |
| Inside chamber | f141–f199 | 2.95 s | Shell cropped by zoom; full interior |

## Files

- Frames: `frames/mine_enter_door_walk_v9_f000.png` … `f199.png`
- Silent preview: `mine_enter_door_walk_v9_preview.mp4`
- Hi-bitrate preview: `mine_enter_door_walk_v9_preview_hibit.mp4`
- Audio preview: `mine_enter_door_walk_v9_with_sfx.mp4` (SFX v2)
- Incoming-art: `/workspace/clicker-local/incoming-art/mine-enter-door-walk-v9-2026-09-24/`
- Preview mirror: `/tmp/mine-enter-preview/mine_enter_door_walk_v9_with_sfx.mp4`
