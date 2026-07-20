# Roadmap

## Engineering baseline — complete

- SolidJS 2 / Tauri 2 application shell and bilingual UI
- Shared core contracts and bounded process-runner ports
- Tauri Rust and Tokio CLI adapters
- Documentation, VitePress, repository tooling, and cross-platform build CI
- Native CLI archives, Tauri installer workflows, release evidence, and bilingual GitHub Pages deployment

## Phase 1 — read-only diagnosis — complete

- ADB discovery, path selection, and version validation
- Device enumeration and explicit confirmation
- Android compatibility and foreground-user inspection
- Registered Credential Provider enumeration and current-state reads
- Fake ADB fixtures, parser tests, and clearly marked Demo Mode
- Equivalent GUI and CLI flows, JSON output, and guided bilingual onboarding

Phase 1 contains no `settings put` or `settings delete`.

## Phase 2 — plans, snapshots, and bounded recovery — complete

- Before/after diff and expiring one-use plan IDs
- Versioned atomic snapshots bound to a device and user
- State-change detection and restore preview
- Exclusive Provider Pin
- Per-write read-back verification and automatic recovery
- Guarded manual restore
- Schema-v2 entity identities, parent relationships, session revisions, and terminal lifecycle states
- Diagnosis freshness enforcement across GUI, Tauri IPC, CLI JSON, and the isolated Demo

## Phase 3 — provider validation helpers

- Selected-provider refresh without arbitrary package commands
- Fixed WebAuthn test URL

## Phase 4 — reports and store delivery

- Redacted Markdown diagnostics
- Real-device Xiaomi/HyperOS acceptance matrix
- Store submission preparation and final physical-device release qualification

[English](100-ROADMAP.md) | [中文](../zh/100-ROADMAP.md)
