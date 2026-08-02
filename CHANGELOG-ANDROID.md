# Android changelog

[中文](docs/zh/CHANGELOG-ANDROID.md)

<!--
## Unreleased

- Open dedicated credential provider settings through AndroidX CredentialManager on Android 14+, falling back explicitly to system settings on older systems or launch failure. Never treat a return as proof of provider activation.
- Move the English changelog to the repository root, keep translations under docs, and expose both languages in the documentation site.
- Upgrade to JDK 26, Gradle 9.7.1, AGP 9.4.0 and Kotlin/Compose 2.4.20. Adopt built-in Kotlin without changing target bytecode or supported Android SDK levels; require an AGP 9.4-compatible Android Studio.
- Support opening the repository root in Android Studio through the `:webauthn-diagnosis` Gradle module and root Wrapper; keep application identity and release versioning unchanged.

Add future changes here, then move them into a new version section.
-->

## 0.1.0-alpha.1

- Introduce WebAuthn Diagnosis: system setup guidance, browser test launch, user-confirmed outcomes and troubleshooting.
- Use an independent Android version and store-only, manually triggered signed AAB workflow. Play upload is disabled by default.
- Real provider and Play distribution acceptance remain maintainer-operated checks.
