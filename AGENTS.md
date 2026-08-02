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
- `apps/android-app` owns the native Kotlin/Compose WebAuthn guidance app. Use a small ViewModel state machine, not the desktop session service graph. Browser results are user-confirmed, not automatically known by the app.
- `apps/webauthn-web` owns the static Solid WebAuthn diagnostic. Browser-local verification uses SimpleWebAuthn; its third-party ASN.1 dependency may transitively use `reflect-metadata`. This explicit exception does not allow application decorators or reflection DI.
- Add shared packages only when a demonstrated boundary cannot live cleanly in `core`.
- Model discoveries, selections, enumerations, diagnoses, previews, plans, executions, and snapshots as entities with opaque typed IDs, explicit parent IDs, and lifecycle states. Device properties, components, settings, findings, and errors are values.
- A UI view must be derived from the workflow aggregate. Do not navigate independently to a page that requires an entity, and do not keep a diagnosis result visible when its ID differs from the backend's latest diagnosis ID.
- Every asynchronous session operation captures the session revision and parent entity IDs; a late result must be rejected if the active context changed.

## Security Invariants

- Never expose arbitrary executable paths, commands, or arguments to the WebView.
- Never concatenate shell commands or invoke `sh -c`, `cmd /C`, or PowerShell command strings.
- Every Android device command must eventually use an explicitly selected serial and Android user.
- Do not modify `autofill_service`, passkeys, vault data, or unrelated Android settings.
- Device writes are limited to the Core change executor and the two managed secure keys. Every write requires a current diagnosis, expiring one-use plan, atomic snapshot, state-drift check, per-field read-back, and automatic recovery.
- Preview, Plan, and Execution entities must retain their source Diagnosis ID. Plan creation persists a planned snapshot before consuming the Preview; execution persists `executing` before the first possible write, and every exit path records a terminal lifecycle state.
- `autofill_service` is always read-only. Do not add force-stop, ADB server management, arbitrary setting keys, or bypasses for plan expiry and state drift.
- Phase 1 device reads are limited to ADB version/device enumeration, the documented device properties, foreground user, Credential Provider service query, and the three allowlisted settings.
- Demo Mode uses bundled DTOs and must never fall through to real ADB discovery, enumeration, or inspection.
- Simulated Pin and Restore must stay inside Demo fixtures and never call live change IPC.
- Tauri capabilities must not grant shell execute or spawn access to the frontend.
- Do not connect to or modify a real Android device unless the user explicitly requests it. Tests use mocks or fake executables.
- Runtime behavior is local-only by default: no analytics, crash uploads, or silent downloads.
- The WebAuthn companion is an explicit exception to desktop local-only behavior: it opens the fixed HTTPS test site. Creating real test passkeys requires user action and informed consent. Only the current page's memory holds test data; no response uploads, analytics, provider metadata fetches or automatic password-manager deletion. The `/webauthn/` path shares origin/RP identity with the documentation site.
- WebAuthn CI uses Playwright Credentials only. It does not prove real Google/Bitwarden integration. Do not connect devices, install apps, create real credentials or upload to Play without the corresponding explicit authorization.

## Code Standards

