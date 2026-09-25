# Particle layer notes — rebirth motion (art direction)

Companion to `rebirth-motion-spec.md` §2 (`particles`) and `prompt-sheets/07-particles-overlay.md` (image plates).  
These are **placeholder counts and behaviors for Canvas/CSS**, not code. Colors stay **PROVISIONAL**.

Updated: 2026-09-22 Asia/Seoul (paced art slice).

---

## Budget (mobile-first)

| Device class | Soft max live particles | Notes |
|--------------|-------------------------|--------|
| Phone | ~80–120 | Prefer dots + short streaks; no heavy trails |
| Desktop | ~150–200 | Same shapes; denser only at stamp peak |

Cap total simultaneous particles across all emitters. Prefer recycle over spawn spikes.

---

## Phase schedule (default 3.5s timeline)

| Phase | Time (s) | Goal | Spawn bias | Death / fade |
|-------|----------|------|------------|--------------|
| Select confirm | 0.00–0.25 | Almost none | Optional 4–8 rim ticks on locked card only | Instant clear by 0.25 |
| Collapse | 0.25–0.90 | Suck to center | Spawn at HUD edges / outer ring; velocity toward center; slight inward spiral OK | Despawn when within ~8% of center radius or at phase end |
| Void / tear | 0.90–1.50 | Sparse + tear edge | Very low density; thin points along one narrow rift; cool white cores | Hold sparse; no new bursts except rift shimmer |
| Worldline stamp | 1.50–2.20 | Motif burst | One short burst at stamp impact (~1.55–1.70); then motif-shaped residual | Burst half-life ~0.25–0.35s; residual fades into Rebuild |
| Rebuild | 2.20–3.00 | Outward sparkles | Spawn near center → drift outward along panel edges | Fade as HUD opacity rises |
| Settle | 3.00–3.50 | Idle clean | No new spawns | All particle opacity ≤0 by 3.50 |

Reduced-motion path (≤1.5s): **skip** suck / burst / jets. Optional 12–20 static dust points under the still stamp, fade with UI in. No shake-synced pulses.

---

## Shared shapes (all worldlines)

1. **Dot** — 1–3px glow core (`role_highlight_white` or worldline primary, PROVISIONAL)
2. **Streak** — short 6–18px line, motion-aligned
3. **Shard** — tiny UI fragment (rectangle / chevron scrap); collapse only; never readable glyphs

Do not use soft muddy fog sprites. Keep contrast high on `role_void` ~#05070D.

---

## Per-worldline behavior (stamp + rebuild residual)

Use **one** tint family per run. Hex below are role reminders only — **not locked brand**.

### Directive Pulse
- Tint: cooler cyan → electric blue (`role_pulse_primary` / `role_pulse_accent`)
- Motion: snap into **vertical lanes**; staccato micro-bursts (2–4 pulses) instead of one soft bloom
- Stamp burst: vertical bar of dots above/below glyph, not a circle spray
- Rebuild: sparkles rise in columns toward HUD edges

### AURELIA Grid
- Tint: warm gold → amber (`role_grid_primary` / `role_grid_accent`)
- Motion: particles **snap to grid intersections**; brief lattice expand then retract
- Stamp burst: square ring of points at 1–2 grid steps from glyph
- Rebuild: sparkles travel along orthogonal grid lines only

### Resonance Protocol
- Tint: magenta → violet (`role_res_primary` / `role_res_accent`)
- Motion: **orbit** then phase-align on ring edges
- Stamp burst: 2–3 concentric arcs of dots (incomplete rings OK)
- Rebuild: sparkles spiral outward then flatten to HUD rim

### Volatile Core
- Tint: hot orange → crimson (`role_core_primary` / `role_core_accent`)
- Motion: **asymmetric jets**; flicker spawn/despawn (high variance lifetime)
- Stamp burst: cracked radial jets (uneven angles); avoid perfect symmetry
- Rebuild: residual flares die fast; leave HUD margins clean early

---

## Overlay plate pairing

| Plate file (convention) | When to show |
|-------------------------|--------------|
| `rebirth_particles_shared_v1.png` | Collapse → Void base (all worldlines) |
| `rebirth_particles_[worldline]_v1.png` | Stamp + Rebuild tinted residual (optional; runtime tint of shared OK for v1) |

Plates are art; this note drives **when** and **how dense** the live particle system runs on top.

---

## Acceptance (particle layer only)

1. Collapse reads as suck-to-center, not explosion.
2. Stamp peak is readable: glyph silhouette not buried under >~40 overlapping particles at center.
3. Each worldline’s residual motion is distinguishable without mixing tint families.
4. By Settle, no leftover particle noise on playable HUD.
5. Reduced-motion path never runs suck / jet / orbit emitters.
