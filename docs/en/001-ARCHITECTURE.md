# Architecture

The repository uses ports and adapters without turning every small function into a separate layer.

```text
SolidJS WebView -> narrow Tauri IPC -> Tauri app adapter -> core use cases
                                                       -> CommandRunner port
CLI presentation -----------------> CLI app adapter ---> CommandRunner port
```

## Core

`packages/core` contains application DTOs, domain state, stable error codes, use-case orchestration, and adapter traits. It has no dependency on Tauri, Clap, or a concrete process implementation. `CommandRequest` holds a native executable path, an argument vector, a timeout, and an aggregate output limit. `CommandOutput` preserves stdout and stderr as bytes so non-UTF-8 device output is not silently corrupted.

Phase 1 ADB use cases construct command requests only from a validated ADB path, serials from the current device snapshot, parsed non-negative user IDs, the fixed Credential Provider service action, and a three-key read allowlist. The generic runner is an internal Rust port and is never an IPC or CLI user-input surface.

Phase 2 adds a Core-owned change state machine and abstract snapshot store. `packages/storage` is the shared local filesystem adapter used by GUI and CLI. A plan binds the exact before-state and registered Provider set for five minutes; only the Core executor can construct writes to the two managed keys. Tauri exposes opaque provider, preview, plan, and snapshot IDs rather than raw command material.

## Applications

The Tauri app implements `CommandRunner` with the Rust API of `tauri-plugin-shell`. The plugin's JavaScript binding is absent, and the WebView capability contains no shell permission. The CLI implements the same port with `tokio::process::Command`. Both adapters use argument arrays, bounded byte collection, timeouts, and child termination.

The frontend owns rendering, opaque candidate/device selection, confirmation, localization, theming, and accessible interaction. It never parses ADB output. Tailwind CSS 4 consumes CSS-first semantic tokens, while local Solid primitives provide consistent sizes, variants, nested radii, focus states, and spacing without adding a component runtime. Park UI is a design reference only; workflow components do not depend on Park UI, Ark UI, or Panda CSS.

IPC endpoints cover startup state, appearance preference, ADB discovery/selection, native ADB selection, device listing/inspection, onboarding, and the deterministic Demo fixture. Native paths and serials stay in backend session state. The System/Light/Dark preference is validated and stored by the backend in the application-private preferences file; the WebView receives no filesystem permission. Demo data uses the same report DTO but cannot call the live adapter.

[English](001-ARCHITECTURE.md) | [中文](../zh/001-ARCHITECTURE.md)
