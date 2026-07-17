# Security Policy

## Current status

Version `0.1.0-alpha.2` performs only the documented Phase 1 ADB reads. It cannot change Android settings. Security-sensitive device modification remains out of scope until the snapshot, plan, verification, and recovery design is implemented and tested.

## Security boundaries

- The WebView must never receive a generic process or shell API.
- Executables and arguments are passed separately; shell command strings are forbidden.
- Device serials, Android users, provider components, setting keys, packages, and URLs must come from backend-controlled discovery or fixed allowlists.
- The WebView selects opaque ADB candidate and device IDs; only the Rust backend handles native paths and resolved serials.
- Demo Mode uses bundled data and must never fall through to a live ADB operation.
- Normal tests use mocks or fake executables and never use a host ADB server.
- Diagnostic data stays local and is redacted before any user-initiated export.

## Reporting a vulnerability

Use GitHub's private security advisory reporting for this repository. Do not include real credentials, passkeys, complete device serials, or unredacted diagnostic logs. Include the affected version, platform, reproduction conditions, and the security boundary that was crossed.

Please do not open a public issue until the report has been triaged.

[English](SECURITY.md) | [中文](docs/zh/SECURITY.md)