- Use argument arrays for process execution and preserve non-UTF-8 output as bytes until explicitly decoded.
- Model timeouts, output limits, missing settings, and errors explicitly; do not collapse distinct states.
- Comments explain why, not what. Avoid speculative abstractions and one-line file fragmentation.
- TypeScript stays strict and uses explicit finite-state models instead of unrelated Boolean flags.
- Represent extensible TypeScript string enums as `const` objects with `as const` and a same-named derived union type.
- Diagnosis resources use `idle | resolving | resolved | failed`. Workflow transitions are reducer events with identity checks; page components must not coordinate domain navigation through unrelated `setStep` and data signals.
- Frontend session state is owned by injected domain services. Stateful, application-internal services with one implementation use `class XxxService`: dependencies enter through the constructor, mutable state is `private`, extension-only APIs are `protected`, and the public surface is explicit. Public service methods belong on the prototype; do not emulate a service with a closure-returning `createXxxService()` plus a duplicate interface.
- Keep `createXxx()` for narrow construction boundaries: stateless controllers, replaceable gateway/adapter factories, or reusable library APIs that intentionally hide multiple implementations. It is not the default for stateful application services.
- Register services through `injection-js` `InjectionToken`, `useFactory: (...deps) => new XxxService(...)`, explicit `deps`, and `provideXxx()` helpers. Resolve dependencies only at Injector/bootstrap or component-context boundaries; do not use ambient `inject()`/`runInInjectionContext`, especially across asynchronous work. Decorators and reflection metadata are forbidden.
- Owned frontend resources follow TC39 Explicit Resource Management. Implement idempotent `[Symbol.dispose]()` for synchronous cleanup, use `using` for lexical ownership, and use `DisposableStack` for dynamic aggregate lifetimes or safe partial construction. Add `[Symbol.asyncDispose]()`, `await using`, or `AsyncDisposableStack` only when cleanup genuinely must be awaited; do not maintain a parallel ad-hoc `dispose()` API.
- Name one `DisposableStack` instance `disposableStack` or with a role-specific singular name such as `constructionStack`. Reserve `resource` and `resources` for domain `EntityResource` state, and use plural stack names only for actual collections of stacks.
- Keep proposal typings narrowly scoped through `ESNext.Disposable`. Vite and Vitest must reuse the same `unplugin-swc` compatibility configuration: Solid transforms first, then SWC lowers `using` and injects focused core-js polyfills from actual usage. Concrete Chrome, Edge, and Safari engine versions are the single compatibility source of truth; derive the Vite target strings and SWC target map from them, and do not mix an ECMAScript edition into the runtime target set. Do not add a parallel top-level `oxc` source transform or a manual compatibility entry. Keep Vite's truthful `build.target` and Oxc minifier so the final dependency graph and bundle retain their compatibility boundary.
- Keep app-local build and test configuration under `apps/tauri-app/config/`, and repository automation under `scripts/`. Production modules under `apps/tauri-app/src/` belong to the WebView application graph and must not contain Vite, Vitest, SWC, or other host-only tool configuration; module-level `__tests__` remain the intentional test-only exception.
- Current frontend unit tests use jsdom and are not evidence of Safari compatibility. A future Vitest Browser suite must use a separate browser-test file set with the Playwright provider and a WebKit instance, while reusing the same WebView target configuration.
- A domain event belongs to the service that publishes it. Implement it with the local RxJS `DomainEvent<T>` Subject extension, keep the writable Subject private, and expose only a typed read-only Observable for downstream domain-service collaboration. Do not introduce a shared event bus, discriminated global event union, or event-type filtering.
- Only domain services may subscribe to domain events. Rendering reads Solid state or immutable snapshots and must not import RxJS/domain event helpers or subscribe to service events. A downstream service invalidates only its own entities and continues the cascade; it must never mutate another service's signal.
- `WorkflowService.view` is the only source of page selection. Page containers may inject their own service and workflow intentions; leaf components receive values and callbacks only.
- Live and Demo sessions use separate child Injectors. The root Injector must not provide `DeviceGateway`, and the Demo child binds only the fixture gateway so it cannot fall through to Tauri device IPC.
- A global tutorial entry must confirm before replacing an active Live or Demo workflow, must not switch while a device write is executing, and must always start from a newly created Demo session's first view after its DOM target mounts. Cancelling the prompt leaves the current session unchanged. Tutorial metadata distinguishes passive targets from actionable controls; completing the currently highlighted action advances after its next DOM target mounts, and leaving the guided path must settle the active tutorial instead of producing a missing-target error. Render child-Injector consumers under a boundary keyed by Session scope identity; changing an Injector prop must never leave components bound to the previous session graph.
- Demo identity and its exit action belong to the session shell and remain available in every Demo workflow view; individual pages must not own or conditionally hide the only exit path.
- Treat each child session scope as an arena-like lifetime boundary: every session-owned service, Subject, subscription, effect, and tutorial resource must be registered under that scope so disposing it releases the complete graph in dependency-safe reverse order.
- UI code uses Solid signals, Tailwind CSS 4, CSS-first semantic theme tokens, and the local primitives under `apps/tauri-app/src/ui`. Do not add a router, global state library, Park UI, Ark UI, Panda CSS, or another component runtime without approval.
- Keep the local primitive boundary compatible with Park UI-style `size`, `variant`, and semantic state APIs so a future migration does not leak utility-class details into workflow logic. Use Slate for neutral surfaces and Teal as the single accent; add or change colors through light/dark semantic tokens rather than page-local values.
- User-facing pages must not expose internal phase names, DTO names, enum codes, or mixed-language implementation terminology. English and Chinese message structures stay symmetric, while fixed ADB setting keys and raw package/component values remain unchanged.
- Frontend unit tests live in the nearest module-level `__tests__/` directory and use `*.test.ts` or `*.test.tsx`; do not place test files beside production source files. Keep Rust unit tests in their owning module and Cargo integration tests in the conventional crate-level `tests/` directory.
- Rust code must pass rustfmt and Clippy with warnings denied.

## Tooling and Verification

