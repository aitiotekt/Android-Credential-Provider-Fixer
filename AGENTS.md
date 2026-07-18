# AGENTS.md

_Single source of truth for agent behavior and project engineering rules._

## Identity and Communication

- Chat in the user's language. Use English for code, code comments, identifiers, and machine-oriented documentation.
- Keep changes focused, auditable, and explicit about security-sensitive behavior.
- Do not create commits unless the user explicitly asks.

## Architecture

- `packages/core` owns domain entities, DTOs, application orchestration, and abstract adapter traits.
- `packages/core` must not depend on Tauri, Clap, or concrete process APIs.
- `apps/tauri-app` owns the SolidJS UI, Tauri IPC, and the Tauri shell adapter.
- `apps/cli` owns CLI presentation and the Tokio process adapter.
- Add shared packages only when a demonstrated boundary cannot live cleanly in `core`.

## Security Invariants

- Never expose arbitrary executable paths, commands, or arguments to the WebView.
- Never concatenate shell commands or invoke `sh -c`, `cmd /C`, or PowerShell command strings.
- Every Android device command must eventually use an explicitly selected serial and Android user.
- Do not modify `autofill_service`, passkeys, vault data, or unrelated Android settings.
- Device writes are limited to the Core change executor and the two managed secure keys. Every write requires a current diagnosis, expiring one-use plan, atomic snapshot, state-drift check, per-field read-back, and automatic recovery.
- `autofill_service` is always read-only. Do not add force-stop, ADB server management, arbitrary setting keys, or bypasses for plan expiry and state drift.
- Phase 1 device reads are limited to ADB version/device enumeration, the documented device properties, foreground user, Credential Provider service query, and the three allowlisted settings.
- Demo Mode uses bundled DTOs and must never fall through to real ADB discovery, enumeration, or inspection.
- Simulated Pin and Restore must stay inside Demo fixtures and never call live change IPC.
- Tauri capabilities must not grant shell execute or spawn access to the frontend.
- Do not connect to or modify a real Android device unless the user explicitly requests it. Tests use mocks or fake executables.
- Runtime behavior is local-only by default: no analytics, crash uploads, or silent downloads.

## Code Standards

- Use argument arrays for process execution and preserve non-UTF-8 output as bytes until explicitly decoded.
- Model timeouts, output limits, missing settings, and errors explicitly; do not collapse distinct states.
- Comments explain why, not what. Avoid speculative abstractions and one-line file fragmentation.
- TypeScript stays strict and uses explicit finite-state models instead of unrelated Boolean flags.
- UI code uses Solid signals, Tailwind CSS 4, CSS-first semantic theme tokens, and the local primitives under `apps/tauri-app/src/ui`. Do not add a router, global state library, Park UI, Ark UI, Panda CSS, or another component runtime without approval.
- Keep the local primitive boundary compatible with Park UI-style `size`, `variant`, and semantic state APIs so a future migration does not leak utility-class details into workflow logic. Use Slate for neutral surfaces and Teal as the single accent; add or change colors through light/dark semantic tokens rather than page-local values.
- User-facing pages must not expose internal phase names, DTO names, enum codes, or mixed-language implementation terminology. English and Chinese message structures stay symmetric, while fixed ADB setting keys and raw package/component values remain unchanged.
- Rust code must pass rustfmt and Clippy with warnings denied.

## Tooling and Verification

- Use versions declared by `mise.toml` and `rust-toolchain.toml`; do not treat host fallback versions as authoritative.
- Use `just` recipes for setup, formatting, linting, tests, builds, and docs.
- After changing either icon master, run `just sync-icons`; `app-icon-macos-legacy.png` intentionally uses a transparent safe zone for the ICNS used by `tauri dev` and older macOS versions.
- Before completing an iteration, run formatting, linting, type checking, relevant tests, and builds.
- CI and normal tests must never discover or invoke a host `adb` binary.

## Documentation

- Root-level convention documents are English source files with suffixless names: `README.md`, `SECURITY.md`, `PRIVACY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`. Keep them at the repository root for maximum renderer and platform compatibility.
- Do not add language-suffixed convention files such as `README.en.md` or `README.zh.md` at the repository root.
- `docs/en/{README,SECURITY,PRIVACY,CONTRIBUTING,CHANGELOG}.md` are managed relative symlinks to the English root sources. Other languages keep regular source files at the same names under `docs/{language}/`.
- Documentation filenames and long-form docs are symmetric across language directories, with language links between counterparts.
- `docsite` consumes repository docs through managed relative symlinks. Use `just sync-docs` and `just check-docs`.
- Describe current behavior as current behavior and future work as roadmap. Historical changes belong in `CHANGELOG.md` when one exists.
- Temporary agent files belong under `temp/` and are not committed.
