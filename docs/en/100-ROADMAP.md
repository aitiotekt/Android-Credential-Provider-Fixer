# Roadmap

## Engineering baseline — current

- SolidJS 2 / Tauri 2 application shell and bilingual UI
- Shared core contracts and bounded process-runner ports
- Tauri Rust and Tokio CLI adapters
- Documentation, VitePress, repository tooling, and cross-platform build CI

## Phase 1 — read-only diagnosis

- ADB discovery, path selection, and version validation
- Device enumeration and explicit confirmation
- Android compatibility and foreground-user inspection
- Registered Credential Provider enumeration and current-state reads
- Fake ADB fixtures, parser tests, and clearly marked Demo Mode

Phase 1 contains no `settings put` or `settings delete`.

## Phase 2 — plans and snapshots

- Before/after diff and expiring one-use plan IDs
- Versioned atomic snapshots bound to a device and user
- State-change detection and restore preview

## Phase 3 — verified writes and recovery

- Exclusive Provider Pin
- Per-write read-back verification and automatic recovery
- Manual restore, selected-provider refresh, and fixed WebAuthn test URL

## Phase 4 — reports and releases

- Redacted Markdown diagnostics
- Real-device Xiaomi/HyperOS acceptance matrix
- macOS and Windows signing, GitHub Releases, checksums, and store preparation

[English](100-ROADMAP.md) | [中文](../zh/100-ROADMAP.md)
