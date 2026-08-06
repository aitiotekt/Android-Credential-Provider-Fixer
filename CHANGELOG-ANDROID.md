# Android changelog

[中文](docs/zh/CHANGELOG-ANDROID.md)

<!--
## Unreleased

Add future changes here, then move them into a new version section.
-->

## 0.1.0-beta.1

- Opened the WebAuthn site in guided Android-scene mode from Custom Tabs or the browser fallback, with return instructions after success.
- Opened credential-provider settings through AndroidX CredentialManager on Android 14+, falling back to system settings. Returning does not prove the provider is enabled.
- Added `just dev-android` for selected-device debug install/launch. Android Studio opens the repository root (`:webauthn-diagnosis`) with JDK 26, Gradle 9.7.1, AGP 9.4.0, and Kotlin/Compose 2.4.20; app SDK targets are unchanged.

## 0.1.0-alpha.1

- Introduced WebAuthn Diagnosis: setup guidance, browser testing, and user-confirmed results.
- Used an independent Android version and a manually triggered, store-only signed AAB workflow. Play upload stays off by default; real provider and Play acceptance remain maintainer-operated.

