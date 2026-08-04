# Contributing

Thank you for helping improve Android Credential Provider Fixer. Contributions should preserve the project's narrow, auditable security model.

## Setup

Install [mise](https://mise.jdx.dev/) and use the tool versions declared in [mise.toml](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/blob/main/mise.toml) and [rust-toolchain.toml](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/blob/main/rust-toolchain.toml). These files are authoritative; do not maintain a second version list in the README. Native build prerequisites still depend on the target platform.

For Android, open the repository root in Android Studio and use the root Gradle Wrapper. Configure the SDK through `ANDROID_HOME` or root-local `local.properties`. Module tasks, WebAuthn development, and device-selection requirements are documented in the [companion development guide](docs/en/005-WEBAUTHN-DIAGNOSIS.md#development-and-release).

```sh
mise trust
just setup
just verify
```

Use `just dev` for the desktop app, `just dev-cli --help` for the CLI, `just dev-docs` for documentation, and `just dev-web` for the WebAuthn website. `just dev-android` builds, installs and launches the debug Android app after explicit device selection; see the [development guide](docs/en/005-WEBAUTHN-DIAGNOSIS.md#development-and-release) for noninteractive selection and watch mode. Code and code comments are written in English. User-facing documentation is maintained in matching `docs/en` and `docs/zh` files. Root `CHANGELOG.md` is the English source and `docs/zh/CHANGELOG.md` is the Chinese source.

## Assets

The icon masters are `assets/icons/app-icon.png` for generic assets and macOS Icon Composer artwork, and `assets/icons/app-icon-macos-legacy.png` for the transparent safe zone used by the legacy ICNS. Run `just sync-icons` after changing either master. The [architecture guide](docs/en/001-ARCHITECTURE.md) contains the repository layout and frontend implementation boundaries.

## Documentation responsibilities

- **README:** introduce the tools, their user-facing capabilities, getting started, and essential safety implications. Use brief section summaries with links for details; do not add version announcements, toolchain inventories, or implementation walkthroughs.
- **Topic guides:** explain current behavior, usage, architecture, support, and distribution in the relevant document.
- **Contributing:** explain environment setup, development commands, checks, engineering conventions, and release maintenance.
- **Changelogs:** record changes under Unreleased or the release that introduced them. Keep historical version sections intact.
- **Roadmap:** describe planned work and its completion status, without presenting planned behavior as available.

Keep the English and Chinese structures aligned and link related topics instead of duplicating their full contents.

## Engineering rules

- Keep domain policy and orchestration in `packages/core`; concrete platform access belongs in an app adapter.
- Do not expose arbitrary commands to the WebView or add shell-string execution.
- Device writes belong only in the bounded Core change executor and must preserve the plan/snapshot/state-check/read-back/recovery flow. Never add a third writable setting key.
- Do not test against a real device by default.
- Keep Demo Mode isolated from live discovery and inspection adapters.
- Implement stateful, single-implementation frontend services as `class XxxService` with constructor injection and explicit public/private boundaries. Reserve `createXxx()` for stateless helpers, replaceable adapters, and reusable implementation-hiding library boundaries; never rely on ambient injection during asynchronous work.
- Use TC39 Explicit Resource Management for owned frontend lifetimes: idempotent `[Symbol.dispose]()` for synchronous cleanup, `using` for lexical ownership, and `DisposableStack` for aggregates or partial construction. Use the asynchronous forms only for cleanup that must actually be awaited.
- Name a single cleanup stack `disposableStack` or with a role-specific singular name such as `constructionStack`. Keep `resource` and `resources` for domain `EntityResource` state; plural stack names are for real collections only.
- Keep Vite and Vitest on the shared `unplugin-swc` configuration and WebView targets so `using` is lowered and focused core-js resource-management polyfills are injected from usage in development, builds, and tests. Solid must transform before SWC; do not add a competing top-level Oxc source transform or manual polyfill entry. jsdom tests do not prove Safari compatibility; a future browser suite must use Playwright WebKit and the same target.
- Keep domain events on their publishing service as private `DomainEvent<T>` Subjects with read-only Observables for downstream domain services. Do not add a shared event bus or subscribe to domain events from rendering code.
- Put frontend unit tests in the nearest module-level `__tests__/` directory rather than beside production files. Rust unit and integration tests retain the standard Cargo layout.
- Update current-state docs with behavior changes; record historical changes in a changelog.

Run `just sync-docs` after changing managed documentation aliases. The command refuses to overwrite ordinary files. Before submitting changes, run `just format`, `just verify`, and `just release-check`.

## Release maintenance

`acp-fixer-metadata.toml` is the release metadata source of truth. Discover maintenance commands with `just --list`. Run them through `mise exec -- just ...` when the mise toolchain is not already active.

| Command | Purpose |
| --- | --- |
| `just set-version VERSION` | Update release metadata, root/app/docsite packages, Tauri configuration, Cargo workspace and lockfile. Accepts `X.Y.Z`, `X.Y.Z-alpha.N`, or `X.Y.Z-beta.N`. |
| `just check-version` | Check version consistency and matching English/Chinese CHANGELOG sections. |
| `just set-macos-signing signed` / `just set-macos-signing unsigned` | Configure macOS prerelease signing; stable macOS releases always require signing. |
| `just release-check` | Validate release metadata, artifact definitions, and workflow policy locally. |
| `just stage-cli-release` | Build and archive the current platform's CLI. |
| `just build-tauri-release` | Build the current platform's Tauri release bundle. |

During development, record new entries inside the commented `## Unreleased` blocks in `CHANGELOG.md` and `docs/zh/CHANGELOG.md`. Do not append new work to an existing version section, even when metadata still names that version. When preparing a release, run `just set-version VERSION`, move the accumulated entries into matching new visible version sections, and retain the empty commented Unreleased templates. Then run `just check-version` and `just release-check`. Version setting does not generate or move changelog content, create a commit/tag, or publish a release. Windows has no signing toggle: every release uses GitHub Artifact Attestations and SHA-256 without Authenticode credentials. Release workflows must remain free of ADB calls. Do not add signing secrets to source files or unsigned fallback behavior to signed jobs.

[English](CONTRIBUTING.md) | [中文](docs/zh/CONTRIBUTING.md)
