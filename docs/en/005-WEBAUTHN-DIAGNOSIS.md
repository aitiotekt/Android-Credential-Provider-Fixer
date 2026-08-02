# WebAuthn Diagnosis companion

[中文](../zh/005-WEBAUTHN-DIAGNOSIS.md)

The native Android app **WebAuthn Diagnosis** (`com.aitiotekt.webauthndiagnosis`) guides the user through setup, a browser test, and a user-reported result. It does not read provider settings, enumerate installed apps, run ADB or repair a device. It supports Android 9/API 28 and later; third-party provider guidance distinguishes Android 14 and later. On Android 14+, it first opens credential provider settings through AndroidX CredentialManager, using only its own app identity. Older systems or launch failures fall back to standard system settings with explicit manual search instructions. Returning does not prove settings changed; actual OEM routing remains subject to device validation.

The [test website](/webauthn/) creates a clearly named real test passkey and then verifies an authentication signature locally. The user must explicitly agree before creation. The credential may sync through their password manager. The site does not identify the actual provider; observe the browser prompt.

## Privacy and limits

The page holds only its current random test identity, public key and challenge in memory. It does not upload WebAuthn responses or use cookies, localStorage, sessionStorage, IndexedDB or analytics. A test lasts at most one hour; an operation expires after five minutes. Refreshing, closing or clearing the page discards the test. This does **not** delete the real passkey: remove the `WebAuthn test …` entry for `acp-fixer.aitiotekt.com` in the password manager.

Static requests are served by GitHub Pages, which may process IP addresses and access logs. Password-manager synchronization follows that provider's policy. `/webauthn/` shares the documentation origin; it is not a separate RP or storage security boundary.

Verification is a browser-local diagnostic, not server authentication, proof of a provider's security, or a guarantee that other applications work. Android has no automatic result callback; its success screen means the user confirmed both website steps.

## Development and release

Android release history: [Android changelog](CHANGELOG-ANDROID.md). It is versioned separately from the desktop changelog.

The Android toolchain is JDK 26, Gradle 9.7.1, AGP 9.4.0 and Kotlin/Compose 2.4.20, using built-in Kotlin. Android Studio must support AGP 9.4 (Quail 4/2026.1.4 or later compatible). The runtime JDK does not change the application's Java/Kotlin target 17 or Android SDK levels.

Open the repository root in Android Studio. Its Gradle multi-project build maps `:webauthn-diagnosis` to the Kotlin/Compose module under `apps/android-app/app`; use the root Wrapper and root-local `local.properties` or `ANDROID_HOME` for the SDK. Android retains independent versioning and store publishing. `apps/webauthn-web` uses Solid/Tailwind with the desktop's compatibility configuration, but no desktop IPC or domain services. Java and Gradle are default mise tools locally; CI selects Android tools only in Android jobs. Use `just check-android` for JVM tests, Lint and compilation without a device, and `just check-web` for WebAuthn checks after installing Playwright browsers.

`just set-version VERSION` (or `--app default` / `--app desktop`) updates desktop/CLI and Web package versions. `--app android` changes only Android and increments versionCode for a changed version. `--version-code N` allows an explicit larger code for an Android rebuild. Android has separate bilingual changelogs; Web changes remain in the root changelog. No command moves Unreleased text automatically.

The Web workflow combines VitePress and the test SPA in one Pages artifact. Only main deploys; release and PRs validate. Android's workflow is manually triggered from main/release and defaults to `build-only`: a signed AAB is retained in Actions for 30 days, not published as an APK or GitHub Release. Metadata policy `internal` enables Play internal-test upload after artifact retention. Upload failure fails the run without deleting the AAB or blindly retrying a possibly committed release.

Maintainers must configure Play App Signing, upload-key secrets and protected `android-release` Environment; API publishing additionally needs a narrowly authorized Play service account. The first Console initialization/upload, listing, privacy/Data safety declarations and account-specific testing requirements remain manual. Store-only distribution does not prohibit developers compiling a local debug APK, but sideload distribution is not supported.

## Acceptance status

Automated browser tests use Playwright Credentials to substitute a virtual authenticator in Chromium, Firefox and WebKit. They validate application behavior and signature rejection, not native OS, Google or Bitwarden integration. Real integration, accessibility/lifecycle checks on devices, Play uploading and policy approval require separate maintainer validation. Ordinary checks never start ADB or create real passkeys.
