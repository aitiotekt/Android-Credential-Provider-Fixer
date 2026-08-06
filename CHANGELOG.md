# Changelog

All notable project changes are recorded here. The project is pre-release software and does not yet promise a stable diagnostic JSON schema across prereleases.

<!--
## Unreleased

Agents: append new changes here and mirror them in docs/zh/CHANGELOG.md.
Do not append new work to an existing version section, even if metadata still names it.
After running just set-version VERSION, move the accumulated entries into a new
visible ## VERSION section below this comment. Keep this empty template for future
work, then run just check-version and just release-check. set-version does not
move changelog entries automatically.
-->

## 0.1.0-beta.2

- Added the WebAuthn Diagnosis Android companion and a memory-only test site with browser-local registration and signature checks.
- Made the WebAuthn site a general-purpose tool: username exploration, a three-step guided mode, Android-scene return hints, prominent result summaries, and no one-hour session limit. Development uses localhost so Firefox no longer fails at `127.0.0.1`.
- Combined documentation and `/webauthn/` into one main-only Web deployment, opened the test app with a full page load from the docs site, and reorganized bilingual docs by responsibility.
- Split Android signed-AAB/store publishing from desktop releases, with independent Android versions and changelogs. Android development uses native Unix/PowerShell Just recipes (PowerShell 7.5+).
- Hardened publication: notarize and staple signed macOS DMGs, fail incomplete releases, and fix Windows CLI ZIP staging. Temporarily dropped generated third-party notices.
- Limited WebAuthn browser tests to Chromium and Firefox until Playwright restores Linux WebKit virtual-authenticator support.

## 0.1.0-beta.1

- Added `just set-version` and `just set-macos-signing`, plus an Unreleased changelog workflow for upcoming work.
- Switched all Windows channels to GitHub Artifact Attestations and SHA-256; removed Authenticode and PFX credentials. macOS still has configurable prerelease signing and mandatory stable signing/notarization. Release notes distinguish provenance from platform signatures.

## 0.1.0-alpha.6

- Published native CLI archives (macOS ARM64/x64, Windows x64, Linux GNU ARM64/x64), Tauri DMGs for both macOS architectures, and a Windows x64 NSIS installer.
- Added Tests, Release, and Docs workflows with versioned metadata, SHA-256 checksums, a schema-v1 manifest, GitHub attestations, changelog-derived notes, and generated third-party notices. Stable releases require protected approval; macOS requires Developer ID signing and notarization; Windows then required Authenticode.
- Deployed the bilingual VitePress site to `acp-fixer.aitiotekt.com`.
- Left npm/crates publishing, automatic updates, application stores, Linux GUI packages, and CI ADB out of scope.

## 0.1.0-alpha.5

- Rebuilt the desktop frontend around injected domain services, disposable Live/Demo session scopes, and explicit resource cleanup. Demo cannot reach live ADB.
- Finished the guided Demo: confirm before replacing a session, keep Exit Demo in the shell, and cover pin plus snapshot restore.
- Split English and Chinese message catalogs into independent sources. IPC, Core, CLI, and snapshot schema v2 stay compatible with alpha.4.

## 0.1.0-alpha.4

- Modeled discoveries, selections, diagnoses, previews, plans, executions, and snapshots as identity-bearing entities. A revisioned session rejects late results and blocks reuse across diagnoses.
- Upgraded GUI IPC, CLI JSON, and snapshots to schema v2. Writes persist `executing` first; cancellation, drift, and all outcomes are terminal. v1 snapshot files remain as unsupported warnings.
- Showed a diagnosis only while it is the latest session diagnosis, rebased saved ADB selections onto new discoveries, and localized desktop errors instead of internal codes.

## 0.1.0-alpha.3

- Added Exclusive Provider Pin and guarded Restore: explicit selection, before/after preview, five-minute one-use plans, atomic snapshots, read-back, and automatic recovery.
- Added dry-run `pin`, `snapshots`, and `restore` CLI commands; only `--apply` writes the device.
- Rebuilt the desktop UI with Tailwind CSS 4, a five-stage progress model, and a persisted light/dark appearance. macOS minimum is 13.3.
- Localized user-facing copy without exposing internal enums, and extended Demo through simulated Pin and Restore.
- Kept writes limited to `credential_service` and `credential_service_primary`.

## 0.1.0-alpha.2

- Added read-only ADB discovery, device enumeration, compatibility checks, Credential Provider diagnosis, and matching `devices`, `diagnose`, and `demo` CLI commands.
- Added a bilingual desktop workflow, persisted ADB selection, and an isolated guided Demo based on an anonymized Xiaomi/HyperOS investigation.
- Left setting writes, snapshots, restore, and distribution out of scope.

## 0.1.0-alpha.1

- Established the Tauri/SolidJS, CLI, shared Core, documentation, tooling, icon, and CI engineering baseline.

[English](CHANGELOG.md) | [中文](docs/zh/CHANGELOG.md)
