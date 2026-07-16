# Overview

Android Credential Provider Fixer addresses a specific failure mode on Android 14 and newer: an OEM settings interface can show one provider as preferred while Credential Manager's enabled-provider state points elsewhere or is incomplete. A passkey request may then fall back to another provider or appear to do nothing.

The project is intentionally local, transparent, and narrow. It discovers ADB supplied by the user, identifies a device and foreground Android user, enumerates registered `CredentialProviderService` components, reads the relevant state, and explains inconsistencies. A later repair phase will pin one selected component as the exclusive enabled and primary provider.

## Current release

`0.1.0-alpha.1` is an engineering baseline. The GUI, CLI, core interfaces, concrete process adapters, documentation, and CI exist. There is no ADB discovery, device inspection, Demo Mode, setting write, snapshot, restore, or report export yet.

## Product boundaries

The project will not install ADB or drivers, request root, provide an arbitrary terminal, read a vault, read or delete passkeys, alter `autofill_service`, guess a multi-provider serialization format, or upload data. Android secure-setting names are treated as implementation details rather than stable public APIs.

The initial supported release targets macOS Apple Silicon, macOS Intel, and Windows x64. Linux source builds are available, but prebuilt Linux artifacts remain unsupported until WebKitGTK and packaging portability can be guaranteed.

[English](000-OVERVIEW.md) | [中文](../zh/000-OVERVIEW.md)
