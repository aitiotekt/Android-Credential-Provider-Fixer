# Android Credential Provider Fixer

Android Credential Provider Fixer is an independent, local-first desktop and command-line project for diagnosing and safely repairing mismatches between Android's visible Credential Provider settings and the framework state used by Credential Manager.

> [!IMPORTANT]
> Version `0.1.0-alpha.6` adds reproducible checks, native CLI archives, Tauri installer pipelines, release evidence, and bilingual documentation deployment. Device safety is unchanged: a result is usable only in its current session context, and bounded Pin and Restore still require an explicit target, review, atomic snapshot, fresh state check, and read-back verification.

## Why this project exists

On some Android 14+ devices, an OEM settings screen can show a password manager as preferred while the provider is absent from the enabled Credential Manager state. The application makes that mismatch visible and can apply an explicitly confirmed Exclusive Provider Pin through a short-lived plan, preserving the original state and verifying every bounded write so it can recover or restore safely.

The first validated investigation involved Bitwarden on Xiaomi HyperOS. The evidence points to a state synchronization problem; it does not establish a general defect in Bitwarden, Android, or every Xiaomi device.

The only writable values are `credential_service` and `credential_service_primary` for the explicitly selected foreground Android user. `autofill_service` is never modified. CLI `pin` and `restore` are dry-runs unless `--apply` is present.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `packages/core` | Platform-independent DTOs, errors, ports, and application orchestration |
| `packages/storage` | Shared atomic local snapshot adapter for GUI and CLI |
| `apps/tauri-app` | SolidJS 2 and Tauri 2 desktop application |
| `apps/cli` | `acp-fixer` command-line application |
| `docs` | English and Chinese project documentation |
| `docsite` | Independent VitePress documentation workspace |

## Development

Prerequisites are managed through [mise](https://mise.jdx.dev/): Node 26.1.0, pnpm 12.1.0, Rust 1.98.0, Just, and prek.

```sh
mise trust
just setup
just verify
just release-check
```

Run the desktop app or CLI:

```sh
just dev
just dev-cli --help
just dev-cli devices --no-interactive
just dev-cli diagnose --device SERIAL --no-interactive
just dev-cli pin --device SERIAL --provider COMPONENT --no-interactive
just dev-cli snapshots --json
just dev-cli restore --snapshot ID --device SERIAL --no-interactive
just dev-cli demo --json
```

The desktop build exposes only narrow discovery, inspection, opaque plan/snapshot, onboarding, and Demo IPC commands. The frontend cannot submit executable paths, raw components, serials, user IDs, setting keys, or command arguments, and it has no shell, dialog, or filesystem plugin permission.

The desktop interface uses Tailwind CSS 4 with local Solid component primitives and semantic Slate/Teal tokens. Its System, Light, and Dark appearance preference is stored in the application-private preferences file; System follows the operating-system color scheme without using `localStorage`. The current macOS deployment target is 13.3 or newer.

## Downloads and release verification

GitHub Releases provide macOS Apple Silicon and Intel DMGs, a Windows x64 NSIS installer, and native CLI archives for macOS, Windows, and Linux GNU x64/ARM64. Alpha and beta platform packages may be unsigned; each release identifies that state explicitly. Stable macOS and Windows artifacts must pass platform signing, and macOS artifacts must also pass notarization.

Every release includes `SHA256SUMS`, `release-manifest.json`, third-party notices, and GitHub artifact attestations. Verify an attestation with:

```sh
gh attestation verify PATH_TO_DOWNLOAD --repo aitiotekt/Android-Credential-Provider-Fixer
```

The application still requires a separately installed Android SDK Platform-Tools. It does not bundle ADB or an updater. Project documentation is published at [acp-fixer.aitiotekt.com](https://acp-fixer.aitiotekt.com/).

Icon sources are platform-aware: `assets/icons/app-icon.png` feeds the generic assets and the macOS 26 Icon Composer artwork, while `assets/icons/app-icon-macos-legacy.png` uses the legacy macOS safe zone for the `icon.icns` shown by `tauri dev` and older systems. Run `just sync-icons` after changing either master.

## Change safety model

The repair mode is an explicit **Exclusive Provider Pin**: the selected registered provider becomes both the enabled and primary Credential Provider. Other fallback providers may disappear until the saved configuration is restored. Plans expire after five minutes and are one-use. Execution aborts on serial, user, provider-set, or setting-state drift; partial failure triggers reverse-order recovery.

The project will never provide an arbitrary ADB terminal, modify `autofill_service`, read vault contents, delete passkeys, silently install ADB, or upload diagnostics.

## Documentation

- [Overview](docs/en/000-OVERVIEW.md)
- [Architecture](docs/en/001-ARCHITECTURE.md)
- [ADB behavior and safety](docs/en/002-ADB-BEHAVIOR-AND-SAFETY.md)
- [Supported devices and troubleshooting](docs/en/003-SUPPORT-AND-TROUBLESHOOTING.md)
- [Distribution and store preparation](docs/en/004-DISTRIBUTION-AND-STORE.md)
- [Roadmap](docs/en/100-ROADMAP.md)
- [Changelog](CHANGELOG.md)

## Independence and privacy

Android Credential Provider Fixer is not affiliated with, endorsed by, or sponsored by Google, Xiaomi, Bitwarden, Microsoft, or Apple. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

MIT licensed. See [LICENSE](LICENSE).

[English](README.md) | [中文](docs/zh/README.md)
