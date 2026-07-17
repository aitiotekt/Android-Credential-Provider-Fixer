# Overview

Android Credential Provider Fixer addresses a specific failure mode on Android 14 and newer: an OEM settings interface can show one provider as preferred while Credential Manager's enabled-provider state points elsewhere or is incomplete. A passkey request may then fall back to another provider or appear to do nothing.

The project is intentionally local, transparent, and narrow. It discovers ADB supplied by the user, identifies an explicitly selected device and foreground Android user, enumerates registered `CredentialProviderService` components, reads the relevant state, and explains inconsistencies. A later repair phase will pin one selected component as the exclusive enabled and primary provider.

## Current release

`0.1.0-alpha.2` implements Phase 1 read-only diagnosis in both the GUI and CLI. It validates ADB, enumerates device states, checks Android/API compatibility and the foreground user, enumerates registered providers, reads enabled/primary/Autofill state, and returns conservative findings. The guided Demo is isolated from live ADB. Setting writes, snapshots, restore, and report export are not implemented.

## Product boundaries

The project will not install ADB or drivers, request root, provide an arbitrary terminal, read a vault, read or delete passkeys, alter `autofill_service`, guess a multi-provider serialization format, or upload data. Android secure-setting names are treated as implementation details rather than stable public APIs.

The initial supported release targets macOS Apple Silicon, macOS Intel, and Windows x64. Linux source builds are available, but prebuilt Linux artifacts remain unsupported until WebKitGTK and packaging portability can be guaranteed.

[English](000-OVERVIEW.md) | [中文](../zh/000-OVERVIEW.md)
