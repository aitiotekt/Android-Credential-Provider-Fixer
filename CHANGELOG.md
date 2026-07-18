# Changelog

All notable project changes are recorded here. The project is pre-release software and does not yet promise a stable diagnostic JSON schema across alpha versions.

## 0.1.0-alpha.3

- Rebuilt the desktop interface around Tailwind CSS 4, local Solid component primitives, a responsive five-stage progress model, and vertical long-value change previews.
- Added a persisted System/Light/Dark appearance preference with live system-theme tracking and light/dark Driver.js styling; raised the macOS minimum to 13.3 and the web target to Safari 16.4.
- Reworked English and Chinese user-facing copy and localized device, discovery, snapshot, blocker, and outcome states without exposing internal enum values.
- Clarified diagnosis labels, marks an already-exclusive Provider as the disabled current state, and presents the selected ADB inside the deduplicated candidate list instead of a separate card.
- Added explicit Provider selection, before/after previews, five-minute one-use plans, versioned atomic snapshots, Exclusive Provider Pin, read-back verification, automatic recovery, and guarded manual Restore.
- Added dry-run-by-default `pin`, `snapshots`, and `restore` CLI commands; only `--apply` authorizes a device write.
- Extended the isolated bilingual Demo through simulated Pin and Restore. Driver.js Next/Previous controls now drive the corresponding Solid demo scene across view boundaries, while direct highlighted-control interaction remains supported; the close control uses a high-contrast treatment.
- Writes remain limited to `credential_service` and `credential_service_primary`; Autofill, Provider refresh, force-stop, WebAuthn launch, reports, and physical-device writes remain out of scope.

## 0.1.0-alpha.2

- Added read-only ADB discovery, validation, device enumeration, Android compatibility checks, foreground-user inspection, Credential Provider enumeration, and state diagnosis.
- Added equivalent `devices`, `diagnose`, and `demo` CLI commands with interactive and JSON modes.
- Added a bilingual desktop workflow, persisted ADB selection, conservative findings, and an isolated guided Demo based on an anonymized Xiaomi/HyperOS investigation.
- Kept Android setting writes, snapshots, restore, report export, signing, and distribution out of scope.

## 0.1.0-alpha.1

- Established the Tauri/SolidJS, CLI, shared Core, documentation, tooling, icon, and CI engineering baseline.

[English](CHANGELOG.md) | [中文](docs/zh/CHANGELOG.md)
