# Privacy Policy

Android Credential Provider Fixer performs its work locally. It does not collect, transmit, sell, or share device identifiers, credentials, passkeys, application inventories, or diagnostic logs.

The application reads only the selected device serial and connection state, manufacturer, model, codename, Android/API version, foreground user ID, registered Credential Provider components, and the three documented Credential Manager/Autofill settings. It does not read build fingerprints, password-manager vault contents, passkey material, accounts, or unrelated application inventories.

The selected ADB path, onboarding status, appearance preference (System, Light, or Dark), and up to 20 ordinary schema-v2 snapshots per device are stored locally in the application's private configuration directory. Snapshots contain the raw device serial, foreground user ID, Provider components, before/after values for the two managed settings, source diagnosis ID, lifecycle status, and revision. Unresolved applied, executing, or recovery-failed snapshots are retained beyond the ordinary limit. Session diagnoses, previews, plans, and executions are held only in memory and are discarded at restart. Legacy v1 files are preserved as unsupported warnings and are not read for restore. The appearance preference is not stored in browser `localStorage`. Nothing is uploaded; report export is not implemented.

The application contains no analytics or crash-upload SDK. Network links are opened only after a user action, and ADB is never downloaded silently.

Release manifests, checksums, third-party notices, and provenance attestations contain build metadata only. They do not contain device snapshots, ADB paths, serials, diagnoses, or other user data. CI and release workflows do not discover or invoke ADB.

[English](PRIVACY.md) | [中文](docs/zh/PRIVACY.md)
