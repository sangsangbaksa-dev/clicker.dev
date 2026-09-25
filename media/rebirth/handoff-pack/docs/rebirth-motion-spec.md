# Rebirth motion design — hsms-md

Aesthetic (PROVISIONAL until style guide): dark sci-fi UI, neon pulse, holographic grid, resonance rings, unstable core energy. Korean clicker / idle readability: flashy, high contrast, not muddy. Phone + desktop.

---

## 1. Overall beat timeline (0.0–3.5s)

| Phase | Time (s) | Beat | Player-facing feel |
|-------|----------|------|--------------------|
| Select confirm | 0.00–0.25 | Worldline chip/button locks; brief flash on selection | “Choice locked” |
| Collapse | 0.25–0.90 | UI crumples inward; particles suck to center | Current world ends |
| Void / tear | 0.90–1.50 | Near-black; thin tear / rift line; chromatic noise | Empty between worlds |
| Worldline stamp | 1.50–2.20 | Signature glyph + color field slam; motif bloom | New worldline branded |
| Rebuild | 2.20–3.00 | UI / HUD reconstructs from stamp outward | New world assembles |
| Settle | 3.00–3.50 | Shake stop, filters fade, idle UI returns | Playable again |

Total: **3.5s** default. Optional shorten to **2.8s** on “reduce motion” (cut void hold + settle).

---

## 2. Layer list (engine / UI)

| Layer ID | Type | Role |
|----------|------|------|
| `overlay_fullscreen` | DOM/Canvas fullscreen | Dim, vignette, void fill |
| `particles` | Canvas / particle system | Collapse suck, stamp burst, rebuild sparkles |
| `screen_shake` | Camera / CSS transform | Short bursts on stamp + rebuild peak |
| `chromatic_aberration` | CSS filter / post FX | Peak on void tear + stamp impact |
| `ui_fade` | Opacity / clip on HUD | Collapse hide → rebuild reveal |
| `stamp_glyph` | Sprite / SVG / canvas draw | Per-worldline stamp (center) |
| `motif_fx` | Canvas / WebGL / CSS | Rings, grid, pulse bars, core flares |
| `audio_cues` | Audio placeholders (names only) | See below |

### Audio cue placeholders (name only)

1. `sfx_rebirth_confirm_click`
2. `sfx_rebirth_collapse_whoosh`
3. `sfx_rebirth_void_tear`
4. `sfx_rebirth_stamp_[worldline]` — variants: `directive_pulse`, `aurelia_grid`, `resonance_protocol`, `volatile_core`
5. `sfx_rebirth_rebuild_rise`
6. `sfx_rebirth_settle_chime`

---

## 3. Per-worldline variant table

All color temps / hex below are **PROVISIONAL** role names — not locked brand.

| Worldline | Color temperature (PROVISIONAL) | Signature motif | Particle behavior | Stamp glyph idea |
|-----------|----------------------------------|-----------------|-------------------|------------------|
| Directive Pulse | Cool cyan → electric blue (`role_pulse_primary` ~#00E5FF, `role_pulse_accent` ~#3D7EFF) | Vertical pulse bars / signal spikes | Particles snap to vertical lanes; staccato bursts | Chevron / pulse-wave chevron stack in circle |
| AURELIA Grid | Warm gold → amber (`role_grid_primary` ~#FFC857, `role_grid_accent` ~#E8A838) | Holographic square grid, soft glow nodes | Particles snap to grid intersections; lattice expand | Nested square / aureole crosshair |
| Resonance Protocol | Magenta → violet (`role_res_primary` ~#FF4DDC, `role_res_accent` ~#9B5CFF) | Concentric resonance rings | Particles orbit then phase-align on ring edges | Concentric arcs + center node |
| Volatile Core | Hot orange → crimson (`role_core_primary` ~#FF6A3D, `role_core_accent` ~#FF2E63) | Unstable core orb, flicker flares | Erratic outward jets; flicker spawn/despawn | Cracked circle / core gem with fissures |

Shared dark base (PROVISIONAL): `role_void` ~#05070D, `role_ui_ink` ~#0B0F1A, `role_highlight_white` ~#E8F4FF.

---

## 4. Implementation notes (web clicker — CSS / Canvas / WebGL)

Prefer cheap first; escalate only if needed.

| Effect | Preferred tech | Notes |
|--------|----------------|-------|
| Fullscreen dim / void | CSS overlay (`opacity`, `background`) | DOM layer; z-index above game, below modal chrome if needed |
| UI fade / crumple | CSS `opacity`, `transform: scale`, optional `clip-path` | Avoid heavy blur on whole DOM (perf) |
| Screen shake | CSS `transform: translate` on root stage | Cap amplitude; disable if `prefers-reduced-motion` |
| Chromatic aberration | CSS `filter` on overlay clone **or** lightweight WebGL pass | Short duration only (void + stamp) |
| Particles | Canvas 2D particle system | Sprite sheet for glow dots optional; keep count mobile-safe (~80–200) |
| Stamp glyph | SVG or single PNG sprite per worldline | Animate scale + opacity; optional sprite sheet for impact frames |
| Motif FX (rings/grid/bars) | Canvas draw **or** CSS pseudo + transforms | Grid: Canvas lines. Rings: Canvas arcs. Pulse bars: Canvas rects or CSS |
| Heavy bloom / distortion | WebGL / shader (optional) | Only if Canvas + CSS looks muddy; not required for v1 |

### Sprite sheet vs CSS filter vs particles

1. **Sprite sheet** — stamp impact frames, small glow bursts, crack overlays (Volatile Core). Bake in image tool from prompt sheets.
2. **CSS filter** — chromatic aberration, brief brightness flash, vignette via radial gradient overlay (not filter if avoidable).
3. **Particle system** — collapse suck, stamp sparkle, rebuild dust. Parametrize by worldline table (lane snap / grid snap / orbit / jet).

### Reduced motion

- Skip shake + chromatic.
- Collapse → short fade to void → stamp (static) → fade UI in.
- Target ≤1.5s.

### Acceptance (visual)

Flashy, readable stamp glyph for 300ms+ at stamp peak; HUD readable by Settle; no muddy brown mix of all four worldline colors in one frame.
