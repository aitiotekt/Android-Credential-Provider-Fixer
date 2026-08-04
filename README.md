# Android Credential Provider Fixer

Diagnose and repair mismatches between Android's password-manager settings and the Credential Provider state actually used for passkeys. The desktop app and CLI work locally, show proposed changes before applying them, and save the original configuration for restoration.

## What you can do

- **Diagnose provider selection:** see whether the preferred password manager is registered and enabled on an Android device.
- **Review and apply a repair:** explicitly select one provider, inspect the proposed change, and restore the saved configuration when needed.
- **Test passkeys in your browser:** create and authenticate a test passkey with the separate WebAuthn tool, without ADB.

The original investigation involved Bitwarden on Xiaomi HyperOS. Similar symptoms do not establish a fault in a particular password manager or device. See [supported devices and troubleshooting](docs/en/003-SUPPORT-AND-TROUBLESHOOTING.md).

## Get started

| Tool | Use it for | Where to start |
| --- | --- | --- |
| Desktop app | Guided device diagnosis, repair review, and restoration | [Downloads](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/releases) · [Installation and verification](docs/en/004-DISTRIBUTION-AND-STORE.md) |
| CLI | The same device workflow from a terminal | [Downloads](https://github.com/aitiotekt/Android-Credential-Provider-Fixer/releases) · [CLI usage](docs/en/003-SUPPORT-AND-TROUBLESHOOTING.md#cli-usage) |
| WebAuthn website | Register and authenticate a passkey in the current browser | [Open the test tool](https://acp-fixer.aitiotekt.com/webauthn/) · [Test guide](docs/en/005-WEBAUTHN-DIAGNOSIS.md) |
| Android companion | Settings guidance, browser testing, and manual result confirmation | [Android companion guide](docs/en/005-WEBAUTHN-DIAGNOSIS.md) |

For device diagnosis, install Android SDK Platform-Tools separately, enable USB debugging, and authorize your computer on the phone. The app does not install ADB for you. You can explore the desktop's Demo Mode without connecting a device or changing any settings.

Release availability, supported platforms, installation warnings, and download verification are covered in the [distribution guide](docs/en/004-DISTRIBUTION-AND-STORE.md). The [documentation website](https://acp-fixer.aitiotekt.com/) is available in English and Chinese.

## Before applying a repair

Pinning makes the selected password manager the only enabled and primary Credential Provider. Other providers may stop appearing until you restore the saved configuration. Every change requires review; the app checks the device state, saves a snapshot, verifies the result, and attempts recovery if a write fails.

The device tool does not change autofill settings, read vault contents, or delete passkeys. The browser test creates a real test passkey only with your consent; delete it from your password manager after testing. See the [change safety guide](docs/en/002-ADB-BEHAVIOR-AND-SAFETY.md) and [WebAuthn cleanup instructions](docs/en/005-WEBAUTHN-DIAGNOSIS.md#privacy-and-limits).

## Learn more

- **Using the tools:** the [overview](docs/en/000-OVERVIEW.md) explains their scope; [troubleshooting](docs/en/003-SUPPORT-AND-TROUBLESHOOTING.md) covers device support and common symptoms.
- **Security and privacy:** the [security policy](SECURITY.md) describes safeguards and vulnerability reporting; the [privacy policy](PRIVACY.md) explains data handling.
- **Contributing:** the [contribution guide](CONTRIBUTING.md) covers setup, development, checks, and release maintenance. The [architecture guide](docs/en/001-ARCHITECTURE.md) maps the code and its boundaries.
- **Changes and plans:** see the [desktop and Web changelog](CHANGELOG.md), [Android changelog](CHANGELOG-ANDROID.md), and [roadmap](docs/en/100-ROADMAP.md).

## About the project

This project is independent and is not affiliated with, endorsed by, or sponsored by Google, Xiaomi, Bitwarden, Microsoft, or Apple. It is [MIT licensed](LICENSE).

[English](README.md) | [中文](docs/zh/README.md)
