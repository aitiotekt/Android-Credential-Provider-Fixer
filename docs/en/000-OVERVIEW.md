# Overview

Android Credential Provider Fixer addresses a specific failure mode on Android 14 and newer: an OEM settings interface can show one password manager as preferred while Credential Manager's enabled-provider state points elsewhere or is incomplete. A passkey request may then fall back to another provider or appear to do nothing.

## Device diagnosis and repair

The desktop app and CLI use ADB installed by the user. They inspect an explicitly selected device and foreground Android user, enumerate registered Credential Provider services, read the relevant settings, and explain inconsistencies.

Repair uses one explicit mode: pin a selected registered provider as the only enabled and primary provider. The user reviews the change before execution. A short-lived, one-use plan, saved snapshot, fresh state check, and read-back verification protect each write; failed writes trigger recovery, and saved configurations can be restored. Other providers may stop appearing while a pin is active. See [ADB behavior and safety](002-ADB-BEHAVIOR-AND-SAFETY.md) for the exact limits.

Demo Mode uses bundled data so the desktop workflow can be explored without ADB or a connected device. It cannot perform live device operations. Automated device-operation tests use mocks and fake executables; they do not establish compatibility with every OEM device. See [supported devices and troubleshooting](003-SUPPORT-AND-TROUBLESHOOTING.md).

## Browser testing and Android guidance

The separate [WebAuthn website](/webauthn/) tests passkey creation and authentication in the current browser. Its default exploration mode keeps username input, registration, and authentication in one view. Guided mode walks through creation, verification, and completion. Verification runs locally, and the current test data stays in page memory.

The native Android companion guides settings setup, opens the website in guided mode, and asks the user to confirm the browser result. It does not diagnose or repair device settings through ADB and does not receive an automatic browser result. See the [WebAuthn companion guide](005-WEBAUTHN-DIAGNOSIS.md) for usage, consent, and cleanup.

## Product boundaries

The device tool does not install ADB or drivers, request root, provide an arbitrary terminal, read vaults or passkey contents, delete passkeys, modify autofill settings, or upload diagnostic data. The browser tool creates a real test passkey only after consent; clearing the page does not delete it from a password manager.

Desktop release targets are macOS Apple Silicon, macOS Intel, and Windows x64. Native CLI archives also target Linux GNU ARM64/x64; Linux GUI packages are not provided. Availability, verification, and Android distribution are described in the [distribution guide](004-DISTRIBUTION-AND-STORE.md).

For release history, read the [desktop and Web changelog](CHANGELOG.md) or [Android changelog](CHANGELOG-ANDROID.md). Future work belongs in the [roadmap](100-ROADMAP.md).

[English](000-OVERVIEW.md) | [中文](../zh/000-OVERVIEW.md)
