# Privacy Policy

Android Credential Provider Fixer performs its work locally. It does not collect, transmit, sell, or share device identifiers, credentials, passkeys, application inventories, or diagnostic logs.

The Phase 1 build reads only the selected device serial and connection state, manufacturer, model, codename, Android/API version, foreground user ID, registered Credential Provider components, and the three documented Credential Manager/Autofill settings. It does not read build fingerprints, password-manager vault contents, passkey material, accounts, or unrelated application inventories.

The selected ADB path and onboarding status are stored locally in the application's private configuration directory. Snapshots and report export are not implemented. If added later, reports will be created only after a user action and redact identifying values by default.

The application contains no analytics or crash-upload SDK. Network links are opened only after a user action, and ADB is never downloaded silently.

[English](PRIVACY.md) | [中文](docs/zh/PRIVACY.md)
