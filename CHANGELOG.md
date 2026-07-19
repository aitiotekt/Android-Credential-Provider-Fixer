# Changelog

All notable project changes are recorded here. The project is pre-release software and does not yet promise a stable diagnostic JSON schema across alpha versions.

## 0.1.0-alpha.5

- Kept pnpm's default mise backend on primary platforms while using its official GitHub release asset only on Intel macOS, avoiding the Aqua registry's missing `darwin/amd64` mapping.
- Replaced the desktop frontend's centralized page, IPC, and cross-view signal graph with `injection-js` domain services using explicit tokens, factory providers, and dependency lists without decorators or reflection metadata.
- Implemented stateful application services as classes with constructor injection, private lifecycle state, and prototype methods; closure factories remain only at controller, adapter, and library construction boundaries.
- Adopted TC39 Explicit Resource Management for frontend subscriptions and session scopes with idempotent `[Symbol.dispose]()`, lexical `using`, and `DisposableStack`-owned aggregate cleanup.
- Unified Vite and Vitest behind a Solid-first `unplugin-swc` compatibility transform kept outside the bundled `src` graph. SWC lowers `using` and injects focused core-js polyfills from actual usage, while Vite retains the truthful final build target and Oxc minification without a parallel source transform.
- Replaced the shared event bus with service-owned, exactly typed RxJS `DomainEvent<T>` Subjects. Downstream domain services receive read-only Observables, while rendering continues to consume only state and snapshots.
- Made `WorkflowService.view` the only page source and split the UI into domain-oriented page containers and props-only presentation components.
- Isolated each Live or Demo run in a disposable child Injector. The root does not provide a device gateway, and Demo can resolve only its deterministic fixture adapter.
- Moved all Tauri `invoke` usage behind the live gateway adapter and added architecture checks for gateway, Injector, decorator, render-event, signal-ownership, and independent-navigation boundaries.
- Rejects mismatched parent IDs as stable session errors, discards superseded asynchronous responses, consumes previews after plan creation, and prevents uncertain execution failures from leaving a replayable plan.
- Split the English and Chinese message catalogs into independent sources while retaining recursive key-symmetry checks and localized entity lifecycle labels.
- Moved frontend unit tests into module-level `__tests__/` directories and added an architecture check that prevents test files from being mixed with production sources.
- Updated tutorial navigation to replay domain intentions for each target scene, including backward navigation and the full simulated change and restore lifecycle.
- Made concrete Chrome, Edge, and Safari versions the single compatibility source of truth from which both Vite and SWC targets are derived; ECMAScript editions are no longer mixed into the runtime target set.
- Guarded the global tutorial entry with an explicit Live/Demo replacement confirmation, plan cancellation, write-in-progress blocking, and initial Demo DOM readiness before Driver.js starts.
- Moved Demo identity and Exit Demo into the session shell so the action remains available throughout setup, diagnosis, change, outcome, and snapshot views.
- Rebuilt child-Injector UI consumers when the Session scope changes, ensuring tutorial switches and restarts begin on the first isolated Demo view instead of retaining the previous workflow screen.
- Restored the guided snapshot and restore path after the single-provider change outcome, added the two omitted device-confirmation steps, and synchronized Driver progress with successful interactions on highlighted controls. The complete walkthrough now contains 24 steps; leaving through “Finish and diagnose again” dismisses the active tutorial cleanly.
- Kept Tauri IPC, Core DTOs, CLI schema v2, and snapshot schema v2 compatible with alpha.4.

## 0.1.0-alpha.4

- Rebuilt discoveries, ADB selections, device enumerations, diagnoses, previews, plans, executions, and snapshots as identity-bearing entities with typed opaque IDs and explicit parent relationships.
- Added a revisioned backend session that rejects late asynchronous results and prevents Providers, previews, or plans from crossing diagnosis contexts.
- Renamed diagnostic report `status` to `completeness` and upgraded GUI IPC, CLI JSON, and snapshot documents to schema v2.
- Added explicit Preview, Plan, Execution, and Snapshot lifecycle states. Snapshots enter `executing` before a possible device write; cancellation, expiry, drift, and all execution outcomes are terminal and cannot be replayed.
- Kept legacy v1 snapshot files untouched and reports them as unsupported inventory warnings; no migration is promised for early-development data.
- Added a discriminated frontend workflow reducer and diagnosis resource states. Diagnosis results are shown only while their ID matches the latest session diagnosis; finishing an operation starts a new diagnosis instead of redisplaying stale data.
- Demo fixtures use deterministic causal IDs and the same lifecycle projections while remaining isolated from live ADB IPC.
- Rebased a persisted ADB choice onto each new discovery entity instead of presenting an expired selection as current; stale selections now return to an actionable candidate list.
- Made device refreshes and diagnoses start new session revisions immediately, invalidating older asynchronous results, previews, and plans before they can overwrite the active context.
- Localized application, execution, setting, and snapshot errors instead of exposing stable internal error codes in the desktop interface.

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