- Use versions declared by `mise.toml` and `rust-toolchain.toml`; do not treat host fallback versions as authoritative.
- Java and Gradle are default local tools. CI limits tools with `mise.ci.toml`; Android jobs add `MISE_ENV=ci,android`. Build native Android with its checked-in Gradle Wrapper and never invoke ADB during ordinary verification.
- Android uses AGP 9 built-in Kotlin. Keep its explicitly upgraded compiler dependency aligned with the Compose compiler plugin; do not reapply `org.jetbrains.kotlin.android` or opt out of the new DSL. The Gradle runtime JDK is separate from Java/Kotlin target 17 and Android SDK levels. Upgrade tooling without implicitly changing device compatibility, and update Wrapper scripts/JAR/checksum together with its distribution version.
- Open the repository root in Android Studio. Keep a single root Gradle multi-project build and Wrapper; map `:webauthn-diagnosis` to `apps/android-app/app`. Use explicit module task paths in local and CI commands, root-local SDK configuration, and module-relative metadata paths. Android release identity/versioning remain independent; do not register pnpm or Cargo projects as Gradle modules.
- Use `just` recipes for setup, formatting, linting, tests, builds, and docs.
- After changing either icon master, run `just sync-icons`; `app-icon-macos-legacy.png` intentionally uses a transparent safe zone for the ICNS used by `tauri dev` and older macOS versions.
- Before completing an iteration, run formatting, linting, type checking, relevant tests, and builds.
- CI and normal tests must never discover or invoke a host `adb` binary.
- `acp-fixer-metadata.toml` is the release metadata and version source of truth. Release policy, artifact names, manifests, and ref validation belong in typed modules under `scripts/lib/release`; workflow YAML coordinates them and must not duplicate their policy.
- Release branch automation may publish only alpha/beta versions. Stable releases require an exact version tag, protected approval, and mandatory macOS signing/notarization. Windows releases use GitHub Artifact Attestations and SHA-256 in every channel, without Authenticode, CA credentials, updater, or minisign keys. The manifest `signed` field means platform code signing only; provenance must not be presented as Windows Verified Publisher trust. macOS signing credentials stay in GitHub Environments and never enter source, reports, caches, or artifacts.
- Every downloadable artifact must be represented in the release manifest, SHA-256 checksums, and GitHub provenance attestations. Release workflows must remain idempotent and must never overwrite mismatched assets in a published release.
- `set-version --app default` and `--app desktop` update desktop/CLI and Web package versions together; Android has an independent versionName/versionCode and bilingual changelog. A changed Android version increments versionCode; a rebuilt upload may explicitly request a larger code. Web is a deployment target, not an independent SemVer line.
- Web workflow builds documentation plus `/webauthn/` into one Pages artifact. Only main may deploy; release and PR builds never overwrite production. Android release is manually dispatched, store-only, and defaults to signed AAB build-only. Preserve AAB and checksum before optional Play internal upload; never silently succeed after upload failure or automatically replay uncertain commits. No public APK or Android GitHub Release.

## Documentation

- Android changelog follows the same root-source convention: `CHANGELOG-ANDROID.md` is the English source, `docs/en/CHANGELOG-ANDROID.md` is a managed relative symlink, and `docs/zh/CHANGELOG-ANDROID.md` is the Chinese source. Do not keep duplicate Android changelogs under the app directory. Both docsite locales expose their own Android changelog route.

- Root-level convention documents are English source files with suffixless names: `README.md`, `SECURITY.md`, `PRIVACY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`. Keep them at the repository root for maximum renderer and platform compatibility.
- Do not add language-suffixed convention files such as `README.en.md` or `README.zh.md` at the repository root.
- `docs/en/{README,SECURITY,PRIVACY,CONTRIBUTING,CHANGELOG}.md` are managed relative symlinks to the English root sources. Other languages keep regular source files at the same names under `docs/{language}/`.
- Documentation filenames and long-form docs are symmetric across language directories, with language links between counterparts.
- `docsite` consumes repository docs through managed relative symlinks. Use `just sync-docs` and `just check-docs`.
- Describe current behavior as current behavior and future work as roadmap. Historical changes belong in `CHANGELOG.md` when one exists.
- Record new changes in the commented `## Unreleased` block in both English and Chinese changelogs, never by appending to an existing version section just because metadata still names that version. When preparing a release, run `just set-version VERSION`, move the accumulated entries into a new visible `## VERSION` section, and retain the empty commented Unreleased template. The command updates manifests only; moving entries is a separate editorial step. Preserve historical version sections unless explicitly correcting their history, then run `just check-version` and `just release-check`.
- Temporary agent files belong under `temp/` and are not committed.
