# Architecture

The repository uses ports and adapters without turning every small function into a separate layer.

```text
SolidJS WebView -> narrow Tauri IPC -> Tauri app adapter -> core use cases
                                                       -> CommandRunner port
CLI presentation -----------------> CLI app adapter ---> CommandRunner port
```

## Core

`packages/core` contains application DTOs, domain state, stable error codes, use-case orchestration, and adapter traits. It has no dependency on Tauri, Clap, or a concrete process implementation. `CommandRequest` holds a native executable path, an argument vector, a timeout, and an aggregate output limit. `CommandOutput` preserves stdout and stderr as bytes so non-UTF-8 device output is not silently corrupted.

Future ADB use cases will construct command requests only from discovered serials, parsed non-negative user IDs, enumerated provider components, fixed setting-key allowlists, and fixed URLs. The generic runner is an internal Rust port and is never an IPC or CLI user-input surface.

## Applications

The Tauri app implements `CommandRunner` with the Rust API of `tauri-plugin-shell`. The plugin's JavaScript binding is absent, and the WebView capability contains no shell permission. The CLI implements the same port with `tokio::process::Command`. Both adapters use argument arrays, bounded byte collection, timeouts, and child termination.

The frontend owns rendering, selection, confirmation, localization, and accessible interaction. It never parses ADB output or decides whether a write succeeded. The initial app exposes only `get_app_info`; future commands will be narrow use-case endpoints such as `create_fix_plan(plan inputs)` and `apply_fix(plan_id)`.

[English](001-ARCHITECTURE.md) | [中文](../zh/001-ARCHITECTURE.md)
