# NDI Native Companion Migration Draft

## Purpose
Define a reliable, professional NDI output architecture without using Electron for the companion process.

## Executive Summary
The current companion pipeline is optimized for static overlays, not full-motion scenes.
Current frame path: browser render -> screenshot PNG -> PNG decode -> RGBA -> NDI send.
This path can work for text-only overlays but will stutter under motion/video load.

Professional presentation systems avoid screenshot pipelines. They use a native GPU renderer with deterministic frame pacing and direct NDI frame submission.

This draft proposes a migration to a native standalone companion (Rust) while preserving the current app as control plane.

## Current Constraints (Observed)
1. Capture path uses CDP screenshot PNG per frame and PNG decode.
2. Render and NDI send loops are independently timed.
3. Chromium launch disables GPU in companion.
4. Motion-heavy transitions and video backgrounds amplify frame-time spikes.
5. Runtime framerate update logic in capture is not truly dynamic.

## Target Architecture

### High-Level Split
1. Control Plane (existing app)
- Keeps UI, settings, line selection, song state, and user workflow.
- Sends state deltas to companion.
- Receives health/performance telemetry.

2. Render Plane (new native companion)
- Standalone process (no Electron).
- Native scene composition and frame scheduling.
- Direct NDI SDK frame submission.

### Process Model
1. `lyricdisplay-ndi-native` process
- Runtime: Rust.
- IPC server on localhost (named pipe on Windows, Unix socket on macOS/Linux, TCP fallback for debug).
- One render thread per output or one scheduler thread with per-output workers (configurable).

2. Main app integration
- `main/ndiManager.js` keeps install/launch/update orchestration.
- Replace Node companion entry with native executable launch.
- Preserve settings schema where possible for low migration risk.

### Rendering Stack (Proposed)
1. GPU abstraction
- `wgpu` for portability (D3D12/Metal/Vulkan under the hood).

2. Text shaping and rasterization
- HarfBuzz + fontdb + cosmic-text (or equivalent stack) for predictable typography.
- Cache glyph atlases to avoid per-frame text layout costs.

3. Video/image background decoding
- FFmpeg (hardware acceleration enabled where available).
- Dedicated decode thread and texture upload queue.

4. Scene composition
- Per-output scene graph:
  - background layer (color/image/video)
  - band/box layer
  - text layer(s)
  - optional transition layer
- Transition library limited to deterministic, low-cost effects by default.

### NDI Output Stack
1. Native NDI SDK bindings (Rust FFI wrapper).
2. Output queue depth fixed (default 1, optional 2 for burst tolerance).
3. Strict backpressure: no unbounded fire-and-forget sends.
4. Explicit output pacing:
- scheduler ticks at target framerate.
- if render misses deadline, drop intermediate animation step but keep latest state.

## IPC Contract (Control <-> Companion)

### Transport
1. Local named pipe/socket (primary).
2. Optional localhost WebSocket for debug mode.

### Message Envelope
```json
{
  "type": "set_line",
  "output": "output1",
  "seq": 182,
  "ts": 1739486400000,
  "payload": {}
}
```

### Core Commands
1. `hello`
- Version handshake, capabilities.

2. `set_outputs`
- Enable/disable outputs.
- Resolution, framerate, source name.

3. `set_scene_style`
- Font, colors, alignment, stroke, shadows, margins, transition style.

4. `set_content`
- Lyrics list, selected line, grouped translation metadata.

5. `set_media`
- Background mode (none/color/image/video), media URI, loop mode.

6. `set_transition`
- Transition type and duration.

7. `request_stats`
- Pull latest telemetry snapshot.

8. `shutdown`
- Graceful teardown.

### Telemetry Events
1. `stats`
- capture_fps (if applicable), render_fps, send_fps, dropped_frames, avg_frame_ms, p95_frame_ms, queue_depth, ndi_send_failures.

2. `health`
- process uptime, memory, GPU backend, decode status, warning flags.

3. `error`
- structured errors with code + message + recoverability flag.

## Frame Timing Model
1. Output target interval = `1000 / fps`.
2. Each frame cycle:
- consume latest committed state
- render scene to texture
- map/convert to NDI pixel format as needed
- submit frame
3. If over budget:
- do not block next frame waiting for stale sends
- skip intermediate animation frames, keep state freshness
4. Clock source:
- monotonic high-resolution timer only.

## Quality Modes
1. `Overlay` (default)
- Text + static backgrounds.
- Minimal transition effects.
- Highest reliability.

2. `Balanced`
- Lightweight transitions + optional low-motion media.

3. `Motion`
- Full video background and richer transitions.
- Auto-degrade enabled if frame budget is exceeded.

Auto-degrade order:
1. Disable expensive transition effects.
2. Reduce transition duration complexity.
3. Lower internal render scale (optional).
4. Lower output fps only if user allows adaptive fps.

## Compatibility Plan

### Keep Existing Settings Keys
Reuse current fields to avoid UI rewrite:
1. `enabled`
2. `resolution` + `customWidth/customHeight`
3. `framerate`
4. `sourceName`

Add optional new keys:
1. `performanceMode`: `overlay | balanced | motion`
2. `adaptiveQuality`: boolean
3. `statsOverlay`: boolean

### Migration Strategy
1. Use dual-engine rollout gates during transition.
2. Feature flag in app:
- `NDI Engine: legacy | native`.
3. Roll out native by output type first:
- Output1/Output2, then Stage.

## Milestones

### Phase 1: Native Companion MVP (Text + Color/Image)
1. Rust companion executable with IPC handshake.
2. One output path at 720p/1080p, 30fps.
3. Text rendering + static backgrounds.
4. NDI source send with stable pacing.

Acceptance:
1. 1080p30 text overlays stable for 60 minutes.
2. p95 frame time under budget for overlay mode.

### Phase 2: Video Background + Transitions
1. FFmpeg decode pipeline.
2. Transition engine with low-cost default effects.
3. Adaptive quality manager.

Acceptance:
1. 1080p30 with video background and fade transition stable for 30 minutes.
2. No unbounded queue growth.

### Phase 3: Production Hardening
1. Crash recovery + watchdog restart.
2. Full telemetry and support bundle export.
3. Cross-platform QA matrix.

Acceptance:
1. Soak tests pass on Windows/macOS.
2. Controlled degradation under overload.

## Performance Targets
1. Overlay mode (1080p30):
- dropped_frames < 0.5% over 30 min.
- p95 frame time <= 33ms.

2. Motion mode (1080p30):
- dropped_frames < 2% over 30 min.
- no sustained backlog growth.

3. Startup:
- companion ready <= 3s after launch (warm cache).

## Risks and Mitigations
1. NDI SDK licensing and redistribution constraints.
- Mitigation: legal review before packaging pipeline.

2. Cross-platform GPU/backend differences.
- Mitigation: backend feature detection + fallback matrix.

3. FFmpeg hardware decode inconsistencies.
- Mitigation: software decode fallback with profile downgrade.

4. Migration complexity.
- Mitigation: dual-engine rollout with feature flag.

## Suggested Repository Layout (Future)
```text
ndi-native/
  Cargo.toml
  src/
    main.rs
    ipc/
    render/
    scene/
    ndi/
    media/
    telemetry/
```

## Immediate Next Steps
1. Approve this architecture direction.
2. Create `ndi-native` scaffold with IPC handshake and one static test frame output.
3. Implement Phase 1 and validate 1080p30 overlay targets.
4. Begin Phase 2 with hardware-accelerated media decode and adaptive quality controls.
