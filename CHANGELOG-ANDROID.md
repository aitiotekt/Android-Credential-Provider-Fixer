# Android changelog

[中文](docs/zh/CHANGELOG-ANDROID.md)

<!--
## Unreleased

- Added a persistent step menu and system Back navigation. Returning to preparation or testing discards the app's previous attempt; navigation cannot create a confirmed result or restore it through a late browser resume.
- Removed the version label from app screens for cleaner screenshots and recordings; package version metadata remains available to Android.

Add future changes here, then move them into a new version section.
-->

## 0.1.0-beta.2

- Added a white adaptive launcher icon with a teal fingerprint and golden diagnostic magnifier, Android 13 themed-icon support, and upload-ready Google Play artwork.
- Shared the diagnostic icon with the WebAuthn site's favicon and aligned the desktop repair icon's white, teal, and gold design. Retained full-resolution artwork and export instructions.

## 0.1.0-beta.1

- Opened the WebAuthn site in guided Android-scene mode from Custom Tabs or the browser fallback, with return instructions after success.
- Opened credential-provider settings through AndroidX CredentialManager on Android 14+, falling back to system settings. Returning does not prove the provider is enabled.
- Added `just dev-android` for selected-device debug install/launch. Android Studio opens the repository root (`:webauthn-diagnosis`) with JDK 26, Gradle 9.7.1, AGP 9.4.0, and Kotlin/Compose 2.4.20; app SDK targets are unchanged.

## 0.1.0-alpha.1

- Introduced WebAuthn Diagnosis: setup guidance, browser testing, and user-confirmed results.
- Used an independent Android version and a manually triggered, store-only signed AAB workflow. Play upload stays off by default; real provider and Play acceptance remain maintainer-operated.
