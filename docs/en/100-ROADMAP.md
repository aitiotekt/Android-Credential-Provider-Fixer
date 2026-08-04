# Roadmap

## Engineering baseline — complete

- SolidJS 2 / Tauri 2 application shell and bilingual UI
- Shared core contracts and bounded process-runner ports
- Tauri Rust and Tokio CLI adapters
- Documentation, VitePress, repository tooling, and cross-platform build CI
- Native CLI archives, Tauri installer workflows, release evidence, and bilingual GitHub Pages deployment

## Diagnosis — complete

- ADB discovery, path selection, and version validation
- Device enumeration and explicit confirmation
- Android compatibility and foreground-user inspection
- Registered Credential Provider enumeration and current-state reads
- Fake ADB fixtures, parser tests, and clearly marked Demo Mode
- Equivalent GUI and CLI flows, JSON output, and guided bilingual onboarding

Diagnosis does not use `settings put` or `settings delete`.

## Guarded changes and recovery — complete

- Before/after diff and expiring one-use plan IDs
- Versioned atomic snapshots bound to a device and user
- State-change detection and restore preview
- Exclusive Provider Pin
- Per-write read-back verification and automatic recovery
- Guarded manual restore
- Schema-v2 entity identities, parent relationships, session revisions, and terminal lifecycle states
- Diagnosis freshness enforcement across GUI, Tauri IPC, CLI JSON, and the isolated Demo

## Provider validation helpers

- Selected-provider refresh without arbitrary package commands

## Reporting and real-device validation

- Redacted Markdown diagnostics
- Real-device Xiaomi/HyperOS acceptance matrix
- Final physical-device release qualification

[English](100-ROADMAP.md) | [中文](../zh/100-ROADMAP.md)
