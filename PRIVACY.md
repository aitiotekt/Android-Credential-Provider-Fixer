# Privacy Policy

Android Credential Provider Fixer performs its work locally. It does not collect, transmit, sell, or share device identifiers, credentials, passkeys, application inventories, or diagnostic logs.

The current engineering-baseline build does not execute ADB or access Android devices. Future diagnostic builds will read only the device and Credential Provider metadata described in the project documentation. They will not read password-manager vault contents or passkey material.

Local settings, snapshots, and reports will remain in the application's data directory. Reports will be created only after a user action and will redact complete serial numbers, identifying fingerprint data, usernames, host paths, credential identifiers, and unrelated package data by default.

The application contains no analytics or crash-upload SDK. Network links are opened only after a user action, and ADB is never downloaded silently.

[English](PRIVACY.md) | [中文](docs/zh/PRIVACY.md)
