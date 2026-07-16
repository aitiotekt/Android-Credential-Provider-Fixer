# Android Credential Provider Fixer

Android Credential Provider Fixer is an independent, local-first desktop and command-line project for diagnosing and safely repairing mismatches between Android's visible Credential Provider settings and the framework state used by Credential Manager.

> [!IMPORTANT]
> The current `0.1.0-alpha.1` build is an engineering baseline. It contains the application shell, shared core contracts, process adapters, documentation, and tests. It does **not** run ADB diagnostics or modify a device.

## Why this project exists

On some Android 14+ devices, an OEM settings screen can show a password manager as preferred while the provider is absent from the enabled Credential Manager state. The eventual tool will make that mismatch visible, create an explicit change plan, preserve the original state, verify every write, and offer recovery.

The first validated investigation involved Bitwarden on Xiaomi HyperOS. The evidence points to a state synchronization problem; it does not establish a general defect in Bitwarden, Android, or every Xiaomi device.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `packages/core` | Platform-independent DTOs, errors, ports, and application orchestration |
| `apps/tauri-app` | SolidJS 2 and Tauri 2 desktop application |
| `apps/cli` | `acp-fixer` command-line application |
| `docs` | English and Chinese project documentation |
| `docsite` | Independent VitePress documentation workspace |

## Development

Prerequisites are managed through [mise](https://mise.jdx.dev/): Node 26.1.0, pnpm 11.1.2, Rust 1.98.0, Just, and prek.

```sh
mise trust
just setup
just verify
```

Run the desktop app or CLI:

```sh
just dev
just dev-cli --help
```

The desktop build currently exposes only the safe `get_app_info` IPC command. The frontend has no shell execute or spawn capability.

Icon sources are platform-aware: `assets/icons/app-icon.png` feeds the generic assets and the macOS 26 Icon Composer artwork, while `assets/icons/app-icon-macos-legacy.png` uses the legacy macOS safe zone for the `icon.icns` shown by `tauri dev` and older systems. Run `just sync-icons` after changing either master.

## Planned safety model

The repair mode will be an explicit **Exclusive Provider Pin**: the selected registered provider becomes both the enabled and primary Credential Provider. Other fallback providers may disappear until the saved configuration is restored. Before this feature is enabled, the project must implement device/user confirmation, a one-use plan, an atomic snapshot, state-change detection, read-back verification, and automatic recovery.

The project will never provide an arbitrary ADB terminal, modify `autofill_service`, read vault contents, delete passkeys, silently install ADB, or upload diagnostics.

## Documentation

- [Overview](docs/en/000-OVERVIEW.md)
- [Architecture](docs/en/001-ARCHITECTURE.md)
- [ADB behavior and safety](docs/en/002-ADB-BEHAVIOR-AND-SAFETY.md)
- [Supported devices and troubleshooting](docs/en/003-SUPPORT-AND-TROUBLESHOOTING.md)
- [Distribution and store preparation](docs/en/004-DISTRIBUTION-AND-STORE.md)
- [Roadmap](docs/en/100-ROADMAP.md)

## Independence and privacy

Android Credential Provider Fixer is not affiliated with, endorsed by, or sponsored by Google, Xiaomi, Bitwarden, Microsoft, or Apple. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

MIT licensed. See [LICENSE](LICENSE).

[English](README.md) | [中文](docs/zh/README.md)
