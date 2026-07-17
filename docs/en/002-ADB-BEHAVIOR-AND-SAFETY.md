# ADB Behavior and Safety

ADB is supplied and installed by the user. The application searches the GUI process environment and documented platform locations, validates each candidate with a separate `version` argument, displays the selected and resolved paths, and supports a Rust-native file selection. It never downloads or installs Platform-Tools.

Every device operation uses `adb -s SERIAL`. The serial comes from the current `adb devices -l` result, never free-form frontend input. No device is selected automatically; unauthorized, offline, no-permission, and missing-device states remain distinct. The backend re-enumerates before diagnosis. The active Android user comes from `am get-current-user` and must be a non-negative integer.

Phase 1 reads only manufacturer, model, codename, Android release/API, the foreground user, registered Credential Provider services, and `credential_service`, `credential_service_primary`, and `autofill_service`. It does not read build fingerprints, logs, accounts, vaults, or passkey material. A setting is represented as missing, empty, present, or unavailable; unfamiliar OEM serialization remains raw and makes the report incomplete.

Provider components are candidates only when returned by package service enumeration for `android.service.credentials.CredentialProviderService`. Registration does not prove passkey capability, compatibility, or an unlocked vault.

## Planned writes

The only planned write mode is Exclusive Provider Pin. It sets the selected component as both `credential_service` and `credential_service_primary`, leaves `autofill_service` untouched, and does not preserve unverified fallback encodings.

A write requires two explicit confirmations and a backend-created, one-use, expiring plan bound to the device, user, component, and before-state. Execution revalidates all inputs, aborts when state changed, persists an atomic snapshot, writes one field at a time, reads it back, and restores both managed fields after any partial failure. A missing original setting is restored with `settings delete`, never by writing the string `null`.

CI and ordinary tests never invoke ADB. Real-device read tests require an explicit environment opt-in; write tests require a second independent opt-in and are not part of automated CI.

[English](002-ADB-BEHAVIOR-AND-SAFETY.md) | [中文](../zh/002-ADB-BEHAVIOR-AND-SAFETY.md)
