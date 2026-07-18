# Privacy Policy

Android Credential Provider Fixer performs its work locally. It does not collect, transmit, sell, or share device identifiers, credentials, passkeys, application inventories, or diagnostic logs.

The application reads only the selected device serial and connection state, manufacturer, model, codename, Android/API version, foreground user ID, registered Credential Provider components, and the three documented Credential Manager/Autofill settings. It does not read build fingerprints, password-manager vault contents, passkey material, accounts, or unrelated application inventories.

The selected ADB path, onboarding status, appearance preference (System, Light, or Dark), and up to 20 ordinary snapshots per device are stored locally in the application's private configuration directory. Snapshots contain the raw device serial, foreground user ID, Provider components, and before/after values for the two managed settings. Unresolved applied or recovery-failed snapshots are retained beyond the ordinary limit. The appearance preference is not stored in browser `localStorage`. Nothing is uploaded; report export is not implemented.

The application contains no analytics or crash-upload SDK. Network links are opened only after a user action, and ADB is never downloaded silently.

[English](PRIVACY.md) | [中文](docs/zh/PRIVACY.md)
