# Mine Enter — Door-Open Reveal Wiring Handoff

## Preferred motion pack

For the Enter Mine transition, prefer the self-made **door-walk-v4** pack below. Do not prefer older fog/crossfade packs, door-open-5s, or door-walk-v2/v3 — v4 is the current preferred: closed door first, mechanical center split-open with a very slight aperture mist, then walk-through with doors remaining visible at the sides (문이 가운데부터 열리고 갑자기 사라지지 않음; 틈으로만 내부; 걸어가는 느낌; 텔레포트 금지).

- Pack: `/workspace/clicker-artifacts/mine-enter-door-walk-v4-2026-09-24/`
- Runtime mirror: `/workspace/clicker-local/incoming-art/mine-enter-door-walk-v4-2026-09-24/`
- Frames: `frames/mine_enter_door_walk_v4_f00.png` … `f69.png`
- Playback: 10 fps, 100 ms/frame, **70 frames, 7.0 seconds**, 1280×720
- Preview: `mine_enter_door_walk_v4_preview.mp4` / `.gif`
- Motion notes: `MOTION.md` in that pack (copy: `MOTION.md` here)

## Required behavior

- Hub initially renders the closed entrance art; do not show the interior before entry (f00 is fully closed, no fog/mist).
- On Enter Mine, play f00 → f69 in order at 10 fps. f00–f15 approaches the closed door, f16–f38 center split-slides the door halves open (mechanical ease-in → smooth middle → soft settle; very slight low-alpha mist only in/near the growing aperture; interior only in the gap), f39–f69 walks through toward the center mineral ore with continuous dolly; side door panels stay opaque and visible (no foreground fade or sudden disappearance).
- Continuous forward move — not a teleport or dissimilar-key crossfade. No settle/ore swap at the end; same `mine_interior_mineral_ore_v2.png` plate through the final frame.
- Block ore harvesting while `phase === 'entering'`; start the mine timer only after the final frame completes.
- Respect `prefers-reduced-motion`: skip or shorten playback but complete the same state transition.
- If any frame is missing, fall back gracefully to static entrance/interior art and still complete entry.
- Preserve existing Enter/Exit labels, HUD behavior, SFX hooks, and timeout behavior; do not change unrelated currency/UI behavior.

## Visual implementation note

The supplied frames already contain the PIL/OpenCV split-slide composition (plus the localized aperture mist in the open phase). At runtime treat the sequence as ordinary ordered frames; do not recreate the mask or mist in the app.
