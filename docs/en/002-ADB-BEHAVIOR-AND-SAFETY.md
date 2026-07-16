# ADB Behavior and Safety

ADB is supplied and installed by the user. The application will search the GUI process environment and documented platform locations, validate the selected executable with `adb version`, display the resolved path, and support an explicit file selection. It will never download or install Platform-Tools.

Every device operation must use `adb -s SERIAL`. The serial must come from the current `adb devices -l` result, never free-form frontend input. Multiple devices require an explicit choice; unauthorized, offline, no-permission, and missing-device states remain distinct. The active Android user comes from device queries and must be a non-negative integer.

Provider components are candidates only when returned by package service enumeration for `android.service.credentials.CredentialProviderService`. Registration does not prove passkey capability, compatibility, or an unlocked vault.

## Planned writes

The only planned write mode is Exclusive Provider Pin. It sets the selected component as both `credential_service` and `credential_service_primary`, leaves `autofill_service` untouched, and does not preserve unverified fallback encodings.

A write requires two explicit confirmations and a backend-created, one-use, expiring plan bound to the device, user, component, and before-state. Execution revalidates all inputs, aborts when state changed, persists an atomic snapshot, writes one field at a time, reads it back, and restores both managed fields after any partial failure. A missing original setting is restored with `settings delete`, never by writing the string `null`.

CI and ordinary tests never invoke ADB. Real-device read tests require an explicit environment opt-in; write tests require a second independent opt-in and are not part of automated CI.

[English](002-ADB-BEHAVIOR-AND-SAFETY.md) | [中文](../zh/002-ADB-BEHAVIOR-AND-SAFETY.md)
